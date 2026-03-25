import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSharedList } from '../api/client';
import AlbumCard from '../components/AlbumCard';

export default function SharedList() {
  const { slug } = useParams<{ slug: string }>();

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
        <Link to="/" className="text-spotify-green hover:text-green-400 text-sm transition-colors">
          Go home
        </Link>
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
