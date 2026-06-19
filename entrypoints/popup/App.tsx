import { useEffect, useState } from 'react';
import { clampIntervalSec, INTERVAL_MIN_SEC, INTERVAL_MAX_SEC, type Settings } from '@/lib/types';
import { getSettings, setSettings, watchSettings, INTERVAL_PRESETS } from '@/lib/settings';

type LaunchHint = null | 'use-button' | 'not-on-x';

// Liquid-glass dark tokens, shared across the popup surfaces.
const glass = 'border border-white/10 bg-white/[0.06] backdrop-blur-xl';

/** FloatX logo mark — the X glyph above a blue auto-advance bar. */
function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        transform="translate(2.4,0) scale(0.8)"
        fill="#f2f4f7"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
      <rect x="5" y="21.2" width="14" height="2" rx="1" fill="#1d9bf0" />
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
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Logo size={20} />
                <h1 className="text-base font-bold tracking-tight">FloatX</h1>
              </div>
              <button
                type="button"
                onClick={openShower}
                title="Open the shower on the current x.com tab"
                className="rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-white/80 transition hover:bg-white/12"
              >
                open
              </button>
            </header>

            {hint === 'use-button' && (
              <p className="text-xs text-amber-300/90">
                use the FloatX pill on the page or press ⌥⇧X — your browser needs a click on x.com
                itself to start.
              </p>
            )}
            {hint === 'not-on-x' && (
              <p className="text-xs text-amber-300/90">opening x.com — try again from there.</p>
            )}

            <section className={`space-y-2.5 rounded-xl p-3 ${glass}`}>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-white/45">
                advance every
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {INTERVAL_PRESETS.map((p) => (
                  <button
                    key={p.sec}
                    type="button"
                    onClick={() => update({ intervalSec: p.sec })}
                    className={`rounded-lg py-1.5 text-sm font-medium transition ${
                      settings.intervalSec === p.sec
                        ? 'bg-[#1d9bf0] text-white shadow-md shadow-[#1d9bf0]/30'
                        : 'bg-white/[0.04] text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <IntervalInput
                value={settings.intervalSec}
                onCommit={(sec) => update({ intervalSec: sec })}
              />
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
              on x.com the FloatX pill shows on load and on scroll-up. shortcut:{' '}
              <span className="rounded bg-white/10 px-1 py-0.5 font-mono text-white/55">⌥⇧X</span>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

/** Custom seconds input. Edits freely while typing, clamps + commits on blur/Enter. */
function IntervalInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (sec: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  // Reflect external changes (preset clicks, other contexts) into the field.
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const n = clampIntervalSec(parseInt(draft, 10));
    onCommit(n);
    setDraft(String(n));
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/55">custom</span>
      <input
        type="number"
        inputMode="numeric"
        min={INTERVAL_MIN_SEC}
        max={INTERVAL_MAX_SEC}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-20 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-sm text-white outline-none focus:border-[#1d9bf0]/60"
      />
      <span className="text-xs text-white/45">seconds</span>
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
