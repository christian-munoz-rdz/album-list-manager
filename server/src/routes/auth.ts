import { Router, Request, Response } from 'express';
import { query } from '../db';
import { getDemoUserId } from '../demoUser';

const router = Router();

// GET /api/auth/me — current app user (single local user, no login)
router.get('/me', async (_req: Request, res: Response) => {
  try {
    const userId = await getDemoUserId();
    const result = await query(
      'SELECT id, spotify_id, username, display_name, profile_image, email, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
