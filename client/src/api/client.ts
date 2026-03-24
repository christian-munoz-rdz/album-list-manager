import axios from 'axios';
import type { User, List, Album, SpotifySearchResult } from '../types';

export const api = axios.create({ baseURL: '/api', withCredentials: true });

// Auth
export const getMe = () => api.get<User>('/auth/me').then(r => r.data);
export const logout = () => api.post('/auth/logout');

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
export const searchAlbums = (q: string) =>
  api.get<SpotifySearchResult[]>(`/albums/search?q=${encodeURIComponent(q)}`).then(r => r.data);
export const addAlbum = (list_id: string, spotify_album_id: string) =>
  api.post('/albums/add', { list_id, spotify_album_id }).then(r => r.data);
export const removeAlbum = (list_id: string, spotify_album_id: string) =>
  api.delete('/albums/remove', { data: { list_id, spotify_album_id } });
export const reorderAlbums = (list_id: string, album_ids: string[]) =>
  api.put('/albums/reorder', { list_id, album_ids }).then(r => r.data);
export const updateNote = (list_id: string, spotify_album_id: string, note: string) =>
  api.put('/albums/note', { list_id, spotify_album_id, note }).then(r => r.data);
export const getAlbumDetails = (spotify_album_id: string) =>
  api.get<Album>(`/albums/${spotify_album_id}`).then(r => r.data);
