import { describe, expect, it } from "vitest";
import { claimDraw, createGame, legalMoves, play } from "./chess-game";
import { isPgn, notationOf, pgnFileName, pgnResult, readPgn, writePgn } from "./chess-pgn";

const MATE = [
  { from: "f2", to: "f3" },
  { from: "e7", to: "e5" },
  { from: "g2", to: "g4" },
  { from: "d8", to: "h4" },
];

describe("notationOf", () => {
  it("writes moves, checkmate and castling as PGN does", () => {
    expect(notationOf(MATE)).toEqual(["f3", "e5", "g4", "Qh4#"]);
    expect(
      notationOf([
        { from: "e2", to: "e4" },
        { from: "e7", to: "e5" },
        { from: "g1", to: "f3" },
        { from: "b8", to: "c6" },
        { from: "f1", to: "c4" },
        { from: "g8", to: "f6" },
        { from: "e1", to: "g1" },
      ]),
    ).toEqual(["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O"]);
  });

  it("names the file or rank where two pieces could reach a square", () => {
    expect(
      notationOf([
        { from: "g1", to: "f3" },
        { from: "g8", to: "f6" },
        { from: "b1", to: "c3" },
        { from: "b8", to: "c6" },
        { from: "f3", to: "e5" },
        { from: "f6", to: "e4" },
        { from: "c3", to: "e4" },
      ]).at(-1),
    ).toBe("Nxe4");
    const rivals = notationOf([
      { from: "g1", to: "f3" },
      { from: "e7", to: "e6" },
      { from: "b1", to: "c3" },
      { from: "e6", to: "e5" },
      { from: "c3", to: "e4" },
      { from: "a7", to: "a6" },
      { from: "e4", to: "g5" },
      { from: "a6", to: "a5" },
      { from: "g5", to: "f7" },
      { from: "e8", to: "f7" },
      { from: "f3", to: "g5" },
    ]);
    expect(rivals.at(-1)).toBe("Ng5+");
  });

  it("stops at a move the rules refuse", () => {
    expect(notationOf([{ from: "e2", to: "e5" }])).toEqual([]);
  });
});

