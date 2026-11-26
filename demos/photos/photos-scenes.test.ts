import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LibraryPhoto } from "./photos-library";
import { SCENE_MODEL_SIDE, sceneClassifier } from "./photos-scene-model";
import { notLookedAtForScenes, sceneMemoryTitle, scenesOfShares } from "./photos-scenes";
import { memoriesOf, searchMatches } from "./photos-served-data";

const shares = (entries: Record<number, number>) => {
  const all = new Float32Array(1000);
  for (const [at, share] of Object.entries(entries)) all[Number(at)] = share;
  return all;
};

const DAY = 24 * 60 * 60 * 1000;
const START = new Date(2024, 5, 1, 12).getTime();
const photo = (id: string, day: number, more: Partial<LibraryPhoto> = {}) =>
  ({
    id,
    name: `${id}.jpg`,
    taken_ms: START + day * DAY,
    deleted_ms: null,
    hidden: false,
    favorite: false,
    location: null,
    people: [],
    keywords: [],
    mime: "image/jpeg",
    ...more,
  }) as LibraryPhoto;

describe("Photos' scenes", () => {
  it("adds up a scene's classes, naming the likeliest first and only what is likely", () => {
    // Labrador retriever and golden retriever, then seashore.
    expect(scenesOfShares(shares({ 208: 0.2, 207: 0.2, 978: 0.5 }))).toEqual(["Beach", "Dogs"]);
    expect(scenesOfShares(shares({ 208: 0.2 }))).toEqual([]);
    // A class no scene holds: a tench.
    expect(scenesOfShares(shares({ 0: 0.99 }))).toEqual([]);
  });

  it("finds a photo by its scene and by the other words for it", () => {
    const dog = photo("a", 0, { scenes: ["Dogs"] });
    expect(searchMatches(dog, "dog", [])).toBe(true);
    expect(searchMatches(dog, "puppy", [])).toBe(true);
    expect(searchMatches(dog, "beach", [])).toBe(false);
    expect(searchMatches(photo("b", 0, { scenes: null }), "dog", [])).toBe(false);
    expect(searchMatches(photo("c", 0, { scenes: ["Airplanes"] }), "plane", [])).toBe(true);
  });

  it("makes a memory of a scene across at least two days, when it holds six", () => {
    const beach = { scenes: ["Beach"] };
    const list = [0, 10, 20, 30, 40, 50].map((day) => photo(`b${day}`, day, beach));
    const memory = memoriesOf(list).find((each) => each.id === "scene-Beach");
    expect(memory?.title).toBe(sceneMemoryTitle("Beach"));
    expect(memory?.title).toBe("At the Beach");
    expect(memory?.photos).toHaveLength(6);
    expect(memoriesOf(list.slice(1)).some((each) => each.id === "scene-Beach")).toBe(false);
    const oneDay = [1, 2, 3, 4, 5, 6].map((n) => photo(`d${n}`, 0, beach));
    expect(memoriesOf(oneDay).some((each) => each.id === "scene-Beach")).toBe(false);
  });

  it("looks at pictures not yet looked at, and at no movie", () => {
    const list = [
      photo("new", 0, { mime: "image/jpeg" }),
      photo("seen", 0, { mime: "image/jpeg", scenes: [] }),
      photo("film", 0, { mime: "video/webm" }),
      photo("gone", 0, { mime: "image/jpeg", deleted_ms: 1 }),
    ];
    expect(notLookedAtForScenes(list).map((each) => each.id)).toEqual(["new"]);
  });
});

describe("the scene model", () => {
  it("reads its file and shares out one whole among its 1000 classes", () => {
    const run = sceneClassifier(
      new Uint8Array(
        Buffer.concat([
          readFileSync("demos/photos/vendor/efficientnet_lite0-0.tflite"),
          readFileSync("demos/photos/vendor/efficientnet_lite0-1.tflite"),
        ]),
      ),
    );
    const grey = new Uint8ClampedArray(SCENE_MODEL_SIDE * SCENE_MODEL_SIDE * 4).fill(128);
    const out = run(grey);
    expect(out).toHaveLength(1000);
    expect(out.reduce((all, share) => all + share, 0)).toBeCloseTo(1, 3);
  }, 30_000);
});
