import { describe, expect, it } from "vitest";
import { foregroundMask, replaceBackground } from "./photo-booth-backdrop";

const SIZE = 40;

/** A frame of one colour, with a block of another from (10,10) to (29,29) when one is given. */
function frameOf(colour: readonly number[], block?: readonly number[]) {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const inside = block && x >= 10 && x < 30 && y >= 10 && y < 30;
      data.set([...(inside ? block : colour), 255], (y * SIZE + x) * 4);
    }
  }
  return data;
}
const pixel = (data: Uint8ClampedArray, x: number, y: number) => [
  ...data.slice((y * SIZE + x) * 4, (y * SIZE + x) * 4 + 3),
];

describe("replacing the background", () => {
  it("marks what differs from the empty frame, and nothing else", () => {
    const mask = foregroundMask(
      frameOf([40, 120, 40], [200, 180, 160]),
      frameOf([40, 120, 40]),
      SIZE,
      SIZE,
    );
    expect(mask[20 * SIZE + 20]).toBe(255);
    expect(mask[2 * SIZE + 2]).toBe(0);
  });

  it("shows the backdrop where the empty background was, and the person where they stand", () => {
    const frame = frameOf([40, 120, 40], [200, 180, 160]);
    replaceBackground(frame, frameOf([40, 120, 40]), frameOf([10, 20, 250]), SIZE, SIZE);
    expect(pixel(frame, 2, 2)).toEqual([10, 20, 250]);
    expect(pixel(frame, 20, 20)).toEqual([200, 180, 160]);
  });

  it("takes camera noise for background", () => {
    const frame = frameOf([46, 114, 46]);
    replaceBackground(frame, frameOf([40, 120, 40]), frameOf([10, 20, 250]), SIZE, SIZE);
    expect(pixel(frame, 20, 20)).toEqual([10, 20, 250]);
  });
});
