import { describe, expect, it } from "vitest";
import { type LibrarySong, libraryReadable } from "./music-server";
import { ruleProblem, smartSongs } from "./music-smart";

const DAY = 86_400_000;
const NOW = 100 * DAY;
const song = (id: string, part: Partial<LibrarySong>): LibrarySong =>
  ({
    id,
    title: id,
    artist: "",
    album: "",
    genre: "",
    year: null,
    track: null,
    duration: 1,
    added: NOW,
    artwork: null,
    source: { kind: "file", name: id },
    ...part,
  }) as LibrarySong;

const songs = [
  song("a", { artist: "Nina Blue", genre: "Jazz", year: 1960, added: NOW - 30 * DAY }),
  song("b", { artist: "Tom Blue", genre: "Rock", year: 1999, added: NOW - 2 * DAY }),
  song("c", { artist: "Red", genre: "Jazz", added: NOW - DAY }),
];
const facts = { plays: { b: 3 }, loved: new Set(["c"]), now: NOW };
const ids = (rules: Parameters<typeof smartSongs>[0]["rules"], all = true, limit?: number) =>
  smartSongs({ all, rules, limit }, songs, facts).map((one) => one.id);

describe("Music's smart playlists", () => {
  it("reads a library's rules only when their whole shape is right", () => {
    const reads = (smart: unknown) =>
      libraryReadable({
        library: {
          songs: [],
          loved: [],
          playlists: [{ id: "p", name: "P", songs: [], smart }],
        },
        rev: 1,
      });
    const rule = { field: "artist", op: "contains", value: "Blue" };
    expect(reads({ all: true, rules: [rule] })).toBe(true);
    expect(reads({ all: false, rules: [rule], limit: 5 })).toBe(true);
    expect(reads({ rules: [rule] })).toBe(false);
    expect(reads({ all: true, rules: [null] })).toBe(false);
    expect(reads({ all: true, rules: [{ ...rule, field: "path" }] })).toBe(false);
    expect(reads({ all: true, rules: [{ ...rule, op: "like" }] })).toBe(false);
    expect(reads({ all: true, rules: [{ ...rule, value: 3 }] })).toBe(false);
  });

  it("reads text without regard to case", () => {
    expect(ids([{ field: "artist", op: "contains", value: "BLUE" }])).toEqual(["a", "b"]);
    expect(ids([{ field: "artist", op: "not-contains", value: "blue" }])).toEqual(["c"]);
    expect(ids([{ field: "genre", op: "is", value: "jazz" }])).toEqual(["a", "c"]);
    expect(ids([{ field: "artist", op: "starts", value: "tom" }])).toEqual(["b"]);
    expect(ids([{ field: "artist", op: "ends", value: "red" }])).toEqual(["c"]);
  });

  it("reads numbers, and a song without a year is only ever not that year", () => {
    expect(ids([{ field: "year", op: "greater", value: "1970" }])).toEqual(["b"]);
    expect(ids([{ field: "year", op: "less", value: "1970" }])).toEqual(["a"]);
    expect(ids([{ field: "year", op: "is-not", value: "1960" }])).toEqual(["b", "c"]);
    expect(ids([{ field: "plays", op: "greater", value: "2" }])).toEqual(["b"]);
  });

  it("reads Loved and the date added", () => {
    expect(ids([{ field: "loved", op: "is", value: "" }])).toEqual(["c"]);
    expect(ids([{ field: "added", op: "in-last", value: "7" }])).toEqual(["b", "c"]);
    expect(ids([{ field: "added", op: "not-in-last", value: "7" }])).toEqual(["a"]);
  });

  it("matches all or any of the rules", () => {
    const rules = [
      { field: "genre", op: "is", value: "jazz" },
      { field: "artist", op: "contains", value: "blue" },
    ] as const;
    expect(ids([...rules], true)).toEqual(["a"]);
    expect(ids([...rules], false)).toEqual(["a", "b", "c"]);
  });

  it("a limit keeps the most recently added, in the library's order", () => {
    expect(ids([{ field: "genre", op: "contains", value: "" }], true, 2)).toEqual(["b", "c"]);
  });

  it("refuses an empty value and a number that is not whole", () => {
    expect(ruleProblem({ field: "artist", op: "is", value: " " })).toBe(
      "Every rule needs a value.",
    );
    expect(ruleProblem({ field: "year", op: "is", value: "19.5" })).toBe(
      "Year, Plays and days are whole numbers.",
    );
    expect(ruleProblem({ field: "loved", op: "is", value: "" })).toBeNull();
    expect(ruleProblem({ field: "year", op: "is", value: "1999" })).toBeNull();
  });
});
