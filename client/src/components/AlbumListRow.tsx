import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { removeAlbum, updateNote, refreshAlbumCover, updateRating, updateListened } from '../api/client';
import type { ListAlbum } from '../types';
import StarRating from './StarRating';
import ListenedToggle from './ListenedToggle';

interface AlbumListRowProps {
  album: ListAlbum;
  listId: string;
  editable?: boolean;
  sortable?: boolean;
}

export default function AlbumListRow({ album, listId, editable = false, sortable = false }: AlbumListRowProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [note, setNote] = useState(album.user_note ?? '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: album.album_id, disabled: !sortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const removeMutation = useMutation({
    mutationFn: () => removeAlbum(listId, album.album_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: (newNote: string) => updateNote(listId, album.album_id, newNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
      setShowNoteEditor(false);
    },
  });

  const refreshCoverMutation = useMutation({
    mutationFn: () => refreshAlbumCover(listId, album.album_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const ratingMutation = useMutation({
    mutationFn: (rating: number) => updateRating(listId, album.album_id, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const listenedMutation = useMutation({
    mutationFn: (listened: boolean) => updateListened(listId, album.album_id, listened),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const isListened = Boolean(album.listened_at);
  const imageUrl = album.images?.[0]?.url ?? album.image_url ?? null;
  const tags = (album.lastfm_tags ?? []).slice(0, 3);
  const ratingValue = Number(album.rating) || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'rounded-xl border overflow-hidden flex flex-col sm:flex-row sm:items-stretch transition-colors',
        isListened ? 'border-emerald-900/80 border-l-4 border-l-emerald-500/90 bg-zinc-900/90' : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700',
      )}
    >
      <div className="flex flex-1 min-w-0 gap-3 p-3">
        {sortable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="shrink-0 self-center cursor-grab active:cursor-grabbing rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            aria-label="Drag to reorder"
            onClick={(e) => e.preventDefault()}
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden>
              <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 6zm0 6a2 2 0 10.001 4.001A2 2 0 007 12zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 4zm0 2a2 2 0 10.001 4.001A2 2 0 0013 6zm0 6a2 2 0 10.001 4.001A2 2 0 0013 12z" />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate(`/lists/${listId}/albums/${album.album_id}`)}
          className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg overflow-hidden bg-zinc-800 ring-1 ring-white/10"
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-zinc-700">♪</div>
          )}
        </button>

        <div className="flex-1 min-w-0 text-left">
          <button
            type="button"
            className="text-left w-full"
            onClick={() => navigate(`/lists/${listId}/albums/${album.album_id}`)}
          >
            <p className="text-white font-semibold text-sm sm:text-base leading-snug line-clamp-2 hover:text-spotify-green">
              {album.album_name}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5 truncate">
              {album.artist_name}
              {album.release_year != null && <span className="text-zinc-600"> · {album.release_year}</span>}
            </p>
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <StarRating
              value={ratingValue}
              onChange={(r) => ratingMutation.mutate(r)}
              readOnly={!editable}
              size="sm"
            />
            {editable ? (
              <ListenedToggle
                className="ml-auto sm:ml-0"
                size="md"
                listened={isListened}
                disabled={listenedMutation.isPending}
                onChange={(next) => listenedMutation.mutate(next)}
              />
            ) : (
              isListened && (
                <span className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide">Listened</span>
              )
            )}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map((tag) => (
                <span key={tag.name} className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {editable && (
            <div className="mt-2">
              {showNoteEditor ? (
                <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Add a note…"
                    autoFocus
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-spotify-green rounded-lg px-2.5 py-1.5 text-white placeholder-zinc-600 outline-none text-xs resize-none max-w-lg"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => noteMutation.mutate(note)}
                      disabled={noteMutation.isPending}
                      className="bg-spotify-green hover:bg-green-400 disabled:opacity-50 text-black text-xs font-semibold py-1 px-3 rounded-lg"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNote(album.user_note ?? '');
                        setShowNoteEditor(false);
                      }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs py-1 px-3 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNoteEditor(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400"
                >
                  <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current shrink-0">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span className="truncate max-w-[220px] sm:max-w-md">
                    {album.user_note ? album.user_note : 'Add note'}
                  </span>
                </button>
              )}
            </div>
          )}

          {!editable && album.user_note && (
            <p className="text-zinc-600 text-xs mt-2 line-clamp-2 italic max-w-lg">"{album.user_note}"</p>
          )}
        </div>

        {editable && (
          <div className="flex sm:flex-col gap-2 shrink-0 self-end sm:self-start">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                refreshCoverMutation.mutate();
              }}
              disabled={refreshCoverMutation.isPending}
              className="text-[11px] font-medium px-2 py-1 rounded-lg border border-zinc-600 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-50"
            >
              {refreshCoverMutation.isPending ? '…' : 'Fix cover'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeMutation.mutate();
              }}
              disabled={removeMutation.isPending}
              className="text-[11px] font-medium px-2 py-1 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
