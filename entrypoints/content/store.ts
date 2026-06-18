import type { Post } from '@/lib/types';

export interface StoreState {
  /** Number of posts waiting ahead of the cursor. */
  queueLength: number;
  /** Number of posts behind the cursor (available to Prev). */
  historyLength: number;
  /** The post currently being shown, or null before the first advance. */
  current: Post | null;
}

type Listener = (state: StoreState) => void;

/**
 * In-memory post store shared by harvester (writer) and player (reader).
 *
 * Model: a single ordered list `posts` plus a `cursor`. Everything at indices
 * > cursor is the upcoming queue; everything < cursor is history. The newest
 * harvested post is appended at the end, so advancing past your history always
 * walks toward fresh content (the "live front" from the design).
 *
 * History is bounded: when it grows past HISTORY_MAX we drop from the front and
 * shift the cursor, so memory stays flat during a long session.
 */
export class PostStore {
  private posts: Post[] = [];
  private ids = new Set<string>();
  private cursor = -1; // index of current post; -1 before first advance
  private listeners = new Set<Listener>();

  static readonly HISTORY_MAX = 50;
  static readonly QUEUE_TARGET = 25;
  static readonly QUEUE_LOW_WATER = 8;

  /** Add a freshly parsed+filtered post. Ignores duplicates by id. */
  add(post: Post): boolean {
    if (this.ids.has(post.id)) return false;
    this.ids.add(post.id);
    this.posts.push(post);
    this.emit();
    return true;
  }

  /** True when the upcoming queue is running low and a refill is warranted. */
  get needsRefill(): boolean {
    return this.queueLength <= PostStore.QUEUE_LOW_WATER;
  }

  get queueLength(): number {
    return this.posts.length - 1 - this.cursor;
  }

  get historyLength(): number {
    return Math.max(0, this.cursor);
  }

  get current(): Post | null {
    return this.cursor >= 0 ? this.posts[this.cursor] ?? null : null;
  }

  /** Advance to the next post. Returns it, or null if the queue is empty. */
  next(): Post | null {
    if (this.cursor + 1 >= this.posts.length) return null;
    this.cursor += 1;
    this.trimHistory();
    this.emit();
    return this.current;
  }

  /** Step back through history. Returns it, or null if at the oldest. */
  prev(): Post | null {
    if (this.cursor <= 0) return null;
    this.cursor -= 1;
    this.emit();
    return this.current;
  }

  /** Drop oldest history beyond the bound, keeping the cursor pointing right. */
  private trimHistory(): void {
    const overflow = this.historyLength - PostStore.HISTORY_MAX;
    if (overflow > 0) {
      const removed = this.posts.splice(0, overflow);
      removed.forEach((p) => this.ids.delete(p.id));
      this.cursor -= overflow;
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  private snapshot(): StoreState {
    return {
      queueLength: this.queueLength,
      historyLength: this.historyLength,
      current: this.current,
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((fn) => fn(snap));
  }
}
