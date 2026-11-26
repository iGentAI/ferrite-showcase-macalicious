/*
 * The effects that follow a face: the camera's frame with art drawn around each face found
 * (`demos/desktop/desktop-faces.ts`), or a part of the face warped. The art is drawn here, not taken
 * from Apple's. Detection runs
 * only while a video asks for it, and its code and model load then.
 */

import type { DetectedFace } from "../desktop/desktop-faces";
import {
  type FaceCentre,
  type SpotWarp,
  spin,
  swell,
  warpSpot,
  widen,
} from "./photo-booth-effects";

/** How long between detections, in milliseconds; a detection itself takes about 70 ms. */
const DETECT_EVERY_MS = 100;
/** How long a face the detector has lost stays, in milliseconds, so one missed frame does not flicker. */
const HOLD_MS = 500;

const watching = new Map<HTMLVideoElement, () => void>();
let looping = false;
let past: DetectedFace[] = [];
let latest: DetectedFace[] = [];
let latestAt = 0;
let gap = DETECT_EVERY_MS;

async function detectWhileWatched() {
  if (looping) return;
  looping = true;
  try {
    const { detectFaces } = await import("../desktop/desktop-faces");
    while (watching.size > 0) {
      const video = [...watching.keys()].find((each) => each.videoWidth > 0);
      if (video) {
        const faces = await detectFaces(video);
        const now = performance.now();
        if (faces.length > 0 || now - latestAt > HOLD_MS) {
          past = latest;
          latest = faces;
          gap = Math.max(DETECT_EVERY_MS, now - latestAt);
          latestAt = now;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, DETECT_EVERY_MS));
    }
  } catch {
    for (const onFailure of watching.values()) onFailure();
  } finally {
    looping = false;
  }
}

/**
 * Finds faces in this video until the function answered is called. Videos of one camera share one
 * detector. `onFailure` is called when the model cannot be loaded or run.
 */
export function watchFaces(video: HTMLVideoElement, onFailure: () => void): () => void {
  watching.set(video, onFailure);
  void detectWhileWatched();
  return () => {
    watching.delete(video);
    if (watching.size === 0) {
      past = [];
      latest = [];
    }
  };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where the latest faces are now: between the last two detections, so that the art glides. */
function facesNow(now: number): DetectedFace[] {
  if (past.length !== latest.length) return latest;
  const t = Math.min(1, (now - latestAt) / gap);
  return latest.map((face, i) => {
    const from = past[i] as DetectedFace;
    return {
      ...face,
      x: mix(from.x, face.x, t),
      y: mix(from.y, face.y, t),
      width: mix(from.width, face.width, t),
      height: mix(from.height, face.height, t),
      landmarks: Object.fromEntries(
        (Object.keys(face.landmarks) as (keyof DetectedFace["landmarks"])[]).map((name) => [
          name,
          {
            x: mix(from.landmarks[name].x, face.landmarks[name].x, t),
            y: mix(from.landmarks[name].y, face.landmarks[name].y, t),
          },
        ]),
      ) as DetectedFace["landmarks"],
    };
  });
}

type Pen = CanvasRenderingContext2D;

function heart(pen: Pen, x: number, y: number, size: number, colour: string) {
  pen.fillStyle = colour;
  pen.beginPath();
  pen.moveTo(x, y + size * 0.9);
  pen.bezierCurveTo(x - size * 1.5, y - size * 0.1, x - size * 0.7, y - size, x, y - size * 0.3);
  pen.bezierCurveTo(x + size * 0.7, y - size, x + size * 1.5, y - size * 0.1, x, y + size * 0.9);
  pen.fill();
}

function star(pen: Pen, x: number, y: number, size: number, turn: number) {
  pen.fillStyle = "#ffd93b";
  pen.strokeStyle = "#b8860b";
  pen.lineWidth = size * 0.12;
  pen.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 ? size * 0.45 : size;
    const a = turn + (i * Math.PI) / 5;
    pen.lineTo(x + r * Math.sin(a), y - r * Math.cos(a));
  }
  pen.closePath();
  pen.fill();
  pen.stroke();
}

