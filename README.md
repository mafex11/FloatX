# FloatX

an ambient shower of x posts, floating on your screen.

floatX drips one post at a time from your x timeline into a small,
always-on-top picture-in-picture window. hover it for spotify-style prev /
pause / next. it auto-advances on a timer you choose (1, 5, 15, or 30 min).

**no twitter api, no cost.** it reads posts straight from the rendered DOM of
the logged-in x.com tab you already have open — nothing to pay for, nothing to
authorize.

## how it works

- a **content script** on x.com harvests posts from your home timeline
  (parsing rendered `<article>` cards, deduped by tweet id) into an in-memory
  queue, gently auto-scrolling to refill when it runs low.
- a **Document Picture-in-Picture** window renders each post as a faithful
  mini-tweet card (avatar, name, @handle, text, images) and cycles through the
  queue on your interval.
- a **popup** holds settings: interval and filters (skip replies, keep reposts,
  keep media-only — ads are always skipped).

## install (unpacked)

1. download the latest zip from [releases](https://github.com/mafex11/FloatX/releases) and unzip it.
2. open `chrome://extensions` in chrome or edge.
3. turn on **developer mode**.
4. click **load unpacked** and pick the unzipped folder.
5. open `x.com`, then scroll up to reveal the FloatX pill (or open the popup and
   hit **open shower**).

## develop

```bash
pnpm install      # install deps
pnpm dev          # load the unpacked extension with hot reload (chrome)
pnpm compile      # type-check
pnpm build        # production build → .output/chrome-mv3
pnpm zip          # packaged zip for distribution
```

the website (landing + install page) lives in `website/`:

```bash
cd website && pnpm install && pnpm dev
```

## stack

WXT · React 19 · Tailwind CSS v4 · TypeScript. website on Astro.

## notes

- chrome / edge only — Document Picture-in-Picture isn't in firefox/safari yet.
- the shower must be opened by a click (browser requirement for PiP); after
  that, auto-advance and refill run on their own.
- x ships UI changes that can break DOM scraping. all selectors live in one
  file — `entrypoints/content/selectors.ts` — so patching is a one-file job.
- not affiliated with x corp. reads only your own open session.

## roadmap

- **phase 2:** a native macOS floating widget that reuses this harvester's post
  data over a local bridge. see `docs/`.

## license

MIT
