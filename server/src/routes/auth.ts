import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../db';
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  getCurrentUserProfile,
  isSpotifyConfigured,
} from '../services/spotify';

const router = Router();

const BCRYPT_ROUNDS = 12;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 200;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

interface UserRow {
  id: string;
  spotify_id: string | null;
  username: string;
  display_name: string | null;
  profile_image: string | null;
  email: string | null;
  created_at: string;
}

const SAFE_USER_COLUMNS =
  'id, spotify_id, username, display_name, profile_image, email, created_at';

function sanitize(row: UserRow) {
  return row;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  );
}

async function setSession(req: Request, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { username, password, email, display_name } = req.body ?? {};

  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return res.status(400).json({
      error: 'Username must be 3–32 chars (letters, numbers, _ . -)',
    });
  }
  if (
    typeof password !== 'string' ||
    password.length < MIN_PASSWORD_LEN ||
    password.length > MAX_PASSWORD_LEN
  ) {
    return res.status(400).json({
      error: `Password must be ${MIN_PASSWORD_LEN}–${MAX_PASSWORD_LEN} characters`,
    });
  }
  if (email !== undefined && email !== null && email !== '') {
    if (typeof email !== 'string' || email.length > 254 || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email' });
    }
  }
  if (display_name !== undefined && display_name !== null && display_name !== '') {
    if (typeof display_name !== 'string' || display_name.length > 255) {
      return res.status(400).json({ error: 'Invalid display name' });
    }
  }

  try {
    const normalizedEmail = email ? String(email).trim() : null;
    const normalizedDisplayName = display_name ? String(display_name).trim() : username;

    const existing = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE LOWER(username) = LOWER($1)
          OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
       LIMIT 1`,
      [username, normalizedEmail]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const inserted = await query<UserRow>(
      `INSERT INTO users (username, display_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SAFE_USER_COLUMNS}`,
      [username, normalizedDisplayName, normalizedEmail, passwordHash]
    );

    const user = inserted.rows[0];
    await setSession(req, user.id);
    res.status(201).json(sanitize(user));
  } catch (err) {
    // Race: another concurrent request inserted the same username/email
    // between the existence check and our insert.
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: 'Username or email already in use' });
    }
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { identifier, password } = req.body ?? {};

  if (typeof identifier !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  try {
    const result = await query<UserRow & { password_hash: string | null }>(
      `SELECT ${SAFE_USER_COLUMNS}, password_hash
       FROM users
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
       LIMIT 1`,
      [identifier]
    );

    const row = result.rows[0];
    // Always run compare to avoid timing leaks about whether the user exists
    const hash = row?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduu';
    const ok = await bcrypt.compare(password, hash);

    if (!row || !row.password_hash || !ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await setSession(req, row.id);
    const { password_hash: _omit, ...safe } = row;
    void _omit;
    res.json(sanitize(safe as UserRow));
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  if (!req.session) {
    res.clearCookie('connect.sid');
    return res.json({ ok: true });
  }
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const result = await query<UserRow>(
      `SELECT ${SAFE_USER_COLUMNS} FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      req.session.destroy(() => {
        res.status(401).json({ error: 'Unauthorized' });
      });
      return;
    }
    res.json(sanitize(result.rows[0]));
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET /api/auth/spotify — initiate OAuth
router.get('/spotify', (req: Request, res: Response) => {
  if (!isSpotifyConfigured()) {
    return res
      .status(503)
      .json({ error: 'Spotify login is not configured on this server' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  req.session.spotifyOAuthState = state;
  req.session.save((err) => {
    if (err) {
      console.error('Error saving oauth state:', err);
      return res.status(500).json({ error: 'Failed to start login' });
    }
    res.redirect(buildAuthorizeUrl(state));
  });
});

// GET /api/auth/spotify/callback
router.get('/spotify/callback', async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const expected = req.session?.spotifyOAuthState;

  const fail = (msg: string) =>
    res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(msg)}`);

  if (!isSpotifyConfigured()) return fail('Spotify not configured');
  if (!code || !state || !expected || state !== expected) {
    return fail('Invalid OAuth state');
  }

  // State is single-use
  delete req.session.spotifyOAuthState;

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await getCurrentUserProfile(tokens.access_token);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const profileImage = profile.images?.[0]?.url ?? null;

    // Link or create: match on spotify_id first, then email (if present)
    const bySpotify = await query<UserRow>(
      `SELECT ${SAFE_USER_COLUMNS} FROM users WHERE spotify_id = $1 LIMIT 1`,
      [profile.id]
    );

    let userId: string;
    if (bySpotify.rows.length > 0) {
      userId = bySpotify.rows[0].id;
      await query(
        `UPDATE users
         SET spotify_access_token = $1,
             spotify_refresh_token = COALESCE($2, spotify_refresh_token),
             spotify_token_expires_at = $3,
             display_name = COALESCE(display_name, $4),
             profile_image = COALESCE($5, profile_image),
             email = COALESCE(email, $6),
             updated_at = NOW()
         WHERE id = $7`,
        [
          tokens.access_token,
          tokens.refresh_token ?? null,
          expiresAt,
          profile.display_name,
          profileImage,
          profile.email,
          userId,
        ]
      );
    } else if (profile.email) {
      const byEmail = await query<UserRow>(
        `SELECT ${SAFE_USER_COLUMNS} FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [profile.email]
      );
      if (byEmail.rows.length > 0) {
        userId = byEmail.rows[0].id;
        await query(
          `UPDATE users
           SET spotify_id = $1,
               spotify_access_token = $2,
               spotify_refresh_token = COALESCE($3, spotify_refresh_token),
               spotify_token_expires_at = $4,
               profile_image = COALESCE($5, profile_image),
               updated_at = NOW()
           WHERE id = $6`,
          [
            profile.id,
            tokens.access_token,
            tokens.refresh_token ?? null,
            expiresAt,
            profileImage,
            userId,
          ]
        );
      } else {
        userId = await createSpotifyUser(profile, tokens, expiresAt, profileImage);
      }
    } else {
      userId = await createSpotifyUser(profile, tokens, expiresAt, profileImage);
    }

    await setSession(req, userId);
    res.redirect(`${FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error('Spotify OAuth error:', err);
    fail('Spotify login failed');
  }
});

async function createSpotifyUser(
  profile: { id: string; display_name: string | null; email: string | null },
  tokens: { access_token: string; refresh_token?: string },
  expiresAt: Date,
  profileImage: string | null
): Promise<string> {
  // Derive a username from the Spotify profile. The DB has a partial unique
  // index on LOWER(username); it is the source of truth for collisions.
  // We retry the INSERT on 23505 with a fresh suffix rather than trusting a
  // prior SELECT (which races with concurrent inserts).
  const base =
    (profile.display_name || profile.id)
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '')
      .slice(0, 24) || 'user';

  const MAX_ATTEMPTS = 8;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const username =
      attempt === 0 ? base : `${base}-${crypto.randomBytes(3).toString('hex')}`;
    try {
      const inserted = await query<{ id: string }>(
        `INSERT INTO users
           (spotify_id, username, display_name, profile_image, email,
            spotify_access_token, spotify_refresh_token, spotify_token_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          profile.id,
          username,
          profile.display_name ?? username,
          profileImage,
          profile.email,
          tokens.access_token,
          tokens.refresh_token ?? null,
          expiresAt,
        ]
      );
      return inserted.rows[0].id;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // If another concurrent Spotify login already created this spotify_id,
      // fall back to reading that row instead of retrying forever.
      const existingBySpotify = await query<{ id: string }>(
        `SELECT id FROM users WHERE spotify_id = $1 LIMIT 1`,
        [profile.id]
      );
      if (existingBySpotify.rows.length > 0) {
        return existingBySpotify.rows[0].id;
      }
      // Otherwise it was a username/email collision — retry with a new suffix.
    }
  }
  throw new Error('Could not allocate unique username for Spotify user');
}

export default router;
