import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeAlbum, updateNote, refreshAlbumCover } from '../api/client';
import type { ListAlbum } from '../types';
import AlbumDetailModal from './AlbumDetailModal';

interface AlbumCardProps {
  album: ListAlbum;
  listId: string;
  editable?: boolean;
  sortable?: boolean;
}

export default function AlbumCard({ album, listId, editable = false, sortable = false }: AlbumCardProps) {
  const queryClient = useQueryClient();
  const [showDetail, setShowDetail] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [note, setNote] = useState(album.user_note ?? '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: album.spotify_album_id, disabled: !sortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const removeMutation = useMutation({
    mutationFn: () => removeAlbum(listId, album.spotify_album_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: (newNote: string) => updateNote(listId, album.spotify_album_id, newNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
      setShowNoteEditor(false);
    },
  });

  const refreshCoverMutation = useMutation({
    mutationFn: () => refreshAlbumCover(listId, album.spotify_album_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const handleNoteSave = () => {
    noteMutation.mutate(note);
  };

  const handleNoteCancel = () => {
    setNote(album.user_note ?? '');
    setShowNoteEditor(false);
  };

  const imageUrl = album.images?.[0]?.url ?? album.image_url ?? null;
  const tags = (album.lastfm_tags ?? []).slice(0, 3);

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all duration-150 group flex flex-col"
      >
        {/* Album Art */}
        <div
          className="relative aspect-square cursor-pointer overflow-hidden"
          onClick={() => setShowDetail(true)}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={album.album_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="relative w-full h-full bg-zinc-800 flex flex-col items-center justify-center text-4xl text-zinc-700">
              <span aria-hidden="true">♪</span>
              {editable && (
                <>
                  {refreshCoverMutation.isError && (
                    <p className="absolute bottom-10 left-2 right-2 text-center text-[10px] text-red-400/90 leading-tight">
                      Could not load cover. Try again.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      refreshCoverMutation.mutate();
                    }}
                    disabled={refreshCoverMutation.isPending}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-zinc-950/90 text-spotify-green border border-spotify-green/40 hover:bg-spotify-green/10 disabled:opacity-50 transition-colors"
                  >
                    {refreshCoverMutation.isPending ? 'Loading…' : 'Retry cover'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Drag handle */}
          {sortable && (
            <div
              {...attributes}
              {...listeners}
              className="absolute top-2 left-2 bg-black/60 rounded-lg p-1.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-white" aria-hidden="true">
                <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 6zm0 6a2 2 0 10.001 4.001A2 2 0 007 12zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 4zm0 2a2 2 0 10.001 4.001A2 2 0 0013 6zm0 6a2 2 0 10.001 4.001A2 2 0 0013 12z" />
              </svg>
            </div>
          )}

          {/* Remove button */}
          {editable && (
            <button
              onClick={(e) => { e.stopPropagation(); removeMutation.mutate(); }}
              disabled={removeMutation.isPending}
              className="absolute top-2 right-2 bg-black/60 hover:bg-red-500/80 rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition-all"
              aria-label="Remove album"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-white" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* Card Body */}
        <div className="p-3 flex flex-col gap-1 flex-1">
          {/* Title / artist */}
          <button
            className="text-left"
            onClick={() => setShowDetail(true)}
          >
            <p className="text-white font-semibold text-sm leading-snug line-clamp-2 hover:text-spotify-green transition-colors">
              {album.album_name}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5 truncate">
              {album.artist_name}
              {album.release_year && <span className="text-zinc-600"> · {album.release_year}</span>}
            </p>
          </button>

          {/* Genre tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.map((tag) => (
                <span key={tag.name} className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Note row */}
          {editable && (
            <div className="mt-auto pt-2">
              {showNoteEditor ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Add a note…"
                    autoFocus
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-spotify-green rounded-lg px-2.5 py-1.5 text-white placeholder-zinc-600 outline-none text-xs resize-none"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleNoteSave}
                      disabled={noteMutation.isPending}
                      className="flex-1 bg-spotify-green hover:bg-green-400 disabled:opacity-50 text-black text-xs font-semibold py-1 rounded-lg transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleNoteCancel}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium py-1 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowNoteEditor(true); }}
                  className="w-full flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
                >
                  <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current shrink-0" aria-hidden="true">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span className="truncate">
                    {album.user_note ? album.user_note : 'Add note'}
                  </span>
                  {album.user_note && (
                    <span className="ml-auto shrink-0 w-1.5 h-1.5 bg-spotify-green rounded-full" />
                  )}
                </button>
              )}
            </div>
          )}

          {/* Read-only note indicator */}
          {!editable && album.user_note && (
            <p className="text-zinc-600 text-xs mt-1 line-clamp-2 italic">"{album.user_note}"</p>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <AlbumDetailModal
          album={album}
          listId={listId}
          editable={editable}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}
