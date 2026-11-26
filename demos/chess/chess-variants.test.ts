import { describe, expect, it } from "vitest";
import { chooseMove } from "./chess-engine";
import {
  CHESS_START,
  type ChessGame,
  type ChessVariant,
  createGame,
  describeMove,
  describeStatus,
  drawClaim,
  drop,
  gameStatus,
  legalMoves,
  parseFen,
  play,
  toFen,
} from "./chess-game";
import { notationOf, readPgn, writePgn } from "./chess-pgn";

function playAll(variant: ChessVariant, ...moves: string[]): ChessGame {
  let game = createGame(variant);
  for (const move of moves) {
    const next = play(game, move.slice(0, 2), move.slice(2, 4));
    if (!next) throw new Error(`${move} is refused`);
    game = next;
  }
  return game;
}

describe("a game's position in Forsyth-Edwards Notation", () => {
  it("reads back a Crazyhouse position with its hands and its promoted piece", () => {
    const fen = "4k3/Q~7/8/8/8/8/8/4K3[Pn] w - - 3 9";
    const game = parseFen(fen, "crazyhouse");
    expect(game.hands).toEqual({ white: ["pawn"], black: ["knight"] });
    expect(game.promoted).toEqual([48]);
    expect(toFen(game)).toBe(fen);
    expect(toFen(parseFen(toFen(game), "crazyhouse"))).toBe(fen);
  });

  it("tells a promoted piece from a native one when counting repetitions", () => {
    const promoted = parseFen("4k3/Q~7/8/8/8/8/8/4K3[] w - - 0 1", "crazyhouse");
    const native = parseFen("4k3/Q7/8/8/8/8/8/4K3[] w - - 0 1", "crazyhouse");
    expect(promoted.positions).not.toEqual(native.positions);
  });

  it("reads back a Suicide position with no kings left", () => {
    const fen = "8/8/8/8/8/8/P7/8 b - - 0 20";
    expect(toFen(parseFen(fen, "suicide"))).toBe(fen);
    expect(() => parseFen(fen)).toThrow(SyntaxError);
  });

  it("keeps ordinary positions to their six fields, with no hands or marks", () => {
    expect(() => parseFen("4k3/Q~7/8/8/8/8/8/4K3 w - - 0 1")).toThrow(SyntaxError);
    expect(toFen(createGame())).toBe(CHESS_START);
    expect(toFen(createGame("losers"))).toBe(CHESS_START);
  });
});

describe("Suicide's positions", () => {
  it("have no castling rights to tell two alike apart: a king's trip comes back to the same one", () => {
    const game = playAll("suicide", "g1f3", "g8f6", "h1g1", "h8g8", "g1h1", "g8h8", "f3g1", "f6g8");
    expect(game.positions.at(-1)).toBe(game.positions[0]);
    expect(toFen(createGame("suicide"))).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
    );
  });
});

describe("Crazyhouse drops", () => {
  it("count a pawn dropped as a pawn move, which starts the fifty moves again", () => {
    const taken = playAll("crazyhouse", "e2e4", "d7d5", "e4d5", "g8f6", "g1f3");
    expect(taken.halfmoveClock).toBe(2);
    const held = play(taken, "f6", "g8");
    const pawn = held && drop(held, "pawn", "e4");
    expect(held?.halfmoveClock).toBe(3);
    expect(pawn?.halfmoveClock).toBe(0);
  });

  it("name no square the computer's dropped piece leaves", () => {
    const game = parseFen("4k3/8/8/8/8/8/8/4K3[Q] w - - 0 1", "crazyhouse");
    const move = chooseMove(game, 1, {
      random: () => 0,
      budgetMs: 200,
    });
    if (move?.drop) expect(move).not.toHaveProperty("from");
    expect(move).not.toBeNull();
  });
});

describe("Losers", () => {
  it("makes a capture compulsory", () => {
    const game = playAll("losers", "e2e4", "d7d5");
    expect(legalMoves(game).map((move) => `${move.from}${move.to}`)).toEqual(["e4d5"]);
    expect(play(game, "g1", "f3")).toBeNull();
  });

  it("still will not let a king walk into check", () => {
    const game = playAll("losers", "e2e4", "e7e5", "d1h5", "a7a6");
    expect(legalMoves(game, "h5").map((move) => move.to)).toEqual(expect.arrayContaining(["e5"]));
  });
});

