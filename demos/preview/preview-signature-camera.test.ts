import { describe, expect, it } from "vitest";
import {
  cameraRefusal,
  coverCrop,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  inkOf,
  signatureOfFrame,
} from "./preview-signature-camera";

/** A sheet of paper as the camera sees it, `paper` giving its light at each column. */
function frame(ink: (x: number, y: number) => boolean, paper: (x: number) => number = () => 235) {
  const data = new Uint8ClampedArray(FRAME_WIDTH * FRAME_HEIGHT * 4);
  for (let y = 0; y < FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < FRAME_WIDTH; x += 1) {
      const value = ink(x, y) ? 30 : paper(x);
      const at = (y * FRAME_WIDTH + x) * 4;
      data[at] = value;
      data[at + 1] = value;
      data[at + 2] = value;
      data[at + 3] = 255;
    }
  }
  return { width: FRAME_WIDTH, height: FRAME_HEIGHT, data };
}

const bar = (x: number, y: number) => x >= 40 && x < 280 && y >= 58 && y < 63;

describe("a signature held up to the camera", () => {
  it("reads a thick line of ink as a thin stroke, from one end to the other", () => {
    const signature = signatureOfFrame(frame(bar));
    const longest = signature?.strokes[0] ?? [];
    expect(signature?.strokes.length).toBeLessThanOrEqual(3);
    expect(longest.length).toBeGreaterThan(200);
    const across = longest.map(([u]) => u);
    expect(Math.max(...across) - Math.min(...across)).toBeGreaterThan(0.95);
    expect(signature?.aspect).toBe(20);
  });

  it("reads two lines apart as two strokes", () => {
    const signature = signatureOfFrame(
      frame(
        (x, y) =>
          (x >= 40 && x < 120 && y >= 40 && y < 44) || (x >= 180 && x < 280 && y >= 80 && y < 84),
      ),
    );
    expect(signature?.strokes.length).toBe(2);
  });

  it("still reads when one side of the paper is in shadow", () => {
    const shaded = (x: number) => 110 + (x / FRAME_WIDTH) * 130;
    const signature = signatureOfFrame(frame(bar, shaded));
    expect(signature?.strokes[0]?.length).toBeGreaterThan(200);
  });

  it("reads nothing from blank paper, or from what is no paper at all", () => {
    expect(inkOf(frame(() => false))).toBeNull();
    expect(signatureOfFrame(frame(() => false))).toBeNull();
    expect(signatureOfFrame(frame((x, y) => (x + y) % 3 === 0))).toBeNull();
  });

  it("drops specks shorter than a line of writing", () => {
    const clean = signatureOfFrame(frame(bar));
    const specked = signatureOfFrame(
      frame((x, y) => bar(x, y) || (x >= 10 && x < 13 && y >= 10 && y < 13)),
    );
    expect(specked?.strokes.length).toBe(clean?.strokes.length);
    expect(specked?.aspect).toBe(clean?.aspect);
  });

  it("reads the part of the picture the sheet shows", () => {
    expect(coverCrop({ width: 640, height: 480 }, { width: 320, height: 120 })).toEqual({
      x: 0,
      y: 120,
      width: 640,
      height: 240,
    });
  });

  it("says why when the browser gives no camera", () => {
    const refusal = (name: string) => cameraRefusal(new DOMException("no", name));
    expect(refusal("NotAllowedError")).toMatch(/not allowed to use the camera/);
    expect(refusal("NotFoundError")).toMatch(/No camera is connected/);
    expect(refusal("NotReadableError")).toMatch(/could not be started/);
  });
});
