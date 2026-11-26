/*
 * Finds faces in a picture or a video frame, with MediaPipe's BlazeFace short-range model (Apache
 * 2.0; demos/photo-booth/vendor/) served from the site's own assets, so that no picture and no
 * request leaves the desktop. The model and its code load on the first call, and it runs in a worker
 * because one detection takes about 70 ms.
 *
 * The model runs on a small interpreter (photo-booth-face-model.ts) instead of
 * @mediapipe/tasks-vision: that package's WebAssembly is 14.6 MB, and the site packer refuses a file
 * whose base64 is over 14 MiB. Short range means faces within about two metres of a camera: the
 * small faces of a group picture are not found.
 */

import {
  type DetectedFace,
  FACE_MODEL_SIDE,
  type FacePoint,
} from "../photo-booth/photo-booth-face-model";
import type { FaceReply, FaceRequest } from "../photo-booth/photo-booth-face-model.worker";
import modelUrl from "../photo-booth/vendor/blaze_face_short_range.tflite?url";
import { sessionFetch } from "./desktop-server";

export type { DetectedFace, FacePoint };

export type FaceSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap;

const sizeOf = (source: FaceSource) =>
  source instanceof HTMLVideoElement
    ? { width: source.videoWidth, height: source.videoHeight }
    : source instanceof HTMLImageElement
      ? { width: source.naturalWidth, height: source.naturalHeight }
      : { width: source.width, height: source.height };

let worker: Promise<Worker> | null = null;
let asked = 0;
const waiting = new Map<
  number,
  { resolve: (faces: DetectedFace[]) => void; reject: (why: Error) => void }
>();

/** The worker with the model in it. After a failure the next call starts again. */
function workerWithModel(): Promise<Worker> {
  worker ??= sessionFetch(modelUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`The face model answered HTTP ${response.status}.`);
      return response.arrayBuffer();
    })
    .then((model) => {
      const started = new Worker(
        new URL("../photo-booth/photo-booth-face-model.worker.ts", import.meta.url),
        { type: "module" },
      );
      started.onmessage = ({ data: { id, faces } }: MessageEvent<FaceReply>) => {
        waiting.get(id)?.resolve(faces);
        waiting.delete(id);
      };
      started.onerror = (event) => {
        event.preventDefault();
        started.terminate();
        worker = null;
        const why = new Error(event.message || "The face detector's worker failed.");
        for (const { reject } of waiting.values()) reject(why);
        waiting.clear();
      };
      const request: FaceRequest = { model };
      started.postMessage(request, [model]);
      return started;
    })
    .catch((error) => {
      worker = null;
      throw error;
    });
  return worker;
}

let square: CanvasRenderingContext2D | null = null;

/**
 * The faces in a picture or a video's current frame, the most confident first, with boxes and
 * landmarks as fractions of its width and height; none for a source with no pixels yet. It rejects
 * when the model cannot be fetched or run, and a later call tries again.
 */
export async function detectFaces(source: FaceSource): Promise<DetectedFace[]> {
  const { width, height } = sizeOf(source);
  if (width === 0 || height === 0) return [];
  const ready = await workerWithModel();
  if (!square) {
    const canvas = document.createElement("canvas");
    canvas.width = FACE_MODEL_SIDE;
    canvas.height = FACE_MODEL_SIDE;
    square = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!square) throw new Error("This browser gave no canvas to read a picture with.");
  const scale = FACE_MODEL_SIDE / Math.max(width, height);
  const [w, h] = [width * scale, height * scale];
  square.fillStyle = "#000";
  square.fillRect(0, 0, FACE_MODEL_SIDE, FACE_MODEL_SIDE);
  square.drawImage(source, (FACE_MODEL_SIDE - w) / 2, (FACE_MODEL_SIDE - h) / 2, w, h);
  const { data } = square.getImageData(0, 0, FACE_MODEL_SIDE, FACE_MODEL_SIDE);
  asked += 1;
  const id = asked;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    const request: FaceRequest = { id, square: data, width, height };
    ready.postMessage(request, [data.buffer]);
  });
}
