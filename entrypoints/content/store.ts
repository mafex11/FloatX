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

export type UpsertResult = 'added' | 'enriched' | 'unchanged';

/**
 * In-memory post store shared by harvester (writer) and player (reader).
 *
 * Model: a single ordered list `posts` plus a `cursor`. Everything at indices
 * > cursor is the upcoming queue; everything < cursor is history. The newest
 * harvested post is appended at the end, so advancing past your history always
 * walks toward fresh content (the "live front" from the design).
 *
 * Enrichment: X mounts a tweet's text first and lazy-loads the avatar and media
 * a moment later. So the first time the harvester sees an article, avatarUrl and
 * media are usually empty. Rather than freezing that first empty capture, the
 * store ENRICHES an existing post in place when a later scan brings richer data
 * (avatar appears, media appears, text de-truncates, verified flips true). The
 * array entry is replaced with a new object so the player can detect the change
 * by reference and re-render the visible card.
 *
 * History is bounded: when it grows past HISTORY_MAX we drop from the front and
 * shift the cursor, so memory stays flat during a long session.
 */
export class PostStore {
  private posts: Post[] = [];
  private indexById = new Map<string, number>();
  private cursor = -1; // index of current post; -1 before first advance
  private listeners = new Set<Listener>();

  static readonly HISTORY_MAX = 50;
  static readonly QUEUE_TARGET = 25;
  static readonly QUEUE_LOW_WATER = 8;

  /**
   * Add a new post, or enrich an existing one with better data. Returns what
   * happened so the harvester can avoid pointless churn.
   */
  upsert(post: Post): UpsertResult {
    const existingIdx = this.indexById.get(post.id);
    if (existingIdx === undefined) {
      this.indexById.set(post.id, this.posts.length);
      this.posts.push(post);
      this.emit();
      return 'added';
    }

    const existing = this.posts[existingIdx];
    const merged = mergePost(existing, post);
    if (merged === existing) return 'unchanged';

    this.posts[existingIdx] = merged;
    this.emit();
    return 'enriched';
  }

  /**
   * Drop everything and start fresh. Used when the user switches feeds (For you
   * → Following → a community) so the shower only ever holds posts from the feed
   * that's currently open.
   */
  clear(): void {
    this.posts = [];
    this.indexById.clear();
    this.cursor = -1;
    this.emit();
  }

  /** Whether a post with this id is already stored. */
  has(id: string): boolean {
    return this.indexById.has(id);
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
      removed.forEach((p) => this.indexById.delete(p.id));
      this.cursor -= overflow;
      // Indices shifted by `overflow`; rebuild the lookup map.
      this.reindex();
    }
  }

  private reindex(): void {
    this.indexById.clear();
    this.posts.forEach((p, i) => this.indexById.set(p.id, i));
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

/**
 * Merge a freshly parsed version into an existing post, taking the richer value
 * for each field. Returns the SAME reference when nothing improved (so callers
 * can cheaply detect "no change"), otherwise a new merged object.
 */
function mergePost(existing: Post, incoming: Post): Post {
  const next: Post = { ...existing };
  let changed = false;

  if (!existing.avatarUrl && incoming.avatarUrl) {
    next.avatarUrl = incoming.avatarUrl;
    changed = true;
  }
  // More media items (with real urls) is strictly better.
  const realMedia = (p: Post) => p.media.filter((m) => m.url).length;
  if (realMedia(incoming) > realMedia(existing)) {
    next.media = incoming.media;
    changed = true;
  }
  // X truncates long tweets with "Show more"; a longer text is the fuller one.
  if (incoming.text.length > existing.text.length) {
    next.text = incoming.text;
    next.flags = { ...next.flags, hasText: incoming.text.trim().length > 0 };
    changed = true;
  }
  if (incoming.verified && !existing.verified) {
    next.verified = true;
    changed = true;
  }
  if (!existing.author && incoming.author) {
    next.author = incoming.author;
    changed = true;
  }
  if (!existing.timeDisplay && incoming.timeDisplay) {
    next.timeDisplay = incoming.timeDisplay;
    changed = true;
  }
  // Engagement loads in slightly after mount and ticks up over time; take the
  // incoming set whenever it carries any non-empty count the existing one lacks
  // or differs on.
  const e = existing.engagement;
  const n = incoming.engagement;
  if (n && (!e || n.replies !== e.replies || n.reposts !== e.reposts || n.likes !== e.likes || n.views !== e.views)) {
    // Only upgrade when incoming actually has data (avoid clobbering with blanks).
    if (n.replies || n.reposts || n.likes || n.views) {
      next.engagement = n;
      changed = true;
    }
  }

  return changed ? next : existing;
}