/** A round little bird, `size` from its middle to its tail, looking along `facing` (1 or -1). */
function bird(
  pen: Pen,
  x: number,
  y: number,
  size: number,
  facing: number,
  flap: number,
  body: string,
  wing: string,
) {
  pen.save();
  pen.translate(x, y);
  pen.scale(facing * size, size);
  pen.fillStyle = wing;
  pen.beginPath();
  pen.moveTo(-0.55, 0.05);
  pen.lineTo(-1.15, -0.3);
  pen.lineTo(-0.85, 0.3);
  pen.fill();
  pen.fillStyle = body;
  pen.beginPath();
  pen.ellipse(0, 0, 0.72, 0.58, 0, 0, Math.PI * 2);
  pen.fill();
  pen.fillStyle = "#fff6e0";
  pen.beginPath();
  pen.ellipse(0.1, 0.22, 0.42, 0.3, 0, 0, Math.PI * 2);
  pen.fill();
  pen.fillStyle = wing;
  pen.beginPath();
  pen.moveTo(-0.3, -0.05);
  pen.quadraticCurveTo(-0.55, -0.35 - 0.75 * flap, -0.8, -0.2 - 0.85 * flap);
  pen.quadraticCurveTo(-0.25, -0.1 - 0.3 * flap, 0.25, 0);
  pen.fill();
  pen.fillStyle = "#fff";
  pen.beginPath();
  pen.arc(0.38, -0.2, 0.17, 0, Math.PI * 2);
  pen.fill();
  pen.fillStyle = "#1c1c1c";
  pen.beginPath();
  pen.arc(0.42, -0.2, 0.08, 0, Math.PI * 2);
  pen.fill();
  pen.fillStyle = "#f39a1c";
  pen.beginPath();
  pen.moveTo(0.66, -0.16);
  pen.lineTo(1.02, -0.04);
  pen.lineTo(0.66, 0.08);
  pen.fill();
  pen.restore();
}

/** Birds and stars going round above the head, the nearer ones larger and drawn last. */
function dizzy(pen: Pen, size: number, seconds: number) {
  const circling = Array.from({ length: 7 }, (_, n) => {
    const angle = seconds * 2.2 + (n * Math.PI * 2) / 7;
    return { n, angle, near: Math.sin(angle) };
  }).sort((a, b) => a.near - b.near);
  for (const { n, angle, near } of circling) {
    const x = Math.cos(angle) * size * 0.72;
    const y = -size * 0.62 + near * size * 0.14;
    const scale = size * (0.15 + 0.03 * near);
    if (n % 2) star(pen, x, y, scale * 0.85, seconds * 2 + n);
    else {
      const flap = 0.5 + 0.5 * Math.sin(seconds * 16 + n);
      bird(pen, x, y, scale, Math.sin(angle) > 0 ? -1 : 1, flap, "#ffd23f", "#f08c1a");
    }
  }
}

/** Two birds courting on either side of the head, with hearts rising between them. */
function loveBirds(pen: Pen, size: number, seconds: number) {
  for (let n = 0; n < 6; n += 1) {
    const life = (seconds * 0.45 + n / 6) % 1;
    const x = Math.sin(life * 7 + n * 2) * size * 0.22 + (n - 2.5) * size * 0.07;
    pen.globalAlpha = life < 0.8 ? 1 : (1 - life) / 0.2;
    heart(
      pen,
      x,
      -size * (0.55 + life * 0.75),
      size * (0.06 + 0.05 * life),
      n % 2 ? "#ff4d73" : "#e8174f",
    );
  }
  pen.globalAlpha = 1;
  for (const side of [-1, 1]) {
    const flap = 0.5 + 0.5 * Math.sin(seconds * 14 + side);
    const y = -size * 0.5 + Math.sin(seconds * 2.4 + side) * size * 0.06;
    bird(pen, side * size * 0.62, y, size * 0.2, -side, flap, "#ff87a8", "#d63d6b");
  }
}

const BALLOONS: readonly (readonly [number, number, string])[] = [
  [-0.98, -0.28, "#e53935"],
  [0.98, -0.32, "#1e88e5"],
  [-0.72, -0.92, "#fdd835"],
  [0.74, -0.96, "#43a047"],
  [-0.26, -1.22, "#8e24aa"],
  [0.28, -1.26, "#fb8c00"],
];

