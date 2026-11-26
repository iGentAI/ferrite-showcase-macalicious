/*
 * What the Maps demo knows: a handful of places, two regions for its tabs, and the search.
 * Nothing is fetched and no map service is asked. Coordinates are points of the demo's own
 * abstract map (maps-artwork.tsx) at its captured zoom; they say where a pin stands on that
 * drawing and are not geographic.
 */

/** A point of the abstract map, in points at zoom level 0. */
export interface MapsPoint {
  x: number;
  y: number;
}

/** The three map types of the toolbar's segmented control. */
export type MapsMapType = "map" | "transit" | "satellite";

/** A link of a place card. */
export interface MapsLink {
  /** The link's text. */
  title: string;
  /** Where it leads. */
  href: string;
}

/** A place the search finds and a place card describes. */
export interface MapsPlace {
  /** Identifies the place. */
  id: string;
  /** Its name: the card's title, the pin's label and what the search matches. */
  name: string;
  /** What kind of place it is, the first half of the card's second line. */
  category: string;
  /** How far away it is, the second half of that line. */
  distance: string;
  /** Where its pin stands on the abstract map. */
  coordinate: MapsPoint;
  /** The lines of its address. Without them the card has no Address section. */
  address?: readonly string[];
  /** Its telephone number. Without it the card has no Phone section. */
  phone?: string;
  /** Its website. Without it the card has no Website section. */
  website?: MapsLink;
  /** Its Wikipedia article. Without it the card has no photographs and no Wikipedia row. */
  wikipedia?: string;
}

/** A part of the map a tab can show. */
export interface MapsRegion {
  /** Identifies the region. */
  id: string;
  /** The title of a tab that shows it. */
  title: string;
  /** The point of the abstract map at the middle of the view. */
  center: MapsPoint;
}

/** The weather shown in the map's top trailing corner. */
export interface MapsWeather {
  /** The temperature in degrees, shown as "72°". */
  temperature: number;
  /** The air quality index, shown in the capsule as "AQI 49". */
  airQuality: number;
}

/** The place of the reference captures. Its card's text is the captures'. */
export const APPLE_PARK: MapsPlace = {
  id: "apple-park",
  name: "Apple Park",
  category: "Corporate Headquarters",
  distance: "1,786 mi",
  coordinate: { x: 1000, y: 700 },
  address: ["Apple Inc.", "One Apple Park Way", "Cupertino, CA 95014", "United States"],
  phone: "+1 (408) 996-1010",
  website: { title: "apple.com", href: "https://www.apple.com/" },
  wikipedia: "https://en.wikipedia.org/wiki/Apple_Park",
};

/**
 * The places the demo can find: the captures' place and four of the names on the captured
 * map, set down on the abstract map where the demo's drawing has room for them. Only Apple
 * Park's card is in a screenshot; the others have the two lines of a card's head and no more.
 */
export const defaultPlaces: readonly MapsPlace[] = [
  APPLE_PARK,
  {
    id: "visitor-center",
    name: "Apple Park Visitor Center",
    category: "Visitor Center",
    distance: "1,786 mi",
    coordinate: { x: 1180, y: 860 },
  },
  {
    id: "steve-jobs-theater",
    name: "Steve Jobs Theater",
    category: "Theater",
    distance: "1,786 mi",
    coordinate: { x: 1090, y: 1010 },
  },
  {
    id: "westwood-oaks-park",
    name: "Westwood Oaks Park",
    category: "Park",
    distance: "1,787 mi",
    coordinate: { x: 1420, y: 980 },
  },
  {
    id: "tantau-reception",
    name: "Tantau Reception Center",
    category: "Reception",
    distance: "1,786 mi",
    coordinate: { x: 1150, y: 930 },
  },
];

/**
 * The middle of the view in the Aqua capture: Apple Park's pin stands 1 pt right of the
 * map's middle and 61.5 pt above it, which puts the tip of its card's arrow at y 284 of the
 * window and the card's top 15 pt above the window's.
 */
export const CAPTURED_CENTER: MapsPoint = { x: 999, y: 761.5 };

/** Where the abstract map has its current location, the place the location button shows. */
export const CURRENT_LOCATION: MapsPoint = { x: 640, y: 1040 };

/** The regions of the two tabs of the captures. The first one's title is hidden in both. */
export const REGIONS: readonly MapsRegion[] = [
  { id: "cupertino", title: "Cupertino — Santa Clara", center: CAPTURED_CENTER },
  { id: "manhattan", title: "Manhattan — Jersey City", center: { x: 3400, y: 2150 } },
];

/** The weather of the Aqua capture. The Dark Aqua capture shows none. */
export const CAPTURED_WEATHER: MapsWeather = { temperature: 72, airQuality: 49 };

/** The zoom levels of the zoom pair: the map is drawn at 2 to the power of half the level. */
export const MIN_ZOOM = -4;
export const MAX_ZOOM = 4;

/** The scale the map is drawn at for a zoom level: 1 at level 0, double every two levels. */
export function scaleOf(zoom: number): number {
  return 2 ** (zoom / 2);
}

/**
 * The places a search finds, best first: those whose name starts with the text, then those
 * with a word that starts with it, then those that contain it. Letter case is ignored, and
 * an empty search finds nothing.
 */
export function searchPlaces(places: readonly MapsPlace[], query: string): MapsPlace[] {
  const text = query.trim().toLowerCase();
  if (text === "") return [];
  const rank = (place: MapsPlace) => {
    const name = place.name.toLowerCase();
    if (name.startsWith(text)) return 0;
    if (name.split(/\s+/).some((word) => word.startsWith(text))) return 1;
    return name.includes(text) ? 2 : 3;
  };
  return places
    .map((place, index) => ({ place, index, rank: rank(place) }))
    .filter((found) => found.rank < 3)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((found) => found.place);
}
