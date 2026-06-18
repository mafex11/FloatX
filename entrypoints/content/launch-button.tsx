import { useEffect, useState } from 'react';
import { onAttention } from './attention';

/**
 * The floating launch button injected onto x.com. Clicking it opens the shower.
 *
 * Rendered into a WXT shadow-root UI (style-isolated from the page). The click
 * handler is the user gesture the Document-PiP API requires — this is the
 * always-works launch path. When the popup tries to launch but the browser
 * withholds activation, `pulseAttention()` fires and we flash this button.
 */
export function LaunchButton({ onClick }: { onClick: () => void }) {
  const [pulsing, setPulsing] = useState(false);

  useEffect(
    () =>
      onAttention(() => {
        setPulsing(true);
        window.setTimeout(() => setPulsing(false), 1800);
      }),
    [],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open FloatX shower"
      title="Open FloatX shower"
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: 2147483647,
        width: '52px',
        height: '52px',
        borderRadius: '9999px',
        border: 'none',
        cursor: 'pointer',
        background: '#1d9bf0',
        color: '#fff',
        fontSize: '22px',
        boxShadow: pulsing
          ? '0 0 0 6px rgba(29,155,240,0.35), 0 4px 14px rgba(0,0,0,0.35)'
          : '0 4px 14px rgba(0,0,0,0.35)',
        transform: pulsing ? 'scale(1.12)' : 'scale(1)',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      🚿
    </button>
  );
}
