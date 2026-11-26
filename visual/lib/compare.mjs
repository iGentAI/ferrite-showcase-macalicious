import pixelmatch from "pixelmatch";
import sharp from "sharp";
import { referencePath } from "./paths.mjs";
import { DEFAULT_PIXEL_TOLERANCE, DEFAULT_THRESHOLD, maskPixels } from "./spec.mjs";

/**
 * Per-pixel colour distance (pixelmatch's YIQ metric, 0..1) above which a pixel counts as
 * mismatched, unless the comparison sets its own `threshold`. 0.1 is pixelmatch's default: it
 * ignores differences a viewer cannot see at a glance and still catches a one-step change of a
 * border colour. A comparison of a bezel alone should lower it to 0.05, where a half-point
 * change of a corner radius or a hairline's alpha shows.
 */
export const PIXEL_THRESHOLD = DEFAULT_THRESHOLD;

async function toRaw(image) {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Average every factor x factor block of an RGBA buffer into one pixel: what a display with
 * `factor` times fewer pixels per point would show of the same picture. Done on the raw buffer
 * because a resampling kernel is not a block average: sharp's `linear` kernel turns a row of
 * 0 255 255 0 into 32 191 instead of 128 128.
 */
export function averageBlocks({ data, width, height }, factor) {
  const outWidth = width / factor;
  const outHeight = height / factor;
  if (!Number.isInteger(outWidth) || !Number.isInteger(outHeight)) {
    throw new Error(`${width}x${height} is not a multiple of ${factor}`);
  }
  const out = Buffer.alloc(outWidth * outHeight * 4);
  const count = factor * factor;
  for (let y = 0; y < outHeight; y++) {
    for (let x = 0; x < outWidth; x++) {
      for (let channel = 0; channel < 4; channel++) {
        let sum = 0;
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            sum += data[((y * factor + dy) * width + x * factor + dx) * 4 + channel];
          }
        }
        out[(y * outWidth + x) * 4 + channel] = Math.round(sum / count);
      }
    }
  }
  return { data: out, width: outWidth, height: outHeight };
}

/**
 * Crop the reference screenshot and bring it to `scale` device pixels per point.
 *
 * sharp converts from the screenshot's embedded display profile to sRGB while decoding, which
 * is what makes reference pixels comparable to a browser capture. Do not read the PNGs with a
 * tool that ignores the ICC profile.
 */
export async function loadReferenceCrop(reference, scale) {
  const refScale = reference.scale ?? 2;
  const { x, y, width, height } = reference.crop;
  const cropped = await sharp(referencePath(reference.file))
    .extract({ left: x, top: y, width, height })
    .flatten({ background: reference.matte ?? "#ffffff" })
    .png()
    .toBuffer();
  if (scale === refScale) return toRaw(sharp(cropped));
  // 2x -> 1x: there is no 1x screenshot, so each 2x2 block is averaged, the closest stand-in
  // for a capture that does not exist.
  if (scale < refScale) return averageBlocks(await toRaw(sharp(cropped)), refScale / scale);
  // 1x -> 2x keeps hard pixels.
  const target = { width: (width / refScale) * scale, height: (height / refScale) * scale };
  return toRaw(sharp(cropped).resize({ ...target, kernel: "nearest", fit: "fill" }));
}

/**
 * The top-left width x height pixels of an image, always as a new buffer: the comparison paints
 * its masks into what this returns, and must not paint them into the caller's image.
 */
function cropRaw(raw, width, height) {
  if (raw.width === width && raw.height === height) return Buffer.from(raw.data);
  const out = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    raw.data.copy(out, row * width * 4, row * raw.width * 4, row * raw.width * 4 + width * 4);
  }
  return out;
}

/** Masked pixels in the diff image: a colour pixelmatch does not draw. */
const MASK_COLOR = [255, 0, 255, 255];

const encode = (data, width, height) =>
  sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

/**
 * Compare a browser capture (PNG buffer) with a reference crop (raw RGBA).
 *
 * mismatch   fraction of compared pixels whose colour distance exceeds the threshold
 * meanDelta  mean absolute difference per colour channel, 0..255, over compared pixels
 *
 * When the sizes differ the top-left overlap is compared and sizeMismatch is reported; a size
 * mismatch always fails, because a layout that is the wrong size is not a match.
 *
 * `expected` is not changed, and actualPng and expectedPng are the capture and the crop as
 * they are, whatever the masks; the masked pixels are painted magenta in diffPng.
 *
 * @param {Buffer} actualPng
 * @param {{ data: Buffer, width: number, height: number }} expected
 * @param {{ masks?: { x: number, y: number, width: number, height: number }[], scale?: number, threshold?: number }} [options]
 */
