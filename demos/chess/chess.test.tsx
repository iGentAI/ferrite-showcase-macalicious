import {
  act,
  fireEvent,
  getDefaultNormalizer,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { describe, expect, it, vi } from "vitest";
import { app, chessApp } from "./app";
import { Chess } from "./chess";
import {
  CHESS_SQUARES,
  CHESS_START,
  type ChessGame,
  claimDraw,
  createGame,
  describeMove,
  describeSquare,
  describeStatus,
  drawClaim,
  gameStatus,
  gameTitle,
  isAttacked,
  isInCheck,
  isPromotion,
  legalMoves,
  parseFen,
  pieceAt,
  play,
  squareIndex,
  toFen,
} from "./chess-game";
import { isSharedGame, replay } from "./chess-live";

/* ------------------------------------------------------------------ a shared game's plies */

describe("a shared game's plies", () => {
  it("replays the plies the rules allow and names the first one they refuse", () => {
    const fine = replay([
      { from: "e2", to: "e4", author: "a" },
      { from: "e7", to: "e5", author: "b" },
    ]);
    expect(fine.refused).toBeNull();
    expect(fine.game.moves).toHaveLength(2);
    const poisoned = replay([
      { from: "e2", to: "e4", author: "a" },
      { from: "e7", to: "e3", author: "b" },
      { from: "d2", to: "d4", author: "a" },
    ]);
    expect(poisoned.refused).toBe(1);
    expect(poisoned.game.moves).toHaveLength(1);
  });

  it("tells a game from the server's marker for one it cannot read", () => {
    expect(isSharedGame({ number: 1, plies: [], white: null, black: null })).toBe(true);
    expect(
      isSharedGame({
        number: 2,
        plies: [
          { from: "e2", to: "e4", author: "a" },
          { from: "a7", to: "a8", promotion: "queen", author: "b" },
          { draw: true, author: "a" },
        ],
        white: "a",
        black: "b",
      }),
    ).toBe(true);
    for (const marker of [{ unreadable: true }, { number: 1 }, { plies: [] }, null, "x"]) {
      expect(isSharedGame(marker)).toBe(false);
    }
  });

  it("takes no game it could not replay or seat for a game", () => {
    const game = { number: 1, plies: [], white: null, black: null };
    for (const broken of [
      { ...game, plies: [null] },
      { ...game, plies: ["e2e4"] },
      { ...game, plies: [{ from: "e2", to: "e4" }] },
      { ...game, plies: [{ from: 5, to: "e4", author: "a" }] },
      { ...game, plies: [{ from: "e7", to: "e8", promotion: "king", author: "a" }] },
      { ...game, plies: [{ draw: "yes", author: "a" }] },
      { ...game, plies: [{ author: "a" }] },
      { ...game, plies: [{ from: "e2", author: "a" }] },
      { ...game, plies: [{ draw: false, author: "a" }] },
      { ...game, plies: [{ draw: true, from: "e2", to: "e4", author: "a" }] },
      { number: 1, plies: [] },
      { ...game, white: 7 },
      { ...game, number: Number.NaN },
      { ...game, number: -1 },
      { ...game, number: 1.5 },
    ]) {
      expect(isSharedGame(broken)).toBe(false);
    }
  });

  it("shows a notice in the status bar instead of how the game stands", () => {
    render(<Chess notice="This game holds a move the rules refuse (move 2)." />);
    expect(screen.getByText("This game holds a move the rules refuse (move 2).")).toBeTruthy();
    expect(screen.queryByText("White to move.")).toBeNull();
  });
});

/* ------------------------------------------------------------------ the rules, directly */

/** Plays moves written as "e2e4", or "e7e8r" for a promotion; throws on an illegal one. */
function playAll(game: ChessGame, ...moves: string[]): ChessGame {
  const letters = { q: "queen", r: "rook", b: "bishop", n: "knight" } as const;
  let current = game;
  for (const move of moves) {
    const promotion = letters[move.charAt(4) as keyof typeof letters];
    const next = play(current, move.slice(0, 2), move.slice(2, 4), promotion);
    if (!next) throw new Error(`${move} is not legal in ${toFen(current)}`);
    current = next;
  }
  return current;
}

/** The squares a piece can move to, sorted, each once. */
const destinations = (game: ChessGame, from: string) =>
  [...new Set(legalMoves(game, from).map((move) => move.to))].sort();

/** The number of games of `depth` half-moves from a position: the standard move generator test. */
function perft(game: ChessGame, depth: number): number {
  const moves = legalMoves(game);
  if (depth === 1) return moves.length;
  let count = 0;
  for (const move of moves) {
    const next = play(game, move.from, move.to, move.promotion ?? undefined);
    if (!next) throw new Error(`${move.from}${move.to} was listed and refused`);
    count += perft(next, depth - 1);
  }
  return count;
}

describe("the rules: the board", () => {
  it("names the squares from a1 to h8 and finds them again", () => {
    expect(CHESS_SQUARES).toHaveLength(64);
    expect(CHESS_SQUARES[0]).toBe("a1");
    expect(CHESS_SQUARES[7]).toBe("h1");
    expect(CHESS_SQUARES[8]).toBe("a2");
    expect(CHESS_SQUARES[63]).toBe("h8");
    expect(CHESS_SQUARES.map(squareIndex)).toEqual(CHESS_SQUARES.map((_, index) => index));
    for (const wrong of ["", "e", "e9", "i1", "e22", "E2"]) {
      expect(() => squareIndex(wrong)).toThrow(RangeError);
    }
  });

  it("sets up a new game", () => {
    const game = createGame();
    expect(toFen(game)).toBe(CHESS_START);
    expect(game.turn).toBe("white");
    expect(game.moves).toEqual([]);
    expect(pieceAt(game, "e1")).toEqual({ side: "white", kind: "king" });
    expect(pieceAt(game, "d8")).toEqual({ side: "black", kind: "queen" });
    expect(pieceAt(game, "b1")).toEqual({ side: "white", kind: "knight" });
    expect(pieceAt(game, "h7")).toEqual({ side: "black", kind: "pawn" });
    expect(pieceAt(game, "e4")).toBeNull();
    expect(describeSquare(game, "e2")).toBe("e2, white pawn");
    expect(describeSquare(game, "e4")).toBe("e4");
    expect(gameStatus(game)).toEqual({ state: "playing", check: false });
    expect(gameTitle(game)).toBe("New Game");
    expect(describeStatus(game)).toBe("White to move.");
  });

  it("reads and writes positions", () => {
    const kiwipete = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
    expect(toFen(parseFen(kiwipete))).toBe(kiwipete);
    const passed = "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3";
    expect(toFen(parseFen(passed))).toBe(passed);
    expect(parseFen(passed).enPassant).toBe("d6");
    // The pieces alone: White to move, no castling, move 1.
    expect(toFen(parseFen("4k3/8/8/8/8/8/4P3/4K3"))).toBe("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
    for (const wrong of [
      "",
      "8/8/8/8/8/8/8",
      "4k3/8/8/8/8/8/8/8 w - - 0 1",
      "4k3/8/8/8/8/8/8/3KK3 w - - 0 1",
      "4k3/9/8/8/8/8/8/4K3 w - - 0 1",
      "4k3/7/8/8/8/8/8/4K3 w - - 0 1",
      "4k3/8/8/8/8/8/4X3/4K3 w - - 0 1",
      "4k3/8/8/8/8/8/8/4K3 x - - 0 1",
      "4k3/8/8/8/8/8/8/4K3 w KX - 0 1",
      "4k3/8/8/8/8/8/8/4K3 w - e4 0 1",
      "4k3/8/8/8/8/8/8/4K3 w - - x 1",
      "4k3/8/8/8/8/8/8/4K3 w - - 0 0",
      // Counters too long to be counted with.
      `4k3/8/8/8/8/8/8/4K3 w - - ${"9".repeat(400)} 1`,
      "4k3/8/8/8/8/8/8/4K3 w - - 0 9007199254740993",
      // More than six fields.
      "4k3/8/8/8/8/8/8/4K3 w - - 0 1 extra",
      // An en passant square the side to move cannot take on: White takes on the sixth rank,
      // Black on the third.
      "4k3/8/8/8/8/8/3pP3/7K w - d3 0 1",
      "4k3/8/8/3pP3/8/8/8/7K b - d6 0 1",
    ]) {
      expect(() => parseFen(wrong)).toThrow(SyntaxError);
    }
    // The largest counters that can be are read and written back as they are.
    const late = "4k3/8/8/8/8/8/8/4K3 w - - 9007199254740991 9007199254740991";
    expect(toFen(parseFen(late))).toBe(late);
  });

  it("keeps a move counter at the largest number, so that the position can still be written", () => {
    // Black moves in a game given at the last move that can be counted: the counter stays,
    // and what `toFen` writes is a position `parseFen` reads back.
    const last = parseFen("4k3/8/8/8/8/8/8/R3K3 b - - 0 9007199254740991");
    const after = playAll(last, "e8d8");
    expect(after.fullmoveNumber).toBe(Number.MAX_SAFE_INTEGER);
    expect(toFen(after)).toBe("3k4/8/8/8/8/8/8/R3K3 w - - 1 9007199254740991");
    expect(toFen(parseFen(toFen(after)))).toBe(toFen(after));
    // And again, a move by each side later.
    const later = playAll(after, "a1a2", "d8e8");
    expect(toFen(later)).toBe("4k3/8/8/8/8/8/R7/4K3 w - - 3 9007199254740991");
    // One move before the last, the counter still counts.
    const before = playAll(parseFen("4k3/8/8/8/8/8/8/R3K3 b - - 0 9007199254740990"), "e8d8");
    expect(before.fullmoveNumber).toBe(9007199254740991);
    // Every other game counts as it did.
    expect(playAll(createGame(), "e2e4", "e7e5").fullmoveNumber).toBe(2);
  });
});

describe("the rules: how the pieces move", () => {
  it("moves a knight in its L, over other pieces", () => {
    expect(destinations(createGame(), "b1")).toEqual(["a3", "c3"]);
    const game = parseFen("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1");
    expect(destinations(game, "d4")).toEqual(["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"]);
    expect(destinations(parseFen("4k3/8/8/8/8/8/8/N3K3 w - - 0 1"), "a1")).toEqual(["b3", "c2"]);
  });

  it("moves a bishop along its diagonals until a piece stops it", () => {
    const game = parseFen("4k3/8/5p2/8/3B4/2P5/8/4K3 w - - 0 1");
    // Up to and onto the black pawn on f6, not onto or past the white pawn on c3.
    expect(destinations(game, "d4")).toEqual(["a7", "b6", "c5", "e3", "e5", "f2", "f6", "g1"]);
    expect(destinations(createGame(), "c1")).toEqual([]);
  });

  it("moves a rook along its file and rank until a piece stops it", () => {
    const game = parseFen("4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1");
    expect(destinations(game, "d1")).toEqual(["a1", "b1", "c1", "d2", "d3", "d4", "d5"]);
  });

  it("moves a queen as a rook and a bishop", () => {
    const game = parseFen("8/7k/8/8/3Q4/8/K7/8 w - - 0 1");
    expect(destinations(game, "d4")).toHaveLength(27);
    expect(destinations(game, "d4")).toEqual(
      expect.arrayContaining(["a4", "h4", "d1", "d8", "a7", "g1", "h8", "b2"]),
    );
    expect(destinations(game, "d4")).not.toContain("e6");
  });

  it("moves a king one square, never onto an attacked one", () => {
    expect(destinations(parseFen("7k/8/8/8/3K4/8/8/8 w - - 0 1"), "d4")).toHaveLength(8);
    // The black rook holds the e-file, the black king the squares beside it.
    const game = parseFen("4r3/8/8/8/3K4/8/8/7k w - - 0 1");
    expect(destinations(game, "d4")).toEqual(["c3", "c4", "c5", "d3", "d5"]);
    // Kings never stand side by side.
    expect(destinations(parseFen("8/8/8/3k4/8/3K4/8/8 w - - 0 1"), "d3")).toEqual([
      "c2",
      "c3",
      "d2",
      "e2",
      "e3",
    ]);
  });

  it("moves a pawn forward, two squares at first, and takes diagonally", () => {
    const start = createGame();
    expect(destinations(start, "e2")).toEqual(["e3", "e4"]);
    expect(legalMoves(start)).toHaveLength(20);
    // A pawn that has moved goes one square; a blocked pawn does not move or take forward.
    const game = parseFen("4k3/8/8/3p1p2/4P3/p7/P6P/4K3 w - - 0 1");
    expect(destinations(game, "e4")).toEqual(["d5", "e5", "f5"]);
    expect(destinations(game, "a2")).toEqual([]);
    expect(destinations(game, "h2")).toEqual(["h3", "h4"]);
    // The double step does not jump.
    expect(destinations(parseFen("4k3/8/8/8/8/7n/7P/4K3 w - - 0 1"), "h2")).toEqual([]);
    // Black's pawns go the other way.
    const black = playAll(start, "e2e4");
    expect(destinations(black, "d7")).toEqual(["d5", "d6"]);
  });

  it("counts the positions of the standard move generator tests", () => {
    expect(perft(createGame(), 1)).toBe(20);
    expect(perft(createGame(), 2)).toBe(400);
    expect(perft(createGame(), 3)).toBe(8902);
    // Castling both ways, pins, en passant and promotions.
    const kiwipete = parseFen(
      "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
    );
    expect(perft(kiwipete, 1)).toBe(48);
    expect(perft(kiwipete, 2)).toBe(2039);
    expect(perft(kiwipete, 3)).toBe(97862);
    // En passant captures that would uncover a check.
    const endgame = parseFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1");
    expect(perft(endgame, 1)).toBe(14);
    expect(perft(endgame, 2)).toBe(191);
    expect(perft(endgame, 3)).toBe(2812);
    // Promotions, with and without a capture, and checks.
    const promotions = parseFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1");
    expect(perft(promotions, 1)).toBe(6);
    expect(perft(promotions, 2)).toBe(264);
    expect(perft(promotions, 3)).toBe(9467);
    const tactics = parseFen("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8");
    expect(perft(tactics, 1)).toBe(44);
    expect(perft(tactics, 2)).toBe(1486);
    expect(perft(tactics, 3)).toBe(62379);
  });
});

describe("the rules: playing", () => {
  it("plays a move, passes the turn and leaves the game it was given alone", () => {
    const start = createGame();
    const game = playAll(start, "e2e4");
    expect(toFen(start)).toBe(CHESS_START);
    expect(toFen(game)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    expect(game.turn).toBe("black");
    expect(gameTitle(game)).toBe("Black to Move");
    expect(game.moves).toHaveLength(1);
    expect(game.moves[0]).toMatchObject({
      from: "e2",
      to: "e4",
      piece: { side: "white", kind: "pawn" },
      captured: null,
      castle: null,
      promotion: null,
      status: { state: "playing", check: false },
    });
    const reply = playAll(game, "g8f6");
    expect(toFen(reply)).toBe("rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2");
    expect(gameTitle(reply)).toBe("White to Move");
  });

  it("refuses what is not a legal move", () => {
    const start = createGame();
    expect(play(start, "e2", "e5")).toBeNull(); // too far
    expect(play(start, "e2", "d3")).toBeNull(); // nothing to take
    expect(play(start, "a1", "a3")).toBeNull(); // through its own pawn
    expect(play(start, "e7", "e5")).toBeNull(); // not Black's turn
    expect(play(start, "e4", "e5")).toBeNull(); // no piece there
    expect(play(start, "e1", "e2")).toBeNull(); // onto its own piece
  });

  it("takes a piece", () => {
    const game = playAll(createGame(), "e2e4", "d7d5", "e4d5");
    expect(pieceAt(game, "d5")).toEqual({ side: "white", kind: "pawn" });
    expect(pieceAt(game, "e4")).toBeNull();
    const move = game.moves[2];
    expect(move).toMatchObject({
      captured: { side: "black", kind: "pawn" },
      capturedOn: "d5",
      enPassant: false,
    });
    expect(move && describeMove(move)).toBe("White pawn e4 takes black pawn on d5.");
    expect(game.halfmoveClock).toBe(0);
  });

  it("does not let a move leave the mover's own king in check", () => {
    // The knight on e2 is pinned by the rook on e8: it has no legal move.
    const pinned = parseFen("4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1");
    expect(destinations(pinned, "e2")).toEqual([]);
    expect(play(pinned, "e2", "c3")).toBeNull();
    // A pinned rook may still move along the pin.
    const along = parseFen("4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1");
    expect(destinations(along, "e2")).toEqual(["e3", "e4", "e5", "e6", "e7", "e8"]);
  });

  it("sees a check and allows only the moves that answer it", () => {
    const game = playAll(createGame(), "e2e4", "f7f6", "d1h5");
    expect(isInCheck(game)).toBe(true);
    expect(isInCheck(game, "white")).toBe(false);
    expect(isAttacked(game, "e8", "white")).toBe(true);
    expect(gameStatus(game)).toEqual({ state: "playing", check: true });
    expect(describeStatus(game)).toBe("Check. Black to move.");
    expect(game.moves[2]?.status).toEqual({ state: "playing", check: true });
    // The only answer is to block on g6.
    expect(legalMoves(game).map((move) => `${move.from}${move.to}`)).toEqual(["g7g6"]);
    expect(play(game, "a7", "a6")).toBeNull();
  });

  it("ends the game at checkmate", () => {
    const game = playAll(createGame(), "f2f3", "e7e5", "g2g4", "d8h4");
    expect(gameStatus(game)).toEqual({ state: "checkmate", winner: "black" });
    expect(gameTitle(game)).toBe("Black wins");
    expect(describeStatus(game)).toBe("Checkmate. Black wins.");
    expect(legalMoves(game)).toEqual([]);
    expect(play(game, "e2", "e4")).toBeNull();
    expect(game.moves[3]?.status).toEqual({ state: "checkmate", winner: "black" });
    // White wins too: the scholar's mate.
    const scholar = playAll(createGame(), "e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7");
    expect(gameStatus(scholar)).toEqual({ state: "checkmate", winner: "white" });
    expect(gameTitle(scholar)).toBe("White wins");
  });

  it("draws at stalemate", () => {
    const game = playAll(parseFen("7k/8/6K1/8/8/8/8/5Q2 w - - 0 1"), "f1f7");
    expect(isInCheck(game)).toBe(false);
    expect(legalMoves(game)).toEqual([]);
    expect(gameStatus(game)).toEqual({ state: "draw", reason: "stalemate" });
    expect(gameTitle(game)).toBe("Draw");
    expect(describeStatus(game)).toBe("Stalemate: Black has no legal move. The game is a draw.");
  });

  it("draws when neither side can give checkmate", () => {
    const draw = { state: "draw", reason: "insufficient-material" };
    expect(gameStatus(parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1"))).toEqual(draw);
    expect(gameStatus(parseFen("4k3/8/8/8/8/8/8/4KB2 w - - 0 1"))).toEqual(draw);
    expect(gameStatus(parseFen("4k1n1/8/8/8/8/8/8/4K3 w - - 0 1"))).toEqual(draw);
    // Bishops that all stand on dark squares: c1 and f8.
    expect(gameStatus(parseFen("4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1"))).toEqual(draw);
    // Bishops on both colours, a rook or a single pawn are enough to play on.
    expect(gameStatus(parseFen("4kb2/8/8/8/8/8/8/3BK3 w - - 0 1")).state).toBe("playing");
    expect(gameStatus(parseFen("4k3/8/8/8/8/8/8/R3K3 w - - 0 1")).state).toBe("playing");
    expect(gameStatus(parseFen("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1")).state).toBe("playing");
    // Taking the last piece that could win ends the game, and no move is accepted after it.
    const taken = playAll(parseFen("4k3/8/8/8/8/8/3r4/4K3 w - - 0 1"), "e1d2");
    expect(gameStatus(taken)).toEqual(draw);
    expect(play(taken, "e8", "e7")).toBeNull();
    expect(describeStatus(taken)).toBe("Neither side can give checkmate. The game is a draw.");
  });

  it("draws in a position the pawns lock for good", () => {
    const draw = { state: "draw", reason: "insufficient-material" };
    // Every pawn is blocked by an enemy pawn, none can take, and each king is shut in on its
    // side of the chain: no capture, promotion or check can ever happen.
    const locked = parseFen("4k3/8/8/p1p1p1p1/PpPpPpPp/1P1P1P1P/8/4K3 w - - 0 1");
    expect(gameStatus(locked)).toEqual(draw);
    expect(play(locked, "e1", "e2")).toBeNull();
    expect(gameStatus(parseFen("4k3/8/8/p1p1p1p1/PpPpPpPp/1P1P1P1P/8/4K3 b - - 0 1"))).toEqual(
      draw,
    );
    // One pawn pair facing each other, kings unable to reach a pawn they may take: still a
    // game, since the black king can walk round and take the white pawn.
    expect(gameStatus(parseFen("4k3/8/8/4p3/4P3/8/8/4K3 w - - 0 1")).state).toBe("playing");
    // The same chain with a gap a king walks through to an undefended pawn.
    expect(gameStatus(parseFen("4k3/8/8/p1p1p3/PpPpP3/1P1P4/8/4K3 w - - 0 1")).state).toBe(
      "playing",
    );
    // A pawn that can take now, a pawn that is free to move, or any other piece: a game.
    expect(gameStatus(parseFen("4k3/8/8/p1p1p1p1/PpPpPpPp/1P1P1P2/7P/4K3 w - - 0 1")).state).toBe(
      "playing",
    );
    expect(gameStatus(parseFen("4k3/8/8/p1p1p1p1/PpPpPpPp/1P1P1P1P/8/4KN2 w - - 0 1")).state).toBe(
      "playing",
    );
    expect(gameStatus(parseFen("4k3/8/8/p1p1p1p1/PpPpPpP1/1P1P1P1P/8/4K3 w - - 0 1")).state).toBe(
      "playing",
    );
  });

  it("lets the side to move claim a draw after fifty moves without a capture or a pawn move", () => {
    const near = parseFen("4k3/8/8/8/8/8/8/R3K3 w - - 99 60");
    expect(drawClaim(near)).toBeNull();
    expect(claimDraw(near)).toBeNull();
    const fifty = playAll(near, "a1a2");
    expect(fifty.halfmoveClock).toBe(100);
    // The game goes on until Black claims.
    expect(gameStatus(fifty)).toEqual({ state: "playing", check: false });
    expect(drawClaim(fifty)).toBe("fifty-moves");
    expect(describeStatus(fifty)).toBe("Black to move. Black may claim a draw.");
    expect(playAll(fifty, "e8d8")).not.toBeNull();
    const claimed = claimDraw(fifty);
    expect(claimed && gameStatus(claimed)).toEqual({ state: "draw", reason: "fifty-moves" });
    expect(claimed && gameTitle(claimed)).toBe("Draw");
    expect(claimed && describeStatus(claimed)).toBe(
      "Black claimed a draw: fifty moves without a capture or a pawn move.",
    );
    expect(claimed && play(claimed, "e8", "d8")).toBeNull();
    // The game it was claimed in is left alone.
    expect(gameStatus(fifty).state).toBe("playing");
    // A pawn move starts the count again.
    const pawn = playAll(parseFen("4k3/8/8/8/8/8/4P3/R3K3 w - - 99 60"), "e2e3");
    expect(pawn.halfmoveClock).toBe(0);
    expect(drawClaim(pawn)).toBeNull();
  });

  it("draws by itself after seventy-five moves without a capture or a pawn move", () => {
    const near = parseFen("4k3/8/8/8/8/8/8/R3K3 w - - 149 90");
    expect(gameStatus(near).state).toBe("playing");
    const drawn = playAll(near, "a1a2");
    expect(drawn.halfmoveClock).toBe(150);
    expect(gameStatus(drawn)).toEqual({ state: "draw", reason: "seventy-five-moves" });
    expect(drawClaim(drawn)).toBeNull();
    expect(play(drawn, "e8", "d8")).toBeNull();
    expect(describeStatus(drawn)).toBe(
      "Seventy-five moves without a capture or a pawn move. The game is a draw.",
    );
    // Checkmate on the move that reaches the count still wins.
    const mate = playAll(parseFen("k7/8/1K6/8/8/8/8/7R w - - 149 90"), "h1h8");
    expect(gameStatus(mate)).toEqual({ state: "checkmate", winner: "white" });
  });

  it("lets the side to move claim a draw when a position comes for the third time", () => {
    const dance = ["g1f3", "g8f6", "f3g1", "f6g8"];
    const twice = playAll(createGame(), ...dance);
    expect(drawClaim(twice)).toBeNull();
    const thrice = playAll(twice, ...dance);
    expect(gameStatus(thrice)).toEqual({ state: "playing", check: false });
    expect(drawClaim(thrice)).toBe("repetition");
    const claimed = claimDraw(thrice);
    expect(claimed && gameStatus(claimed)).toEqual({ state: "draw", reason: "repetition" });
    expect(claimed && describeStatus(claimed)).toBe(
      "White claimed a draw: the same position for the third time.",
    );
    // Unclaimed, the game goes on, and the claim passes with the position.
    const on = playAll(thrice, "b1c3");
    expect(drawClaim(on)).toBeNull();
  });

  it("draws by itself when a position comes for the fifth time", () => {
    const dance = ["g1f3", "g8f6", "f3g1", "f6g8"];
    const four = playAll(createGame(), ...dance, ...dance, ...dance);
    expect(gameStatus(four).state).toBe("playing");
    expect(drawClaim(four)).toBe("repetition");
    const five = playAll(four, ...dance);
    expect(gameStatus(five)).toEqual({ state: "draw", reason: "fivefold-repetition" });
    expect(drawClaim(five)).toBeNull();
    expect(play(five, "g1", "f3")).toBeNull();
    expect(describeStatus(five)).toBe("The same position for the fifth time. The game is a draw.");
  });

  it("counts a position again though a pawn's double step left a square nobody can take on", () => {
    // After e2e4 no black pawn stands beside the pawn: the square behind it, e3, is written
    // into the position and makes no difference to what can be played.
    const opened = playAll(createGame(), "e2e4");
    expect(opened.enPassant).toBe("e3");
    expect(toFen(opened)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
    const dance = ["g8f6", "g1f3", "f6g8", "f3g1"];
    const twice = playAll(opened, ...dance);
    expect(drawClaim(twice)).toBeNull();
    // One move before the third time there is no claim.
    expect(drawClaim(playAll(twice, ...dance.slice(0, 3)))).toBeNull();
    expect(drawClaim(playAll(twice, ...dance))).toBe("repetition");
  });

  it("counts a position again when the pawn beside the one that passed is pinned", () => {
    // Black's pawn on e4 stands beside the pawn that passed d3, but taking it would open the
    // file between the rook and Black's king: the capture is not a move.
    const pinned = parseFen("4k3/8/8/8/3Pp3/8/8/4R1K1 b - d3 0 1");
    expect(destinations(pinned, "e4")).toEqual(["e3"]);
    expect(toFen(pinned)).toBe("4k3/8/8/8/3Pp3/8/8/4R1K1 b - d3 0 1");
    const dance = ["e8d8", "g1h1", "d8e8", "h1g1"];
    const twice = playAll(pinned, ...dance);
    expect(drawClaim(twice)).toBeNull();
    expect(drawClaim(playAll(twice, ...dance))).toBe("repetition");
  });

  it("does not count a position again while a capture en passant was open the first time", () => {
    // The same board without the rook: now the pawn may take on d3, so the first position is
    // not the one the kings come back to, in which that capture is gone.
    const open = parseFen("4k3/8/8/8/3Pp3/8/8/6K1 b - d3 0 1");
    expect(destinations(open, "e4")).toEqual(["d3", "e3"]);
    const dance = ["e8d8", "g1h1", "d8e8", "h1g1"];
    const back = playAll(open, ...dance, ...dance);
    // The kings are back for the second time on a board that was there three times: the
    // first of the three is another position, so there is no claim yet.
    expect(drawClaim(back)).toBeNull();
    // The next move brings the position after it for the third time.
    expect(drawClaim(playAll(back, "e8d8"))).toBe("repetition");
  });

  it("never takes a king, in a position given with one left attacked", () => {
    // White to move with Black's king attacked: not a position of a game, but one that can
    // be written down. The queen's moves stop short of the king.
    const given = parseFen("4k3/4Q3/8/8/8/8/8/4K3 w - - 0 1");
    expect(destinations(given, "e7")).not.toContain("e8");
    expect(legalMoves(given).some((move) => move.captured?.kind === "king")).toBe(false);
    expect(play(given, "e7", "e8")).toBeNull();
    // A pawn does not take one either.
    const pawn = parseFen("8/8/8/8/8/3k4/4P3/4K3 w - - 0 1");
    expect(destinations(pawn, "e2")).toEqual(["e3", "e4"]);
    // The king is still attacked: check is told by what attacks, not by what may move.
    expect(isInCheck(given, "black")).toBe(true);
  });
});

describe("the rules: castling", () => {
  const open = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";

  it("castles on either side, for either player", () => {
    const game = parseFen(open);
    expect(destinations(game, "e1")).toEqual(["c1", "d1", "d2", "e2", "f1", "f2", "g1"]);
    const short = playAll(game, "e1g1");
    expect(pieceAt(short, "g1")).toEqual({ side: "white", kind: "king" });
    expect(pieceAt(short, "f1")).toEqual({ side: "white", kind: "rook" });
    expect(pieceAt(short, "h1")).toBeNull();
    expect(pieceAt(short, "e1")).toBeNull();
    expect(short.moves[0]?.castle).toBe("kingside");
    expect(short.moves[0] && describeMove(short.moves[0])).toBe("White castles kingside.");
    expect(toFen(short)).toBe("r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1");
    const long = playAll(short, "e8c8");
    expect(pieceAt(long, "c8")).toEqual({ side: "black", kind: "king" });
    expect(pieceAt(long, "d8")).toEqual({ side: "black", kind: "rook" });
    expect(pieceAt(long, "a8")).toBeNull();
    expect(long.moves[1] && describeMove(long.moves[1])).toBe("Black castles queenside.");
    expect(toFen(long)).toBe("2kr3r/8/8/8/8/8/8/R4RK1 w - - 2 2");
  });

  it("does not castle once the king or that rook has moved", () => {
    // The king goes out and back: no castling for White any more.
    const king = playAll(parseFen(open), "e1e2", "a8b8", "e2e1", "b8a8");
    expect(destinations(king, "e1")).not.toContain("g1");
    expect(destinations(king, "e1")).not.toContain("c1");
    // Black's a-rook moved: Black may castle kingside only.
    const black = playAll(king, "e1e2");
    expect(destinations(black, "e8")).toContain("g8");
    expect(destinations(black, "e8")).not.toContain("c8");
    // A rook that moved takes its own side's right with it.
    const rook = playAll(parseFen(open), "h1h2", "h8h7", "h2h1", "h7h8");
    expect(destinations(rook, "e1")).toContain("c1");
    expect(destinations(rook, "e1")).not.toContain("g1");
  });

  it("does not castle with a rook that was taken", () => {
    // The bishop takes the rook on h1; a rook that comes to h1 later does not bring the right back.
    const game = playAll(
      parseFen("4k3/8/8/8/8/8/6b1/R3K2R b KQ - 0 1"),
      "g2h1",
      "a1a2",
      "h1d5",
      "a2h2",
      "e8d8",
      "h2h1",
      "d8e8",
    );
    expect(pieceAt(game, "h1")).toEqual({ side: "white", kind: "rook" });
    expect(destinations(game, "e1")).not.toContain("g1");
  });

  it("does not castle out of, through or into check, or through a piece", () => {
    // In check from the rook on e8.
    expect(destinations(parseFen("4r2k/8/8/8/8/8/8/R3K2R w KQ - 0 1"), "e1")).toEqual([
      "d1",
      "d2",
      "f1",
      "f2",
    ]);
    // The rook on f8 holds f1: no castling kingside, and no step to f1 or f2.
    expect(destinations(parseFen("5r1k/8/8/8/8/8/8/R3K2R w KQ - 0 1"), "e1")).toEqual([
      "c1",
      "d1",
      "d2",
      "e2",
    ]);
    // The rook on g8 holds g1, where the king would land.
    expect(destinations(parseFen("6rk/8/8/8/8/8/8/R3K2R w KQ - 0 1"), "e1")).not.toContain("g1");
    // The rook on b8 attacks b1, which only the rook passes over: castling queenside is legal.
    expect(destinations(parseFen("1r5k/8/8/8/8/8/8/R3K2R w KQ - 0 1"), "e1")).toContain("c1");
    // A piece between the king and the rook.
    const start = createGame();
    expect(destinations(start, "e1")).toEqual([]);
    expect(destinations(parseFen("4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1"), "e1")).not.toContain("c1");
  });
});

describe("the rules: en passant", () => {
  it("takes the pawn that has just passed, and only at once", () => {
    const game = playAll(createGame(), "e2e4", "a7a6", "e4e5", "d7d5");
    expect(game.enPassant).toBe("d6");
    expect(destinations(game, "e5")).toEqual(["d6", "e6"]);
    const taken = playAll(game, "e5d6");
    expect(pieceAt(taken, "d6")).toEqual({ side: "white", kind: "pawn" });
    expect(pieceAt(taken, "d5")).toBeNull();
    expect(pieceAt(taken, "e5")).toBeNull();
    const move = taken.moves[4];
    expect(move).toMatchObject({
      enPassant: true,
      capturedOn: "d5",
      captured: { side: "black", kind: "pawn" },
    });
    expect(move && describeMove(move)).toBe(
      "White pawn e5 takes black pawn on d5 en passant, and stands on d6.",
    );
    // A move later the chance is gone.
    const late = playAll(game, "h2h3", "a6a5");
    expect(late.enPassant).toBeNull();
    expect(destinations(late, "e5")).toEqual(["e6"]);
    // A pawn that came beside it in two single steps cannot be taken that way.
    const slow = playAll(createGame(), "e2e4", "d7d6", "e4e5", "d6d5");
    expect(destinations(slow, "e5")).toEqual(["e6"]);
  });

  it("works for Black", () => {
    const game = playAll(createGame(), "a2a3", "d7d5", "a3a4", "d5d4", "e2e4");
    expect(game.enPassant).toBe("e3");
    const taken = playAll(game, "d4e3");
    expect(pieceAt(taken, "e3")).toEqual({ side: "black", kind: "pawn" });
    expect(pieceAt(taken, "e4")).toBeNull();
  });

  it("is refused when it would uncover a check", () => {
    // Taking on d6 would clear the fifth rank between the rook on h5 and the king on a5.
    const game = parseFen("8/8/8/K2pP2r/8/8/8/7k w - d6 0 1");
    expect(destinations(game, "e5")).toEqual(["e6"]);
    expect(play(game, "e5", "d6")).toBeNull();
  });

  it("is open only to a pawn on its fifth rank", () => {
    // The square behind a double step is on the sixth rank for White and the third for Black;
    // a position that names another is not read, so a pawn on e2 never takes on d3.
    expect(() => parseFen("4k3/8/8/8/8/8/3pP3/7K w - d3 0 1")).toThrow(SyntaxError);
    const black = parseFen("4k3/8/8/8/3Pp3/8/8/7K b - d3 0 1");
    expect(destinations(black, "e4")).toEqual(["d3", "e3"]);
    // A pawn of the right colour on its fifth rank takes; the rule in the move generator
    // (fifth rank only) and the one in parseFen agree.
    const off = parseFen("4k3/8/8/3pP3/8/8/8/7K w - d6 0 1");
    expect(destinations(off, "e5")).toEqual(["d6", "e6"]);
    // A game put together by hand with such a square: the pawn on e2 still does not take.
    const byHand = { ...parseFen("4k3/8/8/8/8/8/3pP3/7K w - - 0 1"), enPassant: "d3" };
    expect(destinations(byHand, "e2")).toEqual(["e3", "e4"]);
    expect(play(byHand, "e2", "d3")).toBeNull();
  });
});

describe("the rules: promotion", () => {
  const ready = "7k/4P3/8/8/8/8/8/4K3 w - - 0 1";

  it("replaces a pawn on the last rank with the piece that is asked for", () => {
    const game = parseFen(ready);
    expect(isPromotion(game, "e7", "e8")).toBe(true);
    expect(legalMoves(game, "e7").map((move) => move.promotion)).toEqual([
      "queen",
      "rook",
      "bishop",
      "knight",
    ]);
    for (const kind of ["queen", "rook", "bishop", "knight"] as const) {
      const promoted = play(game, "e7", "e8", kind);
      expect(promoted && pieceAt(promoted, "e8")).toEqual({ side: "white", kind });
      expect(promoted && pieceAt(promoted, "e7")).toBeNull();
      expect(promoted?.moves[0]?.promotion).toBe(kind);
    }
    // A queen, unless another piece is named.
    const queen = play(game, "e7", "e8");
    expect(queen && pieceAt(queen, "e8")).toEqual({ side: "white", kind: "queen" });
    const move = queen?.moves[0];
    expect(move && describeMove(move)).toBe("White pawn e7 to e8 and becomes a queen.");
    // The new queen gives check along the eighth rank.
    expect(move?.status).toEqual({ state: "playing", check: true });
  });

  it("promotes with a capture, and for Black on the first rank", () => {
    const game = playAll(parseFen("3n3k/4P3/8/8/8/8/p7/4K3 w - - 0 1"), "e7d8n");
    expect(pieceAt(game, "d8")).toEqual({ side: "white", kind: "knight" });
    expect(game.moves[0] && describeMove(game.moves[0])).toBe(
      "White pawn e7 takes black knight on d8 and becomes a knight.",
    );
    const black = playAll(game, "a2a1r");
    expect(pieceAt(black, "a1")).toEqual({ side: "black", kind: "rook" });
    expect(isInCheck(black)).toBe(true);
  });

  it("is no promotion anywhere else", () => {
    const start = createGame();
    expect(isPromotion(start, "e2", "e4")).toBe(false);
    expect(isPromotion(parseFen(ready), "e1", "e2")).toBe(false);
    // Asking for a piece changes nothing about an ordinary move.
    const game = play(start, "e2", "e4", "knight");
    expect(game && pieceAt(game, "e4")).toEqual({ side: "white", kind: "pawn" });
  });
});

/* ------------------------------------------------------------------ the window */

/** The window: a region named by its title, which ends with the game's state in parentheses. */
const frame = () => screen.getByRole("region", { name: /\)$/ });
const board = () => screen.getByRole("grid", { name: "Chessboard" });
/** A square by its name, whatever stands on it. */
const square = (name: string) => {
  const found = within(board())
    .getAllByRole("gridcell")
    .find((cell) => cell.getAttribute("aria-label")?.split(",")[0] === name);
  if (!found) throw new Error(`no square named ${name}`);
  return found;
};
/** What a square is called: its name and the piece on it. */
const on = (name: string) => square(name).getAttribute("aria-label");
/** What assistive technology was last told. */
const told = () => screen.getByRole("status").textContent;
const control = (name: string) => within(frame()).getByRole("button", { name });
/** Moves by two clicks: "e2e4". */
const click = async (user: UserEvent, ...moves: string[]) => {
  for (const move of moves) {
    await user.click(square(move.slice(0, 2)));
    await user.click(square(move.slice(2, 4)));
  }
};
const sheetGone = () => waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

describe("the window", () => {
  it("opens at the captured size on a new game", () => {
    render(<Chess />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().style.width).toBe("971px");
    expect(frame().style.height).toBe("702px");
    expect(frame()).toHaveAccessibleName("Player One - Player Two (New Game)");
    // Three spaces before the parenthesis, as the application writes its title.
    expect(
      screen.getByText("Player One - Player Two   (New Game)", {
        normalizer: getDefaultNormalizer({ collapseWhitespace: false }),
      }),
    ).toBeInTheDocument();
    expect(within(board()).getAllByRole("row")).toHaveLength(8);
    expect(within(board()).getAllByRole("gridcell")).toHaveLength(64);
    // White at the bottom: the first row is the eighth rank.
    expect(
      within(within(board()).getAllByRole("row")[0] as HTMLElement)
        .getAllByRole("gridcell")
        .map((cell) => cell.getAttribute("aria-label")),
    ).toEqual([
      "a8, black rook",
      "b8, black knight",
      "c8, black bishop",
      "d8, black queen",
      "e8, black king",
      "f8, black bishop",
      "g8, black knight",
      "h8, black rook",
    ]);
    expect(on("e2")).toBe("e2, white pawn");
    expect(on("e1")).toBe("e1, white king");
    expect(on("e4")).toBe("e4");
    expect(within(frame()).getByText("White to move.")).toBeInTheDocument();
    expect(told()).toBe("");
  });

  it("names the players in its title", () => {
    render(<Chess white="Ada" black="Grace" />);
    expect(frame()).toHaveAccessibleName("Ada - Grace (New Game)");
  });

  it("hands the window manager's props to the window, its controls and its title bar", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Chess
        state="inactive"
        width={800}
        height={600}
        className="hosted"
        data-hosted="yes"
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-hosted", "yes");
    expect(frame()).toHaveClass("mac-window", "mac-chess", "hosted");
    expect(frame().style.width).toBe("800px");
    expect(frame().style.height).toBe("600px");
    await user.click(control("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(control("Minimize"));
    expect(onMinimize).toHaveBeenCalledTimes(1);
    await user.click(control("Enter Full Screen"));
    expect(onZoom).toHaveBeenCalledTimes(1);
    const titleText = screen.getByText(/New Game\)$/);
    fireEvent.pointerDown(titleText, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    fireEvent.doubleClick(titleText);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a window control does not drag the window.
    fireEvent.pointerDown(control("Close"), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
  });

  it("passes the zoom role and the disabled controls on", () => {
    render(<Chess zoomRole="zoom" minimizeDisabled zoomDisabled />);
    expect(control("Minimize")).toBeDisabled();
    expect(control("Zoom")).toBeDisabled();
    expect(control("Close")).toBeEnabled();
  });

  it("exports the descriptor a desktop reads and runs in a managed window", async () => {
    const user = userEvent.setup();
    expect(app).toBe(chessApp);
    expect(app.id).toBe("chess");
    expect(app.name).toBe("Chess");
    expect(app.defaultSize).toEqual({ width: 971, height: 702 });
    expect(app.menus).toEqual(["Chess", "Game", "Edit", "Moves", "View", "Window", "Help"]);
    render(
      <WindowManager style={{ height: 800 }}>
        <ManagedWindow
          id={app.id}
          defaultFrame={{ x: 20, y: 20, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().parentElement).toHaveAttribute("data-window-id", "chess");
    await click(user, "e2e4");
    expect(on("e4")).toBe("e4, white pawn");
    await user.click(control("Close"));
    expect(screen.queryByRole("region", { name: /\)$/ })).toBeNull();
  });
});

describe("moving with the pointer", () => {
  it("picks a piece up with one click and puts it down with the next", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Chess onMove={onMove} />);
    await user.click(square("e2"));
    expect(square("e2")).toHaveAttribute("aria-selected", "true");
    expect(told()).toBe("White pawn on e2 picked up. It can move to e3, e4.");
    expect(square("e3")).toHaveAttribute("data-target", "move");
    expect(square("e4")).toHaveAttribute("data-target", "move");
    expect(square("e5")).not.toHaveAttribute("data-target");
    expect(onMove).not.toHaveBeenCalled();

    await user.click(square("e4"));
    expect(on("e4")).toBe("e4, white pawn");
    expect(on("e2")).toBe("e2");
    expect(square("e4")).toHaveAttribute("aria-selected", "false");
    expect(told()).toBe("White pawn e2 to e4. Black to move.");
    expect(within(frame()).getByText("Black to move.")).toBeInTheDocument();
    expect(onMove).toHaveBeenCalledTimes(1);
    const [move, game] = onMove.mock.calls[0] as [unknown, ChessGame];
    expect(move).toMatchObject({ from: "e2", to: "e4", piece: { side: "white", kind: "pawn" } });
    expect(toFen(game)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1");
  });

  it("follows the turn in the title", async () => {
    const user = userEvent.setup();
    render(<Chess white="Player" black="Computer" />);
    expect(frame()).toHaveAccessibleName("Player - Computer (New Game)");
    await click(user, "e2e4");
    expect(frame()).toHaveAccessibleName("Player - Computer (Black to Move)");
    await click(user, "e7e5");
    expect(frame()).toHaveAccessibleName("Player - Computer (White to Move)");
  });

  it("refuses an illegal move and keeps the piece in hand", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Chess onMove={onMove} />);
    await click(user, "e2e5");
    expect(told()).toBe("White pawn on e2 cannot move to e5.");
    expect(on("e2")).toBe("e2, white pawn");
    expect(on("e5")).toBe("e5");
    expect(square("e2")).toHaveAttribute("aria-selected", "true");
    expect(frame()).toHaveAccessibleName("Player One - Player Two (New Game)");
    // Onto a piece of the other side that it cannot take.
    await user.click(square("e7"));
    expect(told()).toBe("White pawn on e2 cannot move to e7.");
    expect(on("e7")).toBe("e7, black pawn");
    expect(onMove).not.toHaveBeenCalled();
    // The legal move still works afterwards.
    await user.click(square("e4"));
    expect(on("e4")).toBe("e4, white pawn");
  });

  it("does not pick up a piece of the side that is not to move, or an empty square", async () => {
    const user = userEvent.setup();
    render(<Chess />);
    await user.click(square("e7"));
    expect(told()).toBe("It is White's move.");
    expect(square("e7")).toHaveAttribute("aria-selected", "false");
    await user.click(square("e4"));
    expect(told()).toBe("No piece on e4.");
    await click(user, "e2e4");
    await user.click(square("d2"));
    expect(told()).toBe("It is Black's move.");
  });

  it("changes its mind: another piece, or none", async () => {
    const user = userEvent.setup();
    render(<Chess />);
    await user.click(square("e2"));
    await user.click(square("g1"));
    expect(square("e2")).toHaveAttribute("aria-selected", "false");
    expect(square("g1")).toHaveAttribute("aria-selected", "true");
    expect(told()).toBe("White knight on g1 picked up. It can move to f3, h3.");
    await user.click(square("g1"));
    expect(square("g1")).toHaveAttribute("aria-selected", "false");
    expect(told()).toBe("White knight on g1 put down.");
    // A piece that cannot move says so.
    await user.click(square("a1"));
    expect(told()).toBe("White rook on a1 picked up. It has no legal move.");
  });

  it("takes a piece", async () => {
    const user = userEvent.setup();
    render(<Chess />);
    await click(user, "e2e4", "d7d5");
    await user.click(square("e4"));
    expect(square("d5")).toHaveAttribute("data-target", "capture");
    expect(square("e5")).toHaveAttribute("data-target", "move");
    await user.click(square("d5"));
    expect(on("d5")).toBe("d5, white pawn");
    expect(on("e4")).toBe("e4");
    expect(told()).toBe("White pawn e4 takes black pawn on d5. Black to move.");
    expect(within(board()).getAllByRole("gridcell", { name: /black pawn/ })).toHaveLength(7);
  });

  it("announces a check and refuses a move that does not answer it", async () => {
    const user = userEvent.setup();
    render(<Chess />);
    await click(user, "e2e4", "f7f6", "d1h5");
    expect(told()).toBe("White queen d1 to h5. Check. Black to move.");
    expect(within(frame()).getByText("Check. Black to move.")).toBeInTheDocument();
    expect(square("e8")).toHaveAttribute("data-check");
    await click(user, "a7a6");
    expect(told()).toBe("Black pawn on a7 cannot move to a6.");
    expect(on("a7")).toBe("a7, black pawn");
    await user.click(square("a7"));
    await click(user, "g7g6");
    expect(on("g6")).toBe("g6, black pawn");
    expect(square("e8")).not.toHaveAttribute("data-check");
  });
});

describe("moving with the keyboard", () => {
  it("has one square in the tab order and moves it with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Chess />);
    const stops = () =>
      within(board())
        .getAllByRole("gridcell")
        .filter((cell) => cell.tabIndex === 0);
    expect(stops()).toEqual([square("e2")]);
    act(() => square("e2").focus());
    await user.keyboard("{ArrowUp}");
    expect(square("e3")).toHaveFocus();
    expect(stops()).toEqual([square("e3")]);
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowDown}");
    expect(square("g2")).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(square("f2")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(square("a2")).toHaveFocus();
    // The edges of the board hold the focus.
    await user.keyboard("{ArrowLeft}{ArrowDown}{ArrowDown}");
    expect(square("a1")).toHaveFocus();
    await user.keyboard("{End}");
    expect(square("h1")).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(square("h1")).toHaveFocus();
    expect(stops()).toEqual([square("h1")]);
  });

  it("picks up and puts down with Return and with the space bar", async () => {
    const user = userEvent.setup();
    render(<Chess />);
    act(() => square("e2").focus());
    await user.keyboard("{Enter}");
    expect(square("e2")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}{ArrowUp}{Enter}");
    expect(on("e4")).toBe("e4, white pawn");
    expect(square("e4")).toHaveFocus();
    expect(told()).toBe("White pawn e2 to e4. Black to move.");
    // Black, with the space bar: from e4 up to e7, then down to e5.
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp} ");
    expect(square("e7")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}{ArrowDown} ");
    expect(on("e5")).toBe("e5, black pawn");
    expect(frame()).toHaveAccessibleName("Player One - Player Two (White to Move)");
  });

  it("puts a piece down with Escape and refuses an illegal square", async () => {
    const user = userEvent.setup();
    render(<Chess />);
    act(() => square("g1").focus());
    await user.keyboard("{Enter}{ArrowUp}{ArrowUp}{Enter}");
    expect(told()).toBe("White knight on g1 cannot move to g3.");
    expect(square("g1")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    expect(square("g1")).toHaveAttribute("aria-selected", "false");
    expect(told()).toBe("White knight on g1 put down.");
    expect(on("g1")).toBe("g1, white knight");
  });
});

describe("a game", () => {
  it("ends at checkmate and shows who won", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Chess onMove={onMove} />);
    // The fool's mate.
    await click(user, "f2f3", "e7e5", "g2g4", "d8h4");
    expect(frame()).toHaveAccessibleName("Player One - Player Two (Black wins)");
    expect(told()).toBe("Black queen d8 to h4. Checkmate. Black wins.");
    expect(within(frame()).getByText("Checkmate. Black wins.")).toBeInTheDocument();
    expect(square("e1")).toHaveAttribute("data-check");
    expect(onMove).toHaveBeenCalledTimes(4);
    expect(onMove.mock.calls[3]?.[0]).toMatchObject({
      status: { state: "checkmate", winner: "black" },
    });
    // Nothing moves after the end.
    await user.click(square("e2"));
    expect(square("e2")).toHaveAttribute("aria-selected", "false");
    expect(told()).toBe("Checkmate. Black wins. Choose New Game to play again.");
    expect(onMove).toHaveBeenCalledTimes(4);
  });

  it("starts over in the same variant with New Game", async () => {
    const user = userEvent.setup();
    render(<Chess defaultGame={createGame("crazyhouse")} />);
    await click(user, "e2e4", "d7d5", "e4d5");
    expect(screen.getByRole("group", { name: "White's hand" })).toBeInTheDocument();
    await user.click(control("New Game"));
    expect(screen.getByRole("group", { name: "White's hand" })).toBeInTheDocument();
    expect(on("d5")).toBe("d5");
  });

  it("starts over with New Game", async () => {
    const user = userEvent.setup();
    const onNewGame = vi.fn();
    render(<Chess onNewGame={onNewGame} />);
    await click(user, "f2f3", "e7e5", "g2g4", "d8h4");
    await user.click(control("New Game"));
    expect(onNewGame).toHaveBeenCalledTimes(1);
    expect(frame()).toHaveAccessibleName("Player One - Player Two (New Game)");
    expect(told()).toBe("New game. White to move.");
    expect(on("f2")).toBe("f2, white pawn");
    expect(on("d8")).toBe("d8, black queen");
    expect(on("h4")).toBe("h4");
    expect(within(frame()).getByText("White to move.")).toBeInTheDocument();
    // And it is a game: White moves again.
    await click(user, "e2e4");
    expect(on("e4")).toBe("e4, white pawn");
  });

  it("starts over from the starting position also when it opened on another", async () => {
    const user = userEvent.setup();
    render(<Chess defaultGame={parseFen("7k/8/6K1/8/8/8/8/5Q2 w - - 0 1")} />);
    expect(on("f1")).toBe("f1, white queen");
    expect(on("e2")).toBe("e2");
    await user.click(control("New Game"));
    expect(on("f1")).toBe("f1, white bishop");
    expect(on("e2")).toBe("e2, white pawn");
  });

  it("draws when the side to move claims it with Claim Draw", async () => {
    const user = userEvent.setup();
    const onClaimDraw = vi.fn();
    const onMove = vi.fn();
    render(
      <Chess
        onClaimDraw={onClaimDraw}
        onMove={onMove}
        defaultGame={parseFen("4k3/8/8/8/8/8/8/R3K3 w - - 99 60")}
      />,
    );
    // No claim yet: the button is there and disabled.
    expect(control("Claim Draw")).toBeDisabled();
    await click(user, "a1a2");
    // Fifty moves: the game goes on, and Black may claim.
    expect(frame()).toHaveAccessibleName("Player One - Player Two (Black to Move)");
    expect(within(frame()).getByText("Black to move. Black may claim a draw.")).toBeInTheDocument();
    expect(control("Claim Draw")).toBeEnabled();
    await user.click(control("Claim Draw"));
    expect(frame()).toHaveAccessibleName("Player One - Player Two (Draw)");
    expect(told()).toBe("Black claimed a draw: fifty moves without a capture or a pawn move.");
    expect(onClaimDraw).toHaveBeenCalledTimes(1);
    expect(onClaimDraw.mock.calls[0]?.[0]).toMatchObject({ claimed: "fifty-moves" });
    expect(control("Claim Draw")).toBeDisabled();
    // Nothing moves after it.
    await user.click(square("e8"));
    expect(square("e8")).toHaveAttribute("aria-selected", "false");
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("ends in a draw at stalemate", async () => {
    const user = userEvent.setup();
    render(<Chess defaultGame={parseFen("7k/8/6K1/8/8/8/8/5Q2 w - - 0 1")} />);
    await click(user, "f1f7");
    expect(frame()).toHaveAccessibleName("Player One - Player Two (Draw)");
    expect(told()).toBe(
      "White queen f1 to f7. Stalemate: Black has no legal move. The game is a draw.",
    );
    expect(square("h8")).not.toHaveAttribute("data-check");
  });

  it("castles: the rook follows the king", async () => {
    const user = userEvent.setup();
    render(<Chess defaultGame={parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")} />);
    await user.click(square("e1"));
    expect(square("g1")).toHaveAttribute("data-target", "move");
    expect(square("c1")).toHaveAttribute("data-target", "move");
    await user.click(square("g1"));
    expect(on("g1")).toBe("g1, white king");
    expect(on("f1")).toBe("f1, white rook");
    expect(on("h1")).toBe("h1");
    expect(on("e1")).toBe("e1");
    expect(told()).toBe("White castles kingside. Black to move.");
    await click(user, "e8c8");
    expect(on("c8")).toBe("c8, black king");
    expect(on("d8")).toBe("d8, black rook");
    expect(on("a8")).toBe("a8");
    expect(told()).toBe("Black castles queenside. White to move.");
  });

  it("castles in a game played from the start", async () => {
    const user = userEvent.setup();
    render(<Chess />);
    await click(user, "e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "e1g1");
    expect(on("g1")).toBe("g1, white king");
    expect(on("f1")).toBe("f1, white rook");
    expect(told()).toBe("White castles kingside. Black to move.");
  });

  it("takes en passant", async () => {
    const user = userEvent.setup();
    render(<Chess />);
    await click(user, "e2e4", "a7a6", "e4e5", "d7d5");
    await user.click(square("e5"));
    expect(square("d6")).toHaveAttribute("data-target", "capture");
    await user.click(square("d6"));
    expect(on("d6")).toBe("d6, white pawn");
    expect(on("d5")).toBe("d5");
    expect(on("e5")).toBe("e5");
    expect(told()).toBe(
      "White pawn e5 takes black pawn on d5 en passant, and stands on d6. Black to move.",
    );
  });
});

describe("promotion", () => {
  const ready = () => parseFen("7k/4P3/8/8/8/8/8/4K3 w - - 0 1");

  it("asks in a sheet what the pawn becomes", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Chess defaultGame={ready()} onMove={onMove} />);
    await click(user, "e7e8");
    const sheet = await screen.findByRole("dialog", { name: "What should the pawn on e8 become?" });
    expect(
      within(sheet)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Cancel", "Knight", "Bishop", "Rook", "Queen"]);
    // Nothing has moved yet. The window behind its sheet is main and held, so assistive
    // technology is given the sheet alone.
    expect(onMove).not.toHaveBeenCalled();
    const held = screen.getByRole("region", { name: /\)$/, hidden: true });
    expect(held).toHaveAttribute("data-window-state", "main");
    expect(within(held).getByRole("button", { name: "Close", hidden: true })).toBeDisabled();
    expect(
      within(held).getByRole("gridcell", { name: "e7, white pawn", hidden: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("grid")).toBeNull();

    await user.click(within(sheet).getByRole("button", { name: "Rook" }));
    await sheetGone();
    expect(on("e8")).toBe("e8, white rook");
    expect(on("e7")).toBe("e7");
    expect(told()).toBe("White pawn e7 to e8 and becomes a rook. Check. Black to move.");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0]).toMatchObject({ promotion: "rook" });
  });

  it("makes a queen with Return, the default button", async () => {
    const user = userEvent.setup();
    render(<Chess defaultGame={ready()} />);
    act(() => square("e7").focus());
    await user.keyboard("{Enter}{ArrowUp}{Enter}");
    const sheet = await screen.findByRole("dialog");
    await waitFor(() => expect(sheet).toHaveFocus());
    await user.keyboard("{Enter}");
    await sheetGone();
    expect(on("e8")).toBe("e8, white queen");
    expect(told()).toBe("White pawn e7 to e8 and becomes a queen. Check. Black to move.");
  });

  it("leaves the pawn where it is when the sheet is cancelled", async () => {
    // Each step waits for the state it is about (the sheet open, or gone with the board
    // and the announcement as they should be), not for waitFor's 1 s default: under a
    // loaded machine the sheet's close outlasted that default although nothing was wrong.
    // A state that never arrives still fails, after three seconds.
    const patiently = { timeout: 3000 };
    const sheetOpens = () => screen.findByRole("dialog", {}, patiently);
    const settles = (check: () => void) =>
      waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        check();
      }, patiently);
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Chess defaultGame={ready()} onMove={onMove} />);
    await click(user, "e7e8");
    const sheet = await sheetOpens();
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    await settles(() => expect(told()).toBe("White pawn on e7 stays where it is."));
    expect(on("e7")).toBe("e7, white pawn");
    expect(on("e8")).toBe("e8");
    expect(onMove).not.toHaveBeenCalled();
    // Escape cancels too, and the move can still be made afterwards.
    await user.click(square("e8"));
    await sheetOpens();
    await user.keyboard("{Escape}");
    await settles(() => expect(on("e7")).toBe("e7, white pawn"));
    await user.click(square("e8"));
    await user.click(within(await sheetOpens()).getByRole("button", { name: "Knight" }));
    await settles(() => expect(on("e8")).toBe("e8, white knight"));
  }, 15_000);

  it("keeps the pawn picked up when Escape reaches the board before the sheet takes focus", async () => {
    const user = userEvent.setup();
    render(<Chess defaultGame={ready()} />);
    await click(user, "e7e8");
    await screen.findByRole("dialog");
    // The key lands on the square under the opening sheet, as it can before the sheet has
    // moved focus into itself: it cancels the sheet and nothing else.
    fireEvent.keyDown(screen.getByRole("gridcell", { name: "e8", hidden: true }), {
      key: "Escape",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(told()).toBe("White pawn on e7 stays where it is.");
    await user.click(square("e8"));
    expect(await screen.findByRole("dialog", {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

describe("a held game", () => {
  it("shows the owner's game and leaves a move for the owner to apply", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    const start = createGame();
    const { rerender } = render(<Chess game={start} onMove={onMove} />);
    await click(user, "e2e4");
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[0]).toMatchObject({ from: "e2", to: "e4" });
    // The window still shows the owner's game until the owner moves it on.
    expect(on("e2")).toBe("e2, white pawn");
    expect(on("e4")).toBe("e4");
    const moved = play(start, "e2", "e4");
    if (!moved) throw new Error("e2e4 is legal");
    rerender(<Chess game={moved} onMove={onMove} />);
    expect(on("e4")).toBe("e4, white pawn");
    // A move made elsewhere arrives the same way.
    const answered = play(moved, "e7", "e5");
    if (!answered) throw new Error("e7e5 is legal");
    rerender(<Chess game={answered} onMove={onMove} />);
    expect(on("e5")).toBe("e5, black pawn");
  });

  it("refuses what the owner refuses: nothing moves, no callback, the reason is told", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    const onNewGame = vi.fn();
    render(
      <Chess
        onMove={onMove}
        onNewGame={onNewGame}
        refuse={(action) => (action === "move" ? "It is the other player's move." : undefined)}
      />,
    );
    await click(user, "e2e4");
    expect(onMove).not.toHaveBeenCalled();
    expect(told()).toBe("It is the other player's move.");
    expect(on("e2")).toBe("e2, white pawn");
    expect(on("e4")).toBe("e4");
    await user.click(control("New Game"));
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it("refuses a new game that asks first, as it refuses one started at once", async () => {
    const user = userEvent.setup();
    const onNewGameRequest = vi.fn();
    const { rerender } = render(
      <Chess
        newGameLabel="New Game"
        onNewGameRequest={onNewGameRequest}
        refuse={(action) => (action === "new" ? "Still connecting." : undefined)}
      />,
    );
    await user.click(control("New Game"));
    expect(onNewGameRequest).not.toHaveBeenCalled();
    expect(told()).toBe("Still connecting.");
    // Once nothing refuses it, the owner is asked.
    rerender(<Chess newGameLabel="New Game" onNewGameRequest={onNewGameRequest} />);
    await user.click(control("New Game"));
    expect(onNewGameRequest).toHaveBeenCalledTimes(1);
  });
});
