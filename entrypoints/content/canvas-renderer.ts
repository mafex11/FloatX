import type { Post } from '@/lib/types';

/**
 * Draws a tweet Post onto a 2D canvas for the video-PiP pipeline.
 *
 * Why canvas: video PiP (requestPictureInPicture on a <video>) gives the clean
 * browser overlay — no origin title bar, just hover controls (back-to-tab,
 * close, play/pause, prev/next). But it can only show a <video>, so each tweet
 * card is painted onto a canvas that is streamed into the video element.
 *
 * The canvas backing store is 2x the CSS size (SCALE) for crisp text/images on
 * retina. All draw coordinates below are in logical (1x) units and scaled once
 * up front via ctx.scale.
 *
 * Images (avatar + media) are loaded with crossOrigin='anonymous' so the canvas
 * stays untainted (verified: pbs.twimg.com serves permissive CORS), otherwise
 * captureStream() would throw.
 */

export const CARD_W = 360;
export const CARD_H = 320;
const SCALE = 2;

const COLORS = {
  bg: '#000000',
  text: '#e7e9ea',
  muted: '#71767b',
  accent: '#1d9bf0',
  placeholder: '#2f3336',
};

/** Cache of loaded images by url. Value is null while loading or on failure. */
const imageCache = new Map<string, HTMLImageElement | null>();

function getImage(url: string): HTMLImageElement | null {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url) ?? null;
  // Mark as loading immediately so we only kick off one load per url.
  imageCache.set(url, null);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => imageCache.set(url, img);
  img.onerror = () => imageCache.set(url, null);
  img.src = url;
  return null;
}

/** Preload a post's images so they're ready by the time it's shown. */
export function preloadPostImages(post: Post): void {
  if (post.avatarUrl) getImage(post.avatarUrl);
  post.media.forEach((m) => m.url && getImage(m.url));
}

export interface CanvasRenderer {
  canvas: HTMLCanvasElement;
  /** Paint the given post (or an idle message when null). `progress` 0..1 drives
   * the countdown bar; `paused` tints it. */
  render: (post: Post | null, progress: number, paused: boolean) => void;
}

export function createCanvasRenderer(): CanvasRenderer {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W * SCALE;
  canvas.height = CARD_H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  const render = (post: Post | null, progress: number, paused: boolean) => {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    if (!post) {
      drawIdle(ctx);
      drawProgressBar(ctx, progress, paused);
      return;
    }
    preloadPostImages(post);

    const pad = 16;
    let y = 18;

    // --- header: avatar + name/handle + time ---
    const avSize = 40;
    drawAvatar(ctx, post, pad, y, avSize);

    const headerTextX = pad + avSize + 10;
    const timeText = post.timeDisplay || '';
    ctx.font = '600 15px system-ui, sans-serif';
    const timeW = timeText ? ctx.measureText(timeText).width : 0;
    const nameMaxW = CARD_W - headerTextX - pad - (timeW ? timeW + 8 : 0);

    // name + verified badge
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillStyle = COLORS.text;
    const name = ellipsize(ctx, post.author || 'Unknown', nameMaxW - (post.verified ? 22 : 0));
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(name, headerTextX, y + 15);
    const nameW = ctx.measureText(name).width;
    if (post.verified) drawVerified(ctx, headerTextX + nameW + 4, y + 4, 14);

    // handle
    ctx.font = '400 14px system-ui, sans-serif';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(ellipsize(ctx, '@' + (post.handle || 'unknown'), nameMaxW), headerTextX, y + 33);

    // time (right-aligned)
    if (timeText) {
      ctx.font = '400 14px system-ui, sans-serif';
      ctx.fillStyle = COLORS.muted;
      ctx.textAlign = 'right';
      ctx.fillText(timeText, CARD_W - pad, y + 15);
      ctx.textAlign = 'left';
    }

    y += avSize + 12;

    // --- body text ---
    const hasMedia = post.media.some((m) => m.url);
    if (post.text) {
      ctx.fillStyle = COLORS.text;
      const fontSize = post.text.length > 180 ? 14 : 15.5;
      ctx.font = `400 ${fontSize}px system-ui, sans-serif`;
      const lineH = fontSize + 4;
      const maxTextLines = hasMedia ? 3 : 9;
      y = drawWrappedText(ctx, post.text, pad, y, CARD_W - pad * 2, lineH, maxTextLines);
      y += 8;
    }

    // --- media ---
    if (hasMedia) {
      const mediaY = y;
      const mediaH = CARD_H - mediaY - pad - 4;
      if (mediaH > 40) drawMedia(ctx, post, pad, mediaY, CARD_W - pad * 2, mediaH);
    }

    drawProgressBar(ctx, progress, paused);
  };

  return { canvas, render };
}

