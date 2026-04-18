import axios from 'axios';
import type { User, List, Album, ChartResponse, ApiToken, ApiTokenCreated } from '../types';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

// Auth
export const getMe = () => api.get<User>('/auth/me').then(r => r.data);
export const register = (data: {
  username: string;
  password: string;
  email?: string;
  display_name?: string;
}) => api.post<User>('/auth/register', data).then(r => r.data);
export const login = (data: { identifier: string; password: string }) =>
  api.post<User>('/auth/login', data).then(r => r.data);
export const logout = () => api.post('/auth/logout').then(r => r.data);
export const spotifyLoginUrl = '/api/auth/spotify';

// API tokens (Chrome extension)
export const createApiToken = (data?: { label?: string }) =>
  api.post<ApiTokenCreated>('/tokens', data ?? {}).then((r) => r.data);

export const getApiTokens = () => api.get<ApiToken[]>('/tokens').then((r) => r.data);

export const deleteApiToken = (id: string) => api.delete<{ ok: boolean }>(`/tokens/${id}`).then((r) => r.data);

// Lists
export const getLists = () => api.get<List[]>('/lists').then(r => r.data);
export const getList = (id: string) => api.get<List>(`/lists/${id}`).then(r => r.data);
export const getSharedList = (slug: string) => api.get<List>(`/lists/shared/${slug}`).then(r => r.data);
export const createList = (data: { title: string; description?: string; is_public?: boolean }) =>
  api.post<List>('/lists', data).then(r => r.data);
export const updateList = (id: string, data: Partial<{ title: string; description: string; is_public: boolean }>) =>
  api.put<List>(`/lists/${id}`, data).then(r => r.data);
export const deleteList = (id: string) => api.delete(`/lists/${id}`);

// Albums
export const removeAlbum = (list_id: string, album_id: string) =>
  api.delete('/albums/remove', { data: { list_id, album_id } });
export const reorderAlbums = (list_id: string, album_ids: string[]) =>
  api.put('/albums/reorder', { list_id, album_ids }).then(r => r.data);
export const updateNote = (list_id: string, album_id: string, note: string) =>
  api.put('/albums/note', { list_id, album_id, note }).then(r => r.data);
export const updateRating = (list_id: string, album_id: string, rating: number) =>
  api.put('/albums/rating', { list_id, album_id, rating }).then(r => r.data);
export const refreshAlbumCover = (list_id: string, album_id: string) =>
  api.post<{ album: Album }>('/albums/refresh-cover', { list_id, album_id }).then(r => r.data);
export const getAlbumDetails = (album_id: string) =>
  api.get<Album>(`/albums/${album_id}`).then(r => r.data);

// Charts
export const getChartAlbums = (tag: string, limit = 50, page = 1) =>
  api.get<ChartResponse>(`/charts?tag=${encodeURIComponent(tag)}&limit=${limit}&page=${page}`)
    .then(r => r.data);

// Search (Last.fm)
export interface ArtistHit {
  name: string;
  url: string;
  image_url: string | null;
  listeners: number;
  mbid?: string;
}

export const searchAlbums = (q: string, limit = 30) =>
  api.get<ChartResponse>(`/search?q=${encodeURIComponent(q)}&type=album&limit=${limit}`)
    .then(r => r.data);

export const searchArtists = (q: string, limit = 20) =>
  api.get<{ artists: ArtistHit[] }>(`/search?q=${encodeURIComponent(q)}&type=artist&limit=${limit}`)
    .then(r => r.data);

export const getArtistTopAlbums = (name: string, page = 1) =>
  api.get<ChartResponse>(`/search/artist/${encodeURIComponent(name)}/albums?page=${page}`)
    .then(r => r.data);

export const addChartAlbum = (
  list_id: string,
  artist_name: string,
  album_name: string,
  lastfm_url: string,
  image_url: string | null,
  lastfm_listeners: number,
  lastfm_playcount: number,
) =>
  api.post<{ album_id: string; list_id: string; position: number }>(
    '/charts/add-lastfm',
    { list_id, artist_name, album_name, lastfm_url, image_url, lastfm_listeners, lastfm_playcount }
  ).then(r => r.data);
