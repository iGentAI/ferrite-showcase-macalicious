import { requestDesktopEffects } from "../desktop/desktop-effects";
import type { ServedPlace } from "./maps-server";

/*
 * Another app asking Maps for directions to a place: kept until a Maps window takes it, announced
 * to any window already open, and Maps brought to the front. One window takes each request.
 */

const DIRECTIONS_EVENT = "macalicious:maps-directions";
const SEARCH_EVENT = "macalicious:maps-search";
let pending: ServedPlace | null = null;
let pendingSearch: string | null = null;

/** Have Maps search for `text`, such as an address. */
export function askMapsSearch(text: string): void {
  pendingSearch = text;
  window.dispatchEvent(new CustomEvent(SEARCH_EVENT, { cancelable: true, detail: text }));
  requestDesktopEffects([{ open: "maps" }]);
}

/** The search asked for while no window was open, once. */
export function takeMapsSearch(): string | null {
  const text = pendingSearch;
  pendingSearch = null;
  return text;
}

/** Hears each later search, which no other window then takes. Answers the function that stops. */
export function onMapsSearch(listener: (text: string) => void): () => void {
  const hear = (event: Event) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    pendingSearch = null;
    listener((event as CustomEvent<string>).detail);
  };
  window.addEventListener(SEARCH_EVENT, hear);
  return () => window.removeEventListener(SEARCH_EVENT, hear);
}

/** Have Maps show directions to `place`. */
export function askMapsDirections(place: ServedPlace): void {
  pending = place;
  window.dispatchEvent(new CustomEvent(DIRECTIONS_EVENT, { cancelable: true, detail: place }));
  requestDesktopEffects([{ open: "maps" }]);
}

/** The place asked for while no window was open, once. */
export function takeMapsDirections(): ServedPlace | null {
  const place = pending;
  pending = null;
  return place;
}

/** Hears each later request, which no other window then takes. Answers the function that stops. */
export function onMapsDirections(listener: (place: ServedPlace) => void): () => void {
  const hear = (event: Event) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    pending = null;
    listener((event as CustomEvent<ServedPlace>).detail);
  };
  window.addEventListener(DIRECTIONS_EVENT, hear);
  return () => window.removeEventListener(DIRECTIONS_EVENT, hear);
}
