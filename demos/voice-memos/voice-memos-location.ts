import { reversePlace } from "../maps/maps-server";

/** Why a recording is numbered although Location-based Naming is on. */
export const NO_LOCATION = "Your location isn't available, so recordings are numbered.";
const NO_PLACE = "No place is known where you are, so recordings are numbered.";

/** A place's name as a recording's title: a drive's file name has no slash, colon or backslash. */
export function titleOfPlace(name: string): string {
  return name
    .replace(/[/\\:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * The name of where the person is, asked of the browser (which asks them once) and of the desktop's
 * Maps module, which keeps OpenStreetMap's answer. Answers why not when it cannot be had.
 */
export function locationTitle(): Promise<{ title: string } | { problem: string }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ problem: NO_LOCATION });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const found = await reversePlace({ lat: coords.latitude, lon: coords.longitude });
        const title = found.ok ? titleOfPlace(found.value[0]?.name ?? "") : "";
        resolve(title ? { title } : { problem: NO_PLACE });
      },
      () => resolve({ problem: NO_LOCATION }),
      { maximumAge: 300_000, timeout: 15_000 },
    );
  });
}
