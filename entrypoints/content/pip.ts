import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { ShowerApp, type ShowerApi } from '../pip-app/ShowerApp';

// Vite resolves this to the compiled CSS text at build time (`?inline`), so we
// can inject Tailwind into the PiP document, which does NOT inherit page styles.
import tailwindCss from '@/assets/tailwind.css?inline';

/** Minimal typing for the Document Picture-in-Picture API (not yet in lib.dom). */
interface DocumentPiP {
  requestWindow(opts?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}
declare global {
  interface Window {
    documentPictureInPicture?: DocumentPiP;
  }
}

let pipWindow: Window | null = null;
let root: Root | null = null;

export function isPipSupported(): boolean {
  return 'documentPictureInPicture' in window;
}

export function isPipOpen(): boolean {
  return pipWindow !== null && !pipWindow.closed;
}

/**
 * Open the shower PiP window and mount the React app into it.
 *
 * MUST be called from within a user gesture (click) — the Document-PiP API
 * rejects otherwise. If a window is already open, focus it instead.
 */
export async function openShower(api: ShowerApi): Promise<void> {
  if (!isPipSupported()) {
    throw new Error('Document Picture-in-Picture is not supported in this browser.');
  }
  if (isPipOpen()) {
    pipWindow!.focus();
    return;
  }

  pipWindow = await window.documentPictureInPicture!.requestWindow({
    width: 360,
    height: 420,
  });

  // Inject compiled Tailwind + a couple of base resets into the PiP document.
  const style = pipWindow.document.createElement('style');
  style.textContent = `${tailwindCss}\nhtml,body,#floatx-root{height:100%;margin:0;}body{overflow:hidden;background:#000;}`;
  pipWindow.document.head.appendChild(style);
  pipWindow.document.title = 'FloatX';

  const mount = pipWindow.document.createElement('div');
  mount.id = 'floatx-root';
  pipWindow.document.body.appendChild(mount);

  root = createRoot(mount);
  root.render(createElement(ShowerApp, { api }));

  // Tear down cleanly when the user closes the PiP window.
  pipWindow.addEventListener('pagehide', () => {
    root?.unmount();
    root = null;
    pipWindow = null;
  });
}

export function closeShower(): void {
  if (isPipOpen()) pipWindow!.close();
}
