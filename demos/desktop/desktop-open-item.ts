import { useEffect, useRef } from "react";

/**
 * Opening one of a person's things in the application that keeps it, from Spotlight, Siri or
 * Notification Center: a contact in Contacts, a note in Notes, an event in Calendar. The caller
 * brings the application forward; the request is kept here until its window takes it, so it reaches
 * a window that opens only now as well as one that is already open. Drive files go through
 * `finder-open.ts` instead.
 *
 * An application takes them with `useOpenItemRequests("contacts", (request) => show(request.id))`.
 */

/** A request to show one item of an application. `id` is the item's id in its own document. */
export interface OpenItemRequest {
  app: string;
  id: string;
  /** What the item is called, for an application that has to say it cannot find it. */
  title: string;
}

const OPEN_ITEM_EVENT = "macalicious:open-item";

/** The most requests kept for one application whose window has not opened; the oldest go first. */
const MOST_PENDING = 20;

const pending = new Map<string, OpenItemRequest[]>();

/** Asks the application to show the item: told to its open window, or kept for the one to come. */
export function openItem(request: OpenItemRequest): void {
  const event = new CustomEvent(OPEN_ITEM_EVENT, { cancelable: true, detail: request });
  window.dispatchEvent(event);
  if (!event.defaultPrevented) {
    const waiting = pending.get(request.app) ?? [];
    waiting.push(request);
    pending.set(request.app, waiting.slice(-MOST_PENDING));
  }
}

/** The requests waiting for this application's window, oldest first: each is taken once. */
export function takeOpenItemRequests(app: string): OpenItemRequest[] {
  const waiting = pending.get(app) ?? [];
  pending.delete(app);
  return waiting;
}

/** Hears this application's requests while its window is open. Answers the function that stops. */
export function onOpenItemRequest(
  app: string,
  listener: (request: OpenItemRequest) => void,
): () => void {
  const hear = (event: Event) => {
    const { detail } = event as CustomEvent<OpenItemRequest>;
    if (event.defaultPrevented || detail.app !== app) return;
    event.preventDefault();
    listener(detail);
  };
  window.addEventListener(OPEN_ITEM_EVENT, hear);
  return () => window.removeEventListener(OPEN_ITEM_EVENT, hear);
}

/** For an application's window: `show` hears each item asked of it, waiting or still to come. */
export function useOpenItemRequests(app: string, show: (request: OpenItemRequest) => void): void {
  const latest = useRef(show);
  latest.current = show;
  useEffect(() => {
    for (const request of takeOpenItemRequests(app)) latest.current(request);
    return onOpenItemRequest(app, (request) => latest.current(request));
  }, [app]);
}
