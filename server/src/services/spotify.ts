import axios from 'axios';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const ME_URL = 'https://api.spotify.com/v1/me';

const DEFAULT_SCOPES = ['user-read-email', 'user-read-private'];

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export interface SpotifyProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  images: Array<{ url: string; width?: number | null; height?: number | null }>;
}

export function isSpotifyConfigured(): boolean {
  return Boolean(
    process.env.SPOTIFY_CLIENT_ID &&
      process.env.SPOTIFY_CLIENT_SECRET &&
      process.env.SPOTIFY_REDIRECT_URI
  );
}

export function buildAuthorizeUrl(state: string, scopes: string[] = DEFAULT_SCOPES): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID || '',
    scope: scopes.join(' '),
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI || '',
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<SpotifyTokenResponse> {
  const clientId = process.env.SPOTIFY_CLIENT_ID || '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const { data } = await axios.post<SpotifyTokenResponse>(TOKEN_URL, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
  });

  return data;
}

export async function getCurrentUserProfile(accessToken: string): Promise<SpotifyProfile> {
  const { data } = await axios.get<SpotifyProfile>(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}
