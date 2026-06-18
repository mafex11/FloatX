import type { Post } from '@/lib/types';

/**
 * Faithful mini-tweet card: avatar, name, verified badge, @handle, timestamp,
 * full text, and media.
 *
 * Layout contract (this is what makes media actually show): the card is a
 * column flexbox. Header + text are `shrink-0` (intrinsic height); the media
 * block is `flex-1 min-h-0` so it claims the remaining space and its images
 * can fill it. Without `min-h-0`, a flex child won't shrink below content size
 * and the grid collapses — which is why images were invisible before.
 */
export function ShowerCard({ post }: { post: Post }) {
  const hasMedia = post.media.length > 0 && post.media.some((m) => m.url);

  return (
    <article className="flex h-full w-full flex-col gap-2.5 overflow-hidden bg-black px-4 pb-4 pt-3.5 text-white">
      <header className="flex shrink-0 items-center gap-2.5">
        <Avatar url={post.avatarUrl} name={post.author} />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="flex items-center gap-1 truncate font-bold">
            <span className="truncate">{post.author || 'Unknown'}</span>
            {post.verified && <VerifiedBadge />}
          </span>
          <span className="truncate text-[13px] text-neutral-500">@{post.handle || 'unknown'}</span>
        </div>
        {post.timeDisplay && (
          <span className="shrink-0 self-start text-[13px] text-neutral-500">{post.timeDisplay}</span>
        )}
      </header>

      {post.text && (
        <p
          className={`shrink-0 overflow-y-auto whitespace-pre-wrap break-words leading-snug ${
            // Long text gets a slightly smaller size so more fits without scrolling.
            post.text.length > 180 ? 'text-[14px]' : 'text-[15px]'
          } ${hasMedia ? 'max-h-[45%]' : ''}`}
        >
          {post.text}
        </p>
      )}

      {hasMedia && <Media post={post} />}
    </article>
  );
}

function Avatar({ url, name }: { url: string; name: string }) {
  if (url) {
    return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  // Fallback: initial in a circle, so a missing avatar never breaks the row.
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-sm font-bold">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function VerifiedBadge() {
  return (
    <svg viewBox="0 0 24 24" aria-label="Verified" className="h-[18px] w-[18px] shrink-0 fill-[#1d9bf0]">
      <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
    </svg>
  );
}

function Media({ post }: { post: Post }) {
  const items = post.media.filter((m) => m.url).slice(0, 4);

  // Player present but no poster captured yet.
  if (items.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl bg-neutral-900 text-sm text-neutral-500">
        ▶ video
      </div>
    );
  }

  const cols = items.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
  return (
    <div className={`grid min-h-0 flex-1 gap-0.5 overflow-hidden rounded-2xl ${cols}`}>
      {items.map((m, i) => (
        <div
          key={i}
          className={`relative overflow-hidden bg-neutral-900 ${
            // A single odd image in a 3-up spans the full first column row.
            items.length === 3 && i === 0 ? 'row-span-2' : ''
          }`}
        >
          <img src={m.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {m.type === 'video' && (
            <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs">
              ▶
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
