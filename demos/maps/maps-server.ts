/*
 * What the served Maps window asks the desktop's Ferrite application
 * (`ferrite-apps/desktop/src/apps/maps`), and how it reads the answers: place search and
 * reverse geocoding (OpenStreetMap's Nominatim), directions (the FOSSGIS routers) and the
 * person's Favorites, Recents and Guides. Every reply is
 * checked before it is shown; a link that is not `http(s)` is never kept.
 */

import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import type { LatLon } from "./maps-geo";

/** The module's routes. */
export const SEARCH_URL = "/api/maps/search";
export const REVERSE_URL = "/api/maps/reverse";
export const PLACES_URL = "/api/maps/places";
export const ROUTE_URL = "/api/maps/route";

/** A place the module found, or the person kept. */
export interface ServedPlace {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  address: readonly string[];
  website?: string;
  phone?: string;
  wikipedia?: string;
}

/** A named list of places. */
export interface Guide {
  id: string;
  name: string;
  places: readonly ServedPlace[];
}

/** The person's places, as the module keeps them. */
export interface PlacesDocument {
  favorites: readonly ServedPlace[];
  /** Newest first. */
  recents: readonly ServedPlace[];
  guides: readonly Guide[];
}

export const EMPTY_PLACES: PlacesDocument = { favorites: [], recents: [], guides: [] };

/** The most places of each list, as the module refuses more. */
export const MAX_FAVORITES = 200;
export const MAX_RECENTS = 30;
export const MAX_GUIDES = 50;
export const MAX_GUIDE_PLACES = 200;
export const MAX_GUIDE_NAME = 100;

