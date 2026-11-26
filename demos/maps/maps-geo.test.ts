import { describe, expect, it } from "vitest";
import {
  distanceBetween,
  fitView,
  formatDistance,
  fromWorld,
  type LatLon,
  MAX_ZOOM,
  MIN_ZOOM,
  metersPerPixel,
  panBy,
  project,
  scaleLegend,
  TILE_SIZE,
  tileUrl,
  toWorld,
  unitsFor,
  unproject,
  visibleTiles,
  wrapLongitude,
  zoomAbout,
} from "./maps-geo";

const BRIDGE: LatLon = { lat: 37.818292, lon: -122.478384 };
const close = (a: number, b: number, digits = 6) => expect(a).toBeCloseTo(b, digits);

describe("fitView", () => {
  it("shows every point inside the size it was asked to fit", () => {
    const points = [BRIDGE, { lat: 37.3349, lon: -122.009 }, { lat: 34.05, lon: -118.24 }];
    const view = fitView(points, 600, 400, 16);
    expect(view.zoom).toBe(6);
    for (const point of points) {
      const at = project(point, view, 600, 400);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x).toBeLessThanOrEqual(600);
      expect(at.y).toBeGreaterThanOrEqual(0);
      expect(at.y).toBeLessThanOrEqual(400);
    }
  });

  it("fits places either side of the antimeridian as the near places they are", () => {
    const points = [
      { lat: 10, lon: 179.9 },
      { lat: 10, lon: -179.9 },
    ];
    const view = fitView(points, 600, 400, 16);
    // 0.2 degrees of longitude is 582 pixels at zoom 12, and twice that at 13.
    expect(view.zoom).toBe(12);
    expect(Math.abs(view.center.lon)).toBeCloseTo(180, 6);
    for (const point of points) {
      const at = project(point, view, 600, 400);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x).toBeLessThanOrEqual(600);
    }
  });

  it("comes no closer than asked, and goes no wider than the widest zoom", () => {
    const near = { lat: BRIDGE.lat + 0.0001, lon: BRIDGE.lon };
    expect(fitView([BRIDGE, near], 600, 400, 16).zoom).toBe(16);
    const farApart = [
      { lat: 70, lon: -170 },
      { lat: -70, lon: 170 },
      { lat: 0, lon: 0 },
    ];
    expect(fitView(farApart, 300, 200, 16).zoom).toBe(MIN_ZOOM);
  });
});

describe("Web Mercator", () => {
  it("puts a point on the world and takes it back", () => {
    for (const zoom of [MIN_ZOOM, 10, MAX_ZOOM]) {
      const back = fromWorld(toWorld(BRIDGE, zoom), zoom);
      close(back.lat, BRIDGE.lat);
      close(back.lon, BRIDGE.lon);
    }
    // The middle of the world, and its top-left corner at Web Mercator's edge.
    expect(toWorld({ lat: 0, lon: 0 }, 0)).toEqual({ x: 128, y: 128 });
    close(toWorld({ lat: 85.0511287798, lon: -180 }, 0).y, 0, 3);
    expect(wrapLongitude(190)).toBe(-170);
    expect(wrapLongitude(-540)).toBe(-180);
    expect(wrapLongitude(180)).toBe(180);
  });

  it("finds the tile OpenStreetMap numbers for a place", () => {
    // The Golden Gate Bridge is in tile 15/5235/12660 of the standard map:
    // x = floor((lon + 180) / 360 * 2^15), y from the slippy-map formula.
    const at = toWorld(BRIDGE, 15);
    expect([Math.floor(at.x / TILE_SIZE), Math.floor(at.y / TILE_SIZE)]).toEqual([5235, 12660]);
    expect(tileUrl(15, 5235, 12660)).toBe("https://tile.openstreetmap.org/15/5235/12660.png");
  });
});

