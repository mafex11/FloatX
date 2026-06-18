/** A single harvested X post, normalized from the rendered timeline DOM. */
export interface Post {
  /** Tweet id, parsed from the status permalink. Primary dedupe key. */
  id: string;
  /** Display name, e.g. "Jane Doe". */
  author: string;
  /** Handle without the leading @, e.g. "janedoe". */
  handle: string;
  /** Avatar image URL. */
  avatarUrl: string;
  /** Whether the account shows a verified badge. */
  verified: boolean;
  /** Full post text (may be empty for media-only posts). */
  text: string;
  /** Attached media in display order. */
  media: PostMedia[];
  /** ISO timestamp string from the <time> element, or "" if absent. */
  timestamp: string;
  /** Ready-made relative label from X ("23h", "Jun 17"), or "" if absent. */
  timeDisplay: string;
  /** Engagement counts as X's abbreviated display strings ("6", "1.8K", ""). */
  engagement: Engagement;
  /** Canonical link to the post on x.com. */
  permalink: string;
  /** Classification flags used by the filter layer. */
  flags: PostFlags;
}

export interface PostMedia {
  type: 'image' | 'video';
  /** For video this is the poster/thumbnail image. */
  url: string;
}

/** Engagement counts, kept as X's abbreviated display strings ("1.8K", "23K"). */
export interface Engagement {
  replies: string;
  reposts: string;
  likes: string;
  views: string;
}

export interface PostFlags {
  /** Promoted / ad. Always filtered out, never shown. */
  isAd: boolean;
  /** Starts with "Replying to …". */
  isReply: boolean;
  /** Surfaced via a "… reposted" header. */
  isRepost: boolean;
  /** Whether the post has any non-empty text. */
  hasText: boolean;
}

/** User-configurable settings, persisted in chrome.storage. */
export interface Settings {
  /** Minutes between auto-advances. */
  intervalMin: 1 | 5 | 15 | 30;
  /** Skip "Replying to" posts. */
  skipReplies: boolean;
  /** Keep reposts/retweets (false = skip them). */
  keepReposts: boolean;
  /** Keep posts that have media but no text (false = skip them). */
  keepMediaOnly: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  intervalMin: 5,
  skipReplies: true,
  keepReposts: true,
  keepMediaOnly: true,
};
