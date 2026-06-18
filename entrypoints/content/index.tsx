import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { getSettings, watchSettings } from '@/lib/settings';
import { PostStore } from './store';
import { Harvester } from './harvester';
import { openShower } from './pip';
import { LaunchButton } from './launch-button';
import { pulseAttention } from './attention';
import type { ShowerApi } from '../pip-app/ShowerApp';

export default defineContentScript({
  matches: ['*://x.com/*', '*://*.x.com/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const settings = await getSettings();

    const store = new PostStore();
    const harvester = new Harvester(store, settings);
    harvester.start();

    // Track the live interval so the player can read it on each tick.
    let intervalMin = settings.intervalMin;
    const intervalListeners = new Set<() => void>();

    // Keep harvester + interval in sync with settings changes.
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
      counts: () => ({
        queueLength: store.queueLength,
        historyLength: store.historyLength,
      }),
      onChange: (cb) => store.subscribe(() => cb()),
      intervalMin: () => intervalMin,
      onIntervalChange: (cb) => {
        intervalListeners.add(cb);
        return () => intervalListeners.delete(cb);
      },
    };

    const launch = () => void openShower(api);

    // Launch surface 1: the popup's "open shower" button messages us. Document-PiP
    // needs a direct page gesture, which a cross-context message may not carry —
    // so if the open is rejected, pulse the floating button to point the user at
    // the path that always works. Reply tells the popup which happened.
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

    // Launch surface 2: injected floating button (style-isolated shadow root).
    const ui = await createShadowRootUi(ctx, {
      name: 'floatx-launch',
      position: 'overlay',
      anchor: 'body',
      onMount: (container) => {
        const root = createRoot(container);
        root.render(createElement(LaunchButton, { onClick: launch }));
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.mount();
  },
});
