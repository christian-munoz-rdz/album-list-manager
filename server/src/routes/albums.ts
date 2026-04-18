import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireUser } from '../middleware/auth';
import { getAlbumInfoBestEffort } from '../services/lastfm';

const router = Router();

// DELETE /api/albums/remove - Remove album from list
router.delete('/remove', requireUser, async (req: Request, res: Response) => {
  const { list_id, album_id } = req.body;

  if (!list_id || !album_id) {
    return res.status(400).json({ error: 'list_id and album_id are required' });
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
      'DELETE FROM list_albums WHERE list_id = $1 AND album_id = $2 RETURNING id',
      [list_id, album_id]
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
        'UPDATE list_albums SET position = $1 WHERE list_id = $2 AND album_id = $3',
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
  const { list_id, album_id, note } = req.body;

  if (!list_id || !album_id) {
    return res.status(400).json({ error: 'list_id and album_id are required' });
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
       WHERE list_id = $2 AND album_id = $3
       RETURNING *`,
      [note ?? null, list_id, album_id]
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

// PUT /api/albums/listened - Mark album as listened or not (list owner only)
router.put('/listened', requireUser, async (req: Request, res: Response) => {
  const { list_id, album_id, listened } = req.body;

  if (!list_id || !album_id || typeof listened !== 'boolean') {
    return res.status(400).json({ error: 'list_id, album_id, and listened (boolean) are required' });
  }

  try {
    const listResult = await query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [list_id, req.userId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const listenedAt = listened ? new Date().toISOString() : null;

    const result = await query(
      `UPDATE list_albums
       SET listened_at = $1
       WHERE list_id = $2 AND album_id = $3
       RETURNING *`,
      [listenedAt, list_id, album_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Album not found in list' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating listened:', err);
    res.status(500).json({ error: 'Failed to update listened state' });
  }
});

// PUT /api/albums/rating - Star rating 0–5 (0 = unrated)
router.put('/rating', requireUser, async (req: Request, res: Response) => {
  const { list_id, album_id, rating } = req.body;

  if (!list_id || !album_id) {
    return res.status(400).json({ error: 'list_id and album_id are required' });
  }

  const r = Number(rating);
  if (!Number.isInteger(r) || r < 0 || r > 5) {
    return res.status(400).json({ error: 'rating must be an integer from 0 to 5' });
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
       SET rating = $1
       WHERE list_id = $2 AND album_id = $3
       RETURNING *`,
      [r, list_id, album_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Album not found in list' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating album rating:', err);
    res.status(500).json({ error: 'Failed to update rating' });
  }
});

// POST /api/albums/refresh-cover — re-fetch cover + Last.fm stats from cache row.
router.post('/refresh-cover', requireUser, async (req: Request, res: Response) => {
  const { list_id, album_id } = req.body;

  if (!list_id || !album_id) {
    return res.status(400).json({ error: 'list_id and album_id are required' });
  }

  try {
    const member = await query(
      `SELECT la.album_id
       FROM list_albums la
       JOIN lists l ON l.id = la.list_id
       WHERE la.list_id = $1 AND la.album_id = $2 AND l.user_id = $3`,
      [list_id, album_id, req.userId]
    );

    if (member.rows.length === 0) {
      return res.status(404).json({ error: 'Album not found in list' });
    }

    const cacheResult = await query('SELECT * FROM albums_cache WHERE album_id = $1', [
      album_id,
    ]);

    if (cacheResult.rows.length === 0) {
      return res.status(404).json({ error: 'Album not in cache' });
    }

    const row = cacheResult.rows[0] as Record<string, unknown>;
    const artist = String(row.artist_name ?? '');
    const album = String(row.album_name ?? '');

    let imageUrl: string | null = (row.image_url as string | null) ?? null;
    let imagesJson: string = row.images != null ? JSON.stringify(row.images) : JSON.stringify([]);
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

    await query(
      `UPDATE albums_cache SET
        image_url = $2,
        images = $3::jsonb,
        lastfm_listeners = $4,
        lastfm_playcount = $5,
        lastfm_tags = $6::jsonb,
        external_urls = $7::jsonb,
        last_fetched = NOW()
      WHERE album_id = $1`,
      [
        album_id,
        imageUrl,
        imagesJson,
        lastfmListeners,
        lastfmPlaycount,
        lastfmTagsJson,
        JSON.stringify(ext),
      ]
    );

    const updated = await query('SELECT * FROM albums_cache WHERE album_id = $1', [
      album_id,
    ]);

    res.json({ album: updated.rows[0] });
  } catch (err) {
    console.error('Error refreshing album cover:', err);
    res.status(500).json({ error: 'Failed to refresh album cover' });
  }
});

// GET /api/albums/:album_id/lastfm — Live Last.fm album page data (wiki, tracklist, stats).
router.get('/:album_id/lastfm', requireUser, async (req: Request, res: Response) => {
  const { album_id } = req.params;

  try {
    const cacheResult = await query(
      'SELECT artist_name, album_name FROM albums_cache WHERE album_id = $1',
      [album_id]
    );

    if (cacheResult.rows.length === 0) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const row = cacheResult.rows[0] as { artist_name: string; album_name: string };
    const lfm = await getAlbumInfoBestEffort(row.artist_name, row.album_name);

    if (!lfm) {
      return res.json({
        wiki_summary: null,
        wiki_content: null,
        tracks: [],
        tags: [],
        listeners: null,
        playcount: null,
        image_url: null,
        lastfm_url: null,
      });
    }

    res.json({
      wiki_summary: lfm.wikiSummary,
      wiki_content: lfm.wikiContent,
      tracks: lfm.tracks.map((t) => ({
        name: t.name,
        duration_sec: t.durationSec,
        url: t.url,
        rank: t.rank,
      })),
      tags: lfm.tags,
      listeners: lfm.listeners,
      playcount: lfm.playcount,
      image_url: lfm.imageUrl,
      lastfm_url: lfm.url,
    });
  } catch (err) {
    console.error('Error fetching Last.fm album page:', err);
    res.status(500).json({ error: 'Failed to fetch Last.fm album details' });
  }
});

// GET /api/albums/:album_id - Get album details from cache
router.get('/:album_id', requireUser, async (req: Request, res: Response) => {
  const { album_id } = req.params;

  try {
    const cacheResult = await query(
      'SELECT * FROM albums_cache WHERE album_id = $1',
      [album_id]
    );

    if (cacheResult.rows.length === 0) {
      return res.status(404).json({ error: 'Album not found' });
    }

    res.json(cacheResult.rows[0]);
  } catch (err) {
    console.error('Error fetching album details:', err);
    res.status(500).json({ error: 'Failed to fetch album details' });
  }
});

export default router;
