import clsx from 'clsx';

interface ListenedToggleProps {
  listened: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  /** Stop click from bubbling (e.g. card navigation) */
  stopPropagation?: boolean;
  className?: string;
  /** Slightly larger hit target on list rows */
  size?: 'sm' | 'md';
}

export default function ListenedToggle({
  listened,
  disabled,
  onChange,
  stopPropagation,
  className,
  size = 'sm',
}: ListenedToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={listened}
      aria-label={listened ? 'Mark as not listened' : 'Mark as listened'}
      disabled={disabled}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        onChange(!listened);
      }}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors border shrink-0',
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        listened
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-emerald-500/25 hover:border-emerald-400/50'
          : 'bg-zinc-800/80 border-zinc-600/90 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-500 hover:text-zinc-200',
        disabled && 'opacity-45 cursor-not-allowed',
        className,
      )}
    >
      {listened ? (
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 text-zinc-500 shrink-0" fill="currentColor" aria-hidden>
          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
        </svg>
      )}
      <span>{listened ? 'Listened' : 'To listen'}</span>
    </button>
  );
}
