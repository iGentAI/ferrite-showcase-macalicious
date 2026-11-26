import { describe, expect, it } from "vitest";
import { moveBooks } from "./books-data";
import { bookWebAddress, chapterAt, secondsBefore } from "./books-server";
import { readingPercent } from "./books-text";

describe("readingPercent", () => {
  it("counts from 1 to 99 through the text, and 100 only on the last page", () => {
    expect(readingPercent(0, 1000, false)).toBe(1);
    expect(readingPercent(250, 1000, false)).toBe(25);
    expect(readingPercent(999, 1000, false)).toBe(99);
    expect(readingPercent(900, 1000, true)).toBe(100);
  });
});

describe("moveBooks", () => {
  const books = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const order = (list: readonly { id: string }[]) => list.map(({ id }) => id).join("");

  it("puts those moving before the book dropped on, in the order of the list", () => {
    expect(order(moveBooks(books, ["d"], "a"))).toBe("dabc");
    expect(order(moveBooks(books, ["d", "b"], "a"))).toBe("bdac");
    expect(order(moveBooks(books, ["a"], "c"))).toBe("bacd");
  });

  it("changes nothing for a drop on one of those moving or on a book not listed", () => {
    expect(moveBooks(books, ["a", "b"], "b")).toBe(books);
    expect(moveBooks(books, ["a"], "z")).toBe(books);
  });
});

describe("an audiobook's place", () => {
  const chapters = [{ seconds: 640 }, { seconds: 735 }, { seconds: 100 }];

  it("is seconds across the whole recording, the same in every browser", () => {
    expect(chapterAt(chapters, 0)).toEqual({ index: 0, offset: 0 });
    expect(chapterAt(chapters, 639)).toEqual({ index: 0, offset: 639 });
    expect(chapterAt(chapters, 640)).toEqual({ index: 1, offset: 0 });
    expect(chapterAt(chapters, 1400)).toEqual({ index: 2, offset: 25 });
    expect(secondsBefore(chapters, 2)).toBe(1375);
  });

  it("goes to the start of the last chapter when it is past the end", () => {
    expect(chapterAt(chapters, 9999)).toEqual({ index: 2, offset: 0 });
  });
});

describe("bookWebAddress", () => {
  it("gives a book's page at Project Gutenberg and at Standard Ebooks", () => {
    expect(bookWebAddress("lv-200")).toBe("https://librivox.org/rss/200");
    expect(bookWebAddress("pg-11")).toBe("https://www.gutenberg.org/ebooks/11");
    expect(bookWebAddress("se.leo-tolstoy.war-and-peace.louise-maude_aylmer-maude")).toBe(
      "https://standardebooks.org/ebooks/leo-tolstoy/war-and-peace/louise-maude_aylmer-maude",
    );
  });
});
