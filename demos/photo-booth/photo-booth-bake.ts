/*
 * Bakes a Photo Booth effect into a camera frame, so the saved picture is what the person saw
 * (and what Photos shows) rather than a plain frame with an effect name. An effect is a CSS
 * transform, a CSS filter or both (photo-booth-data.ts): the transform is drawn with the
 * canvas's own transform, and the filter is computed on the pixels with the matrices of the
 * Filter Effects specification, because WebKit's canvas draws no `filter`. An effect computed on
 * the pixels (`photo-booth-effects.ts`) takes the place of both: its CSS only suggests it. A tracked
 * effect's art (`photo-booth-tracked.ts`) is drawn over the frame where the faces were last found.
 */

import type { PhotoBoothEffect } from "./photo-booth-data";
import { boxBlur, computeEffect, computesEffect, isWarp } from "./photo-booth-effects";
import { drawTracked, faceCentre, isTracked } from "./photo-booth-tracked";

/** One function of a CSS filter list: its name and its amount (degrees for hue-rotate, pixels
 * for blur). */
export interface FilterStep {
  name:
    | "sepia"
    | "grayscale"
    | "saturate"
    | "hue-rotate"
    | "invert"
    | "contrast"
    | "brightness"
    | "blur";
  amount: number;
}

const NAMES = new Set<FilterStep["name"]>([
  "sepia",
  "grayscale",
  "saturate",
  "hue-rotate",
  "invert",
  "contrast",
  "brightness",
  "blur",
]);

/** The functions of a CSS filter list, in order; unknown ones are left out. */
export function parseFilter(filter: string | undefined): FilterStep[] {
  if (!filter) return [];
  const steps: FilterStep[] = [];
  for (const match of filter.matchAll(/([a-z-]+)\(\s*(-?[\d.]+)(deg|px|%)?\s*\)/g)) {
    const name = match[1] as FilterStep["name"];
    if (!NAMES.has(name)) continue;
    let amount = Number(match[2]);
    if (match[3] === "%") amount /= 100;
    if (Number.isFinite(amount)) steps.push({ name, amount });
  }
  return steps;
}

type Matrix = [number, number, number, number, number, number, number, number, number];

const saturateMatrix = (s: number): Matrix => [
  0.213 + 0.787 * s,
  0.715 - 0.715 * s,
  0.072 - 0.072 * s,
  0.213 - 0.213 * s,
  0.715 + 0.285 * s,
  0.072 - 0.072 * s,
  0.213 - 0.213 * s,
  0.715 - 0.715 * s,
  0.072 + 0.928 * s,
];

const hueMatrix = (degrees: number): Matrix => {
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    0.213 + c * 0.787 - s * 0.213,
    0.715 - c * 0.715 - s * 0.715,
    0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143,
    0.715 + c * 0.285 + s * 0.14,
    0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787,
    0.715 - c * 0.715 + s * 0.715,
    0.072 + c * 0.928 + s * 0.072,
  ];
};

const sepiaMatrix = (amount: number): Matrix => {
  const t = 1 - Math.min(1, Math.max(0, amount));
  return [
    0.393 + 0.607 * t,
    0.769 - 0.769 * t,
    0.189 - 0.189 * t,
    0.349 - 0.349 * t,
    0.686 + 0.314 * t,
    0.168 - 0.168 * t,
    0.272 - 0.272 * t,
    0.534 - 0.534 * t,
    0.131 + 0.869 * t,
  ];
};

const grayscaleMatrix = (amount: number): Matrix => {
  const t = 1 - Math.min(1, Math.max(0, amount));
  return [
    0.2126 + 0.7874 * t,
    0.7152 - 0.7152 * t,
    0.0722 - 0.0722 * t,
    0.2126 - 0.2126 * t,
    0.7152 + 0.2848 * t,
    0.0722 - 0.0722 * t,
    0.2126 - 0.2126 * t,
    0.7152 - 0.7152 * t,
    0.0722 + 0.9278 * t,
  ];
};

