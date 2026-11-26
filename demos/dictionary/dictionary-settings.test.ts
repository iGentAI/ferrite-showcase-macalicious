import { describe, expect, it } from "vitest";
import { inAccent, readAccent, readSources, shownSources } from "./dictionary-settings";

describe("the accent Preferences keeps", () => {
  const entry = {
    word: "tomato",
    dictionary: {
      syllables: "tomato",
      part: "noun",
      senses: [],
      pronunciation: "/first/",
      audio: "https://example.org/first.mp3",
      accents: {
        uk: { pronunciation: "/uk/", audio: "https://example.org/uk.mp3" },
        us: { audio: "https://example.org/us.mp3" },
      },
    },
  };

  it("says the word in the accent chosen, keeping what that accent lacks", () => {
    expect(inAccent(entry, "uk").dictionary).toMatchObject({
      pronunciation: "/uk/",
      audio: "https://example.org/uk.mp3",
    });
    expect(inAccent(entry, "us").dictionary).toMatchObject({
      pronunciation: "/first/",
      audio: "https://example.org/us.mp3",
    });
  });

  it("leaves an entry with no such accent, and reads only the accents it offers", () => {
    const { accents: _none, ...dictionary } = entry.dictionary;
    expect(inAccent({ ...entry, dictionary }, "uk").dictionary?.pronunciation).toBe("/first/");
    expect(["uk", "us", "au", 3].map(readAccent)).toEqual(["uk", "us", undefined, undefined]);
  });
});

describe("the sources Preferences keeps", () => {
  it("keeps the person's order and puts a source it does not name last", () => {
    expect(readSources({ order: ["wikipedia", "dictionary"], off: [] })?.order).toEqual([
      "wikipedia",
      "dictionary",
      "thesaurus",
      "apple",
    ]);
  });

  it("ignores what it does not know, and repeats", () => {
    expect(
      readSources({ order: ["apple", "apple", "nonsense", 3], off: ["nonsense", "thesaurus"] }),
    ).toEqual({
      order: ["apple", "dictionary", "thesaurus", "wikipedia"],
      off: ["thesaurus"],
    });
    expect(readSources("nonsense")).toBeUndefined();
  });

  it("shows the sources turned on, in the order", () => {
    expect(
      shownSources({
        order: ["wikipedia", "apple", "dictionary", "thesaurus"],
        off: ["apple"],
      }).map((source) => source.title),
    ).toEqual(["Wikipedia", "Dictionary", "Thesaurus"]);
  });
});
