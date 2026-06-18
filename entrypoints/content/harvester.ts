import type { Settings } from '@/lib/types';
import { SEL } from './selectors';
import { parseArticle } from './parser';
import { passesFilters } from './filters';
import { PostStore } from './store';

/**
 * Watches the live home timeline and feeds parsed, filtered posts into the
 * store. Two mechanisms:
 *
 *  1. MutationObserver — catches articles as X mounts them (on scroll, on new
 *     content). We observe rather than snapshot because the timeline is
 *     virtualized: nodes mount and unmount constantly, and id-keyed dedupe in
 *     the store collapses the inevitable repeats.
 *
 *  2. Auto-scroll refill — when the queue runs low, gently scroll the page to
 *     coax X into rendering more articles, then (optionally) restore position.
 *     Throttled so it stays light on the real tab.
 */
export class Harvester {
  private observer: MutationObserver | null = null;
  private settings: Settings;
  private refillTimer: number | null = null;
  private scanScheduled = false;

  constructor(
    private store: PostStore,
    settings: Settings,
  ) {
    this.settings = settings;
  }

  start(): void {
    this.scanExisting();
    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(document.body, { childList: true, subtree: true });
    // Periodic refill check, independent of the cadence of DOM mutations.
    this.refillTimer = window.setInterval(() => this.maybeRefill(), 4000);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.refillTimer !== null) {
      window.clearInterval(this.refillTimer);
      this.refillTimer = null;
    }
  }

  updateSettings(next: Settings): void {
    this.settings = next;
    // Re-scan with new filters so toggling a setting reflects what's on screen.
    this.scheduleScan();
  }

  /** Coalesce bursts of mutations into one scan on the next frame. */
  private scheduleScan(): void {
    if (this.scanScheduled) return;
    this.scanScheduled = true;
    requestAnimationFrame(() => {
      this.scanScheduled = false;
      this.scanExisting();
    });
  }

  private scanExisting(): void {
    const articles = document.querySelectorAll<HTMLElement>(SEL.article);
    articles.forEach((article) => {
      const post = parseArticle(article);
      if (post && passesFilters(post, this.settings)) {
        this.store.add(post);
      }
    });
  }

  private maybeRefill(): void {
    if (!this.store.needsRefill) return;
    this.autoScroll();
  }

  /**
   * Nudge the timeline down to load more, then ease back up. We scroll the
   * window itself (X's timeline drives off the document scroll). Two small
   * steps with a pause read more reliably than one big jump.
   */
  private autoScroll(): void {
    const step = window.innerHeight * 0.9;
    window.scrollBy({ top: step, behavior: 'smooth' });
    window.setTimeout(() => {
      this.scanExisting();
      window.scrollBy({ top: step, behavior: 'smooth' });
      window.setTimeout(() => this.scanExisting(), 800);
    }, 800);
  }
}
