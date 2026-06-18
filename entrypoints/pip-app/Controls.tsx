import { ProgressRing } from './ProgressRing';

export interface ControlsProps {
  paused: boolean;
  progress: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onPause: () => void;
  onNext: () => void;
}

/**
 * Spotify-PiP-style control bar. Rendered always; visibility (fade) is driven
 * by the hover state of the parent overlay via CSS opacity.
 */
export function Controls({
  paused,
  progress,
  canPrev,
  canNext,
  onPrev,
  onPause,
  onNext,
}: ControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
      <ProgressRing progress={progress} paused={paused} />
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Previous post"
        className="text-2xl text-white transition hover:scale-110 disabled:opacity-30"
      >
        ⏮
      </button>
      <button
        type="button"
        onClick={onPause}
        aria-label={paused ? 'Resume' : 'Pause'}
        className="text-3xl text-white transition hover:scale-110"
      >
        {paused ? '▶' : '⏸'}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Next post"
        className="text-2xl text-white transition hover:scale-110 disabled:opacity-30"
      >
        ⏭
      </button>
    </div>
  );
}