/** Applies a CSS filter list to RGBA pixels, in place. `scale` turns CSS pixels of blur into the
 * frame's pixels. */
export function applyFilter(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  steps: readonly FilterStep[],
  scale = 1,
): void {
  for (const step of steps) {
    if (step.name === "blur") {
      boxBlur(data, width, height, step.amount * scale);
      continue;
    }
    let matrix: Matrix | null = null;
    let linear: { slope: number; intercept: number } | null = null;
    if (step.name === "sepia") matrix = sepiaMatrix(step.amount);
    else if (step.name === "grayscale") matrix = grayscaleMatrix(step.amount);
    else if (step.name === "saturate") matrix = saturateMatrix(step.amount);
    else if (step.name === "hue-rotate") matrix = hueMatrix(step.amount);
    else if (step.name === "brightness") linear = { slope: step.amount, intercept: 0 };
    else if (step.name === "contrast")
      linear = { slope: step.amount, intercept: 0.5 - 0.5 * step.amount };
    else if (step.name === "invert")
      linear = { slope: 1 - 2 * step.amount, intercept: step.amount };
    for (let at = 0; at < data.length; at += 4) {
      const r = (data[at] ?? 0) / 255;
      const g = (data[at + 1] ?? 0) / 255;
      const b = (data[at + 2] ?? 0) / 255;
      if (matrix) {
        const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = matrix;
        data[at] = (m0 * r + m1 * g + m2 * b) * 255;
        data[at + 1] = (m3 * r + m4 * g + m5 * b) * 255;
        data[at + 2] = (m6 * r + m7 * g + m8 * b) * 255;
      } else if (linear) {
        data[at] = (linear.slope * r + linear.intercept) * 255;
        data[at + 1] = (linear.slope * g + linear.intercept) * 255;
        data[at + 2] = (linear.slope * b + linear.intercept) * 255;
      }
    }
  }
}

/** The part of a `width` by `height` frame that a view of shape `aspect` (width over height)
 * shows with `object-fit: cover`: centred, the whole of one side. */
export function coverCrop(
  width: number,
  height: number,
  aspect: number,
): { x: number; y: number; width: number; height: number } {
  if (!(aspect > 0) || !(width > 0) || !(height > 0)) return { x: 0, y: 0, width, height };
  if (width / height > aspect) {
    const shown = Math.round(height * aspect);
    return { x: Math.round((width - shown) / 2), y: 0, width: shown, height };
  }
  const shown = Math.round(width / aspect);
  return { x: 0, y: Math.round((height - shown) / 2), width, height: shown };
}

/**
 * A canvas and the call that draws the current frame of `source` on it under `effect`, for a movie
 * clip: the same crop, mirror and transform as `bakeEffect`. The filter is the canvas's own where it
 * has one, which is fast enough for every frame; WebKit's canvas draws none, so there the filter is
 * computed on each frame's pixels, as `bakeEffect` does. A computed effect is computed on each frame.
 */
