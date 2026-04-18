import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireUser } from '../middleware/auth';

const router = Router();

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

// GET /api/lists - Get all lists for current user with album counts + first 5 cover URLs
router.get('/', requireUser, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
         l.*,
         COUNT(la.id)::int AS album_count,
         (
           SELECT COALESCE(json_agg(x.url ORDER BY x.pos), '[]'::json)
           FROM (
             SELECT
               la2.position AS pos,
               COALESCE(
                 NULLIF(btrim(ac.image_url), ''),
                 ac.images->0->>'url'
               ) AS url
             FROM list_albums la2
             INNER JOIN albums_cache ac ON ac.album_id = la2.album_id
             WHERE la2.list_id = l.id
             ORDER BY la2.position ASC
             LIMIT 5
           ) x
         ) AS thumbnail_urls
       FROM lists l
       LEFT JOIN list_albums la ON la.list_id = l.id
       WHERE l.user_id = $1
       GROUP BY l.id
       ORDER BY l.created_at DESC`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching lists:', err);
    res.status(500).json({ error: 'Failed to fetch lists' });
  }
});

// POST /api/lists - Create a new list
router.post('/', requireUser, async (req: Request, res: Response) => {
  const { title, description, is_public } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    // Enforce max 10 lists per user
    const countResult = await query(
      'SELECT COUNT(*)::int AS count FROM lists WHERE user_id = $1',
      [req.userId]
    );

    if (countResult.rows[0].count >= 10) {
      return res.status(400).json({ error: 'Maximum of 10 lists allowed per user' });
    }

    const isPublic = Boolean(is_public);
    const slug = isPublic ? generateSlug(title.trim()) : null;

    const result = await query(
      `INSERT INTO lists (user_id, title, description, is_public, slug)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.userId, title.trim(), description ?? null, isPublic, slug]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating list:', err);
    res.status(500).json({ error: 'Failed to create list' });
  }
});

// GET /api/lists/shared/:slug - Get public list by slug (no auth required)
router.get('/shared/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const listResult = await query(
      `SELECT l.*, u.display_name AS owner_display_name, u.username AS owner_username
       FROM lists l
       JOIN users u ON u.id = l.user_id
       WHERE l.slug = $1 AND l.is_public = TRUE`,
      [slug]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const list = listResult.rows[0];

    const albumsResult = await query(
      `SELECT ac.*, la.id AS list_album_id, la.position, la.user_note, la.added_at,
              COALESCE(la.rating, 0)::int AS rating,
              la.listened_at
       FROM list_albums la
       JOIN albums_cache ac ON ac.album_id = la.album_id
       WHERE la.list_id = $1
       ORDER BY la.position ASC`,
      [list.id]
    );

    res.json({ ...list, albums: albumsResult.rows });
  } catch (err) {
    console.error('Error fetching shared list:', err);
    res.status(500).json({ error: 'Failed to fetch list' });
  }
});

// GET /api/lists/:id - Get a single list with albums
router.get('/:id', requireUser, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const listResult = await query(
      'SELECT * FROM lists WHERE id = $1',
      [id]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const list = listResult.rows[0];

    // User must own the list or it must be public
    if (list.user_id !== req.userId && !list.is_public) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const albumsResult = await query(
      `SELECT ac.*, la.id AS list_album_id, la.position, la.user_note, la.added_at,
              COALESCE(la.rating, 0)::int AS rating,
              la.listened_at
       FROM list_albums la
       JOIN albums_cache ac ON ac.album_id = la.album_id
       WHERE la.list_id = $1
       ORDER BY la.position ASC`,
      [list.id]
    );

    res.json({ ...list, albums: albumsResult.rows });
  } catch (err) {
    console.error('Error fetching list:', err);
    res.status(500).json({ error: 'Failed to fetch list' });
  }
});

// PUT /api/lists/:id - Update a list
router.put('/:id', requireUser, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, is_public } = req.body;

  try {
    const listResult = await query(
      'SELECT * FROM lists WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const existing = listResult.rows[0];

    const newTitle = typeof title === 'string' ? title.trim() : existing.title;
    const newDescription = description !== undefined ? description : existing.description;
    const newIsPublic = is_public !== undefined ? Boolean(is_public) : existing.is_public;

    // Regenerate slug if title changes and list is public
    let newSlug = existing.slug;
    const titleChanged = newTitle !== existing.title;
    if (titleChanged && newIsPublic) {
      newSlug = generateSlug(newTitle);
    } else if (!existing.is_public && newIsPublic) {
      // Becoming public for the first time
      newSlug = generateSlug(newTitle);
    } else if (!newIsPublic) {
      newSlug = null;
    }

    const result = await query(
      `UPDATE lists
       SET title = $1, description = $2, is_public = $3, slug = $4, updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [newTitle, newDescription, newIsPublic, newSlug, id, req.userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating list:', err);
    res.status(500).json({ error: 'Failed to update list' });
  }
});

// DELETE /api/lists/:id - Delete a list
router.delete('/:id', requireUser, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await query(
      'DELETE FROM lists WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    res.json({ message: 'List deleted successfully' });
  } catch (err) {
    console.error('Error deleting list:', err);
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

export default router;
