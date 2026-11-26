import { afterEach, describe, expect, it, vi } from "vitest";
import type { DetectedFace } from "../desktop/desktop-faces";
import { drawTracked, isTracked, watchFaces } from "./photo-booth-tracked";

const detectFaces = vi.hoisted(() => vi.fn());
vi.mock("../desktop/desktop-faces", () => ({ detectFaces }));

const point = (x: number, y: number) => ({ x, y });
/** A face whose box is 0.25 of the frame wide, starting at a quarter across and a third down. */
const FACE: DetectedFace = {
  x: 0.25,
  y: 1 / 3,
  width: 0.25,
  height: 1 / 3,
  score: 0.9,
  landmarks: {
    rightEye: point(0.3, 0.4),
    leftEye: point(0.45, 0.4),
    nose: point(0.375, 0.5),
    mouth: point(0.375, 0.6),
    rightEar: point(0.25, 0.45),
    leftEar: point(0.5, 0.45),
  },
};
const pen = () =>
  new Proxy(
    { fills: 0 },
    {
      get: (target, name) =>
        name === "fills"
          ? target.fills
          : name === "fill"
            ? () => {
                target.fills += 1;
              }
            : () => {},
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D & { fills: number };
/** A video element with a frame, as a camera's has. */
const video = () => {
  const element = document.createElement("video");
  Object.defineProperty(element, "videoWidth", { value: 400 });
  return element;
};
const VIEW = {
  frameWidth: 400,
  frameHeight: 300,
  crop: { x: 0, y: 0, width: 400, height: 300 },
  width: 800,
  height: 600,
};

describe("the effects that follow a face", () => {
  afterEach(() => detectFaces.mockReset());

  it("names the effects that follow a face", () => {
    expect(
      [
        "dizzy",
        "love-birds",
        "balloons",
        "hearts",
        "lovestruck",
        "nose-twirl",
        "chipmunk",
        "frog",
        "sepia",
        "bulge",
      ].filter(isTracked),
    ).toEqual([
      "dizzy",
      "love-birds",
      "balloons",
      "hearts",
      "lovestruck",
      "nose-twirl",
      "chipmunk",
      "frog",
    ]);
  });

  it("draws nothing before a face is found", () => {
    const canvas = pen();
    expect(drawTracked(canvas, "dizzy", { ...VIEW, mirrored: false })).toEqual([]);
    expect(canvas.fills).toBe(0);
  });

  it("draws art where the face is on the canvas, mirrored as the canvas is", async () => {
    detectFaces.mockResolvedValue([FACE]);
    const stop = watchFaces(video(), () => {});
    await vi.waitFor(() => expect(detectFaces).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve));
    const far = performance.now() + 10_000;
    const canvas = pen();
    expect(drawTracked(canvas, "balloons", { ...VIEW, mirrored: false }, far)).toEqual([
      { x: 200, y: 200, width: 200, height: 200 },
    ]);
    expect(canvas.fills).toBeGreaterThan(0);
    expect(drawTracked(pen(), "balloons", { ...VIEW, mirrored: true }, far)).toEqual([
      { x: 400, y: 200, width: 200, height: 200 },
    ]);
    stop();
    expect(drawTracked(pen(), "balloons", { ...VIEW, mirrored: false }, far)).toEqual([]);
  });

  it("says so when the model cannot be loaded", async () => {
    detectFaces.mockRejectedValue(new Error("The face model answered HTTP 404."));
    const failed = vi.fn();
    const stop = watchFaces(video(), failed);
    await vi.waitFor(() => expect(failed).toHaveBeenCalledTimes(1));
    stop();
  });
});
