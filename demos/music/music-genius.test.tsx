import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GeniusControls, geniusSongs, readGeniusLists } from "./music-genius";
import type { LibrarySong } from "./music-server";

const song = (id: string, artist: string, genre: string, more: Partial<LibrarySong> = {}) =>
  ({ id, title: id, artist, genre, ...more }) as LibrarySong;
const facts = { plays: {}, loved: new Set<string>() };

describe("Genius playlist", () => {
  const seed = song("seed", "Low Sun", "Folk");

  it("starts on the song, then its artist, then its genre, and leaves the rest out", () => {
    const library = [
      seed,
      song("genre", "Other", "folk"),
      song("artist", "low sun", "Rock"),
      song("both", "Low Sun", "Folk"),
      song("elsewhere", "Other", "Rock"),
    ];
    expect(geniusSongs(seed, library, facts)).toEqual(["seed", "both", "artist", "genre"]);
  });

  it("puts what was loved before what was played, and what was played before the rest", () => {
    const library = [
      song("a", "Other", "Folk"),
      song("b", "Other", "Folk"),
      song("c", "Other", "Folk"),
    ];
    expect(geniusSongs(seed, library, { plays: { b: 9 }, loved: new Set(["c"]) })).toEqual([
      "seed",
      "c",
      "b",
      "a",
    ]);
  });

  it("keeps disliked and unchecked songs out, and holds the size with the song counted", () => {
    const library = [
      song("disliked", "Low Sun", "Folk", { disliked: true }),
      song("unchecked", "Low Sun", "Folk", { unchecked: true }),
      song("a", "Low Sun", "Folk"),
      song("b", "Low Sun", "Folk"),
    ];
    expect(geniusSongs(seed, library, facts, 2)).toEqual(["seed", "a"]);
  });

  it("answers nothing when no other song shares an artist or a genre, an empty one included", () => {
    const blank = song("blank", "", "");
    expect(geniusSongs(blank, [blank, song("x", "", "")], facts)).toEqual([]);
  });

  it("reads back only what is a Genius playlist", () => {
    expect(
      readGeniusLists({
        good: { seed: "s", size: 50 },
        size: { seed: "s", size: 7 },
        seed: { size: 25 },
        none: null,
      }),
    ).toEqual({ good: { seed: "s", size: 50 } });
    expect(readGeniusLists([])).toBeUndefined();
  });

  it("says it was made here, and refreshes", async () => {
    const onRefresh = vi.fn();
    render(
      <GeniusControls seedTitle="Morning" size={25} onSize={() => {}} onRefresh={onRefresh} />,
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "Made on this desktop from the artist and genre of “Morning” and your own library. Apple's Genius service is not part of it.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("cannot refresh once its song has gone", () => {
    render(<GeniusControls seedTitle={null} size={25} onSize={() => {}} onRefresh={() => {}} />);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
  });
});
