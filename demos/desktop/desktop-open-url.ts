import { requestDesktopEffects } from "./desktop-effects";
import { askToReach } from "./desktop-reach";

/**
 * Opening a web address in Safari from another application: a link in Mail, Messages or Notes, a
 * story in News, a search in Spotlight. The application asks (`openUrl`), the desktop opens Safari
 * (its `open` effect, `desktop-effects.ts`, which only brings an open Safari to the front), and a
 * Safari window takes the address in a new tab. The request is kept here until a Safari window
 * takes it, so it reaches a window that opens only now (it takes the queue once its kept tabs have
 * loaded) as well as one already open (which hears `OPEN_URL_EVENT`). The same shape as Finder's
 * `finder-open.ts`.
 *
 * Only absolute http(s) addresses are ever handed on (`linkAddress`): nothing that would run in
 * the desktop page (`javascript:`), carry its own content (`data:`, `blob:`), reach the visitor's
 * machine (`file:`) or hide its real host behind a user name (`https://apple.com@evil.test/`).
 * Safari judges the address again before it opens anything. A `mailto:` link goes to Mail instead,
 * as a new message.
 */

/** The window event a Safari window hears a request by. `detail` is an {@link OpenUrlRequest};
 * the window that takes it cancels the event. News's `openStoryLink` sends `{ url }` alone. */
export const OPEN_URL_EVENT = "macalicious:open-url";

/** The longest address handed on: Safari keeps no longer one (`MAX_URL` in its server module). */
export const MAX_LINK_LENGTH = 4096;

/** The most requests kept for a Safari window that has not opened yet; the oldest go first. */
export const MAX_PENDING = 20;

/** A request to open a web address in Safari: the address and the application that asked. */
export interface OpenUrlRequest {
  url: string;
  from: string;
}

const pending: OpenUrlRequest[] = [];

/**
 * The address a link may open, normalised (`https://Example.com` is `https://example.com/`), or
 * `null` for anything that is not an absolute http(s) address with a host: other schemes,
 * relative or malformed text, an address with a user name or password, or one longer than
 * {@link MAX_LINK_LENGTH}. Surrounding white space is ignored.
 */
export function linkAddress(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const typed = text.trim();
  if (typed === "" || typed.length > MAX_LINK_LENGTH) return null;
  if (!/^https?:\/\//i.test(typed)) return null;
  let url: URL;
  try {
    url = new URL(typed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.hostname === "" || url.username !== "" || url.password !== "") return null;
  return url.href.length > MAX_LINK_LENGTH ? null : url.href;
}

/**
 * Asks Safari to open `url` in a new tab, for the application `from` (`"mail"`, `"notes"`, ...):
 * queued for a Safari window, told at once to the one open, and Safari is opened or brought to the
 * front. Returns the request, or `null` when the address is refused (`linkAddress`) and nothing
 * was asked. The caller has already stopped the link's own navigation (`preventDefault`).
 */
export function openUrl(url: string, from: string): OpenUrlRequest | null {
  if (typeof window !== "undefined" && /^mailto:/i.test(url)) {
    const [address = "", query = ""] = url.slice("mailto:".length).split("?");
    const to = decodeURIComponent(address);
    if (to === "") return null;
    const subject = new URLSearchParams(query).get("subject") ?? undefined;
    askToReach({ app: "mail", to, name: to, subject });
    return { url, from };
  }
  const address = linkAddress(url);
  if (address === null || typeof window === "undefined") return null;
  const request: OpenUrlRequest = { url: address, from };
  pending.push(request);
  if (pending.length > MAX_PENDING) pending.splice(0, pending.length - MAX_PENDING);
  window.dispatchEvent(new CustomEvent(OPEN_URL_EVENT, { cancelable: true, detail: request }));
  requestDesktopEffects([{ open: "safari" }]);
  return request;
}

/** The requests waiting for a Safari window, oldest first, taken: a window takes each once. */
export function takeOpenUrlRequests(): OpenUrlRequest[] {
  return pending.splice(0, pending.length);
}

/**
 * Hear the requests while a Safari window is open and ready to take them. Returns the cleanup. A
 * request goes to one window: the first to hear it takes it and cancels the event, and the others
 * leave it. The older shape News sends (`{ url }`, not queued here) is taken the same way, so News
 * knows from the cancelled event that Safari took it.
 */
export function onOpenUrlRequest(listener: (request: OpenUrlRequest) => void): () => void {
  const hear = (event: Event) => {
    if (event.defaultPrevented) return;
    const detail = (event as CustomEvent<unknown>).detail as {
      url?: unknown;
      from?: unknown;
    } | null;
    if (!detail || typeof detail !== "object") return;
    const at = pending.indexOf(detail as OpenUrlRequest);
    if (at >= 0) pending.splice(at, 1);
    const address = linkAddress(detail.url);
    if (address === null) return;
    event.preventDefault();
    listener({ url: address, from: typeof detail.from === "string" ? detail.from : "unknown" });
  };
  window.addEventListener(OPEN_URL_EVENT, hear);
  return () => window.removeEventListener(OPEN_URL_EVENT, hear);
}
