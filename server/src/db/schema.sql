CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  spotify_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  profile_image TEXT,
  email VARCHAR(255),
  spotify_access_token TEXT,
  spotify_refresh_token TEXT,
  spotify_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  slug VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_slug ON lists(slug);

CREATE TABLE IF NOT EXISTS albums_cache (
  spotify_album_id VARCHAR(255) PRIMARY KEY,
  artist_name VARCHAR(500) NOT NULL,
  album_name VARCHAR(500) NOT NULL,
  release_year INTEGER,
  image_url TEXT,
  images JSONB,
  spotify_popularity INTEGER,
  total_tracks INTEGER,
  genres JSONB DEFAULT '[]',
  lastfm_tags JSONB DEFAULT '[]',
  lastfm_listeners INTEGER,
  lastfm_playcount INTEGER,
  top_tracks JSONB DEFAULT '[]',
  external_urls JSONB,
  last_fetched TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS list_albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  spotify_album_id VARCHAR(255) NOT NULL REFERENCES albums_cache(spotify_album_id),
  position INTEGER NOT NULL DEFAULT 0,
  user_note TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_id, spotify_album_id)
);

CREATE INDEX IF NOT EXISTS idx_list_albums_list_id ON list_albums(list_id);

CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMPTZ NOT NULL,
  CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
