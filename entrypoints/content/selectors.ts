/**
 * Every x.com DOM selector lives here and nowhere else.
 *
 * X ships UI changes regularly and these break. When the harvester stops
 * producing posts, this is the ONLY file you should need to patch. Each entry
 * notes what it targets and the fallback strategy.
 *
 * Strategy: prefer stable `data-testid` attributes (X has kept these remarkably
 * consistent) over class names (which are hashed and churn constantly).
 */

export const SEL = {
  /** The scroll container / primary timeline column. */
  timeline: '[aria-label][role="region"], main[role="main"]',

  /** Each post is a <article data-testid="tweet">. The dedupe + parse unit. */
  article: 'article[data-testid="tweet"]',

  /** Tweet text body. May be absent on media-only posts. */
  tweetText: '[data-testid="tweetText"]',

  /** The User-Name block holds display name + @handle + permalink time. */
  userNameBlock: '[data-testid="User-Name"]',

  /** Avatar container; the <img> inside carries the src. */
  avatar: '[data-testid="Tweet-User-Avatar"] img',

  /** <time> element; its parent <a href> is the canonical status permalink. */
  time: 'time',

  /** Photo attachments. */
  tweetPhoto: '[data-testid="tweetPhoto"] img',

  /** Video player container; poster image lives on a child. */
  videoPlayer: '[data-testid="videoPlayer"]',
  videoPoster: '[data-testid="videoPlayer"] video',

  /**
   * Promoted/ad marker. X renders a "Promoted" / "Ad" label inside the post.
   * There is no dedicated testid, so we scan for the social-context span and
   * also check the placement marker. See `parser.detectAd`.
   */
  socialContext: '[data-testid="socialContext"]',
} as const;

/**
 * Text markers used for classification when no testid exists. Kept here so a
 * future i18n pass (or X wording change) has one place to update.
 */
export const TEXT_MARKERS = {
  promoted: ['Promoted', 'Ad'],
  replyingTo: ['Replying to'],
  reposted: ['reposted', 'Reposted'],
} as const;

/** Extract the numeric tweet id from a status permalink href. */
export function tweetIdFromHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const m = href.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}
