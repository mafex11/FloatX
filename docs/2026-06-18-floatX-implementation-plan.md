# FloatX — Implementation Plan (Phase 1: browser PiP)

**Date:** 2026-06-18
**Design ref:** `2026-06-18-floatX-design.md`
**Status:** Ready to build

## Stack decisions

| Concern | Choice | Why |
| --- | --- | --- |
| Extension framework | **WXT** (`wxt.dev`) | Vite-powered, TS-first, auto-generates MV3 manifest, HMR, one config builds Chrome/Edge/Firefox. Modern standard; Plasmo has stagnated, raw MV3 is too much boilerplate. |
| Language | **TypeScript** | Types for the `Post` model, harvester store, and message passing. Keeps a fragile DOM scraper patchable. |
| UI framework | **React 19** | Dynamic PiP card + settings popup with hover state are clean in React. WXT has first-class React support. |
| Styling | **Tailwind CSS v4** | Fast, utility-first. Note: Document-PiP windows don't inherit page styles, so compiled CSS is injected into the PiP doc on open. |
| Storage | **`wxt/storage`** | Typed wrapper over `chrome.storage`, reactive in popup + content script. |
| Package manager | **pnpm** | Fast, disk-efficient, good workspace story if we split later. |
| Website | **Astro** on **Cloudflare Pages** | Static, near-zero JS landing/install page. |

## Repo layout

Extension at repo root (WXT default), website as a sibling subfolder:

```
floatX/
├── README.md
├── package.json              # WXT extension
├── wxt.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── docs/
│   ├── 2026-06-18-floatX-design.md
│   └── 2026-06-18-floatX-implementation-plan.md
├── assets/                   # icons, tailwind entry css
├── entrypoints/
│   ├── background.ts         # service worker: relay toolbar click
│   ├── content/              # content script: harvester + player + button
│   │   ├── index.ts
│   │   ├── harvester.ts
│   │   ├── store.ts
│   │   ├── selectors.ts      # ALL x.com DOM selectors, isolated for patching
│   │   ├── parser.ts
│   │   ├── filters.ts
│   │   ├── pip.ts            # opens Document-PiP, injects styles, mounts React
│   │   └── launch-button.tsx # injected floating button
│   ├── popup/                # settings UI
│   │   ├── index.html
│   │   └── App.tsx
│   └── pip-app/              # React app rendered inside the PiP window
│       ├── ShowerCard.tsx
│       ├── Controls.tsx
│       └── ProgressRing.tsx
├── lib/
│   ├── types.ts              # Post, Settings
│   └── settings.ts           # storage schema + defaults
└── website/                  # Astro landing page (separate package)
    ├── package.json
    └── src/pages/index.astro
```

## Data model

```ts
// lib/types.ts
interface Post {
  id: string;            // tweet id — dedupe key
  author: string;        // display name
  handle: string;        // @handle
  avatarUrl: string;
  text: string;
  media: { type: 'image' | 'video'; url: string }[];
  timestamp: string;     // ISO
  permalink: string;
  flags: { isAd: boolean; isReply: boolean; isRepost: boolean; hasText: boolean };
}

interface Settings {
  intervalMin: 1 | 5 | 15 | 30;   // default 5
  skipReplies: boolean;            // default true
  keepReposts: boolean;            // default true
  keepMediaOnly: boolean;          // default true
  // ads always skipped, not a setting
}
```

## Build phases

### Phase 0 — Scaffold
- `pnpm dlx wxt@latest init .` (React + TS template) inside `floatX/`, preserving existing `README.md` and `docs/`.
- Add Tailwind v4, configure `wxt.config.ts` (host permissions for `*://x.com/*`, `storage` permission, `documentPictureInPicture` is a JS API — no extra permission).
- Verify `pnpm dev` loads the unpacked extension and HMR works on x.com.
- **Done when:** empty extension loads on x.com with a console log from the content script.

### Phase 1 — Selectors, parser, types
- `lib/types.ts`: `Post`, `Settings`.
- `selectors.ts`: every x.com DOM query string lives here (article container, author, handle, avatar, text, media, promoted marker, "Replying to" marker, repost marker). Single patch point.
- `parser.ts`: `parseArticle(el) -> Post | null`. Extract id from the permalink, set `flags`.
- **Done when:** running the parser over the live timeline in devtools yields clean `Post` objects.

### Phase 2 — Harvester + store
- `store.ts`: in-memory `queue` (target 20-30) + `history` (bounded ~50), id-keyed `Set` for dedupe, subscribe API for the player.
- `harvester.ts`: `MutationObserver` on the timeline; on new `<article>`, parse → filter → enqueue. Low-water-mark auto-scroll refill, throttled. Scroll-back option.
- `filters.ts`: apply `Settings` (ads always dropped; replies/reposts/media-only per toggle).
- **Done when:** queue fills and refills as you sit on the timeline, no dupes, filters respected.

### Phase 3 — PiP player
- `pip.ts`: on user gesture, `documentPictureInPicture.requestWindow({width, height})`; copy/inject compiled Tailwind CSS into the PiP document; mount the `pip-app` React root.
- `ShowerCard.tsx`: faithful mini-tweet (avatar, name, @handle, full text, images).
- `Controls.tsx`: hover-reveal ◀ Prev · ⏸ Pause · ▶ Next, fade on mouseleave.
- `ProgressRing.tsx`: time-until-next indicator.
- Timer logic: auto-advance every `intervalMin`; Next = advance + reset; Prev = walk history; Pause = freeze. Newest harvested post is live front.
- **Done when:** PiP floats over other apps, auto-advances, all controls + live-front behavior work.

### Phase 4 — Launch surfaces (both)
- `background.ts`: on toolbar icon click, send a message to the active x.com tab → content script opens PiP. (The click is the required user gesture; message must open PiP synchronously enough to keep gesture validity — if Chrome rejects, fall back to injecting a click target.)
- `launch-button.tsx`: small floating button injected on x.com; click opens PiP directly (cleanest gesture path).
- **Done when:** both the toolbar icon and the floating button open the shower.

### Phase 5 — Settings popup
- `popup/App.tsx`: interval selector (1/5/15/30), filter toggles. Reactive via `wxt/storage`.
- Live-apply: changing interval/filters updates the running harvester + player without reopening.
- **Done when:** settings persist and take effect live.

### Phase 6 — Website (Astro)
- `website/`: single landing page — what FloatX is, a short demo gif, install steps (load unpacked / download zip), link to the GitHub repo.
- Copy in lowercase plain style. Deploy to Cloudflare Pages.
- **Done when:** page is live with working install instructions.

### Phase 7 — Polish + packaging
- Icons (16/32/48/128), card empty/loading states, error toast when selectors break.
- `pnpm build` + `pnpm zip` for distribution; load-unpacked test checklist.
- **Done when:** a clean built zip installs and runs end-to-end on a fresh Chrome profile.

## Risks carried from design
- Virtualized/recycled timeline → id-keyed dedupe + observe-don't-snapshot.
- Selector breakage on X UI changes → all selectors in `selectors.ts`, surfaced via error toast.
- Toolbar-click → PiP gesture validity across the message hop → floating button is the reliable fallback path.
- Document-PiP is Chrome/Edge only → acceptable for target setup.

## Out of scope (Phase 2, deferred)
Native macOS floating widget reusing the harvester `Post` data over a local
websocket bridge.
