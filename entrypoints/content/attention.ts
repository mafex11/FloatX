/**
 * Tiny pub/sub so the popup-triggered launch path can draw attention to the
 * floating button when Document-PiP can't be opened from a message (the API
 * requires a direct page gesture, which a cross-context message lacks).
 */
type Fn = () => void;
const listeners = new Set<Fn>();

export function onAttention(fn: Fn): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function pulseAttention(): void {
  listeners.forEach((fn) => fn());
}
