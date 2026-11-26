import { requestDesktopEffects } from "./desktop-effects";

/**
 * One application asking another to reach a person: Contacts' message, mail and call buttons. The
 * request is kept until the application takes it, so it reaches a window that opens only now as
 * well as one already open, in the same shape as `desktop-share-link.tsx`.
 */

const ADDRESS_EVENT = "macalicious:address-request";
const MAX_PENDING = 20;

/** Who to reach, through which application. */
export interface AddressRequest {
  app: string;
  /** The account name, or the address. */
  to: string;
  /** The person's name, as the application shows it. */
  name: string;
  /** For FaceTime: a call with or without video. */
  kind?: "audio" | "video";
  /** For Mail: what the new message is about. */
  subject?: string;
  /** For Messages: what the new message says, for the person to send. */
  text?: string;
}

const pending: AddressRequest[] = [];

/** Keeps `request` for its application, tells a window that is open, and opens the application. */
export function askToReach(request: AddressRequest): void {
  pending.push(request);
  if (pending.length > MAX_PENDING) pending.splice(0, pending.length - MAX_PENDING);
  window.dispatchEvent(new CustomEvent(ADDRESS_EVENT, { detail: request }));
  requestDesktopEffects([{ open: request.app }]);
}

/** The requests kept for `app`, oldest first, taken: its window takes them when it opens. */
export function takeAddressRequests(app: string): AddressRequest[] {
  const taken = pending.filter((request) => request.app === app);
  for (const request of taken) pending.splice(pending.indexOf(request), 1);
  return taken;
}

/** Hears every request for `app` from now on, which is then not kept as well. Answers the stop. */
export function onAddressRequest(
  app: string,
  listener: (request: AddressRequest) => void,
): () => void {
  const hear = (event: Event) => {
    const request = (event as CustomEvent<AddressRequest>).detail;
    if (request.app !== app) return;
    const at = pending.indexOf(request);
    if (at < 0) return;
    pending.splice(at, 1);
    listener(request);
  };
  window.addEventListener(ADDRESS_EVENT, hear);
  return () => window.removeEventListener(ADDRESS_EVENT, hear);
}
