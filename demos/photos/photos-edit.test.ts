import { describe, expect, it } from "vitest";
import {
  adjustPixels,
  applySpots,
  aspectFits,
  autoAdjust,
  bandOf,
  beforeChannelCurves,
  type Crop,
  cropToAspect,
  curveWithPick,
  dragCrop,
  type Edit,
  editedSize,
  editFromServer,
  FILTERS,
  flipCrop,
  flipEdit,
  histogramOf,
  isIdentity,
  MAX_CURVE_POINTS,
  MIN_CROP,
  NO_ADJUST,
  NO_EDIT,
  neutralBalance,
  normalizeCrop,
  perspectiveSource,
  pointOnOriginal,
  skinBalance,
  skinPixels,
  straightenScale,
  toneTable,
  turnCropLeft,
  turnLeft,
  warpPixels,
  withChannelTone,
  withCurvePick,
} from "./photos-edit";

const pixel = (r: number, g: number, b: number) => ({
  data: new Uint8ClampedArray([r, g, b, 255]),
  width: 1,
  height: 1,
});

/** A crop compared to `want` to nine places. */
const expectCrop = (got: Crop | null, want: Crop) => {
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(got?.[key], key).toBeCloseTo(want[key], 9);
  }
};

describe("an edit", () => {
  it("that changes nothing is no edit, and anything else is one", () => {
    expect(isIdentity(NO_EDIT)).toBe(true);
    expect(isIdentity({ ...NO_EDIT, crop: { x: 0, y: 0, width: 1, height: 1 } })).toBe(true);
    expect(isIdentity({ ...NO_EDIT, rotate: 4 })).toBe(true);
    expect(isIdentity({ ...NO_EDIT, rotate: 1 })).toBe(false);
    expect(isIdentity({ ...NO_EDIT, filter: "mono" })).toBe(false);
    expect(isIdentity({ ...NO_EDIT, adjust: { ...NO_ADJUST, exposure: 0.1 } })).toBe(false);
  });

  it("read from the server is made whole and kept in range", () => {
    expect(editFromServer(null)).toBeNull();
    expect(
      editFromServer({ adjust: { exposure: 3, tint: "x" }, filter: "sparkle", rotate: 5 }),
    ).toEqual({
      ...NO_EDIT,
      rotate: 1,
      adjust: { ...NO_ADJUST, exposure: 1 },
    });
    expect(editFromServer({ crop: { x: 0.9, y: 0, width: 0.5, height: 2 } })?.crop).toEqual({
      x: 0.5,
      y: 0,
      width: 0.5,
      height: 1,
    });
  });

  it("has the filters the module accepts, by id", () => {
    expect(FILTERS.map((filter) => filter.id)).toEqual([
      "none",
      "vivid",
      "vivid-warm",
      "vivid-cool",
      "dramatic",
      "dramatic-warm",
      "dramatic-cool",
      "mono",
      "silvertone",
      "noir",
    ]);
  });

  it("comes out at the size of its turned crop", () => {
    const edit: Edit = { ...NO_EDIT, rotate: 1, crop: { x: 0, y: 0, width: 0.5, height: 0.25 } };
    expect(editedSize(4000, 3000, edit)).toEqual({ width: 1500, height: 1000 });
    expect(editedSize(4000, 3000, NO_EDIT)).toEqual({ width: 4000, height: 3000 });
  });

  it("straightened is enlarged just enough to leave no corner empty", () => {
    expect(straightenScale(400, 300, 0)).toBe(1);
    const scale = straightenScale(400, 300, 10);
    const angle = (10 * Math.PI) / 180;
    // The frame's far corner, turned back, lands on the enlarged picture's edge.
    const x = 200 * Math.cos(angle) + 150 * Math.sin(angle);
    const y = 200 * Math.sin(angle) + 150 * Math.cos(angle);
    expect(Math.max(x / 200, y / 150)).toBeCloseTo(scale, 10);
  });
});

