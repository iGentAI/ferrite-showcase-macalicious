"use client";

import { type Ref, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { CHESS_FILES, type ChessGame } from "./chess-game";
import {
  type BoardLayout,
  boardTransform,
  boundCamera,
  type ChessCamera,
  createScene,
  layOutBoard,
  pointOnBoard,
  type Scene,
  type ScenePiece,
} from "./chess-scene";

/** How the owner of the scene asks where a pointer lies on the grid of squares. */
export interface ChessSceneHandle {
  /** The point of the grid under a place on the screen, from its top left corner. */
  toGrid: (clientX: number, clientY: number) => { x: number; y: number };
}

/** How far a slid piece lifts, and how long a move and a turn of the board last. */
const HOP = 0.45;
const SLIDE_MS = 240;
const TURN_MS = 450;
/** How high the piece in the air is carried, in squares. */
const CARRIED = 0.35;
/** Degrees of camera for each point the pointer goes. */
const DRAG_DEGREES = 0.3;
/** Knights look a little aside of straight ahead, as a head is easier to read from an angle. */
const KNIGHT_ASIDE = 0.45;

const calm = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where a square's middle lies on the board, as the board now faces. */
function squarePoint(square: string, rotated: boolean, size: number): [number, number] {
  const file = CHESS_FILES.indexOf(square.charAt(0));
  const rank = Number(square.charAt(1)) - 1;
  const col = rotated ? 7 - file : file;
  const row = rotated ? rank : 7 - rank;
  return [(col - 3.5) * size, (row - 3.5) * size];
}

/**
 * The pieces of the 3D board on a canvas, which also lays the board's element (the grid of squares,
 * still in the page) under them by the same camera. A drag on the frame or the backdrop moves the
 * camera; `onCamera` gets where it ends. `dropped` holds the square a drag has just left a piece on,
 * which does not slide there again.
 */
export function ChessScene({
  ref,
  game,
  rotated,
  lifted,
  camera,
  onCamera,
  dropped,
}: {
  ref: Ref<ChessSceneHandle>;
  game: ChessGame;
  rotated: boolean;
  lifted: { from: string; x: number; y: number } | null;
  camera: ChessCamera;
  onCamera?: (camera: ChessCamera) => void;
  dropped: { current: string | null };
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const scene = useRef<Scene | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [held, setHeld] = useState<ChessCamera | null>(null);
  const shown = held ?? camera;
  // What is moving now, from 0 to 1: the piece of the last move, and a turn of the whole board.
  const motion = useRef<{ from?: string; to?: string; hop: number; turn: number }>({
    hop: 1,
    turn: 1,
  });
  const layout = useRef<BoardLayout | null>(null);
  const drawn = useRef("");

  const paint = () => {
    const view = canvas.current;
    const board = view?.parentElement?.querySelector<HTMLElement>(".mac-chess-board");
    if (!view || !board || !size || size.width <= 0 || size.height <= 0) return;
    const { hop, turn, from, to } = motion.current;
    const eased = 1 - (1 - turn) ** 3;
    const now = layOutBoard(size.width, size.height, {
      tilt: shown.tilt,
      spin: shown.spin + (1 - eased) * 180,
    });
    layout.current = now;
    board.style.setProperty("--_side", `${now.side}px`);
    board.style.transform = boardTransform(now);

    const pieces: ScenePiece[] = [];
    game.board.forEach((piece, index) => {
      if (!piece) return;
      const square = `${CHESS_FILES[index % 8]}${Math.floor(index / 8) + 1}`;
      let [x, y] = squarePoint(square, rotated, now.square);
      let z = 0;
      if (lifted?.from === square) {
        x = lifted.x - now.square * 4;
        y = lifted.y - now.square * 4;
        z = now.square * CARRIED;
      } else if (square === to && from && hop < 1) {
        const [startX, startY] = squarePoint(from, rotated, now.square);
        const along = hop * hop * (3 - 2 * hop);
        x = startX + (x - startX) * along;
        y = startY + (y - startY) * along;
        z = Math.sin(hop * Math.PI) * now.square * HOP;
      }
      const onward = piece.side === "white" ? -Math.PI / 2 : Math.PI / 2;
      const aside = (x < 0 ? 1 : -1) * (piece.side === "white" ? 1 : -1) * KNIGHT_ASIDE;
      pieces.push({
        kind: piece.kind,
        side: piece.side,
        x,
        y,
        z,
        heading: onward + aside + (rotated ? Math.PI : 0),
      });
    });
    const tokens = getComputedStyle(view);
    const colours = {
      white: tokens.getPropertyValue("--mac-chess-piece-white"),
      black: tokens.getPropertyValue("--mac-chess-piece-black"),
      frame: tokens.getPropertyValue("--mac-chess-frame"),
    };
    // Most renders of the window change nothing here, and a software renderer feels each draw.
    const picture = JSON.stringify([now, pieces, colours]);
    if (picture === drawn.current) return;
    drawn.current = picture;
    scene.current?.draw(now, pieces, colours, window.devicePixelRatio || 1);
  };
  const painter = useRef(paint);
  painter.current = paint;

  useImperativeHandle(
    ref,
    () => ({
      toGrid: (clientX, clientY) => {
        const box = canvas.current?.getBoundingClientRect();
        const now = layout.current;
        if (!box || !now) return { x: 0, y: 0 };
        const [x, y] = pointOnBoard(
          now,
          clientX - box.left - box.width / 2,
          clientY - box.top - box.height / 2,
        );
        return { x: x + now.square * 4, y: y + now.square * 4 };
      },
    }),
    [],
  );

  // The drawing, the size of the view, and the board's element while the scene lays it out.
  useLayoutEffect(() => {
    const view = canvas.current;
    const stage = view?.parentElement;
    if (!view || !stage) return;
    scene.current = createScene(view);
    const measure = () => setSize({ width: stage.clientWidth, height: stage.clientHeight });
    measure();
    const watching = new ResizeObserver(measure);
    watching.observe(stage);
    const lost = (event: Event) => event.preventDefault();
    const restored = () => {
      scene.current = createScene(view);
      drawn.current = "";
      painter.current();
    };
    view.addEventListener("webglcontextlost", lost);
    view.addEventListener("webglcontextrestored", restored);
    const board = stage.querySelector<HTMLElement>(".mac-chess-board");
    return () => {
      watching.disconnect();
      view.removeEventListener("webglcontextlost", lost);
      view.removeEventListener("webglcontextrestored", restored);
      board?.style.removeProperty("--_side");
      board?.style.removeProperty("transform");
    };
  }, []);

  useLayoutEffect(() => paint());

  const run = (milliseconds: number, frame: (done: number) => void) => {
    if (calm()) {
      frame(1);
      painter.current();
      return () => {};
    }
    const start = performance.now();
    let request = 0;
    const tick = (time: number) => {
      const done = Math.min(1, (time - start) / milliseconds);
      frame(done);
      painter.current();
      if (done < 1) request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  };

  // A new move slides to its square, unless a drag has already carried it there.
  const moves = useRef(game.moves.length);
  const lastMove = game.moves[game.moves.length - 1];
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new move starts a slide
  useEffect(() => {
    const added = game.moves.length === moves.current + 1;
    moves.current = game.moves.length;
    if (!added || !lastMove) return;
    const carried = dropped.current === lastMove.to;
    dropped.current = null;
    if (carried || lastMove.drop) return;
    motion.current = { ...motion.current, from: lastMove.from, to: lastMove.to, hop: 0 };
    return run(SLIDE_MS, (done) => {
      motion.current.hop = done;
    });
  }, [game.moves.length]);

  // Rotate Board swings the board around; the squares have already changed places.
  const facing = useRef(rotated);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a turn of the board starts a swing
  useEffect(() => {
    if (facing.current === rotated) return;
    facing.current = rotated;
    motion.current.turn = 0;
    return run(TURN_MS, (done) => {
      motion.current.turn = done;
    });
  }, [rotated]);

  // A drag anywhere in the view but on a square moves the camera.
  const cameraNow = useRef(camera);
  cameraNow.current = camera;
  const saved = useRef(onCamera);
  saved.current = onCamera;
  useEffect(() => {
    const stage = canvas.current?.parentElement;
    if (!stage) return;
    let press: { x: number; y: number; id: number; from: ChessCamera; now: ChessCamera } | null =
      null;
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary) return;
      if ((event.target as Element).closest(".mac-chess-squares")) return;
      const from = cameraNow.current;
      press = { x: event.clientX, y: event.clientY, id: event.pointerId, from, now: from };
      stage.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (press?.id !== event.pointerId) return;
      press.now = boundCamera({
        tilt: press.from.tilt - (event.clientY - press.y) * DRAG_DEGREES,
        spin: press.from.spin + (event.clientX - press.x) * DRAG_DEGREES,
      });
      setHeld(press.now);
    };
    const up = (event: PointerEvent) => {
      if (press?.id !== event.pointerId) return;
      const { now, from } = press;
      press = null;
      if (now !== from && event.type === "pointerup") {
        saved.current?.(now);
        // The camera the owner holds now answers for it, as soon as it has it.
        cameraNow.current = now;
      }
      setHeld(null);
    };
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    return () => {
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      className="mac-chess-scene"
      data-tilt={Math.round(shown.tilt)}
      data-spin={Math.round(shown.spin)}
    />
  );
}
