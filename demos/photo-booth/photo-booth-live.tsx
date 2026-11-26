import { type RefObject, useEffect, useRef } from "react";
import { coverCrop } from "./photo-booth-bake";
import { computeEffect, isWarp } from "./photo-booth-effects";
import { drawTracked, faceCentre, isTracked, watchFaces } from "./photo-booth-tracked";

/** The widest a live effect is computed, in pixels: a camera's picture here, scaled up beyond it. */
const LIVE_WIDTH = 640;
/** How long one animation frame may spend computing, in milliseconds: the rest wait for the next,
 * so nine previews take turns and the page keeps answering on a slow machine. */
const FRAME_BUDGET_MS = 8;
/** The shortest time between two paintings of one canvas, in milliseconds. */
const PREVIEW_EVERY_MS = 66;
const CAMERA_EVERY_MS = 33;

interface Painter {
  paint: () => void;
  every: () => number;
  last: number;
}

const painters: Painter[] = [];
let ticking = 0;
let turn = 0;

function tick(now: number) {
  const spent = performance.now();
  for (let tried = 0; tried < painters.length; tried += 1) {
    if (performance.now() - spent >= FRAME_BUDGET_MS) break;
    turn = (turn + 1) % painters.length;
    const painter = painters[turn];
    if (!painter || now - painter.last < painter.every()) continue;
    painter.last = now;
    painter.paint();
  }
  ticking = painters.length > 0 ? requestAnimationFrame(tick) : 0;
}

/** Paints on every animation frame it has a turn in, until the function answered is called. */
function paintLive(paint: () => void, every: () => number): () => void {
  const painter: Painter = { paint, every, last: Number.NEGATIVE_INFINITY };
  painters.push(painter);
  if (ticking === 0) ticking = requestAnimationFrame(tick);
  return () => {
    painters.splice(painters.indexOf(painter), 1);
    if (painters.length === 0) {
      cancelAnimationFrame(ticking);
      ticking = 0;
    }
  };
}

/**
 * The camera's picture under a computed effect, over the video it reads: mirrored, cropped as the video
 * shows it, and the size of the video on the page. Until its first frame it is clear, and the video
 * shows through with the effect's CSS. A tracked effect says where it found faces in `data-faces`:
 * x, y, width and height as fractions of the canvas, one line per face; a warp says where it is
 * centred in `data-centre`.
 */
export function ComputedEffectCanvas({
  video,
  effect,
  onTrackingFailed,
}: {
  video: RefObject<HTMLVideoElement | null>;
  effect: string;
  /** Called when a tracked effect's face model cannot be loaded or run. */
  onTrackingFailed?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const failed = useRef(onTrackingFailed);
  failed.current = onTrackingFailed;
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let context: CanvasRenderingContext2D | null = null;
    const tracked = isTracked(effect);
    const warp = isWarp(effect);
    const seen = video.current;
    const stopWatching =
      (tracked || warp) && seen ? watchFaces(seen, () => failed.current?.()) : undefined;
    const stopPainting = paintLive(
      () => {
        const from = video.current;
        if (!from || from.videoWidth === 0 || from.videoHeight === 0) return;
        const shownWidth = from.clientWidth || from.videoWidth;
        const shownHeight = from.clientHeight || from.videoHeight;
        const width = Math.min(shownWidth, LIVE_WIDTH);
        const height = Math.max(1, Math.round((width * shownHeight) / shownWidth));
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        context ??= canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        const crop = coverCrop(from.videoWidth, from.videoHeight, shownWidth / shownHeight);
        context.setTransform(-1, 0, 0, 1, width, 0);
        context.drawImage(from, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
        context.setTransform(1, 0, 0, 1, 0, 0);
        const view = {
          frameWidth: from.videoWidth,
          frameHeight: from.videoHeight,
          crop,
          width,
          height,
          mirrored: true,
        };
        if (tracked) {
          const placed = drawTracked(context, effect, view);
          canvas.dataset.faces = placed
            .map(
              (face) =>
                `${(face.x / width).toFixed(3)} ${(face.y / height).toFixed(3)} ${(face.width / width).toFixed(3)} ${(face.height / height).toFixed(3)}`,
            )
            .join("\n");
          return;
        }
        const image = context.getImageData(0, 0, width, height);
        const face = warp ? faceCentre(view) : undefined;
        if (warp) {
          canvas.dataset.centre = face
            ? `${(face.x / width).toFixed(3)} ${(face.y / height).toFixed(3)}`
            : "";
        }
        computeEffect(effect, image.data, image.width, image.height, true, face);
        context.putImageData(image, 0, 0);
      },
      () => (canvas.width < LIVE_WIDTH / 2 ? PREVIEW_EVERY_MS : CAMERA_EVERY_MS),
    );
    return () => {
      stopPainting();
      stopWatching?.();
    };
  }, [video, effect]);
  return <canvas ref={ref} data-effect={effect} />;
}
