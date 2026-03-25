import axios from 'axios';
import { Router, Request, Response } from 'express';
import { query } from '../db';
import { requireUser } from '../middleware/auth';
import { getAlbumInfo } from '../services/lastfm';
import { getClientAccessToken, searchAlbums } from '../services/spotify';

const router = Router();

export interface ChartAlbumResult {
  spotify_album_id: null;
  artist_name: string;
  album_name: string;
  lastfm_url: string;
  images: Array<{ url: string; width: number; height: number }>;
  lastfm_listeners: number;
  lastfm_playcount: number;
  lastfm_rank: number;
}

const LASTFM_BASE_URL = 'http://ws.audioscrobbler.com/2.0/';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface LastFmTagAlbum {
  name: string;
  url: string;
  mbid?: string;
  artist: { name: string; url: string; mbid?: string };
  image: Array<{ '#text': string; size: string }>;
  '@attr': { rank: string };
}

async function fetchLastFmTagPage(
  tag: string,
  page: number,
  perPage: number
): Promise<{ albums: LastFmTagAlbum[]; totalPages: number }> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return { albums: [], totalPages: 0 };

  try {
    const response = await axios.get<{
      albums?: {
        album?: LastFmTagAlbum[];
        '@attr'?: { totalPages: string; total: string };
      };
      error?: number;
    }>(LASTFM_BASE_URL, {
      params: {
        method: 'tag.gettopalbums',
        tag,
        api_key: apiKey,
        format: 'json',
        page,
        limit: perPage,
      },
    });

    if (response.data.error || !response.data.albums?.album) {
      return { albums: [], totalPages: 0 };
    }

    const totalPages = parseInt(response.data.albums['@attr']?.totalPages ?? '1', 10);
    return { albums: response.data.albums.album, totalPages };
  } catch {
    return { albums: [], totalPages: 0 };
  }
}

// GET /api/charts?tag=<tag>&limit=<N>&page=<P>
router.get('/', requireUser, async (req: Request, res: Response) => {
  const { tag, limit: limitStr, page: pageStr } = req.query;

  if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
    return res.status(400).json({ error: 'tag is required' });
  }

  const limit = Math.min(100, Math.max(1, parseInt(String(limitStr ?? '50'), 10) || 50));
  const page = Math.max(1, parseInt(String(pageStr ?? '1'), 10) || 1);

  try {
    const { albums: lfmAlbums, totalPages } = await fetchLastFmTagPage(tag.trim(), page, limit);

    if (lfmAlbums.length === 0) {
      return res.json({ results: [], totalPages: 0, page, limit });
    }

    // Enrich with listeners/playcount from album.getinfo in batches of 5
    const BATCH = 5;
    const results: ChartAlbumResult[] = [];

    for (let i = 0; i < lfmAlbums.length; i += BATCH) {
      const batch = lfmAlbums.slice(i, i + BATCH);

      const batchResults = await Promise.all(
        batch.map(async (lfm) => {
          const lfmInfo = await getAlbumInfo(lfm.artist.name, lfm.name);

          // Pick the best available cover from Last.fm CDN
          const images = lfm.image ?? [];
          const coverUrl =
            images.find((img) => img.size === 'extralarge' && img['#text'])?.['#text'] ??
            images.find((img) => img.size === 'large' && img['#text'])?.['#text'] ??
            images.find((img) => img['#text'])?.['#text'] ??
            null;

          return {
            spotify_album_id: null,
            artist_name: lfm.artist.name,
            album_name: lfm.name,
            lastfm_url: lfm.url,
            images: coverUrl ? [{ url: coverUrl, width: 300, height: 300 }] : [],
            lastfm_listeners: lfmInfo?.listeners ?? 0,
            lastfm_playcount: lfmInfo?.playcount ?? 0,
            lastfm_rank: parseInt(lfm['@attr'].rank, 10),
          } satisfies ChartAlbumResult;
        })
      );

      results.push(...batchResults);
      if (i + BATCH < lfmAlbums.length) await delay(150);
    }

    res.json({ results, totalPages, page, limit });
  } catch (err) {
    console.error('Charts error:', err);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// POST /api/charts/add-lastfm - Add a Last.fm chart album directly to a list using a synthetic ID
router.post('/add-lastfm', requireUser, async (req: Request, res: Response) => {
  const { list_id, artist_name, album_name, lastfm_url, image_url, lastfm_listeners, lastfm_playcount } = req.body;

  if (!list_id || !artist_name || !album_name) {
    return res.status(400).json({ error: 'list_id, artist_name and album_name are required' });
  }

  // Synthetic primary key: "lastfm:" + slugified artist + ":" + slugified album
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const syntheticId = `lastfm:${slug(artist_name)}:${slug(album_name)}`;

  try {
    // Verify the list belongs to this user
    const listResult = await query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [list_id, req.userId]
    );
    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    // If Last.fm metadata wasn't supplied (e.g. from a file import), fetch it now
    let resolvedListeners: number | null = lastfm_listeners ?? null;
    let resolvedPlaycount: number | null = lastfm_playcount ?? null;
    let resolvedUrl: string | null = lastfm_url ?? null;
    let resolvedImageUrl: string | null = image_url ?? null;

    const needsLfm = !resolvedListeners && !resolvedPlaycount;
    if (needsLfm) {
      try {
        const lfmInfo = await getAlbumInfo(artist_name, album_name);
        if (lfmInfo) {
          resolvedListeners = lfmInfo.listeners;
          resolvedPlaycount = lfmInfo.playcount;
          // Build a Last.fm URL from the first tag's url domain if we don't have one
          if (!resolvedUrl) {
            resolvedUrl = `https://www.last.fm/music/${encodeURIComponent(artist_name)}/${encodeURIComponent(album_name)}`;
          }
        }
      } catch {
        // Non-fatal: store without Last.fm data if fetch fails
      }
    }

    // Upsert into albums_cache with Last.fm data
    await query(
      `INSERT INTO albums_cache (
        spotify_album_id, artist_name, album_name,
        image_url, images,
        lastfm_listeners, lastfm_playcount,
        external_urls, genres, lastfm_tags, top_tracks
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'[]','[]','[]')
      ON CONFLICT (spotify_album_id) DO UPDATE SET
        lastfm_listeners = EXCLUDED.lastfm_listeners,
        lastfm_playcount = EXCLUDED.lastfm_playcount,
        last_fetched = NOW()`,
      [
        syntheticId,
        artist_name,
        album_name,
        resolvedImageUrl,
        resolvedImageUrl ? JSON.stringify([{ url: resolvedImageUrl, width: 300, height: 300 }]) : JSON.stringify([]),
        resolvedListeners,
        resolvedPlaycount,
        JSON.stringify({ lastfm: resolvedUrl }),
      ]
    );

    // Get next position
    const posResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM list_albums WHERE list_id = $1',
      [list_id]
    );
    const position = posResult.rows[0].next_pos;

    // Add to list
    const insertResult = await query(
      `INSERT INTO list_albums (list_id, spotify_album_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (list_id, spotify_album_id) DO NOTHING
       RETURNING id`,
      [list_id, syntheticId, position]
    );

    if (insertResult.rows.length === 0) {
      return res.status(409).json({ error: 'Album already in this list' });
    }

    res.status(201).json({ spotify_album_id: syntheticId, list_id, position });
  } catch (err) {
    console.error('Chart add-lastfm error:', err);
    res.status(500).json({ error: 'Failed to add album to list' });
  }
});

