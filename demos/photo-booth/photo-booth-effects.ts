/*
 * The effects of the first two pages of the Effects browser, computed on a camera frame's RGBA pixels:
 * eight colour treatments and eight warps, the same arithmetic for the live preview, the saved picture
 * and a movie clip, in every browser. Photo Booth has them from Core Image; the numbers here are chosen
 * by eye against the effects' names, as no capture shows them on a known picture. A distortion is
 * centred on the face it is given, or on the frame without one.
 */

import { computeBackdrop, isBackdrop } from "./photo-booth-backdrop";

/** Where a face is in a frame's pixels: its middle, and the width of its box. */
export interface FaceCentre {
  x: number;
  y: number;
  size: number;
}

type Compute = (data: Uint8ClampedArray, width: number, height: number, face?: FaceCentre) => void;

const spares: Uint8ClampedArray[] = [];
/** A buffer that a computation can overwrite, kept between frames so a frame allocates nothing. */
function spare(slot: number, length: number): Uint8ClampedArray {
  let held = spares[slot];
  if (!held || held.length !== length) {
    held = new Uint8ClampedArray(length);
    spares[slot] = held;
  }
  return held;
}

/** A box blur of `radius` pixels, in place, horizontally then vertically; alpha stays. */
export function boxBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return;
  const across = 2 * r + 1;
  const pass = (
    from: Uint8ClampedArray,
    to: Uint8ClampedArray,
    lines: number,
    length: number,
    lineStep: number,
    step: number,
  ) => {
    for (let line = 0; line < lines; line += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        const start = line * lineStep + channel;
        let sum = (from[start] as number) * (r + 1);
        for (let i = 1; i <= r; i += 1) {
          sum += from[start + Math.min(i, length - 1) * step] as number;
        }
        for (let i = 0; i < length; i += 1) {
          to[start + i * step] = sum / across;
          const add = i + r + 1 < length ? i + r + 1 : length - 1;
          const drop = i - r > 0 ? i - r : 0;
          sum += (from[start + add * step] as number) - (from[start + drop * step] as number);
        }
      }
    }
  };
  const middle = spare(0, data.length);
  middle.set(data);
  pass(data, middle, height, width, width * 4, 4);
  pass(middle, data, width, height, 4, width * 4);
}

/** Rec. 601 luminance of each pixel, in a buffer of one byte per pixel. */
function luminanceOf(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const lum = spare(1, width * height);
  for (let at = 0, i = 0; i < lum.length; i += 1, at += 4) {
    lum[i] =
      0.299 * (data[at] as number) +
      0.587 * (data[at + 1] as number) +
      0.114 * (data[at + 2] as number);
  }
  return lum;
}

/** The strength of the Sobel edge at each pixel, 0 to 255, in a buffer of one byte per pixel; the
 * frame's border has none. */
function edgesOf(lum: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const edges = spare(2, width * height);
  edges.fill(0);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const nw = lum[i - width - 1] as number;
      const n = lum[i - width] as number;
      const ne = lum[i - width + 1] as number;
      const w = lum[i - 1] as number;
      const e = lum[i + 1] as number;
      const sw = lum[i + width - 1] as number;
      const s = lum[i + width] as number;
      const se = lum[i + width + 1] as number;
      const gx = ne + 2 * e + se - nw - 2 * w - sw;
      const gy = sw + 2 * s + se - nw - 2 * n - ne;
      edges[i] = (Math.abs(gx) + Math.abs(gy)) / 4;
    }
  }
  return edges;
}

/** A table of 256 entries from a curve of 0 to 1. */
const curve = (shape: (level: number) => number) =>
  Uint8ClampedArray.from({ length: 256 }, (_, level) => shape(level / 255) * 255);

/** Every pixel's channels from its luminance: a duotone or a false colour. */
function toned(
  data: Uint8ClampedArray,
  red: Uint8ClampedArray,
  green: Uint8ClampedArray,
  blue: Uint8ClampedArray,
) {
  for (let at = 0; at < data.length; at += 4) {
    const level =
      (0.299 * (data[at] as number) +
        0.587 * (data[at + 1] as number) +
        0.114 * (data[at + 2] as number) +
        0.5) |
      0;
    data[at] = red[level] as number;
    data[at + 1] = green[level] as number;
    data[at + 2] = blue[level] as number;
  }
}

const SEPIA_RED = curve((level) => Math.min(1, level * 1.12));
const SEPIA_GREEN = curve((level) => level * 0.94);
const SEPIA_BLUE = curve((level) => level * 0.7);
const sepia: Compute = (data) => toned(data, SEPIA_RED, SEPIA_GREEN, SEPIA_BLUE);

