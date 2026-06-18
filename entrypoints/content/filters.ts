import type { Post, Settings } from '@/lib/types';

/**
 * Decide whether a harvested post should enter the shower queue.
 *
 * Ads are ALWAYS dropped (not user-configurable). Everything else follows the
 * user's settings. Returns true to keep.
 */
export function passesFilters(post: Post, settings: Settings): boolean {
  // Ads: hard drop, always.
  if (post.flags.isAd) return false;

  // Replies: drop when skipReplies is on.
  if (settings.skipReplies && post.flags.isReply) return false;

  // Reposts: drop when the user has turned off keepReposts.
  if (!settings.keepReposts && post.flags.isRepost) return false;

  // Media-only (no text): drop when the user has turned off keepMediaOnly.
  if (!settings.keepMediaOnly && !post.flags.hasText) return false;

  return true;
}
