import { storage } from 'wxt/utils/storage';
import { DEFAULT_SETTINGS, type Settings } from './types';

/**
 * Single source of truth for persisted settings. Backed by chrome.storage.local
 * via wxt/storage, so the popup, content script, and player all stay in sync.
 */
export const settingsItem = storage.defineItem<Settings>('local:floatx-settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
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

export const INTERVAL_OPTIONS: Settings['intervalMin'][] = [1, 5, 15, 30];
