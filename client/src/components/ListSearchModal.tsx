import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import clsx from 'clsx';
import {
  searchAlbums,
  searchArtists,
  getArtistTopAlbums,
  addChartAlbum,
  type ArtistHit,
} from '../api/client';
import type { ChartAlbum } from '../types';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  ChartCard,
  ChartListRow,
  chartAlbumKey,
  formatNumber,
} from './chart/ChartAlbumUI';

type SearchType = 'album' | 'artist';

type SearchView =
  | { kind: 'idle' }
  | { kind: 'results'; type: SearchType; query: string }
  | { kind: 'artist-albums'; artist: string; page: number };

interface ListSearchModalProps {
  listId: string;
  listTitle: string;
  onClose: () => void;
}

function ArtistCard({ artist, onClick }: { artist: ArtistHit; onClick: () => void }) {
  const imageUrl = artist.image_url;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-zinc-800 border border-zinc-700 hover:border-zinc-500 rounded-2xl overflow-hidden transition-colors flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-spotify-green"
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

export default function ListSearchModal({ listId, listTitle, onClose }: ListSearchModalProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<SearchType>('album');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const [view, setView] = useState<SearchView>({ kind: 'idle' });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'info' | 'err'; text: string } | null>(null);

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

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !bulkAdding && !addingKey) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, bulkAdding, addingKey]);

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

  const invalidateList = () => {
    void queryClient.invalidateQueries({ queryKey: ['list', listId] });
    void queryClient.invalidateQueries({ queryKey: ['lists'] });
  };

  const showBanner = (type: 'ok' | 'info' | 'err', text: string) => {
    setBanner({ type, text });
    window.setTimeout(() => setBanner(null), 3200);
  };

  const handleAddOne = async (album: ChartAlbum) => {
    const key = chartAlbumKey(album);
    setAddingKey(key);
    try {
      await addChartAlbum(
        listId,
        album.artist_name,
        album.album_name,
        album.lastfm_url,
        album.images?.[0]?.url ?? null,
        album.lastfm_listeners,
        album.lastfm_playcount,
      );
      invalidateList();
      showBanner('ok', `Added “${album.album_name}”`);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        showBanner('info', `Already in list: “${album.album_name}”`);
      } else {
        showBanner('err', 'Could not add album. Try again.');
      }
    } finally {
      setAddingKey(null);
    }
  };

  const handleAddBulk = async () => {
    if (selectedOnPage.length === 0) return;
    setBulkAdding(true);
    let added = 0;
    let skipped = 0;
    let failed = 0;
    for (const album of selectedOnPage) {
      try {
        await addChartAlbum(
          listId,
          album.artist_name,
          album.album_name,
          album.lastfm_url,
          album.images?.[0]?.url ?? null,
          album.lastfm_listeners,
          album.lastfm_playcount,
        );
        added++;
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 409) skipped++;
        else failed++;
      }
    }
    invalidateList();
    setBulkAdding(false);
    setSelectedKeys(new Set());
    if (added > 0) showBanner('ok', `Added ${added}${skipped ? `, ${skipped} already in list` : ''}${failed ? `, ${failed} failed` : ''}`);
    else if (skipped > 0 && failed === 0) showBanner('info', 'Those albums are already in this list.');
    else if (failed > 0) showBanner('err', 'Some albums could not be added.');
  };

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

  const showRank = view.kind === 'artist-albums';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !bulkAdding) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-zinc-800 shrink-0">
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-lg leading-snug">Add albums</h2>
            <p className="text-zinc-500 text-xs mt-0.5 truncate" title={listTitle}>
              Adding to <span className="text-zinc-400">{listTitle}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={bulkAdding}
            className="text-zinc-500 hover:text-white transition-colors rounded-lg p-1 hover:bg-zinc-800 shrink-0 disabled:opacity-40"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" className="w-5 h-5 fill-current" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {banner && (
          <div
            className={clsx(
              'mx-5 sm:mx-6 mt-3 px-3 py-2 rounded-lg text-sm border shrink-0',
              banner.type === 'ok' && 'bg-spotify-green/15 border-spotify-green/35 text-green-200',
              banner.type === 'info' && 'bg-zinc-800 border-zinc-600 text-zinc-300',
              banner.type === 'err' && 'bg-red-500/10 border-red-500/30 text-red-300',
            )}
            role="status"
          >
            {banner.text}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 min-h-0">
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full bg-zinc-800 p-1 border border-zinc-600" role="group" aria-label="Search type">
                <button
                  type="button"
                  onClick={() => setType('album')}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                    type === 'album' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  Albums
                </button>
                <button
                  type="button"
                  onClick={() => setType('artist')}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                    type === 'artist' ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  Artists
                </button>
              </div>
              <div className="flex-1 min-w-[200px]">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={type === 'album' ? 'Album title…' : 'Artist name…'}
                  className="w-full bg-zinc-900 border border-zinc-600 focus:border-spotify-green rounded-lg px-3 py-2 text-white placeholder-zinc-600 outline-none text-sm"
                  autoFocus
                />
              </div>
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-zinc-400 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-zinc-800"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-zinc-600 text-xs">At least 2 characters · Last.fm search</p>
          </div>

          {view.kind === 'idle' && (
            <div className="text-center py-12">
              <p className="text-zinc-500 text-sm">Type to search, then use + or select albums to add in bulk.</p>
            </div>
          )}

          {view.kind === 'results' && view.type === 'artist' && (
            <div className="space-y-4">
              {artistResults.isFetching && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-2xl overflow-hidden animate-pulse">
                      <div className="aspect-square bg-zinc-800" />
                      <div className="p-3 h-10 bg-zinc-800/80" />
                    </div>
                  ))}
                </div>
              )}
              {artistResults.isError && (
                <p className="text-red-400 text-sm text-center py-8">Search failed. Try again.</p>
              )}
              {artistResults.isSuccess && !artistResults.isFetching && (
                <>
                  {(artistResults.data?.artists ?? []).length === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-8">No artists match.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {(artistResults.data?.artists ?? []).map((artist) => (
                        <ArtistCard
                          key={`${artist.name}\u0000${artist.mbid ?? artist.url}`}
                          artist={artist}
                          onClick={() => openArtist(artist.name)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {(view.kind === 'results' && view.type === 'album') || view.kind === 'artist-albums' ? (
            <div className="space-y-4">
              {view.kind === 'artist-albums' && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={backToArtistSearch}
                    className="text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg border border-zinc-600 hover:border-zinc-500"
                  >
                    ← Artists
                  </button>
                  <p className="text-zinc-400 text-sm">
                    Top albums · <span className="text-spotify-green font-medium">{(view as Extract<SearchView, { kind: 'artist-albums' }>).artist}</span>
                  </p>
                </div>
              )}

              {isFetchingAlbums && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-zinc-800 border border-zinc-700 rounded-2xl animate-pulse aspect-square" />
                  ))}
                </div>
              )}

              {!isFetchingAlbums && albumsForDisplay.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-8">No albums found.</p>
              )}

              {!isFetchingAlbums && albumsForDisplay.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div
                      className="inline-flex rounded-full bg-zinc-800 p-1 border border-zinc-600"
                      role="group"
                      aria-label="Layout"
                    >
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={clsx(
                          'px-2.5 py-1 rounded-full text-xs font-medium',
                          viewMode === 'grid' ? 'bg-zinc-600 text-white' : 'text-zinc-400',
                        )}
                      >
                        Grid
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={clsx(
                          'px-2.5 py-1 rounded-full text-xs font-medium',
                          viewMode === 'list' ? 'bg-zinc-600 text-white' : 'text-zinc-400',
                        )}
                      >
                        List
                      </button>
                    </div>
                    <label className="inline-flex items-center gap-2 text-zinc-400 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAllPage}
                        className="rounded border-zinc-500 text-spotify-green focus:ring-spotify-green bg-zinc-900"
                      />
                      Select page
                    </label>
                  </div>

                  {selectedOnPage.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-600 bg-zinc-800/80 px-3 py-2">
                      <span className="text-sm text-white font-medium">{selectedOnPage.length} selected</span>
                      <button
                        type="button"
                        onClick={handleAddBulk}
                        disabled={bulkAdding}
                        className="bg-spotify-green hover:bg-green-400 disabled:opacity-60 text-black font-semibold px-3 py-1.5 rounded-lg text-sm"
                      >
                        {bulkAdding ? 'Adding…' : 'Add to this list'}
                      </button>
                    </div>
                  )}

                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {albumsForDisplay.map((album, idx) => {
                        const key = chartAlbumKey(album);
                        const busy = addingKey === key;
                        return (
                          <div key={key} className="relative">
                            <ChartCard
                              album={album}
                              rank={idx + 1}
                              selected={selectedKeys.has(key)}
                              onToggleSelect={(checked) => toggleSelect(album, checked)}
                              onAddClick={() => void handleAddOne(album)}
                              showRank={showRank}
                            />
                            {busy && (
                              <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center z-30">
                                <span className="text-white text-xs font-medium animate-pulse">Adding…</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {albumsForDisplay.map((album, idx) => {
                        const key = chartAlbumKey(album);
                        const busy = addingKey === key;
                        return (
                          <div key={key} className={clsx('relative', busy && 'opacity-60 pointer-events-none')}>
                            <ChartListRow
                              album={album}
                              rank={idx + 1}
                              selected={selectedKeys.has(key)}
                              onToggleSelect={(checked) => toggleSelect(album, checked)}
                              onAddClick={() => void handleAddOne(album)}
                              showRank={showRank}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {view.kind === 'artist-albums' && (artistAlbums.data?.totalPages ?? 1) > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() =>
                          setView((v) =>
                            v.kind === 'artist-albums' ? { ...v, page: Math.max(1, v.page - 1) } : v,
                          )
                        }
                        disabled={view.kind !== 'artist-albums' || view.page <= 1 || artistAlbums.isFetching}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm rounded-lg"
                      >
                        Previous
                      </button>
                      <span className="text-zinc-500 text-sm">
                        {view.kind === 'artist-albums' ? view.page : 1} / {artistAlbums.data?.totalPages ?? 1}
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
                        disabled={
                          view.kind !== 'artist-albums' ||
                          view.page >= (artistAlbums.data?.totalPages ?? 1) ||
                          artistAlbums.isFetching
                        }
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm rounded-lg"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
