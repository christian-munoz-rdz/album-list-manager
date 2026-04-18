import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAlbumDetails, getAlbumLastFmPage, getList, updateNote, updateRating } from '../api/client';
import type { ListAlbum } from '../types';
import StarRating from '../components/StarRating';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatLfmTrackDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function AlbumPage() {
  const { listId, albumId } = useParams<{ listId: string; albumId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [note, setNote] = useState('');
  const [rating, setRating] = useState(0);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [wikiExpanded, setWikiExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: list, isLoading: listLoading, isError: listError } = useQuery({
    queryKey: ['list', listId],
    queryFn: () => getList(listId!),
    enabled: !!listId,
  });

  const listAlbum: ListAlbum | undefined = list?.albums?.find((a) => a.album_id === albumId);

  const { data: details } = useQuery({
    queryKey: ['album-details', albumId],
    queryFn: () => getAlbumDetails(albumId!),
    enabled: !!albumId,
  });

  const { data: lastfm, isLoading: lastfmLoading } = useQuery({
    queryKey: ['album-lastfm-page', albumId],
    queryFn: () => getAlbumLastFmPage(albumId!),
    enabled: !!albumId,
    staleTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (listAlbum) {
      setNote(listAlbum.user_note ?? '');
      setRating(Number(listAlbum.rating) || 0);
    }
  }, [listAlbum?.album_id, listAlbum?.user_note, listAlbum?.rating]);

  const noteMutation = useMutation({
    mutationFn: (newNote: string) => updateNote(listId!, albumId!, newNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

  const ratingMutation = useMutation({
    mutationFn: (r: number) => updateRating(listId!, albumId!, r),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    },
  });

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

  const handleNoteBlur = () => {
    if (listAlbum && note !== (listAlbum.user_note ?? '')) {
      noteMutation.mutate(note);
    }
  };

  const display = details ?? listAlbum;
  const imageUrl =
    display?.images?.[0]?.url ?? display?.image_url ?? lastfm?.image_url ?? null;

  const topTracks = details?.top_tracks ?? listAlbum?.top_tracks ?? [];
  const lfmTags = (lastfm?.tags?.length ? lastfm.tags : display?.lastfm_tags ?? []).slice(0, 12);

  const wikiShort = lastfm?.wiki_summary;
  const wikiLong = lastfm?.wiki_content;
  const showLongWiki =
    wikiExpanded && wikiLong && wikiLong.trim().length > 0 && wikiLong.trim() !== wikiShort?.trim();

  if (listLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 animate-pulse">
        <div className="h-6 bg-zinc-800 rounded w-40 mb-8" />
        <div className="flex gap-6">
          <div className="w-40 h-40 bg-zinc-800 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-8 bg-zinc-800 rounded w-2/3" />
            <div className="h-4 bg-zinc-800 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (listError || !list || !listId || !albumId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-zinc-400 mb-4">List not found or you don&apos;t have access.</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="text-spotify-green hover:text-green-400 text-sm transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!listAlbum || !display) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-zinc-400 mb-4">This album isn&apos;t on this list.</p>
        <button
          type="button"
          onClick={() => navigate(`/lists/${listId}`)}
          className="text-spotify-green hover:text-green-400 text-sm transition-colors"
        >
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 pb-24">
      <button
        type="button"
        onClick={() => navigate(`/lists/${listId}`)}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-8 transition-colors"
      >
        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
        {list.title}
      </button>

      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 mb-10">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={display.album_name}
            className="w-full max-w-[240px] sm:w-44 sm:h-44 mx-auto sm:mx-0 rounded-2xl object-cover shadow-xl shrink-0 aspect-square"
          />
        )}
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h1 className="text-white font-bold text-2xl sm:text-3xl leading-snug">{display.album_name}</h1>
          <p className="text-zinc-400 mt-2 font-medium">{display.artist_name}</p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-x-3 gap-y-1 text-zinc-500 text-sm mt-2">
            {display.release_year != null && <span>{display.release_year}</span>}
            {display.total_tracks != null && <span>{display.total_tracks} tracks</span>}
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-5">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wide">Your rating</span>
            <StarRating
              value={rating}
              onChange={(r) => {
                setRating(r);
                ratingMutation.mutate(r);
              }}
              size="md"
            />
            {ratingMutation.isPending && <span className="text-xs text-zinc-600">Saving…</span>}
          </div>
          <div className="mt-5 flex flex-wrap gap-3 justify-center sm:justify-start">
            {(lastfm?.lastfm_url || display.external_urls?.lastfm) && (
              <a
                href={lastfm?.lastfm_url ?? display.external_urls?.lastfm}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-spotify-green hover:text-green-400 text-sm font-medium transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Open on Last.fm
              </a>
            )}
            {display.external_urls?.spotify && (
              <a
                href={display.external_urls.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
              >
                Open on Spotify
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Last.fm stats */}
      {(lastfm?.listeners != null ||
        lastfm?.playcount != null ||
        details?.lastfm_listeners ||
        details?.lastfm_playcount) && (
        <section className="mb-8">
          <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-3">Last.fm</h2>
          <div className="flex gap-8">
            {(lastfm?.listeners ?? details?.lastfm_listeners) != null && (
              <div>
                <p className="text-white font-semibold text-lg">
                  {formatNumber((lastfm?.listeners ?? details?.lastfm_listeners)!)}
                </p>
                <p className="text-zinc-600 text-xs">Listeners</p>
              </div>
            )}
            {(lastfm?.playcount ?? details?.lastfm_playcount) != null && (
              <div>
                <p className="text-white font-semibold text-lg">
                  {formatNumber((lastfm?.playcount ?? details?.lastfm_playcount)!)}
                </p>
                <p className="text-zinc-600 text-xs">Scrobbles</p>
              </div>
            )}
          </div>
        </section>
      )}

      {lfmTags.length > 0 && (
        <section className="mb-8">
          <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-3">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {lfmTags.map((tag) => (
              <span
                key={tag.name}
                className="text-xs bg-zinc-800 text-zinc-300 border border-zinc-700 px-2.5 py-1 rounded-full"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Wiki from Last.fm */}
      <section className="mb-8">
        <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-3">About</h2>
        {lastfmLoading && <p className="text-zinc-500 text-sm">Loading Last.fm…</p>}
        {!lastfmLoading && wikiShort && (
          <div
            className="lastfm-wiki text-zinc-300 text-sm leading-relaxed [&_a]:text-spotify-green [&_a]:underline hover:[&_a]:text-green-400"
            dangerouslySetInnerHTML={{ __html: wikiShort }}
          />
        )}
        {!lastfmLoading && !wikiShort && !wikiLong && (
          <p className="text-zinc-500 text-sm">No Last.fm article for this album yet.</p>
        )}
        {!lastfmLoading && !wikiShort && wikiLong && (
          <div
            className="lastfm-wiki text-zinc-300 text-sm leading-relaxed [&_a]:text-spotify-green [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: wikiLong }}
          />
        )}
        {wikiLong && wikiLong.trim().length > 0 && wikiLong.trim() !== wikiShort?.trim() && wikiShort && (
          <>
            {showLongWiki && (
              <div
                className="lastfm-wiki mt-4 text-zinc-300 text-sm leading-relaxed [&_a]:text-spotify-green [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: wikiLong }}
              />
            )}
            <button
              type="button"
              onClick={() => setWikiExpanded((x) => !x)}
              className="mt-3 text-spotify-green hover:text-green-400 text-sm font-medium transition-colors"
            >
              {showLongWiki ? 'Show less' : 'Read full article'}
            </button>
          </>
        )}
      </section>

      {/* Tracklist (Last.fm) */}
      {(lastfm?.tracks?.length ?? 0) > 0 && (
        <section className="mb-8">
          <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-3">Tracklist</h2>
          <ul className="border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
            {lastfm!.tracks.map((t, i) => (
              <li key={`${t.rank}-${t.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5 bg-zinc-900/50">
                <span className="text-zinc-600 text-xs w-6 shrink-0 tabular-nums">{t.rank ?? i + 1}</span>
                {t.url ? (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-zinc-200 hover:text-spotify-green transition-colors truncate"
                  >
                    {t.name}
                  </a>
                ) : (
                  <span className="flex-1 text-sm text-zinc-200 truncate">{t.name}</span>
                )}
                <span className="text-zinc-600 text-xs shrink-0 tabular-nums">
                  {formatLfmTrackDuration(t.duration_sec)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topTracks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-2">Popular on Spotify</h2>
          <p className="text-zinc-600 text-xs mb-3">Preview clips when available.</p>
          <ul className="space-y-1">
            {topTracks.slice(0, 10).map((track, i) => (
              <li
                key={track.id}
                className="flex items-center gap-3 py-2 rounded-lg hover:bg-zinc-900 px-2 -mx-2 transition-colors"
              >
                {track.preview_url ? (
                  <button
                    type="button"
                    onClick={() => toggleTrack(track.id, track.preview_url!)}
                    className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-spotify-green transition-colors shrink-0"
                    aria-label={playingTrackId === track.id ? 'Pause' : 'Play preview'}
                  >
                    {playingTrackId === track.id ? (
                      <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current text-spotify-green" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ) : (
                  <span className="w-8 text-center text-zinc-700 text-xs shrink-0">{i + 1}</span>
                )}
                <span className="flex-1 text-sm text-zinc-300 truncate">{track.name}</span>
                <span className="text-zinc-600 text-xs shrink-0">{formatDuration(track.duration_ms)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-zinc-500 text-xs font-semibold uppercase tracking-wide mb-2">Your note</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={handleNoteBlur}
          placeholder="Add a personal note about this album…"
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-700 focus:border-spotify-green focus:ring-1 focus:ring-spotify-green rounded-lg px-3 py-2 text-white placeholder-zinc-600 outline-none transition-colors text-sm resize-none"
        />
        {noteMutation.isPending && <p className="text-xs text-zinc-600 mt-1">Saving…</p>}
      </section>
    </div>
  );
}
