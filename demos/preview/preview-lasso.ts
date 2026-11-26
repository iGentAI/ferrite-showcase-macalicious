/*
 * Smart Lasso: a loop drawn roughly around something in a picture is drawn in to that thing's edge.
 * Each stretch of the loop looks across a band for where the picture changes most sharply, and goes
 * there. A stretch with no edge in its band stays where it was drawn.
 */

import type { Point } from "./preview-markup";

/** How far a loop looks to each side, as a share of the picture's longer side. */
const BAND = 0.04;
/** The places along a loop that look for an edge. */
const PLACES = 160;
/** How sharp a change of light, out of 255 between neighbours, counts as an edge. */
const EDGE = 24;

/** The light of each pixel of RGBA `pixels`, the weights being those of a television's. */
function lightOf(pixels: Uint8ClampedArray, width: number, height: number): Float32Array {
  const light = new Float32Array(width * height);
  for (let index = 0; index < light.length; index += 1) {
    const at = index * 4;
    light[index] =
      0.299 * (pixels[at] ?? 0) + 0.587 * (pixels[at + 1] ?? 0) + 0.114 * (pixels[at + 2] ?? 0);
  }
  return light;
}

/** How sharply the light changes at each pixel. */
function edgesOf(light: Float32Array, width: number, height: number): Float32Array {
  const edges = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const at = y * width + x;
      const across = (light[at + 1] ?? 0) - (light[at - 1] ?? 0);
      const down = (light[at + width] ?? 0) - (light[at - width] ?? 0);
      edges[at] = Math.hypot(across, down) / 2;
    }
  }
  return edges;
}

/** `loop`, closed, at `count` places evenly along it. */
function evenly(loop: readonly Point[], count: number): Point[] {
  const closed = [...loop, loop[0] as Point];
  const lengths = [0];
  for (let index = 1; index < closed.length; index += 1) {
    const a = closed[index - 1] as Point;
    const b = closed[index] as Point;
    lengths.push((lengths[index - 1] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lengths.at(-1) ?? 0;
  if (total === 0) return [loop[0] as Point];
  const places: Point[] = [];
  let segment = 1;
  for (let step = 0; step < count; step += 1) {
    const wanted = (step / count) * total;
    while (segment < closed.length - 1 && (lengths[segment] ?? 0) < wanted) segment += 1;
    const a = closed[segment - 1] as Point;
    const b = closed[segment] as Point;
    const from = lengths[segment - 1] ?? 0;
    const part = (lengths[segment] ?? 0) - from;
    const share = part > 0 ? (wanted - from) / part : 0;
    places.push([a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share]);
  }
  return places;
}

/**
 * The loop `points`, in fractions of a picture, drawn in to the picture's edges: `pixels` is the
 * picture's RGBA, `width` × `height`. Each place keeps to the strongest edge within the band, and a
 * place between two is smoothed with them, so that one stray edge makes no spike.
 */
export function smartOutline(
  points: readonly Point[],
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Point[] {
  if (points.length < 3 || width < 3 || height < 3) return [...points];
  const edges = edgesOf(lightOf(pixels, width, height), width, height);
  const band = Math.max(2, Math.round(Math.max(width, height) * BAND));
  const places = evenly(points, PLACES).map(([x, y]): Point => [x * width, y * height]);
  const count = places.length;
  const snapped = places.map(([x, y], index) => {
    const before = places[(index - 2 + count) % count] as Point;
    const after = places[(index + 2) % count] as Point;
    const tx = after[0] - before[0];
    const ty = after[1] - before[1];
    const length = Math.hypot(tx, ty) || 1;
    // Across the line of the loop, to either side of it.
    const nx = -ty / length;
    const ny = tx / length;
    let best: Point = [x, y];
    let strongest = EDGE;
    for (let offset = -band; offset <= band; offset += 1) {
      const px = Math.round(x + nx * offset);
      const py = Math.round(y + ny * offset);
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const edge = edges[py * width + px] ?? 0;
      if (edge > strongest) {
        strongest = edge;
        best = [px, py];
      }
    }
    return best;
  });
  return snapped.map((point, index) => {
    const a = snapped[(index - 1 + count) % count] as Point;
    const b = snapped[(index + 1) % count] as Point;
    return [(a[0] + point[0] * 2 + b[0]) / 4 / width, (a[1] + point[1] * 2 + b[1]) / 4 / height];
  });
}