describe("White Balance's Neutral Gray", () => {
  const pixel = (r: number, g: number, b: number) =>
    ({ data: new Uint8ClampedArray([r, g, b, 255]), width: 1, height: 1 }) as ImageData;

  it("changes nothing on a gray picture", () => {
    expect(neutralBalance(pixel(128, 128, 128))).toEqual({ warmth: 0, tint: 0 });
  });

  it("cools a warm picture and warms a cool one", () => {
    expect(neutralBalance(pixel(153, 128, 102)).warmth).toBeCloseTo(-1);
    expect(neutralBalance(pixel(102, 128, 153)).warmth).toBeCloseTo(1);
  });

  it("brings a green cast down with tint", () => {
    expect(neutralBalance(pixel(120, 130, 120)).tint).toBeCloseTo(0.49, 1);
  });
});

describe("White Balance's Skin Tone", () => {
  it("leaves skin as it is, and warms what is too cool to be skin", () => {
    const skin = skinBalance(pixel(225, 180, 150));
    expect(skin.warmth).toBeCloseTo(0, 1);
    expect(skin.tint).toBeCloseTo(0, 1);
    expect(skinBalance(pixel(190, 170, 165)).warmth).toBeCloseTo(0.9, 1);
  });

  it("takes the balance out of too warm a picture", () => {
    expect(skinBalance(pixel(240, 150, 90)).warmth).toBeLessThan(-0.2);
  });

  it("goes by the pixels that could be skin, and finds none in gray and blue", () => {
    const data = new Uint8ClampedArray([225, 180, 150, 255, 40, 60, 210, 255]);
    const found = skinPixels({ data, width: 2, height: 1 });
    expect([...(found?.data ?? [])]).toEqual([225, 180, 150, 255]);
    expect(
      skinPixels({
        data: new Uint8ClampedArray([128, 128, 128, 255, 40, 60, 210, 255]),
        width: 2,
        height: 1,
      }),
    ).toBeNull();
  });
});

describe("the Selective Color eyedropper", () => {
  it("names the range nearest a colour's hue", () => {
    expect(bandOf(0.82, 0.16, 0.16)).toBe("red");
    expect(bandOf(0.16, 0.7, 0.24)).toBe("green");
    expect(bandOf(0.16, 0.24, 0.82)).toBe("blue");
    expect(bandOf(0.9, 0.9, 0.1)).toBe("yellow");
    // Hue 340 lies nearer red than magenta, across the top of the wheel.
    expect(bandOf(0.9, 0.1, 0.37)).toBe("red");
  });

  it("names none for gray", () => {
    expect(bandOf(0.5, 0.5, 0.5)).toBeNull();
    expect(bandOf(0.5, 0.505, 0.5)).toBeNull();
  });
});

