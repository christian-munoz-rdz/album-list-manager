import axios from 'axios';

const LASTFM_BASE_URL = 'http://ws.audioscrobbler.com/2.0/';

export interface LastFmTag {
  name: string;
  url: string;
}

export interface LastFmAlbum {
  tags: LastFmTag[];
  listeners: number;
  playcount: number;
}

interface LastFmApiAlbum {
  tags?: {
    tag?: Array<{ name: string; url: string }>;
  };
  listeners?: string;
  playcount?: string;
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

    return {
      tags,
      listeners: parseInt(albumData.listeners ?? '0', 10) || 0,
      playcount: parseInt(albumData.playcount ?? '0', 10) || 0,
    };
  } catch (err) {
    console.error('Last.fm API error:', err);
    return null;
  }
}
