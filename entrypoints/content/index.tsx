import { getSettings, watchSettings } from '@/lib/settings';
import { PostStore } from './store';
import { Harvester } from './harvester';
import { openShower } from './pip';
import { mountLaunchButton } from './launch-button';
import { pulseAttention } from './attention';
import type { ShowerApi } from '../pip-app/ShowerApp';

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
  const harvester = new Harvester(store, settings);
  harvester.start();
  console.log('[FloatX] harvester started');

  // Track the live interval so the player can read it on each tick.
  let intervalMin = settings.intervalMin;
  const intervalListeners = new Set<() => void>();

  watchSettings((next) => {
    harvester.updateSettings(next);
    if (next.intervalMin !== intervalMin) {
      intervalMin = next.intervalMin;
      intervalListeners.forEach((cb) => cb());
    }
  });

  // The bridge the PiP React app uses to reach the store + settings.
  const api: ShowerApi = {
    next: () => store.next(),
    prev: () => store.prev(),
    current: () => store.current,
    counts: () => ({ queueLength: store.queueLength, historyLength: store.historyLength }),
    onChange: (cb) => store.subscribe(() => cb()),
    intervalMin: () => intervalMin,
    onIntervalChange: (cb) => {
      intervalListeners.add(cb);
      return () => intervalListeners.delete(cb);
    },
  };

  const launch = () => {
    openShower(api).catch((err) => console.error('[FloatX] openShower failed', err));
  };

  // Launch surface 1: the popup's "open shower" button messages us. Document-PiP
  // needs a direct page gesture, which a cross-context message may not carry — so
  // if the open is rejected, pulse the floating button to point the user there.
  browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type !== 'floatx:open') return;
    openShower(api).then(
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