/** A bunch of balloons on either side of the head and above it, their strings running down past it. */
function balloons(pen: Pen, size: number, seconds: number) {
  BALLOONS.forEach(([across, up, colour], n) => {
    const x = (across + Math.sin(seconds * 1.1 + n * 1.7) * 0.05) * size;
    const y = (up + Math.sin(seconds * 1.5 + n) * 0.05) * size;
    const r = size * 0.23;
    pen.strokeStyle = "rgb(245 245 245 / 0.85)";
    pen.lineWidth = Math.max(1, size * 0.012);
    pen.beginPath();
    pen.moveTo(x, y + r * 1.25);
    pen.quadraticCurveTo(x * 1.05, (y + size) / 2, Math.sign(across) * size * 0.72, size * 1.05);
    pen.stroke();
    pen.fillStyle = colour;
    pen.beginPath();
    pen.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2);
    pen.fill();
    pen.beginPath();
    pen.moveTo(x, y + r * 1.15);
    pen.lineTo(x - r * 0.14, y + r * 1.36);
    pen.lineTo(x + r * 0.14, y + r * 1.36);
    pen.fill();
    pen.fillStyle = "rgb(255 255 255 / 0.45)";
    pen.beginPath();
    pen.ellipse(x - r * 0.35, y - r * 0.45, r * 0.2, r * 0.32, 0.5, 0, Math.PI * 2);
    pen.fill();
  });
}

/** A ring of hearts going round the head, beating out of step. */
function hearts(pen: Pen, size: number, seconds: number) {
  for (let n = 0; n < 9; n += 1) {
    const angle = seconds * 0.8 + (n * Math.PI * 2) / 9;
    const beat = 1 + 0.18 * Math.sin(seconds * 6 + n * 1.3);
    heart(
      pen,
      Math.cos(angle) * size * 0.78,
      Math.sin(angle) * size * 0.92,
      size * 0.1 * beat,
      n % 2 ? "#ff4d73" : "#d9124a",
    );
  }
}

/** Beating hearts over the eyes, and smaller ones rising from the head. */
function lovestruck(pen: Pen, size: number, seconds: number, parts: FaceParts) {
  const beat = 1 + 0.16 * Math.sin(seconds * 9);
  for (const eye of [parts.rightEye, parts.leftEye]) {
    heart(pen, eye.x, eye.y, size * 0.13 * beat, "#e8174f");
  }
  for (let n = 0; n < 4; n += 1) {
    const life = (seconds * 0.6 + n / 4) % 1;
    pen.globalAlpha = 1 - life;
    heart(pen, (n - 1.5) * size * 0.26, -size * (0.55 + life * 0.5), size * 0.07, "#ff4d73");
  }
  pen.globalAlpha = 1;
}

/** A frog's green over the face, with its eyes' wide black pupils. */
function frog(pen: Pen, size: number, _seconds: number, parts: FaceParts) {
  pen.save();
  pen.globalCompositeOperation = "multiply";
  pen.fillStyle = "#8fd14f";
  pen.beginPath();
  pen.ellipse(0, size * 0.08, size * 0.62, size * 0.72, 0, 0, Math.PI * 2);
  pen.fill();
  pen.restore();
  pen.fillStyle = "#14210c";
  for (const eye of [parts.rightEye, parts.leftEye]) {
    pen.beginPath();
    pen.ellipse(eye.x, eye.y, size * 0.05, size * 0.035, 0, 0, Math.PI * 2);
    pen.fill();
  }
}

/** A part of a face, in the coordinates the art is drawn in or in the canvas's pixels. */
interface FacePart {
  x: number;
  y: number;
}
type FaceParts = Record<keyof DetectedFace["landmarks"], FacePart>;

/** A small warp of a part of the face, drawn before its art. */
interface FaceWarp {
  at: FacePart;
  reach: number;
  warp: SpotWarp;
}

interface Tracked {
  warps?: (parts: FaceParts, size: number) => readonly FaceWarp[];
  art?: (pen: Pen, size: number, seconds: number, parts: FaceParts) => void;
}

const halfway = (from: FacePart, to: FacePart, t: number) => ({
  x: mix(from.x, to.x, t),
  y: mix(from.y, to.y, t),
});

const TRACKED: Record<string, Tracked> = {
  dizzy: { art: dizzy },
  "love-birds": { art: loveBirds },
  balloons: { art: balloons },
  hearts: { art: hearts },
  lovestruck: { art: lovestruck },
  "nose-twirl": {
    warps: ({ nose }, size) => [{ at: nose, reach: size * 0.5, warp: spin(2.6) }],
  },
  chipmunk: {
    warps: ({ mouth, rightEar, leftEar }, size) =>
      [rightEar, leftEar].map((ear) => ({
        at: halfway(mouth, ear, 0.55),
        reach: size * 0.42,
        warp: swell(0.62),
      })),
  },
  frog: {
    warps: ({ rightEye, leftEye, mouth }, size) => [
      { at: mouth, reach: size * 0.55, warp: widen(0.5, 0.2) },
      { at: rightEye, reach: size * 0.3, warp: swell(0.72) },
      { at: leftEye, reach: size * 0.3, warp: swell(0.72) },
    ],
    art: frog,
  },
};

