import { describe, expect, it } from "vitest";
import {
  decodeWords,
  editDistance,
  flatOffset,
  flatOffsetBefore,
  flatText,
  knowsWord,
  loadWords,
  nextUnknownWord,
  normalWord,
  rangeOfFlat,
  spellingGuesses,
} from "./text-spelling";

const LIST = new Set(["the", "hello", "help", "helps", "yellow", "world", "word"]);

describe("the spelling word list", () => {
  it("holds ordinary words, and not a mistake, through the list the panel loads", async () => {
    const list = await loadWords();
    for (const word of ["the", "letter", "running", "because", "beautiful", "catalina"]) {
      expect(knowsWord(word, list)).toBe(true);
    }
    expect(knowsWord("helo", list)).toBe(false);
    expect(knowsWord("recieve", list)).toBe(false);
    expect(spellingGuesses("recieve", list)).toContain("receive");
  });

  it("decodes front coding", () => {
    expect([...decodeWords("0apple 3ly 0be")]).toEqual(["apple", "apply", "be"]);
  });

  it("knows words in any case, with 's, short words and all capitals", () => {
    expect(knowsWord("Hello", LIST)).toBe(true);
    expect(knowsWord("world’s", LIST)).toBe(true);
    expect(knowsWord("NASA", LIST)).toBe(true);
    expect(knowsWord("a", LIST)).toBe(true);
    expect(knowsWord("helo", LIST)).toBe(false);
    expect(knowsWord("helo", LIST, new Set(["helo"]))).toBe(true);
  });

  it("finds the next word it does not know, from a place", () => {
    const text = "the helo worlld";
    expect(nextUnknownWord(text, 0, LIST)).toEqual({ word: "helo", start: 4, end: 8 });
    expect(nextUnknownWord(text, 8, LIST)).toEqual({ word: "worlld", start: 9, end: 15 });
    expect(nextUnknownWord("the world", 0, LIST)).toBeUndefined();
  });

  it("reads a place inside a word as the whole word", () => {
    // After "he" of "hello": the letters "llo" are not a word of their own.
    expect(nextUnknownWord("hello worlld", 2, LIST)).toEqual({
      word: "worlld",
      start: 6,
      end: 12,
    });
    expect(nextUnknownWord("the helo", 6, LIST)).toEqual({ word: "helo", start: 4, end: 8 });
    // From the end of a word found, it goes on past that word, a closing apostrophe or not.
    expect(nextUnknownWord("helos' worlld", 5, LIST)?.word).toBe("worlld");
  });

  it("holds a word learned with a curly apostrophe as the checker looks it up", () => {
    const learned = new Set([normalWord("Zorbly’s")]);
    expect(knowsWord("zorbly’s", LIST, learned)).toBe(true);
    expect(knowsWord("Zorbly's", LIST, learned)).toBe(true);
    expect(nextUnknownWord("the zorbly’s", 0, LIST, learned)).toBeUndefined();
  });

  it("counts a swap of two neighbours as one edit", () => {
    expect(editDistance("wrod", "word", 2)).toBe(1);
    expect(editDistance("kitten", "sitting", 2)).toBe(3);
  });

  it("guesses the nearest words, in the case the word was written in", () => {
    expect(spellingGuesses("helo", LIST).slice(0, 2)).toEqual(["hello", "help"]);
    expect(spellingGuesses("Worlld", LIST)[0]).toBe("World");
  });
});

describe("a view's text", () => {
  it("finds a word across paragraphs and styles, and its range", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>one <b>two</b></div><div>three<br>four</div>";
    const flat = flatText(view);
    expect(flat.text).toBe("one two\nthree\nfour\n");
    expect(rangeOfFlat(flat, 4, 7)?.toString()).toBe("two");
    expect(rangeOfFlat(flat, 14, 18)?.toString()).toBe("four");
    const three = view.children[1]?.firstChild as Text;
    expect(flatOffset(flat, three, 2)).toBe(10);
  });

  it("reads a place between elements as where the next text starts", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>one</div><div>two</div>";
    const flat = flatText(view);
    expect(flatOffset(flat, view, 1)).toBe(4);
    expect(flatOffset(flat, view.children[1] as Node, 0)).toBe(4);
    expect(flatOffset(flat, view, 2)).toBe(flat.text.length);
    expect(flatOffset(flat, null, 0)).toBe(0);
  });

  it("ends the text before a place in the block it follows, with the line ends written before it", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>one<b>two</b></div><div>three<br>four</div>";
    const first = view.children[0] as Element;
    const second = view.children[1] as Element;
    expect(flatOffsetBefore(view, first, 2)).toBe(6);
    expect(flatOffsetBefore(view, view, 0)).toBe(0);
    expect(flatOffsetBefore(view, view, 1)).toBe(7);
    expect(flatOffsetBefore(view, second.firstChild as Text, 2)).toBe(9);
    expect(flatOffsetBefore(view, second, 2)).toBe(13);
  });

  it("ends bare text where a block starts, so two lines are never one word", () => {
    const view = document.createElement("div");
    view.innerHTML = "hello<div>worlld</div>";
    const flat = flatText(view);
    expect(flat.text).toBe("hello\nworlld\n");
    const found = nextUnknownWord(flat.text, 0, LIST);
    expect(found?.word).toBe("worlld");
    expect(rangeOfFlat(flat, found?.start ?? 0, found?.end ?? 0)?.toString()).toBe("worlld");
  });
});
