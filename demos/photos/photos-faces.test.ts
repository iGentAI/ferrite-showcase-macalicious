import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FACE_MODEL_SIDE, faceDetector } from "../photo-booth/photo-booth-face-model";
import {
  faceCrop,
  faceNamed,
  facesFrom,
  notLookedAt,
  readFaces,
  tilesOf,
  unnamedFaces,
} from "./photos-faces";
import type { LibraryPhoto } from "./photos-library";

const vendor = `${process.cwd()}/demos/photo-booth/vendor/`;
const portrait = readFileSync(`${vendor}face-fixture.jpg`);
const detect = faceDetector(readFileSync(`${vendor}blaze_face_short_range.tflite`));

/** A thumbnail with the fixture in it at `faceHeight` pixels, on grey. */
const thumbnail = async (width: number, height: number, faceHeight: number, left: number) => {
  const fitted = await sharp(portrait).resize({ height: faceHeight }).toBuffer();
  return sharp({ create: { width, height, channels: 3, background: "#777" } })
    .composite([{ input: fitted, left, top: 20 }])
    .png()
    .toBuffer();
};

const readingOf = (picture: Buffer, width: number, height: number) =>
  readFaces(width, height, async (tile) => {
    const piece = tile
      ? sharp(picture).extract({ left: tile.x, top: tile.y, width: tile.side, height: tile.side })
      : sharp(picture);
    const { data } = await piece
      .resize(FACE_MODEL_SIDE, FACE_MODEL_SIDE, { fit: "contain", background: "#000" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return detect(new Uint8ClampedArray(data), tile?.side ?? width, tile?.side ?? height);
  });

describe("looking for faces", () => {
  it("finds one face once in a full portrait, read whole and in tiles", async () => {
    const picture = await sharp(portrait).resize({ height: 320 }).png().toBuffer();
    const { width = 0, height = 0 } = await sharp(picture).metadata();
    const faces = await readingOf(picture, width, height);
    expect(faces).toHaveLength(1);
    expect(faces[0]?.score).toBeGreaterThan(0.75);
  });

  it("finds through the tiles a small face the whole picture misses", async () => {
    const picture = await thumbnail(480, 320, 110, 300);
    const whole = await sharp(picture)
      .resize(FACE_MODEL_SIDE, FACE_MODEL_SIDE, { fit: "contain", background: "#000" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    const readWhole = facesFrom(detect(new Uint8ClampedArray(whole), 480, 320));
    const faces = await readingOf(picture, 480, 320);
    expect(faces.length).toBeGreaterThan(readWhole.length);
    expect(faces).toHaveLength(1);
    const [face] = faces;
    expect(face?.x).toBeGreaterThan(300 / 480);
    expect(face?.y).toBeLessThan(130 / 320);
  });

  it("finds nothing in a picture of nobody", async () => {
    const picture = await sharp("demos/photos/art/p02-large.webp").resize(480).png().toBuffer();
    const { width = 0, height = 0 } = await sharp(picture).metadata();
    expect(await readingOf(picture, width, height)).toEqual([]);
  });

  it("covers a picture with overlapping tiles of a half and a third of its long side", () => {
    const tiles = tilesOf(480, 320);
    expect(tiles.slice(0, 6)).toEqual([
      { x: 0, y: 0, side: 240 },
      { x: 120, y: 0, side: 240 },
      { x: 240, y: 0, side: 240 },
      { x: 0, y: 80, side: 240 },
      { x: 120, y: 80, side: 240 },
      { x: 240, y: 80, side: 240 },
    ]);
    expect(tiles).toHaveLength(21);
    expect(tiles.at(-1)).toEqual({ x: 320, y: 160, side: 160 });
    // A long thin picture stays at a few tiles in one row.
    expect(tilesOf(480, 40).every((tile) => tile.y === 0)).toBe(true);
    expect(tilesOf(480, 40).length).toBeLessThan(25);
  });

  it("keeps one reading of a face, the most confident, and cuts it to the picture", () => {
    expect(
      facesFrom([
        { x: -0.05, y: 0.1, width: 0.25, height: 0.3, score: 0.8 },
        { x: 0, y: 0.1, width: 0.2, height: 0.3, score: 0.9 },
        { x: 0.6, y: 0.1, width: 0.2, height: 0.3, score: 0.76 },
        { x: 0.3, y: 0.5, width: 0.2, height: 0.3, score: 0.7 },
      ]),
    ).toEqual([
      { x: 0, y: 0.1, width: 0.2, height: 0.3, score: 0.9 },
      { x: 0.6, y: 0.1, width: 0.2, height: 0.3, score: 0.76 },
    ]);
  });
});

const photo = (id: string, extra: Partial<LibraryPhoto>) =>
  ({
    id,
    mime: "image/jpeg",
    deleted_ms: null,
    hidden: false,
    people: [],
    ...extra,
  }) as LibraryPhoto;
const face = (id: number, score: number, extra = {}) => ({
  id,
  x: 0.1,
  y: 0.1,
  width: 0.2,
  height: 0.2,
  score,
  ...extra,
});

describe("the faces of a library", () => {
  it("lists unnamed faces by confidence, without the named, the rejected, hidden or deleted", () => {
    const list = unnamedFaces([
      photo("a", { faces: [face(0, 0.8), face(1, 0.95, { name: "Ann" }), face(2, 0.9)] }),
      photo("b", { faces: [face(0, 0.99, { not_a_face: true })] }),
      photo("c", { faces: [face(0, 0.99)], hidden: true }),
      photo("d", { faces: [face(0, 0.99)], deleted_ms: 5 }),
      photo("e", {}),
    ]);
    expect(list.map((each) => [each.photo.id, each.face.id])).toEqual([
      ["a", 2],
      ["a", 0],
    ]);
  });

  it("finds a person's face whatever the case of the name, leaving out the rejected", () => {
    const photos = [
      photo("a", { faces: [face(0, 0.9, { name: "Ann", not_a_face: true })] }),
      photo("b", { faces: [face(0, 0.9), face(1, 0.9, { name: "ANN" })] }),
    ];
    expect(faceNamed("ann", photos)?.photo.id).toBe("b");
    expect(faceNamed("ann", photos)?.face.id).toBe(1);
    expect(faceNamed("bo", photos)).toBeUndefined();
  });

  it("looks only at pictures not looked at, a picture of no face being looked at", () => {
    const list = notLookedAt([
      photo("a", {}),
      photo("b", { faces: [] }),
      photo("c", { mime: "video/mp4" }),
      photo("d", { deleted_ms: 1 }),
    ]);
    expect(list.map((each) => each.id)).toEqual(["a"]);
  });

  it("places a picture so that the face fills its round tile, inside the picture", () => {
    // A face 70 pixels square at (100, 100) of 400 by 200: a square of 100 about its middle.
    expect(faceCrop({ x: 0.25, y: 0.5, width: 70 / 400, height: 70 / 200 }, 400, 200)).toEqual({
      width: "400%",
      height: "200%",
      left: "-85%",
      top: "-85%",
    });
    // At the picture's edge the square stops at the edge.
    expect(faceCrop({ x: 0, y: 0, width: 0.1, height: 0.1 }, 400, 200).left).toBe("0%");
  });
});
