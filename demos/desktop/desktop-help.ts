import { requestDesktopEffects } from "./desktop-effects";

/**
 * Asking Help Viewer for something from another application: the Help menu's search field and its
 * "<App> Help" row. The request is kept until a Help Viewer window takes it, so it reaches a window
 * that opens only now as well as one already open.
 */

const HELP_REQUEST_EVENT = "macalicious:help-request";

let pending: string | null = null;

/** Opens Help Viewer, or brings it to the front, on a search for `query`. Only the newest counts. */
export function requestHelp(query: string): void {
  const text = query.trim();
  if (text === "" || typeof window === "undefined") return;
  pending = text;
  window.dispatchEvent(new CustomEvent(HELP_REQUEST_EVENT));
  requestDesktopEffects([{ open: "help-viewer" }]);
}

/** The search waiting for a Help Viewer window, taken. */
export function takeHelpRequest(): string | null {
  const taken = pending;
  pending = null;
  return taken;
}

/** Hears that a search is waiting, while a Help Viewer window is open. Returns the cleanup. */
export function onHelpRequest(listener: () => void): () => void {
  window.addEventListener(HELP_REQUEST_EVENT, listener);
  return () => window.removeEventListener(HELP_REQUEST_EVENT, listener);
}
