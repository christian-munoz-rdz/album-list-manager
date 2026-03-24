import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import {
  searchAlbums,
  getAlbum,
  refreshAccessToken,
} from '../services/spotify';
import { getAlbumInfo } from '../services/lastfm';

const router = Router();

/**
 * Ensure the session has a valid Spotify access token.
 * Refreshes the token if expired, updates session and DB.
 */
async function ensureFreshToken(req: Request): Promise<string> {
  const now = Date.now();

  if (req.session.spotifyTokenExpiresAt && req.session.spotifyTokenExpiresAt < now) {
    const refreshToken = req.session.spotifyRefreshToken;
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokens = await refreshAccessToken(refreshToken);
    const expiresAt = now + tokens.expires_in * 1000;

    // Update session
    req.session.spotifyAccessToken = tokens.access_token;
    req.session.spotifyTokenExpiresAt = expiresAt;
    if (tokens.refresh_token) {
      req.session.spotifyRefreshToken = tokens.refresh_token;
    }

    // Update DB
    await query(
      `UPDATE users
       SET spotify_access_token = $1,
           spotify_refresh_token = COALESCE($2, spotify_refresh_token),
           spotify_token_expires_at = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [
        tokens.access_token,
        tokens.refresh_token ?? null,
        new Date(expiresAt).toISOString(),
        req.session.userId,
      ]
    );

    return tokens.access_token;
  }

  if (!req.session.spotifyAccessToken) {
    throw new Error('No access token in session');
  }

  return req.session.spotifyAccessToken;
}

// GET /api/albums/search?q=query - Search Spotify albums
router.get('/search', requireAuth, async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const accessToken = await ensureFreshToken(req);
    const albums = await searchAlbums(q.trim(), accessToken);
    res.json(albums);
  } catch (err) {
    console.error('Error searching albums:', err);
    res.status(500).json({ error: 'Failed to search albums' });
  }
});

// POST /api/albums/add - Add album to list
router.post('/add', requireAuth, async (req: Request, res: Response) => {
  const { list_id, spotify_album_id } = req.body;

  if (!list_id || !spotify_album_id) {
    return res.status(400).json({ error: 'list_id and spotify_album_id are required' });
  }

  try {
    // Verify the list belongs to the current user
    const listResult = await query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [list_id, req.session.userId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Check if album is already in cache; fetch from Spotify if not
    let cacheResult = await query(
      'SELECT * FROM albums_cache WHERE spotify_album_id = $1',
      [spotify_album_id]
    );

    if (cacheResult.rows.length === 0) {
      const accessToken = await ensureFreshToken(req);
      const spotifyAlbum = await getAlbum(spotify_album_id, accessToken);

      const artistName = spotifyAlbum.artists.map((a) => a.name).join(', ');
      const releaseYear = spotifyAlbum.release_date
        ? parseInt(spotifyAlbum.release_date.substring(0, 4), 10)
        : null;
      const imageUrl = spotifyAlbum.images?.[0]?.url ?? null;

      // Fetch Last.fm data for enrichment
      const lastfmData = await getAlbumInfo(
        spotifyAlbum.artists[0]?.name ?? '',
        spotifyAlbum.name
      );

      const topTracks = (spotifyAlbum.tracks?.items ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        duration_ms: t.duration_ms,
        preview_url: t.preview_url,
      }));

      await query(
        `INSERT INTO albums_cache (
           spotify_album_id, artist_name, album_name, release_year,
           image_url, images, spotify_popularity, total_tracks, genres,
           lastfm_tags, lastfm_listeners, lastfm_playcount, top_tracks,
           external_urls, last_fetched
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
         ON CONFLICT (spotify_album_id) DO UPDATE SET
           artist_name = EXCLUDED.artist_name,
           album_name = EXCLUDED.album_name,
           release_year = EXCLUDED.release_year,
           image_url = EXCLUDED.image_url,
           images = EXCLUDED.images,
           spotify_popularity = EXCLUDED.spotify_popularity,
           total_tracks = EXCLUDED.total_tracks,
           genres = EXCLUDED.genres,
           lastfm_tags = EXCLUDED.lastfm_tags,
           lastfm_listeners = EXCLUDED.lastfm_listeners,
           lastfm_playcount = EXCLUDED.lastfm_playcount,
           top_tracks = EXCLUDED.top_tracks,
           external_urls = EXCLUDED.external_urls,
           last_fetched = NOW()`,
        [
          spotifyAlbum.id,
          artistName,
          spotifyAlbum.name,
          releaseYear,
          imageUrl,
          JSON.stringify(spotifyAlbum.images),
          spotifyAlbum.popularity ?? null,
          spotifyAlbum.total_tracks,
          JSON.stringify(spotifyAlbum.genres ?? []),
          JSON.stringify(lastfmData?.tags ?? []),
          lastfmData?.listeners ?? null,
          lastfmData?.playcount ?? null,
          JSON.stringify(topTracks),
          JSON.stringify(spotifyAlbum.external_urls),
        ]
      );

      cacheResult = await query(
        'SELECT * FROM albums_cache WHERE spotify_album_id = $1',
        [spotify_album_id]
      );
    }

    // Determine next position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM list_albums WHERE list_id = $1',
      [list_id]
    );
    const nextPos: number = posResult.rows[0].next_pos;

    // Add album to list
    await query(
      `INSERT INTO list_albums (list_id, spotify_album_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (list_id, spotify_album_id) DO NOTHING`,
      [list_id, spotify_album_id, nextPos]
    );

    res.status(201).json(cacheResult.rows[0]);
  } catch (err) {
    console.error('Error adding album:', err);
    res.status(500).json({ error: 'Failed to add album' });
  }
});

// DELETE /api/albums/remove - Remove album from list
router.delete('/remove', requireAuth, async (req: Request, res: Response) => {
  const { list_id, spotify_album_id } = req.body;

  if (!list_id || !spotify_album_id) {
    return res.status(400).json({ error: 'list_id and spotify_album_id are required' });
  }

  try {
    // Verify the list belongs to the current user
    const listResult = await query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [list_id, req.session.userId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const result = await query(
      'DELETE FROM list_albums WHERE list_id = $1 AND spotify_album_id = $2 RETURNING id',
      [list_id, spotify_album_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Album not found in list' });
    }

    res.json({ message: 'Album removed successfully' });
  } catch (err) {
    console.error('Error removing album:', err);
    res.status(500).json({ error: 'Failed to remove album' });
  }
});

// PUT /api/albums/reorder - Reorder albums in list
router.put('/reorder', requireAuth, async (req: Request, res: Response) => {
  const { list_id, album_ids } = req.body;

  if (!list_id || !Array.isArray(album_ids)) {
    return res.status(400).json({ error: 'list_id and album_ids array are required' });
  }

  try {
    // Verify the list belongs to the current user
    const listResult = await query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [list_id, req.session.userId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Update positions for each album
    const updatePromises = (album_ids as string[]).map((albumId, index) =>
      query(
        'UPDATE list_albums SET position = $1 WHERE list_id = $2 AND spotify_album_id = $3',
        [index, list_id, albumId]
      )
    );

    await Promise.all(updatePromises);

    res.json({ message: 'Albums reordered successfully' });
  } catch (err) {
    console.error('Error reordering albums:', err);
    res.status(500).json({ error: 'Failed to reorder albums' });
  }
});

// PUT /api/albums/note - Update note for an album in a list
router.put('/note', requireAuth, async (req: Request, res: Response) => {
  const { list_id, spotify_album_id, note } = req.body;

  if (!list_id || !spotify_album_id) {
    return res.status(400).json({ error: 'list_id and spotify_album_id are required' });
  }

  try {
    // Verify the list belongs to the current user
    const listResult = await query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [list_id, req.session.userId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const result = await query(
      `UPDATE list_albums
       SET user_note = $1
       WHERE list_id = $2 AND spotify_album_id = $3
       RETURNING *`,
      [note ?? null, list_id, spotify_album_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Album not found in list' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating album note:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// GET /api/albums/:spotify_album_id - Get enriched album details
router.get('/:spotify_album_id', requireAuth, async (req: Request, res: Response) => {
  const { spotify_album_id } = req.params;

  try {
    const cacheResult = await query(
      'SELECT * FROM albums_cache WHERE spotify_album_id = $1',
      [spotify_album_id]
    );

    if (cacheResult.rows.length > 0) {
      return res.json(cacheResult.rows[0]);
    }

    // Fetch from Spotify if not in cache
    const accessToken = await ensureFreshToken(req);
    const spotifyAlbum = await getAlbum(spotify_album_id, accessToken);

    const artistName = spotifyAlbum.artists.map((a) => a.name).join(', ');
    const releaseYear = spotifyAlbum.release_date
      ? parseInt(spotifyAlbum.release_date.substring(0, 4), 10)
      : null;
    const imageUrl = spotifyAlbum.images?.[0]?.url ?? null;

    const lastfmData = await getAlbumInfo(
      spotifyAlbum.artists[0]?.name ?? '',
      spotifyAlbum.name
    );

    const topTracks = (spotifyAlbum.tracks?.items ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      duration_ms: t.duration_ms,
      preview_url: t.preview_url,
    }));

    await query(
      `INSERT INTO albums_cache (
         spotify_album_id, artist_name, album_name, release_year,
         image_url, images, spotify_popularity, total_tracks, genres,
         lastfm_tags, lastfm_listeners, lastfm_playcount, top_tracks,
         external_urls, last_fetched
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (spotify_album_id) DO UPDATE SET
         last_fetched = NOW()`,
      [
        spotifyAlbum.id,
        artistName,
        spotifyAlbum.name,
        releaseYear,
        imageUrl,
        JSON.stringify(spotifyAlbum.images),
        spotifyAlbum.popularity ?? null,
        spotifyAlbum.total_tracks,
        JSON.stringify(spotifyAlbum.genres ?? []),
        JSON.stringify(lastfmData?.tags ?? []),
        lastfmData?.listeners ?? null,
        lastfmData?.playcount ?? null,
        JSON.stringify(topTracks),
        JSON.stringify(spotifyAlbum.external_urls),
      ]
    );

    const finalResult = await query(
      'SELECT * FROM albums_cache WHERE spotify_album_id = $1',
      [spotify_album_id]
    );

    res.json(finalResult.rows[0]);
  } catch (err) {
    console.error('Error fetching album details:', err);
    res.status(500).json({ error: 'Failed to fetch album details' });
  }
});

export default router;