describe("the tiles of a view", () => {
  it("asks for every tile in view and none outside it", () => {
    const tiles = visibleTiles({ center: BRIDGE, zoom: 15 }, 800, 600);
    for (const tile of tiles) {
      expect(tile.left).toBeLessThan(800);
      expect(tile.left + TILE_SIZE).toBeGreaterThan(0);
      expect(tile.top).toBeLessThan(600);
      expect(tile.top + TILE_SIZE).toBeGreaterThan(0);
      expect(tile.url).toBe(tileUrl(15, tile.x, tile.y));
    }
    expect(tiles.length).toBeLessThanOrEqual(5 * 4);
    expect(tiles.some((tile) => tile.x === 5235 && tile.y === 12660)).toBe(true);
    expect(new Set(tiles.map((tile) => tile.key)).size).toBe(tiles.length);
    expect(visibleTiles({ center: BRIDGE, zoom: 15 }, 0, 600)).toEqual([]);
  });

  it("wraps columns past the date line and asks for no row past the poles", () => {
    const tiles = visibleTiles({ center: { lat: 80, lon: 179.9 }, zoom: 3 }, 600, 600);
    expect(tiles.every((tile) => tile.x >= 0 && tile.x < 8)).toBe(true);
    expect(tiles.some((tile) => tile.x === 0)).toBe(true);
    expect(tiles.some((tile) => tile.x === 7)).toBe(true);
    expect(tiles.every((tile) => tile.y >= 0)).toBe(true);
  });

  it("covers a view whose edge falls a fraction of a pixel into the next tile", () => {
    // At zoom 2 the world is 1,024 px wide. A 700 px view whose left edge is at x = 68.3 ends at
    // 768.3: 0.3 px into the fourth column, which must be asked for too; likewise the last row.
    const center = fromWorld({ x: 68.3 + 350, y: 512.4 }, 2);
    const tiles = visibleTiles({ center, zoom: 2 }, 700, 512);
    expect(new Set(tiles.map((tile) => tile.x))).toEqual(new Set([0, 1, 2, 3]));
    // Rows: the view runs from y = 256.4 to 768.4, into row 3 by 0.4 px.
    expect(new Set(tiles.map((tile) => tile.y))).toEqual(new Set([1, 2, 3]));
    // A view that ends exactly on a tile edge asks for nothing past it.
    const exact = visibleTiles({ center: fromWorld({ x: 512, y: 512 }, 2), zoom: 2 }, 512, 512);
    expect(new Set(exact.map((tile) => tile.x))).toEqual(new Set([1, 2]));
    expect(new Set(exact.map((tile) => tile.y))).toEqual(new Set([1, 2]));
  });
});

describe("placing points and moving the view", () => {
  const view = { center: BRIDGE, zoom: 15 };

  it("draws the middle in the middle, and reads a pixel back as its point", () => {
    expect(project(BRIDGE, view, 800, 600)).toEqual({ x: 400, y: 300 });
    const point = unproject({ x: 120, y: 450 }, view, 800, 600);
    const again = project(point, view, 800, 600);
    close(again.x, 120, 6);
    close(again.y, 450, 6);
  });

  it("draws a point across the date line on the nearer copy of the world", () => {
    const at = project({ lat: 0, lon: -179 }, { center: { lat: 0, lon: 179 }, zoom: 5 }, 800, 600);
    expect(at.x).toBeGreaterThan(400);
    expect(at.x).toBeLessThan(800);
  });

  it("follows a drag and zooms about the pointer", () => {
    // Dragging the map right shows what lies to the west.
    expect(panBy(view, 100, 0).center.lon).toBeLessThan(BRIDGE.lon);
    const pointer = { x: 600, y: 150 };
    const under = unproject(pointer, view, 800, 600);
    const zoomed = zoomAbout(view, 16, pointer, 800, 600);
    expect(zoomed.zoom).toBe(16);
    const still = project(under, zoomed, 800, 600);
    close(still.x, pointer.x, 5);
    close(still.y, pointer.y, 5);
    expect(zoomAbout(view, 40, null, 800, 600).zoom).toBe(MAX_ZOOM);
    expect(zoomAbout(view, -3, null, 800, 600).zoom).toBe(MIN_ZOOM);
  });
});

describe("distances and the scale", () => {
  it("measures along the globe", () => {
    // San Francisco to Los Angeles, about 559 km.
    expect(
      Math.abs(
        distanceBetween({ lat: 37.7749, lon: -122.4194 }, { lat: 34.0522, lon: -118.2437 }) -
          559_000,
      ),
    ).toBeLessThan(2_000);
    // 156,543 m a pixel at zoom 0 on the equator, a quarter of that at zoom 2.
    close(metersPerPixel(0, 2), 39_135.76, 1);
  });

  it("writes distances in the person's units", () => {
    expect(unitsFor("en-US")).toBe("imperial");
    expect(unitsFor("en-GB")).toBe("metric");
    expect(unitsFor("fr")).toBe("metric");
    // The region past a script subtag, a region in lower case or after an underscore, and the
    // likely region of a bare language.
    expect(unitsFor("en-Latn-US")).toBe("imperial");
    expect(unitsFor("zh-Hant-TW")).toBe("metric");
    expect(unitsFor("en-us")).toBe("imperial");
    expect(unitsFor("en_US")).toBe("imperial");
    expect(unitsFor("en")).toBe("imperial");
    expect(unitsFor("my")).toBe("imperial");
    expect(unitsFor("not a locale!")).toBe("metric");
    expect(unitsFor(undefined)).toBe("metric");
    expect(formatDistance(2605.5, "metric")).toBe("2.6 km");
    expect(formatDistance(48.1, "metric")).toBe("50 m");
    expect(formatDistance(25_400, "metric")).toBe("25 km");
    expect(formatDistance(2605.5, "imperial")).toBe("1.6 mi");
    expect(formatDistance(48.1, "imperial")).toBe("160 ft");
  });

  it("labels the scale bar with a round distance that fits", () => {
    for (const units of ["metric", "imperial"] as const) {
      for (const zoom of [3, 10, 15, 19]) {
        const legend = scaleLegend(37.8, zoom, units, 100);
        expect(legend.pixels).toBeGreaterThan(0);
        expect(legend.pixels).toBeLessThanOrEqual(100);
        expect(legend.label).toMatch(/^[\d,]+ (m|km|ft|mi)$/);
      }
    }
  });
});
