import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db';
import {
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  getUserProfile,
} from '../services/spotify';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /api/auth/spotify - Redirect to Spotify auth
router.get('/spotify', (req: Request, res: Response) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    const authUrl = getAuthUrl(state);
    res.redirect(authUrl);
  } catch (err) {
    console.error('Error generating Spotify auth URL:', err);
    res.status(500).json({ error: 'Failed to initiate Spotify authentication' });
  }
});

// GET /api/auth/spotify/callback - Handle Spotify callback
router.get('/spotify/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error) {
    console.error('Spotify auth error:', error);
    return res.redirect(`${frontendUrl}/?error=spotify_auth_denied`);
  }

  if (!state || state !== req.session.oauthState) {
    return res.redirect(`${frontendUrl}/?error=invalid_state`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`${frontendUrl}/?error=missing_code`);
  }

  try {
    // Clear the oauth state from session
    delete req.session.oauthState;

    // Exchange authorization code for tokens
    const tokens = await exchangeCode(code);

    const expiresAt = Date.now() + tokens.expires_in * 1000;

    // Fetch user profile from Spotify
    const spotifyUser = await getUserProfile(tokens.access_token);

    // Upsert user in the database
    const result = await query(
      `INSERT INTO users (spotify_id, username, display_name, profile_image, email, spotify_access_token, spotify_refresh_token, spotify_token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (spotify_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         profile_image = EXCLUDED.profile_image,
         email = EXCLUDED.email,
         spotify_access_token = EXCLUDED.spotify_access_token,
         spotify_refresh_token = COALESCE(EXCLUDED.spotify_refresh_token, users.spotify_refresh_token),
         spotify_token_expires_at = EXCLUDED.spotify_token_expires_at,
         updated_at = NOW()
       RETURNING *`,
      [
        spotifyUser.id,
        spotifyUser.id, // username defaults to spotify_id
        spotifyUser.display_name,
        spotifyUser.images?.[0]?.url ?? null,
        spotifyUser.email,
        tokens.access_token,
        tokens.refresh_token ?? null,
        new Date(expiresAt).toISOString(),
      ]
    );

    const user = result.rows[0];

    // Set session data
    req.session.userId = user.id;
    req.session.spotifyAccessToken = tokens.access_token;
    req.session.spotifyRefreshToken = tokens.refresh_token ?? user.spotify_refresh_token;
    req.session.spotifyTokenExpiresAt = expiresAt;

    res.redirect(`${frontendUrl}/dashboard`);
  } catch (err) {
    console.error('Error during Spotify callback:', err);
    res.redirect(`${frontendUrl}/?error=auth_failed`);
  }
});

// GET /api/auth/me - Get current user
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, spotify_id, username, display_name, profile_image, email, created_at FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching current user:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/logout - Destroy session
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

export default router;
