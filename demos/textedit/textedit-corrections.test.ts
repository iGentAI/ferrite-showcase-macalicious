import { describe, expect, it, vi } from "vitest";
import { loadWords } from "../desktop/text-spelling";
import { correctionOf, correctTypedWord, KNOWN_MISSPELLINGS } from "./textedit-corrections";

const NOBODY: ReadonlySet<string> = new Set();

describe("what a word is corrected to", () => {
  it("corrects listed misspellings, keeping a leading capital", () => {
    expect(correctionOf("teh", NOBODY)).toBe("the");
    expect(correctionOf("Teh", NOBODY)).toBe("The");
    expect(correctionOf("alot", NOBODY)).toBe("a lot");
  });

  it("leaves names, unknown words, acronyms and taught words alone", () => {
    expect(correctionOf("Lovelace", NOBODY)).toBeUndefined();
    expect(correctionOf("zzyzx", NOBODY)).toBeUndefined();
    expect(correctionOf("constructor", NOBODY)).toBeUndefined();
    expect(correctionOf("TEH", NOBODY)).toBeUndefined();
    expect(correctionOf("tEh", NOBODY)).toBeUndefined();
    expect(correctionOf("teh", new Set(["teh"]))).toBeUndefined();
  });

  it("lists no real word, and corrects only to real words", async () => {
    const words = await loadWords();
    const entries = Object.entries(KNOWN_MISSPELLINGS);
    expect(entries.filter(([wrong]) => words.has(wrong))).toEqual([]);
    expect(
      entries.filter(([, right]) => !right.split(" ").every((each) => words.has(each))),
    ).toEqual([]);
  });
});

describe("correcting as a person types", () => {
  /** A text area whose caret is at its end; the browser's text command is a stand-in jsdom lacks. */
  function field(value: string) {
    const element = document.createElement("textarea");
    element.value = value;
    document.body.append(element);
    element.setSelectionRange(value.length, value.length);
    const command = vi.fn((_name: string, _ui: boolean, text: string) => {
      element.setRangeText(text, element.selectionStart, element.selectionEnd, "end");
      return true;
    });
    Object.assign(document, { execCommand: command });
    return { element, command };
  }

  it("replaces the word and the character that ended it", () => {
    const { element } = field("so teh ");
    expect(correctTypedWord(element, " ", NOBODY, false)).toBe(true);
    expect(element.value).toBe("so the ");
    expect(element.selectionStart).toBe(7);
  });

  it("corrects before a Return, which has not gone in yet", () => {
    const { element } = field("teh");
    expect(correctTypedWord(element, "", NOBODY, false)).toBe(true);
    expect(element.value).toBe("the");
  });

  it.each([
    ["a letter was typed", "teh", "h"],
    ["a name was finished", "Ada ", " "],
    ["the word is part of an address", "ada@teh ", " "],
    ["the word is part of a compound", "re-teh ", " "],
    ["the word ends in a digit", "teh2 ", " "],
  ])("does nothing when %s", (_why, value, typed) => {
    const { element, command } = field(value);
    expect(correctTypedWord(element, typed, NOBODY, false)).toBe(false);
    expect(element.value).toBe(value);
    expect(command).not.toHaveBeenCalled();
  });
});
