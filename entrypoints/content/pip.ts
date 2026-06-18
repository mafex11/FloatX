import type { Post } from '@/lib/types';
import { createCanvasRenderer, preloadPostImages, CARD_W, CARD_H } from './canvas-renderer';

/**
 * Video-PiP player.
 *
 * The shower is painted onto a canvas, streamed into a hidden <video>, and shown
 * via the browser's video Picture-in-Picture. That gives the clean overlay the
 * user wants — no origin title bar, just hover controls: back-to-tab, close,
 * play/pause, and previous/next (wired through the Media Session API).
 *
 * This module owns the playback state (current post, paused, countdown). The
 * post buffer itself lives in the content script's store, reached through the
 * StoreBridge passed to openShower().
 */

export interface StoreBridge {
  next: () => Post | null;
  prev: () => Post | null;
  current: () => Post | null;
  counts: () => { queueLength: number; historyLength: number };
  onChange: (cb: () => void) => () => void;
  intervalMin: () => number;
}

let active: Player | null = null;

export function isPipSupported(): boolean {
  return (
    'pictureInPictureEnabled' in document &&
    document.pictureInPictureEnabled &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );
}

export function isPipOpen(): boolean {
  return !!document.pictureInPictureElement;
}

/** Must be called from a user gesture (click) — PiP entry requires activation. */
export async function openShower(bridge: StoreBridge): Promise<void> {
  if (!isPipSupported()) {
    throw new Error('Picture-in-Picture (canvas captureStream) is not supported here.');
  }
  if (active && isPipOpen()) {
    await document.exitPictureInPicture().catch(() => {});
    return;
  }
  active?.destroy();
  active = new Player(bridge);
  await active.open();
}

class Player {
  private renderer = createCanvasRenderer();
  private video: HTMLVideoElement;
  private post: Post | null = null;
  private paused = false;
  private elapsedMs = 0;
  private lastTs = 0;
  private rafId = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(private bridge: StoreBridge) {
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    // Kept in the DOM (offscreen) — required for the stream to run + PiP to attach.
    video.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;opacity:0;pointer-events:none';
    this.video = video;
  }

  async open(): Promise<void> {
    document.body.appendChild(this.video);

    // Seed with the first post (advance from the live front) and paint a frame
    // BEFORE capturing, so the stream has real data immediately.
    this.post = this.bridge.next() ?? this.bridge.current();
    this.renderFrame();

    const stream = this.renderer.canvas.captureStream(30);
    this.video.srcObject = stream;

    // Wait until the video actually has frame data; requestPictureInPicture()
    // rejects with "Metadata not loaded" if called too early.
    await this.video.play();
    if (this.video.readyState < 2) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        this.video.addEventListener('loadeddata', done, { once: true });
        // Safety timeout so we never hang the open forever.
        setTimeout(done, 1500);
      });
    }

    this.setupMediaSession();

    // Re-read the current post when the store enriches it (images load in).
    this.unsubscribe = this.bridge.onChange(() => {
      const live = this.bridge.current();
      if (live && this.post && live.id === this.post.id && live !== this.post) {
        this.post = live;
      }
    });

    this.video.addEventListener('leavepictureinpicture', () => this.destroy(), { once: true });

    await this.video.requestPictureInPicture();
    this.loop(performance.now());
  }

  private setupMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('nexttrack', () => this.advance());
      ms.setActionHandler('previoustrack', () => this.goPrev());
      ms.setActionHandler('pause', () => this.setPaused(true));
      ms.setActionHandler('play', () => this.setPaused(false));
    } catch {
      // Some actions may be unsupported; ignore.
    }
    this.updateMetadata();
  }

  private updateMetadata(): void {
    if (!('mediaSession' in navigator)) return;
    const p = this.post;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: p?.author || 'FloatX',
      artist: p ? '@' + p.handle : 'x post shower',
    });
    navigator.mediaSession.playbackState = this.paused ? 'paused' : 'playing';
  }

  private advance(): void {
    const p = this.bridge.next();
    if (p) {
      this.post = p;
      this.elapsedMs = 0;
      preloadPostImages(p);
      this.updateMetadata();
    }
  }

  private goPrev(): void {
    const p = this.bridge.prev();
    if (p) {
      this.post = p;
      this.elapsedMs = 0;
      preloadPostImages(p);
      this.updateMetadata();
    }
  }

  private setPaused(v: boolean): void {
    this.paused = v;
    this.updateMetadata();
  }

  /** rAF loop: advance the countdown and repaint. */
  private loop = (ts: number): void => {
    const dt = this.lastTs ? ts - this.lastTs : 0;
    this.lastTs = ts;

    if (!this.paused) {
      this.elapsedMs += dt;
      const intervalMs = this.bridge.intervalMin() * 60_000;
      if (this.elapsedMs >= intervalMs) this.advance();
    }
    this.renderFrame();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private renderFrame(): void {
    const intervalMs = this.bridge.intervalMin() * 60_000;
    const progress = intervalMs > 0 ? this.elapsedMs / intervalMs : 0;
    this.renderer.render(this.post, progress, this.paused);
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    this.unsubscribe?.();
    this.unsubscribe = null;
    const stream = this.video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    this.video.srcObject = null;
    this.video.remove();
    if ('mediaSession' in navigator) {
      for (const a of ['nexttrack', 'previoustrack', 'pause', 'play'] as const) {
        try {
          navigator.mediaSession.setActionHandler(a, null);
        } catch {
          /* ignore */
        }
      }
    }
    if (active === this) active = null;
  }
}

// Re-export so callers don't need to know the canvas dimensions.
export { CARD_W, CARD_H };
