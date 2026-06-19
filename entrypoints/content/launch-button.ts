import { onAttention } from './attention';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Build the FloatX logo mark — the X glyph above a blue auto-advance bar.
 * Sized to `size` px. Built with safe DOM methods.
 */
function makeLogo(size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.style.display = 'block';
  const el = (tag: string, attrs: Record<string, string>) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const x = el('path', {
    d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
    fill: '#f2f4f7',
    transform: 'translate(2.4,0) scale(0.8)',
  });
  svg.appendChild(x);
  svg.appendChild(el('rect', { x: '5', y: '21.2', width: '14', height: '2', rx: '1', fill: '#1d9bf0' }));
  return svg;
}

/**
 * Inject the FloatX launch button onto x.com.
 *
 * Behavior: a glassy pill at the TOP-CENTER. It auto-reveals for ~6s on every
 * page load (so it's always discoverable), and afterwards surfaces whenever the
 * user scrolls UP — the natural "I want to do something" gesture. A keyboard
 * shortcut (Alt+Shift+X) opens the shower instantly from anywhere.
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
  // FloatX logo mark as inline SVG, built with safe DOM methods.
  const icon = makeLogo(22);
  const label = document.createElement('span');
  label.textContent = 'FloatX';
  // Subtle keyboard-shortcut hint chip inside the pill.
  const kbd = document.createElement('span');
  kbd.textContent = '⌥⇧X';
  kbd.style.cssText = [
    'margin-left: 6px',
    'padding: 3px 8px',
    'border-radius: 7px',
    'background: rgba(255,255,255,0.10)',
    'border: 1px solid rgba(255,255,255,0.12)',
    'font: 600 13px ui-monospace, SFMono-Regular, Menlo, monospace',
    'color: rgba(255,255,255,0.65)',
    'line-height: 1.4',
  ].join(';');
  btn.append(icon, label, kbd);
  // Hidden state = nudged up off-screen + transparent. Shown = slid down.
  // Liquid-glass dark: very translucent fill, heavy backdrop blur, hairline edge.
  btn.style.cssText = [
    'position: fixed',
    'top: 76px',
    'left: 50%',
    'transform: translate(-50%, -200%)',
    'display: flex',
    'align-items: center',
    'gap: 11px',
    'padding: 14px 24px',
    'border-radius: 9999px',
    'border: 1px solid rgba(255,255,255,0.16)',
    'cursor: pointer',
    'background: rgba(20,22,26,0.32)',
    '-webkit-backdrop-filter: blur(32px) saturate(180%)',
    'backdrop-filter: blur(32px) saturate(180%)',
    'color: #f2f4f7',
    'font: 600 17px system-ui, -apple-system, sans-serif',
    'box-shadow: 0 10px 38px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.22)',
    'opacity: 0',
    'pointer-events: none',
    'transition: transform 0.32s cubic-bezier(0.2,0.8,0.2,1), opacity 0.32s ease',
  ].join(';');

  btn.addEventListener('click', onClick);
  shadow.appendChild(btn);
  document.body.appendChild(host);

  let hideTimer: number | undefined;
  const HIDE_AFTER = 6000;

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

  // Auto-reveal on every page load so the pill is always discoverable, then it
  // settles into the scroll-up behavior below. Double rAF so the entry slide
  // animates from the hidden state rather than snapping.
  requestAnimationFrame(() => requestAnimationFrame(show));

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

  // Keyboard shortcut: Alt+Shift+X opens the shower from anywhere on x.com.
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.code === 'KeyX' || e.key.toLowerCase() === 'x')) {
      e.preventDefault();
      onClick();
    }
  });

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
