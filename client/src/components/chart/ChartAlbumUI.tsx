import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import clsx from 'clsx';
import { addChartAlbum, createList } from '../../api/client';
import type { ChartAlbum, List } from '../../types';

/** Compact formatter for listener / playcount numbers. */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/** Stable id for chart rows (selection, React keys). */
export function chartAlbumKey(album: ChartAlbum): string {
  return album.lastfm_url || `${album.artist_name}\u0000${album.album_name}`;
}

// ---- Add-to-list modal -----------------------------------------------------

interface AddToListModalProps {
  album: ChartAlbum;
  lists: List[];
  onClose: () => void;
}

export function AddToListModal({ album, lists, onClose }: AddToListModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'pick' | 'create'>('pick');
  const [newTitle, setNewTitle] = useState('');
  const [status, setStatus] = useState<'idle' | 'adding' | 'done' | 'error'>('idle');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'create') titleRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
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
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
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
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {status === 'adding' && (
            <p className="text-zinc-400 text-sm text-center py-2 animate-pulse">Adding to list…</p>
          )}
          {status === 'done' && (
            <p className="text-spotify-green text-sm text-center py-2 font-medium">Added!</p>
          )}
          {status === 'error' && (
            <p className="text-red-400 text-sm text-center py-2">Something went wrong. Please try again.</p>
          )}

          {(status === 'idle' || status === 'error') && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('pick')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'pick' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Existing list
                </button>
                <button
                  type="button"
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
                    <button type="button" onClick={() => setMode('create')} className="text-spotify-green hover:underline">
                      Create one
                    </button>
                  </p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {lists.map((list) => (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => doAdd(list.id)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-left transition-colors"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">{list.title}</p>
                          {list.album_count !== undefined && (
                            <p className="text-zinc-500 text-xs">
                              {list.album_count} album{list.album_count !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-zinc-500 shrink-0" aria-hidden="true">
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') doCreateAndAdd();
                    }}
                  />
                  <button
                    type="button"
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

// ---- Bulk add modal --------------------------------------------------------

interface BulkAddToListModalProps {
  albums: ChartAlbum[];
  lists: List[];
  onClose: () => void;
  onDone: () => void;
}

export function BulkAddToListModal({ albums, lists, onClose, onDone }: BulkAddToListModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'pick' | 'create'>('pick');
  const [newTitle, setNewTitle] = useState('');
  const [status, setStatus] = useState<'idle' | 'adding' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [summary, setSummary] = useState<{ added: number; skipped: number; failed: number } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === 'create') titleRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'adding') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, status]);

  const runBulk = async (listId: string) => {
    setStatus('adding');
    setProgress({ current: 0, total: albums.length });
    let added = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < albums.length; i++) {
      const album = albums[i];
      setProgress({ current: i + 1, total: albums.length });
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

    queryClient.invalidateQueries({ queryKey: ['list', listId] });
    queryClient.invalidateQueries({ queryKey: ['lists'] });

    setSummary({ added, skipped, failed });
    setStatus('done');
    onDone();
    setTimeout(() => {
      onClose();
    }, failed > 0 ? 2800 : 1600);
  };

  const doCreateAndBulk = async () => {
    if (!newTitle.trim()) return;
    setStatus('adding');
    setProgress({ current: 0, total: albums.length });
    try {
      const newList = await createList({ title: newTitle.trim() });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      await runBulk(newList.id);
    } catch {
      setStatus('error');
    }
  };

  const busy = status === 'adding';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-zinc-800 gap-3">
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-base leading-snug">Bulk add to list</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              {albums.length} album{albums.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
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

        <div className="px-6 py-5 space-y-4">
          {status === 'adding' && (
            <div className="text-center py-2 space-y-2">
              <p className="text-zinc-400 text-sm animate-pulse">
                Adding {progress.current} / {progress.total}…
              </p>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-spotify-green transition-all duration-200"
                  style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {status === 'done' && summary && (
            <div className="text-sm text-center py-2 space-y-1">
              <p className="text-spotify-green font-medium">
                {summary.added} added
                {summary.skipped > 0 && (
                  <span className="text-zinc-400 font-normal">
                    {' '}
                    · {summary.skipped} already in list
                  </span>
                )}
              </p>
              {summary.failed > 0 && <p className="text-amber-400">{summary.failed} could not be added</p>}
            </div>
          )}

          {status === 'error' && (
            <p className="text-red-400 text-sm text-center py-2">Something went wrong. Please try again.</p>
          )}

          {(status === 'idle' || status === 'error') && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('pick')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === 'pick' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Existing list
                </button>
                <button
                  type="button"
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
                    <button type="button" onClick={() => setMode('create')} className="text-spotify-green hover:underline">
                      Create one
                    </button>
                  </p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {lists.map((list) => (
                      <button
                        key={list.id}
                        type="button"
                        onClick={() => runBulk(list.id)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-left transition-colors"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">{list.title}</p>
                          {list.album_count !== undefined && (
                            <p className="text-zinc-500 text-xs">
                              {list.album_count} album{list.album_count !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-zinc-500 shrink-0" aria-hidden="true">
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') doCreateAndBulk();
                    }}
                  />
                  <button
                    type="button"
                    onClick={doCreateAndBulk}
                    disabled={!newTitle.trim()}
                    className="w-full bg-spotify-green hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
                  >
                    Create & add all
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

// ---- Shared selection checkbox --------------------------------------------

export function SelectionMark({ selected, className }: { selected: boolean; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
        selected
          ? 'border-spotify-green bg-spotify-green text-black'
          : 'border-zinc-500 bg-zinc-900/90 text-transparent',
        className,
      )}
      aria-hidden
    >
      {selected && (
        <svg viewBox="0 0 20 20" className="h-3 w-3 fill-current" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </span>
  );
}

// ---- Album grid card -------------------------------------------------------

interface ChartCardProps {
  album: ChartAlbum;
  rank: number;
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onAddClick: () => void;
  /** Whether to show a rank badge. Search results usually hide this. */
  showRank?: boolean;
}

export function ChartCard({ album, rank, selected, onToggleSelect, onAddClick, showRank = true }: ChartCardProps) {
  const imageUrl = album.images?.[0]?.url ?? null;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      className={clsx(
        'relative rounded-2xl overflow-hidden transition-colors duration-150 group flex flex-col',
        selected
          ? 'ring-2 ring-spotify-green bg-zinc-800/50'
          : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-600',
      )}
    >
      <div className="absolute top-2 left-2 right-2 z-20 flex items-start justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={selected ? `Deselect ${album.album_name}` : `Select ${album.album_name}`}
            onClick={(e) => {
              stop(e);
              onToggleSelect(!selected);
            }}
            className="pointer-events-auto shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spotify-green focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <SelectionMark selected={selected} />
          </button>
          {showRank && (
            <div className="bg-black/65 text-zinc-200 text-xs font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
              #{rank}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            onAddClick();
          }}
          className="pointer-events-auto w-8 h-8 rounded-full bg-black/55 hover:bg-spotify-green flex items-center justify-center opacity-100 transition-all border border-white/10 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          aria-label={`Add ${album.album_name} to list`}
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-white" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="relative aspect-square overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={album.album_name}
            className={clsx(
              'w-full h-full object-cover transition-transform duration-300',
              selected ? 'scale-100' : 'group-hover:scale-105',
            )}
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-4xl text-zinc-700">♪</div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1 flex-1 pointer-events-none">
        <a
          href={album.lastfm_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-semibold text-sm leading-snug line-clamp-2 hover:text-spotify-green transition-colors pointer-events-auto"
          onClick={stop}
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

// ---- Album list row --------------------------------------------------------

interface ChartListRowProps {
  album: ChartAlbum;
  rank: number;
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onAddClick: () => void;
  showRank?: boolean;
}

export function ChartListRow({ album, rank, selected, onToggleSelect, onAddClick, showRank = true }: ChartListRowProps) {
  const imageUrl = album.images?.[0]?.url ?? null;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      className={clsx(
        'group/row flex items-stretch rounded-xl border transition-colors duration-150 overflow-hidden',
        selected ? 'border-spotify-green/50 bg-zinc-800/80' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700',
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0 pl-3 pr-2 py-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={selected ? `Deselect ${album.album_name}` : `Select ${album.album_name}`}
          onClick={(e) => {
            stop(e);
            onToggleSelect(!selected);
          }}
          className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spotify-green focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <SelectionMark selected={selected} />
        </button>

        {showRank && (
          <div className="text-zinc-500 text-xs font-mono w-8 shrink-0 text-right tabular-nums">#{rank}</div>
        )}

        <a
          href={album.lastfm_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-zinc-800 block ring-1 ring-white/10"
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-lg">♪</div>
          )}
        </a>

        <div className="flex-1 min-w-0">
          <a
            href={album.lastfm_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-medium text-sm hover:text-spotify-green transition-colors line-clamp-2"
          >
            {album.album_name}
          </a>
          <p className="text-zinc-500 text-xs truncate mt-0.5">{album.artist_name}</p>
        </div>

        {album.lastfm_listeners > 0 && (
          <p className="hidden sm:block text-zinc-500 text-xs shrink-0 w-[4.5rem] text-right">
            {formatNumber(album.lastfm_listeners)}
            <span className="text-zinc-600 block text-[10px] uppercase tracking-wide">listeners</span>
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 pr-3 pl-1 border-l border-zinc-800/80 bg-zinc-950/40">
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            onAddClick();
          }}
          className="p-2 rounded-lg bg-zinc-800 hover:bg-spotify-green text-zinc-300 hover:text-black transition-colors border border-zinc-700 hover:border-spotify-green"
          aria-label={`Add ${album.album_name} to list`}
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