/** Thin countdown bar pinned to the bottom edge. */
function drawProgressBar(ctx: CanvasRenderingContext2D, progress: number, paused: boolean) {
  const h = 3;
  const y = CARD_H - h;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, y, CARD_W, h);
  ctx.fillStyle = paused ? '#facc15' : COLORS.accent;
  ctx.fillRect(0, y, CARD_W * Math.min(Math.max(progress, 0), 1), h);
}

function drawIdle(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLORS.muted;
  ctx.font = '400 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('waiting for posts…', CARD_W / 2, CARD_H / 2 - 8);
  ctx.fillText('scroll your x.com timeline', CARD_W / 2, CARD_H / 2 + 12);
  ctx.textAlign = 'left';
}

function drawAvatar(ctx: CanvasRenderingContext2D, post: Post, x: number, y: number, size: number) {
  const img = post.avatarUrl ? getImage(post.avatarUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.fillStyle = COLORS.placeholder;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((post.author || '?').charAt(0).toUpperCase(), x + size / 2, y + size / 2 + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

function drawVerified(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  // Simple filled badge with a check — recognizable without the exact SVG path.
  ctx.save();
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + size * 0.3, y + size * 0.52);
  ctx.lineTo(x + size * 0.45, y + size * 0.66);
  ctx.lineTo(x + size * 0.72, y + size * 0.34);
  ctx.stroke();
  ctx.restore();
}

/** Word-wrap text, returning the y after the last drawn line. Adds "…" if clipped. */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines: number,
): number {
  const paragraphs = text.split('\n');
  let line = '';
  let lines = 0;
  let curY = y;

  const flush = () => {
    ctx.fillText(line, x, curY + 12);
    curY += lineH;
    lines++;
    line = '';
  };

  for (let p = 0; p < paragraphs.length; p++) {
    const words = paragraphs[p].split(' ');
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        if (lines === maxLines - 1) {
          // last allowed line — ellipsize remaining
          let clipped = line;
          while (ctx.measureText(clipped + '…').width > maxW && clipped.length > 0) {
            clipped = clipped.slice(0, -1);
          }
          ctx.fillText(clipped + '…', x, curY + 12);
          return curY + lineH;
        }
        flush();
        line = word;
      } else {
        line = test;
      }
    }
    if (line) flush();
    if (lines >= maxLines) return curY;
  }
  return curY;
}

function drawMedia(
  ctx: CanvasRenderingContext2D,
  post: Post,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const items = post.media.filter((m) => m.url).slice(0, 4);
  if (items.length === 0) return;
  const gap = 3;
  const radius = 14;

  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();

  const cell = (cx: number, cy: number, cw: number, ch: number, m: (typeof items)[number]) => {
    const img = getImage(m.url);
    ctx.fillStyle = COLORS.placeholder;
    ctx.fillRect(cx, cy, cw, ch);
    if (img) drawImageCover(ctx, img, cx, cy, cw, ch);
    if (m.type === 'video') drawPlayBadge(ctx, cx + cw / 2, cy + ch / 2);
  };

  if (items.length === 1) {
    cell(x, y, w, h, items[0]);
  } else if (items.length === 2) {
    const cw = (w - gap) / 2;
    cell(x, y, cw, h, items[0]);
    cell(x + cw + gap, y, cw, h, items[1]);
  } else if (items.length === 3) {
    const cw = (w - gap) / 2;
    const ch = (h - gap) / 2;
    cell(x, y, cw, h, items[0]);
    cell(x + cw + gap, y, cw, ch, items[1]);
    cell(x + cw + gap, y + ch + gap, cw, ch, items[2]);
  } else {
    const cw = (w - gap) / 2;
    const ch = (h - gap) / 2;
    cell(x, y, cw, ch, items[0]);
    cell(x + cw + gap, y, cw, ch, items[1]);
    cell(x, y + ch + gap, cw, ch, items[2]);
    cell(x + cw + gap, y + ch + gap, cw, ch, items[3]);
  }
  ctx.restore();
}

function drawPlayBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy - 8);
  ctx.lineTo(cx - 5, cy + 8);
  ctx.lineTo(cx + 9, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw an image with object-fit: cover into the target box. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const br = w / h;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (ir > br) {
    sw = img.naturalHeight * br;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / br;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