// Track when we last hit a 429 so we can gate subsequent resolve calls
let spotifyRateLimitUntil = 0;

// POST /api/charts/resolve - Find a Spotify album ID for a Last.fm artist+album name
router.post('/resolve', requireUser, async (req: Request, res: Response) => {
  const { artist, album } = req.body;

  if (!artist || !album || typeof artist !== 'string' || typeof album !== 'string') {
    return res.status(400).json({ error: 'artist and album are required' });
  }

  // Fast-fail if we're still in a known rate-limit cooldown window
  const now = Date.now();
  if (now < spotifyRateLimitUntil) {
    const waitSec = Math.ceil((spotifyRateLimitUntil - now) / 1000);
    return res.status(429).json({
      error: `Spotify is rate-limiting requests. Please wait ~${waitSec}s and try again.`,
    });
  }

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

  // Retry up to 4 times on 429, honouring Spotify's Retry-After header
  const MAX_RETRIES = 4;
  let lastErr: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const token = await getClientAccessToken();
      const results = await searchAlbums(`artist:${artist.trim()} album:${album.trim()}`, token);

      if (!results || results.length === 0) {
        return res.status(404).json({ error: 'Album not found on Spotify' });
      }

      const na = normalize(artist);
      const nb = normalize(album);

      const best =
        results.find(
          (sp) =>
            normalize(sp.artists[0]?.name ?? '') === na &&
            normalize(sp.name) === nb
        ) ??
        results.find((sp) => normalize(sp.name) === nb) ??
        results[0];

      return res.json({
        spotify_album_id: best.id,
        album_name: best.name,
        artist_name: best.artists[0]?.name ?? artist,
        release_date: best.release_date,
        images: best.images,
        external_urls: best.external_urls,
      });
    } catch (err) {
      lastErr = err;
      const axiosErr = err as { response?: { status?: number; headers?: Record<string, string> } };
      if (axiosErr.response?.status !== 429) break; // only retry on rate limit

      if (attempt < MAX_RETRIES - 1) {
        // Retry-After can be a relative seconds value OR a Unix timestamp.
        // If the value is > 3600 (1 hour), treat it as a Unix timestamp and
        // compute the relative wait. Cap at 30s to avoid absurd delays.
        const retryAfterRaw = parseInt(axiosErr.response?.headers?.['retry-after'] ?? '', 10);
        let retryAfterMs = 2000 * Math.pow(2, attempt); // default: 2s, 4s, 8s
        if (Number.isFinite(retryAfterRaw) && retryAfterRaw > 0) {
          const relSec = retryAfterRaw > 3600
            ? retryAfterRaw - Math.floor(Date.now() / 1000) // Unix ts → relative
            : retryAfterRaw;                                 // already relative seconds
          retryAfterMs = Math.min(30_000, Math.max(1000, relSec * 1000)) + 200;
        }
        const waitMs = retryAfterMs;
        // Record the cooldown window so concurrent/subsequent requests fast-fail
        spotifyRateLimitUntil = Date.now() + waitMs;
        console.warn(`Chart resolve: 429 on attempt ${attempt + 1}, waiting ${waitMs}ms`);
        await delay(waitMs);
        spotifyRateLimitUntil = 0; // cleared after we've waited
      }
    }
  }

  const status = (lastErr as { response?: { status?: number } })?.response?.status;
  if (status === 429) {
    // Keep a 30s cooldown after exhausting retries
    spotifyRateLimitUntil = Date.now() + 30_000;
    console.warn('Chart resolve: Spotify rate limit hit after retries');
    return res.status(429).json({ error: 'Spotify is rate-limiting requests. Please wait ~30s and try again.' });
  }

  console.error('Chart resolve error:', lastErr);
  res.status(500).json({ error: 'Failed to resolve album on Spotify' });
});

export default router;
