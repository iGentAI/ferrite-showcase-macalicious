/**
 * Where the person put Spotlight's window, kept with their settings: moved by its field, and taller or
 * shorter by its bottom edge, as on a Mac. It stands relative to where it opens by itself.
 */

export const SPOTLIGHT_PLACE = "spotlight.place";

export interface SpotlightPlace {
  /** From where it opens by itself, in points. */
  x: number;
  y: number;
  /** The height of its results, when the person changed it. */
  height?: number;
}

export const HOME_PLACE: SpotlightPlace = Object.freeze({ x: 0, y: 0 });

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function readSpotlightPlace(stored: unknown): SpotlightPlace | undefined {
  const place = stored as Partial<SpotlightPlace> | null;
  if (!isNumber(place?.x) || !isNumber(place?.y)) return undefined;
  return place.height === undefined || isNumber(place.height)
    ? (place as SpotlightPlace)
    : undefined;
}

export const LEAST_HEIGHT = 200;
export const MOST_HEIGHT = 720;

export const boundHeight = (height: number, most = MOST_HEIGHT) =>
  Math.max(LEAST_HEIGHT, Math.min(MOST_HEIGHT, most, height));

/** The component's height of its results, unless told another. */
const OWN_HEIGHT = 374;

/**
 * The height of the results in this much room under the field: what was kept, or the window's own
 * (`undefined`) while it fits.
 */
export const heightInRoom = (kept: number | undefined, room: number) =>
  kept === undefined && room >= OWN_HEIGHT ? undefined : boundHeight(kept ?? OWN_HEIGHT, room);

/** How far of the window stays on the screen, so that it can always be taken hold of. */
const LEAST_SHOWING = 80;

/**
 * The place after moving: the box of the window as it opens by itself is `home`, inside a layer of
 * this size, and its field stays where it can be reached. With `lowest`, the furthest down it may go:
 * where its bottom edge stays clear of the Dock.
 */
export function boundPlace(
  place: SpotlightPlace,
  home: { left: number; top: number; width: number },
  layer: { width: number; height: number },
  lowest = Number.POSITIVE_INFINITY,
): SpotlightPlace {
  return {
    ...place,
    x: Math.min(
      layer.width - LEAST_SHOWING - home.left,
      Math.max(LEAST_SHOWING - home.width - home.left, place.x),
    ),
    y: Math.min(lowest, layer.height - LEAST_SHOWING - home.top, Math.max(-home.top, place.y)),
  };
}
