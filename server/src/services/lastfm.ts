import axios from 'axios';
import crypto from 'crypto';

const LASTFM_BASE_URL = 'http://ws.audioscrobbler.com/2.0/';

/** Strip non-ASCII suffixes (e.g. RYM native titles after Latin names). */
export function stripNonAscii(s: string): string {
  return s.replace(/[^\x00-\x7F]+/g, '').trim();
}

/**
 * Normalize RYM/CSV artist strings for Last.fm (e.g. "Elucid &, Sebb" → "Elucid & Sebb").
 */
export function normalizeLastFmArtist(s: string): string {
  let t = stripNonAscii(s);
  t = t.replace(/&\s*,\s*/gi, '& ');
  t = t.replace(/,\s*&/g, ' &');
  t = t.replace(/\s+/g, ' ').trim();
  if (!t.includes('&') && t.includes(',')) {
    t = t
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .join(' & ');
  }
  return t.trim();
}

export function normalizeLastFmAlbumTitle(s: string): string {
  let t = stripNonAscii(s);
  t = t.replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return t;
}

export function makeAlbumId(artist: string, album: string): string {
  const normArtist = normalizeLastFmArtist(artist).toLowerCase();
  const normAlbum = normalizeLastFmAlbumTitle(album).toLowerCase();
  const digest = crypto.createHash('md5').update(`${normArtist}|${normAlbum}`).digest('hex');
  return `lfm:${digest}`;
}

export interface TagTopAlbum {
  artist: string;
  album: string;
  listeners: number;
  playcount: number;
  mbid?: string;
}

interface LastFmTagAlbumItem {
  name: string;
  artist: { name: string };
  mbid?: string;
  playcount?: string | number;
  listeners?: string | number;
}

interface LastFmTagTopAlbumsResponse {
  albums?: {
    album?: LastFmTagAlbumItem[];
    '@attr'?: { page: string; perPage: string; total: string; totalPages: string };
  };
  error?: number;
  message?: string;
}

export async function getTagTopAlbums(
  tag: string,
  page = 1,
  perPage = 50
): Promise<TagTopAlbum[]> {
  const apiKey = process.env.LASTFM_API_KEY;

  if (!apiKey) {
    console.warn('LASTFM_API_KEY not set, skipping Last.fm tag chart');
    return [];
  }

  try {
    const response = await axios.get<LastFmTagTopAlbumsResponse>(LASTFM_BASE_URL, {
      params: {
        method: 'tag.gettopalbums',
        tag,
        api_key: apiKey,
        format: 'json',
        page,
        limit: perPage,
      },
    });

    const data = response.data;

    if (data.error || !data.albums?.album) {
      return [];
    }

    return data.albums.album.map((item) => ({
      artist: item.artist.name,
      album: item.name,
      mbid: item.mbid || undefined,
      listeners: parseInt(String(item.listeners ?? '0'), 10) || 0,
      playcount: parseInt(String(item.playcount ?? '0'), 10) || 0,
    }));
  } catch (err) {
    console.error('Last.fm tag.gettopalbums error:', err);
    return [];
  }
}

export interface LastFmTag {
  name: string;
  url: string;
}

export interface LastFmAlbumTrackRow {
  name: string;
  durationSec: number | null;
  url: string | null;
  rank: number | null;
}

export interface LastFmAlbum {
  tags: LastFmTag[];
  listeners: number;
  playcount: number;
  imageUrl: string | null;
  url: string | null;
  /** Short HTML blurb (links to Last.fm wiki). */
  wikiSummary: string | null;
  /** Full HTML article when present. */
  wikiContent: string | null;
  /** Tracklisting as on Last.fm. */
  tracks: LastFmAlbumTrackRow[];
}

/** Last.fm often returns a single object instead of a one-element array. */
function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

interface LastFmApiTrack {
  name?: string;
  url?: string;
  duration?: string;
  length?: string;
  '@attr'?: { rank?: string };
}

interface LastFmApiAlbum {
  tags?: {
    tag?: Array<{ name: string; url: string }> | { name: string; url: string };
  };
  listeners?: string;
  playcount?: string;
  image?: Array<{ '#text': string; size: string }> | { '#text': string; size: string };
  url?: string;
  wiki?: {
    summary?: string;
    content?: string;
    published?: string;
  };
  tracks?: {
    track?: LastFmApiTrack | LastFmApiTrack[];
  };
}

interface LastFmApiResponse {
  album?: LastFmApiAlbum;
  error?: number;
  message?: string;
}