const PLAIN_ID = /^[A-Za-z0-9._-]{1,128}$/;
const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const onGlobe = (lat: unknown, lon: unknown) =>
  isNumber(lat) && isNumber(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
const object = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** A link a card may open: `http:` or `https:`, nothing else. */
export function safeLink(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A Wikipedia article link, as the module accepts one (`places::wikipedia_article`): `https`,
 * no user information, a host that is `wikipedia.org` or a subdomain of it, no port but 443
 * (which `URL` drops as the default), and a path that starts `/wiki/`.
 */
export function wikipediaLink(value: unknown): string | undefined {
  const link = safeLink(value);
  if (!link) return undefined;
  const url = new URL(link);
  const host = url.hostname;
  return url.protocol === "https:" &&
    url.username === "" &&
    url.password === "" &&
    (url.port === "" || url.port === "443") &&
    (host === "wikipedia.org" || host.endsWith(".wikipedia.org")) &&
    url.pathname.startsWith("/wiki/")
    ? link
    : undefined;
}

/** A place of a reply, or `undefined` when it is not in the module's shape. */
export function placeFromServer(value: unknown): ServedPlace | undefined {
  const place = object(value);
  if (
    !place ||
    !isText(place.id, 128) ||
    !PLAIN_ID.test(place.id) ||
    !isText(place.name, 200) ||
    place.name.trim() === "" ||
    !isText(place.category, 100) ||
    !onGlobe(place.lat, place.lon)
  )
    return undefined;
  const address = Array.isArray(place.address)
    ? place.address.filter((line): line is string => isText(line, 200) && line !== "").slice(0, 6)
    : [];
  const kept: ServedPlace = {
    id: place.id,
    name: place.name,
    category: place.category,
    lat: place.lat as number,
    lon: place.lon as number,
    address,
  };
  const website = safeLink(place.website);
  if (website) kept.website = website;
  if (isText(place.phone, 64) && place.phone !== "") kept.phone = place.phone;
  const wikipedia = wikipediaLink(place.wikipedia);
  if (wikipedia) kept.wikipedia = wikipedia;
  return kept;
}

/**
 * A place of the person's stored document exactly as stored, or `undefined` when reading it
 * would lose or change any part of it: the module always writes `address` as a list and leaves
 * an absent link or phone out (never `null`), so anything else is not its document.
 */
function storedPlace(value: unknown): ServedPlace | undefined {
  const place = placeFromServer(value);
  const raw = object(value);
  if (!place || !raw) return undefined;
  if (!Array.isArray(raw.address) || raw.address.length !== place.address.length) return undefined;
  for (const field of ["website", "phone", "wikipedia"] as const) {
    if (field in raw && raw[field] !== place[field]) return undefined;
  }
  return place;
}

/**
 * Every item of `value` as a place, at most `max` and each id once; `undefined` when `value` is
 * not such a list (`null` reads as empty only where the module writes `null`, before the first
 * save: `nullable`). Nothing is dropped: a list the module did not write is not read as a
 * shorter one, so the window never saves a document it could not read whole.
 */
const placeList = (value: unknown, max: number, nullable = false): ServedPlace[] | undefined => {
  if (value === null && nullable) return [];
  if (!Array.isArray(value) || value.length > max) return undefined;
  const places: ServedPlace[] = [];
  for (const item of value) {
    const place = storedPlace(item);
    if (!place || places.some((other) => other.id === place.id)) return undefined;
    places.push(place);
  }
  return places;
};

/** The places of a search or reverse reply, or `undefined` when it is not the module's. */
export function placesFromServer(reply: unknown): ServedPlace[] | undefined {
  const body = object(reply);
  if (!body || !Array.isArray(body.places)) return undefined;
  return placeList(body.places, 8);
}

/**
 * The person's places of a `GET` reply (each list `null` before the first save), or `undefined`
 * when the reply is not a whole document the module wrote: its `rev`, and three lists of valid
 * entries, each id once and within the module's limits. A document read only in part is never
 * shown as loaded, so the window cannot save it back over what it could not read.
 */
export function placesDocumentFromServer(reply: unknown): PlacesDocument | undefined {
  const body = object(reply);
  // The server's reply has its revision; what another window gave (`useServerState`) has none.
  if (!body || (body.rev !== undefined && !isNumber(body.rev))) return undefined;
  const favorites = placeList(body.favorites, MAX_FAVORITES, true);
  const recents = placeList(body.recents, MAX_RECENTS, true);
  if (!favorites || !recents) return undefined;
  if (body.guides !== null && (!Array.isArray(body.guides) || body.guides.length > MAX_GUIDES))
    return undefined;
  const guides: Guide[] = [];
  for (const item of body.guides ?? []) {
    const guide = object(item);
    const places = guide ? placeList(guide.places, MAX_GUIDE_PLACES) : undefined;
    if (
      !guide ||
      !places ||
      !isText(guide.id, 128) ||
      !PLAIN_ID.test(guide.id) ||
      !isText(guide.name, MAX_GUIDE_NAME) ||
      guide.name.trim() === "" ||
      guides.some((other) => other.id === guide.id)
    )
      return undefined;
    guides.push({ id: guide.id, name: guide.name, places });
  }
  return { favorites, recents, guides };
}

/** `place` at the front of the recents, once, and at most `MAX_RECENTS` of them. */
export function addRecent(recents: readonly ServedPlace[], place: ServedPlace): ServedPlace[] {
  return [place, ...recents.filter((other) => other.id !== place.id)].slice(0, MAX_RECENTS);
}

/** Whether a place is among the favorites. */
export function isFavorite(doc: PlacesDocument, place: ServedPlace): boolean {
  return doc.favorites.some((other) => other.id === place.id);
}

/** The most suggestions under the search field. */
export const MAX_SUGGESTIONS = 8;

/** A place of the person's own under the search field, and the list it comes from. */
export interface PlaceSuggestion {
  place: ServedPlace;
  from: string;
}

/**
 * What the search field suggests for what was typed, from the person's own places: those whose
 * name, category or address holds every word, each once, Favorites first, then Guides, then
 * Recents. Nothing typed suggests them all. No text leaves the window for it: Nominatim's terms
 * do not allow searching as a person types.
 */
export function placeSuggestions(doc: PlacesDocument, typed: string): PlaceSuggestion[] {
  const words = typed.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const known: PlaceSuggestion[] = [
    ...doc.favorites.map((place) => ({ place, from: "Favorites" })),
    ...doc.guides.flatMap((guide) => guide.places.map((place) => ({ place, from: guide.name }))),
    ...doc.recents.map((place) => ({ place, from: "Recents" })),
  ];
  const seen = new Set<string>();
  return known
    .filter(({ place }) => {
      const text = [place.name, place.category, ...place.address].join(" ").toLowerCase();
      if (seen.has(place.id) || !words.every((word) => text.includes(word))) return false;
      seen.add(place.id);
      return true;
    })
    .slice(0, MAX_SUGGESTIONS);
}

/** The document with `place` added to or taken from the favorites. */
export function withFavorite(doc: PlacesDocument, place: ServedPlace, on: boolean): PlacesDocument {
  const others = doc.favorites.filter((other) => other.id !== place.id);
  return {
    ...doc,
    favorites: on ? [...others, place].slice(0, MAX_FAVORITES) : others,
  };
}

/** The document with `place` added to or taken from the guide `guideId`. */
export function withGuidePlace(
  doc: PlacesDocument,
  guideId: string,
  place: ServedPlace,
  on: boolean,
): PlacesDocument {
  return {
    ...doc,
    guides: doc.guides.map((guide) => {
      if (guide.id !== guideId) return guide;
      const others = guide.places.filter((other) => other.id !== place.id);
      return { ...guide, places: on ? [...others, place].slice(0, MAX_GUIDE_PLACES) : others };
    }),
  };
}

/** A place for a point where a pin was dropped and the geocoder found nothing. */
export function droppedPin(point: LatLon): ServedPlace {
  const lat = point.lat.toFixed(5);
  const lon = point.lon.toFixed(5);
  return {
    id: `pin-${lat}_${lon}`,
    name: "Dropped Pin",
    category: "",
    lat: Number(lat),
    lon: Number(lon),
    address: [`${lat}, ${lon}`],
  };
}

/** A place's page on openstreetmap.org, with a marker on it. */
export function osmLink(place: LatLon): string {
  const lat = place.lat.toFixed(5);
  const lon = place.lon.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}

/** A point as people read it: "37.81829° N, 122.47838° W". */
export function coordinateText(point: LatLon): string {
  const lat = `${Math.abs(point.lat).toFixed(5)}° ${point.lat >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(point.lon).toFixed(5)}° ${point.lon >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

/** An answer of the module, or why there is none. */
export type Answer<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

const errorOf = (body: unknown, status: number): string => {
  const error = object(body)?.error;
  return typeof error === "string" && error !== "" ? error : `HTTP ${status}`;
};

/** `GET` a route of the module and read its reply with `read`. */
async function ask<T>(url: string, read: (body: unknown) => T | undefined): Promise<Answer<T>> {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(url, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal,
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        return {
          ok: false as const,
          status: response.status,
          message: errorOf(body, response.status),
        };
      }
      const value = read(body);
      return value === undefined
        ? { ok: false as const, status: response.status, message: "the answer could not be read" }
        : { ok: true as const, value };
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return {
      ok: false,
      status: 0,
      message: timedOut
        ? "the desktop's server did not answer in time"
        : "the desktop's server could not be reached",
    };
  }
}

const point = (place: LatLon) => `${place.lat.toFixed(6)},${place.lon.toFixed(6)}`;

/** Search for places near `near`. */
export function searchPlaces(query: string, near?: LatLon): Promise<Answer<ServedPlace[]>> {
  const params = new URLSearchParams({ q: query });
  if (near) params.set("near", point(near));
  return ask(`${SEARCH_URL}?${params}`, placesFromServer);
}

/** The place at a point, if the geocoder knows one. */
export function reversePlace(at: LatLon): Promise<Answer<ServedPlace[]>> {
  const params = new URLSearchParams({ lat: at.lat.toFixed(6), lon: at.lon.toFixed(6) });
  return ask(`${REVERSE_URL}?${params}`, placesFromServer);
}

/** How a journey is made. */
export type TravelMode = "driving" | "walking";

/** One instruction of a route, and where it applies. */
export interface RouteStep extends LatLon {
  text: string;
  distance_m: number;
}

/** A route: its length and time, the line to draw and its instructions. */
export interface ServedRoute {
  distance_m: number;
  duration_s: number;
  path: readonly LatLon[];
  steps: readonly RouteStep[];
}

function routeStep(value: unknown): RouteStep | undefined {
  const step = object(value);
  if (!step || typeof step.text !== "string") return undefined;
  const { distance_m, lat, lon } = step;
  if (!isNumber(distance_m) || !isNumber(lat) || !isNumber(lon)) return undefined;
  return { text: step.text, distance_m, lat, lon };
}

/**
 * The route of a reply: `null` when the two points have no journey between them, and `undefined`
 * for a reply of any other shape.
 */
export function routeFromServer(reply: unknown): ServedRoute | null | undefined {
  const body = object(reply);
  if (!body) return undefined;
  if (body.route === null) return null;
  const route = object(body.route);
  if (!route || !Array.isArray(route.path) || !Array.isArray(route.steps)) return undefined;
  const { distance_m, duration_s } = route;
  if (!isNumber(distance_m) || !isNumber(duration_s)) return undefined;
  const path: LatLon[] = [];
  for (const pair of route.path as unknown[]) {
    if (!Array.isArray(pair) || !isNumber(pair[0]) || !isNumber(pair[1])) return undefined;
    path.push({ lat: pair[0], lon: pair[1] });
  }
  const steps: RouteStep[] = [];
  for (const item of route.steps as unknown[]) {
    const step = routeStep(item);
    if (!step) return undefined;
    steps.push(step);
  }
  return { distance_m, duration_s, path, steps };
}

/** The route between two points. */
export function askRoute(
  from: LatLon,
  to: LatLon,
  mode: TravelMode,
): Promise<Answer<ServedRoute | null>> {
  const params = new URLSearchParams({ from: point(from), to: point(to), mode });
  return ask(`${ROUTE_URL}?${params}`, routeFromServer);
}
