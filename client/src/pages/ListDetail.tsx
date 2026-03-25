import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { getList, updateList, deleteList, reorderAlbums } from '../api/client';
import AlbumCard from '../components/AlbumCard';
import AlbumSearch from '../components/AlbumSearch';
import ImportModal from '../components/ImportModal';
import AlbumDetailModal from '../components/AlbumDetailModal';
import ShufflePicker from '../components/ShufflePicker';
import type { ListAlbum } from '../types';

export default function ListDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [localAlbums, setLocalAlbums] = useState<ListAlbum[] | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [shuffleOpen, setShuffleOpen] = useState(false);
  const [shuffleDetailAlbum, setShuffleDetailAlbum] = useState<ListAlbum | null>(null);

  const { data: list, isLoading, isError } = useQuery({
    queryKey: ['list', id],
    queryFn: () => getList(id!),
    enabled: !!id,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateMutation = useMutation({
    mutationFn: (data: Partial<{ title: string; description: string; is_public: boolean }>) =>
      updateList(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', id] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteList(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      navigate('/dashboard');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (albumIds: string[]) => reorderAlbums(id!, albumIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', id] });
    },
  });

  const handleStartEdit = () => {
    if (!list) return;
    setEditTitle(list.title);
    setEditDescription(list.description ?? '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({ title: editTitle.trim(), description: editDescription.trim() });
  };

  const handleTogglePublic = () => {
    if (!list) return;
    updateMutation.mutate({ is_public: !list.is_public });
  };

  const handleCopyLink = () => {
    if (!list?.slug) return;
    const url = `${window.location.origin}/shared/${list.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const albums = localAlbums ?? list?.albums ?? [];
    const oldIndex = albums.findIndex((a) => a.spotify_album_id === active.id);
    const newIndex = albums.findIndex((a) => a.spotify_album_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...albums];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setLocalAlbums(reordered);
    reorderMutation.mutate(reordered.map((a) => a.spotify_album_id));
  };

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
        <p className="text-zinc-400 mb-4">List not found or you don't have access.</p>
        <button onClick={() => navigate('/dashboard')} className="text-spotify-green hover:text-green-400 text-sm transition-colors">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const albums = localAlbums ?? list.albums ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-4 transition-colors"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden="true">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          All Lists
        </button>

        {isEditing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 focus:border-spotify-green rounded-xl px-4 py-2.5 text-white text-2xl font-bold outline-none w-full max-w-xl transition-colors"
              autoFocus
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="bg-zinc-800 border border-zinc-700 focus:border-spotify-green rounded-xl px-4 py-2.5 text-zinc-300 text-sm outline-none w-full max-w-xl resize-none transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={!editTitle.trim() || updateMutation.isPending}
                className="bg-spotify-green hover:bg-green-400 disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-full text-sm transition-colors"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium px-4 py-2 rounded-full text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{list.title}</h1>
                {list.description && (
                  <p className="text-zinc-400 mt-1 text-sm leading-relaxed">{list.description}</p>
                )}
                <p className="text-zinc-600 text-sm mt-2">
                  {albums.length} album{albums.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {/* Edit title */}
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full transition-colors"
              >
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </button>

              {/* Public toggle */}
              <button
                onClick={handleTogglePublic}
                disabled={updateMutation.isPending}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-colors ${
                  list.is_public
                    ? 'text-spotify-green bg-spotify-green/10 border border-spotify-green/30 hover:bg-spotify-green/20'
                    : 'text-zinc-400 bg-zinc-800 hover:bg-zinc-700'
                }`}
              >
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                  {list.is_public ? (
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z" />
                  ) : (
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  )}
                </svg>
                {list.is_public ? 'Public' : 'Private'}
              </button>

              {/* Copy share link */}
              {list.is_public && list.slug && (
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full transition-colors"
                >
                  <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                    <path d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" />
                  </svg>
                  {copiedLink ? 'Copied!' : 'Copy Link'}
                </button>
              )}

              {/* Import */}
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full transition-colors"
              >
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Import
              </button>

              {/* Delete */}
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-red-400 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full transition-colors ml-auto"
                >
                  <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-zinc-400">Delete this list?</span>
                  <button
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                    className="text-sm text-red-400 hover:text-red-300 font-semibold transition-colors"
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="text-sm text-zinc-500 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Albums */}
      <div className="mb-8">
        <AlbumSearch listId={id!} />
      </div>

      {/* Album grid */}
      {albums.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={albums.map((a) => a.spotify_album_id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {albums.map((album) => (
                <AlbumCard
                  key={album.spotify_album_id}
                  album={album}
                  listId={id!}
                  editable
                  sortable
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl">
          <div className="text-4xl mb-3">💿</div>
          <p className="text-zinc-400 font-medium">No albums yet</p>
          <p className="text-zinc-600 text-sm mt-1">Search above to add your first album.</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShuffleOpen(true)}
        disabled={albums.length === 0}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-spotify-green text-black shadow-lg shadow-black/40 hover:bg-green-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
        aria-label="Shuffle album pick"
        title="Shuffle pick"
      >
        <svg viewBox="0 0 20 20" className="w-6 h-6 fill-current" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M2.75 5.5a.75.75 0 01.75-.75h2.69l1.97-1.97a.75.75 0 111.06 1.06L7.44 5.5h2.31a.75.75 0 010 1.5H6.56l-.97.97a.75.75 0 01-1.06-1.06l.44-.44H3.5a.75.75 0 01-.75-.75zm0 9a.75.75 0 01.75-.75h1.94l4.22-4.22a.75.75 0 111.06 1.06L7.56 14.5h2.69a.75.75 0 010 1.5H6.44l-1.97 1.97a.75.75 0 11-1.06-1.06l1.47-1.47H3.5a.75.75 0 01-.75-.75zm12.5-4.5a.75.75 0 00-.75-.75h-2.69l-1.22-1.22a.75.75 0 10-1.06 1.06l.66.66H8.5a.75.75 0 000 1.5h2.31l1.97 1.97a.75.75 0 101.06-1.06l-1.47-1.47h2.19a.75.75 0 00.75-.75zm-1.28 6.78a.75.75 0 10-1.06-1.06l1.97-1.97h-2.19a.75.75 0 000-1.5h2.69l.97-.97a.75.75 0 111.06 1.06L15.5 16.5h2.19a.75.75 0 010 1.5h-2.69l-1.97 1.97z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {showImportModal && (
        <ImportModal
          defaultListId={id}
          onClose={() => {
            setShowImportModal(false);
            queryClient.invalidateQueries({ queryKey: ['list', id] });
          }}
        />
      )}

      <ShufflePicker
        albums={albums}
        open={shuffleOpen}
        onClose={() => setShuffleOpen(false)}
        onComplete={(a) => {
          setShuffleOpen(false);
          setShuffleDetailAlbum(a);
        }}
      />

      {shuffleDetailAlbum && (
        <AlbumDetailModal
          album={shuffleDetailAlbum}
          listId={id!}
          editable
          onClose={() => setShuffleDetailAlbum(null)}
        />
      )}
    </div>
  );
}
