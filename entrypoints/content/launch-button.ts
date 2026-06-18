import { onAttention } from './attention';

/**
 * Inject the 🚿 FloatX launch button onto x.com.
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
  btn.setAttribute('aria-label', 'Open FloatX shower');
  btn.title = 'Open FloatX shower';
  // Build children with safe DOM methods (no innerHTML).
  const icon = document.createElement('span');
  icon.textContent = '🚿';
  icon.style.cssText = 'font-size:18px;line-height:1';
  const label = document.createElement('span');
  label.textContent = 'FloatX';
  btn.append(icon, label);
  // Hidden state = nudged up off-screen + transparent. Shown = slid down.
  btn.style.cssText = [
    'position: fixed',
    'top: 14px',
    'left: 50%',
    'transform: translate(-50%, -150%)',
    'display: flex',
    'align-items: center',
    'gap: 8px',
    'padding: 9px 16px',
    'border-radius: 9999px',
    'border: none',
    'cursor: pointer',
    'background: #1d9bf0',
    'color: #fff',
    'font: 600 14px system-ui, -apple-system, sans-serif',
    'box-shadow: 0 6px 20px rgba(0,0,0,0.35)',
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
    btn.style.transform = 'translate(-50%, -150%)';
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
  onAttention(() => {
    show();
    btn.style.boxShadow = '0 0 0 5px rgba(29,155,240,0.35), 0 6px 20px rgba(0,0,0,0.35)';
    setTimeout(() => {
      btn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)';
    }, 1800);
  });
}
