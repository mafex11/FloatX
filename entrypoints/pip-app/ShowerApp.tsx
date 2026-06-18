import { useCallback, useEffect, useRef, useState } from 'react';
import type { Post } from '@/lib/types';
import { ShowerCard } from './ShowerCard';
import { Controls } from './Controls';

export interface ShowerApi {
  /** Pull the next post from the store (advances the live cursor). */
  next: () => Post | null;
  /** Step back through history. */
  prev: () => Post | null;
  /** Current store counts, for enabling/disabling controls. */
  counts: () => { queueLength: number; historyLength: number };
  /** Subscribe to store changes; returns an unsubscribe fn. */
  onChange: (cb: () => void) => () => void;
  /** Current auto-advance interval in minutes. */
  intervalMin: () => number;
  /** Subscribe to interval changes; returns an unsubscribe fn. */
  onIntervalChange: (cb: () => void) => () => void;
}

const TICK_MS = 250;

/**
 * The shower itself. Owns the countdown timer, pause state, and progress; the
 * actual post buffer lives in the content script's store, reached through `api`.
 */
export function ShowerApp({ api }: { api: ShowerApi }) {
  const [post, setPost] = useState<Post | null>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [counts, setCounts] = useState(api.counts());

  // Elapsed ms on the current post; reset on every advance.
  const elapsedRef = useRef(0);
  const intervalMsRef = useRef(api.intervalMin() * 60_000);

  const refreshCounts = useCallback(() => setCounts(api.counts()), [api]);

  const advance = useCallback(() => {
    const p = api.next();
    if (p) {
      setPost(p);
      elapsedRef.current = 0;
      setProgress(0);
    }
    refreshCounts();
  }, [api, refreshCounts]);

  const goPrev = useCallback(() => {
    const p = api.prev();
    if (p) {
      setPost(p);
      elapsedRef.current = 0;
      setProgress(0);
    }
    refreshCounts();
  }, [api, refreshCounts]);

  // Show the first post as soon as one is available.
  useEffect(() => {
    if (!post) advance();
  }, [post, advance, counts.queueLength]);

  // React to store changes (new posts harvested, counts shift).
  useEffect(() => api.onChange(refreshCounts), [api, refreshCounts]);

  // React to interval setting changes live.
  useEffect(
    () =>
      api.onIntervalChange(() => {
        intervalMsRef.current = api.intervalMin() * 60_000;
      }),
    [api],
  );

  // The countdown. Advances when elapsed reaches the interval.
  useEffect(() => {
    const t = window.setInterval(() => {
      if (paused) return;
      elapsedRef.current += TICK_MS;
      const ratio = elapsedRef.current / intervalMsRef.current;
      if (ratio >= 1) {
        advance();
      } else {
        setProgress(ratio);
      }
    }, TICK_MS);
    return () => window.clearInterval(t);
  }, [paused, advance]);

  return (
    <div className="group relative h-full w-full bg-black font-sans text-white">
      {post ? (
        <ShowerCard post={post} />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-400">
          waiting for posts… scroll your x.com timeline to fill the shower
        </div>
      )}

      {/* Controls overlay: hidden until hover (Spotify-PiP behavior). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
        <Controls
          paused={paused}
          progress={progress}
          canPrev={counts.historyLength > 0}
          canNext={counts.queueLength > 0}
          onPrev={goPrev}
          onPause={() => setPaused((p) => !p)}
          onNext={advance}
        />
      </div>
    </div>
  );
}
