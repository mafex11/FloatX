import { onAttention } from './attention';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Build an X-logo SVG glyph (no emoji), sized to `size` px, in the given fill. */
function makeXGlyph(size: number, fill: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.style.display = 'block';
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute(
    'd',
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  );
  path.setAttribute('fill', fill);
  svg.appendChild(path);
  return svg;
}

/**
 * Inject the FloatX launch button onto x.com.
 *
 * Behavior: a pill at the TOP-CENTER that stays hidden until the user scrolls
 * UP, then slides down into view and auto-hides 5s later. This keeps it out of
 * the way during normal reading and surfaces it with the natural "I want to do
 * something" gesture of scrolling back up.
 *
 * Plain DOM in a self-created shadow root — no React, no WXT shadow-UI helper,
 * no web-accessible CSS — so nothing in the build can stop it registering.
 */
export function mountLaunchButton(onClick: () => void): void {
  // Avoid double-mounting if the script runs twice (SPA navigations).
  if (document.getElementById('floatx-launch-host')) return;

  const host = document.createElement('div');
  host.id = 'floatx-launch-host';
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });

  const btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Open FloatX');
  btn.title = 'Open FloatX';
  // Brand X glyph as inline SVG (no emoji), built with safe DOM methods.
  const icon = makeXGlyph(16, '#1d9bf0');
  const label = document.createElement('span');
  label.textContent = 'FloatX';
  btn.append(icon, label);
  // Hidden state = nudged up off-screen + transparent. Shown = slid down.
  // Liquid-glass dark: translucent dark fill, backdrop blur, hairline highlight.
  btn.style.cssText = [
    'position: fixed',
    'top: 72px',
    'left: 50%',
    'transform: translate(-50%, -200%)',
    'display: flex',
    'align-items: center',
    'gap: 8px',
    'padding: 10px 18px',
    'border-radius: 9999px',
    'border: 1px solid rgba(255,255,255,0.14)',
    'cursor: pointer',
    'background: rgba(22,24,28,0.55)',
    '-webkit-backdrop-filter: blur(22px) saturate(180%)',
    'backdrop-filter: blur(22px) saturate(180%)',
    'color: #f2f4f7',
    'font: 600 14px system-ui, -apple-system, sans-serif',
    'box-shadow: 0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
    'opacity: 0',
    'pointer-events: none',
    'transition: transform 0.28s cubic-bezier(0.2,0.8,0.2,1), opacity 0.28s ease',
  ].join(';');

  btn.addEventListener('click', onClick);
  shadow.appendChild(btn);
  document.body.appendChild(host);

  let hideTimer: number | undefined;
  const HIDE_AFTER = 5000;

  const show = () => {
    btn.style.transform = 'translate(-50%, 0)';
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hide, HIDE_AFTER);
  };

  const hide = () => {
    btn.style.transform = 'translate(-50%, -200%)';
    btn.style.opacity = '0';
    btn.style.pointerEvents = 'none';
  };

  // Reveal on scroll UP only. Use a small threshold so tiny jitters don't trip it.
  let lastY = window.scrollY;
  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      if (lastY - y > 6) show(); // moved up
      lastY = y;
    },
    { passive: true },
  );

  // Keep it visible (reset the timer) while the pointer is over it.
  btn.addEventListener('mouseenter', () => window.clearTimeout(hideTimer));
  btn.addEventListener('mouseleave', () => {
    hideTimer = window.setTimeout(hide, HIDE_AFTER);
  });

  // Surface it when the popup couldn't open the shower itself (no activation).
  const glassShadow = '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)';
  onAttention(() => {
    show();
    btn.style.boxShadow = `0 0 0 5px rgba(29,155,240,0.4), ${glassShadow}`;
    setTimeout(() => {
      btn.style.boxShadow = glassShadow;
    }, 1800);
  });
}
