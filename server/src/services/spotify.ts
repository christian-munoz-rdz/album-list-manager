import axios from 'axios';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH_BASE = 'https://accounts.spotify.com';

export interface SpotifyTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  release_date: string;
  images: Array<{ url: string; width: number; height: number }>;
  total_tracks: number;
  popularity?: number;
  genres?: string[];
  tracks?: {
    items: Array<{
      id: string;
      name: string;
      duration_ms: number;
      preview_url: string | null;
    }>;
  };
  external_urls: { spotify: string };
}

let clientCredsCache: { token: string; expiresAt: number } | null = null;

/** Server-only token (no user login). Used for search + album metadata. */
export async function getClientAccessToken(): Promise<string> {
  const now = Date.now();
  if (clientCredsCache && now < clientCredsCache.expiresAt - 60_000) {
    return clientCredsCache.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await axios.post<SpotifyTokens>(
    `${SPOTIFY_AUTH_BASE}/api/token`,
    new URLSearchParams({ grant_type: 'client_credentials' }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const { access_token, expires_in } = response.data;
  clientCredsCache = {
    token: access_token,
    expiresAt: now + expires_in * 1000,
  };
  return access_token;
}

export async function searchAlbums(
  searchQuery: string,
  accessToken: string
): Promise<SpotifyAlbum[]> {
  const market = process.env.SPOTIFY_MARKET || 'US';
  const configuredLimit = Number(process.env.SPOTIFY_SEARCH_LIMIT ?? 10);
  const limit = Number.isFinite(configuredLimit)
    ? Math.min(50, Math.max(1, Math.trunc(configuredLimit)))
    : 10;
  const response = await axios.get<{
    albums: { items: SpotifyAlbum[] };
  }>(`${SPOTIFY_API_BASE}/search`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: {
      q: searchQuery,
      type: 'album',
      limit,
      market,
    },
  });

  return response.data.albums.items;
}

export async function getAlbum(albumId: string, accessToken: string): Promise<SpotifyAlbum> {
  const market = process.env.SPOTIFY_MARKET || 'US';
  const response = await axios.get<SpotifyAlbum>(`${SPOTIFY_API_BASE}/albums/${albumId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: { market },
  });

  return response.data;
}
