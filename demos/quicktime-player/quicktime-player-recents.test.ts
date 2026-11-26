import { describe, expect, it } from "vitest";
import { mergeRecents, RECENTS_LIMITS } from "./quicktime-player-recents";

const movie = (file: string, at: number, position = 0) => ({ file, name: file, at, position });
const list = (count: number, from = 0) =>
  Array.from({ length: count }, (_, n) => movie(`f${from + n}`, 1_000 - from - n));

describe("mergeRecents", () => {
  it("keeps each side's new movie, newest first, within the server's limit", () => {
    const full = list(RECENTS_LIMITS.recents);
    // Each browser opened a movie of its own, and each dropped the oldest to make room.
    const mine = { recents: [movie("mine", 2_000), ...full.slice(0, -1)] };
    const theirs = { recents: [movie("theirs", 3_000), ...full.slice(0, -1)] };
    const merged = mergeRecents({ recents: full }, mine, theirs) as { recents: { file: string }[] };
    expect(merged.recents).toHaveLength(RECENTS_LIMITS.recents);
    expect(merged.recents.slice(0, 2).map((recent) => recent.file)).toEqual(["theirs", "mine"]);
  });

  it("keeps the place the other browser saved in a movie this one did not touch", () => {
    const base = { recents: [movie("a", 10, 0), movie("b", 5, 0)] };
    const mine = { recents: [movie("b", 20, 30), movie("a", 10, 0)] };
    const theirs = { recents: [movie("a", 10, 90), movie("b", 5, 0)] };
    expect(mergeRecents(base, mine, theirs)).toEqual({
      recents: [movie("b", 20, 30), movie("a", 10, 90)],
    });
  });
});
