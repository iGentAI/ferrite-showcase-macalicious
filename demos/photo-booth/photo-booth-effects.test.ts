import { describe, expect, it } from "vitest";
import { EFFECT_PAGES } from "./photo-booth-data";
import { boxBlur, computeEffect, computesEffect, swell, warpSpot } from "./photo-booth-effects";

/** A frame of one colour. */
const flat = (r: number, g: number, b: number, width = 1, height = 1) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let at = 0; at < data.length; at += 4) data.set([r, g, b, 255], at);
  return data;
};
const pixel = (data: Uint8ClampedArray, width: number, x: number, y: number) => [
  ...data.slice((y * width + x) * 4, (y * width + x) * 4 + 3),
];
const colour = (id: string, r: number, g: number, b: number) => {
  const data = flat(r, g, b);
  computeEffect(id, data, 1, 1);
  return [...data.slice(0, 3)];
};

/** 101 by 101 pixels whose red is twice x and whose green is twice y, so that a warp's result says
 * where it read from. */
const SIDE = 101;
function ramp() {
  const data = new Uint8ClampedArray(SIDE * SIDE * 4);
  for (let y = 0, at = 0; y < SIDE; y += 1) {
    for (let x = 0; x < SIDE; x += 1, at += 4) data.set([x * 2, y * 2, 0, 255], at);
  }
  return data;
}
const warpedAt = (id: string, x: number, y: number) => {
  const data = ramp();
  computeEffect(id, data, SIDE, SIDE);
  return pixel(data, SIDE, x, y).slice(0, 2);
};

