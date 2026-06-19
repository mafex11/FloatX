# FloatX — Chrome Web Store submission kit

Everything needed to submit FloatX for review. Upload the zip, fill the fields
below, attach the images.

## 1. Package to upload

`../.output/floatx-0.1.0-chrome.zip` (run `pnpm zip` from repo root to refresh)
A copy is also kept here as `floatx-0.1.0-chrome.zip`.

## 2. Images

| File | Size | Where it goes |
| --- | --- | --- |
| `store-icon-128.png` | 128×128 | Store icon (required) |
| `launch/01-hero.png` | 1280×800 | Screenshot 1 (required ≥1) |
| `launch/02-controls.png` | 1280×800 | Screenshot 2 |
| `launch/03-settings.png` | 1280×800 | Screenshot 3 |
| `launch/04-howitworks.png` | 1280×800 | Screenshot 4 |
| `launch/05-feed.png` | 1280×800 | Screenshot 5 |
| `promo-small-440x280.png` | 440×280 | Small promo tile (optional) |
| `promo-marquee-1400x560.png` | 1400×560 | Marquee promo (optional) |

Upload the five `launch/*.png` as the screenshot carousel, in order. Regenerate
with `python3 generate-launch-images.py` (needs rsvg-convert).

Optional listing video: upload `floatx-launch.mp4` to YouTube (unlisted is fine)
and paste the URL in the listing's video field. The store does not host MP4s.

## 3. Listing fields

**Name:** FloatX — ambient X post shower

**Summary (≤132 chars):**
Float your X timeline in a small always-on-top window that drips one post at a time. No API, no cost.

**Description:**
FloatX turns your X (Twitter) home timeline into an ambient, always-on-top
picture-in-picture window that shows one post at a time and auto-advances on a
timer you choose. Hover for prev / pause / next.

- No Twitter/X API and no cost — FloatX reads posts from the rendered page of
  the x.com tab you already have open.
- Faithful mini-tweet cards: avatar, name, verified badge, full text, images,
  and engagement (replies, reposts, likes, views).
- Custom interval — anywhere from a few seconds to an hour.
- Filters: skip replies, keep or skip reposts and media-only posts. Ads are
  always skipped.
- Reflects whatever feed you have open (For you / Following / a community).
- Launch from the on-page pill (scroll up or it appears on load) or the
  keyboard shortcut Alt+Shift+X.

Works in Chrome and Edge (uses the Document/Video Picture-in-Picture APIs).
Not affiliated with X Corp. Reads only your own logged-in session.

**Category:** Social & Communication

**Language:** English

## 4. Privacy & permissions (the form asks for each)

- **Single purpose:** Show your own X timeline as a floating, auto-advancing
  picture-in-picture window.
- `storage` — save settings (interval, filters) locally.
- `activeTab` — let the popup open the shower on the active x.com tab.
- host `*://x.com/*`, `*://*.x.com/*` — the content script runs only on x.com
  to read the timeline you are viewing.
- **Remote code:** none.
- **Data usage:** collects nothing, sends nothing. No server, no analytics, no
  network calls of its own. All processing is in-page on your machine. Reads
  only your already-logged-in session. (Tick "does not sell/transfer data".)

## 5. ⚠️ Known review risk — read before submitting

The icon and name use the X mark / "X". Google can reject extensions that use a
platform's trademark as their own branding, and reading x.com may be flagged as
impersonation. Mitigations already in place: the icon adds a distinct blue
auto-advance bar (FloatX ≠ X), and the listing states "not affiliated with X
Corp." If review bounces on this, swap `assets/icon.svg` to an abstract mark
(the `drop` or `mono-f` directions we mocked up) and regenerate icons + assets —
it's a one-file change plus a rebuild.
