/**
 * Asking the desktop to show an overlay or an overview from outside it: a Hot Corner, the Window
 * menu's tiling. One
 * window event, so that nothing the plain desktop loads depends on the code that asks.
 */
const OVERLAY_EVENT = "macalicious:desktop-overlay";

export type RequestedOverlay =
  | "launchpad"
  | "siri"
  | "notification-center"
  | "mission-control"
  | "application-windows"
  | "show-desktop"
  | "tile-left"
  | "tile-right";

export function requestDesktopOverlay(overlay: RequestedOverlay): void {
  window.dispatchEvent(new CustomEvent(OVERLAY_EVENT, { detail: overlay }));
}

/** Hear the overlays asked for. Returns the cleanup. */
export function onDesktopOverlayRequest(listener: (overlay: RequestedOverlay) => void): () => void {
  const hear = (event: Event) => listener((event as CustomEvent<RequestedOverlay>).detail);
  window.addEventListener(OVERLAY_EVENT, hear);
  return () => window.removeEventListener(OVERLAY_EVENT, hear);
}
