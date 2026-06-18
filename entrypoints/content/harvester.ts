import type { Settings } from '@/lib/types';
import { SEL } from './selectors';
import { parseArticle } from './parser';
import { passesFilters } from './filters';
import { PostStore } from './store';

/**
 * Watches the live home timeline and feeds parsed, filtered posts into the
 * store.
 *
 * The key subtlety (verified against live x.com): X mounts a tweet's TEXT first
 * and lazy-loads the avatar + media a beat later. So a brand-new article almost
 * always has empty avatar/media at mount. The harvester therefore does two
 * things rather than capturing once:
 *
 *  1. MutationObserver — catches articles as X mounts them (adds them, usually
 *     text-only at first).
 *  2. Periodic enrichment scan — every ENRICH_MS, re-parse every currently
 *     mounted article and `upsert` it. Once the images have loaded in, this
 *     enriches the stored post in place, and the player re-renders the card.
 *
 * Plus auto-scroll refill when the upcoming queue runs low.
 */
export class Harvester {
  private observer: MutationObserver | null = null;
  private settings: Settings;
  private refillTimer: number | null = null;
  private enrichTimer: number | null = null;
  private feedTimer: number | null = null;
  private scanScheduled = false;
  private feedKey = '';

  static readonly ENRICH_MS = 1200;
  static readonly REFILL_MS = 4000;
  static readonly FEED_CHECK_MS = 600;

  constructor(
    private store: PostStore,
    settings: Settings,
  ) {
    this.settings = settings;
  }

  start(): void {
    this.feedKey = currentFeedKey();
    this.scanExisting();
    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(document.body, { childList: true, subtree: true });
    // Re-scan mounted articles so lazy-loaded avatars/images get enriched in.
    this.enrichTimer = window.setInterval(() => this.scanExisting(), Harvester.ENRICH_MS);
    // Refill the queue when it runs low.
    this.refillTimer = window.setInterval(() => this.maybeRefill(), Harvester.REFILL_MS);
    // Watch for feed switches (For you / Following / community / list / profile).
    this.feedTimer = window.setInterval(() => this.checkFeedChange(), Harvester.FEED_CHECK_MS);
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    for (const t of [this.enrichTimer, this.refillTimer, this.feedTimer]) {
      if (t !== null) window.clearInterval(t);
    }
    this.enrichTimer = null;
    this.refillTimer = null;
    this.feedTimer = null;
  }

  /**
   * If the user switched feeds, reset the store so the shower only holds posts
   * from the feed that's now open. The feed identity is the URL path plus the
   * selected timeline tab (For you / Following / a community), since X swaps
   * tabs without changing the URL.
   */
  private checkFeedChange(): void {
    const key = currentFeedKey();
    if (key !== this.feedKey) {
      this.feedKey = key;
      this.store.clear();
      this.scanExisting();
    }
  }

  updateSettings(next: Settings): void {
    this.settings = next;
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

  /**
   * Parse every mounted article and upsert it.
   *
   * Gate: a post is only ADDED once it has an avatar. X mounts tweets text-first
   * and lazy-loads the avatar a beat later, so a just-mounted article is usually
   * a bare skeleton — capturing it then would freeze an empty, avatar-less card
   * into the queue (the bug that made the shower show text only). We skip until
   * the avatar is present. Posts already in the store are still upserted so they
   * keep enriching (media loading in, text de-truncating) while mounted.
   */
  private scanExisting(): void {
    const articles = document.querySelectorAll<HTMLElement>(SEL.article);
    articles.forEach((article) => {
      const post = parseArticle(article);
      if (!post || !passesFilters(post, this.settings)) return;
      const known = this.store.has(post.id);
      if (!known) {
        // Don't add a half-loaded card. Wait for the avatar, and — if the tweet
        // has photo containers — wait for those images to actually have a src.
        if (!post.avatarUrl) return;
        if (mediaStillLoading(article)) return;
      }
      this.store.upsert(post);
    });
  }

  private maybeRefill(): void {
    if (!this.store.needsRefill) return;
    this.autoScroll();
  }

  /**
   * Nudge the timeline down to load more, then ease back up. Scan repeatedly
   * with delays so freshly mounted articles get a chance to lazy-load their
   * media before we (possibly) scroll them out of view.
   */
  private autoScroll(): void {
    const step = window.innerHeight * 0.9;
    window.scrollBy({ top: step, behavior: 'smooth' });
    window.setTimeout(() => {
      this.scanExisting();
      window.scrollBy({ top: step, behavior: 'smooth' });
      window.setTimeout(() => this.scanExisting(), 900);
    }, 900);
  }
}

/**
 * A stable identifier for the currently-open feed. Combines the URL path (which
 * covers /home, lists, communities, profiles, search) with the selected
 * timeline tab label (For you / Following / a community pinned on /home, which
 * X switches without changing the URL).
 */
function currentFeedKey(): string {
  const selectedTab =
    document
      .querySelector('[role="tablist"] [role="tab"][aria-selected="true"]')
      ?.textContent?.trim() ?? '';
  return `${location.pathname}::${selectedTab}`;
}

/**
 * True when the article has photo containers but at least one hasn't loaded its
 * <img> src yet — i.e. media is still lazy-loading. Used to delay first capture
 * so a post never enters the queue with blank image tiles.
 */
function mediaStillLoading(article: HTMLElement): boolean {
  const containers = article.querySelectorAll(SEL.tweetPhotoContainer).length;
  if (containers === 0) return false;
  const loaded = [...article.querySelectorAll<HTMLImageElement>(SEL.tweetPhoto)].filter(
    (img) => img.src,
  ).length;
  return loaded < containers;
}
