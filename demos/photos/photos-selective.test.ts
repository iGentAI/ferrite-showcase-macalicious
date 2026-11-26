import { describe, expect, it } from "vitest";
import { editFromServer, isIdentity, NO_EDIT, selectPixels, withBandShift } from "./photos-edit";

const pixelOf = (r: number, g: number, b: number) =>
  ({ data: new Uint8ClampedArray([r, g, b, 255]) }) as unknown as ImageData;
const read = ({ data }: ImageData) => [data[0], data[1], data[2]];

describe("Selective Color", () => {
  it("takes the saturation out of the chosen range and leaves others", () => {
    const red = pixelOf(210, 40, 40);
    selectPixels(red, { red: { hue: 0, saturation: -1, luminance: 0 } });
    expect(read(red)).toEqual([125, 125, 125]);
    const blue = pixelOf(40, 60, 210);
    selectPixels(blue, { red: { hue: 0, saturation: -1, luminance: 0 } });
    expect(read(blue)).toEqual([40, 60, 210]);
  });

  it("turns the hue, a half towards the next range at a shift of 1", () => {
    const red = pixelOf(255, 0, 0);
    selectPixels(red, { red: { hue: 1, saturation: 0, luminance: 0 } });
    expect(read(red)).toEqual([255, 128, 0]);
  });

  it("lightens by the luminance, and leaves grays alone", () => {
    const green = pixelOf(0, 200, 0);
    selectPixels(green, { green: { hue: 0, saturation: 0, luminance: 1 } });
    const [r, g, b] = read(green);
    expect(r).toBeGreaterThan(50);
    expect(g).toBe(255);
    expect(b).toBe(r);
    const gray = pixelOf(128, 128, 128);
    selectPixels(gray, { red: { hue: 1, saturation: 1, luminance: 1 } });
    expect(read(gray)).toEqual([128, 128, 128]);
  });

  it("drops a range back to nothing, and is an edit while it holds one", () => {
    const shift = { hue: 0.5, saturation: 0, luminance: 0 };
    const one = withBandShift(undefined, "blue", shift);
    expect(one).toEqual({ blue: shift });
    expect(isIdentity({ ...NO_EDIT, selective: one })).toBe(false);
    expect(withBandShift(one, "blue", { hue: 0, saturation: 0, luminance: 0 })).toBeUndefined();
  });

  it("reads what the server keeps, within the bounds", () => {
    const read = editFromServer({ selective: { red: { hue: 5, saturation: -1, luminance: 0 } } });
    expect(read?.selective).toEqual({ red: { hue: 1, saturation: -1, luminance: 0 } });
  });
});
