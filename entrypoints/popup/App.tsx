import { useEffect, useState } from 'react';
import type { Settings } from '@/lib/types';
import { getSettings, setSettings, watchSettings, INTERVAL_OPTIONS } from '@/lib/settings';

type LaunchHint = null | 'use-button' | 'not-on-x';

export function App() {
  const [settings, setLocal] = useState<Settings | null>(null);
  const [hint, setHint] = useState<LaunchHint>(null);

  useEffect(() => {
    getSettings().then(setLocal);
    return watchSettings(setLocal);
  }, []);

  const update = (patch: Partial<Settings>) => {
    setLocal((s) => (s ? { ...s, ...patch } : s)); // optimistic
    void setSettings(patch);
  };

  // Ask the active tab's content script to open the shower. Picture-in-Picture
  // may refuse to open from a message (it wants a direct page gesture); in that
  // case the content script pulses its floating button and we say so here.
  const openShower = async () => {
    setHint(null);
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const onX = tab?.url ? /:\/\/([^/]+\.)?x\.com\//.test(tab.url) : false;
    if (!tab?.id || !onX) {
      setHint('not-on-x');
      void browser.runtime.sendMessage({ type: 'floatx:open-x' });
      return;
    }
    try {
      const res = await browser.tabs.sendMessage(tab.id, { type: 'floatx:open' });
      if (res?.ok) {
        window.close();
      } else {
        setHint('use-button');
      }
    } catch {
      setHint('use-button');
    }
  };

  if (!settings) {
    return <div className="w-72 bg-black p-4 text-sm text-neutral-400">loading…</div>;
  }

  return (
    <div className="w-72 space-y-4 bg-black p-4 font-sans text-white">
      <header className="flex items-center gap-2">
        <span className="text-lg">🚿</span>
        <h1 className="text-base font-bold">FloatX</h1>
      </header>

      <button
        type="button"
        onClick={openShower}
        className="w-full rounded-lg bg-[#1d9bf0] py-2 text-sm font-semibold text-white transition hover:bg-[#1a8cd8]"
      >
        open shower
      </button>
      {hint === 'use-button' && (
        <p className="-mt-2 text-xs text-amber-400">
          click the 🚿 button on the page to start (your browser needs a click on
          x.com itself).
        </p>
      )}
      {hint === 'not-on-x' && (
        <p className="-mt-2 text-xs text-amber-400">opening x.com — try again from there.</p>
      )}

      <section className="space-y-2">
        <label className="block text-xs uppercase tracking-wide text-neutral-400">
          advance every
        </label>
        <div className="grid grid-cols-4 gap-1.5">
          {INTERVAL_OPTIONS.map((min) => (
            <button
              key={min}
              type="button"
              onClick={() => update({ intervalMin: min })}
              className={`rounded-md py-1.5 text-sm font-medium transition ${
                settings.intervalMin === min
                  ? 'bg-[#1d9bf0] text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              {min}m
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-1">
        <span className="block text-xs uppercase tracking-wide text-neutral-400">
          filters
        </span>
        <Toggle
          label="skip replies"
          checked={settings.skipReplies}
          onChange={(v) => update({ skipReplies: v })}
        />
        <Toggle
          label="keep reposts"
          checked={settings.keepReposts}
          onChange={(v) => update({ keepReposts: v })}
        />
        <Toggle
          label="keep media-only posts"
          checked={settings.keepMediaOnly}
          onChange={(v) => update({ keepMediaOnly: v })}
        />
        <p className="pt-1 text-xs text-neutral-500">ads are always skipped.</p>
      </section>

      <footer className="border-t border-neutral-800 pt-3 text-xs text-neutral-500">
        open x.com, then click the 🚿 button or the toolbar icon.
      </footer>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${
          checked ? 'bg-[#1d9bf0]' : 'bg-neutral-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}
