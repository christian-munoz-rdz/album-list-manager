import axios from 'axios';
import { Router, Request, Response } from 'express';
import { requireUser } from '../middleware/auth';
import { getAlbumInfo } from '../services/lastfm';

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

export default router;
