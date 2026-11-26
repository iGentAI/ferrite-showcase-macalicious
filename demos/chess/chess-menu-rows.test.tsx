// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createGame, play } from "./chess-game";
import { useSpokenMoves } from "./chess-preferences";
import { printedPage } from "./chess-print";
import { readRecentFiles, withRecentFile } from "./chess-recent";
import { spokenMove } from "./chess-speech";

describe("Speak moves", () => {
  it("says each new move, not the game it opens on, and nothing when switched off", () => {
    const said: string[] = [];
    vi.stubGlobal("speechSynthesis", {
      cancel: () => {},
      speak: (utterance: { text: string }) => said.push(utterance.text),
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    const { rerender } = renderHook(({ game, moves, on }) => useSpokenMoves(game, moves, on), {
      initialProps: { game: "a", moves: ["e4"], on: true },
    });
    expect(said).toEqual([]);
    rerender({ game: "a", moves: ["e4", "Nf6"], on: true });
    expect(said).toEqual(["Knight f6"]);
    rerender({ game: "b", moves: ["d4", "d5", "c4"], on: true });
    expect(said).toEqual(["Knight f6"]);
    rerender({ game: "b", moves: ["d4", "d5", "c4", "e6"], on: false });
    expect(said).toEqual(["Knight f6"]);
    vi.unstubAllGlobals();
  });

  it.each([
    ["e4", "e4"],
    ["Nf3", "Knight f3"],
    ["exd5", "e takes d5"],
    ["Bxe5+", "Bishop takes e5, check"],
    ["Qh7#", "Queen h7, checkmate"],
    ["O-O", "Castle kingside"],
    ["O-O-O+", "Castle queenside, check"],
    ["Nbd2", "Knight b d2"],
    ["e8=Q+", "e8, promotes to queen, check"],
    ["N@e5", "Knight drops on e5"],
  ])("%s reads as %s", (notation, sentence) => {
    expect(spokenMove(notation)).toBe(sentence);
  });
});

describe("Game > Print", () => {
  const game = play(createGame(), "e2", "e4");
  if (!game) throw new Error("e4 must be legal");
  const page = (rotated: boolean) =>
    new DOMParser().parseFromString(
      printedPage({ white: "Ann <A>", black: "Computer", game, moves: ["e4"], rotated }),
      "text/html",
    );

  it("puts the position shown on the page, with the players and moves", () => {
    const doc = page(false);
    expect(doc.querySelector("h1")?.textContent).toBe("Ann <A> v Computer");
    expect(doc.querySelector('[data-square="e4"]')?.textContent).toBe("♟");
    expect(doc.querySelector('[data-square="e4"] span')?.className).toBe("white");
    expect(doc.querySelector('[data-square="e2"]')).toBeNull();
    expect(doc.querySelector("li")?.textContent).toBe("e4");
  });

  it("faces the board as the window does", () => {
    expect(page(false).querySelector("tr th")?.textContent).toBe("8");
    expect(page(true).querySelector("tr th")?.textContent).toBe("1");
  });
});

describe("Game > Open Recent", () => {
  it("lists a game once, newest first, ten at most", () => {
    let list = withRecentFile([], { id: "a", name: "a.pgn" });
    list = withRecentFile(list, { id: "b", name: "b.pgn" });
    list = withRecentFile(list, { id: "a", name: "a.pgn" });
    expect(list.map((each) => each.id)).toEqual(["a", "b"]);
    for (let index = 0; index < 12; index++) {
      list = withRecentFile(list, { id: `n${index}`, name: "n.pgn" });
    }
    expect(list).toHaveLength(10);
    expect(list[0]?.id).toBe("n11");
  });

  it("reads back only what is a file", () => {
    expect(readRecentFiles("no")).toBeUndefined();
    expect(readRecentFiles([{ id: "a", name: "a.pgn", extra: 1 }, { id: 1 }, null])).toEqual([
      { id: "a", name: "a.pgn" },
    ]);
  });
});