describe("the Curves eyedroppers", () => {
  const pick = [0.5, 0.4, 0.3] as const;

  it("with RGB set each colour's own curve from the pixel", () => {
    const black = withCurvePick(NO_EDIT, "rgb", "black", pick);
    expect(black.curve).toEqual([]);
    expect(black.channels?.red?.curve).toEqual([[0.5, 0]]);
    expect(black.channels?.green?.curve).toEqual([[0.4, 0]]);
    expect(black.channels?.blue?.curve).toEqual([[0.3, 0]]);
    const white = withCurvePick(NO_EDIT, "rgb", "white", pick);
    expect(white.channels?.green?.curve).toEqual([[0.4, 1]]);
  });

  it("send gray to the pixel's mean, so it comes out neutral", () => {
    const gray = withCurvePick(NO_EDIT, "rgb", "gray", pick);
    expect(gray.channels?.red?.curve).toEqual([[0.5, 0.4]]);
    expect(gray.channels?.blue?.curve).toEqual([[0.3, 0.4]]);
    const outs = (["red", "green", "blue"] as const).map(
      (channel, index) =>
        toneTable(null, gray.channels?.[channel]?.curve ?? [])[
          Math.round((pick[index] ?? 0) * 255)
        ] ?? 0,
    );
    expect(Math.max(...outs) - Math.min(...outs)).toBeLessThanOrEqual(1);
    expect(outs[1]).toBe(102);
  });

  it("with one colour chosen leave the others alone", () => {
    const red = withCurvePick(NO_EDIT, "red", "white", pick);
    expect(red.channels?.red?.curve).toEqual([[0.5, 1]]);
    expect(red.channels?.green).toBeUndefined();
    expect(red.channels?.blue).toBeUndefined();
  });

  it("drop the points a black or white point would cross, and keep the rest", () => {
    const curve = [
      [0.1, 0.2],
      [0.5, 0.5],
      [0.9, 0.8],
    ] as const;
    expect(curveWithPick(curve, "black", 0.3, 0)).toEqual([
      [0.3, 0],
      [0.5, 0.5],
      [0.9, 0.8],
    ]);
    expect(curveWithPick(curve, "white", 0.7, 1)).toEqual([
      [0.1, 0.2],
      [0.5, 0.5],
      [0.7, 1],
    ]);
    expect(curveWithPick(curve, "gray", 0.51, 0.3)).toEqual([
      [0.1, 0.2],
      [0.51, 0.3],
      [0.9, 0.8],
    ]);
  });

  it("add nothing when the pixel is already there, and stay within a full curve", () => {
    expect(curveWithPick([], "black", 0, 0)).toEqual([]);
    expect(curveWithPick([], "white", 1, 1)).toEqual([]);
    const full = Array.from(
      { length: MAX_CURVE_POINTS },
      (_, at) => [(at + 1) / 10, (at + 1) / 10] as const,
    );
    const added = curveWithPick(full, "gray", 0.35, 0.5);
    expect(added).toHaveLength(MAX_CURVE_POINTS);
    expect(added.some(([x, y]) => x === 0.35 && y === 0.5)).toBe(true);
    for (let at = 1; at < added.length; at += 1) {
      expect(added[at]?.[0]).toBeGreaterThan(added[at - 1]?.[0] ?? 2);
    }
  });

  it("read what those curves are fed: a colour's Levels stay, its curve and Selective Color go", () => {
    const edit: Edit = {
      ...NO_EDIT,
      curve: [[0.5, 0.6]],
      channels: {
        red: { levels: { black: 0.1, gamma: 1, white: 1 }, curve: [[0.5, 0.2]] },
        green: { levels: null, curve: [[0.5, 0.2]] },
      },
      selective: { red: { hue: 1, saturation: 0, luminance: 0 } },
    };
    const bare = beforeChannelCurves(edit);
    expect(bare.curve).toEqual([[0.5, 0.6]]);
    expect(bare.channels).toEqual({
      red: { levels: { black: 0.1, gamma: 1, white: 1 }, curve: [] },
    });
    expect(bare.selective).toBeUndefined();
  });
});

