import { Router, Request, Response } from 'express';
import { requireUser } from '../middleware/auth';
import {
  searchAlbums,
  searchArtists,
  getArtistTopAlbums,
} from '../services/lastfm';
import type { ChartAlbumResult } from './charts';

const router = Router();

export interface ArtistSearchHit {
  name: string;
  url: string;
  image_url: string | null;
  listeners: number;
  mbid?: string;
}

function parseLimit(raw: unknown, fallback: number, max: number): number {
  const n = parseInt(String(raw ?? fallback), 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(1, n));
}

// GET /api/search?q=<query>&type=album|artist&limit=<N>
router.get('/', requireUser, async (req: Request, res: Response) => {
  const { q, type = 'album' } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.status(400).json({ error: 'q must be at least 2 characters' });
  }

  const query = q.trim();

  try {
    if (type === 'album') {
      const limit = parseLimit(req.query.limit, 30, 50);
      const hits = await searchAlbums(query, limit);
      const results: ChartAlbumResult[] = hits.map((h, i) => ({
        album_id: null,
        artist_name: h.artist,
        album_name: h.album,
        lastfm_url: h.url,
        images: h.imageUrl ? [{ url: h.imageUrl, width: 300, height: 300 }] : [],
        lastfm_listeners: 0,
        lastfm_playcount: 0,
        lastfm_rank: i + 1,
      }));
      return res.json({ results, totalPages: 1, page: 1, limit });
    }

    if (type === 'artist') {
      const limit = parseLimit(req.query.limit, 20, 50);
      const hits = await searchArtists(query, limit);
      const artists: ArtistSearchHit[] = hits.map((h) => ({
        name: h.name,
        url: h.url,
        image_url: h.imageUrl,
        listeners: h.listeners,
        mbid: h.mbid,
      }));
      return res.json({ artists });
    }

    return res.status(400).json({ error: 'type must be "album" or "artist"' });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/search/artist/:name/albums?page=<P>
router.get('/artist/:name/albums', requireUser, async (req: Request, res: Response) => {
  const name = decodeURIComponent(req.params.name).trim();
  if (!name) return res.status(400).json({ error: 'artist name is required' });

  const page = parseLimit(req.query.page, 1, 100);
  const limit = 50;

  try {
    const { albums, totalPages } = await getArtistTopAlbums(name, page, limit);

    const results: ChartAlbumResult[] = albums.map((a, i) => ({
      album_id: null,
      artist_name: a.artist,
      album_name: a.album,
      lastfm_url: a.url,
      images: a.imageUrl ? [{ url: a.imageUrl, width: 300, height: 300 }] : [],
      lastfm_listeners: 0,
      lastfm_playcount: a.playcount,
      lastfm_rank: (page - 1) * limit + i + 1,
    }));

    return res.json({ results, totalPages, page, limit });
  } catch (err) {
    console.error('Artist albums error:', err);
    return res.status(500).json({ error: 'Failed to fetch artist albums' });
  }
});

export default router;
