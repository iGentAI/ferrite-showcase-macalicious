import { describe, expect, it } from "vitest";
import { toWorld } from "../maps/maps-geo";
import type { LibraryPhoto } from "./photos-library";
import { clusterPlaces, fitPlaces } from "./photos-places";

const at = (id: string, lat: number, lon: number) =>
  ({ id, location: { lat, lon } }) as unknown as LibraryPhoto;
const nowhere = { id: "nowhere", location: null } as unknown as LibraryPhoto;

const AMSTERDAM = at("amsterdam", 52.37, 4.89);
const HAARLEM = at("haarlem", 52.38, 4.64);
const TOKYO = at("tokyo", 35.68, 139.69);

describe("clusterPlaces", () => {
  it("merges near places zoomed out and parts them zoomed in", () => {
    const ids = (zoom: number) =>
      clusterPlaces([AMSTERDAM, HAARLEM, TOKYO], zoom).map((pin) => pin.photos.map((p) => p.id));
    expect(ids(4)).toEqual([["amsterdam", "haarlem"], ["tokyo"]]);
    expect(ids(12)).toEqual([["amsterdam"], ["haarlem"], ["tokyo"]]);
  });

  it("leaves out a photo with no location", () => {
    expect(clusterPlaces([nowhere], 4)).toEqual([]);
  });
});

describe("fitPlaces", () => {
  it("comes no closer than a town for one photo, centred on it", () => {
    const view = fitPlaces([AMSTERDAM], 800, 600);
    expect(view.zoom).toBe(13);
    expect(view.center.lat).toBeCloseTo(52.37, 6);
    expect(view.center.lon).toBeCloseTo(4.89, 6);
  });

  it("keeps every photo inside the view, margin included", () => {
    const view = fitPlaces([AMSTERDAM, HAARLEM], 800, 600);
    const left = toWorld(HAARLEM.location as { lat: number; lon: number }, view.zoom).x;
    const right = toWorld(AMSTERDAM.location as { lat: number; lon: number }, view.zoom).x;
    expect(right - left).toBeLessThanOrEqual(800 - 144);
    expect(right - left).toBeGreaterThan((800 - 144) / 2 - 1);
  });

  it("stops at the widest zoom when the world does not fit", () => {
    expect(fitPlaces([at("a", 60, -170), at("b", -50, 170)], 300, 200).zoom).toBe(2);
  });

  it("shows the world for no located photo", () => {
    expect(fitPlaces([nowhere], 800, 600)).toEqual({ center: { lat: 20, lon: 0 }, zoom: 2 });
  });
});
