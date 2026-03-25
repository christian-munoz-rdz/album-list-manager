import axios from 'axios';

const LASTFM_BASE_URL = 'http://ws.audioscrobbler.com/2.0/';

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

export interface LastFmAlbum {
  tags: LastFmTag[];
  listeners: number;
  playcount: number;
  imageUrl: string | null;
  url: string | null;
}

interface LastFmApiAlbum {
  tags?: {
    tag?: Array<{ name: string; url: string }>;
  };
  listeners?: string;
  playcount?: string;
  image?: Array<{ '#text': string; size: string }>;
  url?: string;
}

interface LastFmApiResponse {
  album?: LastFmApiAlbum;
  error?: number;
  message?: string;
}

export async function getAlbumInfo(
  artist: string,
  album: string
): Promise<LastFmAlbum | null> {
  const apiKey = process.env.LASTFM_API_KEY;

  if (!apiKey) {
    console.warn('LASTFM_API_KEY not set, skipping Last.fm enrichment');
    return null;
  }

  try {
    const response = await axios.get<LastFmApiResponse>(LASTFM_BASE_URL, {
      params: {
        method: 'album.getinfo',
        api_key: apiKey,
        artist,
        album,
        format: 'json',
        autocorrect: 1,
      },
    });

    const data = response.data;

    if (data.error || !data.album) {
      return null;
    }

    const albumData = data.album;

    const tags: LastFmTag[] = (albumData.tags?.tag ?? []).map((tag) => ({
      name: tag.name,
      url: tag.url,
    }));

    // Pick the largest available image (extralarge > large > medium)
    const images = albumData.image ?? [];
    const preferredSizes = ['extralarge', 'large', 'medium', 'small'];
    let imageUrl: string | null = null;
    for (const size of preferredSizes) {
      const found = images.find((img) => img.size === size && img['#text']);
      if (found) { imageUrl = found['#text']; break; }
    }

    return {
      tags,
      listeners: parseInt(albumData.listeners ?? '0', 10) || 0,
      playcount: parseInt(albumData.playcount ?? '0', 10) || 0,
      imageUrl,
      url: albumData.url ?? null,
    };
  } catch (err) {
    console.error('Last.fm API error:', err);
    return null;
  }
}
