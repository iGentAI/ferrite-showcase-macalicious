import { type DetectedFace, faceDetector } from "./photo-booth-face-model";

/** What the page sends: the model's bytes first, then one square picture for each detection. */
export type FaceRequest =
  | { model: ArrayBuffer }
  | { id: number; square: Uint8ClampedArray; width: number; height: number };
export interface FaceReply {
  id: number;
  faces: DetectedFace[];
}

// The worker's global scope, typed as much as this file uses of it (the project's types are the
// page's, not a worker's).
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<FaceRequest>) => void) | null;
  postMessage(reply: FaceReply): void;
};

let detect: ReturnType<typeof faceDetector> | null = null;

scope.onmessage = ({ data }) => {
  if ("model" in data) {
    detect = faceDetector(new Uint8Array(data.model));
    return;
  }
  if (!detect) throw new Error("The face model has not arrived.");
  scope.postMessage({ id: data.id, faces: detect(data.square, data.width, data.height) });
};
