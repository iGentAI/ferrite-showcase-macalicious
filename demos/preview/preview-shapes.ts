/*
 * The shapes Preview keeps as a line through points: a star, a polygon and a speech bubble, and what
 * a hand-drawn line is tidied into. The desktop keeps such a shape as a `sketch`, which a fill can
 * fill when it closes.
 */

import {
  clampPoint,
  type Mark,
  type MarkStyle,
  newMarkId,
  type Point,
  polygonIn,
  shapeBetween,
} from "./preview-markup";

export type OutlineKind = "star" | "polygon" | "bubble";

const POLYGON_START = 6;

/** Points around a unit circle, from the top, `radius` asking how far out each one stands. */
const around = (count: number, radius: (index: number) => number): Point[] =>
  Array.from({ length: count + 1 }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const out = radius(index % count);
    return [0.5 + 0.5 * out * Math.cos(angle), 0.5 + 0.5 * out * Math.sin(angle)];
  });

/** A corner's quarter circle, sampled, about (cx, cy), from `start` turns of a circle. */
const corner = (cx: number, cy: number, rx: number, ry: number, start: number): Point[] =>
  Array.from({ length: 6 }, (_, index) => {
    const angle = ((start + index / 5) * Math.PI) / 2;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });

/** A rounded box over the top of the unit square, with its tail down at the left. */
function bubble(): Point[] {
  const rx = 0.14;
  const ry = 0.16;
  const foot = 0.78;
  return [
    ...corner(rx, ry, rx, ry, 2),
    ...corner(1 - rx, ry, rx, ry, 3),
    ...corner(1 - rx, foot - ry, rx, ry, 0),
    [0.34, foot],
    [0.14, 1],
    [0.2, foot],
    ...corner(rx, foot - ry, rx, ry, 1),
    [0, ry],
  ];
}

const OUTLINES: Record<OutlineKind, () => Point[]> = {
  star: () => around(10, (index) => (index % 2 === 0 ? 1 : 0.382)),
  polygon: () => polygonIn(POLYGON_START, { x: 0, y: 0, w: 1, h: 1 }),
  bubble,
};

/** A shape of `kind` filling the box between two corners, in page space. */
export function outlineBetween(
  kind: OutlineKind,
  from: Point,
  to: Point,
  { arrow_ends: _ends, ...style }: MarkStyle,
): Mark {
  const x = Math.min(from[0], to[0]);
  const y = Math.min(from[1], to[1]);
  const w = Math.abs(to[0] - from[0]);
  const h = Math.abs(to[1] - from[1]);
  return {
    id: newMarkId(),
    kind: "sketch",
    ...style,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    points: OUTLINES[kind]().map(([u, v]) => clampPoint([x + u * w, y + v * h])),
    ...(kind === "polygon" ? { sides: POLYGON_START } : {}),
    ...(kind === "bubble" ? { bubble: true as const } : {}),
  };
}

const mean = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

/**
 * What a hand-drawn line of `points` was meant to be: a straight line, a rectangle or an oval, or
 * `null` when it is none of them. `aspect` is the page's height over its width, so that the line is
 * judged as the person saw it.
 */
export function cleanedSketch(
  points: readonly Point[],
  aspect: number,
  style: { color: string; stroke: number },
): Mark | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 5) return null;
  const shown = points.map(([x, y]) => [x, y * aspect] as const);
  const xs = shown.map(([x]) => x);
  const ys = shown.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const across = Math.max(right - left, bottom - top);
  if (across < 0.02) return null;
  const [ax, ay] = shown[0] as readonly [number, number];
  const [bx, by] = shown[shown.length - 1] as readonly [number, number];
  const chord = Math.hypot(bx - ax, by - ay);
  if (chord > 0) {
    const off = Math.max(
      ...shown.map(([x, y]) => Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / chord),
    );
    if (off < chord * 0.04) return shapeBetween("line", first, last, style);
  }
  if (chord > across * 0.2) return null;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const a = Math.max((right - left) / 2, 1e-6);
  const b = Math.max((bottom - top) / 2, 1e-6);
  const ovalMiss = mean(
    shown.map(([x, y]) => Math.abs(Math.hypot((x - cx) / a, (y - cy) / b) - 1)),
  );
  const boxMiss = mean(
    shown.map(([x, y]) => Math.abs(Math.max(Math.abs((x - cx) / a), Math.abs((y - cy) / b)) - 1)),
  );
  if (Math.min(ovalMiss, boxMiss) > 0.1) return null;
  return shapeBetween(
    boxMiss < ovalMiss ? "rect" : "oval",
    [left, top / aspect],
    [right, bottom / aspect],
    style,
  );
}
