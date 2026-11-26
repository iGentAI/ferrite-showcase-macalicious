/*
 * The geometry of the real map that Maps and Find My show when the desktop's Ferrite application
 * serves them: Web Mercator (the projection of OpenStreetMap's tiles), the tiles a view needs,
 * placing a point on the view and back, zooming about a point, and how distances are written.
 * Pure functions only; `maps-tiles.tsx` draws the map.
 */

/** A point on the globe, in degrees. */
export interface LatLon {
  lat: number;
  lon: number;
}

/** A point on the view, in CSS pixels from its top-left corner. */
export interface Pixel {
  x: number;
  y: number;
}

/** What a map shows: its middle and its zoom level. */
export interface MapView {
  center: LatLon;
  zoom: number;
}

/** One tile the view needs. */
export interface Tile {
  /** Unique among the view's tiles, a copy of the world counted apart. */
  key: string;
  /** The tile's address: zoom, column (wrapped into the world) and row. */
  z: number;
  x: number;
  y: number;
  /** Where its top-left corner is drawn on the view. */
  left: number;
  top: number;
  url: string;
}

/** The side of a tile, in pixels. */
export const TILE_SIZE = 256;
/** The widest zoom level the map offers: the whole world in a few tiles. */
export const MIN_ZOOM = 2;
/** The closest: OpenStreetMap's standard tiles go to 19. */
export const MAX_ZOOM = 19;
/** Web Mercator's edge: the latitude at which the square world ends. */
export const MAX_LATITUDE = 85.0511287798;
/** The Earth's circumference at the equator, in metres. */
const EQUATOR_M = 40_075_016.686;

