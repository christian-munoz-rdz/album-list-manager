import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchAlbums, addAlbum } from '../api/client';
import type { SpotifySearchResult } from '../types';

interface AlbumSearchProps {
  listId: string;
}

export default function AlbumSearch({ listId }: AlbumSearchProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching } = useQuery({
    queryKey: ['album-search', debouncedQuery],
    queryFn: () => searchAlbums(debouncedQuery),
    enabled: debouncedQuery.trim().length > 1,
    staleTime: 30 * 1000,
  });

  const addMutation = useMutation({
    mutationFn: (album: SpotifySearchResult) => addAlbum(listId, album.id),
    onSuccess: (_data, album) => {
      setAddedIds((prev) => new Set(prev).add(album.id));
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const getImageUrl = (album: SpotifySearchResult) =>
    album.images?.find((img) => img.width <= 300)?.url ?? album.images?.[0]?.url ?? null;

  const getReleaseYear = (album: SpotifySearchResult) =>
    album.release_date ? album.release_date.split('-')[0] : null;

  const showResults = debouncedQuery.trim().length > 1;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h3 className="text-white font-semibold mb-3">Add Albums</h3>

      {/* Input */}
      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 fill-current text-zinc-500 pointer-events-none"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for an album or artist…"
          className="w-full bg-zinc-800 border border-zinc-700 focus:border-spotify-green focus:ring-1 focus:ring-spotify-green rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-zinc-600 outline-none transition-colors text-sm"
        />
        {isFetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {query && !isFetching && (
          <button
            onClick={() => { setQuery(''); setDebouncedQuery(''); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* Results */}
      {showResults && (
        <div className="mt-3 space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
          {results && results.length === 0 && !isFetching && (
            <p className="text-zinc-500 text-sm text-center py-6">No albums found for "{debouncedQuery}"</p>
          )}
          {results?.map((album) => {
            const imageUrl = getImageUrl(album);
            const year = getReleaseYear(album);
            const isAdded = addedIds.has(album.id);
            const isAdding = addMutation.isPending && addMutation.variables?.id === album.id;

            return (
              <div
                key={album.id}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                {/* Art */}
                <div className="w-10 h-10 rounded-md bg-zinc-800 overflow-hidden shrink-0">
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-lg">♪</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{album.name}</p>
                  <p className="text-zinc-500 text-xs truncate">
                    {album.artists.map((a) => a.name).join(', ')}
                    {year && <span className="text-zinc-600"> · {year}</span>}
                  </p>
                </div>

                {/* Add button */}
                <button
                  onClick={() => !isAdded && addMutation.mutate(album)}
                  disabled={isAdded || isAdding}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    isAdded
                      ? 'bg-zinc-700 text-zinc-500 cursor-default'
                      : 'bg-spotify-green hover:bg-green-400 text-black'
                  }`}
                >
                  {isAdded ? 'Added' : isAdding ? '…' : 'Add'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
