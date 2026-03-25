import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteList } from '../api/client';
import type { List } from '../types';

interface ListCardProps {
  list: List;
}

export default function ListCard({ list }: ListCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteList(list.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.removeQueries({ queryKey: ['list', list.id] });
      setConfirmDelete(false);
    },
  });

  const updatedAt = new Date(list.updated_at);
  const now = new Date();
  const diffMs = now.getTime() - updatedAt.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let timeLabel: string;
  if (diffDays === 0) {
    timeLabel = 'Today';
  } else if (diffDays === 1) {
    timeLabel = 'Yesterday';
  } else if (diffDays < 7) {
    timeLabel = `${diffDays}d ago`;
  } else if (diffDays < 30) {
    timeLabel = `${Math.floor(diffDays / 7)}w ago`;
  } else {
    timeLabel = updatedAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  const rawThumbs = list.thumbnail_urls;
  const thumbnails: (string | null)[] = Array.isArray(rawThumbs)
    ? rawThumbs.slice(0, 5).map((u) => (typeof u === 'string' && u.trim() ? u : null))
    : [];

  /** Overlap as a fraction of each tile’s width; stack is sized to span 100% of the card. */
  const thumbOverlapFrac = 0.32;
  const nThumbs = thumbnails.length;
  const tileWpct =
    nThumbs > 0 ? 100 / (nThumbs - (nThumbs - 1) * thumbOverlapFrac) : 0;
  const stepPct = nThumbs > 0 ? tileWpct * (1 - thumbOverlapFrac) : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/lists/${list.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/lists/${list.id}`);
        }
      }}
      className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-600 hover:bg-zinc-800/60 transition-all duration-150 group cursor-pointer"
    >
      {/* Full-width fanned stack: tiles sized so left edge at 0% and right edge at 100% */}
      {thumbnails.length > 0 && (
        <div className="w-full overflow-hidden rounded-t-2xl bg-zinc-950/50">
          <div className="relative h-24 w-full sm:h-28">
            {thumbnails.map((src, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 overflow-hidden rounded-xl border-2 border-zinc-900 bg-zinc-800 shadow-md"
                style={{
                  zIndex: nThumbs - i,
                  left: `${i * stepPct}%`,
                  width: `${tileWpct}%`,
                }}
              >
                {src ? (
                  <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-zinc-600 text-sm sm:text-lg"
                    aria-hidden
                  >
                    ♪
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={`p-5 ${thumbnails.length > 0 ? 'pt-4' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-white font-semibold text-base leading-snug group-hover:text-spotify-green transition-colors line-clamp-2 flex-1 min-w-0">
          {list.title}
        </h3>
        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {!confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                aria-label={`Delete list ${list.title}`}
                title="Delete list"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                  list.is_public
                    ? 'text-spotify-green border-spotify-green/30 bg-spotify-green/10'
                    : 'text-zinc-500 border-zinc-700 bg-zinc-800'
                }`}
              >
                {list.is_public ? 'Public' : 'Private'}
              </span>
            </>
          ) : (
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-xs text-zinc-400 whitespace-nowrap">Delete this list?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? '…' : 'Delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {list.description && (
        <p className="text-zinc-500 text-sm leading-relaxed line-clamp-2 mb-3">
          {list.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
        <span className="flex items-center gap-1.5 text-zinc-400 text-sm">
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-zinc-600" aria-hidden="true">
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          <span>
            <span className="font-medium text-white">{list.album_count ?? 0}</span>
            {' '}
            album{(list.album_count ?? 0) !== 1 ? 's' : ''}
          </span>
        </span>
        <span className="text-zinc-600 text-xs">{timeLabel}</span>
      </div>
      </div>
    </div>
  );
}
