import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireUser } from '../middleware/auth';
import { searchAlbums, getAlbum, getClientAccessToken } from '../services/spotify';
import { getAlbumInfo, getAlbumInfoBestEffort, normalizeLastFmAlbumTitle, normalizeLastFmArtist } from '../services/lastfm';

const router = Router();

// GET /api/albums/search?q=query - Search Spotify albums (client-credentials)
router.get('/search', requireUser, async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const accessToken = await getClientAccessToken();
    const albums = await searchAlbums(q.trim(), accessToken);
    res.json(albums);
  } catch (err) {
    if (err instanceof Error && 'isAxiosError' in err) {
      const axiosErr = err as Error & {
        response?: { status?: number; data?: { error?: { message?: string } } };
      };
      const status = axiosErr.response?.status ?? 500;
      const message = axiosErr.response?.data?.error?.message ?? 'Failed to search albums';
      console.error('Error searching albums:', { status, message });
      return res.status(status).json({ error: message });
    }
    console.error('Error searching albums:', err);
    res.status(500).json({ error: 'Failed to search albums' });
  }
});

// POST /api/albums/add - Add album to list
router.post('/add', requireUser, async (req: Request, res: Response) => {
  const { list_id, spotify_album_id } = req.body;

  if (!list_id || !spotify_album_id) {
    return res.status(400).json({ error: 'list_id and spotify_album_id are required' });
  }

  try {
    const listResult = await query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [list_id, req.userId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    let cacheResult = await query(
      'SELECT * FROM albums_cache WHERE spotify_album_id = $1',
      [spotify_album_id]
    );

    if (cacheResult.rows.length === 0) {
      const accessToken = await getClientAccessToken();
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

    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM list_albums WHERE list_id = $1',
      [list_id]
    );
    const nextPos: number = posResult.rows[0].next_pos;

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
router.delete('/remove', requireUser, async (req: Request, res: Response) => {
  const { list_id, spotify_album_id } = req.body;

  if (!list_id || !spotify_album_id) {
    return res.status(400).json({ error: 'list_id and spotify_album_id are required' });
  }

  try {
    const listResult = await query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [list_id, req.userId]
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
router.put('/reorder', requireUser, async (req: Request, res: Response) => {
  const { list_id, album_ids } = req.body;

  if (!list_id || !Array.isArray(album_ids)) {
    return res.status(400).json({ error: 'list_id and album_ids array are required' });
  }

  try {
    const listResult = await query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [list_id, req.userId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

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
router.put('/note', requireUser, async (req: Request, res: Response) => {
  const { list_id, spotify_album_id, note } = req.body;

  if (!list_id || !spotify_album_id) {
    return res.status(400).json({ error: 'list_id and spotify_album_id are required' });
  }

  try {
    const listResult = await query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [list_id, req.userId]
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

// POST /api/albums/refresh-cover — re-fetch cover + Last.fm stats from cache row (must be before /:spotify_album_id)
router.post('/refresh-cover', requireUser, async (req: Request, res: Response) => {
  const { list_id, spotify_album_id } = req.body;

  if (!list_id || !spotify_album_id) {
    return res.status(400).json({ error: 'list_id and spotify_album_id are required' });
  }

  try {
    const member = await query(
      `SELECT la.spotify_album_id
       FROM list_albums la
       JOIN lists l ON l.id = la.list_id
       WHERE la.list_id = $1 AND la.spotify_album_id = $2 AND l.user_id = $3`,
      [list_id, spotify_album_id, req.userId]
    );

    if (member.rows.length === 0) {
      return res.status(404).json({ error: 'Album not found in list' });
    }

    const cacheResult = await query('SELECT * FROM albums_cache WHERE spotify_album_id = $1', [
      spotify_album_id,
    ]);

    if (cacheResult.rows.length === 0) {
      return res.status(404).json({ error: 'Album not in cache' });
    }

    const row = cacheResult.rows[0] as Record<string, unknown>;
    const artist = String(row.artist_name ?? '');
    const album = String(row.album_name ?? '');

    let imageUrl: string | null = (row.image_url as string | null) ?? null;
    let imagesJson: string =
      row.images != null ? JSON.stringify(row.images) : JSON.stringify([]);
    let lastfmListeners = row.lastfm_listeners as number | null;
    let lastfmPlaycount = row.lastfm_playcount as number | null;
    let lastfmTagsJson =
      row.lastfm_tags != null ? JSON.stringify(row.lastfm_tags) : '[]';

    const ext =
      row.external_urls != null && typeof row.external_urls === 'object'
        ? { ...(row.external_urls as Record<string, unknown>) }
        : {};

    const lfm = await getAlbumInfoBestEffort(artist, album);
    if (lfm) {
      lastfmListeners = lfm.listeners;
      lastfmPlaycount = lfm.playcount;
      if (lfm.tags?.length) lastfmTagsJson = JSON.stringify(lfm.tags);
      if (lfm.url) ext.lastfm = lfm.url;
      if (lfm.imageUrl) {
        imageUrl = lfm.imageUrl;
        imagesJson = JSON.stringify([{ url: lfm.imageUrl, width: 300, height: 300 }]);
      }
    }

    const isSyntheticLastfm = String(spotify_album_id).startsWith('lastfm:');
    if (!imageUrl && !isSyntheticLastfm) {
      try {
        const accessToken = await getClientAccessToken();
        const spotifyAlbum = await getAlbum(spotify_album_id, accessToken);
        const spotImg = spotifyAlbum.images?.[0]?.url ?? null;
        if (spotImg) {
          imageUrl = spotImg;
          imagesJson = JSON.stringify(spotifyAlbum.images ?? []);
        }
      } catch {
        // ignore Spotify errors for refresh
      }
    }

    if (!imageUrl) {
      try {
        const accessToken = await getClientAccessToken();
        const ar = normalizeLastFmArtist(artist);
        const al = normalizeLastFmAlbumTitle(album);
        const q = `album:${al} artist:${ar}`;
        const items = await searchAlbums(q, accessToken);
        const first = items[0];
        const spotImg = first?.images?.[0]?.url ?? null;
        if (spotImg) {
          imageUrl = spotImg;
          imagesJson = JSON.stringify(first?.images ?? []);
        }
      } catch {
        // ignore search errors
      }
    }

    await query(
      `UPDATE albums_cache SET
        image_url = $2,
        images = $3::jsonb,
        lastfm_listeners = $4,
        lastfm_playcount = $5,
        lastfm_tags = $6::jsonb,
        external_urls = $7::jsonb,
        last_fetched = NOW()
      WHERE spotify_album_id = $1`,
      [
        spotify_album_id,
        imageUrl,
        imagesJson,
        lastfmListeners,
        lastfmPlaycount,
        lastfmTagsJson,
        JSON.stringify(ext),
      ]
    );

    const updated = await query('SELECT * FROM albums_cache WHERE spotify_album_id = $1', [
      spotify_album_id,
    ]);

    res.json({ album: updated.rows[0] });
  } catch (err) {
    console.error('Error refreshing album cover:', err);
    res.status(500).json({ error: 'Failed to refresh album cover' });
  }
});

// GET /api/albums/:spotify_album_id - Get enriched album details
router.get('/:spotify_album_id', requireUser, async (req: Request, res: Response) => {
  const { spotify_album_id } = req.params;

  try {
    const cacheResult = await query(
      'SELECT * FROM albums_cache WHERE spotify_album_id = $1',
      [spotify_album_id]
    );

    if (cacheResult.rows.length > 0) {
      return res.json(cacheResult.rows[0]);
    }

    const accessToken = await getClientAccessToken();
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