function parseLastFmAlbumPayload(data: LastFmApiResponse): LastFmAlbum | null {
  if (data.error || !data.album) {
    return null;
  }

  const albumData = data.album;

  const tags: LastFmTag[] = asArray(albumData.tags?.tag).map((tag) => ({
    name: tag.name,
    url: tag.url,
  }));

  const images = asArray(albumData.image);
  const preferredSizes = ['extralarge', 'large', 'medium', 'small'];
  let imageUrl: string | null = null;
  for (const size of preferredSizes) {
    const found = images.find((img) => img.size === size && img['#text']);
    if (found) {
      imageUrl = found['#text'];
      break;
    }
  }

  const wiki = albumData.wiki;
  const summaryRaw = wiki?.summary?.trim() ?? '';
  const contentRaw = wiki?.content?.trim() ?? '';
  const wikiSummary = summaryRaw.length > 0 ? summaryRaw : null;
  const wikiContent = contentRaw.length > 0 ? contentRaw : null;

  const trackRows: LastFmAlbumTrackRow[] = asArray(albumData.tracks?.track)
    .map((t, index) => {
      const durRaw = t.duration ?? t.length;
      const sec =
        durRaw != null && String(durRaw).trim() !== ''
          ? parseInt(String(durRaw), 10)
          : NaN;
      const rankRaw = t['@attr']?.rank;
      const rank =
        rankRaw != null && String(rankRaw).trim() !== ''
          ? parseInt(String(rankRaw), 10)
          : index + 1;
      return {
        name: (t.name ?? '').trim(),
        durationSec: Number.isFinite(sec) ? sec : null,
        url: t.url?.trim() ? t.url : null,
        rank: Number.isFinite(rank) ? rank : index + 1,
      };
    })
    .filter((t) => t.name.length > 0);

  return {
    tags,
    listeners: parseInt(albumData.listeners ?? '0', 10) || 0,
    playcount: parseInt(albumData.playcount ?? '0', 10) || 0,
    imageUrl,
    url: albumData.url ?? null,
    wikiSummary,
    wikiContent,
    tracks: trackRows,
  };
}

/** Single Last.fm lookup; no console noise on 404 / album not found. */
export async function getAlbumInfo(artist: string, album: string): Promise<LastFmAlbum | null> {
  const apiKey = process.env.LASTFM_API_KEY;

  if (!apiKey) {
    console.warn('LASTFM_API_KEY not set, skipping Last.fm enrichment');
    return null;
  }

  const a = artist.trim();
  const b = album.trim();
  if (!a || !b) return null;

  try {
    const response = await axios.get<LastFmApiResponse>(LASTFM_BASE_URL, {
      params: {
        method: 'album.getinfo',
        api_key: apiKey,
        artist: a,
        album: b,
        format: 'json',
        autocorrect: 1,
      },
    });

    return parseLastFmAlbumPayload(response.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 404) return null;
      const body = err.response?.data as { error?: number } | undefined;
      if (body?.error === 6) return null;
    }
    console.error('Last.fm API error:', err);
    return null;
  }
}

function beforeFeatSegment(artist: string): string {
  const m = artist.split(/\b(feat\.?|ft\.?|featuring)\b/i)[0];
  return m.trim();
}

/**
 * Try several artist/album variants (RYM export quirks, feat., edition suffixes).
 */