export async function compareImages(
  actualPng,
  expected,
  { masks = [], scale = 1, threshold = PIXEL_THRESHOLD } = {},
) {
  const actual = await toRaw(sharp(actualPng));
  const width = Math.min(actual.width, expected.width);
  const height = Math.min(actual.height, expected.height);
  const a = cropRaw(actual, width, height);
  const e = cropRaw(expected, width, height);

  // Masked pixels are made identical in both images, and leave the denominator.
  const masked = new Uint8Array(width * height);
  for (const mask of masks) {
    const [left, top, right, bottom] = maskPixels(mask, scale);
    const x0 = Math.max(0, left);
    const y0 = Math.max(0, top);
    const x1 = Math.min(width, right);
    const y1 = Math.min(height, bottom);
    for (let y = y0; y < y1; y++) masked.fill(1, y * width + x0, y * width + x1);
  }
  let maskedCount = 0;
  let deltaSum = 0;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (masked[i]) {
      maskedCount++;
      a[o] = e[o] = 255;
      a[o + 1] = e[o + 1] = 0;
      a[o + 2] = e[o + 2] = 255;
      a[o + 3] = e[o + 3] = 255;
    } else {
      deltaSum +=
        Math.abs(a[o] - e[o]) + Math.abs(a[o + 1] - e[o + 1]) + Math.abs(a[o + 2] - e[o + 2]);
    }
  }

  const diff = Buffer.alloc(width * height * 4);
  const mismatchedPixels = pixelmatch(a, e, diff, width, height, {
    threshold,
    includeAA: true,
    alpha: 0.25,
  });
  const comparedPixels = Math.max(1, width * height - maskedCount);
  for (let i = 0; i < width * height; i++) {
    if (masked[i]) diff.set(MASK_COLOR, i * 4);
  }

  return {
    width,
    height,
    threshold,
    actualSize: { width: actual.width, height: actual.height },
    expectedSize: { width: expected.width, height: expected.height },
    sizeMismatch: actual.width !== expected.width || actual.height !== expected.height,
    mismatchedPixels,
    comparedPixels,
    mismatch: mismatchedPixels / comparedPixels,
    meanDelta: deltaSum / (comparedPixels * 3),
    actualPng: await encode(actual.data, actual.width, actual.height),
    expectedPng: await encode(expected.data, expected.width, expected.height),
    diffPng: await encode(diff, width, height),
  };
}

const hex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/**
 * Check a browser capture against expected pixels, for a state no screenshot shows.
 *
 * `expect.size` is the size of the capture in points; each pixel is given in points from the
 * capture's top-left corner and is read at the device pixel that contains that point. A pixel
 * passes when every channel is within its tolerance of the expected colour. A pixel with a
 * `scale` is checked at that device scale only: a hairline is half a point, which only a 2x
 * capture can show.
 */
export async function checkExpectedPixels(actualPng, expect, scale) {
  const actual = await toRaw(sharp(actualPng));
  const expectedSize = expect.size
    ? {
        width: Math.round(expect.size.width * scale),
        height: Math.round(expect.size.height * scale),
      }
    : undefined;
  const sizeMismatch =
    expectedSize !== undefined &&
    (expectedSize.width !== actual.width || expectedSize.height !== actual.height);

  const pixels = expect.pixels
    .filter((pixel) => pixel.scale === undefined || pixel.scale === scale)
    .map((pixel) => {
      const x = Math.floor(pixel.x * scale);
      const y = Math.floor(pixel.y * scale);
      const tolerance = pixel.tolerance ?? DEFAULT_PIXEL_TOLERANCE;
      const want = [1, 3, 5].map((i) => Number.parseInt(pixel.color.slice(i, i + 2), 16));
      if (x >= actual.width || y >= actual.height) {
        return { ...pixel, tolerance, actual: null, delta: null, pass: false };
      }
      const o = (y * actual.width + x) * 4;
      const got = [actual.data[o], actual.data[o + 1], actual.data[o + 2]];
      const delta = Math.max(...got.map((value, i) => Math.abs(value - want[i])));
      return { ...pixel, tolerance, actual: hex(...got), delta, pass: delta <= tolerance };
    });

  return {
    actualSize: { width: actual.width, height: actual.height },
    expectedSize,
    sizeMismatch,
    pixels,
    failedPixels: pixels.filter((pixel) => !pixel.pass).length,
    actualPng: await encode(actual.data, actual.width, actual.height),
  };
}

/**
 * One image for quick review: expected | actual | diff, enlarged with hard pixels so that both
 * device scales come out the same size on screen.
 */
export async function compositeSheet(result, scale) {
  const zoom = Math.max(1, Math.round(8 / scale));
  const gap = 8;
  const panels = [result.expectedPng, result.actualPng, result.diffPng];
  const sizes = [
    result.expectedSize,
    result.actualSize,
    { width: result.width, height: result.height },
  ];
  const scaled = await Promise.all(
    panels.map((png, i) =>
      sharp(png)
        .resize({ width: sizes[i].width * zoom, height: sizes[i].height * zoom, kernel: "nearest" })
        .png()
        .toBuffer(),
    ),
  );
  const width = sizes.reduce((sum, s) => sum + s.width * zoom, 0) + gap * (panels.length + 1);
  const height = Math.max(...sizes.map((s) => s.height * zoom)) + gap * 2;
  let left = gap;
  const layers = scaled.map((input, i) => {
    const layer = { input, left, top: gap };
    left += sizes[i].width * zoom + gap;
    return layer;
  });
  return sharp({ create: { width, height, channels: 4, background: "#808080" } })
    .composite(layers)
    .png()
    .toBuffer();
}
