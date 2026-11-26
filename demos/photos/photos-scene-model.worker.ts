import { sceneClassifier } from "./photos-scene-model";

/** What the page sends: the model's bytes first, then one square picture for each reading. */
export type SceneRequest = { model: ArrayBuffer } | { id: number; square: Uint8ClampedArray };
export interface SceneReply {
  id: number;
  shares: Float32Array;
}

// The worker's global scope, typed as much as this file uses of it (the project's types are the
// page's, not a worker's).
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<SceneRequest>) => void) | null;
  postMessage(reply: SceneReply): void;
};

let classify: ReturnType<typeof sceneClassifier> | null = null;

scope.onmessage = ({ data }) => {
  if ("model" in data) {
    classify = sceneClassifier(new Uint8Array(data.model));
    return;
  }
  if (!classify) throw new Error("The scene model has not arrived.");
  scope.postMessage({ id: data.id, shares: classify(data.square).slice() });
};
