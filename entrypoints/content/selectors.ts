/**
 * Every x.com DOM selector lives here and nowhere else.
 *
 * X ships UI changes regularly and these break. When the harvester stops
 * producing posts, this is the ONLY file you should need to patch. Each entry
 * notes what it targets and the fallback strategy.
 *
 * Strategy: prefer stable `data-testid` attributes (X has kept these remarkably
 * consistent) over class names (which are hashed and churn constantly). All
 * selectors below were verified against the live x.com home timeline DOM.
 */

export const SEL = {
  /** Each post is an <article data-testid="tweet">. The dedupe + parse unit. */
  article: 'article[data-testid="tweet"]',

  /** Tweet text body. Absent on media-only posts. */
  tweetText: '[data-testid="tweetText"]',

  /** The User-Name block holds the name/handle/permalink anchors. */
  userNameBlock: '[data-testid="User-Name"]',

  /** Verified badge, scoped within User-Name. */
  verifiedBadge: '[aria-label="Verified account"]',

  /** Avatar as an <img> (preferred). */
  avatarImg: '[data-testid="Tweet-User-Avatar"] img',
  /** Avatar as a background-image div (lazy-load / off-screen fallback). */
  avatarBg: '[data-testid="Tweet-User-Avatar"] [style*="background-image"]',

  /** <time> element; carries dateTime + a ready-made relative label ("23h"). */
  time: 'time',

  /** Photo attachment containers (present before their <img> src loads). */
  tweetPhotoContainer: '[data-testid="tweetPhoto"]',
  /** Photo attachment images. */
  tweetPhoto: '[data-testid="tweetPhoto"] img',

  /** Video: the <video> carries a poster frame; the component wraps the player. */
  videoEl: '[data-testid="videoComponent"] video, [data-testid="videoPlayer"] video',
  videoComponent: '[data-testid="videoComponent"], [data-testid="videoPlayer"]',

  /** Promoted / reposted social-context line. */
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
