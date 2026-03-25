import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlbumDetails, updateNote, updateRating } from '../api/client';
import type { ListAlbum } from '../types';
import StarRating from './StarRating';

interface AlbumDetailModalProps {
  album: ListAlbum;
  listId: string;
  editable?: boolean;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function AlbumDetailModal({ album, listId, editable = false, onClose }: AlbumDetailModalProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(album.user_note ?? '');
  const [rating, setRating] = useState(Number(album.rating) || 0);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Stop audio on unmount
  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  useEffect(() => {
    setNote(album.user_note ?? '');
    setRating(Number(album.rating) || 0);
  }, [album.album_id, album.user_note, album.rating]);

  const { data: details } = useQuery({
    queryKey: ['album-details', album.album_id],
    queryFn: () => getAlbumDetails(album.album_id),
    staleTime: 10 * 60 * 1000,
  });

  const noteMutation = useMutation({
    mutationFn: (newNote: string) => updateNote(listId, album.album_id, newNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const ratingMutation = useMutation({
    mutationFn: (r: number) => updateRating(listId, album.album_id, r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const handleNoteBlur = () => {
    if (editable && note !== (album.user_note ?? '')) {
      noteMutation.mutate(note);
    }
  };

  const toggleTrack = (trackId: string, previewUrl: string) => {
    if (playingTrackId === trackId) {
      audioRef.current?.pause();
      setPlayingTrackId(null);
    } else {
      audioRef.current?.pause();
      const audio = new Audio(previewUrl);
      audio.volume = 0.6;
      audio.play();
      audio.onended = () => setPlayingTrackId(null);
      audioRef.current = audio;
      setPlayingTrackId(trackId);
    }
  };

  const displayData = details ?? album;
  const imageUrl = displayData.images?.[0]?.url ?? displayData.image_url ?? null;
  const tags = (details?.lastfm_tags ?? album.lastfm_tags ?? []).slice(0, 6);
  const topTracks = details?.top_tracks ?? album.top_tracks ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:pt-12 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl shadow-2xl mb-8">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-zinc-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
          aria-label="Close"
        >
          <svg viewBox="0 0 20 20" className="w-5 h-5 fill-current" aria-hidden="true">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex gap-5 p-6 pb-4">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={displayData.album_name}
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-xl object-cover shadow-lg shrink-0"
            />
          )}
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-white font-bold text-xl leading-snug mb-1 pr-8">{displayData.album_name}</h2>
            <p className="text-zinc-400 text-sm font-medium mb-1">{displayData.artist_name}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-zinc-500 text-xs mt-2">
              {displayData.release_year && <span>{displayData.release_year}</span>}
              {displayData.total_tracks && <span>{displayData.total_tracks} tracks</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wide">Your rating</span>
              <StarRating
                value={rating}
                onChange={(r) => {
                  setRating(r);
                  ratingMutation.mutate(r);
                }}
                readOnly={!editable}
                size="md"
              />
              {ratingMutation.isPending && <span className="text-xs text-zinc-600">Saving…</span>}
            </div>
            {displayData.external_urls?.lastfm && (
              <a
                href={displayData.external_urls.lastfm}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-spotify-green hover:text-green-400 text-xs font-medium transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Open on Last.fm
              </a>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-2">Genres / Tags</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag.name} className="text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-1 rounded-full">
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last.fm stats */}
          {(details?.lastfm_listeners || details?.lastfm_playcount) && (
            <div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-2">Last.fm</p>
              <div className="flex gap-4">
                {details.lastfm_listeners && (
                  <div>
                    <p className="text-white font-semibold text-sm">{formatNumber(details.lastfm_listeners)}</p>
                    <p className="text-zinc-600 text-xs">Listeners</p>
                  </div>
                )}
                {details.lastfm_playcount && (
                  <div>
                    <p className="text-white font-semibold text-sm">{formatNumber(details.lastfm_playcount)}</p>
                    <p className="text-zinc-600 text-xs">Plays</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Top tracks */}
          {topTracks.length > 0 && (
            <div>
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-2">Top Tracks</p>
              <ul className="space-y-1">
                {topTracks.slice(0, 8).map((track, i) => (
                  <li key={track.id} className="flex items-center gap-3 py-1.5 rounded-lg hover:bg-zinc-800 px-2 -mx-2 transition-colors group">
                    {track.preview_url ? (
                      <button
                        onClick={() => toggleTrack(track.id, track.preview_url!)}
                        className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-spotify-green transition-colors shrink-0"
                        aria-label={playingTrackId === track.id ? 'Pause' : 'Play preview'}
                      >
                        {playingTrackId === track.id ? (
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-spotify-green" aria-hidden="true">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden="true">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ) : (
                      <span className="w-6 text-center text-zinc-700 text-xs shrink-0">{i + 1}</span>
                    )}
                    <span className="flex-1 text-sm text-zinc-300 truncate">{track.name}</span>
                    <span className="text-zinc-600 text-xs shrink-0">{formatDuration(track.duration_ms)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Note */}
          <div>
            <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-2">
              {editable ? 'Your Note' : 'Note'}
            </p>
            {editable ? (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={handleNoteBlur}
                placeholder="Add a personal note about this album…"
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-spotify-green focus:ring-1 focus:ring-spotify-green rounded-lg px-3 py-2 text-white placeholder-zinc-600 outline-none transition-colors text-sm resize-none"
              />
            ) : (
              <p className="text-zinc-400 text-sm">
                {album.user_note ?? <span className="text-zinc-600 italic">No note</span>}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