describe("Perspective", () => {
  // Nine by nine pixels, red on the left third and blue on the rest.
  const picture = () => {
    const data = new Uint8ClampedArray(9 * 9 * 4);
    for (let at = 0; at < data.length; at += 4) {
      const column = (at / 4) % 9;
      data.set(column < 3 ? [255, 0, 0, 255] : [0, 0, 255, 255], at);
    }
    return { data, width: 9, height: 9 };
  };
  const redColumns = (pixels: { data: Uint8ClampedArray; width: number }, row: number) => {
    let count = 0;
    for (let column = 0; column < pixels.width; column += 1) {
      if ((pixels.data[(row * pixels.width + column) * 4] ?? 0) > 127) count += 1;
    }
    return count;
  };

  it("changes nothing at zero and keeps the centre where it is", () => {
    expect(perspectiveSource(0.4, -0.3, 0, 0)).toEqual([0.4, -0.3]);
    const [x, y] = perspectiveSource(0, 0, 0.8, -0.6);
    expect(Math.abs(x)).toBeLessThan(1e-9);
    expect(Math.abs(y)).toBeLessThan(1e-9);
  });

  it("reads the whole frame from inside the picture at every strength", () => {
    for (const vertical of [-1, -0.5, 0, 0.5, 1]) {
      for (const horizontal of [-1, -0.5, 0, 0.5, 1]) {
        for (const x of [-1, 1]) {
          for (const y of [-1, 1]) {
            const [fromX, fromY] = perspectiveSource(x, y, vertical, horizontal);
            expect(Math.abs(fromX)).toBeLessThanOrEqual(1 + 1e-9);
            expect(Math.abs(fromY)).toBeLessThanOrEqual(1 + 1e-9);
          }
        }
      }
    }
  });

  it("above 0 narrows the top: the line left of centre leans towards the centre going up", () => {
    const from = picture();
    const to = { data: new Uint8ClampedArray(from.data.length), width: 9, height: 9 };
    warpPixels(from, to, 1, 0);
    // The bottom is enlarged, so the line lies further left there: less red than the top.
    expect(redColumns(to, 0)).toBeGreaterThan(redColumns(to, 8));
    warpPixels(from, to, -1, 0);
    expect(redColumns(to, 8)).toBeGreaterThan(redColumns(to, 0));
  });

  it("turns and flips with the picture, as it looks", () => {
    const tilted: Edit = { ...NO_EDIT, vertical: 0.5, horizontal: 0.25 };
    const turned = turnLeft(tilted);
    expect(turned.vertical).toBe(0.25);
    expect(turned.horizontal).toBe(-0.5);
    expect(flipEdit(tilted).horizontal).toBe(-0.25);
    expect(flipEdit(tilted).vertical).toBe(0.5);
    expect(turnLeft(NO_EDIT).vertical).toBeUndefined();
    expect(flipEdit(NO_EDIT).horizontal).toBeUndefined();
  });

  it("is part of an edit, kept in range when read from the server", () => {
    expect(isIdentity({ ...NO_EDIT, vertical: 0, horizontal: 0 })).toBe(true);
    expect(isIdentity({ ...NO_EDIT, vertical: 0.1 })).toBe(false);
    expect(isIdentity({ ...NO_EDIT, horizontal: -0.1 })).toBe(false);
    const read = editFromServer({ vertical: 3, horizontal: -0.5 });
    expect(read?.vertical).toBe(1);
    expect(read?.horizontal).toBe(-0.5);
    expect(editFromServer({})?.vertical).toBeUndefined();
  });

  it("is undone when a click on the picture is placed on the original", () => {
    const edit: Edit = { ...NO_EDIT, vertical: 1 };
    const [fromX, fromY] = perspectiveSource(-1, -1, 1, 0);
    const point = pointOnOriginal(edit, 100, 100, 0, 0);
    expect(point.x).toBeCloseTo((fromX + 1) / 2);
    expect(point.y).toBeCloseTo((fromY + 1) / 2);
    expect(pointOnOriginal(edit, 100, 100, 0.5, 0.5).x).toBeCloseTo(0.5);
  });
});

