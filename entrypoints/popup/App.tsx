import { useEffect, useState } from 'react';
import type { Settings } from '@/lib/types';
import { getSettings, setSettings, watchSettings, INTERVAL_OPTIONS } from '@/lib/settings';

type LaunchHint = null | 'use-button' | 'not-on-x';

// Liquid-glass dark tokens, shared across the popup surfaces.
const glass = 'border border-white/10 bg-white/[0.06] backdrop-blur-xl';

/** Brand X-logo glyph (no emoji). */
function XGlyph({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

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

  return (
    <div className="relative w-72 overflow-hidden font-sans text-white">
      {/* Ambient gradient backdrop behind the glass. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,#1d3a5f_0%,#0a0d12_55%,#000_100%)]" />
      <div className="pointer-events-none absolute -left-10 top-8 h-32 w-32 rounded-full bg-[#1d9bf0]/25 blur-3xl" />

      <div className="relative space-y-3.5 p-4">
        {!settings ? (
          <div className="py-6 text-center text-sm text-white/50">loading…</div>
        ) : (
          <>
            <header className="flex items-center gap-2">
              <XGlyph size={18} className="text-[#1d9bf0]" />
              <h1 className="text-base font-bold tracking-tight">FloatX</h1>
            </header>

            <button
              type="button"
              onClick={openShower}
              className="w-full rounded-xl border border-white/10 bg-[#1d9bf0]/90 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1d9bf0]/20 backdrop-blur-xl transition hover:bg-[#1d9bf0]"
            >
              open shower
            </button>
            {hint === 'use-button' && (
              <p className="text-xs text-amber-300/90">
                click the FloatX pill on the page to start (your browser needs a click on x.com
                itself).
              </p>
            )}
            {hint === 'not-on-x' && (
              <p className="text-xs text-amber-300/90">opening x.com — try again from there.</p>
            )}

            <section className={`space-y-2 rounded-xl p-3 ${glass}`}>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-white/45">
                advance every
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {INTERVAL_OPTIONS.map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => update({ intervalMin: min })}
                    className={`rounded-lg py-1.5 text-sm font-medium transition ${
                      settings.intervalMin === min
                        ? 'bg-[#1d9bf0] text-white shadow-md shadow-[#1d9bf0]/30'
                        : 'bg-white/[0.04] text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </section>

            <section className={`space-y-0.5 rounded-xl p-3 ${glass}`}>
              <span className="block pb-1 text-[11px] font-medium uppercase tracking-wider text-white/45">
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
              <p className="pt-1.5 text-xs text-white/35">ads are always skipped.</p>
            </section>

            <footer className="px-1 text-[11px] leading-relaxed text-white/35">
              scroll up on x.com to reveal the FloatX pill, or use the toolbar icon.
            </footer>
          </>
        )}
      </div>
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
      <span className="text-sm text-white/85">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full border transition ${
          checked ? 'border-transparent bg-[#1d9bf0]' : 'border-white/10 bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}
