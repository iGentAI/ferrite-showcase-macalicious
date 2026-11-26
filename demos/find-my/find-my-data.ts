/*
 * What the Find My demo knows: one person, three invented devices, and where each stands on
 * the demo's own abstract map (find-my-artwork.tsx). Nothing is located and nothing is
 * shared: coordinates are points of that drawing at zoom level 0 and are not geographic.
 */

/** A point of the abstract map, in points at zoom level 0. */
export interface FindMyPoint {
  x: number;
  y: number;
}

/** The three map types of the switch over the map. */
export type FindMyMapType = "map" | "hybrid" | "satellite";

/** The two lists of the sidebar. */
export type FindMyList = "people" | "devices";

/** What a device is, which picks its placeholder glyph. */
export type FindMyDeviceKind = "laptop" | "phone" | "tablet";

/** A row of the People list. */
export interface FindMyPerson {
  /** Identifies the person. */
  id: string;
  /** The row's first line, and the label under the map's marker. */
  name: string;
  /** The row's second line: where the person is. */
  place: string;
  /** Where the person's marker stands on the abstract map. */
  coordinate: FindMyPoint;
}

/** A row of the Devices list. */
export interface FindMyDevice extends FindMyPerson {
  /** What the device is: the glyph on its disc and on its marker. */
  kind: FindMyDeviceKind;
}

/** Where the abstract map has the current location: the blue dot, and where "Me" is. */
export const CURRENT_LOCATION: FindMyPoint = { x: 900, y: 620 };

/** The id of the person who stands for the user: the dot of the current location is theirs. */
export const ME_ID = "me";

/** The one row of the reference captures. Its two lines are the captures' text. */
export const ME: FindMyPerson = {
  id: ME_ID,
  name: "Me",
  place: "Memphis, TN",
  coordinate: CURRENT_LOCATION,
};

/** The People list of the captures: the user alone. */
export const defaultPeople: readonly FindMyPerson[] = [ME];

/**
 * The Devices list. No capture shows it: the three devices are invented, with names and
 * places that are no product's and nowhere on the captured map.
 */
export const defaultDevices: readonly FindMyDevice[] = [
  {
    id: "desk-laptop",
    name: "Desk Laptop",
    kind: "laptop",
    place: "Home · Now",
    coordinate: { x: 1010, y: 548 },
  },
  {
    id: "pocket-phone",
    name: "Pocket Phone",
    kind: "phone",
    place: "With You",
    coordinate: { x: 936, y: 592 },
  },
  {
    id: "travel-tablet",
    name: "Travel Tablet",
    kind: "tablet",
    place: "Office · 2 hr ago",
    coordinate: { x: 1130, y: 760 },
  },
];

/**
 * The middle of the view in the captures: the dot of the current location stands a quarter
 * of a point right of the map's middle and 10.75 pt under it.
 */
export const CAPTURED_CENTER: FindMyPoint = { x: 899.75, y: 609.25 };

/** The zoom levels of the zoom pair: the map is drawn at 2 to the power of half the level. */
export const MIN_ZOOM = -4;
export const MAX_ZOOM = 4;

/** A zoom level the zoom pair can reach: whole, and between the two limits. */
export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));
}

/** The scale the map is drawn at for a zoom level: 1 at level 0, double every two levels. */
export function scaleOf(zoom: number): number {
  return 2 ** (zoom / 2);
}

/**
 * Where a point of the abstract map is drawn, in points from the middle of the view, for a
 * view whose middle shows `center` at `scale` with `heading` degrees up (clockwise from
 * north): the map turns against its heading, as the compass rose does.
 */
export function project(
  point: FindMyPoint,
  center: FindMyPoint,
  scale: number,
  heading = 0,
): FindMyPoint {
  const turn = (-heading * Math.PI) / 180;
  const dx = scale * (point.x - center.x);
  const dy = scale * (point.y - center.y);
  const round = (value: number) => Math.round(value * 100) / 100 || 0;
  return {
    x: round(dx * Math.cos(turn) - dy * Math.sin(turn)),
    y: round(dx * Math.sin(turn) + dy * Math.cos(turn)),
  };
}

/** The initials on a person's disc: the first letters of the first two words of the name. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