describe("a crop", () => {
  const start = { x: 0.2, y: 0.2, width: 0.5, height: 0.5 };

  it("moves inside the frame", () => {
    expectCrop(dragCrop(start, "move", 0.1, -0.1), { ...start, x: 0.3, y: 0.1 });
    expectCrop(dragCrop(start, "move", 1, 1), { ...start, x: 0.5, y: 0.5 });
  });

  it("keeps the opposite edge where it is when an edge is dragged", () => {
    expectCrop(dragCrop(start, "e", 0.1, 0.3), { ...start, width: 0.6 });
    expectCrop(dragCrop(start, "s", 0.3, 0.1), { ...start, height: 0.6 });
    expectCrop(dragCrop(start, "w", -0.1, 0.3), { ...start, x: 0.1, width: 0.6 });
    expectCrop(dragCrop(start, "n", 0.3, -0.1), { ...start, y: 0.1, height: 0.6 });
  });

  it("moves only an edge's own side, whatever shape is asked for", () => {
    expectCrop(dragCrop(start, "e", 0.1, 0.3, 1), { ...start, width: 0.6 });
    expectCrop(dragCrop(start, "s", 0.3, 0.1, 1), { ...start, height: 0.6 });
    expectCrop(dragCrop(start, "w", -0.1, 0.3, 1), { ...start, x: 0.1, width: 0.6 });
    expectCrop(dragCrop(start, "n", 0.3, -0.1, 1), { ...start, y: 0.1, height: 0.6 });
  });

  it("keeps the opposite corner where it is when a corner is dragged", () => {
    const se = dragCrop(start, "se", 0.1, 0.2);
    expect(se.x).toBeCloseTo(0.2);
    expect(se.width).toBeCloseTo(0.6);
    expect(se.height).toBeCloseTo(0.7);
    const nw = dragCrop(start, "nw", -0.1, -0.5);
    expect(nw.x).toBeCloseTo(0.1);
    expect(nw.y).toBeCloseTo(0);
    expect(nw.x + nw.width).toBeCloseTo(0.7);
    expect(nw.y + nw.height).toBeCloseTo(0.7);
  });

  it("keeps a chosen shape while a corner is dragged, inside the frame", () => {
    const square = dragCrop(start, "se", 0.3, 0, 1);
    expect(square.width).toBeCloseTo(square.height);
    expect(square.x + square.width).toBeLessThanOrEqual(1);
    expect(square.y + square.height).toBeLessThanOrEqual(1);
  });

  it("keeps both sides of a shaped crop at least the least size", () => {
    const small = { x: 0.4, y: 0.4, width: 0.04, height: 0.02 };
    const wide = dragCrop(small, "se", -0.5, 0, 2);
    expect(wide.width).toBeGreaterThanOrEqual(0.02 - 1e-9);
    expect(wide.height).toBeGreaterThanOrEqual(0.02 - 1e-9);
    expect(wide.width / wide.height).toBeCloseTo(2);
    // A shape that cannot fit the room at the least size leaves the crop as it was.
    const corner = { x: 0.99, y: 0.5, width: 0.01, height: 0.02 };
    expect(dragCrop(corner, "se", 0, 0, 4)).toEqual(corner);
  });

  it("flips as it looks: the angle changes sign and the crop is mirrored", () => {
    const straightened: Edit = {
      ...NO_EDIT,
      straighten: 12,
      crop: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    };
    const flipped = flipEdit(straightened);
    expect(flipped.flip).toBe(true);
    expect(flipped.straighten).toBe(-12);
    expect(flipped.crop?.x).toBeCloseTo(0.6);
    // Mirrored twice is the photo again.
    expect(flipEdit(flipped).straighten).toBe(12);
    expect(flipEdit(flipped).crop?.x).toBeCloseTo(0.1);
    expect(flipEdit(NO_EDIT).straighten).toBe(0);
  });

  it("turns and flips with the picture", () => {
    const crop = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
    expectCrop(turnCropLeft(crop), { x: 0.2, y: 0.6, width: 0.4, height: 0.3 });
    // Four quarter turns bring it back.
    let turned: typeof crop | null = crop;
    for (let i = 0; i < 4; i += 1) turned = turnCropLeft(turned);
    expect(turned?.x).toBeCloseTo(crop.x);
    expect(turned?.y).toBeCloseTo(crop.y);
    expect(flipCrop(crop)?.x).toBeCloseTo(0.6);
    expect(turnCropLeft(null)).toBeNull();
  });

  it("turns left as it looks, also when the picture is flipped", () => {
    expect(turnLeft(NO_EDIT).rotate).toBe(1);
    expect(turnLeft({ ...NO_EDIT, flip: true }).rotate).toBe(3);
  });

  it("of an aspect grows both sides together to the least size, keeping its shape", () => {
    // A tiny crop made 2:1 (a 100 by 100 frame): both sides grow until the shorter is MIN_CROP.
    const wide = cropToAspect({ x: 0.5, y: 0.5, width: 0.01, height: 0.01 }, 2, 100, 100);
    expect(wide?.height).toBeCloseTo(MIN_CROP);
    expect(wide?.width).toBeCloseTo(2 * MIN_CROP);
    expect((wide?.width ?? 0) / (wide?.height ?? 1)).toBeCloseTo(2);
    // A square of a 10000 by 100 panorama cannot have both sides at MIN_CROP inside the frame:
    // the crop stays as it was (the Crop pane keeps it freeform).
    expect(aspectFits(1, 10_000, 100)).toBe(false);
    expect(cropToAspect(null, 1, 10_000, 100)).toBeNull();
    const kept = { x: 0.1, y: 0.2, width: 0.5, height: 0.5 };
    expect(cropToAspect(kept, 1, 10_000, 100)).toBe(kept);
    expect(aspectFits(2, 100, 100)).toBe(true);
  });

  it("of an aspect reads back from the server as it was saved", () => {
    for (const [crop, aspect, w, h] of [
      [{ x: 0.5, y: 0.5, width: 0.01, height: 0.01 }, 2, 100, 100],
      [null, 16 / 9, 4000, 3000],
      [{ x: 0, y: 0.4, width: 1, height: 0.03 }, 1, 400, 200],
    ] as const) {
      const fitted = cropToAspect(crop, aspect, w, h);
      const read = editFromServer({ ...NO_EDIT, crop: fitted })?.crop;
      expect(read?.width).toBeCloseTo(fitted?.width ?? 0, 9);
      expect(read?.height).toBeCloseTo(fitted?.height ?? 0, 9);
      expect(read?.x).toBeCloseTo(fitted?.x ?? 0, 9);
      expect(read?.y).toBeCloseTo(fitted?.y ?? 0, 9);
    }
  });

  it("of an aspect is the largest of that shape around the crop's centre", () => {
    const square = cropToAspect(null, 1, 400, 200);
    expect(square).toEqual({ x: 0.25, y: 0, width: 0.5, height: 1 });
    expect(cropToAspect(start, null, 400, 200)).toBe(start);
    expect(normalizeCrop({ x: -1, y: 0.99, width: 0, height: 3 })).toEqual({
      x: 0,
      y: 0,
      width: 0.02,
      height: 1,
    });
  });
});

