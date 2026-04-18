import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { query } from '../db';
import { requireSession } from '../middleware/auth';

const router = Router();
const BCRYPT_ROUNDS = 12;
const TOKEN_BYTES = 32;

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

// POST /api/tokens — create token (session only); returns plaintext `token` once
router.post('/', requireSession, async (req: Request, res: Response) => {
  const label =
    typeof req.body?.label === 'string' && req.body.label.trim().length > 0
      ? req.body.label.trim().slice(0, 255)
      : null;

  try {
    const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const lookupHash = sha256Hex(rawToken);
    const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);

    const result = await query<{ id: string; created_at: string }>(
      `INSERT INTO api_tokens (user_id, lookup_hash, token_hash, label)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [req.userId, lookupHash, tokenHash, label]
    );

    const row = result.rows[0];
    res.status(201).json({
      id: row.id,
      token: rawToken,
      label,
      created_at: row.created_at,
    });
  } catch (err) {
    console.error('Error creating API token:', err);
    res.status(500).json({ error: 'Failed to create token' });
  }
});

// GET /api/tokens — list tokens (metadata only)
router.get('/', requireSession, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, label, created_at, last_used_at
       FROM api_tokens
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error listing API tokens:', err);
    res.status(500).json({ error: 'Failed to list tokens' });
  }
});

// DELETE /api/tokens/:id — revoke
router.delete('/:id', requireSession, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await query(
      `DELETE FROM api_tokens WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting API token:', err);
    res.status(500).json({ error: 'Failed to delete token' });
  }
});

export default router;
