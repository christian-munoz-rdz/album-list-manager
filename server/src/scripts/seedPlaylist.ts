/**
 * Seed a list from a Spotify playlist (unique albums, playlist track order).
 *
 * - Playlist + track listing: use SPOTIFY_USER_ACCESS_TOKEN (or --token=) if the playlist
 *   is private or Spotify returns 403 with client credentials only.
 * - Album metadata: always uses client credentials (catalog).
 *
 * Usage (from server/):
 *   npx ts-node --transpile-only src/scripts/seedPlaylist.ts [playlist_url_or_id] [--token=oauth_token]
 */

import '../env';
import axios from 'axios';
import { query } from '../db';
import { getDemoUserId } from '../demoUser';
import { getClientAccessToken, getAlbum, type SpotifyAlbum } from '../services/spotify';
import { getAlbumInfo } from '../services/lastfm';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const DEFAULT_PLAYLIST = '4JXYPBdxMG11sN9NGQb1xq';

function parseArgs() {
  let playlistInput: string | undefined;
  let userToken: string | undefined;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--token=')) userToken = a.slice('--token='.length).trim();
    else if (!a.startsWith('--')) playlistInput = a;
  }
  return { playlistInput, userToken };
}

function extractPlaylistId(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/playlist\/([a-zA-Z0-9]+)/);
  if (fromUrl) return fromUrl[1];
  return trimmed;
}

interface PlaylistTrackItem {
  track: {
    id: string;
    album?: { id: string };
  } | null;
}

function spotifyErrMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
    const d = err.response.data as { error?: { message?: string } };
    if (d.error?.message) return d.error.message;
  }
  return err instanceof Error ? err.message : String(err);
}

async function upsertAlbumCache(spotifyAlbum: SpotifyAlbum): Promise<void> {
  const artistName = spotifyAlbum.artists.map((a) => a.name).join(', ');
  const releaseYear = spotifyAlbum.release_date
    ? parseInt(spotifyAlbum.release_date.substring(0, 4), 10)
    : null;
  const imageUrl = spotifyAlbum.images?.[0]?.url ?? null;

  const lastfmData = await getAlbumInfo(
    spotifyAlbum.artists[0]?.name ?? '',
    spotifyAlbum.name
  );

  const topTracks = (spotifyAlbum.tracks?.items ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    duration_ms: t.duration_ms,
    preview_url: t.preview_url,
  }));

  await query(
    `INSERT INTO albums_cache (
       spotify_album_id, artist_name, album_name, release_year,
       image_url, images, spotify_popularity, total_tracks, genres,
       lastfm_tags, lastfm_listeners, lastfm_playcount, top_tracks,
       external_urls, last_fetched
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
     ON CONFLICT (spotify_album_id) DO UPDATE SET
       artist_name = EXCLUDED.artist_name,
       album_name = EXCLUDED.album_name,
       release_year = EXCLUDED.release_year,
       image_url = EXCLUDED.image_url,
       images = EXCLUDED.images,
       spotify_popularity = EXCLUDED.spotify_popularity,
       total_tracks = EXCLUDED.total_tracks,
       genres = EXCLUDED.genres,
       lastfm_tags = EXCLUDED.lastfm_tags,
       lastfm_listeners = EXCLUDED.lastfm_listeners,
       lastfm_playcount = EXCLUDED.lastfm_playcount,
       top_tracks = EXCLUDED.top_tracks,
       external_urls = EXCLUDED.external_urls,
       last_fetched = NOW()`,
    [
      spotifyAlbum.id,
      artistName,
      spotifyAlbum.name,
      releaseYear,
      imageUrl,
      JSON.stringify(spotifyAlbum.images),
      spotifyAlbum.popularity ?? null,
      spotifyAlbum.total_tracks,
      JSON.stringify(spotifyAlbum.genres ?? []),
      JSON.stringify(lastfmData?.tags ?? []),
      lastfmData?.listeners ?? null,
      lastfmData?.playcount ?? null,
      JSON.stringify(topTracks),
      JSON.stringify(spotifyAlbum.external_urls),
    ]
  );
}

