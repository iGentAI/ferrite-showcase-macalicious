import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { FACE_MODEL_SIDE, faceDetector } from "../photo-booth/photo-booth-face-model";

const vendor = `${process.cwd()}/demos/photo-booth/vendor/`;
const model = readFileSync(`${vendor}blaze_face_short_range.tflite`);
const portrait = readFileSync(`${vendor}face-fixture.jpg`);

/** The picture letterboxed on black in the model's square, as `detectFaces` draws it. */
const squareOf = async (picture: ReturnType<typeof sharp>) => {
  const { data } = await picture
    .clone()
    .resize(FACE_MODEL_SIDE, FACE_MODEL_SIDE, { fit: "contain", background: "#000" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8ClampedArray(data);
};

describe("the face detector", () => {
  const detect = faceDetector(model);

  it("finds the one face of a portrait, its features in their places", async () => {
    const picture = sharp(portrait);
    const { width = 0, height = 0 } = await picture.metadata();
    const faces = detect(await squareOf(picture), width, height);
    expect(faces).toHaveLength(1);
    const [face] = faces;
    if (!face) return;
    expect(face.score).toBeGreaterThan(0.75);
    const { rightEye, leftEye, nose, mouth } = face.landmarks;
    expect(rightEye.x).toBeLessThan(leftEye.x);
    expect(Math.max(rightEye.y, leftEye.y)).toBeLessThan(nose.y);
    expect(nose.y).toBeLessThan(mouth.y);
    for (const p of [rightEye, leftEye, nose, mouth]) {
      expect(p.x).toBeGreaterThan(face.x);
      expect(p.x).toBeLessThan(face.x + face.width);
      expect(p.y).toBeGreaterThan(face.y);
      expect(p.y).toBeLessThan(face.y + face.height);
    }
  });

  it("follows the face when it moves in the frame", async () => {
    const fitted = await sharp(portrait).resize({ height: 500 }).toBuffer();
    const at = async (left: number) => {
      const placed = await sharp({
        create: { width: 800, height: 500, channels: 3, background: "#888" },
      })
        .composite([{ input: fitted, left, top: 0 }])
        .png()
        .toBuffer();
      const faces = detect(await squareOf(sharp(placed)), 800, 500);
      expect(faces).toHaveLength(1);
      return faces[0]?.landmarks.nose.x ?? 0;
    };
    const [near, far] = [await at(0), await at(300)];
    // Three hundred pixels of eight hundred.
    expect(far - near).toBeCloseTo(0.375, 1);
  });

  it("finds no face in a picture of none", async () => {
    const faces = detect(
      new Uint8ClampedArray(FACE_MODEL_SIDE * FACE_MODEL_SIDE * 4).fill(128),
      FACE_MODEL_SIDE,
      FACE_MODEL_SIDE,
    );
    expect(faces).toEqual([]);
  });
});
