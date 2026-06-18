/**
 * Background service worker.
 *
 * The toolbar icon opens the settings popup (it sets `default_popup`), so
 * `action.onClicked` does NOT fire — there's nothing to relay here. Launching
 * the shower happens page-side, where the Document-PiP API has the transient
 * user activation it requires:
 *
 *   - the floating FloatX button injected on x.com (a direct page-context gesture), and
 *   - the "open shower" button in the popup, which messages the content script.
 *
 * This worker only handles the housekeeping case: the popup asking us to open
 * x.com when the active tab isn't already on it.
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'floatx:open-x') {
      void browser.tabs.create({ url: 'https://x.com/home' });
    }
  });
});
