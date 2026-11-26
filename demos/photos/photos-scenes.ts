/*
 * What a picture shows, for Photos' search and Memories. A thumbnail goes to EfficientNet-Lite0
 * (`photos-scene-model.ts`) in a worker, on this page, so no picture leaves the desktop; the words are
 * kept with the photo on the server, which looks at no picture. The model knows ImageNet's 1000
 * classes, so these are the scenes those classes add up to, and a person's holiday in a place it has
 * no class for is simply not named.
 */

import { sessionFetch } from "../desktop/desktop-server";
import type { LibraryPhoto } from "./photos-library";
import { SCENE_MODEL_SIDE } from "./photos-scene-model";
import type { SceneReply, SceneRequest } from "./photos-scene-model.worker";
// The model in two halves, each small enough for one reply of the Ferrite app that serves the
// desktop (ferrite-apps/desktop/scripts/pack-site.mjs); the page joins them.
import modelFirstHalf from "./vendor/efficientnet_lite0-0.tflite?url";
import modelSecondHalf from "./vendor/efficientnet_lite0-1.tflite?url";

/** The classes each scene adds up, as indices or inclusive ranges of ImageNet's list. */
const SCENE_CLASSES: Readonly<Record<string, readonly (number | readonly [number, number])[]>> = {
  Airplanes: [[404, 405], 417, 812, 895, 908],
  Beach: [[977, 978]],
  Bicycles: [444, 665, [670, 671], 870, 880],
  Birds: [[7, 24], [80, 100], [127, 133], [135, 146], 517],
  Boats: [472, 484, 510, 536, 554, 576, 625, 628, 693, 724, 780, 814, 871, [913, 914]],
  Bridges: [821, 839, 888],
  Buildings: [
    425,
    442,
    449,
    483,
    [497, 498],
    538,
    580,
    624,
    649,
    663,
    668,
    682,
    698,
    727,
    743,
    832,
    853,
    858,
    873,
    884,
    900,
  ],
  Cars: [
    407, 436, 468, 479, 511, 581, 609, 627, 654, 656, 661, 675, 717, 734, 751, 757, 779, 817, 864,
    867,
  ],
  Cats: [[281, 285]],
  Dogs: [[151, 268]],
  Flowers: [738, 883, [984, 986]],
  Food: [762, 909, [922, 929], [931, 935], [959, 967], 969],
  Lake: [525, 975],
  Mountains: [672, 970, 972, [979, 980]],
  Snow: [450, 537, 795, [802, 803]],
  Trains: [466, 547, 565, 705, 820, 829],
};

/** A scene's share of a picture, summed over its classes, from which the picture is said to show it. */
const MIN_SHARE = 0.35;

/** The other words a search finds a scene by, as "plane" does not start "Airplanes". */
const OTHER_WORDS: Readonly<Record<string, string>> = {
  Airplanes: "plane planes aeroplane",
  Bicycles: "bike bikes cycle",
  Beach: "sea seaside",
  Boats: "ship ships",
  Buildings: "building",
  Cats: "kitten",
  Dogs: "puppy",
};

/** The words a search finds a photo's scenes by. */
export const sceneWords = (scene: string) => `${scene} ${OTHER_WORDS[scene] ?? ""}`;

/** What a scene's memory is called. */
const MEMORY_TITLES: Readonly<Record<string, string>> = {
  Beach: "At the Beach",
  Boats: "On the Water",
  Lake: "By the Lake",
  Mountains: "In the Mountains",
  Snow: "In the Snow",
};

export const sceneMemoryTitle = (scene: string) => MEMORY_TITLES[scene] ?? scene;

/** The scenes a picture shows from each class's share, the likeliest first. */
export function scenesOfShares(shares: ArrayLike<number>): string[] {
  const shown: { scene: string; share: number }[] = [];
  for (const [scene, classes] of Object.entries(SCENE_CLASSES)) {
    let share = 0;
    for (const each of classes) {
      const [from, to] = typeof each === "number" ? [each, each] : each;
      for (let at = from; at <= to; at += 1) share += shares[at] ?? 0;
    }
    if (share >= MIN_SHARE) shown.push({ scene, share });
  }
  return shown.sort((a, b) => b.share - a.share).map((each) => each.scene);
}

export const notLookedAtForScenes = (photos: readonly LibraryPhoto[]): LibraryPhoto[] =>
  photos.filter(
    (photo) => !photo.scenes && photo.deleted_ms === null && !photo.mime.startsWith("video/"),
  );

let worker: Promise<Worker> | null = null;
let asked = 0;
const waiting = new Map<
  number,
  { resolve: (shares: Float32Array) => void; reject: (why: Error) => void }
>();

/** The worker with the model in it. After a failure the next call starts again. */
function workerWithModel(): Promise<Worker> {
  const half = (url: string) =>
    sessionFetch(url).then((response) => {
      if (!response.ok) throw new Error(`The scene model answered HTTP ${response.status}.`);
      return response.arrayBuffer();
    });
  worker ??= Promise.all([half(modelFirstHalf), half(modelSecondHalf)])
    .then(([first, second]) => {
      const model = new Uint8Array(first.byteLength + second.byteLength);
      model.set(new Uint8Array(first));
      model.set(new Uint8Array(second), first.byteLength);
      return model.buffer;
    })
    .then((model) => {
      const started = new Worker(new URL("./photos-scene-model.worker.ts", import.meta.url), {
        type: "module",
      });
      started.onmessage = ({ data: { id, shares } }: MessageEvent<SceneReply>) => {
        waiting.get(id)?.resolve(shares);
        waiting.delete(id);
      };
      started.onerror = (event) => {
        event.preventDefault();
        started.terminate();
        worker = null;
        const why = new Error(event.message || "The scene model's worker failed.");
        for (const { reject } of waiting.values()) reject(why);
        waiting.clear();
      };
      const request: SceneRequest = { model };
      started.postMessage(request, [model]);
      return started;
    })
    .catch((error) => {
      worker = null;
      throw error;
    });
  return worker;
}

/** The scenes in a thumbnail: its middle square at the side the model reads. */
export async function scenesOfThumb(thumb: Blob): Promise<string[]> {
  const ready = await workerWithModel();
  const bitmap = await createImageBitmap(thumb);
  let square: Uint8ClampedArray;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SCENE_MODEL_SIDE;
    canvas.height = SCENE_MODEL_SIDE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("this browser cannot draw a thumbnail");
    const side = Math.min(bitmap.width, bitmap.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      SCENE_MODEL_SIDE,
      SCENE_MODEL_SIDE,
    );
    square = context.getImageData(0, 0, SCENE_MODEL_SIDE, SCENE_MODEL_SIDE).data;
  } finally {
    bitmap.close();
  }
  asked += 1;
  const id = asked;
  const shares = await new Promise<Float32Array>((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    const request: SceneRequest = { id, square };
    ready.postMessage(request, [square.buffer]);
  });
  return scenesOfShares(shares);
}
