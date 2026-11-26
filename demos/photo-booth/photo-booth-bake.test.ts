import { describe, expect, it, vi } from "vitest";
import { applyFilter, clipCanvas, coverCrop, parseFilter } from "./photo-booth-bake";
import { EFFECT_PAGES } from "./photo-booth-data";

const one = (r: number, g: number, b: number) => new Uint8ClampedArray([r, g, b, 255]);

describe("baking an effect", () => {
  it("reads every filter of the Effects browser, so each is drawn into the picture", () => {
    for (const effect of EFFECT_PAGES.flat()) {
      if (!effect.filter) continue;
      const steps = parseFilter(effect.filter);
      const written = effect.filter.match(/[a-z-]+\(/g) ?? [];
      expect(
        steps.map((step) => `${step.name}(`),
        effect.id,
      ).toEqual(written);
    }
  });

  it("reads amounts in their units", () => {
    expect(parseFilter("hue-rotate(-20deg) saturate(180%) blur(2px)")).toEqual([
      { name: "hue-rotate", amount: -20 },
      { name: "saturate", amount: 1.8 },
      { name: "blur", amount: 2 },
    ]);
    expect(parseFilter(undefined)).toEqual([]);
  });

  it("computes the filters as CSS draws them", () => {
    const sepia = one(255, 255, 255);
    applyFilter(sepia, 1, 1, parseFilter("sepia(1)"));
    // The specification's sepia matrix on white.
    expect([...sepia]).toEqual([255, 255, 239, 255]);

    const grey = one(255, 0, 0);
    applyFilter(grey, 1, 1, parseFilter("grayscale(1)"));
    expect(grey[0]).toBe(grey[1]);
    expect(grey[1]).toBe(grey[2]);

    const negative = one(10, 100, 250);
    applyFilter(negative, 1, 1, parseFilter("invert(1)"));
    expect([...negative]).toEqual([245, 155, 5, 255]);

    const bright = one(100, 100, 100);
    applyFilter(bright, 1, 1, parseFilter("brightness(1.5) contrast(1)"));
    expect([...bright]).toEqual([150, 150, 150, 255]);
  });

  it("computes a clip's filter on each frame where the canvas has no filter of its own", () => {
    const pixels = { data: one(255, 255, 255) };
    const context = {
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => pixels),
      putImageData: vi.fn(),
      fillStyle: "",
    };
    const doc = {
      createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    } as unknown as Document;
    const source = { videoWidth: 1, videoHeight: 1 } as HTMLVideoElement;
    const painter = clipCanvas(
      source,
      { id: "own-filter", name: "Sepia", filter: "sepia(1)" },
      1,
      false,
      doc,
    );
    expect(context.putImageData).toHaveBeenCalledTimes(1);
    expect([...pixels.data]).toEqual([255, 255, 239, 255]);
    painter.draw();
    expect(context.putImageData).toHaveBeenCalledTimes(2);
  });

  it("leaves a clip's filter to the canvas where it has one", () => {
    const context = {
      filter: "none",
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      fillStyle: "",
    };
    const doc = {
      createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    } as unknown as Document;
    const source = { videoWidth: 1, videoHeight: 1 } as HTMLVideoElement;
    clipCanvas(source, { id: "own-filter", name: "Sepia", filter: "sepia(1)" }, 1, false, doc);
    expect(context.filter).toBe("sepia(1)");
    expect(context.getImageData).not.toHaveBeenCalled();
  });

  it("keeps the part of the frame the camera view shows", () => {
    // A 4:3 camera in a 3:2 view: the top and bottom are cut, evenly.
    expect(coverCrop(640, 480, 1.5)).toEqual({ x: 0, y: 27, width: 640, height: 427 });
    // A 16:9 camera in a 4:3 view: the sides are cut.
    expect(coverCrop(1280, 720, 4 / 3)).toEqual({ x: 160, y: 0, width: 960, height: 720 });
    expect(coverCrop(640, 480, 640 / 480)).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });

  it("blurs an edge into its neighbours", () => {
    const width = 5;
    const data = new Uint8ClampedArray(width * 4);
    data.set([255, 255, 255, 255], 2 * 4);
    applyFilter(data, width, 1, [{ name: "blur", amount: 1 }]);
    expect(data[4]).toBeGreaterThan(0);
    expect(data[8]).toBeLessThan(255);
  });
});
