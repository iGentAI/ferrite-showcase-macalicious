/**
 * A request, from outside the System Preferences window, to show one pane: the menu bar's status menus ("Open Network
 * Preferences…", "Open Date & Time Preferences…") ask for the pane they name and then open or bring forward the window,
 * which shows that pane: it opens on it, or, already open, goes to it as a click on its icon would (Back returns).
 * Only an id of the catalogue is kept; the window takes the request once.
 */
import { CATALOGUE } from "./catalogue";

let pending: string | null = null;
const listeners = new Set<() => void>();

/** Ask the System Preferences window to show the pane `id` (an id of the catalogue, such as `"network"`). */
export function requestPane(id: string): void {
  if (!CATALOGUE.has(id)) return;
  pending = id;
  for (const listener of listeners) listener();
}

/** The pane asked for and not yet shown, without taking it. */
export function peekPaneRequest(): string | null {
  return pending;
}

/** The pane asked for, taken: a second call answers `null` until the next request. */
export function takePaneRequest(): string | null {
  const id = pending;
  pending = null;
  return id;
}

/** Hear each request as it is made. */
export function subscribePaneRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
