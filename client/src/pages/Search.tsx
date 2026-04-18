import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  getLists,
  searchAlbums,
  searchArtists,
  getArtistTopAlbums,
  type ArtistHit,
} from '../api/client';
import type { ChartAlbum } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  AddToListModal,
  BulkAddToListModal,
  ChartCard,
  ChartListRow,
  chartAlbumKey,
  formatNumber,
} from '../components/chart/ChartAlbumUI';

type SearchType = 'album' | 'artist';

/** State describing which Last.fm view is currently active. */
type SearchView =
  | { kind: 'idle' }
  | { kind: 'results'; type: SearchType; query: string }
  | { kind: 'artist-albums'; artist: string; page: number };

// ---- Artist result card ----------------------------------------------------

interface ArtistCardProps {
  artist: ArtistHit;
  onClick: () => void;
}

function ArtistCard({ artist, onClick }: ArtistCardProps) {
  const imageUrl = artist.image_url;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl overflow-hidden transition-colors flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-spotify-green focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    >
      <div className="relative aspect-square overflow-hidden bg-zinc-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={artist.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-zinc-700">♫</div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <span className="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-spotify-green transition-colors">
          {artist.name}
        </span>
        {artist.listeners > 0 && (
          <p className="text-zinc-600 text-xs mt-auto pt-1">
            <span className="text-zinc-500">{formatNumber(artist.listeners)}</span> listeners
          </p>
        )}
      </div>
    </button>
  );
}

// ---- Main page -------------------------------------------------------------

