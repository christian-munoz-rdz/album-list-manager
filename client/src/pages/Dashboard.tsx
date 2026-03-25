import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLists } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import ListCard from '../components/ListCard';
import CreateListModal from '../components/CreateListModal';
import ImportModal from '../components/ImportModal';

export default function Dashboard() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const { data: lists, isLoading, isError } = useQuery({
    queryKey: ['lists'],
    queryFn: getLists,
  });

  const totalAlbums = lists?.reduce((sum, l) => sum + (l.album_count ?? 0), 0) ?? 0;
  const publicLists = lists?.filter((l) => l.is_public).length ?? 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {user?.display_name ? `${user.display_name}'s Lists` : 'My Lists'}
          </h1>
          {!isLoading && lists && lists.length > 0 && (
            <p className="text-zinc-500 text-sm mt-1">
              {lists.length} list{lists.length !== 1 ? 's' : ''} · {totalAlbums} album{totalAlbums !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-4 py-2.5 rounded-full text-sm transition-colors"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden="true">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Import
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-spotify-green hover:bg-green-400 text-black font-semibold px-4 py-2.5 rounded-full text-sm transition-colors"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden="true">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New List
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {!isLoading && lists && lists.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Lists" value={lists.length} />
          <StatCard label="Total Albums" value={totalAlbums} />
          <StatCard label="Public Lists" value={publicLists} />
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 animate-pulse">
              <div className="flex justify-between mb-3">
                <div className="h-5 bg-zinc-800 rounded w-2/3" />
                <div className="h-5 bg-zinc-800 rounded w-16" />
              </div>
              <div className="h-4 bg-zinc-800 rounded w-full mb-2" />
              <div className="h-4 bg-zinc-800 rounded w-3/4 mb-4" />
              <div className="border-t border-zinc-800 pt-3 flex justify-between">
                <div className="h-4 bg-zinc-800 rounded w-20" />
                <div className="h-4 bg-zinc-800 rounded w-14" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="text-center py-20">
          <p className="text-zinc-400">Failed to load your lists. Please refresh the page.</p>
        </div>
      )}

      {/* Lists grid */}
      {!isLoading && !isError && lists && lists.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && lists && lists.length === 0 && (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">🎵</div>
          <h2 className="text-white font-semibold text-xl mb-2">No lists yet</h2>
          <p className="text-zinc-500 mb-6">Create your first list to start curating albums.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-spotify-green hover:bg-green-400 text-black font-semibold px-6 py-3 rounded-full text-sm transition-colors"
          >
            Create your first list
          </button>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && <CreateListModal onClose={() => setShowCreateModal(false)} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
      <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  );
}
