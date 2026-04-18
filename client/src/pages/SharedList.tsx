import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSharedList } from '../api/client';
import AlbumCard from '../components/AlbumCard';
import { useAuth } from '../contexts/AuthContext';
import { downloadListAsCsv, downloadListAsJson } from '../utils/exportList';

export default function SharedList() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isLoading: authLoading } = useAuth();

  const { data: list, isLoading, isError } = useQuery({
    queryKey: ['sharedList', slug],
    queryFn: () => getSharedList(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-800 rounded w-64" />
          <div className="h-4 bg-zinc-800 rounded w-96" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-zinc-900 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !list) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <p className="text-zinc-400 mb-4">This list is not available or is not public.</p>
        {authLoading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : user ? (
          <Link to="/dashboard" className="text-spotify-green hover:text-green-400 text-sm font-medium transition-colors">
            Back to your lists
          </Link>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center items-center text-sm">
            <Link to="/login" className="text-spotify-green hover:text-green-400 font-medium transition-colors">
              Sign in
            </Link>
            <span className="text-zinc-600 hidden sm:inline">·</span>
            <Link to="/register" className="text-zinc-400 hover:text-white transition-colors">
              Create an account
            </Link>
          </div>
        )}
      </div>
    );
  }

  const albums = list.albums ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{list.title}</h1>
        {list.description && (
          <p className="text-zinc-400 mt-1 text-sm leading-relaxed">{list.description}</p>
        )}
        <p className="text-zinc-600 text-sm mt-2">
          {albums.length} album{albums.length !== 1 ? 's' : ''}
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => downloadListAsJson(list, albums)}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full transition-colors"
            title="Download list as JSON"
          >
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 2.75a.75.75 0 01.75.75v8.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V3.5a.75.75 0 01.75-.75zM3.75 16a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H3.75z"
                clipRule="evenodd"
              />
            </svg>
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => downloadListAsCsv(list, albums)}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full transition-colors"
            title="Download list as CSV"
          >
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 2.75a.75.75 0 01.75.75v8.69l2.22-2.22a.75.75 0 111.06 1.06l-3.5 3.5a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 111.06-1.06l2.22 2.22V3.5a.75.75 0 01.75-.75zM3.75 16a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H3.75z"
                clipRule="evenodd"
              />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {albums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {albums.map((album) => (
            <AlbumCard
              key={album.album_id}
              album={album}
              listId={list.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl">
          <p className="text-zinc-400 font-medium">No albums in this list yet.</p>
        </div>
      )}
    </div>
  );
}