describe("applySpots", () => {
  const plain = (width: number, height: number, rgb: readonly number[]) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let at = 0; at < data.length; at += 4) {
      data[at] = rgb[0] ?? 0;
      data[at + 1] = rgb[1] ?? 0;
      data[at + 2] = rgb[2] ?? 0;
      data[at + 3] = 255;
    }
    return { data, width, height };
  };
  const read = (image: ReturnType<typeof plain>, x: number, y: number) => [
    ...image.data.slice(4 * (y * image.width + x), 4 * (y * image.width + x) + 3),
  ];

  it("retouch fills a blemish from its rim and leaves what is outside", () => {
    const image = plain(40, 40, [200, 200, 200]);
    image.data.set([0, 0, 0, 255], 4 * (20 * 40 + 20));
    applySpots(image, [{ x: 0.5, y: 0.5, radius: 0.1, kind: "retouch" }]);
    expect(read(image, 20, 20)).toEqual([200, 200, 200]);
    expect(read(image, 2, 2)).toEqual([200, 200, 200]);
  });

  it("red-eye takes out red, and leaves another colour in the circle", () => {
    const eye = plain(20, 20, [220, 40, 20]);
    applySpots(eye, [{ x: 0.5, y: 0.5, radius: 0.2, kind: "red-eye" }]);
    expect(read(eye, 10, 10)).toEqual([30, 40, 20]);
    expect(read(eye, 0, 0)).toEqual([220, 40, 20]);
    const iris = plain(20, 20, [40, 90, 200]);
    applySpots(iris, [{ x: 0.5, y: 0.5, radius: 0.2, kind: "red-eye" }]);
    expect(read(iris, 10, 10)).toEqual([40, 90, 200]);
  });
});

