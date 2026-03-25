import { useEffect, useMemo, useRef, useState } from 'react';
import type { ListAlbum } from '../types';

interface ShufflePickerProps {
  albums: ListAlbum[];
  open: boolean;
  onClose: () => void;
  onComplete: (album: ListAlbum) => void;
}

function coverUrl(a: ListAlbum): string | null {
  return a.images?.[0]?.url ?? a.image_url ?? null;
}

export default function ShufflePicker({ albums, open, onClose, onComplete }: ShufflePickerProps) {
  const [displayIdx, setDisplayIdx] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>('idle');
  const winnerRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const albumsKey = useMemo(() => albums.map((a) => a.spotify_album_id).join('|'), [albums]);

  useEffect(() => {
    if (!open || albums.length === 0) {
      setPhase('idle');
      return;
    }

    cancelledRef.current = false;
    setPhase('spinning');
    const n = albums.length;
    winnerRef.current = Math.floor(Math.random() * n);
    let step = 0;
    const totalSteps = 28 + Math.floor(Math.random() * 14);

    const tick = () => {
      if (cancelledRef.current) return;
      step += 1;
      if (step < totalSteps) {
        setDisplayIdx(Math.floor(Math.random() * n));
        const delay = Math.min(24 + step * 9, 320);
        timeoutRef.current = setTimeout(tick, delay);
      } else {
        setDisplayIdx(winnerRef.current);
        setPhase('done');
      }
    };

    setDisplayIdx(Math.floor(Math.random() * n));
    timeoutRef.current = setTimeout(tick, 40);

    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [open, albums, albumsKey]);

  if (!open || albums.length === 0) return null;

  const current = albums[displayIdx]!;
  const n = albums.length;
  const prevIdx = (displayIdx - 1 + n) % n;
  const nextIdx = (displayIdx + 1) % n;
  const prev = albums[prevIdx]!;
  const next = albums[nextIdx]!;
  const img = (a: ListAlbum) => coverUrl(a);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shuffle-title"
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={phase === 'done' ? onClose : undefined} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900/95 p-6 shadow-2xl">
        <h2 id="shuffle-title" className="text-center text-lg font-bold text-white mb-1">
          {phase === 'done' ? 'Your pick' : 'Shuffling…'}
        </h2>
        <p className="text-center text-zinc-500 text-sm mb-6">
          {phase === 'spinning' ? 'Hang tight — choosing an album from your list.' : 'Ready when you are.'}
        </p>

        {/* Carousel strip */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6 perspective-[800px]">
          <div
            className={`w-[22%] max-w-[100px] aspect-square rounded-xl overflow-hidden border border-zinc-800 transition-all duration-150 ${
              phase === 'spinning' ? 'opacity-40 scale-90 blur-[1px]' : 'opacity-50 scale-95'
            }`}
          >
            {img(prev) ? (
              <img src={img(prev)!} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600 text-2xl">♪</div>
            )}
          </div>

          <div
            className={`relative w-[46%] max-w-[220px] aspect-square rounded-2xl overflow-hidden border-2 shadow-xl transition-all duration-100 ${
              phase === 'done'
                ? 'border-spotify-green scale-100 shadow-lg shadow-green-900/30'
                : 'border-amber-400/50 scale-100'
            } ${phase === 'spinning' ? 'animate-pulse' : ''}`}
          >
            {img(current) ? (
              <img src={img(current)!} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-5xl">♪</div>
            )}
            {phase === 'spinning' && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            )}
          </div>

          <div
            className={`w-[22%] max-w-[100px] aspect-square rounded-xl overflow-hidden border border-zinc-800 transition-all duration-150 ${
              phase === 'spinning' ? 'opacity-40 scale-90 blur-[1px]' : 'opacity-50 scale-95'
            }`}
          >
            {img(next) ? (
              <img src={img(next)!} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600 text-2xl">♪</div>
            )}
          </div>
        </div>

        <div className="text-center min-h-[3.5rem]">
          <p className="text-white font-semibold text-base leading-snug line-clamp-2">{current.album_name}</p>
          <p className="text-zinc-400 text-sm mt-1 truncate">{current.artist_name}</p>
        </div>

        {phase === 'done' && (
          <div className="flex flex-col sm:flex-row gap-2 mt-6 justify-center">
            <button
              type="button"
              onClick={() => onComplete(current)}
              className="bg-spotify-green hover:bg-green-400 text-black font-semibold px-5 py-2.5 rounded-full text-sm transition-colors"
            >
              View album
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium px-5 py-2.5 rounded-full text-sm transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {phase === 'spinning' && (
          <p className="text-center text-zinc-600 text-xs mt-4 tabular-nums">Spinning the carousel…</p>
        )}
      </div>
    </div>
  );
}