/** An S-curve: deeper shadows and brighter highlights than a plain grey. */
const INK_CONTRAST = curve((level) => level * level * (3 - 2 * level));
const blackAndWhite: Compute = (data) => toned(data, INK_CONTRAST, INK_CONTRAST, INK_CONTRAST);

const XRAY_RED = curve((level) => (1 - level) * 0.82);
const XRAY_GREEN = curve((level) => (1 - level) * 0.92);
const XRAY_BLUE = curve((level) => 1 - level);
const xRay: Compute = (data) => toned(data, XRAY_RED, XRAY_GREEN, XRAY_BLUE);

/** Cold to hot: dark blue through violet and red to pale yellow. */
const THERMAL_STOPS = [
  [0, 0, 90],
  [60, 0, 180],
  [190, 0, 160],
  [255, 40, 40],
  [255, 180, 0],
  [255, 255, 120],
] as const;
const thermalChannel = (channel: 0 | 1 | 2) =>
  curve((level) => {
    const place = level * (THERMAL_STOPS.length - 1);
    const below = Math.min(Math.floor(place), THERMAL_STOPS.length - 2);
    const from = THERMAL_STOPS[below]?.[channel] ?? 0;
    const to = THERMAL_STOPS[below + 1]?.[channel] ?? 0;
    return (from + (to - from) * (place - below)) / 255;
  });
const THERMAL_RED = thermalChannel(0);
const THERMAL_GREEN = thermalChannel(1);
const THERMAL_BLUE = thermalChannel(2);
const thermal: Compute = (data) => toned(data, THERMAL_RED, THERMAL_GREEN, THERMAL_BLUE);

/** A cheap camera's crossed colours: lifted, cool shadows, warm highlights, and dark corners. */
const PLASTIC_RED = curve((level) => 0.04 + 0.96 * level ** 0.85);
const PLASTIC_GREEN = curve((level) => 0.02 + 0.98 * level);
const PLASTIC_BLUE = curve((level) => 0.16 + 0.68 * level);
const plastic: Compute = (data, width, height) => {
  const [cx, cy] = [(width - 1) / 2, (height - 1) / 2];
  const reach = cx * cx + cy * cy || 1;
  for (let y = 0, at = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, at += 4) {
      const t = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / reach;
      const light = 1 - 0.65 * t * t;
      const r = data[at] as number;
      const g = data[at + 1] as number;
      const b = data[at + 2] as number;
      const grey = (r + g + b) / 3;
      data[at] =
        (PLASTIC_RED[Math.min(255, Math.max(0, grey + (r - grey) * 1.3) | 0)] as number) * light;
      data[at + 1] =
        (PLASTIC_GREEN[Math.min(255, Math.max(0, grey + (g - grey) * 1.3) | 0)] as number) * light;
      data[at + 2] =
        (PLASTIC_BLUE[Math.min(255, Math.max(0, grey + (b - grey) * 1.3) | 0)] as number) * light;
    }
  }
};

/** Black ink on white: strong edges, and halftone dots that grow with the shadows. */
const comicBook: Compute = (data, width, height) => {
  const lum = luminanceOf(data, width, height);
  const edges = edgesOf(lum, width, height);
  const cell = Math.max(3, Math.round(width / 160));
  const middle = (cell - 1) / 2;
  const reach = 2 * middle * middle || 1;
  for (let y = 0, at = 0, i = 0; y < height; y += 1) {
    const v = (y % cell) - middle;
    for (let x = 0; x < width; x += 1, at += 4, i += 1) {
      const u = (x % cell) - middle;
      const dark = 1 - (lum[i] as number) / 255;
      const inked = (edges[i] as number) > 60 || (u * u + v * v) / reach < dark * dark * 1.5;
      const ink = inked ? 0 : 255;
      data[at] = ink;
      data[at + 1] = ink;
      data[at + 2] = ink;
    }
  }
};

/** The picture's own colours drawn on white paper: strokes along its edges and hatching in its
 * shadows. */
const colorPencil: Compute = (data, width, height) => {
  const lum = luminanceOf(data, width, height);
  const edges = edgesOf(lum, width, height);
  for (let y = 0, at = 0, i = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, at += 4, i += 1) {
      const stroke = Math.min(1, (edges[i] as number) / 70);
      const hatch = (1 - (lum[i] as number) / 255) * ((x + y) % 4 < 2 ? 0.7 : 0.25);
      const lead = stroke > hatch ? stroke : hatch;
      data[at] = 255 - (255 - (data[at] as number)) * lead;
      data[at + 1] = 255 - (255 - (data[at + 1] as number)) * lead;
      data[at + 2] = 255 - (255 - (data[at + 2] as number)) * lead;
    }
  }
};