export default function Search() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [type, setType] = useState<SearchType>('album');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);

  const [view, setView] = useState<SearchView>({ kind: 'idle' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [pendingAlbum, setPendingAlbum] = useState<ChartAlbum | null>(null);
  const [bulkAlbums, setBulkAlbums] = useState<ChartAlbum[] | null>(null);

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  // Auto-run search whenever the debounced query settles at ≥ 2 chars.
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setView({ kind: 'idle' });
      return;
    }
    setView({ kind: 'results', type, query: q });
  }, [debouncedQuery, type]);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [view]);

  const { data: lists = [] } = useQuery({
    queryKey: ['lists'],
    queryFn: getLists,
    enabled: !!user,
  });

  const albumResults = useQuery({
    queryKey: ['search', 'album', view.kind === 'results' && view.type === 'album' ? view.query : null],
    queryFn: () => searchAlbums((view as Extract<SearchView, { kind: 'results' }>).query, 30),
    enabled: view.kind === 'results' && view.type === 'album',
    staleTime: 5 * 60 * 1000,
  });

  const artistResults = useQuery({
    queryKey: ['search', 'artist', view.kind === 'results' && view.type === 'artist' ? view.query : null],
    queryFn: () => searchArtists((view as Extract<SearchView, { kind: 'results' }>).query, 24),
    enabled: view.kind === 'results' && view.type === 'artist',
    staleTime: 5 * 60 * 1000,
  });

  const artistAlbums = useQuery({
    queryKey: ['artist-albums', view.kind === 'artist-albums' ? view.artist : null, view.kind === 'artist-albums' ? view.page : 1],
    queryFn: () => {
      const v = view as Extract<SearchView, { kind: 'artist-albums' }>;
      return getArtistTopAlbums(v.artist, v.page);
    },
    enabled: view.kind === 'artist-albums',
    staleTime: 5 * 60 * 1000,
  });

  const openArtist = (name: string) => {
    setView({ kind: 'artist-albums', artist: name, page: 1 });
  };

  const backToArtistSearch = () => {
    setType('artist');
    if (debouncedQuery.trim().length >= 2) {
      setView({ kind: 'results', type: 'artist', query: debouncedQuery.trim() });
    } else {
      setView({ kind: 'idle' });
    }
  };

  // ---- Derived state for album-ish views ----------------------------------

  const albumsForDisplay: ChartAlbum[] = useMemo(() => {
    if (view.kind === 'results' && view.type === 'album') return albumResults.data?.results ?? [];
    if (view.kind === 'artist-albums') return artistAlbums.data?.results ?? [];
    return [];
  }, [view, albumResults.data, artistAlbums.data]);

  const isFetchingAlbums =
    (view.kind === 'results' && view.type === 'album' && albumResults.isFetching) ||
    (view.kind === 'artist-albums' && artistAlbums.isFetching);

  const selectedOnPage = useMemo(
    () => albumsForDisplay.filter((a) => selectedKeys.has(chartAlbumKey(a))),
    [albumsForDisplay, selectedKeys],
  );

  const allPageSelected = useMemo(() => {
    if (albumsForDisplay.length === 0) return false;
    return albumsForDisplay.every((a) => selectedKeys.has(chartAlbumKey(a)));
  }, [albumsForDisplay, selectedKeys]);

  const toggleSelect = (album: ChartAlbum, checked: boolean) => {
    const key = chartAlbumKey(album);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const a of albumsForDisplay) next.delete(chartAlbumKey(a));
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const a of albumsForDisplay) next.add(chartAlbumKey(a));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedKeys(new Set());
  const selectedCount = selectedOnPage.length;

  // ---- Render -------------------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Search</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Search Last.fm by album name or artist · tap an artist to browse their top albums
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex rounded-full bg-zinc-800/90 p-1 border border-zinc-700/80"
            role="group"
            aria-label="Search type"
          >
            <button
              type="button"
              onClick={() => setType('album')}
              className={clsx(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                type === 'album' ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              Albums
            </button>
            <button
              type="button"
              onClick={() => setType('artist')}
              className={clsx(
                'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                type === 'artist' ? 'bg-zinc-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              Artists
            </button>
          </div>

          <div className="flex-1 min-w-[220px]">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={type === 'album' ? 'Album title…' : 'Artist name…'}
              className="w-full bg-zinc-800 border border-zinc-700 focus:border-spotify-green focus:ring-1 focus:ring-spotify-green rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 outline-none transition-colors text-sm"
              autoFocus
            />
          </div>

          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <p className="text-zinc-600 text-xs">
          Enter at least 2 characters · results update as you type
        </p>
      </div>

      {/* Idle state -------------------------------------------------------- */}
      {view.kind === 'idle' && (
        <div className="text-center py-16">
          <p className="text-zinc-400 font-medium">Start typing to search Last.fm.</p>
          <p className="text-zinc-600 text-sm mt-1">
            Try an album name like <span className="text-zinc-400">“in rainbows”</span> or an artist like{' '}
            <span className="text-zinc-400">“radiohead”</span>.
          </p>
        </div>
      )}

      {/* Artist search results --------------------------------------------- */}
      {view.kind === 'results' && view.type === 'artist' && (
        <div className="space-y-4">
          {artistResults.isFetching && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden animate-pulse">
                  <div className="aspect-square bg-zinc-800" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-zinc-800 rounded w-3/4" />
                    <div className="h-2.5 bg-zinc-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {artistResults.isError && (
            <div className="text-center py-16">
              <p className="text-red-400 font-medium">Search failed.</p>
              <p className="text-zinc-500 text-sm mt-1">Try again in a moment.</p>
            </div>
          )}

          {artistResults.isSuccess && !artistResults.isFetching && (
            <>
              {(artistResults.data?.artists ?? []).length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-zinc-400 font-medium">No artists match “{view.query}”.</p>
                </div>
              ) : (
                <>
                  <p className="text-zinc-400 text-sm">
                    Artists matching <span className="text-spotify-green font-medium">{view.query}</span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {(artistResults.data?.artists ?? []).map((artist) => (
                      <ArtistCard
                        key={`${artist.name}\u0000${artist.mbid ?? artist.url}`}
                        artist={artist}
                        onClick={() => openArtist(artist.name)}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Album search or artist albums ------------------------------------- */}
      {(view.kind === 'results' && view.type === 'album') || view.kind === 'artist-albums' ? (
        <div className="space-y-4">
          {view.kind === 'artist-albums' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={backToArtistSearch}
                className="text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors border border-zinc-700 hover:border-zinc-500"
              >
                ← Back to artists
              </button>
              <p className="text-zinc-300 text-sm">
                Top albums by <span className="text-spotify-green font-medium">{view.artist}</span>
                {(artistAlbums.data?.totalPages ?? 1) > 1 && (
                  <span className="text-zinc-600 ml-1">
                    · page {view.page} of {artistAlbums.data?.totalPages ?? 1}
                  </span>
                )}
              </p>
            </div>
          )}

          {isFetchingAlbums && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden animate-pulse">
                  <div className="aspect-square bg-zinc-800" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-zinc-800 rounded w-3/4" />
                    <div className="h-2.5 bg-zinc-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isFetchingAlbums && albumsForDisplay.length === 0 && (
            <div className="text-center py-16">
              <p className="text-zinc-400 font-medium">
                {view.kind === 'artist-albums'
                  ? `No albums found for “${view.artist}”.`
                  : `No albums match “${(view as Extract<SearchView, { kind: 'results' }>).query}”.`}
              </p>
            </div>
          )}

          {!isFetchingAlbums && albumsForDisplay.length > 0 && (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {view.kind === 'results' && view.type === 'album' && (
                  <p className="text-zinc-400 text-sm">
                    Albums matching <span className="text-spotify-green font-medium">{view.query}</span>
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  <div
                    className="inline-flex rounded-full bg-zinc-800/90 p-1 border border-zinc-700/80"
                    role="group"
                    aria-label="Result layout"
                  >
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={clsx(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                        viewMode === 'grid' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
                      )}
                    >
                      Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={clsx(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                        viewMode === 'list' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
                      )}
                    >
                      List
                    </button>
                  </div>

                  <label className="inline-flex items-center gap-2 text-zinc-400 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAllPage}
                      className="rounded border-zinc-500 text-spotify-green focus:ring-spotify-green bg-zinc-900"
                    />
                    Select page
                  </label>
                </div>
              </div>

              {selectedCount > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/90 px-4 py-3">
                  <span className="text-sm text-white font-medium">{selectedCount} selected</span>
                  <button
                    type="button"
                    onClick={() => setBulkAlbums(selectedOnPage)}
                    className="bg-spotify-green hover:bg-green-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    Add to list…
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-zinc-400 hover:text-white text-sm font-medium px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {albumsForDisplay.map((album, idx) => {
                    const key = chartAlbumKey(album);
                    return (
                      <ChartCard
                        key={key}
                        album={album}
                        rank={idx + 1}
                        selected={selectedKeys.has(key)}
                        onToggleSelect={(checked) => toggleSelect(album, checked)}
                        onAddClick={() => setPendingAlbum(album)}
                        showRank={view.kind === 'artist-albums'}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {albumsForDisplay.map((album, idx) => {
                    const key = chartAlbumKey(album);
                    return (
                      <ChartListRow
                        key={key}
                        album={album}
                        rank={idx + 1}
                        selected={selectedKeys.has(key)}
                        onToggleSelect={(checked) => toggleSelect(album, checked)}
                        onAddClick={() => setPendingAlbum(album)}
                        showRank={view.kind === 'artist-albums'}
                      />
                    );
                  })}
                </div>
              )}

              {view.kind === 'artist-albums' && (artistAlbums.data?.totalPages ?? 1) > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setView((v) =>
                        v.kind === 'artist-albums' ? { ...v, page: Math.max(1, v.page - 1) } : v,
                      )
                    }
                    disabled={view.page <= 1 || artistAlbums.isFetching}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-sm rounded-lg transition-colors"
                  >
                    ← Previous
                  </button>
                  <span className="text-zinc-500 text-sm">
                    {view.page} / {artistAlbums.data?.totalPages ?? 1}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setView((v) =>
                        v.kind === 'artist-albums'
                          ? { ...v, page: Math.min(artistAlbums.data?.totalPages ?? v.page, v.page + 1) }
                          : v,
                      )
                    }
                    disabled={view.page >= (artistAlbums.data?.totalPages ?? 1) || artistAlbums.isFetching}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-sm rounded-lg transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {pendingAlbum && (
        <AddToListModal album={pendingAlbum} lists={lists} onClose={() => setPendingAlbum(null)} />
      )}

      {bulkAlbums && bulkAlbums.length > 0 && (
        <BulkAddToListModal
          albums={bulkAlbums}
          lists={lists}
          onClose={() => setBulkAlbums(null)}
          onDone={clearSelection}
        />
      )}
    </div>
  );
}