/** Whether an effect is drawn on the camera's frame around a face. */
export const isTracked = (id: string): boolean => Object.hasOwn(TRACKED, id);

/** How a frame was drawn on a canvas. */
export interface FrameView {
  /** The whole frame's size, in pixels. */
  frameWidth: number;
  frameHeight: number;
  /** The part of the frame the canvas shows. */
  crop: { x: number; y: number; width: number; height: number };
  /** The canvas's size, in pixels. */
  width: number;
  height: number;
  /** Whether the frame was drawn flipped left to right. */
  mirrored: boolean;
}

/** The frame's point (`x`, `y`, as fractions of it) on the canvas. */
const placer = (view: FrameView) => ({
  across: (x: number) => {
    const inCrop = ((x * view.frameWidth - view.crop.x) / view.crop.width) * view.width;
    return view.mirrored ? view.width - inCrop : inCrop;
  },
  down: (y: number) => ((y * view.frameHeight - view.crop.y) / view.crop.height) * view.height,
});

/**
 * Where the first face found is on a canvas that shows `view`: its middle and its width, in the
 * canvas's pixels; nothing without a face, and so a warp stays on the frame.
 */
export function faceCentre(
  view: FrameView,
  now: number = performance.now(),
): FaceCentre | undefined {
  const face = facesNow(now)[0];
  if (!face) return undefined;
  const { across, down } = placer(view);
  return {
    x: across(face.x + face.width / 2),
    y: down(face.y + face.height / 2),
    size: Math.abs(across(face.x + face.width) - across(face.x)),
  };
}

/** Where a face is drawn: its box in the canvas's pixels. */
export interface PlacedFace {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draws the effect's art around each face found in the camera, over a frame already drawn on
 * `pen`'s canvas, and answers where the faces are on it.
 */
export function drawTracked(
  pen: Pen,
  id: string,
  view: FrameView,
  now: number = performance.now(),
): PlacedFace[] {
  const tracked = TRACKED[id];
  if (!tracked) return [];
  const { across, down } = placer(view);
  return facesNow(now).map((face) => {
    const [left, right] = [across(face.x), across(face.x + face.width)];
    const width = Math.abs(right - left);
    const placed = {
      x: Math.min(left, right),
      y: down(face.y),
      width,
      height: down(face.y + face.height) - down(face.y),
    };
    const on = Object.fromEntries(
      Object.entries(face.landmarks).map(([name, point]) => [
        name,
        { x: across(point.x), y: down(point.y) },
      ]),
    ) as FaceParts;
    const warps = tracked.warps?.(on, width);
    if (warps?.length) {
      const pixels = pen.getImageData(0, 0, view.width, view.height);
      for (const { at, reach, warp } of warps) {
        warpSpot(pixels.data, view.width, view.height, at.x, at.y, reach, warp);
      }
      pen.putImageData(pixels, 0, 0);
    }
    if (!tracked.art) return placed;
    const [ax, bx] = [on.rightEye.x, on.leftEye.x];
    const [ay, by] = [on.rightEye.y, on.leftEye.y];
    const tilt = ax < bx ? Math.atan2(by - ay, bx - ax) : Math.atan2(ay - by, ax - bx);
    const [middleX, middleY] = [placed.x + width / 2, placed.y + placed.height / 2];
    const local = Object.fromEntries(
      Object.entries(on).map(([name, point]) => {
        const [dx, dy] = [point.x - middleX, point.y - middleY];
        const [c, s] = [Math.cos(-tilt), Math.sin(-tilt)];
        return [name, { x: dx * c - dy * s, y: dx * s + dy * c }];
      }),
    ) as FaceParts;
    pen.save();
    pen.setTransform(1, 0, 0, 1, 0, 0);
    pen.translate(middleX, middleY);
    pen.rotate(tilt);
    tracked.art(pen, width, now / 1000, local);
    pen.restore();
    return placed;
  });
}
