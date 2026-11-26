/**
 * Whether a view should leave this key alone: Control with an arrow, pressed inside an element with
 * `data-system-arrows`. On a Mac those are the system's keys (Spaces, Mission Control) and never reach
 * a page, so a desktop built on the library marks itself to have its views behave the same in a browser
 * that does deliver them. Elsewhere Control with an arrow moves a view's current item. With Shift the
 * key stays the view's, for extending a selection.
 */
export function isSystemArrow(event: {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget;
}): boolean {
  return (
    event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey &&
    event.key.startsWith("Arrow") &&
    event.target instanceof Element &&
    event.target.closest("[data-system-arrows]") !== null
  );
}
