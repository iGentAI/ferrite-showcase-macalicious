import { describe, expect, it } from "vitest";
import { areaBetween, areaPixels } from "./quicktime-player-area";

describe("the part of a screen to record", () => {
  it("is the box between two points, whichever way it is dragged, kept inside the picture", () => {
    expect(areaBetween([0.75, 0.5], [0.25, 0.25])).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.25 });
    expect(areaBetween([-1, -1], [2, 0.5])).toEqual({ x: 0, y: 0, w: 1, h: 0.5 });
  });

  it("is nothing when the drag is too small to record", () => {
    expect(areaBetween([0.5, 0.5], [0.505, 0.9])).toBeNull();
  });

  it("comes to even pixels on the picture", () => {
    expect(areaPixels({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 1281, 721)).toEqual({
      x: 320,
      y: 361,
      width: 640,
      height: 180,
    });
  });
});