describe("the effects computed on a frame", () => {
  it("computes the first two pages and leaves the third to the art that follows a face", () => {
    const [distortions, colours, third] = EFFECT_PAGES;
    const computed = (page: typeof distortions) =>
      (page ?? []).filter((effect) => computesEffect(effect.id)).map((effect) => effect.name);
    expect(computed(distortions)).toEqual([
      "Bulge",
      "Dent",
      "Twirl",
      "Squeeze",
      "Mirror",
      "Light Tunnel",
      "Fish Eye",
      "Stretch",
    ]);
    expect(computed(colours)).toEqual([
      "Sepia",
      "Black and White",
      "Plastic Camera",
      "Comic Book",
      "Color Pencil",
      "Glow",
      "Thermal Camera",
      "X-Ray",
    ]);
    expect(computed(third)).toEqual([]);
    expect(computesEffect("constructor")).toBe(false);
  });

  it("leaves a frame as it is for an effect it does not compute", () => {
    expect(colour("normal", 10, 20, 30)).toEqual([10, 20, 30]);
    expect(colour("dizzy", 10, 20, 30)).toEqual([10, 20, 30]);
  });

  it("tones Sepia from the luminance, warm in the highlights", () => {
    expect(colour("sepia", 255, 255, 255)).toEqual([255, 240, 178]);
    expect(colour("sepia", 128, 128, 128)).toEqual([143, 120, 90]);
    expect(colour("sepia", 0, 0, 0)).toEqual([0, 0, 0]);
  });

  it("makes Black and White grey with more contrast than a plain grey", () => {
    expect(colour("black-and-white", 64, 64, 64)).toEqual([40, 40, 40]);
    expect(colour("black-and-white", 192, 192, 192)).toEqual([216, 216, 216]);
    // Red's luminance is 76 of 255: a coloured pixel loses its hue.
    expect(colour("black-and-white", 255, 0, 0)).toEqual([54, 54, 54]);
  });

  it("turns X-Ray's light dark and its dark a blue white", () => {
    expect(colour("x-ray", 255, 255, 255)).toEqual([0, 0, 0]);
    expect(colour("x-ray", 0, 0, 0)).toEqual([209, 235, 255]);
  });

  it("maps Thermal Camera's luminance from cold blue to hot yellow", () => {
    expect(colour("thermal-camera", 0, 0, 0)).toEqual([0, 0, 90]);
    expect(colour("thermal-camera", 255, 255, 255)).toEqual([255, 255, 120]);
    // Three fifths of the way along: the fourth of the six stops.
    expect(colour("thermal-camera", 153, 153, 153)).toEqual([255, 40, 40]);
  });

  it("crosses Plastic Camera's colours and darkens its corners", () => {
    const data = flat(128, 128, 128, 101, 101);
    computeEffect("plastic-camera", data, 101, 101);
    expect(pixel(data, 101, 50, 50)).toEqual([146, 131, 128]);
    expect(pixel(data, 101, 0, 0)).toEqual([51, 46, 45]);
  });

  it("inks Comic Book in pure black and white, with a line along an edge", () => {
    const side = 20;
    const data = flat(255, 255, 255, side, side);
    computeEffect("comic-book", data, side, side);
    expect(pixel(data, side, 10, 10)).toEqual([255, 255, 255]);

    const dark = flat(0, 0, 0, side, side);
    computeEffect("comic-book", dark, side, side);
    expect(pixel(dark, side, 10, 10)).toEqual([0, 0, 0]);

    const halves = flat(255, 255, 255, side, side);
    for (let y = 0; y < side; y += 1) {
      for (let x = 0; x < side / 2; x += 1) halves.set([0, 0, 0, 255], (y * side + x) * 4);
    }
    computeEffect("comic-book", halves, side, side);
    expect(pixel(halves, side, 10, 10)).toEqual([0, 0, 0]);
    expect(pixel(halves, side, 15, 10)).toEqual([255, 255, 255]);
  });

  it("draws Color Pencil on white paper, hatching what is dark", () => {
    const side = 8;
    const white = flat(255, 255, 255, side, side);
    computeEffect("color-pencil", white, side, side);
    expect(pixel(white, side, 4, 4)).toEqual([255, 255, 255]);

    const black = flat(0, 0, 0, side, side);
    computeEffect("color-pencil", black, side, side);
    expect(pixel(black, side, 4, 4)).toEqual([76, 76, 76]);
    expect(pixel(black, side, 4, 6)).toEqual([191, 191, 191]);
  });

  it("spills Glow's light into its neighbours without changing black or white", () => {
    const width = 101;
    const dot = flat(0, 0, 0, width, 1);
    dot.set([255, 255, 255, 255], 50 * 4);
    computeEffect("glow", dot, width, 1);
    expect(pixel(dot, width, 50, 0)).toEqual([255, 255, 255]);
    expect(pixel(dot, width, 52, 0)).toEqual([29, 29, 29]);
    expect(pixel(dot, width, 60, 0)).toEqual([0, 0, 0]);
    expect(colour("glow", 255, 255, 255)).toEqual([255, 255, 255]);
  });

  it("centres a warp on the face it is given", () => {
    const data = ramp();
    computeEffect("bulge", data, SIDE, SIDE, true, { x: 30, y: 70, size: 30 });
    // The face's middle reads itself, and beside it the frame is drawn out from there.
    expect(pixel(data, SIDE, 30, 70).slice(0, 2)).toEqual([60, 140]);
    expect(pixel(data, SIDE, 40, 70).slice(0, 2)).toEqual([75, 140]);
    // The frame's centre, now outside the circle, stays.
    expect(pixel(data, SIDE, 80, 20).slice(0, 2)).toEqual([160, 40]);
  });

  it("warps a spot of a face and leaves the rest", () => {
    const data = ramp();
    warpSpot(data, SIDE, SIDE, 50, 50, 20, swell(0.5));
    expect(pixel(data, SIDE, 50, 50).slice(0, 2)).toEqual([100, 100]);
    expect(pixel(data, SIDE, 60, 50).slice(0, 2)).toEqual([118, 100]);
    expect(pixel(data, SIDE, 75, 50).slice(0, 2)).toEqual([150, 100]);
  });

  it("bulges the centre and leaves the frame outside the circle", () => {
    expect(warpedAt("bulge", 50, 50)).toEqual([100, 100]);
    expect(warpedAt("bulge", 60, 50)).toEqual([113, 100]);
    expect(warpedAt("bulge", 98, 50)).toEqual([196, 100]);
  });

  it("dents the centre: it reads from further out", () => {
    expect(warpedAt("dent", 50, 50)).toEqual([100, 100]);
    expect(warpedAt("dent", 60, 50)).toEqual([131, 100]);
    expect(warpedAt("dent", 98, 50)).toEqual([196, 100]);
  });

  it("twirls about the centre, most near it", () => {
    expect(warpedAt("twirl", 60, 50)).toEqual([105, 119]);
    expect(warpedAt("twirl", 98, 50)).toEqual([196, 100]);
  });

  it("squeezes across the middle and stretches along it", () => {
    expect(warpedAt("squeeze", 60, 50)).toEqual([132, 100]);
    expect(warpedAt("squeeze", 50, 60)).toEqual([100, 120]);
    expect(warpedAt("stretch", 50, 60)).toEqual([100, 113]);
    expect(warpedAt("stretch", 60, 50)).toEqual([124, 100]);
  });

  it("mirrors the left half onto the right", () => {
    const data = new Uint8ClampedArray([
      10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255,
    ]);
    computeEffect("mirror", data, 4, 1);
    expect([data[0], data[4], data[8], data[12]]).toEqual([10, 20, 20, 10]);
  });

  it("keeps Light Tunnel's middle and draws the rest from the wall of its circle", () => {
    expect(warpedAt("light-tunnel", 60, 50)).toEqual([120, 100]);
    expect(warpedAt("light-tunnel", 90, 50)).toEqual([149, 125]);
  });

  it("pulls Fish Eye's whole frame towards the centre, leaving the corners", () => {
    expect(warpedAt("fish-eye", 60, 50)).toEqual([107, 100]);
    expect(warpedAt("fish-eye", 0, 0)).toEqual([0, 0]);
  });

  it("blurs without touching alpha", () => {
    const data = flat(0, 0, 0, 5, 1);
    data.set([255, 255, 255, 200], 2 * 4);
    boxBlur(data, 5, 1, 1);
    expect([data[4], data[7], data[11], data[19]]).toEqual([85, 255, 200, 255]);
  });
});
