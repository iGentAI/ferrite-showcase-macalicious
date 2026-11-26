import { describe, expect, it } from "vitest";
import type { BooksHighlight } from "./books-server";
import {
  BookText,
  characterStart,
  cut,
  emphasisPieces,
  excerpt,
  findAll,
  findAllRead,
  pageEnd,
  pageNumbers,
  pageStart,
  printedPage,
  runsOf,
  skipSpace,
  withoutMarks,
  wordStart,
} from "./books-text";

/** A page that holds `n` characters. */
const holds = (n: number) => (slice: string) => slice.length <= n;

describe("Project Gutenberg's underscores", () => {
  const shown = (text: string) =>
    emphasisPieces(text).map(({ from, to, kind }) => [kind, text.slice(from, to)]);

  it("sets off the words between two marks, and keeps every character", () => {
    expect(shown("It was _very_ good.")).toEqual([
      ["plain", "It was "],
      ["mark", "_"],
      ["em", "very"],
      ["mark", "_"],
      ["plain", " good."],
    ]);
    expect(shown('"_Alice!_"')).toEqual([
      ["plain", '"'],
      ["mark", "_"],
      ["em", "Alice!"],
      ["mark", "_"],
      ["plain", '"'],
    ]);
  });

  it("leaves an underscore inside a word, a rule, and one with space on both sides", () => {
    expect(shown("snake_case")).toEqual([["plain", "snake_case"]]);
    expect(shown("Name: ____ here")).toEqual([["plain", "Name: ____ here"]]);
    expect(shown("a _ b")).toEqual([["plain", "a _ b"]]);
  });

  it("finishes an emphasis a page break cuts in two, on either page", () => {
    expect(shown("said _very")).toEqual([
      ["plain", "said "],
      ["mark", "_"],
      ["em", "very"],
    ]);
    expect(shown("very good_ said")).toEqual([
      ["em", "very good"],
      ["mark", "_"],
      ["plain", " said"],
    ]);
  });

  it("ends an emphasis with no closing mark at its paragraph", () => {
    expect(shown("_one\n\ntwo")).toEqual([
      ["mark", "_"],
      ["em", "one"],
      ["plain", "\n\ntwo"],
    ]);
  });

  it("gives text to read and print without the marks", () => {
    const words = "It was _very_ good.";
    expect(withoutMarks(words)).toBe("It was very good.");
    expect(printedPage(words, 0, [], emphasisPieces(words))).toBe("It was <em>very</em> good.");
    expect(printedPage(words, 0, [])).toBe(words);
  });

  it("finds a phrase across the marks, at the place in the text the offsets count", () => {
    const words = "So _very_ remarkable, so very odd.";
    expect(findAllRead(words, "very remarkable", 10)).toEqual([4]);
    expect(findAllRead(words, "very", 10)).toEqual([4, 25]);
    expect(findAllRead(words, "remarkable", 10)).toEqual([10]);
    expect(findAllRead(words, "", 10)).toEqual([]);
  });
});

describe("BookText", () => {
  it("holds a book part by part and reads across the parts it has", () => {
    const text = new BookText([5, 5, 5]);
    expect(text.length).toBe(15);
    expect(text.partOf(0)).toBe(0);
    expect(text.partOf(7)).toBe(1);
    expect(text.partOf(99)).toBe(2);
    expect(text.missing(3, 8)).toEqual([0, 1]);
    text.set(0, "abcde");
    text.set(1, "fghij");
    expect(text.missing(3, 8)).toEqual([]);
    expect(text.slice(3, 8)).toBe("defgh");
    // A gap stops the slice: part 2 is not held.
    expect(text.slice(8, 15)).toBe("ij");
    expect(text.heldFrom(2)).toBe(10);
    expect(text.heldTo(9)).toBe(0);
  });

  it("refuses a part that is not as long as announced, and keeps every offset", () => {
    const text = new BookText([5, 5]);
    expect(text.set(0, "abcd")).toBe(false);
    expect(text.has(0)).toBe(false);
    expect(text.length).toBe(10);
    expect(text.set(0, "abcde")).toBe(true);
    expect(text.set(1, "fghij")).toBe(true);
    expect(text.slice(4, 6)).toBe("ef");
  });

  it("finds the start of the character an offset falls inside, once its text is held", () => {
    const text = new BookText([4]);
    expect(characterStart(text, 2)).toBe(2);
    text.set(0, "a\u{1F600}b");
    expect(characterStart(text, 2)).toBe(1);
    expect(characterStart(text, 1)).toBe(1);
    expect(characterStart(text, 3)).toBe(3);
  });
});

