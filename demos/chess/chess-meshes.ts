import type { ChessPieceKind } from "./chess-game";

/*
 * The 3D pieces: original shapes, turned on a lathe from profiles written here, in units of one
 * square, with the board at z = 0 and z going up. A mesh is triangles of position and normal.
 */

type Point = readonly [number, number, number];
type Profile = readonly (readonly [number, number])[];

/** Rounds a line of points by cutting its corners, keeping both ends. */
function rounded<T extends readonly number[]>(points: readonly T[], passes = 1): readonly T[] {
  let line = points;
  for (let pass = 0; pass < passes; pass++) {
    const next: T[] = [line[0] as T];
    for (let index = 0; index < line.length - 1; index++) {
      const a = line[index] as T;
      const b = line[index + 1] as T;
      next.push(a.map((value, at) => value * 0.75 + (b[at] as number) * 0.25) as unknown as T);
      next.push(a.map((value, at) => value * 0.25 + (b[at] as number) * 0.75) as unknown as T);
    }
    next.push(line[line.length - 1] as T);
    line = next;
  }
  return line;
}

const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

interface Out {
  readonly vertices: number[];
  readonly indices: number[];
}

/** Triangles of position and normal, sharing their corners. */
export interface Mesh {
  readonly vertices: Float32Array;
  readonly indices: Uint16Array;
}

const finished = (build: (out: Out) => void): Mesh => {
  const out: Out = { vertices: [], indices: [] };
  build(out);
  return { vertices: new Float32Array(out.vertices), indices: new Uint16Array(out.indices) };
};

/** A surface over rows and columns that wrap around: each normal comes from its neighbours. */
function surface(out: Out, rows: number, cols: number, at: (row: number, col: number) => Point) {
  const normal = (row: number, col: number): Point => {
    const around = minus(at(row, (col + 1) % cols), at(row, (col + cols - 1) % cols));
    const along = minus(at(Math.min(row + 1, rows - 1), col), at(Math.max(row - 1, 0), col));
    const n: Point = [
      around[1] * along[2] - around[2] * along[1],
      around[2] * along[0] - around[0] * along[2],
      around[0] * along[1] - around[1] * along[0],
    ];
    const length = Math.hypot(...n);
    // The two ends of a surface close to a point, which has no neighbours around it.
    if (length < 1e-6) return [0, 0, row === 0 ? -1 : 1];
    return [n[0] / length, n[1] / length, n[2] / length];
  };
  const base = out.vertices.length / 6;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      out.vertices.push(...at(row, col), ...normal(row, col));
    }
  }
  for (let row = 0; row < rows - 1; row++) {
    const here = base + row * cols;
    for (let col = 0; col < cols; col++) {
      const next = (col + 1) % cols;
      out.indices.push(here + col, here + next, here + cols + next);
      out.indices.push(here + col, here + cols + next, here + cols + col);
    }
  }
}

/** A profile of radius and height turned around the z axis; `shape` may cut into it by angle. */
function lathe(
  out: Out,
  profile: Profile,
  shape?: (radius: number, height: number, angle: number) => readonly [number, number],
  cols = 24,
) {
  const line = rounded(profile);
  surface(out, line.length, cols, (row, col) => {
    const angle = (col / cols) * Math.PI * 2;
    const [r, z] = line[row] as readonly [number, number];
    const [radius, height] = shape ? shape(r, z, angle) : [r, z];
    return [radius * Math.cos(angle), radius * Math.sin(angle), height];
  });
}

/** The points of a ball standing on a stem, from `start` degrees below its middle to its top. */
const ball = (centre: number, radius: number, start = -65): Profile =>
  Array.from({ length: 7 }, (_, step) => {
    const angle = ((start + ((90 - start) * step) / 6) * Math.PI) / 180;
    return [radius * Math.cos(angle), centre + radius * Math.sin(angle)] as const;
  });

/** A body swept along a line in the plane of x and z, as across a neck: x, z, depth, width. */
function sweep(out: Out, rings: readonly (readonly [number, number, number, number])[]) {
  const line = rounded(rings);
  const cols = 20;
  surface(out, line.length, cols, (row, col) => {
    const [x, z, depth, width] = line[row] as readonly [number, number, number, number];
    const before = line[Math.max(row - 1, 0)] as readonly number[];
    const after = line[Math.min(row + 1, line.length - 1)] as readonly number[];
    const tx = (after[0] as number) - (before[0] as number);
    const tz = (after[1] as number) - (before[1] as number);
    const length = Math.hypot(tx, tz) || 1;
    const angle = (col / cols) * Math.PI * 2;
    const across = depth * Math.cos(angle);
    return [x + (tz / length) * across, width * Math.sin(angle), z - (tx / length) * across];
  });
}

