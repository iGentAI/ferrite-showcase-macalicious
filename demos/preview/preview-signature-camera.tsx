"use client";

import { useEffect, useRef, useState } from "react";
import { MARKUP_LIMITS, type Point, type Signature, signatureFromStrokes } from "./preview-markup";

/** How large a frame of the camera is read, in pixels: enough for a line of writing. */
export const FRAME_WIDTH = 320;
export const FRAME_HEIGHT = 120;
/** How often the camera's picture is read, in milliseconds. */
const READ_EVERY = 250;

/** The shortest a line is kept, in pixels of a frame: anything shorter is a speck on the paper. */
const SHORTEST_LINE = 6;
/** A pixel is ink when it is this much darker than the paper around it. */
const INK_SHARE = 0.62;
/** A signature covers at least and at most this share of the frame; else this is no paper with writing. */
const INK_RANGE = [0.002, 0.2] as const;

interface Frame {
  width: number;
  height: number;
  /** RGBA, as `ImageData` holds it. */
  data: ArrayLike<number>;
}

/**
 * Which pixels of a frame are ink: darker than the brightest paper in the blocks around them, so that
 * a sheet lit from one side still reads. `null` when the frame holds no writing on paper.
 */
export function inkOf({ width, height, data }: Frame): Uint8Array | null {
  const block = Math.max(4, Math.floor(height / 6));
  const across = Math.ceil(width / block);
  const down = Math.ceil(height / block);
  const paper = new Float32Array(across * down);
  const light = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      const value =
        0.299 * Number(data[at]) + 0.587 * Number(data[at + 1]) + 0.114 * Number(data[at + 2]);
      light[y * width + x] = value;
      const cell = Math.floor(y / block) * across + Math.floor(x / block);
      paper[cell] = Math.max(paper[cell] ?? 0, value);
    }
  }
  const ink = new Uint8Array(width * height);
  let count = 0;
  for (let y = 0; y < height; y += 1) {
    const row = Math.floor(y / block);
    for (let x = 0; x < width; x += 1) {
      const column = Math.floor(x / block);
      let brightest = 0;
      for (let r = Math.max(0, row - 1); r <= Math.min(down - 1, row + 1); r += 1) {
        for (let c = Math.max(0, column - 1); c <= Math.min(across - 1, column + 1); c += 1) {
          brightest = Math.max(brightest, paper[r * across + c] ?? 0);
        }
      }
      if ((light[y * width + x] ?? 255) < brightest * INK_SHARE) {
        ink[y * width + x] = 1;
        count += 1;
      }
    }
  }
  const share = count / (width * height);
  return share >= INK_RANGE[0] && share <= INK_RANGE[1] ? ink : null;
}

const AROUND: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/** Thins lines of ink to one pixel across, by Zhang and Suen's method; changes `ink` in place. */
function thin(ink: Uint8Array, width: number, height: number) {
  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height ? (ink[y * width + x] ?? 0) : 0;
  for (let changed = true; changed; ) {
    changed = false;
    for (const pass of [0, 1]) {
      const clear: number[] = [];
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (!on(x, y)) continue;
          const ring = AROUND.map(([dx, dy]) => on(x + dx, y + dy));
          const near = ring.reduce((sum: number, each) => sum + each, 0);
          const turns = ring.filter((each, k) => !each && ring[(k + 1) % 8]).length;
          const [n, e, s, w] = [ring[0], ring[2], ring[4], ring[6]];
          const first = pass === 0 ? n && e && s : n && e && w;
          const second = pass === 0 ? e && s && w : n && s && w;
          if (near >= 2 && near <= 6 && turns === 1 && !first && !second) {
            clear.push(y * width + x);
          }
        }
      }
      for (const at of clear) ink[at] = 0;
      if (clear.length > 0) changed = true;
    }
  }
}

/** The lines of a one-pixel-wide drawing, each from an end to where it stops, longest first. */
function traced(ink: Uint8Array, width: number, height: number): Point[][] {
  const left = ink.slice();
  const neighbours = (at: number): number[] => {
    const x = at % width;
    const y = Math.floor(at / width);
    const found: number[] = [];
    for (const [dx, dy] of AROUND) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && left[ny * width + nx]) {
        found.push(ny * width + nx);
      }
    }
    return found;
  };
  const walk = (start: number): Point[] => {
    const line: Point[] = [];
    for (let at: number | undefined = start; at !== undefined; ) {
      left[at] = 0;
      line.push([at % width, Math.floor(at / width)]);
      at = neighbours(at)[0];
    }
    return line;
  };
  const every = Array.from(ink.keys()).filter((at) => ink[at]);
  const lines: Point[][] = [];
  for (const at of [...every.filter((each) => neighbours(each).length === 1), ...every]) {
    if (!left[at]) continue;
    const line = walk(at);
    if (line.length >= SHORTEST_LINE) lines.push(line);
  }
  return lines.sort((a, b) => b.length - a.length);
}

