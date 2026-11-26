import { describe, expect, it } from "vitest";
import { boundHeight, boundPlace, heightInRoom, readSpotlightPlace } from "./spotlight-place";

const HOME = { left: 400, top: 132, width: 680 };
const LAYER = { width: 1440, height: 900 };

describe("Where Spotlight's window stands", () => {
  it("keeps a place on the screen, within reach", () => {
    expect(boundPlace({ x: 50, y: 20 }, HOME, LAYER)).toEqual({ x: 50, y: 20 });
    expect(boundPlace({ x: 5000, y: 5000 }, HOME, LAYER)).toEqual({ x: 960, y: 688 });
    expect(boundPlace({ x: -5000, y: -5000 }, HOME, LAYER)).toEqual({ x: -1000, y: -132 });
  });

  it("stops where its bottom edge would go under the Dock", () => {
    expect(boundPlace({ x: 0, y: 5000 }, HOME, LAYER, 400)).toEqual({ x: 0, y: 400 });
    expect(boundPlace({ x: 0, y: 300 }, HOME, LAYER, 400)).toEqual({ x: 0, y: 300 });
  });

  it("keeps its height and any other setting while it moves", () => {
    expect(boundPlace({ x: 0, y: 0, height: 500 }, HOME, LAYER).height).toBe(500);
  });

  it("holds a height between what shows results and what fits", () => {
    expect(boundHeight(10)).toBe(200);
    expect(boundHeight(5000)).toBe(720);
    expect(boundHeight(400)).toBe(400);
    // Its bottom edge stays on the screen, where it can be taken hold of again.
    expect(boundHeight(5000, 600)).toBe(600);
    expect(boundHeight(5000, 100)).toBe(200);
  });

  it("takes less height where the Dock leaves less room, whether kept or its own", () => {
    expect(heightInRoom(undefined, 500)).toBeUndefined();
    expect(heightInRoom(undefined, 300)).toBe(300);
    expect(heightInRoom(600, 500)).toBe(500);
    expect(heightInRoom(240, 500)).toBe(240);
  });

  it("reads only what is well formed", () => {
    expect(readSpotlightPlace({ x: 1, y: 2 })).toEqual({ x: 1, y: 2 });
    expect(readSpotlightPlace({ x: 1, y: 2, height: 300 })?.height).toBe(300);
    expect(readSpotlightPlace({ x: "1", y: 2 })).toBeUndefined();
    expect(readSpotlightPlace({ x: 1, y: 2, height: "tall" })).toBeUndefined();
    expect(readSpotlightPlace(null)).toBeUndefined();
  });
});
