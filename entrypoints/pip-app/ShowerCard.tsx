import type { Post } from '@/lib/types';

/** Faithful mini-tweet card: avatar, name, @handle, full text, images. */
export function ShowerCard({ post }: { post: Post }) {
  return (
    <article className="flex h-full w-full flex-col gap-3 overflow-hidden p-4 text-white">
      <header className="flex items-center gap-2.5">
        {post.avatarUrl ? (
          <img
            src={post.avatarUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-10 w-10 shrink-0 rounded-full bg-neutral-700" />
        )}
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-bold">{post.author || 'Unknown'}</span>
          <span className="truncate text-sm text-neutral-400">
            @{post.handle || 'unknown'}
          </span>
        </div>
      </header>

      {post.text && (
        <p className="overflow-y-auto whitespace-pre-wrap break-words text-[15px] leading-snug">
          {post.text}
        </p>
      )}

      {post.media.length > 0 && (
        <div
          className={`grid flex-1 gap-1 overflow-hidden rounded-xl ${
            post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {post.media.slice(0, 4).map((m, i) => (
            <div key={i} className="relative overflow-hidden bg-neutral-900">
              <img src={m.url} alt="" className="h-full w-full object-cover" />
              {m.type === 'video' && (
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-xs">
                  ▶ video
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
