import { onAttention } from './attention';

/**
 * Inject the floating 🚿 launch button onto x.com.
 *
 * Deliberately plain DOM in a self-created shadow root — no React, no WXT
 * shadow-UI helper, no web-accessible CSS. That means nothing in the build
 * pipeline can stop it from registering: as long as the content script runs,
 * the button appears. Clicking it is the direct page gesture Document-PiP needs.
 */
export function mountLaunchButton(onClick: () => void): void {
  // Avoid double-mounting if the script somehow runs twice (SPA navigations).
  if (document.getElementById('floatx-launch-host')) return;

  const host = document.createElement('div');
  host.id = 'floatx-launch-host';
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });

  const btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Open FloatX shower');
  btn.title = 'Open FloatX shower';
  btn.textContent = '🚿';
  btn.style.cssText = [
    'position: fixed',
    'right: 20px',
    'bottom: 20px',
    'width: 52px',
    'height: 52px',
    'border-radius: 9999px',
    'border: none',
    'cursor: pointer',
    'background: #1d9bf0',
    'color: #fff',
    'font-size: 24px',
    'line-height: 1',
    'box-shadow: 0 4px 14px rgba(0,0,0,0.35)',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'transition: transform 0.25s ease, box-shadow 0.25s ease',
  ].join(';');

  btn.addEventListener('click', onClick);
  shadow.appendChild(btn);
  document.body.appendChild(host);

  // Pulse when the popup couldn't open the shower itself (no user activation).
  onAttention(() => {
    btn.style.transform = 'scale(1.15)';
    btn.style.boxShadow = '0 0 0 6px rgba(29,155,240,0.35), 0 4px 14px rgba(0,0,0,0.35)';
    setTimeout(() => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 14px rgba(0,0,0,0.35)';
    }, 1800);
  });
}