describe("toneTable", () => {
  it("keeps a colour's own Levels and Curve with the edit, and drops a colour left with nothing", () => {
    const red = { levels: null, curve: [[0.5, 0.75]] as [number, number][] };
    const one = withChannelTone(undefined, "red", red);
    expect(one).toEqual({ red });
    expect(withChannelTone(one, "red", { levels: null, curve: [] })).toBeUndefined();
    expect(isIdentity({ ...NO_EDIT, channels: one })).toBe(false);
    expect(
      editFromServer({ channels: { red: { curve: [[0.5, 0.75]] } } })?.channels?.red?.curve,
    ).toEqual([[0.5, 0.75]]);
  });

  it("counts a picture's values in a histogram, by colour", () => {
    const pixels = {
      data: Uint8ClampedArray.from([10, 20, 30, 255, 10, 40, 50, 255]),
    } as ImageData;
    const red = histogramOf(pixels, "red");
    expect(red[10]).toBe(2);
    expect(histogramOf(pixels, "blue")[50]).toBe(1);
    expect(histogramOf(pixels, "rgb").reduce((sum, count) => sum + count, 0)).toBe(2);
  });
  it("changes nothing with a curve along the diagonal", () => {
    const table = toneTable(null, [[0.5, 0.5]]);
    expect([table[0], table[128], table[255]]).toEqual([0, 128, 255]);
  });

  it("maps Levels' black and white to the ends", () => {
    const table = toneTable({ black: 0.2, gamma: 1, white: 0.8 }, []);
    expect(table[Math.round(0.2 * 255)]).toBe(0);
    expect(table[Math.round(0.8 * 255)]).toBe(255);
    expect(table[128]).toBe(128);
  });

  it("lifts the midtones with a gamma above 1", () => {
    expect(toneTable({ black: 0, gamma: 2, white: 1 }, [])[64]).toBe(128);
  });

  it("draws a curve straight between its points and through the ends", () => {
    const table = toneTable(null, [[0.5, 0.75]]);
    expect(table[0]).toBe(0);
    expect(table[255]).toBe(255);
    expect(table[128]).toBe(192);
  });
});

describe("pointOnOriginal", () => {
  const near = (got: { x: number; y: number }, x: number, y: number) => {
    expect(got.x).toBeCloseTo(x, 6);
    expect(got.y).toBeCloseTo(y, 6);
  };

  it("undoes a flip and a crop", () => {
    near(pointOnOriginal({ ...NO_EDIT, flip: true }, 400, 200, 0, 0), 1, 0);
    const crop = { x: 0.5, y: 0.5, width: 0.5, height: 0.5 };
    near(pointOnOriginal({ ...NO_EDIT, crop }, 400, 200, 0, 0), 0.5, 0.5);
  });

  it("undoes a quarter turn left: the shown top left was the original's top right", () => {
    near(pointOnOriginal({ ...NO_EDIT, rotate: 1 }, 400, 200, 0, 0), 1, 0);
  });
});

