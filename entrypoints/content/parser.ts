import type { Post, PostMedia } from '@/lib/types';
import { SEL, TEXT_MARKERS, tweetIdFromHref } from './selectors';

/**
 * Parse a single timeline <article> into a normalized Post.
 * Returns null when the element isn't a usable tweet (no id, skeleton, etc.).
 *
 * Extraction is structural, not text-splitting: author/handle/permalink all come
 * from the <a> anchors inside [data-testid="User-Name"], whose hrefs are stable
 * ("/handle" for the profile, "/handle/status/<id>" for the permalink). This was
 * verified against the live x.com DOM and handles the awkward cases that broke
 * the old innerText approach (display name rendered as "•", name and handle on
 * one line with no separator, etc.).
 */
export function parseArticle(article: HTMLElement): Post | null {
  const nameBlock = article.querySelector<HTMLElement>(SEL.userNameBlock);
  const anchors = nameBlock
    ? [...nameBlock.querySelectorAll<HTMLAnchorElement>('a[href]')]
    : [];

  // Permalink + id: the anchor whose href contains /status/.
  const statusAnchor = anchors.find((a) => /\/status\/\d+/.test(a.getAttribute('href') ?? ''));
  const permalink = statusAnchor?.href ?? '';
  const id = tweetIdFromHref(permalink);
  if (!id) return null; // skeleton or non-status card — skip, will re-fire later

  // Handle: the profile anchor href is "/handle". Prefer the @-prefixed anchor
  // text, fall back to the href path.
  const handleAnchor =
    anchors.find((a) => a.innerText.trim().startsWith('@')) ??
    anchors.find((a) => /^\/[A-Za-z0-9_]+$/.test(a.getAttribute('href') ?? ''));
  const handle = (handleAnchor?.getAttribute('href') ?? '').replace(/^\//, '');

  // Display name: the profile anchor that is NOT the @handle and NOT the time.
  const nameAnchor = anchors.find(
    (a) => a !== statusAnchor && a !== handleAnchor && a.innerText.trim() !== '',
  );
  let author = (nameAnchor?.innerText ?? '').replace(/\s+/g, ' ').trim();
  // Some accounts render their display name as a stripped symbol like "•".
  // Fall back to the handle so the card never shows a lone bullet.
  if (!author || author === '•') author = handle;

  const verified = !!nameBlock?.querySelector(SEL.verifiedBadge);
  const text = extractText(article);
  const avatarUrl = extractAvatar(article);
  const media = extractMedia(article);
  const timeEl = statusAnchor?.querySelector('time') ?? article.querySelector(SEL.time);
  const timestamp = timeEl?.dateTime ?? '';
  const timeDisplay = timeEl?.textContent?.trim() ?? '';
  const engagement = extractEngagement(article);

  const flags = {
    isAd: detectAd(article),
    isReply: detectReply(article),
    isRepost: detectRepost(article),
    hasText: text.trim().length > 0,
  };

  return {
    id,
    author,
    handle,
    avatarUrl,
    verified,
    text,
    media,
    timestamp,
    timeDisplay,
    engagement,
    permalink,
    flags,
  };
}

/**
 * Engagement counts as X's abbreviated display strings ("6", "1.8K", "23K").
 * Each action button's textContent already holds the abbreviated count; the
 * views count lives in the analytics link.
 */
function extractEngagement(article: HTMLElement): {
  replies: string;
  reposts: string;
  likes: string;
  views: string;
} {
  const count = (sel: string): string => {
    const t = article.querySelector<HTMLElement>(sel)?.textContent?.trim() ?? '';
    return t; // empty when zero / not rendered
  };
  return {
    replies: count(SEL.reply),
    reposts: count(SEL.repost),
    likes: count(SEL.like),
    views: count(SEL.viewsLink),
  };
}

function extractText(article: HTMLElement): string {
  const el = article.querySelector<HTMLElement>(SEL.tweetText);
  return el?.innerText ?? '';
}

/**
 * Avatar URL. X renders the avatar as an <img>, but during lazy-load (and for
 * some off-screen cards) only a background-image div exists. Try both.
 */
function extractAvatar(article: HTMLElement): string {
  const img = article.querySelector<HTMLImageElement>(SEL.avatarImg);
  if (img?.src) return img.src;
  const bg = article.querySelector<HTMLElement>(SEL.avatarBg);
  if (bg) {
    const m = bg.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (m) return m[1];
  }
  return '';
}

function extractMedia(article: HTMLElement): PostMedia[] {
  const media: PostMedia[] = [];

  // Photos.
  article.querySelectorAll<HTMLImageElement>(SEL.tweetPhoto).forEach((img) => {
    if (img.src) media.push({ type: 'image', url: img.src });
  });

  // Video: use the poster frame as a still. Both <video poster> and the
  // amplify thumbnail (rendered as a tweetPhoto img inside the player) appear,
  // so guard against duplicating a URL we already captured above.
  const video = article.querySelector<HTMLVideoElement>(SEL.videoEl);
  if (video?.poster && !media.some((m) => m.url === video.poster)) {
    media.push({ type: 'video', url: video.poster });
  } else if (article.querySelector(SEL.videoComponent) && media.length === 0) {
    // Player present but no poster yet; mark it so the card can show a video chip.
    media.push({ type: 'video', url: '' });
  }

  return media;
}

function detectAd(article: HTMLElement): boolean {
  const ctx = article.querySelector<HTMLElement>(SEL.socialContext)?.innerText ?? '';
  if (matchesAny(ctx, TEXT_MARKERS.promoted)) return true;
  return matchesAny(article.innerText.slice(0, 400), TEXT_MARKERS.promoted);
}

function detectReply(article: HTMLElement): boolean {
  return matchesAny(article.innerText.slice(0, 200), TEXT_MARKERS.replyingTo);
}

function detectRepost(article: HTMLElement): boolean {
  const ctx = article.querySelector<HTMLElement>(SEL.socialContext)?.innerText ?? '';
  return matchesAny(ctx, TEXT_MARKERS.reposted);
}

function matchesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}
