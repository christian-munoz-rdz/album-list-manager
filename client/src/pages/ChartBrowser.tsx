import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getChartAlbums, getLists, addChartAlbum, createList } from '../api/client';
import type { ChartAlbum, List } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ---- Add-to-list modal -----------------------------------------------------

interface AddToListModalProps {
  album: ChartAlbum;
  lists: List[];
  onClose: () => void;
}

function AddToListModal({ album, lists, onClose }: AddToListModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'pick' | 'create'>('pick');
  const [newTitle, setNewTitle] = useState('');
  const [status, setStatus] = useState<'idle' | 'adding' | 'done' | 'error'>('idle');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'create') titleRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const doAdd = async (listId: string) => {
    setStatus('adding');
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
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setStatus('done');
      setTimeout(onClose, 1200);
    } catch {
      setStatus('error');
    }
  };

  const doCreateAndAdd = async () => {
    if (!newTitle.trim()) return;
    setStatus('adding');
    try {
      const newList = await createList({ title: newTitle.trim() });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      await addChartAlbum(
        newList.id,
        album.artist_name,
        album.album_name,
        album.lastfm_url,
        album.images?.[0]?.url ?? null,
        album.lastfm_listeners,
        album.lastfm_playcount,
      );
      queryClient.invalidateQueries({ queryKey: ['list', newList.id] });
      setStatus('done');
      setTimeout(onClose, 1200);
    } catch {
      setStatus('error');
    }
  };

  const busy = status === 'adding';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-zinc-800 gap-3">
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-base leading-snug">Add to list</h2>
            <p className="text-zinc-500 text-xs mt-0.5 truncate">
              {album.album_name} <span className="text-zinc-600">·</span> {album.artist_name}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-zinc-500 hover:text-white transition-colors rounded-lg p-1 hover:bg-zinc-800 shrink-0 disabled:opacity-40"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" className="w-5 h-5 fill-current" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Status messages */}
          {status === 'adding' && (
            <p className="text-zinc-400 text-sm text-center py-2 animate-pulse">
              Adding to list…
            </p>
          )}
          {status === 'done' && (
            <p className="text-spotify-green text-sm text-center py-2 font-medium">
              Added!
            </p>
          )}
          {status === 'error' && (
            <p className="text-red-400 text-sm text-center py-2">
              Something went wrong. Please try again.
            </p>
          )}

          {/* List picker — shown when idle or after error */}
          {(status === 'idle' || status === 'error') && (
            <>
              {/* Tab switcher */}
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('pick')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'pick' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Existing list
                </button>
                <button
                  onClick={() => setMode('create')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'create' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  New list
                </button>
              </div>

              {mode === 'pick' ? (
                lists.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">
                    No lists yet.{' '}
                    <button onClick={() => setMode('create')} className="text-spotify-green hover:underline">
                      Create one
                    </button>
                  </p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {lists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => doAdd(list.id)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-left transition-colors"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">{list.title}</p>
                          {list.album_count !== undefined && (
                            <p className="text-zinc-500 text-xs">{list.album_count} album{list.album_count !== 1 ? 's' : ''}</p>
                          )}
                        </div>
                        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-zinc-500 shrink-0" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <input
                    ref={titleRef}
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="List name…"
                    maxLength={120}
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-spotify-green focus:ring-1 focus:ring-spotify-green rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 outline-none transition-colors text-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') doCreateAndAdd(); }}
                  />
                  <button
                    onClick={doCreateAndAdd}
                    disabled={!newTitle.trim()}
                    className="w-full bg-spotify-green hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Create & Add
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Album grid card -------------------------------------------------------

interface ChartCardProps {
  album: ChartAlbum;
  rank: number;
  onAddClick: () => void;
}

function ChartCard({ album, rank, onAddClick }: ChartCardProps) {
  const imageUrl = album.images?.[0]?.url ?? null;

  return (
    <div className="relative bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl overflow-hidden transition-all duration-150 group flex flex-col">
      {/* Rank badge */}
      <div className="absolute top-2 left-2 z-10 bg-black/70 text-zinc-300 text-xs font-bold px-2 py-0.5 rounded-full">
        #{rank}
      </div>

      {/* Add button */}
      <button
        onClick={onAddClick}
        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/60 hover:bg-spotify-green flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
        aria-label={`Add ${album.album_name} to list`}
      >
        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-white hover:text-black" aria-hidden="true">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Cover — click opens Last.fm */}
      <a
        href={album.lastfm_url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative aspect-square overflow-hidden block"
        tabIndex={-1}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={album.album_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-4xl text-zinc-700">♪</div>
        )}
      </a>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <a
          href={album.lastfm_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-semibold text-sm leading-snug line-clamp-2 hover:text-spotify-green transition-colors"
        >
          {album.album_name}
        </a>
        <p className="text-zinc-500 text-xs truncate">{album.artist_name}</p>
        {album.lastfm_listeners > 0 && (
          <p className="text-zinc-600 text-xs mt-auto pt-1">
            <span className="text-zinc-500">{formatNumber(album.lastfm_listeners)}</span> listeners
          </p>
        )}
      </div>
    </div>
  );
}

// ---- Main page -------------------------------------------------------------

export default function ChartBrowser() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tag, setTag] = useState('');
  const [limit, setLimit] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [submittedParams, setSubmittedParams] = useState<{ tag: string; limit: number } | null>(null);

  const [pendingAlbum, setPendingAlbum] = useState<ChartAlbum | null>(null);

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  const { data, isFetching, error, isSuccess } = useQuery({
    queryKey: ['charts', submittedParams, currentPage],
    queryFn: () => getChartAlbums(submittedParams!.tag, submittedParams!.limit, currentPage),
    enabled: !!submittedParams,
    staleTime: 5 * 60 * 1000,
  });

  const { data: lists = [] } = useQuery({
    queryKey: ['lists'],
    queryFn: getLists,
    enabled: !!user,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag.trim()) return;
    setCurrentPage(1);
    setSubmittedParams({ tag: tag.trim(), limit });
  };

  const albums = data?.results ?? [];
  const totalPages = data?.totalPages ?? 1;
  const rankOffset = (currentPage - 1) * limit;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Search</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Last.fm charts by tag · hover a card and click <span className="text-zinc-400">+</span> to add to a list
        </p>
      </div>

      {/* Search controls */}
      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-wrap gap-4 items-end"
      >
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="chart-tag" className="block text-zinc-400 text-xs font-medium mb-1.5">
            Genre / Tag
          </label>
          <input
            id="chart-tag"
            type="text"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="e.g. shoegaze, jazz, ambient…"
            className="w-full bg-zinc-800 border border-zinc-700 focus:border-spotify-green focus:ring-1 focus:ring-spotify-green rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 outline-none transition-colors text-sm"
            required
          />
        </div>

        <div className="w-28">
          <label htmlFor="chart-limit" className="block text-zinc-400 text-xs font-medium mb-1.5">
            Per page
          </label>
          <select
            id="chart-limit"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 focus:border-spotify-green rounded-lg px-4 py-2.5 text-white outline-none transition-colors text-sm appearance-none"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isFetching || !tag.trim()}
          className="bg-spotify-green hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap"
        >
          {isFetching ? 'Loading…' : 'Browse Chart'}
        </button>
      </form>

      {/* Error */}
      {error && !isFetching && (
        <div className="text-center py-16">
          <p className="text-red-400 font-medium">Failed to load chart data.</p>
          <p className="text-zinc-500 text-sm mt-1">Check your Last.fm API key and try again.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {isFetching && (
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

      {/* Empty */}
      {isSuccess && !isFetching && albums.length === 0 && (
        <div className="text-center py-16">
          <p className="text-zinc-400 font-medium">No albums found for this tag.</p>
          <p className="text-zinc-600 text-sm mt-1">Try a different genre name.</p>
        </div>
      )}

      {/* Results */}
      {isSuccess && !isFetching && albums.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-zinc-400 text-sm">
              Top{' '}
              <span className="text-spotify-green font-medium">{submittedParams?.tag}</span>{' '}
              albums on Last.fm
              {totalPages > 1 && (
                <span className="text-zinc-600 ml-1">· page {currentPage} of {totalPages}</span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((album, idx) => (
              <ChartCard
                key={`${album.artist_name}-${album.album_name}-${idx}`}
                album={album}
                rank={rankOffset + idx + 1}
                onAddClick={() => setPendingAlbum(album)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isFetching}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-sm rounded-lg transition-colors"
              >
                ← Previous
              </button>
              <span className="text-zinc-500 text-sm">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || isFetching}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-sm rounded-lg transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add-to-list modal */}
      {pendingAlbum && (
        <AddToListModal
          album={pendingAlbum}
          lists={lists}
          onClose={() => setPendingAlbum(null)}
        />
      )}
    </div>
  );
}