/** OpenStreetMap's standard tile at `z`/`x`/`y` (https://operations.osmfoundation.org/policies/tiles/). */
export function tileUrl(z: number, x: number, y: number): string {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A whole zoom level the map offers. */
export function clampZoom(zoom: number): number {
  return clamp(Math.round(zoom), MIN_ZOOM, MAX_ZOOM);
}

/** A longitude brought into -180 to 180. */
export function wrapLongitude(lon: number): number {
  const wrapped = ((((lon + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && lon > 0 ? 180 : wrapped;
}

/** The world's side at a zoom level, in pixels. */
export function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

/** A point's place on the whole world at a zoom level, in pixels from its top-left corner. */
export function toWorld(point: LatLon, zoom: number): Pixel {
  const size = worldSize(zoom);
  const sin = Math.sin((clamp(point.lat, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI) / 180);
  return {
    x: ((point.lon + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** The point at a place on the whole world. */
export function fromWorld(pixel: Pixel, zoom: number): LatLon {
  const size = worldSize(zoom);
  const y = clamp(pixel.y, 0, size);
  const n = Math.PI - (2 * Math.PI * y) / size;
  return {
    lat: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    lon: wrapLongitude((pixel.x / size) * 360 - 180),
  };
}

/**
 * The tiles a view of `width` by `height` pixels needs, and no more: the map asks for nothing
 * outside the view. Columns past the edge of the world are its copies, and rows past its top
 * or bottom are none.
 */
export function visibleTiles(view: MapView, width: number, height: number): Tile[] {
  if (!(width > 0 && height > 0)) return [];
  const zoom = clampZoom(view.zoom);
  const middle = toWorld(view.center, zoom);
  const left = middle.x - width / 2;
  const top = middle.y - height / 2;
  const count = 2 ** zoom;
  const x0 = Math.floor(left / TILE_SIZE);
  // The last tile any part of the view falls on, a fraction of a pixel included.
  const x1 = Math.ceil((left + width) / TILE_SIZE) - 1;
  const y0 = Math.max(0, Math.floor(top / TILE_SIZE));
  const y1 = Math.min(count - 1, Math.ceil((top + height) / TILE_SIZE) - 1);
  const tiles: Tile[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const wrapped = ((x % count) + count) % count;
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        z: zoom,
        x: wrapped,
        y,
        left: Math.round(x * TILE_SIZE - left),
        top: Math.round(y * TILE_SIZE - top),
        url: tileUrl(zoom, wrapped, y),
      });
    }
  }
  return tiles;
}

/**
 * Where `point` is drawn on a view of `width` by `height` pixels, in pixels from its top-left
 * corner: on the copy of the world nearest the view's middle.
 */
export function project(point: LatLon, view: MapView, width: number, height: number): Pixel {
  const zoom = clampZoom(view.zoom);
  const size = worldSize(zoom);
  const middle = toWorld(view.center, zoom);
  const at = toWorld(point, zoom);
  let dx = at.x - middle.x;
  if (dx > size / 2) dx -= size;
  if (dx < -size / 2) dx += size;
  return { x: width / 2 + dx, y: height / 2 + (at.y - middle.y) };
}

/** The point drawn at `pixel` of a view of `width` by `height` pixels. */
export function unproject(pixel: Pixel, view: MapView, width: number, height: number): LatLon {
  const zoom = clampZoom(view.zoom);
  const middle = toWorld(view.center, zoom);
  return fromWorld({ x: middle.x + pixel.x - width / 2, y: middle.y + pixel.y - height / 2 }, zoom);
}

/** `pixel` turned `degrees` clockwise about the middle of a view of `width` by `height` pixels. */
export function turned(pixel: Pixel, degrees: number, width: number, height: number): Pixel {
  if (degrees === 0) return pixel;
  const by = turnedVector({ x: pixel.x - width / 2, y: pixel.y - height / 2 }, degrees);
  return { x: width / 2 + by.x, y: height / 2 + by.y };
}

/** A movement turned `degrees` clockwise. */
export function turnedVector(vector: Pixel, degrees: number): Pixel {
  if (degrees === 0) return vector;
  const radians = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  return { x: vector.x * cos - vector.y * sin, y: vector.x * sin + vector.y * cos };
}

/** A heading in degrees brought to 0 up to 360; within `snap` of north it is north. */
export function normalHeading(degrees: number, snap = 0): number {
  const heading = ((degrees % 360) + 360) % 360;
  return heading < snap || heading > 360 - snap ? 0 : heading;
}

/** The view moved so that what was at `pixel` lies `dx`, `dy` pixels further on. */
export function panBy(view: MapView, dx: number, dy: number): MapView {
  const zoom = clampZoom(view.zoom);
  const middle = toWorld(view.center, zoom);
  return { zoom, center: fromWorld({ x: middle.x - dx, y: middle.y - dy }, zoom) };
}

/**
 * The view at another zoom level that keeps the point under `pixel` (default: the middle) where
 * it is, as a wheel or a double-click zooms about the pointer.
 */
export function zoomAbout(
  view: MapView,
  zoom: number,
  pixel: Pixel | null,
  width: number,
  height: number,
): MapView {
  const next = clampZoom(zoom);
  if (!pixel || !(width > 0 && height > 0)) return { center: view.center, zoom: next };
  const anchor = toWorld(unproject(pixel, view, width, height), next);
  return {
    zoom: next,
    center: fromWorld(
      { x: anchor.x - (pixel.x - width / 2), y: anchor.y - (pixel.y - height / 2) },
      next,
    ),
  };
}

/**
 * The view that shows every one of `points` on a map of `width` by `height` pixels: their middle,
 * at the closest zoom level that fits them, no closer than `maxZoom`. Longitudes are read the short
 * way round the globe, so places either side of the antimeridian count as near each other.
 */
export function fitView(
  points: readonly LatLon[],
  width: number,
  height: number,
  maxZoom: number = MAX_ZOOM,
): MapView {
  const size = worldSize(MAX_ZOOM);
  const world = points.map((point) => toWorld(point, MAX_ZOOM));
  const xs = world.map((pixel) => pixel.x).sort((a, b) => a - b);
  const ys = world.map((pixel) => pixel.y);
  // The points span the circle of the world but for its widest empty stretch.
  let start = xs[0] ?? 0;
  let gap = size + start - (xs[xs.length - 1] ?? 0);
  for (let at = 1; at < xs.length; at += 1) {
    const x = xs[at] as number;
    const empty = x - (xs[at - 1] as number);
    if (empty > gap) {
      gap = empty;
      start = x;
    }
  }
  const across = size - gap;
  const down = Math.max(...ys) - Math.min(...ys);
  let zoom = clampZoom(maxZoom);
  while (
    zoom > MIN_ZOOM &&
    (across / 2 ** (MAX_ZOOM - zoom) > width || down / 2 ** (MAX_ZOOM - zoom) > height)
  ) {
    zoom -= 1;
  }
  return {
    center: fromWorld(
      { x: (start + across / 2) % size, y: (Math.max(...ys) + Math.min(...ys)) / 2 },
      MAX_ZOOM,
    ),
    zoom,
  };
}

/** How many metres one pixel covers at a latitude and zoom level. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (
    (EQUATOR_M * Math.cos((clamp(lat, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI) / 180)) /
    worldSize(clampZoom(zoom))
  );
}

/** The distance in metres between two points along the globe. */
export function distanceBetween(a: LatLon, b: LatLon): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Miles and feet, or kilometres and metres. */
export type Units = "imperial" | "metric";

/**
 * The units of a locale: miles in the United States, Liberia and Myanmar, else kilometres. The
 * region is read as `Intl.Locale` reads it, script subtags ("en-Latn-US") and all, and a locale
 * without one takes its likely region ("en" is American English, "my" Burmese); a tag that is not
 * a locale counts as metric.
 */
export function unitsFor(locale: string | undefined): Units {
  let region: string | undefined;
  try {
    region = locale ? new Intl.Locale(locale.replaceAll("_", "-")).maximize().region : undefined;
  } catch {
    region = undefined;
  }
  return region === "US" || region === "LR" || region === "MM" ? "imperial" : "metric";
}

/** A distance as Maps writes it: "350 ft", "2.4 mi", "800 m", "12 km". */
export function formatDistance(meters: number, units: Units): string {
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (units === "imperial") {
    const miles = meters / 1609.344;
    if (miles < 0.1) return `${Math.max(10, Math.round((meters * 3.28084) / 10) * 10)} ft`;
    return `${miles < 10 ? miles.toFixed(1) : Math.round(miles).toLocaleString("en-US")} mi`;
  }
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString("en-US")} km`;
}

/**
 * The scale legend for a view: the longest round distance (1, 2 or 5 times a power of ten, in
 * feet or miles, metres or kilometres) that fits in `maxPixels`, and its width in pixels.
 */
export function scaleLegend(
  lat: number,
  zoom: number,
  units: Units,
  maxPixels = 100,
): { pixels: number; label: string } {
  const perPixel = metersPerPixel(lat, zoom);
  const unit = units === "imperial" ? 0.3048 : 1;
  // The most the bar can show, in feet or metres; past a mile or a kilometre, in those.
  const most = (maxPixels * perPixel) / unit;
  const big = units === "imperial" ? 5280 : 1000;
  const niceBelow = (value: number) => {
    const power = 10 ** Math.floor(Math.log10(value));
    return [5, 2, 1].map((step) => step * power).find((nice) => nice <= value) ?? power;
  };
  if (most >= big) {
    const value = niceBelow(most / big);
    return {
      pixels: Math.round((value * big * unit) / perPixel),
      label: `${value.toLocaleString("en-US")} ${units === "imperial" ? "mi" : "km"}`,
    };
  }
  const value = niceBelow(most);
  return {
    pixels: Math.round((value * unit) / perPixel),
    label: `${value.toLocaleString("en-US")} ${units === "imperial" ? "ft" : "m"}`,
  };
}
