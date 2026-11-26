import { describe, expect, it } from "vitest";
import {
  editFromServer,
  horizonAngle,
  isIdentity,
  MAX_STROKE_POINTS,
  NO_EDIT,
  type Pixels,
  thinStroke,
} from "./photos-edit";

/** A picture dark below a line through its middle, tilted by `slope` (down to the right is above 0). */
function horizon(slope: number, width = 200, height = 150): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const line = height / 2 + slope * (x - width / 2);
      // Soft across a pixel, as a real picture's edge is.
      const sky = Math.min(1, Math.max(0, line - y + 0.5));
      const value = 30 + 200 * sky;
      data.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height } as Pixels;
}

describe("Auto in the Crop pane", () => {
  it("straightens against the tilt of the horizon it finds", () => {
    const within = (found: number | null, expected: number) =>
      expect(Math.abs((found ?? 99) - expected)).toBeLessThanOrEqual(0.5);
    within(horizonAngle(horizon(Math.tan((3 * Math.PI) / 180))), -3);
    within(horizonAngle(horizon(Math.tan((-5 * Math.PI) / 180))), 5);
  });

  it("finds a level horizon level", () => {
    expect(horizonAngle(horizon(0))).toBe(0);
  });

  it("finds nothing in a flat picture or a short edge", () => {
    const width = 200;
    const height = 150;
    const flat = new Uint8ClampedArray(width * height * 4).fill(128);
    expect(horizonAngle({ data: flat, width, height } as Pixels)).toBeNull();
    const spot = horizon(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x > 40) spot.data.set([128, 128, 128, 255], (y * width + x) * 4);
      }
    }
    expect(horizonAngle(spot)).toBeNull();
  });
});

describe("Markup in an edit", () => {
  const stroke = { color: "#ff3b30", width: 0.01, points: [[0.1, 0.2] as const] };

  it("makes an edit that is not nothing, and comes back from the server", () => {
    const edit = { ...NO_EDIT, marks: [stroke] };
    expect(isIdentity(edit)).toBe(false);
    expect(editFromServer(edit)?.marks).toEqual([
      { color: "#ff3b30", width: 0.01, points: [[0.1, 0.2]] },
    ]);
  });

  it("has no marks key in an edit without any", () => {
    expect(editFromServer(NO_EDIT)).not.toHaveProperty("marks");
    expect(isIdentity({ ...NO_EDIT, marks: [] })).toBe(true);
  });

  it("leaves out what the server could not have kept", () => {
    expect(
      editFromServer({ ...NO_EDIT, marks: [{ color: "red", width: 0.01, points: [[0, 0]] }] }),
    ).not.toHaveProperty("marks");
  });

  it("thins a long line to what an edit keeps, both ends among the points", () => {
    const long = Array.from({ length: 500 }, (_, at) => [at / 499, 0.123456] as const);
    const thin = thinStroke(long);
    expect(thin).toHaveLength(MAX_STROKE_POINTS);
    expect(thin[0]).toEqual([0, 0.1235]);
    expect(thin.at(-1)).toEqual([1, 0.1235]);
    expect(thinStroke([[0.5, 0.25]])).toEqual([[0.5, 0.25]]);
  });
});