describe("pagination", () => {
  const words = "The quick brown fox jumps over the lazy dog and runs far away.";

  it("ends a page after the last whole word that fits", () => {
    const end = pageEnd(words, 0, words.length, holds(22));
    expect(words.slice(0, end)).toBe("The quick brown fox ");
    expect(pageEnd(words, 0, words.length, holds(1000))).toBe(words.length);
    // A box too small for any character still turns, a character at a time.
    expect(pageEnd(words, 4, words.length, holds(0))).toBe(5);
  });

  it("starts a page turned back to at the first whole word that fits before it", () => {
    const end = words.indexOf("jumps");
    const start = pageStart(words, end, 0, holds(12));
    expect(words.slice(start, end)).toBe("brown fox ");
    expect(pageStart(words, end, 0, holds(1000))).toBe(0);
    expect(pageStart(words, end, 10, holds(1000))).toBe(10);
  });

  it("turns back from a page that ends in white space, never staying where it was", () => {
    // The only text that fits is the trailing space: the start is moved back, not snapped to the
    // end, which would leave the reader on the same page for good.
    expect(pageStart("a ", 2, 0, holds(1))).toBe(1);
    const spaced = "word   \n\n   ";
    for (let end = spaced.length; end > 0; ) {
      const start = pageStart(spaced, end, 0, holds(2));
      expect(start).toBeLessThan(end);
      end = start;
    }
  });

  it("pages a long text forward and back to the same places", () => {
    const text = Array.from({ length: 3000 }, (_, n) => `word${n}`).join(" ");
    const fits = holds(700);
    const starts = [0];
    for (let at = 0; at < text.length; ) {
      const end = pageEnd(text, at, text.length, fits);
      expect(end - at).toBeLessThanOrEqual(700);
      expect(end).toBeGreaterThan(at);
      at = skipSpace(text, end);
      if (at < text.length) starts.push(at);
    }
    expect(starts.length).toBeGreaterThan(30);
    // Every page start is the start of a word.
    expect(starts.every((at) => at === 0 || text[at - 1] === " ")).toBe(true);
  });

  it("cuts a page into runs by its highlights, the latest showing where they overlap", () => {
    const highlight = (id: string, start: number, end: number): BooksHighlight => ({
      id,
      start,
      end,
      color: "yellow",
      text: "",
      note: "",
    });
    const first = highlight("a", 5, 15);
    const second = highlight("b", 10, 20);
    const runs = runsOf(0, 30, [first, second, highlight("far", 40, 50)]);
    expect(runs.map(({ from, to, highlight }) => [from, to, highlight?.id])).toEqual([
      [0, 5, undefined],
      [5, 10, "a"],
      [10, 20, "b"],
      [20, 30, undefined],
    ]);
    expect(runsOf(0, 10, [])).toEqual([{ from: 0, to: 10 }]);
  });

  it("numbers pages by the length of the page shown, and finds words", () => {
    expect(pageNumbers(0, 10_000, 1000)).toEqual({ page: 1, pages: 10 });
    expect(pageNumbers(9_999, 10_000, 1000)).toEqual({ page: 10, pages: 10 });
    expect(pageNumbers(0, 0, 0)).toEqual({ page: 1, pages: 1 });
    expect(findAll("Call me Ishmael. ISHMAEL!", "ishmael", 10)).toEqual([8, 17]);
    // A dotted capital I lowers to two units; it is found by "i", and the rest of the text is
    // still searched in any case.
    expect(findAll("İstanbul and ISHMAEL, Ishmael", "ishmael", 10)).toEqual([13, 22]);
    expect(findAll("İstanbul and ISHMAEL", "İSTANBUL", 10)).toEqual([0]);
    expect(findAll("to İstanbul", "istanbul", 10)).toEqual([3]);
    expect(findAll("to İstanbul", "i\u0307stanbul", 10)).toEqual([3]);
    // A capital sigma ending a word lowers to final sigma; a query of one sigma finds it.
    expect(findAll("ΟΣ ος σ", "Σ", 10)).toEqual([1, 4, 6]);
    expect(findAll("abc", "  ", 10)).toEqual([]);
    expect(excerpt("  one\n\ntwo  three ", 9)).toBe("one two…");
    // A character outside the Basic Multilingual Plane is two units, and is never split.
    expect(cut("ab\u{1F600}", 3)).toBe("ab");
    expect(cut("ab\u{1F600}", 4)).toBe("ab\u{1F600}");
    expect(cut("abc", 2)).toBe("ab");
    expect(excerpt("ab\u{1F600}cd", 4)).toBe("ab…");
  });

  it("never ends or starts a page between the two halves of a character", () => {
    const faces = "\u{1F600}\u{1F600}";
    // A page that holds three units ends after one face, not inside the second.
    expect(pageEnd(faces, 0, 4, (slice) => slice.length <= 3)).toBe(2);
    // A box too small for any character still turns by a whole one.
    expect(pageEnd(faces, 0, 4, (slice) => slice.length <= 1)).toBe(2);
    expect(pageStart(faces, 4, 0, (slice) => slice.length <= 3)).toBe(2);
    expect(pageStart(faces, 4, 0, (slice) => slice.length <= 1)).toBe(2);
    // Plain text is cut as before.
    expect(pageEnd("abcd", 0, 4, (slice) => slice.length <= 3)).toBe(3);
    expect(pageStart("abcd", 4, 0, (slice) => slice.length <= 1)).toBe(3);
    expect(wordStart("Call me Ish")).toBe(3);
    expect(wordStart("Call me ")).toBe(0);
  });
});