describe("writePgn and readPgn", () => {
  const written = writePgn({
    white: 'Ana "The Rook"',
    black: "Level 1",
    moves: MATE,
    result: "0-1",
    date: new Date("2026-11-03T12:00:00Z"),
  });

  it("writes the tags and the numbered moves", () => {
    expect(written).toBe(
      `[Event "Casual Game"]
[Site "Chess"]
[Date "2026.11.03"]
[Round "-"]
[White "Ana \\"The Rook\\""]
[Black "Level 1"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
`,
    );
  });

  it("reads back what it wrote", () => {
    expect(readPgn(written)).toEqual({
      white: 'Ana "The Rook"',
      black: "Level 1",
      moves: MATE,
      result: "0-1",
    });
  });

  it("keeps a file's result, however the game ended, through a save", () => {
    for (const result of ["1-0", "0-1", "1/2-1/2"]) {
      const read = readPgn(`[Result "${result}"]\n\n1. e4 e5 ${result}`);
      expect(read).toMatchObject({ result });
      const moves = "moves" in read ? read.moves : [];
      const again = writePgn({ white: "W", black: "B", moves, result, date: new Date(0) });
      expect(again).toContain(`[Result "${result}"]`);
      expect(again.trim().endsWith(`1. e4 e5 ${result}`)).toBe(true);
    }
    expect(readPgn('[Result "1-0"]\n\n1. e4 e5')).toMatchObject({ result: "1-0" });
    expect(readPgn("1. e4 e5")).toMatchObject({ result: "*" });
  });

  it("reads what other programs write: comments, variations, annotations, 0-0 castling", () => {
    const read = readPgn(`[White "A"]
[Black "B"]

1. e4 {best by test} e5 2. Nf3! (2. f4 exf4 {gambit}) Nc6?! $1 ; the rest of the line
3. Bc4 Nf6 4. 0-0 *`);
    expect("moves" in read && read.moves.at(-1)).toEqual({ from: "e1", to: "g1" });
    expect("moves" in read && read.moves).toHaveLength(7);
  });

  it("reads a game whose comments and annotations touch its moves", () => {
    const twoMoves = {
      moves: [
        { from: "e2", to: "e4" },
        { from: "e7", to: "e5" },
      ],
    };
    expect(readPgn("1.e4{comment}e5 *")).toMatchObject(twoMoves);
    expect(readPgn("1.e4$1 e5 *")).toMatchObject(twoMoves);
    expect(readPgn("1. e4 (1. d4 ; a comment with a ) in it\n d5) 1... e5 *")).toMatchObject(
      twoMoves,
    );
    expect(readPgn("1. e4 ( 1. d4 ( 1. c4 ) d5 ) e5 *")).toMatchObject(twoMoves);
  });

  it("reads only the first game of a collection, with only its own tags", () => {
    const read = readPgn(`[White "First"]

1. e4 e5

[White "Second"]
[Black "Set up"]
[Result "1-0"]
[FEN "8/8/8/8/8/8/8/K1k5 w - - 0 1"]

1. Kb1 1-0`);
    expect(read).toEqual({
      white: "First",
      black: undefined,
      moves: [
        { from: "e2", to: "e4" },
        { from: "e7", to: "e5" },
      ],
      result: "*",
    });
  });

  it("reads a promotion", () => {
    const read = readPgn("1. a4 b5 2. axb5 a6 3. bxa6 Bb7 4. axb7 Nc6 5. bxa8=N *");
    expect("moves" in read && read.moves.at(-1)).toEqual({
      from: "b7",
      to: "a8",
      promotion: "knight",
    });
  });

  it("says why a file cannot be opened", () => {
    expect(readPgn("1. e4 e4")).toEqual({ problem: "Move 1 (“e4”) is not a legal move here." });
    expect(readPgn("")).toEqual({ problem: "This file holds no moves." });
    expect(readPgn('[FEN "8/8/8/8/8/8/8/K1k5 w - - 0 1"]\n\n1. Kb1 *')).toEqual({
      problem: "This game starts from a set-up position, which Chess cannot open.",
    });
  });

  it("keeps a line of moves under 80 characters", () => {
    let game = createGame();
    const moves = [];
    while (moves.length < 80) {
      const [first] = legalMoves(game);
      if (!first) break;
      moves.push({ from: first.from, to: first.to });
      const next = play(game, first.from, first.to);
      if (!next) break;
      game = next;
    }
    const text = writePgn({ white: "W", black: "B", moves, result: "*", date: new Date(0) });
    for (const line of text.split("\n")) expect(line.length).toBeLessThan(80);
    expect(readPgn(text)).toMatchObject({ moves });
  });
});

describe("the file's small parts", () => {
  it("says the result", () => {
    expect(pgnResult(createGame())).toBe("*");
    expect(pgnResult(createGame(), "black")).toBe("0-1");
  });
  it("says a claimed draw is a draw, as the server's plies replay it", () => {
    let game = createGame();
    for (let round = 0; round < 2; round += 1) {
      for (const [from, to] of [
        ["g1", "f3"],
        ["g8", "f6"],
        ["f3", "g1"],
        ["f6", "g8"],
      ] as const) {
        game = play(game, from, to) ?? game;
      }
    }
    expect(pgnResult(game)).toBe("*");
    expect(pgnResult(claimDraw(game) ?? game)).toBe("1/2-1/2");
  });
  it("keeps the extension however long the names are", () => {
    const name = pgnFileName("W".repeat(200), "B".repeat(200));
    expect(isPgn(name)).toBe(true);
    expect(name.length).toBeLessThanOrEqual(124);
  });
  it("makes a safe name and knows the extension", () => {
    expect(pgnFileName("A/B", "C:D")).toBe("A B vs C D.pgn");
    expect(isPgn("game.PGN")).toBe(true);
    expect(isPgn("game.txt")).toBe(false);
  });
});