/** The picture screened with a wide blur of itself, so that what is bright spills over. */
const glow: Compute = (data, width, height) => {
  const halo = spare(3, data.length);
  halo.set(data);
  boxBlur(halo, width, height, width / 40);
  for (let at = 0; at < data.length; at += 4) {
    for (let channel = at; channel < at + 3; channel += 1) {
      const shade = (255 - (data[channel] as number)) * (255 - (halo[channel] as number) * 0.8);
      data[channel] = 255 - shade / 255;
    }
  }
};

/** Where a pixel of the result looks in the frame, from its offset from the frame's centre. */
type Warp = (
  dx: number,
  dy: number,
  frame: { reach: number; corner: number },
) => readonly [number, number];

/** Inside the distortion's circle, 1 at the centre and 0 at its edge; outside, the frame is left. */
const pull = (dx: number, dy: number, reach: number) => {
  const t = 1 - Math.hypot(dx, dy) / reach;
  return t > 0 ? t * t : 0;
};

const WARPS: Record<string, Warp> = {
  bulge: (dx, dy, { reach }) => {
    const f = 1 - 0.55 * pull(dx, dy, reach);
    return [dx * f, dy * f];
  },
  dent: (dx, dy, { reach }) => {
    const f = 1 + 0.9 * pull(dx, dy, reach);
    return [dx * f, dy * f];
  },
  twirl: (dx, dy, { reach }) => {
    const turn = 2.2 * pull(dx, dy, reach);
    const [c, s] = [Math.cos(turn), Math.sin(turn)];
    return [dx * c - dy * s, dx * s + dy * c];
  },
  squeeze: (dx, dy, { reach }) => [dx * (1 + pull(dx, dy, reach)), dy],
  stretch: (dx, dy, { reach }) => {
    const t = pull(dx, dy, reach);
    return [dx * (1 + 0.3 * t), dy * (1 - 0.55 * t)];
  },
  mirror: (dx, dy) => [-Math.abs(dx), dy],
  "light-tunnel": (dx, dy, { reach }) => {
    const r = Math.hypot(dx, dy);
    const wall = reach * 0.6;
    if (r < wall) return [dx, dy];
    const turn = Math.atan2(dy, dx) + (r - wall) / wall;
    return [wall * Math.cos(turn), wall * Math.sin(turn)];
  },
  "fish-eye": (dx, dy, { corner }) => {
    const t = Math.hypot(dx, dy) / corner;
    const f = 0.35 + 0.65 * t * t;
    return [dx * f, dy * f];
  },
};

/** The source position of every pixel of a warp at one size and centre, built once. */
const maps = new Map<string, Float32Array>();
function mapOf(
  id: string,
  warp: Warp,
  width: number,
  height: number,
  face?: FaceCentre,
): Float32Array {
  const short = Math.min(width, height);
  // A face moves a little every frame: within about a pixel of a 256-wide frame the same map serves.
  const grain = Math.max(1, Math.round(width / 256));
  const snap = (value: number) => Math.round(value / grain) * grain;
  const [cx, cy] = face ? [snap(face.x), snap(face.y)] : [(width - 1) / 2, (height - 1) / 2];
  const reach = face
    ? Math.min(short * 0.45, Math.max(short * 0.25, snap(face.size) * 1.1))
    : short * 0.45;
  const key = `${id}:${width}x${height}:${cx},${cy},${reach}`;
  let map = maps.get(key);
  if (map) return map;
  const corner = Math.hypot((width - 1) / 2, (height - 1) / 2) || 1;
  const frame = { reach, corner };
  map = new Float32Array(width * height * 2);
  for (let y = 0, i = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1, i += 2) {
      const [sx, sy] = warp(x - cx, y - cy, frame);
      map[i] = Math.min(width - 1, Math.max(0, cx + sx));
      map[i + 1] = Math.min(height - 1, Math.max(0, cy + sy));
    }
  }
  // A window dragged through many sizes leaves no trail of maps behind it.
  if (maps.size >= 32) maps.clear();
  maps.set(key, map);
  return map;
}

