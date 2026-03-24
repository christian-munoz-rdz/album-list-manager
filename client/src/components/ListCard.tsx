import { useNavigate } from 'react-router-dom';
import type { List } from '../types';

interface ListCardProps {
  list: List;
}

export default function ListCard({ list }: ListCardProps) {
  const navigate = useNavigate();

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

  return (
    <button
      onClick={() => navigate(`/lists/${list.id}`)}
      className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-600 hover:bg-zinc-800/60 transition-all duration-150 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-white font-semibold text-base leading-snug group-hover:text-spotify-green transition-colors line-clamp-2 flex-1">
          {list.title}
        </h3>
        <span
          className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${
            list.is_public
              ? 'text-spotify-green border-spotify-green/30 bg-spotify-green/10'
              : 'text-zinc-500 border-zinc-700 bg-zinc-800'
          }`}
        >
          {list.is_public ? 'Public' : 'Private'}
        </span>
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
            {' '}album{(list.album_count ?? 0) !== 1 ? 's' : ''}
          </span>
        </span>
        <span className="text-zinc-600 text-xs">{timeLabel}</span>
      </div>
    </button>
  );
}
