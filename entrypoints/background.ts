/**
 * Background service worker.
 *
 * Two jobs:
 *  1. Housekeeping: the popup asking us to open x.com when the active tab isn't
 *     already on it.
 *  2. Native bridge: forward harvested posts to the FloatX Mac app over a local
 *     WebSocket. The content script can't open a socket (x.com CSP blocks
 *     connect-src), but this worker has no page CSP — so it's the bridge.
 *     Content script → `floatx:post` message → here → ws://127.0.0.1:PORT.
 */

// Ports the Mac app rendezvous on (WSServer.ports). We try them in order.
const BRIDGE_PORTS = [8787, 8788, 8789, 8790, 8791];

let socket: WebSocket | null = null;
let portIndex = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

function bridgeConnected(): boolean {
  return socket !== null && socket.readyState === WebSocket.OPEN;
}

function connectBridge(): void {
  if (bridgeConnected() || (socket && socket.readyState === WebSocket.CONNECTING)) return;

  const port = BRIDGE_PORTS[portIndex % BRIDGE_PORTS.length];
  try {
    socket = new WebSocket(`ws://127.0.0.1:${port}`);
  } catch {
    scheduleReconnect(true);
    return;
  }

  socket.addEventListener('open', () => {
    // Connected — stick with this port.
  });
  socket.addEventListener('close', () => {
    socket = null;
    scheduleReconnect(true);
  });
  socket.addEventListener('error', () => {
    // onclose follows; advance to the next port so we sweep the range.
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
    socket = null;
    portIndex += 1;
    scheduleReconnect(true);
  });
}

function scheduleReconnect(advanceQuickly: boolean): void {
  clearTimeout(reconnectTimer);
  // Sweep ports fast; once we give up a full pass, back off so an absent app
  // doesn't cause a busy loop.
  const sweptFullRange = portIndex >= BRIDGE_PORTS.length;
  const delay = advanceQuickly && !sweptFullRange ? 300 : 4000;
  if (sweptFullRange) portIndex = 0;
  reconnectTimer = setTimeout(connectBridge, delay);
}

function sendToBridge(post: unknown): void {
  if (!bridgeConnected()) {
    connectBridge();
    return;
  }
  try {
    socket!.send(JSON.stringify(post));
  } catch {
    /* dropped frame; reconnect logic will recover */
  }
}

export default defineBackground(() => {
  connectBridge();

  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'floatx:open-x') {
      void browser.tabs.create({ url: 'https://x.com/home' });
    } else if (msg?.type === 'floatx:post' && msg.post) {
      sendToBridge(msg.post);
    }
  });
});