export async function getAlbumInfoBestEffort(
  rawArtist: string,
  rawAlbum: string
): Promise<LastFmAlbum | null> {
  const artistNorm = normalizeLastFmArtist(rawArtist);
  const albumStripped = normalizeLastFmAlbumTitle(rawAlbum);
  const albumFull = stripNonAscii(rawAlbum).replace(/\s+/g, ' ').trim();

  const pairs: Array<[string, string]> = [];
  const add = (ar: string, al: string) => {
    const x = ar.trim();
    const y = al.trim();
    if (x && y) pairs.push([x, y]);
  };

  add(artistNorm, albumStripped);
  if (albumFull !== albumStripped) add(artistNorm, albumFull);

  const featStripped = beforeFeatSegment(artistNorm);
  if (featStripped !== artistNorm) {
    add(featStripped, albumStripped);
    if (albumFull !== albumStripped) add(featStripped, albumFull);
  }

  const seen = new Set<string>();
  for (const [ar, al] of pairs) {
    const key = `${ar}\0${al}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = await getAlbumInfo(ar, al);
    if (r) return r;
  }

  return null;
}

// ---- Search ---------------------------------------------------------------

const PREFERRED_IMAGE_SIZES = ['extralarge', 'large', 'medium', 'small'] as const;

/** Pick the largest non-empty URL from a Last.fm `image[]`. */
function pickImage(
  images: Array<{ '#text': string; size: string }> | { '#text': string; size: string } | undefined
): string | null {
  const arr = asArray(images);
  for (const size of PREFERRED_IMAGE_SIZES) {
    const found = arr.find((img) => img.size === size && img['#text']);
    if (found) return found['#text'];
  }
  const anyImg = arr.find((img) => img['#text']);
  return anyImg?.['#text'] ?? null;
}

export interface LastFmAlbumSearchResult {
  artist: string;
  album: string;
  url: string;
  imageUrl: string | null;
  mbid?: string;
}

interface LastFmAlbumSearchItem {
  name: string;
  artist: string;
  url: string;
  image?: Array<{ '#text': string; size: string }>;
  mbid?: string;
}

interface LastFmAlbumSearchResponse {
  results?: {
    albummatches?: { album?: LastFmAlbumSearchItem[] | LastFmAlbumSearchItem };
    'opensearch:totalResults'?: string;
  };
  error?: number;
  message?: string;
}

export async function searchAlbums(q: string, limit = 30): Promise<LastFmAlbumSearchResult[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    console.warn('LASTFM_API_KEY not set, skipping album search');
    return [];
  }

  const query = q.trim();
  if (!query) return [];

  try {
    const response = await axios.get<LastFmAlbumSearchResponse>(LASTFM_BASE_URL, {
      params: {
        method: 'album.search',
        album: query,
        api_key: apiKey,
        format: 'json',
        limit,
      },
    });

    const data = response.data;
    if (data.error) return [];

    const items = asArray(data.results?.albummatches?.album).filter(
      (x): x is LastFmAlbumSearchItem => !!x && typeof x.name === 'string'
    );

    return items
      .filter((item) => item.name && item.artist)
      .map((item) => ({
        artist: item.artist,
        album: item.name,
        url: item.url,
        imageUrl: pickImage(item.image),
        mbid: item.mbid || undefined,
      }));
  } catch (err) {
    console.error('Last.fm album.search error:', err);
    return [];
  }
}

export interface LastFmArtistSearchResult {
  name: string;
  url: string;
  imageUrl: string | null;
  listeners: number;
  mbid?: string;
}

interface LastFmArtistSearchItem {
  name: string;
  url: string;
  image?: Array<{ '#text': string; size: string }>;
  listeners?: string | number;
  mbid?: string;
}

interface LastFmArtistSearchResponse {
  results?: {
    artistmatches?: { artist?: LastFmArtistSearchItem[] | LastFmArtistSearchItem };
    'opensearch:totalResults'?: string;
  };
  error?: number;
  message?: string;
}

export async function searchArtists(q: string, limit = 20): Promise<LastFmArtistSearchResult[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    console.warn('LASTFM_API_KEY not set, skipping artist search');
    return [];
  }

  const query = q.trim();
  if (!query) return [];

  try {
    const response = await axios.get<LastFmArtistSearchResponse>(LASTFM_BASE_URL, {
      params: {
        method: 'artist.search',
        artist: query,
        api_key: apiKey,
        format: 'json',
        limit,
      },
    });

    const data = response.data;
    if (data.error) return [];

    const items = asArray(data.results?.artistmatches?.artist).filter(
      (x): x is LastFmArtistSearchItem => !!x && typeof x.name === 'string'
    );

    return items.map((item) => ({
      name: item.name,
      url: item.url,
      imageUrl: pickImage(item.image),
      listeners: parseInt(String(item.listeners ?? '0'), 10) || 0,
      mbid: item.mbid || undefined,
    }));
  } catch (err) {
    console.error('Last.fm artist.search error:', err);
    return [];
  }
}

export interface ArtistTopAlbum {
  artist: string;
  album: string;
  url: string;
  imageUrl: string | null;
  playcount: number;
  mbid?: string;
}

interface LastFmArtistTopAlbumItem {
  name: string;
  url: string;
  playcount?: string | number;
  mbid?: string;
  artist: { name: string; url?: string; mbid?: string };
  image?: Array<{ '#text': string; size: string }>;
}

interface LastFmArtistTopAlbumsResponse {
  topalbums?: {
    album?: LastFmArtistTopAlbumItem[];
    '@attr'?: { totalPages?: string; total?: string; page?: string; perPage?: string; artist?: string };
  };
  error?: number;
  message?: string;
}

export async function getArtistTopAlbums(
  artist: string,
  page = 1,
  perPage = 50
): Promise<{ albums: ArtistTopAlbum[]; totalPages: number }> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    console.warn('LASTFM_API_KEY not set, skipping artist top albums');
    return { albums: [], totalPages: 0 };
  }

  const name = artist.trim();
  if (!name) return { albums: [], totalPages: 0 };

  try {
    const response = await axios.get<LastFmArtistTopAlbumsResponse>(LASTFM_BASE_URL, {
      params: {
        method: 'artist.gettopalbums',
        artist: name,
        api_key: apiKey,
        format: 'json',
        autocorrect: 1,
        page,
        limit: perPage,
      },
    });

    const data = response.data;
    if (data.error || !data.topalbums?.album) return { albums: [], totalPages: 0 };

    const totalPages = parseInt(data.topalbums['@attr']?.totalPages ?? '1', 10) || 1;

    const albums: ArtistTopAlbum[] = data.topalbums.album
      .filter((item) => item.name && item.artist?.name)
      .map((item) => ({
        artist: item.artist.name,
        album: item.name,
        url: item.url,
        imageUrl: pickImage(item.image),
        playcount: parseInt(String(item.playcount ?? '0'), 10) || 0,
        mbid: item.mbid || undefined,
      }));

    return { albums, totalPages };
  } catch (err) {
    console.error('Last.fm artist.gettopalbums error:', err);
    return { albums: [], totalPages: 0 };
  }
}
