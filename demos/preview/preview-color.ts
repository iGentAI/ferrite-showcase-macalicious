/*
 * Tools > Adjust Color: what the sliders hold, and what they do to a picture's pixels. Every value
 * but `sepia` runs from -1 to 1 with 0 leaving the picture alone; `sepia` runs from 0 to 1.
 */

export interface ColorAdjust {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  temperature: number;
  tint: number;
  sepia: number;
  sharpness: number;
}

export const NO_ADJUST: ColorAdjust = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  sepia: 0,
  sharpness: 0,
};

export const isNeutral = (adjust: ColorAdjust): boolean =>
  Object.values(adjust).every((value) => value === 0);

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Applies `adjust` to `pixels` (RGBA, a row at a time, as a canvas holds them), in place. */
export function adjustPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  adjust: ColorAdjust,
): void {
  const gain = 2 ** (adjust.exposure * 2);
  for (let at = 0; at < pixels.length; at += 4) {
    let r = ((pixels[at] ?? 0) / 255) * gain;
    let g = ((pixels[at + 1] ?? 0) / 255) * gain;
    let b = ((pixels[at + 2] ?? 0) / 255) * gain;
    const stretch = 1 + adjust.contrast;
    r = (r - 0.5) * stretch + 0.5;
    g = (g - 0.5) * stretch + 0.5;
    b = (b - 0.5) * stretch + 0.5;
    const light = luminance(r, g, b);
    const lift =
      adjust.highlights * Math.max(0, light - 0.5) + adjust.shadows * Math.max(0, 0.5 - light);
    r += lift;
    g += lift;
    b += lift;
    const grey = luminance(r, g, b);
    const colorful = 1 + adjust.saturation;
    r = grey + (r - grey) * colorful + adjust.temperature * 0.2 + adjust.tint * 0.1;
    g = grey + (g - grey) * colorful - adjust.tint * 0.2;
    b = grey + (b - grey) * colorful - adjust.temperature * 0.2 + adjust.tint * 0.1;
    if (adjust.sepia > 0) {
      const brown = [
        0.393 * r + 0.769 * g + 0.189 * b,
        0.349 * r + 0.686 * g + 0.168 * b,
        0.272 * r + 0.534 * g + 0.131 * b,
      ] as const;
      r += (brown[0] - r) * adjust.sepia;
      g += (brown[1] - g) * adjust.sepia;
      b += (brown[2] - b) * adjust.sepia;
    }
    pixels[at] = r * 255;
    pixels[at + 1] = g * 255;
    pixels[at + 2] = b * 255;
  }
  if (adjust.sharpness !== 0) sharpen(pixels, width, height, adjust.sharpness);
}

/** Moves each inner pixel away from (sharper) or towards (softer) its four neighbours. */
function sharpen(pixels: Uint8ClampedArray, width: number, height: number, amount: number) {
  const before = pixels.slice();
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const here = before[at + channel] ?? 0;
        const around =
          (before[at + channel - 4] ?? 0) +
          (before[at + channel + 4] ?? 0) +
          (before[at + channel - width * 4] ?? 0) +
          (before[at + channel + width * 4] ?? 0);
        pixels[at + channel] = here + (here - around / 4) * amount;
      }
    }
  }
}

/** The picture on `canvas` with `adjust` applied to what is drawn on it so far. */
export function adjustCanvas(
  context: CanvasRenderingContext2D,
  canvas: { width: number; height: number },
  adjust: ColorAdjust,
): void {
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  adjustPixels(image.data, canvas.width, canvas.height, adjust);
  context.putImageData(image, 0, 0);
}

/** How many bars the panel's levels are drawn with. */
const LEVELS = 32;

/** How much of the picture stands at each level of light, the fullest level being 1. */
export function levelsOf(pixels: Uint8ClampedArray): number[] {
  const counts = new Array<number>(LEVELS).fill(0);
  for (let at = 0; at < pixels.length; at += 4) {
    const light = luminance(pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0);
    const level = Math.min(LEVELS - 1, Math.floor((light / 256) * LEVELS));
    counts[level] = (counts[level] ?? 0) + 1;
  }
  const most = Math.max(1, ...counts);
  return counts.map((count) => count / most);
}

/**
 * Auto Levels: the exposure and contrast that spread the picture's light from its darkest percent
 * to its lightest over the whole range. A picture of one level is left as it is.
 */
export function autoLevels(pixels: Uint8ClampedArray): Pick<ColorAdjust, "exposure" | "contrast"> {
  const lights: number[] = [];
  for (let at = 0; at < pixels.length; at += 4) {
    lights.push(luminance(pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0) / 255);
  }
  lights.sort((a, b) => a - b);
  const low = lights[Math.floor(lights.length * 0.01)] ?? 0;
  const high = lights[Math.ceil(lights.length * 0.99) - 1] ?? 1;
  if (high - low < 1e-3) return { exposure: 0, contrast: 0 };
  const middle = (low + high) / 2;
  return {
    exposure: clamp(Math.log2(0.5 / Math.max(middle, 0.01)) / 2, -1, 1),
    contrast: clamp(1 / (high - low) - 1, -1, 1),
  };
}
