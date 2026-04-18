import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { query } from '../db';

/** Cookie session only (e.g. minting API tokens). */
export function requireSession(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = userId;
  next();
}

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/** Session cookie or `Authorization: Bearer <api_token>`. */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = req.session?.userId;
  if (sessionUserId) {
    req.userId = sessionUserId;
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = auth.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  void (async () => {
    try {
      const lookupHash = sha256Hex(token);
      const result = await query<{ id: string; user_id: string; token_hash: string }>(
        `SELECT id, user_id, token_hash FROM api_tokens WHERE lookup_hash = $1`,
        [lookupHash]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const row = result.rows[0];
      const ok = await bcrypt.compare(token, row.token_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await query(`UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1`, [row.id]);
      req.userId = row.user_id;
      next();
    } catch (err) {
      next(err);
    }
  })();
}