describe("the adjustments", () => {
  it("draw an edit saved before the newer sliders as they drew it", () => {
    const saved = editFromServer({
      rotate: 0,
      flip: false,
      straighten: 0,
      crop: null,
      filter: "none",
      adjust: {
        exposure: 0.5,
        brightness: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        saturation: 0,
        warmth: 0,
        tint: 0,
      },
    });
    expect(saved?.adjust).toEqual({ ...NO_ADJUST, exposure: 0.5 });
    const sample = pixel(100, 100, 100);
    adjustPixels(sample, saved?.adjust ?? NO_ADJUST, "none");
    const expected = pixel(100, 100, 100);
    adjustPixels(expected, { ...NO_ADJUST, exposure: 0.5 }, "none");
    expect([...sample.data]).toEqual([...expected.data]);
    expect(sample.data[0]).toBeGreaterThan(100);
    expect(sample.data[3]).toBe(255);
  });

  it("change nothing at zero with no filter", () => {
    const sample = pixel(10, 120, 240);
    adjustPixels(sample, NO_ADJUST, "none");
    expect([...sample.data]).toEqual([10, 120, 240, 255]);
  });

  it("brighten with exposure and darken against it", () => {
    const up = pixel(100, 100, 100);
    adjustPixels(up, { ...NO_ADJUST, exposure: 0.5 }, "none");
    expect(up.data[0]).toBeGreaterThan(100);
    const down = pixel(100, 100, 100);
    adjustPixels(down, { ...NO_ADJUST, exposure: -0.5 }, "none");
    expect(down.data[0]).toBeLessThan(100);
  });

  it("make grey with no saturation or a mono filter, and keep alpha", () => {
    for (const [adjust, filter] of [
      [{ ...NO_ADJUST, saturation: -1 }, "none"],
      [NO_ADJUST, "mono"],
      [NO_ADJUST, "noir"],
    ] as const) {
      const sample = pixel(200, 40, 90);
      adjustPixels(sample, adjust, filter);
      expect(sample.data[0]).toBe(sample.data[1]);
      expect(sample.data[1]).toBe(sample.data[2]);
      expect(sample.data[3]).toBe(255);
    }
  });

  it("warm by adding red and taking blue", () => {
    const sample = pixel(128, 128, 128);
    adjustPixels(sample, { ...NO_ADJUST, warmth: 1 }, "none");
    expect(sample.data[0]).toBeGreaterThan(128);
    expect(sample.data[2]).toBeLessThan(128);
  });

  it("of Auto Enhance brighten a dark picture and darken a bright one", () => {
    const enhanced = (grey: number) => {
      const data = new Uint8ClampedArray(64 * 64 * 4);
      for (let at = 0; at < data.length; at += 4) data.set([grey, grey, grey, 255], at);
      const adjust = autoAdjust({ data, width: 64, height: 64 });
      const sample = pixel(grey, grey, grey);
      adjustPixels(sample, adjust, "none");
      return { adjust, shown: sample.data[0] ?? 0 };
    };
    // Its contrast must not take back the exposure's brightening (30 once came out as 26).
    const dark = enhanced(30);
    expect(dark.adjust.exposure).toBeGreaterThan(0);
    expect(dark.shown).toBeGreaterThan(36);
    expect(dark.adjust.saturation).toBe(0.1);
    expect(enhanced(230).shown).toBeLessThan(220);
    // A flat picture of middle grey keeps its full contrast.
    expect(enhanced(128).adjust.contrast).toBe(0.44);
  });

  it("of Auto Enhance keep half of the exposure's brightening as drawn, with clipping", () => {
    // 99 dark pixels and one white, in blocks of 16 so the sampling sees the same mix.
    const block = 16;
    const pixels = 100 * block;
    const data = new Uint8ClampedArray(pixels * 4);
    for (let at = 0; at < pixels; at += 1) {
      const grey = Math.floor(at / block) === 99 ? 255 : 13;
      data.set([grey, grey, grey, 255], at * 4);
    }
    const adjust = autoAdjust({ data, width: pixels, height: 1 });
    const meanOf = (given: typeof adjust) => {
      const copy = data.slice();
      adjustPixels({ data: copy, width: pixels, height: 1 }, given, "none");
      let total = 0;
      for (let at = 0; at < copy.length; at += 4) total += copy[at] ?? 0;
      return total / pixels;
    };
    const before = meanOf(NO_ADJUST);
    const exposureOnly = meanOf({ ...adjust, contrast: 0 });
    expect(exposureOnly).toBeGreaterThan(before);
    expect(meanOf(adjust)).toBeGreaterThanOrEqual((before + exposureOnly) / 2 - 0.5);
  });
});