const warped =
  (id: string, warp: Warp): Compute =>
  (data, width, height, face) => {
    const map = mapOf(id, warp, width, height, face);
    const from = spare(0, data.length);
    from.set(data);
    const row = width * 4;
    for (let i = 0, at = 0; at < data.length; i += 2, at += 4) {
      const sx = map[i] as number;
      const sy = map[i + 1] as number;
      const left = sx | 0;
      const top = sy | 0;
      const fx = sx - left;
      const fy = sy - top;
      const a = (top * width + left) * 4;
      const b = fx > 0 ? a + 4 : a;
      const c = fy > 0 ? a + row : a;
      const d = fy > 0 ? b + row : b;
      for (let channel = 0; channel < 3; channel += 1) {
        const upper = (from[a + channel] as number) * (1 - fx) + (from[b + channel] as number) * fx;
        const lower = (from[c + channel] as number) * (1 - fx) + (from[d + channel] as number) * fx;
        data[at + channel] = upper * (1 - fy) + lower * fy;
      }
    }
  };

const COMPUTED: Record<string, Compute> = {
  sepia,
  "black-and-white": blackAndWhite,
  "plastic-camera": plastic,
  "comic-book": comicBook,
  "color-pencil": colorPencil,
  glow,
  "thermal-camera": thermal,
  "x-ray": xRay,
  ...Object.fromEntries(Object.entries(WARPS).map(([id, warp]) => [id, warped(id, warp)])),
};

/** Whether an effect is a warp, centred on the face when one is found. */
export const isWarp = (id: string): boolean => Object.hasOwn(WARPS, id);

/** How far a point moves toward the middle of a small warp: where a pixel `dx`, `dy` from it reads. */
export type SpotWarp = (dx: number, dy: number, strength: number) => readonly [number, number];

/** Bulges what is near the middle of a small warp. */
export const swell =
  (amount: number): SpotWarp =>
  (dx, dy, strength) => {
    const f = 1 - amount * strength;
    return [dx * f, dy * f];
  };

/** Turns what is near the middle of a small warp, by `radians` at its middle. */
export const spin =
  (radians: number): SpotWarp =>
  (dx, dy, strength) => {
    const [c, s] = [Math.cos(radians * strength), Math.sin(radians * strength)];
    return [dx * c - dy * s, dx * s + dy * c];
  };

/** Draws out what is near the middle of a small warp, wider by `across` and flatter by `down`. */
export const widen =
  (across: number, down: number): SpotWarp =>
  (dx, dy, strength) => [dx * (1 - across * strength), dy * (1 + down * strength)];

/**
 * Warps a circle of RGBA pixels in place, about (`x`, `y`) with radius `reach`: a part of a face.
 * Outside the circle the frame stays as it is.
 */
export function warpSpot(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  reach: number,
  warp: SpotWarp,
): void {
  const [left, right] = [
    Math.max(0, Math.floor(x - reach)),
    Math.min(width - 1, Math.ceil(x + reach)),
  ];
  const [top, bottom] = [
    Math.max(0, Math.floor(y - reach)),
    Math.min(height - 1, Math.ceil(y + reach)),
  ];
  const from = spare(0, data.length);
  from.set(data);
  for (let py = top; py <= bottom; py += 1) {
    for (let px = left; px <= right; px += 1) {
      const strength = pull(px - x, py - y, reach);
      if (strength === 0) continue;
      const [dx, dy] = warp(px - x, py - y, strength);
      const sx = Math.min(width - 1, Math.max(0, x + dx));
      const sy = Math.min(height - 1, Math.max(0, y + dy));
      const [ax, ay] = [sx | 0, sy | 0];
      const [fx, fy] = [sx - ax, sy - ay];
      const a = (ay * width + ax) * 4;
      const b = fx > 0 ? a + 4 : a;
      const c = fy > 0 ? a + width * 4 : a;
      const d = fy > 0 ? b + width * 4 : b;
      const at = (py * width + px) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const upper = (from[a + channel] as number) * (1 - fx) + (from[b + channel] as number) * fx;
        const lower = (from[c + channel] as number) * (1 - fx) + (from[d + channel] as number) * fx;
        data[at + channel] = upper * (1 - fy) + lower * fy;
      }
    }
  }
}

/** Whether a camera frame is computed for this effect, instead of drawn with its CSS. */
export const computesEffect = (id: string): boolean =>
  Object.hasOwn(COMPUTED, id) || isBackdrop(id);

/**
 * Computes an effect on a frame of RGBA pixels, in place. Other effects leave it as it is.
 * `mirrored` says which way round the frame was drawn, which only a backdrop asks; `face` is where a
 * warp is centred, in the frame's pixels.
 */
export function computeEffect(
  id: string,
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mirrored = true,
  face?: FaceCentre,
): void {
  if (width <= 0 || height <= 0) return;
  if (isBackdrop(id)) computeBackdrop(id, data, width, height, mirrored);
  else if (computesEffect(id)) COMPUTED[id]?.(data, width, height, face);
}
