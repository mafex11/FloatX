# FloatX — Phase 2: native macOS glass widget

**Date:** 2026-06-19
**Status:** Approved, scaffolding
**Builds on:** the phase-1 browser extension (harvester + content script).

## Goal

A native macOS **menu-bar app** that shows a borderless, always-on-top, Liquid
Glass floating widget — the Spotify-mini-player feel — cycling X posts, with
**inline video playback** (the thing the browser canvas-PiP couldn't do).

## Decisions (locked)

- **Form factor:** menu-bar app. Click the menu-bar icon to toggle the floating
  widget. No Dock slot.
- **UI:** SwiftUI with Apple's **Liquid Glass** design system (macOS 26+).
  Verified: `.glassEffect(...)` typechecks against the local CLT macOS 26.5 SDK.
- **Window:** borderless `NSPanel` — `.nonactivatingPanel`, `.floating` level,
  no title bar, custom rounded corners, drag-anywhere, hover-reveal controls.
- **Data bridge:** **local WebSocket**. The Swift app hosts `ws://127.0.0.1:PORT`;
  the extension's **background service worker** (not page-CSP-bound) connects and
  streams harvested posts. Content script → background worker → WebSocket → app.
- **Video:** inline playback via **AVPlayer** (native is not bound by the canvas
  cross-origin tainting that blocked the browser approach).
- **Build:** SwiftPM executable + hand-assembled `.app` bundle, ad-hoc deep-sign
  (the Yuki/Burnt pattern — no full Xcode required).

## Architecture

```
x.com tab ─ content script (harvester) ─┐
                                         │ chrome.runtime message
                          background service worker
                                         │ ws://127.0.0.1:PORT  (JSON posts)
                                  ┌──────┴───────┐
                                  │  FloatX.app  │  (menu-bar)
                                  │  WSServer    │  receives posts
                                  │  PostStore   │  queue + history + cursor
                                  │  GlassPanel  │  borderless NSPanel
                                  │  CardView    │  SwiftUI + Liquid Glass
                                  │  AVPlayer    │  inline video
                                  └──────────────┘
```

### Why this bridge

The content script can't open a socket — x.com's CSP `connect-src` blocks it.
The background service worker has no page CSP, so it's the bridge. WebSocket
(over Native Messaging) chosen for simplest build/debug; tradeoff is the app
must be running to receive (fine — it's the widget you launched).

## Components

1. **WSServer** (Swift, `Network.framework`) — listens on a fixed localhost
   port, accepts the extension's connection, decodes JSON `Post` frames.
2. **Post model** — mirrors the extension's `Post` (id, author, handle,
   avatarURL, verified, text, media[], timeDisplay, engagement, permalink).
3. **PostStore** — queue + bounded history + cursor; same "live front" +
   enrichment semantics as the extension store, ported to Swift.
4. **GlassPanel** — `NSPanel` subclass: borderless, floating, non-activating,
   movable-by-background, rounded, shadowed.
5. **CardView** (SwiftUI) — glass-native tweet card: avatar, name + verified,
   handle, time, text, media (image grid OR inline AVPlayer for video),
   engagement row, countdown ring/bar. Hover reveals prev/pause/next.
6. **MenuBarController** — `NSStatusItem`; toggles the panel; quick settings
   (interval, filters) mirrored from the extension defaults.
7. **Player loop** — auto-advance timer (configurable), prev/next/pause.

## Phasing within phase 2

- **2a — pipeline slice:** menu-bar item → glass panel → WSServer receives a
  post → renders it. Plus extension background-worker WS client. Proves
  browser→Mac end to end.
- **2b — full card + auto-advance + hover controls** (glass-native redesign).
- **2c — inline video** via AVPlayer (poster → tap/auto play).
- **2d — settings, packaging, deep-sign, TCC notes** (reuse Yuki signing).

## Out of scope (for now)

- Notarization / Web Store-equivalent distribution (local/sideloaded app).
- Working without the browser open (no API = no alternate source).

## Open risks

- **Extension MV3 service worker lifecycle:** workers sleep when idle and may
  drop the WS connection. Mitigation: reconnect-on-wake, and the content script
  pings the worker to keep it alive while x.com is open.
- **Fixed port collision:** pick an uncommon port; fall back across a small
  range and have the app advertise which it bound (written to a known file the
  extension reads, or a short scan).
- **Glass on a borderless panel:** confirm `.glassEffect` renders correctly in a
  non-standard window (vibrancy usually wants a real window) — verify early in 2a.
