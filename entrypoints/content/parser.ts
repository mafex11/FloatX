import type { Post, PostMedia } from '@/lib/types';
import { SEL, TEXT_MARKERS, tweetIdFromHref } from './selectors';

/**
 * Parse a single timeline <article> into a normalized Post.
 * Returns null when the element isn't a usable tweet (no id, skeleton, etc.).
 *
 * Defensive throughout: X recycles DOM nodes and renders partial skeletons, so
 * every field has a fallback and a missing id is treated as "skip, try later".
 */
export function parseArticle(article: HTMLElement): Post | null {
  // Permalink + id come from the <time>'s ancestor <a>. This is the most
  // reliable id source; the timeline has no per-article id attribute.
  const timeEl = article.querySelector<HTMLTimeElement>(SEL.time);
  const permalinkAnchor = timeEl?.closest('a') as HTMLAnchorElement | null;
  const permalink = permalinkAnchor?.href ?? '';
  const id = tweetIdFromHref(permalink);
  if (!id) return null; // skeleton or non-status card — skip, will re-fire later

  const text = extractText(article);
  const { author, handle } = extractAuthor(article);
  const avatarUrl = article.querySelector<HTMLImageElement>(SEL.avatar)?.src ?? '';
  const media = extractMedia(article);
  const timestamp = timeEl?.dateTime ?? '';

  const flags = {
    isAd: detectAd(article),
    isReply: detectReply(article),
    isRepost: detectRepost(article),
    hasText: text.trim().length > 0,
  };

  return { id, author, handle, avatarUrl, text, media, timestamp, permalink, flags };
}

function extractText(article: HTMLElement): string {
  const el = article.querySelector<HTMLElement>(SEL.tweetText);
  // innerText preserves line breaks and resolves emoji <img alt> reasonably.
  return el?.innerText ?? '';
}

function extractAuthor(article: HTMLElement): { author: string; handle: string } {
  const block = article.querySelector<HTMLElement>(SEL.userNameBlock);
  if (!block) return { author: '', handle: '' };

  // The block contains both the display name and the @handle. The handle is the
  // first text token starting with "@"; the display name is everything before it.
  const full = block.innerText ?? '';
  const lines = full.split('\n').map((s) => s.trim()).filter(Boolean);
  const handleLine = lines.find((l) => l.startsWith('@')) ?? '';
  const handle = handleLine.replace(/^@/, '');
  const author = lines.find((l) => !l.startsWith('@') && l !== '·') ?? '';
  return { author, handle };
}

function extractMedia(article: HTMLElement): PostMedia[] {
  const media: PostMedia[] = [];

  article.querySelectorAll<HTMLImageElement>(SEL.tweetPhoto).forEach((img) => {
    if (img.src) media.push({ type: 'image', url: img.src });
  });

  const video = article.querySelector<HTMLVideoElement>(SEL.videoPoster);
  if (video?.poster) {
    media.push({ type: 'video', url: video.poster });
  }

  return media;
}

function detectAd(article: HTMLElement): boolean {
  // X marks promoted posts with a "Promoted"/"Ad" label. No dedicated testid,
  // so scan the social-context line and, as a fallback, the whole article text.
  const ctx = article.querySelector<HTMLElement>(SEL.socialContext)?.innerText ?? '';
  if (matchesAny(ctx, TEXT_MARKERS.promoted)) return true;
  // Fallback: a standalone "Promoted" caption anywhere in the card.
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
