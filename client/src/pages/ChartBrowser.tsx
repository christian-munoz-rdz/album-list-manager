import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getChartAlbums, getLists } from '../api/client';
import type { ChartAlbum } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  AddToListModal,
  BulkAddToListModal,
  ChartCard,
  ChartListRow,
  chartAlbumKey,
} from '../components/chart/ChartAlbumUI';

/** Larger pool; 30 are picked at random when the page loads. */
const DISCOVERY_TAG_POOL = [
  'shoegaze',
  'jazz',
  'ambient',
  'electronic',
  'indie',
  'hip-hop',
  'metal',
  'punk',
  'soul',
  'funk',
  'blues',
  'classical',
  'folk',
  'reggae',
  'dub',
  'techno',
  'house',
  'drum and bass',
  'vaporwave',
  'post-rock',
  'black metal',
  'hardcore',
  'emo',
  'rnb',
  'synthpop',
  'alternative',
  'experimental',
  'post-punk',
  'trip hop',
  'downtempo',
  'lo-fi',
  'chillout',
  'krautrock',
  'prog rock',
  'math rock',
  'garage rock',
  'britpop',
  'grunge',
  'new wave',
  'disco',
  'gospel',
  'latin',
  'afrobeat',
  'soundtrack',
  'industrial',
  'ska',
  'world',
  'noise',
  'singer-songwriter',
] as const;

const DISCOVERY_TAG_COUNT = 30;

function shuffleTags<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function ChartBrowser() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tag, setTag] = useState('');
  const [discoveryTags] = useState(() => shuffleTags(DISCOVERY_TAG_POOL).slice(0, DISCOVERY_TAG_COUNT));
  const [limit, setLimit] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [submittedParams, setSubmittedParams] = useState<{ tag: string; limit: number } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());

  const [pendingAlbum, setPendingAlbum] = useState<ChartAlbum | null>(null);
  const [bulkAlbums, setBulkAlbums] = useState<ChartAlbum[] | null>(null);

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [submittedParams, currentPage]);

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

  const applyDiscoveryTag = (t: string) => {
    setTag(t);
    setCurrentPage(1);
    setSubmittedParams({ tag: t, limit });
  };

  const albums = data?.results ?? [];
  const totalPages = data?.totalPages ?? 1;
  const rankOffset = (currentPage - 1) * (submittedParams?.limit ?? limit);

  const selectedOnPage = useMemo(() => albums.filter((a) => selectedKeys.has(chartAlbumKey(a))), [albums, selectedKeys]);

  const allPageSelected = useMemo(() => {
    if (albums.length === 0) return false;
    return albums.every((a) => selectedKeys.has(chartAlbumKey(a)));
  }, [albums, selectedKeys]);

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
        for (const a of albums) next.delete(chartAlbumKey(a));
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const a of albums) next.add(chartAlbumKey(a));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedKeys(new Set());

  const selectedCount = selectedOnPage.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Charts</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Last.fm charts by tag · select albums in the grid or list, then add many to a list at once
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4"
      >
        <div className="flex flex-wrap gap-4 items-end">
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
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <p className="text-zinc-500 text-xs font-medium mb-2">Discover — tap a tag</p>
          <div className="flex flex-wrap gap-2">
            {discoveryTags.map((t) => {
              const active = submittedParams?.tag === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => applyDiscoveryTag(t)}
                  disabled={isFetching}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                    active
                      ? 'bg-spotify-green/20 border-spotify-green text-spotify-green'
                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white',
                    isFetching && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </form>

      {error && !isFetching && (
        <div className="text-center py-16">
          <p className="text-red-400 font-medium">Failed to load chart data.</p>
          <p className="text-zinc-500 text-sm mt-1">Check your Last.fm API key and try again.</p>
        </div>
      )}

      {isFetching && (
        <>
          {viewMode === 'grid' ? (
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
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl border border-zinc-800 animate-pulse">
                  <div className="w-9 h-9 bg-zinc-800 rounded-lg shrink-0" />
                  <div className="w-14 h-14 bg-zinc-800 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-zinc-800 rounded w-2/3" />
                    <div className="h-2.5 bg-zinc-800 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {isSuccess && !isFetching && albums.length === 0 && (
        <div className="text-center py-16">
          <p className="text-zinc-400 font-medium">No albums found for this tag.</p>
          <p className="text-zinc-600 text-sm mt-1">Try a different genre name.</p>
        </div>
      )}

      {isSuccess && !isFetching && albums.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-zinc-400 text-sm">
              Top <span className="text-spotify-green font-medium">{submittedParams?.tag}</span> albums on Last.fm
              {totalPages > 1 && (
                <span className="text-zinc-600 ml-1">
                  · page {currentPage} of {totalPages}
                </span>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-2">
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
              <span className="text-sm text-white font-medium">
                {selectedCount} selected
              </span>
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
              {albums.map((album, idx) => {
                const key = chartAlbumKey(album);
                return (
                  <ChartCard
                    key={key}
                    album={album}
                    rank={rankOffset + idx + 1}
                    selected={selectedKeys.has(key)}
                    onToggleSelect={(checked) => toggleSelect(album, checked)}
                    onAddClick={() => setPendingAlbum(album)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {albums.map((album, idx) => {
                const key = chartAlbumKey(album);
                return (
                  <ChartListRow
                    key={key}
                    album={album}
                    rank={rankOffset + idx + 1}
                    selected={selectedKeys.has(key)}
                    onToggleSelect={(checked) => toggleSelect(album, checked)}
                    onAddClick={() => setPendingAlbum(album)}
                  />
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isFetching}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-300 text-sm rounded-lg transition-colors"
              >
                ← Previous
              </button>
              <span className="text-zinc-500 text-sm">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
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
