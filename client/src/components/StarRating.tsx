import { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 'sm',
  className = '',
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const v = Math.min(5, Math.max(0, value ?? 0));
  const preview = hover > 0 ? hover : v;
  const starClass =
    size === 'md' ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-3.5 h-3.5 sm:w-4 sm:h-4';

  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onMouseLeave={() => setHover(0)}
      role="group"
      aria-label="Album rating"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= preview;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            aria-pressed={filled}
            onMouseEnter={() => {
              if (!readOnly) setHover(star);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (readOnly || !onChange) return;
              onChange(star === v ? 0 : star);
              setHover(0);
            }}
            className={`${starClass} shrink-0 transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-spotify-green/60 ${
              readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            } ${filled ? 'text-amber-400' : 'text-zinc-600'}`}
          >
            <svg viewBox="0 0 20 20" className="w-full h-full fill-current" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
