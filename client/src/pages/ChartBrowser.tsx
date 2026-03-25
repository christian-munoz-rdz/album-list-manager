import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChartAlbums, getLists } from '../api/client';
import type { ChartAlbum, List } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

// ---- Album grid card -------------------------------------------------------

interface ChartCardProps {
  album: ChartAlbum;
  rank: number;
}

function ChartCard({ album, rank }: ChartCardProps) {
  const imageUrl = album.images?.[0]?.url ?? null;

  return (
    <a
      href={album.lastfm_url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl overflow-hidden transition-all duration-150 group flex flex-col"
    >
      {/* Rank badge */}
      <div className="absolute top-2 left-2 z-10 bg-black/70 text-zinc-300 text-xs font-bold px-2 py-0.5 rounded-full">
        #{rank}
      </div>

      {/* Cover */}
      <div className="relative aspect-square overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={album.album_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-4xl text-zinc-700">♪</div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-spotify-green transition-colors">
          {album.album_name}
        </p>
        <p className="text-zinc-500 text-xs truncate">{album.artist_name}</p>
        {album.lastfm_listeners > 0 && (
          <p className="text-zinc-600 text-xs mt-auto pt-1">
            <span className="text-zinc-500">{formatNumber(album.lastfm_listeners)}</span> listeners
          </p>
        )}
      </div>
    </a>
  );
}

// ---- Add-to-list modal (kept for future Spotify integration) ---------------
// Currently unused since all albums are Last.fm-only (no spotify_album_id)
// but the modal infrastructure stays in case the user wants to manually add.

interface AddToListModalProps {
  onClose: () => void;
}

function NoSpotifyModal({ onClose }: AddToListModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4">
        <p className="text-white font-semibold text-base">Last.fm only mode</p>
        <p className="text-zinc-400 text-sm">
          This chart is sourced purely from Last.fm and does not have Spotify IDs, so albums
          cannot be added to your lists yet. Click any album to open it on Last.fm.
        </p>
        <button
          onClick={onClose}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-5 py-2 rounded-lg text-sm transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// ---- Existing-list picker modal --------------------------------------------

interface PickListModalProps {
  count: number;
  lists: List[];
  onClose: () => void;
}

function PickListModal({ count, lists, onClose }: PickListModalProps) {
  const titleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div ref={titleRef} className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-800">
          <h2 className="text-white font-semibold text-lg">Add {count} album{count !== 1 ? 's' : ''}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors rounded-lg p-1 hover:bg-zinc-800" aria-label="Close">
            <svg viewBox="0 0 20 20" className="w-5 h-5 fill-current" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-zinc-400 text-sm mb-4">
            These albums are from Last.fm only and don't have Spotify IDs — they can't be added to your lists directly. Open them on Last.fm to find them on Spotify.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main page -------------------------------------------------------------

export default function ChartBrowser() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tag, setTag] = useState('');
  const [limit, setLimit] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [submittedParams, setSubmittedParams] = useState<{ tag: string; limit: number } | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  const { data, isFetching, error, isSuccess } = useQuery({
    queryKey: ['charts', submittedParams, currentPage],
    queryFn: () => getChartAlbums(submittedParams!.tag, submittedParams!.limit, currentPage),
    enabled: !!submittedParams,
    staleTime: 5 * 60 * 1000,
  });

  const { data: _lists = [] } = useQuery({
    queryKey: ['lists'],
    queryFn: getLists,
    enabled: !!user,
  });

  // suppress unused-variable warning — kept for future Spotify mode
  void queryClient;
  void useMutation;

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
        <h1 className="text-2xl font-bold text-white">Chart Browser</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Top albums by Last.fm tag, ordered by community ranking
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
          {/* Results header */}
          <div className="flex items-center justify-between">
            <p className="text-zinc-400 text-sm">
              Top{' '}
              <span className="text-spotify-green font-medium">{submittedParams?.tag}</span>{' '}
              albums on Last.fm
              {totalPages > 1 && (
                <span className="text-zinc-600 ml-1">· page {currentPage} of {totalPages}</span>
              )}
            </p>
            <button
              onClick={() => setShowInfoModal(true)}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              About this chart
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map((album, idx) => (
              <ChartCard
                key={`${album.artist_name}-${album.album_name}-${idx}`}
                album={album}
                rank={rankOffset + idx + 1}
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
              <span className="text-zinc-500 text-sm">
                {currentPage} / {totalPages}
              </span>
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

      {/* Info modal */}
      {showInfoModal && <NoSpotifyModal onClose={() => setShowInfoModal(false)} />}
    </div>
  );
}
