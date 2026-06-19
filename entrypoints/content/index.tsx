import { getSettings, watchSettings } from '@/lib/settings';
import { PostStore } from './store';
import { Harvester } from './harvester';
import { openShower, type StoreBridge } from './pip';
import { mountLaunchButton } from './launch-button';
import { pulseAttention } from './attention';

export default defineContentScript({
  matches: ['*://x.com/*', '*://*.x.com/*'],
  runAt: 'document_idle',

  main() {
    // Self-announce so it's instantly obvious in the console whether the content
    // script is actually running on the page.
    console.log('[FloatX] content script loaded');

    // Everything is wrapped so a single failure can never silently kill the
    // whole script (which would take the launch button + harvester with it).
    try {
      void start();
    } catch (err) {
      console.error('[FloatX] fatal error during start()', err);
    }
  },
});

async function start() {
  const settings = await getSettings();

  const store = new PostStore();

  // Forward harvested posts to the native Mac app via the background worker
  // (which owns the localhost WebSocket; the page itself can't open one).
  store.onUpsert = (post) => {
    try {
      void browser.runtime.sendMessage({ type: 'floatx:post', post });
    } catch {
      /* worker asleep or extension reloading; harmless */
    }
  };

  const harvester = new Harvester(store, settings);
  harvester.start();
  console.log('[FloatX] harvester started');

  // Track the live interval so the player can read it on each tick.
  let intervalSec = settings.intervalSec;

  watchSettings((next) => {
    harvester.updateSettings(next);
    intervalSec = next.intervalSec;
  });

  // The bridge the video-PiP player uses to reach the store + settings.
  const bridge: StoreBridge = {
    next: () => store.next(),
    prev: () => store.prev(),
    current: () => store.current,
    counts: () => ({ queueLength: store.queueLength, historyLength: store.historyLength }),
    onChange: (cb) => store.subscribe(() => cb()),
    intervalSec: () => intervalSec,
  };

  const launch = () => {
    console.log('[FloatX] launch clicked; queue=', store.queueLength, 'history=', store.historyLength);
    openShower(bridge).then(
      () => console.log('[FloatX] shower opened'),
      (err) => {
        console.error('[FloatX] openShower failed:', err);
        // Surface it — a silent failure on click is the worst UX.
        alert('FloatX could not open the shower:\n' + (err?.message ?? err));
      },
    );
  };

  // Launch surface 1: the popup's "open shower" button messages us. PiP needs a
  // direct page gesture, which a cross-context message may not carry — so if the
  // open is rejected, pulse the floating button to point the user there.
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'floatx:open') return;
    openShower(bridge).then(
      () => sendResponse({ ok: true }),
      () => {
        pulseAttention();
        sendResponse({ ok: false, reason: 'gesture-required' });
      },
    );
    return true; // keep the message channel open for the async response
  });

  // Launch surface 2: injected floating button. Plain DOM in a shadow root we
  // create ourselves — no dependency on WXT shadow UI / web-accessible CSS, so
  // it can't fail to register.
  mountLaunchButton(launch);
  console.log('[FloatX] launch button mounted');
}
