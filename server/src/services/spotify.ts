import axios from 'axios';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH_BASE = 'https://accounts.spotify.com';

export interface SpotifyTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string }>;
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

export function getAuthUrl(state: string): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_REDIRECT_URI env vars');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'user-read-email user-read-private',
    redirect_uri: redirectUri,
    state,
  });

  return `${SPOTIFY_AUTH_BASE}/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<SpotifyTokens> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Spotify credentials in environment variables');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await axios.post<SpotifyTokens>(
    `${SPOTIFY_AUTH_BASE}/api/token`,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokens> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials in environment variables');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await axios.post<SpotifyTokens>(
    `${SPOTIFY_AUTH_BASE}/api/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}

export async function getUserProfile(accessToken: string): Promise<SpotifyUser> {
  const response = await axios.get<SpotifyUser>(`${SPOTIFY_API_BASE}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

export async function searchAlbums(
  searchQuery: string,
  accessToken: string
): Promise<SpotifyAlbum[]> {
  const response = await axios.get<{
    albums: { items: SpotifyAlbum[] };
  }>(`${SPOTIFY_API_BASE}/search`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    params: {
      q: searchQuery,
      type: 'album',
      limit: 20,
    },
  });

  return response.data.albums.items;
}

export async function getAlbum(albumId: string, accessToken: string): Promise<SpotifyAlbum> {
  const response = await axios.get<SpotifyAlbum>(`${SPOTIFY_API_BASE}/albums/${albumId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}
