/*
 * Finds faces in the thumbnails of a person's own photos, in this page, with the bundled detector
 * (`demos/desktop/desktop-faces.ts`); only the boxes go to this desktop's own server. A thumbnail is
 * read whole and then in overlapping tiles, since the detector scores a face under about a tenth of
 * what it reads too low to tell from nothing: the fixture's face was kept down to 16 pixels of a
 * 480-pixel thumbnail, about a thirtieth of its long side.
 *
 * Faces are not told apart. A landmark ratio, a dHash and a correlation of 32 by 32 eye-aligned crops
 * were compared over 240 pictures of 60 people from Labeled Faces in the Wild: the area under the
 * ROC curve was 0.54, 0.56 and 0.63, and the best of them was right 6% of the time at 10% recall.
 * So faces are grouped only by the names the person gives them.
 */

import { type DetectedFace, detectFaces } from "../desktop/desktop-faces";
import type { LibraryPhoto, PhotoFace } from "./photos-library";

/**
 * The least confidence kept. Over 24 pictures of nobody, in 592 readings, the detector's 36 false
 * faces scored up to 0.734; the 240 real faces above scored at least 0.776.
 */
const MIN_SCORE = 0.75;
/** How much of the smaller box two readings of one face share. */
const SAME_FACE_OVERLAP = 0.4;
/** The most faces kept of one picture, by confidence, as the server allows. */
const MOST_FACES = 32;

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

/**
 * The square tiles that cover a picture, in its pixels: a half and a third of its long side, half
 * overlapping. A very long picture is read in tiles past its short side, drawn on black.
 */
export function tilesOf(width: number, height: number) {
  const long = Math.max(width, height);
  const short = Math.min(width, height);
  return [2, 3].flatMap((part) => {
    const side = Math.round(Math.min(long / part, Math.max(short, long / 6)));
    const startsAlong = (length: number) => {
      const count = Math.max(1, Math.ceil((length - side) / (side / 2)) + 1);
      return Array.from({ length: count }, (_, at) =>
        count === 1 ? 0 : Math.round((at * (length - side)) / (count - 1)),
      );
    };
    return startsAlong(height).flatMap((y) => startsAlong(width).map((x) => ({ x, y, side })));
  });
}

const overlapOfSmaller = (a: FaceBox, b: FaceBox) => {
  const across = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const down = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (across <= 0 || down <= 0) return 0;
  return (across * down) / Math.min(a.width * a.height, b.width * b.height);
};

/** The boxes confident enough, each face once with its most confident reading, cut to the picture. */
export function facesFrom(readings: readonly FaceBox[]): FaceBox[] {
  const kept: FaceBox[] = [];
  const confident = readings
    .filter((each) => each.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);
  for (const each of confident) {
    if (!kept.some((face) => overlapOfSmaller(face, each) > SAME_FACE_OVERLAP)) kept.push(each);
  }
  const at = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 10_000) / 10_000;
  return kept.slice(0, MOST_FACES).map((each) => {
    const x = at(each.x);
    const y = at(each.y);
    return {
      x,
      y,
      width: Math.max(0.0001, at(Math.min(each.x + each.width, 1) - x)),
      height: Math.max(0.0001, at(Math.min(each.y + each.height, 1) - y)),
      score: Math.round(each.score * 1000) / 1000,
    };
  });
}

/** The faces of a picture by `detect`, which reads each tile the same way as the whole. */
export async function readFaces(
  width: number,
  height: number,
  detect: (tile: { x: number; y: number; side: number } | null) => Promise<DetectedFace[]>,
): Promise<FaceBox[]> {
  const readings: FaceBox[] = (await detect(null)).map(({ x, y, width, height, score }) => ({
    x,
    y,
    width,
    height,
    score,
  }));
  for (const tile of tilesOf(width, height)) {
    for (const face of await detect(tile)) {
      readings.push({
        x: (tile.x + face.x * tile.side) / width,
        y: (tile.y + face.y * tile.side) / height,
        width: (face.width * tile.side) / width,
        height: (face.height * tile.side) / height,
        score: face.score,
      });
    }
  }
  return facesFrom(readings);
}

/** The faces of a thumbnail, or null for one this browser cannot draw. It rejects when the detector cannot run. */
export async function facesOfThumb(thumb: Blob): Promise<FaceBox[] | null> {
  const bitmap = await createImageBitmap(thumb).catch(() => null);
  if (!bitmap) return null;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("this browser cannot draw a thumbnail");
    return await readFaces(bitmap.width, bitmap.height, (tile) => {
      if (!tile) return detectFaces(bitmap);
      canvas.width = tile.side;
      canvas.height = tile.side;
      context.drawImage(bitmap, -tile.x, -tile.y);
      return detectFaces(canvas);
    });
  } finally {
    bitmap.close();
  }
}

/** The faces of a photo a person can name: Not a Face leaves its list. */
export const facesToName = (photo: LibraryPhoto): PhotoFace[] =>
  (photo.faces ?? []).filter((face) => !face.not_a_face);

/** A face still to be named, with its photo. */
export interface UnnamedFace {
  photo: LibraryPhoto;
  face: PhotoFace;
}

/** Every face of the library with no name, the most confident first. */
export function unnamedFaces(photos: readonly LibraryPhoto[]): UnnamedFace[] {
  return photos
    .filter((photo) => photo.deleted_ms === null && !photo.hidden)
    .flatMap((photo) =>
      facesToName(photo)
        .filter((face) => !face.name)
        .map((face) => ({ photo, face })),
    )
    .sort((a, b) => b.face.score - a.face.score);
}

/** The first face in `photos` carrying `name`, ignoring case, for a person's tile. */
export function faceNamed(name: string, photos: readonly LibraryPhoto[]): UnnamedFace | undefined {
  const wanted = name.toLowerCase();
  for (const photo of photos) {
    const face = facesToName(photo).find((each) => each.name?.toLowerCase() === wanted);
    if (face) return { photo, face };
  }
  return undefined;
}

/** The photos a page may still look at: pictures in the library nobody has looked at yet. */
export const notLookedAt = (photos: readonly LibraryPhoto[]): LibraryPhoto[] =>
  photos.filter(
    (photo) => !photo.faces && photo.deleted_ms === null && !photo.mime.startsWith("video/"),
  );

/**
 * How to place a picture `width` by `height` in a square so that a face fills about 70% of it: the
 * image's box as percentages of the square, with the square's edge kept inside the picture.
 */
export function faceCrop(
  face: Pick<PhotoFace, "x" | "y" | "width" | "height">,
  width: number,
  height: number,
) {
  const faceSide = Math.max(face.width * width, face.height * height);
  const side = Math.min(faceSide / 0.7, width, height);
  const left = Math.min(width - side, Math.max(0, (face.x + face.width / 2) * width - side / 2));
  const top = Math.min(height - side, Math.max(0, (face.y + face.height / 2) * height - side / 2));
  const percent = (value: number) => `${(value / side) * 100}%`;
  return {
    width: percent(width),
    height: percent(height),
    left: percent(-left),
    top: percent(-top),
  };
}
