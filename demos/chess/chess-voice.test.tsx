// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chess } from "./chess";
import { createGame, parseFen } from "./chess-game";
import { readHeard, readSpoken } from "./chess-voice";

describe("what a spoken sentence asks", () => {
  const start = createGame();

  it.each([
    ["pawn e2 to e4", "e2", "e4"],
    ["E2 to E4", "e2", "e4"],
    ["e2e4", "e2", "e4"],
    ["e two to e four", "e2", "e4"],
    ["e4", "e2", "e4"],
    ["knight to c3", "b1", "c3"],
    ["night see 3", "b1", "c3"],
    ["knight b1 to c3", "b1", "c3"],
  ])("%s moves %s to %s", (words, from, to) => {
    expect(readSpoken(words, start)).toEqual({ kind: "move", from, to });
  });

  it.each([
    ["take back move", "takeBack"],
    ["show last move", "lastMove"],
    ["show hint", "hint"],
    ["rotate board", "rotate"],
    ["new game", "newGame"],
  ])("%s is the command %s", (words, command) => {
    expect(readSpoken(words, start)).toEqual({ kind: "command", command });
  });

  it("understands what Speak Moves says", () => {
    const open = parseFen("4k3/8/8/3p4/4P3/8/8/4K2R w K - 0 1");
    expect(readSpoken("e takes d5", open)).toEqual({ kind: "move", from: "e4", to: "d5" });
    expect(readSpoken("castle kingside", open)).toEqual({ kind: "move", from: "e1", to: "g1" });
  });

  it("asks which one when two pieces fit, and refuses an illegal move", () => {
    const two = parseFen("4k3/8/8/8/8/8/8/R3K2R w - - 0 1");
    expect(readSpoken("rook to d1", two)).toEqual({ kind: "move", from: "a1", to: "d1" });
    expect(readSpoken("rook to f1", two)).toEqual({ kind: "move", from: "h1", to: "f1" });
    const both = parseFen("4k3/8/8/8/8/R6R/8/4K3 w - - 0 1");
    expect(readSpoken("rook to d3", both)).toEqual({
      kind: "refused",
      reason: "Which one: a3 or h3?",
    });
    expect(readSpoken("pawn e2 to e5", start)).toEqual({
      kind: "refused",
      reason: "That is not a legal move: “pawn e2 to e5”.",
    });
    expect(readSpoken("castle kingside", start)).toEqual({
      kind: "refused",
      reason: "Castling is not legal now.",
    });
  });

  it("takes a promotion's piece, and nothing else there", () => {
    const pawn = parseFen("8/4P3/8/8/8/8/k7/4K3 w - - 0 1");
    expect(readSpoken("e7 to e8 knight", pawn)).toEqual({
      kind: "move",
      from: "e7",
      to: "e8",
      promotion: "knight",
    });
    expect(readSpoken("e7 to e8", pawn)).toEqual({ kind: "move", from: "e7", to: "e8" });
  });

  it("knows nothing of other talk, and acts on the first guess it can", () => {
    expect(readSpoken("what a nice day", start)).toBeNull();
    expect(readHeard(["night see three please", "banana"], start)).toEqual({
      kind: "move",
      from: "b1",
      to: "c3",
    });
    expect(readHeard(["banana", "e2 to e5", "e2 to e4"], start)).toEqual({
      kind: "move",
      from: "e2",
      to: "e4",
    });
  });
});

/** Stands in for the browser's recognizer, which jsdom lacks: words are handed to it by the test. */
class Heard {
  static all: Heard[] = [];
  lang = "";
  interimResults = true;
  continuous = false;
  maxAlternatives = 1;
  onresult: ((event: { results: unknown }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  said: string[][] = [];
  stopped = false;
  constructor() {
    Heard.all.push(this);
  }
  start() {}
  stop() {
    this.stopped = true;
  }
  say(...alternatives: string[]) {
    this.said.push(alternatives);
    const results = this.said.map((each) =>
      Object.assign(
        each.map((transcript) => ({ transcript })),
        { isFinal: true },
      ),
    );
    act(() => this.onresult?.({ results }));
  }
}

const status = () => document.querySelector(".mac-chess-status")?.textContent;

const squareLabel = (name: string) =>
  document.querySelector(`[data-square="${name}"]`)?.getAttribute("aria-label");

describe("Chess listening", () => {
  beforeEach(() => {
    Heard.all = [];
    vi.stubGlobal("webkitSpeechRecognition", Heard);
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays a spoken move on the board, each thing said once", () => {
    render(<Chess listen />);
    const heard = Heard.all[0] as Heard;
    expect(screen.getByText("Listening")).toBeTruthy();
    expect(heard.lang).toBe("en-US");
    expect(heard.maxAlternatives).toBe(5);
    heard.say("pawn e2 to e4");
    expect(squareLabel("e4")).toBe("e4, white pawn");
    heard.say("pawn e7 to e5");
    expect(squareLabel("e5")).toBe("e5, black pawn");
    expect(squareLabel("e4")).toBe("e4, white pawn");
  });

  it("says what it could not do in the status line", () => {
    render(<Chess listen />);
    const heard = Heard.all[0] as Heard;
    heard.say("pawn e2 to e5");
    expect(status()).toBe("That is not a legal move: “pawn e2 to e5”.");
    heard.say("take back move");
    expect(status()).toBe("That command is not available on this board.");
    heard.say("banana");
    expect(document.querySelector(".mac-chess-status")?.textContent).toMatch(
      /^Chess did not understand “banana”\./,
    );
  });

  it("obeys a refusal, and hands other commands to the owner", () => {
    const onSpokenCommand = vi.fn(() => "Nothing to take back.");
    render(
      <Chess listen onSpokenCommand={onSpokenCommand} refuse={() => "It is the other player's."} />,
    );
    const heard = Heard.all[0] as Heard;
    heard.say("e4");
    expect(squareLabel("e2")).toBe("e2, white pawn");
    expect(status()).toBe("It is the other player's.");
    heard.say("take back move");
    expect(onSpokenCommand).toHaveBeenCalledWith("takeBack");
    expect(status()).toBe("Nothing to take back.");
  });

  it("starts again after a silence, stops for a refused microphone, and listens only in front", () => {
    const { rerender } = render(<Chess listen />);
    const first = Heard.all[0] as Heard;
    act(() => first.onend?.());
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(Heard.all).toHaveLength(2);
    const second = Heard.all[1] as Heard;
    act(() => second.onerror?.({ error: "not-allowed" }));
    act(() => second.onend?.());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(Heard.all).toHaveLength(2);
    expect(screen.queryByText("Listening")).toBeNull();
    expect(document.querySelector(".mac-chess-status")?.textContent).toBe(
      "Chess can’t hear you: the microphone or the browser’s speech service is not available.",
    );
    rerender(<Chess listen state="inactive" />);
    expect(second.stopped).toBe(true);
    expect(document.querySelector(".mac-chess-status")?.textContent).toMatch(/^White to move/);
  });
});
