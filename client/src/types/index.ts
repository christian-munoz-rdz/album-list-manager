export interface User {
  id: string;
  spotify_id: string | null;
  username: string;
  display_name: string | null;
  profile_image: string | null;
  email: string | null;
  created_at: string;
}

export interface List {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  slug: string | null;
  created_at: string;
  updated_at: string;
  album_count?: number;
  /** First 5 album cover image URLs (list order), null entries omitted on server when possible */
  thumbnail_urls?: (string | null)[] | null;
  albums?: ListAlbum[];
}

export interface Album {
  album_id: string;
  artist_name: string;
  album_name: string;
  release_year: number | null;
  image_url: string | null;
  images: Array<{ url: string; width: number; height: number }> | null;
  spotify_popularity: number | null;
  total_tracks: number | null;
  genres: string[];
  lastfm_tags: Array<{ name: string; url: string }>;
  lastfm_listeners: number | null;
  lastfm_playcount: number | null;
  top_tracks: Array<{ id: string; name: string; duration_ms: number; preview_url: string | null }>;
  external_urls: { spotify?: string; lastfm?: string } | null;
}

export interface ListAlbum extends Album {
  list_album_id: string;
  position: number;
  user_note: string | null;
  /** 1–5 stars, 0 = unrated */
  rating?: number;
  added_at: string;
}

export interface DashboardStats {
  total_lists: number;
  total_albums: number;
  public_lists: number;
  top_genres: Array<{ genre: string; count: number }>;
  recently_added: ListAlbum[];
}

export interface ChartAlbum {
  album_id: null;
  artist_name: string;
  album_name: string;
  lastfm_url: string;
  images: Array<{ url: string; width: number; height: number }>;
  lastfm_listeners: number;
  lastfm_playcount: number;
  lastfm_rank: number;
}

export interface ChartResponse {
  results: ChartAlbum[];
  totalPages: number;
  page: number;
  limit: number;
}
