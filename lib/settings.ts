import { storage } from 'wxt/utils/storage';
import { DEFAULT_SETTINGS, clampIntervalSec, type Settings } from './types';

/**
 * Single source of truth for persisted settings. Backed by chrome.storage.local
 * via wxt/storage, so the popup, content script, and player all stay in sync.
 */
export const settingsItem = storage.defineItem<Settings>('local:floatx-settings', {
  fallback: DEFAULT_SETTINGS,
  version: 2,
  migrations: {
    // v1 stored intervalMin (1/5/15/30). v2 stores intervalSec (custom).
    2: (old: unknown): Settings => {
      const o = (old ?? {}) as Record<string, unknown>;
      const min = typeof o.intervalMin === 'number' ? o.intervalMin : 5;
      return {
        intervalSec: clampIntervalSec(min * 60),
        skipReplies: o.skipReplies !== false,
        keepReposts: o.keepReposts !== false,
        keepMediaOnly: o.keepMediaOnly !== false,
      };
    },
  },
});

export async function getSettings(): Promise<Settings> {
  return settingsItem.getValue();
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await settingsItem.getValue()), ...patch };
  await settingsItem.setValue(next);
  return next;
}

/**
 * Subscribe to settings changes. Returns an unwatch function.
 * Fires whenever any field changes, from any extension context.
 */
export function watchSettings(cb: (next: Settings) => void): () => void {
  return settingsItem.watch(cb);
}

/** Quick-pick presets shown as buttons, in seconds, with display labels. */
export const INTERVAL_PRESETS: { sec: number; label: string }[] = [
  { sec: 10, label: '10s' },
  { sec: 30, label: '30s' },
  { sec: 60, label: '1m' },
  { sec: 300, label: '5m' },
  { sec: 900, label: '15m' },
];
