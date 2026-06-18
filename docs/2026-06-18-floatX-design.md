# FloatX — Design (Phase 1: browser PiP)

**Date:** 2026-06-18
**Status:** Approved design, ready for implementation plan

## What it is

FloatX shows X (Twitter) posts as a floating, always-on-top picture-in-picture
widget on your Mac — an ambient "shower" of posts. It auto-advances to the next
post every N minutes, and on hover reveals Spotify-PiP-style controls: prev,
pause, next.

The hard constraint: **no paid Twitter/X API.** All post data comes from reading
the rendered DOM of an already-open, logged-in x.com tab. No server, no auth, no
API cost.

## Architecture

A single Chrome (MV3) extension with three parts:

- **Content script** (runs on `x.com`): hosts the harvester, the player logic,
  and the injected floating launch button.
- **Background service worker**: holds settings and relays the toolbar-icon
  click into the active tab.
- **PiP document**: an HTML/CSS/JS surface rendered into the Document
  Picture-in-Picture window, driven by the content script. Because it shares the
  content script's JS context (same origin), it receives DOM handles and post
  data directly — no message passing needed between page and PiP.

No native app, no server, no Twitter API. Data comes 100% from the logged-in
tab's rendered DOM.

### Key browser constraint

`documentPictureInPicture.requestWindow()` requires a **user gesture**, so the
shower can only be *opened* by a click. Everything after that (auto-advance,
queue refill, prev/next) runs freely on timers.

## Harvester (data layer)

- Watches the home timeline (`<article>` elements) via a `MutationObserver`.
- Parses each card into a normalized `Post` object:
  `{id, author, handle, avatarUrl, text, media[], timestamp, permalink}`.
- Dedupes by tweet id — X recycles/shuffles DOM nodes as you scroll, so
  id-keyed dedupe is essential to avoid repeats.
- Maintains two in-memory structures:
  - **queue**: upcoming posts, target ~20-30.
  - **history**: bounded ~50 posts, for Prev.
- **Auto-scroll refill:** when the queue drops below a low-water mark, gently
  programmatically scrolls the timeline to load more cards, parses them, then
  can scroll back. Throttled to stay light on the tab.
- Applies filter settings at harvest time (see Filtering).

## Player (the PiP shower)

- Opened by a user click — toolbar icon **or** injected floating button (both).
- Renders a **faithful mini-tweet card**: avatar, name, @handle, full text, and
  images/thumbnails if present.
- **Auto-advance** every N minutes (configurable).
- **Hover reveals controls** (Spotify-PiP style — fade out when not hovering):
  - **Prev (◀):** walk back through bounded history.
  - **Pause (⏸):** freeze the auto-advance timer until unpaused.
  - **Next (▶):** advance immediately and reset the timer. Pulls from the queue;
    the newest harvested post is the live front, so Next always eventually
    returns to fresh content.
- Small progress indicator (time-until-next) so it feels alive.

### Prev/Next/live-front behavior

The newest harvested post is the "live" front. Prev walks backward through the
bounded ~50-post history; pressing Next past the point where you started
resumes the live queue. This guarantees Next always returns you to fresh
content rather than getting stuck in old history.

## Settings (popup UI)

- **Auto-advance interval:** 1 / 5 / 15 / 30 min (configurable).
- **Filter toggles** (see below).
- Persisted via `chrome.storage`.

## Filtering (configurable)

- **Ads / Promoted:** always skipped (not a toggle).
- **Replies:** toggle (default skip).
- **Reposts / retweets:** toggle (default keep).
- **Image/video-only (no text):** toggle (default keep).

## Known risks / tradeoffs

- **Home timeline is virtualized + recycled** — the most fragile feed to scrape.
  Mitigation: id-keyed dedupe, observe mutations rather than snapshot, tolerate
  gaps.
- **DOM selectors break when X ships UI changes** — accepted maintenance cost.
  Selectors isolated into one module for easy patching.
- **Auto-scroll touches a real tab** — kept gentle/throttled; the tab can be a
  dedicated background pinned tab.
- **Document-PiP support** — Chrome/Edge only (fine for the target Mac + Chrome
  setup).

## Phase 2 (deferred)

Native macOS floating widget (SwiftUI / menu-bar app). Would reuse the
harvester's `Post` data, piped out of the browser via a local websocket bridge.
Not built now — phase 1 proves the data + display logic first, and that data
layer is reusable.