/** What is written in a frame of the camera, as a signature; `null` when nothing can be read. */
export function signatureOfFrame(frame: Frame): Signature | null {
  const ink = inkOf(frame);
  if (!ink) return null;
  thin(ink, frame.width, frame.height);
  return signatureFromStrokes(
    traced(ink, frame.width, frame.height).slice(0, MARKUP_LIMITS.strokes),
  );
}

/** What the sheet says when the browser gives no camera, by the error it gave. */
export function cameraRefusal(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  if (["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(name)) {
    return "Preview is not allowed to use the camera. Allow camera access for this site in the browser, then try again.";
  }
  if (["NotFoundError", "OverconstrainedError", "DevicesNotFoundError"].includes(name)) {
    return "No camera is connected, so a signature cannot be read from one. Sign on the trackpad instead.";
  }
  return "The camera could not be started; another application may be using it.";
}

const NO_CAMERA =
  "This page cannot use a camera: the browser offers none here (a camera needs a secure https connection). Sign on the trackpad instead.";

/** The part of a video that shows in a box of `width` by `height`, as `object-fit: cover` crops it. */
export function coverCrop(
  video: { width: number; height: number },
  box: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(box.width / video.width, box.height / video.height);
  const width = box.width / scale;
  const height = box.height / scale;
  return { x: (video.width - width) / 2, y: (video.height - height) / 2, width, height };
}

/** Draws what was read on the sheet's white pad, in its own proportions. */
function drawRead(canvas: HTMLCanvasElement, signature: Signature | null) {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(canvas.clientWidth * ratio) || 400;
  canvas.height = Math.round(canvas.clientHeight * ratio) || 150;
  const context = canvas.getContext("2d");
  if (!context || !signature) return;
  const margin = 12 * ratio;
  const room = { width: canvas.width - margin * 2, height: canvas.height - margin * 2 };
  const height = Math.min(room.height, room.width / signature.aspect);
  const width = height * signature.aspect;
  const left = (canvas.width - width) / 2;
  const top = (canvas.height - height) / 2;
  context.lineWidth = 2 * ratio;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#000000";
  for (const stroke of signature.strokes) {
    context.beginPath();
    stroke.forEach(([u, v], index) => {
      if (index === 0) context.moveTo(left + u * width, top + v * height);
      else context.lineTo(left + u * width, top + v * height);
    });
    context.stroke();
  }
}

/**
 * Create Signature's Camera: the camera for as long as this shows, a line to hold the writing on, and
 * what is read from it so far, which `onRead` is given as it changes.
 */
export function SignatureCamera({ onRead }: { onRead: (signature: Signature | null) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const read = useRef<HTMLCanvasElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const told = useRef(onRead);
  told.current = onRead;

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.getUserMedia) {
      setProblem(NO_CAMERA);
      setStarting(false);
      return;
    }
    let open = true;
    let got: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const frame = document.createElement("canvas");
    frame.width = FRAME_WIDTH;
    frame.height = FRAME_HEIGHT;
    const readFrame = () => {
      const shown = video.current;
      const context = frame.getContext("2d", { willReadFrequently: true });
      if (!shown || !context || shown.videoWidth === 0) return;
      const part = coverCrop(
        { width: shown.videoWidth, height: shown.videoHeight },
        { width: FRAME_WIDTH, height: FRAME_HEIGHT },
      );
      context.drawImage(
        shown,
        part.x,
        part.y,
        part.width,
        part.height,
        0,
        0,
        FRAME_WIDTH,
        FRAME_HEIGHT,
      );
      const signature = signatureOfFrame(context.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT));
      if (read.current) drawRead(read.current, signature);
      told.current(signature);
    };
    media.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } }).then(
      (given) => {
        if (!open) {
          for (const track of given.getTracks()) track.stop();
          return;
        }
        got = given;
        setStarting(false);
        const shown = video.current;
        if (shown) {
          shown.srcObject = given;
          shown.play().catch(() => undefined);
        }
        timer = setInterval(readFrame, READ_EVERY);
      },
      (error) => {
        if (!open) return;
        console.warn(`Preview could not use the camera (${error})`);
        setProblem(cameraRefusal(error));
        setStarting(false);
      },
    );
    return () => {
      open = false;
      clearInterval(timer);
      if (got) for (const track of got.getTracks()) track.stop();
    };
  }, []);

  if (problem) {
    return (
      <p role="alert" className="mac-preview-app-camera-problem">
        {problem}
      </p>
    );
  }
  return (
    <>
      <div className="mac-preview-app-camera">
        <video
          ref={video}
          muted
          playsInline
          aria-label={starting ? "Waiting for the camera" : "Camera"}
        />
      </div>
      <canvas
        ref={read}
        className="mac-preview-app-pad"
        aria-label="Signature read from the camera"
        role="img"
      />
    </>
  );
}