describe("Suicide", () => {
  it("has a king that can be taken, no check and no castling", () => {
    const game = playAll("suicide", "e2e4", "e7e5", "e1e2", "d8h4", "e2e3", "h4e4");
    expect(gameStatus(game)).toEqual({ state: "playing", check: false });
    expect(legalMoves(game).map((move) => `${move.from}${move.to}`)).toEqual(["e3e4"]);
    const free = playAll("suicide", "g1f3", "g8f6", "g2g3", "g7g6", "f1g2", "f8g7");
    expect(legalMoves(free, "e1").map((move) => move.to)).toEqual(["f1"]);
  });

  it("lets the side with no move win, and says so", () => {
    const game = createGame("suicide");
    const bare: ChessGame = {
      ...game,
      board: game.board.map((piece, index) => (index === 8 ? piece : null)),
      turn: "black",
    };
    expect(gameStatus(bare)).toEqual({ state: "won", winner: "black", reason: "no-pieces" });
    expect(describeStatus(bare)).toBe("Black has lost all it could and wins.");
  });
});

describe("Crazyhouse", () => {
  const taken = playAll("crazyhouse", "e2e4", "d7d5", "e4d5", "d8d5");

  it("puts a piece taken in the taker's hand", () => {
    expect(taken.hands).toEqual({ white: ["pawn"], black: ["pawn"] });
  });

  it("drops a piece from the hand on an empty square", () => {
    const dropped = drop(taken, "pawn", "e4");
    expect(dropped?.hands.white).toEqual([]);
    expect(dropped?.board[28]).toEqual({ side: "white", kind: "pawn" });
    expect(dropped?.turn).toBe("black");
    expect(describeMove(dropped?.moves.at(-1) as never)).toBe("White drops a pawn on e4.");
  });

  it("refuses a drop on a piece, on the last rank, or of what is not in hand", () => {
    expect(drop(taken, "pawn", "e1")).toBeNull();
    expect(drop(taken, "pawn", "a8")).toBeNull();
    expect(drop(taken, "pawn", "d5")).toBeNull();
    expect(drop(taken, "queen", "e4")).toBeNull();
    expect(drop(createGame(), "pawn", "e4")).toBeNull();
  });

  it("gives a promoted piece back as a pawn", () => {
    const game = playAll(
      "crazyhouse",
      "a2a4",
      "b7b5",
      "a4b5",
      "a7a6",
      "b5a6",
      "c8b7",
      "a6b7",
      "h7h6",
      "b7a8",
      "h6h5",
      "a8b8",
      "d8b8",
    );
    expect(game.board[57]).toEqual({ side: "black", kind: "queen" });
    expect(game.hands.black).toEqual(["pawn"]);
  });

  it("counts the starting position among the repetitions", () => {
    const dance = ["g1f3", "g8f6", "f3g1", "f6g8"];
    const game = playAll("crazyhouse", ...dance, ...dance);
    expect(drawClaim(game)).toBe("repetition");
  });

  it("tells a promoted piece from a native one when it counts repetitions", () => {
    const native = createGame("crazyhouse");
    const promoted: ChessGame = { ...native, promoted: [3] };
    expect(play(promoted, "e2", "e4")?.positions.at(-1)).not.toBe(
      play(native, "e2", "e4")?.positions.at(-1),
    );
  });

  it("writes drops in notation, and reads them back from a file", () => {
    const moves = [
      { from: "e2", to: "e4" },
      { from: "d7", to: "d5" },
      { from: "e4", to: "d5" },
      { from: "d8", to: "d5" },
      { from: "", to: "e4", drop: "pawn" as const },
    ];
    expect(notationOf(moves, "crazyhouse").at(-1)).toBe("P@e4");
    const text = writePgn({
      white: "A",
      black: "B",
      moves,
      result: "*",
      date: new Date(0),
      variant: "crazyhouse",
    });
    expect(text).toContain('[Variant "Crazyhouse"]');
    const read = readPgn(text);
    expect(read).toMatchObject({ variant: "crazyhouse" });
    expect("moves" in read && read.moves.at(-1)).toEqual({
      from: "",
      to: "e4",
      drop: "pawn",
    });
  });
});

describe("the computer in a variant", () => {
  const never = () => 0;

  it("plays only the capture Losers leaves it", () => {
    const game = playAll("losers", "e2e4", "d7d5");
    expect(chooseMove(game, 2, { random: never })).toMatchObject({ from: "e4", to: "d5" });
  });

  it("may drop what it holds in Crazyhouse, and the drop is legal", () => {
    const game = playAll("crazyhouse", "e2e4", "d7d5", "e4d5", "d8d5", "b1c3", "d5d4");
    const move = chooseMove(game, 2, { random: never });
    expect(move).not.toBeNull();
    const next =
      move?.drop !== undefined
        ? drop(game, move.drop, move.to)
        : play(game, move?.from ?? "", move?.to ?? "", move?.promotion);
    expect(next).not.toBeNull();
  });
});
