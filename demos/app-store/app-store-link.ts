/*
 * A link to an app's page in the store, on this desktop's own address. The desktop alone reads the
 * address (`followAppLink`), takes the link off it and opens the store; the page is kept here until
 * the store can show it, and any store already open is told.
 */

const LINK = /^#app-store\/([a-z0-9-]{1,64})$/;
const PAGE_EVENT = "macalicious:app-store-page";
let pending: string | null = null;

/** The link to the page of an app of the catalogue. */
export const appStoreLink = (id: string): string =>
  `${location.origin}${location.pathname}#app-store/${id}`;

/** Takes a link off the address, if it holds one: whether it did, and the store is to be opened. */
export function followAppLink(): boolean {
  const id = LINK.exec(location.hash)?.[1];
  if (!id) return false;
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  pending = id;
  window.dispatchEvent(new Event(PAGE_EVENT));
  return true;
}

/** Hears a link followed while the page is open. Answers the function that stops. */
export function onAppLink(listener: () => void): () => void {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
}

/** The app of the catalogue whose page a link asks for, once. */
export function takeAppPage(): string | null {
  const id = pending;
  pending = null;
  return id;
}

/** Hears each later link. Answers the function that stops. */
export function onAppPage(listener: () => void): () => void {
  window.addEventListener(PAGE_EVENT, listener);
  return () => window.removeEventListener(PAGE_EVENT, listener);
}