async function fetchPlaylistTracksPages(
  playlistId: string,
  playlistToken: string,
  market?: string
): Promise<PlaylistTrackItem[]> {
  const headers = { Authorization: `Bearer ${playlistToken}` };
  const all: PlaylistTrackItem[] = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const params: Record<string, string | number> = { limit, offset };
    if (market) params.market = market;
    else params.market = 'MX';

    const { data } = await axios.get<{ items: PlaylistTrackItem[]; next: string | null }>(
      `${SPOTIFY_API}/playlists/${playlistId}/tracks`,
      { headers, params }
    );

    all.push(...data.items);
    if (!data.next) break;
    offset += limit;
  }

  return all;
}

async function main() {
  const { playlistInput, userToken: argToken } = parseArgs();
  const playlistId = extractPlaylistId(playlistInput || DEFAULT_PLAYLIST);
  const market = process.env.SPOTIFY_MARKET?.trim() || undefined;

  const userPlaylistToken =
    argToken || process.env.SPOTIFY_USER_ACCESS_TOKEN?.trim() || null;
  const appToken = await getClientAccessToken();

  const playlistToken = userPlaylistToken || appToken;

  const headers = { Authorization: `Bearer ${playlistToken}` };

  let playlistMeta: { name: string; description: string | null };
  try {
    const { data } = await axios.get<{ name: string; description: string | null }>(
      `${SPOTIFY_API}/playlists/${playlistId}`,
      { headers }
    );
    playlistMeta = data;
  } catch (e) {
    console.error('Failed to load playlist:', spotifyErrMessage(e));
    if (axios.isAxiosError(e) && e.response?.status === 403) {
      console.error(`
Spotify returned 403. For private or "friends-only" playlists you need a user access token:
  1. Open https://developer.spotify.com/documentation/web-console/get-playlist/
  2. Click "Get Token", select scopes: playlist-read-private, playlist-read-collaborative
  3. Run:
     npx ts-node --transpile-only src/scripts/seedPlaylist.ts "${playlistId}" --token=YOUR_TOKEN
  Or set SPOTIFY_USER_ACCESS_TOKEN in .env and run again.

Alternatively make the playlist fully public in the Spotify app, then retry without a user token.`);
    }
    process.exit(1);
  }

  let trackItems: PlaylistTrackItem[];
  try {
    trackItems = await fetchPlaylistTracksPages(playlistId, playlistToken, market);
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 403 && !userPlaylistToken) {
      console.error('Failed to load playlist tracks (403).', spotifyErrMessage(e));
      console.error(`
Client-credentials cannot read these tracks. Use a user token (see message above) or make the playlist public.`);
      process.exit(1);
    }
    if (axios.isAxiosError(e) && e.response?.status === 400 && market) {
      trackItems = await fetchPlaylistTracksPages(playlistId, playlistToken);
    } else {
      throw e;
    }
  }

  const albumIdsOrdered: string[] = [];
  const seen = new Set<string>();

  for (const row of trackItems) {
    const albumId = row.track?.album?.id;
    if (!albumId || seen.has(albumId)) continue;
    seen.add(albumId);
    albumIdsOrdered.push(albumId);
  }

  if (albumIdsOrdered.length === 0) {
    console.error(
      'No albums found (empty playlist, only local files, or tracks missing album IDs).'
    );
    process.exit(1);
  }

  const userId = await getDemoUserId();
  const title = playlistMeta.name || 'Imported playlist';
  const description =
    playlistMeta.description?.replace(/<[^>]+>/g, '') ||
    `Seeded from Spotify playlist ${playlistId}`;

  const listResult = await query(
    `INSERT INTO lists (user_id, title, description, is_public, slug)
     VALUES ($1, $2, $3, FALSE, NULL)
     RETURNING id`,
    [userId, title, description]
  );
  const listId = (listResult.rows[0] as { id: string }).id;

  console.log(`Created list "${title}" (${listId}) with ${albumIdsOrdered.length} unique albums.`);

  let position = 0;
  for (const albumId of albumIdsOrdered) {
    const spotifyAlbum = await getAlbum(albumId, appToken);
    await upsertAlbumCache(spotifyAlbum);
    await query(
      `INSERT INTO list_albums (list_id, spotify_album_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (list_id, spotify_album_id) DO NOTHING`,
      [listId, albumId, position]
    );
    position += 1;
    process.stdout.write(`\rAdded ${position}/${albumIdsOrdered.length} albums`);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
