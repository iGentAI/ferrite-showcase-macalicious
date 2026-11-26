import { describe, expect, it } from "vitest";
import type { ChessPieceKind } from "./chess-game";
import { pieceMesh } from "./chess-meshes";
import {
  boardTransform,
  boundCamera,
  DEFAULT_CAMERA,
  layOutBoard,
  onStage,
  pointOnBoard,
  readCamera,
} from "./chess-scene";

describe("the 3D board's camera", () => {
  it("fits the board in the view, from straight above", () => {
    const layout = layOutBoard(1000, 1000, { tilt: 0, spin: 0 });
    expect(layout.side).toBeCloseTo(909.9, 0);
    expect(layout.dx).toBeCloseTo(0, 6);
    expect(layout.dy).toBeCloseTo(0, 6);
    expect(layout.square).toBeCloseTo((909.9 * 0.85) / 8, 0);
  });

  it("leans the near edge wider than the far one, as the application's does", () => {
    const layout = layOutBoard(971, 628, DEFAULT_CAMERA);
    const half = layout.side / 2;
    const nearWidth = onStage(layout, half, half)[0] - onStage(layout, -half, half)[0];
    const farWidth = onStage(layout, half, -half)[0] - onStage(layout, -half, -half)[0];
    // In the capture the near edge is 680 pt wide and the far edge 588.
    expect(farWidth / nearWidth).toBeCloseTo(588 / 680, 1);
    expect(onStage(layout, 0, half)[1]).toBeGreaterThan(onStage(layout, 0, -half)[1]);
  });

  it.each([
    [28, 0],
    [55, 40],
    [0, 200],
    [70, 333],
  ])("finds the point under the pointer at tilt %d and spin %d", (tilt, spin) => {
    const layout = layOutBoard(800, 600, { tilt, spin });
    const [x, y] = pointOnBoard(layout, ...onStage(layout, 111, -64));
    expect(x).toBeCloseTo(111, 6);
    expect(y).toBeCloseTo(-64, 6);
  });

  it("writes the transform the canvas draws by", () => {
    const layout = layOutBoard(800, 600, { tilt: 30, spin: 90 });
    expect(boardTransform(layout)).toBe(
      `translate(${layout.dx}px, ${layout.dy}px) perspective(${layout.side * 3.25}px) rotateX(${Math.PI / 6}rad) rotateZ(${Math.PI / 2}rad)`,
    );
  });

  it("keeps the camera within its limits, and reads back only a camera", () => {
    expect(boundCamera({ tilt: 99, spin: -90 })).toEqual({ tilt: 70, spin: 270 });
    expect(boundCamera({ tilt: -4, spin: 400 })).toEqual({ tilt: 0, spin: 40 });
    expect(readCamera({ tilt: 30, spin: 10 })).toEqual({ tilt: 30, spin: 10 });
    expect(readCamera({ tilt: "30" })).toBeUndefined();
    expect(readCamera(null)).toBeUndefined();
  });
});

describe("the turned pieces", () => {
  const top = (kind: ChessPieceKind) => {
    const mesh = pieceMesh(kind).vertices;
    let z = 0;
    for (let at = 2; at < mesh.length; at += 6) z = Math.max(z, mesh[at] as number);
    return z;
  };

  it("stand in order of height on the board", () => {
    expect(top("pawn")).toBeCloseTo(0.76, 1);
    expect(top("pawn")).toBeLessThan(top("rook"));
    expect(top("rook")).toBeLessThan(top("bishop"));
    expect(top("bishop")).toBeLessThan(top("queen"));
    expect(top("queen")).toBeLessThan(top("king"));
    expect(top("king")).toBeCloseTo(1.55, 2);
  });

  it("fit on a square and have whole normals", () => {
    for (const kind of ["pawn", "rook", "knight", "bishop", "queen", "king"] as const) {
      const { vertices: mesh, indices } = pieceMesh(kind);
      expect(indices.length % 3).toBe(0);
      expect(mesh.length).toBeLessThan(6 * 65536);
      expect(Math.max(...indices)).toBe(mesh.length / 6 - 1);
      for (let at = 0; at < mesh.length; at += 6) {
        expect(Math.hypot(mesh[at] as number, mesh[at + 1] as number)).toBeLessThan(0.5);
        expect(mesh[at + 2]).toBeGreaterThanOrEqual(0);
        expect(
          Math.hypot(mesh[at + 3] as number, mesh[at + 4] as number, mesh[at + 5] as number),
        ).toBeCloseTo(1, 3);
      }
    }
  });
});
