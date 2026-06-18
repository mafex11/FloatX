# FloatX — Chrome Web Store listing

## Assets in this folder

| File | Size | Store field |
| --- | --- | --- |
| `store-icon-128.png` | 128×128 | Store icon |
| `promo-small-440x280.png` | 440×280 | Small promo tile |
| `promo-marquee-1400x560.png` | 1400×560 | Marquee promo (optional) |
| `screenshot-1280x800.png` | 1280×800 | Screenshot (≥1 required) |

Packaged extension zip: `../.output/floatx-0.1.0-chrome.zip`

## Name

FloatX — ambient X post shower

## Summary (≤132 chars)

Float your X timeline in a small always-on-top window that drips one post at a time. No API, no cost.

## Description

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

## Permissions justification

- `storage` — save your settings (interval, filters) locally.
- `activeTab` — let the popup ask the x.com tab to open the shower.
- host `*://x.com/*` — the content script runs only on x.com to read the
  timeline you're viewing. No data leaves your browser; there is no server.

## Category

Social & Communication (or Fun)

## ⚠️ Pre-submission note (important)

The current icon/wordmark uses the X logo and the name "FloatX". Google's
review team can reject extensions that use a platform's trademark as their own
branding, and combined with reading x.com this may be flagged as impersonation.
Before submitting, strongly consider:
- an abstract icon (e.g. the glass tile + a generic "post" motif, no X glyph),
- and listing copy that clearly frames it as an independent, unaffiliated tool
  (already stated above).
