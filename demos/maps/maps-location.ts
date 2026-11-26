/*
 * The browser's own location, through the Geolocation API, as the served Maps and Find My windows
 * ask for it: once (`currentPosition`) or as it changes (`watchLocation`), with what a refusal
 * means in words a person can act on. The browser asks the person before it answers the first
 * time; the windows ask only when they open or when the location button is pressed.
 */

import type { LatLon } from "./maps-geo";

/** The browser's position, as the Geolocation API gave it. */
export interface Located extends LatLon {
  accuracy_m: number;
}

/** What a failed Geolocation request means for the person. */
export function locationProblem(error: { code: number } | null): string {
  if (!error) return "This browser cannot tell where it is.";
  if (error.code === 1)
    return "Location access is turned off for this page. Allow it in the browser's site settings to show where you are.";
  if (error.code === 3) return "Your location could not be found in time. Try again.";
  return "Your location is not available right now.";
}

const geolocation = (): Geolocation | undefined =>
  typeof navigator === "undefined" ? undefined : navigator.geolocation;

/** Playwright's WebKit answers with a position whose coordinates are NaN when it has none to give. */
const located = (position: GeolocationPosition): Located | null =>
  Number.isFinite(position.coords.latitude) && Number.isFinite(position.coords.longitude)
    ? {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy_m: position.coords.accuracy,
      }
    : null;

const UNAVAILABLE = { code: 2 };

/** How old a position may be and still answer: the same as the requests below accept. */
const MAX_AGE_MS = 60_000;
/** The newest position a watch heard, which answers without asking again. A one-off request made
 * during Find My's watch timed out in Chromium with an emulated position. */
let watched: { at: Located; when: number } | null = null;

/** Ask the browser where it is: the position, or why there is none. */
export function currentPosition(): Promise<{ at: Located } | { problem: string }> {
  return new Promise((resolve) => {
    if (watched && Date.now() - watched.when < MAX_AGE_MS) {
      resolve({ at: watched.at });
      return;
    }
    const api = geolocation();
    if (!api) {
      resolve({ problem: locationProblem(null) });
      return;
    }
    api.getCurrentPosition(
      (position) => {
        const at = located(position);
        resolve(at ? { at } : { problem: locationProblem(UNAVAILABLE) });
      },
      (error) => resolve({ problem: locationProblem(error) }),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: MAX_AGE_MS },
    );
  });
}

/**
 * Hear the browser's position now and as it changes, or why there is none. Returns the cleanup,
 * which stops listening.
 */
export function watchLocation(
  onLocated: (at: Located) => void,
  onProblem: (problem: string) => void,
): () => void {
  const api = geolocation();
  if (!api) {
    onProblem(locationProblem(null));
    return () => {};
  }
  const id = api.watchPosition(
    (position) => {
      const at = located(position);
      if (!at) {
        watched = null;
        onProblem(locationProblem(UNAVAILABLE));
        return;
      }
      watched = { at, when: position.timestamp };
      onLocated(at);
    },
    (error) => {
      watched = null;
      onProblem(locationProblem(error));
    },
    { enableHighAccuracy: false, timeout: 30_000, maximumAge: MAX_AGE_MS },
  );
  return () => api.clearWatch(id);
}