/** A box between two corners, with flat sides; `open` leaves out its top and bottom. */
function box(out: Out, low: Point, high: Point, open = false) {
  const face = (normal: Point, a: Point, b: Point, c: Point, d: Point) => {
    const base = out.vertices.length / 6;
    for (const point of [a, b, c, d]) out.vertices.push(...point, ...normal);
    out.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const [x0, y0, z0] = low;
  const [x1, y1, z1] = high;
  face([1, 0, 0], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
  face([-1, 0, 0], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]);
  face([0, 1, 0], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
  face([0, -1, 0], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  if (open) return;
  face([0, 0, 1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  face([0, 0, -1], [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]);
}

const FOOT = (radius: number): Profile => [
  [0, 0],
  [radius - 0.02, 0],
  [radius, 0.03],
  [radius, 0.07],
  [radius - 0.04, 0.09],
  [radius - 0.05, 0.12],
  [radius - 0.13, 0.15],
];

const BUILT: Readonly<Record<ChessPieceKind, (out: Out) => void>> = {
  pawn: (out) =>
    lathe(out, [
      ...FOOT(0.33),
      [0.13, 0.26],
      [0.09, 0.4],
      [0.09, 0.44],
      [0.17, 0.46],
      [0.17, 0.48],
      [0.09, 0.51],
      ...ball(0.62, 0.14),
    ]),
  rook: (out) =>
    lathe(
      out,
      [
        ...FOOT(0.37),
        [0.2, 0.3],
        [0.19, 0.55],
        [0.27, 0.62],
        [0.27, 0.66],
        [0.25, 0.68],
        [0.28, 0.88],
        [0.28, 0.88],
        [0.19, 0.88],
        [0.19, 0.88],
        [0.19, 0.77],
        [0.19, 0.77],
        [0, 0.77],
      ],
      (radius, height, angle) => {
        const notch = Math.min(1, Math.max(0, Math.cos(angle * 6) * 5 + 1));
        return [radius, height > 0.79 ? height - (height - 0.79) * notch : height];
      },
      48,
    ),
  bishop: (out) =>
    lathe(
      out,
      [
        ...FOOT(0.36),
        [0.14, 0.3],
        [0.09, 0.56],
        [0.09, 0.6],
        [0.18, 0.63],
        [0.18, 0.65],
        [0.1, 0.69],
        [0.17, 0.78],
        [0.18, 0.86],
        [0.12, 0.98],
        [0.05, 1.05],
        ...ball(1.09, 0.055, -40),
      ],
      (radius, height, angle) => {
        const groove = Math.exp(-(((angle - 0.8) / 0.12) ** 2));
        return [height > 0.82 && height < 1.03 ? radius * (1 - 0.55 * groove) : radius, height];
      },
      48,
    ),
  queen: (out) =>
    lathe(
      out,
      [
        ...FOOT(0.41),
        [0.17, 0.32],
        [0.1, 0.66],
        [0.1, 0.72],
        [0.2, 0.75],
        [0.2, 0.77],
        [0.11, 0.81],
        [0.15, 0.98],
        [0.24, 1.14],
        [0.24, 1.14],
        [0.14, 1.12],
        [0.1, 1.16],
        [0.05, 1.24],
        ...ball(1.29, 0.065, -40),
      ],
      (radius, height, angle) => [
        radius,
        height > 1.04 && height < 1.16 && radius > 0.16
          ? height + (height - 1.04) * 0.45 * Math.cos(angle * 8)
          : height,
      ],
      48,
    ),
  king: (out) => {
    lathe(out, [
      ...FOOT(0.42),
      [0.18, 0.34],
      [0.11, 0.7],
      [0.11, 0.76],
      [0.21, 0.79],
      [0.21, 0.81],
      [0.12, 0.85],
      [0.16, 1.02],
      [0.23, 1.14],
      [0.23, 1.17],
      [0.17, 1.2],
      [0.09, 1.27],
      [0.04, 1.3],
      [0, 1.31],
    ]);
    box(out, [-0.028, -0.028, 1.27], [0.028, 0.028, 1.55]);
    box(out, [-0.1, -0.028, 1.39], [0.1, 0.028, 1.45]);
  },
  // Faces along +x: a neck that rises from the foot and bends over into the muzzle.
  knight: (out) => {
    lathe(out, [...FOOT(0.36), [0.2, 0.26], [0.16, 0.32], [0, 0.34]]);
    sweep(out, [
      [-0.03, 0.18, 0, 0],
      [-0.03, 0.2, 0.25, 0.17],
      [-0.05, 0.42, 0.2, 0.15],
      [-0.05, 0.62, 0.19, 0.12],
      [-0.02, 0.8, 0.17, 0.105],
      [0.06, 0.93, 0.15, 0.1],
      [0.17, 0.95, 0.12, 0.085],
      [0.28, 0.88, 0.09, 0.07],
      [0.37, 0.8, 0.07, 0.055],
      [0.4, 0.76, 0.02, 0.02],
      [0.405, 0.75, 0, 0],
    ]);
    // The mane, a thin crest down the back of the neck.
    sweep(out, [
      [-0.21, 0.36, 0, 0],
      [-0.22, 0.4, 0.04, 0.03],
      [-0.22, 0.66, 0.05, 0.03],
      [-0.15, 0.92, 0.05, 0.03],
      [-0.02, 1.05, 0.04, 0.025],
      [0.02, 1.08, 0, 0],
    ]);
    // Two ears.
    for (const side of [-0.055, 0.055]) {
      const start = out.vertices.length;
      lathe(
        out,
        [
          [0, 0.96],
          [0.035, 0.98],
          [0.02, 1.08],
          [0, 1.15],
        ],
        undefined,
        10,
      );
      for (let at = start; at < out.vertices.length; at += 6) {
        out.vertices[at] = (out.vertices[at] as number) + 0.07;
        out.vertices[at + 1] = (out.vertices[at + 1] as number) + side;
      }
    }
  },
};

/** The sides of the frame under the board, for a board one unit wide with its top at z = 0. */
export const FRAME_THICKNESS = 0.035;

export const frameMesh = (): Mesh =>
  finished((out) => box(out, [-0.5, -0.5, -FRAME_THICKNESS], [0.5, 0.5, 0], true));

/** A flat square from -1 to 1, on which a shadow is drawn. */
export const discMesh = (): Mesh => ({
  vertices: new Float32Array([
    -1, -1, 0, 0, 0, 1, 1, -1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, -1, 1, 0, 0, 0, 1,
  ]),
  indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
});

export const pieceMesh = (kind: ChessPieceKind): Mesh => finished(BUILT[kind]);