export function clipCanvas(
  source: HTMLVideoElement,
  effect: PhotoBoothEffect,
  aspect: number,
  mirrored: boolean,
  doc: Document = document,
): { canvas: HTMLCanvasElement; draw: () => void } {
  const shown = coverCrop(source.videoWidth, source.videoHeight, aspect);
  const canvas = doc.createElement("canvas");
  canvas.width = shown.width;
  canvas.height = shown.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const computed = computesEffect(effect.id);
  const canFilter = context !== null && "filter" in context && !computed;
  const steps = canFilter || computed ? [] : parseFilter(effect.filter);
  const matrix =
    !computed && effect.transform && typeof DOMMatrix === "function"
      ? new DOMMatrix(effect.transform)
      : null;
  const [w, h] = [shown.width, shown.height];
  const draw = () => {
    if (!context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    if (canFilter) context.filter = "none";
    context.fillStyle = "#000";
    context.fillRect(0, 0, w, h);
    if (canFilter) context.filter = effect.filter ?? "none";
    if (mirrored) {
      context.translate(w, 0);
      context.scale(-1, 1);
    }
    if (matrix) {
      context.translate(w / 2, h / 2);
      context.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
      context.translate(-w / 2, -h / 2);
    }
    context.drawImage(source, shown.x, shown.y, w, h, 0, 0, w, h);
    if (computed || steps.length > 0) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      const pixels = context.getImageData(0, 0, w, h);
      if (computed) {
        const face = isWarp(effect.id)
          ? faceCentre({
              frameWidth: source.videoWidth,
              frameHeight: source.videoHeight,
              crop: shown,
              width: w,
              height: h,
              mirrored,
            })
          : undefined;
        computeEffect(effect.id, pixels.data, w, h, mirrored, face);
      } else applyFilter(pixels.data, w, h, steps, w / 640);
      context.putImageData(pixels, 0, 0);
    }
    if (isTracked(effect.id)) {
      drawTracked(context, effect.id, {
        frameWidth: source.videoWidth,
        frameHeight: source.videoHeight,
        crop: shown,
        width: w,
        height: h,
        mirrored,
      });
    }
  };
  draw();
  return { canvas, draw };
}

/** One canvas of four pictures, two by two, as Take Four Quick Pictures keeps them. */
export function fourUp(tiles: readonly HTMLCanvasElement[], doc: Document = document) {
  const first = tiles[0];
  const canvas = doc.createElement("canvas");
  if (!first) return canvas;
  canvas.width = first.width * 2;
  canvas.height = first.height * 2;
  const context = canvas.getContext("2d");
  tiles.forEach((tile, index) => {
    context?.drawImage(
      tile,
      (index % 2) * first.width,
      Math.floor(index / 2) * first.height,
      first.width,
      first.height,
    );
  });
  return canvas;
}

/**
 * A canvas holding the frame of `source` (`width` by `height` pixels) under `effect`, as the
 * camera view shows it: cut to the view's shape `aspect` as `object-fit: cover` cuts it, then the
 * transform about the centre, then the filter. `mirrored` flips the whole of it left to right, as
 * the camera view shows the person.
 */
export function bakeEffect(
  source: CanvasImageSource,
  width: number,
  height: number,
  effect: PhotoBoothEffect,
  aspect: number = width / height,
  doc: Document = document,
  mirrored = false,
): HTMLCanvasElement {
  const shown = coverCrop(width, height, aspect);
  const canvas = doc.createElement("canvas");
  canvas.width = shown.width;
  canvas.height = shown.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;
  const [w, h] = [shown.width, shown.height];
  const computed = computesEffect(effect.id);
  context.fillStyle = "#000";
  context.fillRect(0, 0, w, h);
  if (mirrored) {
    context.translate(w, 0);
    context.scale(-1, 1);
  }
  if (!computed && effect.transform && typeof DOMMatrix === "function") {
    const matrix = new DOMMatrix(effect.transform);
    context.translate(w / 2, h / 2);
    context.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
    context.translate(-w / 2, -h / 2);
  }
  context.drawImage(source, shown.x, shown.y, w, h, 0, 0, w, h);
  context.setTransform(1, 0, 0, 1, 0, 0);
  const steps = computed ? [] : parseFilter(effect.filter);
  if (computed || steps.length > 0) {
    const pixels = context.getImageData(0, 0, w, h);
    if (computed) {
      const face = isWarp(effect.id)
        ? faceCentre({
            frameWidth: width,
            frameHeight: height,
            crop: shown,
            width: w,
            height: h,
            mirrored,
          })
        : undefined;
      computeEffect(effect.id, pixels.data, w, h, mirrored, face);
    }
    // The camera view is about 640 points wide: blur is measured in its points.
    else applyFilter(pixels.data, w, h, steps, w / 640);
    context.putImageData(pixels, 0, 0);
  }
  if (isTracked(effect.id)) {
    drawTracked(context, effect.id, {
      frameWidth: width,
      frameHeight: height,
      crop: shown,
      width: w,
      height: h,
      mirrored,
    });
  }
  return canvas;
}
