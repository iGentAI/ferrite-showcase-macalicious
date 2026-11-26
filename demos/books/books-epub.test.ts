import { describe, expect, it } from "vitest";
import {
  EpubError,
  fileBookId,
  MAX_ENTRY_BYTES,
  readEntry,
  readEpub,
  resolvePath,
  zipEntries,
} from "./books-epub";
import { encode, smallEpub, zip } from "./books-test-epub";

describe("reading an EPUB in the browser", () => {
  it("reads the title, the author, the spine's text and its headings", async () => {
    const bytes = await smallEpub();
    expect(zipEntries(bytes).get("OEBPS/Text/ch 1.xhtml")?.method).toBe(8);
    const book = await readEpub(bytes);
    expect(book.title).toBe("A Small Book");
    expect(book.author).toBe("Ada Writer");
    expect(book.text).toBe(
      "Chapter One\n\nIt was a bright day.\n\nSecond paragraph.\n\nChapter Two\n\nThe end.",
    );
    expect(book.toc).toEqual([
      { title: "Chapter One", at: 0 },
      { title: "Chapter Two", at: book.text.indexOf("Chapter Two") },
    ]);
  });

  it("names a file by its digest, the same for the same bytes", async () => {
    const bytes = await smallEpub();
    const id = await fileBookId("epub", bytes);
    expect(id).toMatch(/^epub-[0-9a-f]{32}$/);
    expect(await fileBookId("epub", bytes.slice())).toBe(id);
    expect(await fileBookId("epub", encode("another file"))).not.toBe(id);
  });

  it("inflates a chapter larger than one piece of the stream", async () => {
    const long = `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>${"word ".repeat(60_000)}end</p></body></html>`;
    const archive = await zip(
      {
        "META-INF/container.xml": `<container><rootfiles><rootfile full-path="a.opf"/></rootfiles></container>`,
        "a.opf": `<package><metadata/><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>`,
        "c.xhtml": long,
      },
      ["c.xhtml"],
    );
    const book = await readEpub(archive);
    expect(book.text.length).toBe(300_003);
    expect(book.text.endsWith("word end")).toBe(true);
  });

  it("reads a chapter in the encoding its declaration names", async () => {
    const latin = (text: string) => Uint8Array.from(text, (character) => character.charCodeAt(0));
    const declared = (encoding: string) =>
      `<?xml version="1.0" encoding="${encoding}"?><html xmlns="http://www.w3.org/1999/xhtml"><body><p>caf\xe9</p></body></html>`;
    const withChapter = (chapter: Uint8Array) =>
      zip({
        "META-INF/container.xml": `<container><rootfiles><rootfile full-path="a.opf"/></rootfiles></container>`,
        "a.opf": `<package><metadata/><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c"/></spine></package>`,
        "c.xhtml": chapter,
      });
    const book = await readEpub(await withChapter(latin(declared("ISO-8859-1"))));
    expect(book.text).toBe("caf\xe9");
    await expect(
      readEpub(await withChapter(encode(declared("x-not-an-encoding")))),
    ).rejects.toThrow(/encoding x-not-an-encoding, which Books cannot read/);
  });

  it("refuses what is not an EPUB", async () => {
    await expect(readEpub(encode("plain text, not a zip"))).rejects.toBeInstanceOf(EpubError);
    await expect(readEpub(await zip({ "hello.txt": "hi" }))).rejects.toThrow(/container\.xml/);
  });

  it("resolves a manifest's addresses against the package's folder", () => {
    expect(resolvePath("OEBPS/", "Text/ch%201.xhtml#start")).toBe("OEBPS/Text/ch 1.xhtml");
    expect(resolvePath("OEBPS/Text/", "../Images/a.png")).toBe("OEBPS/Images/a.png");
    expect(resolvePath("", "/content.opf")).toBe("content.opf");
  });

  it("refuses a damaged book rather than open it with chapters missing", async () => {
    const missing = readEpub(await smallEpub({ without: ["OEBPS/Text/ch2.xhtml"] }));
    await expect(missing).rejects.toBeInstanceOf(EpubError);
    await expect(missing).rejects.toThrow(/“OEBPS\/Text\/ch2\.xhtml” is missing from the file/);
    const unlisted = readEpub(
      await smallEpub({ spine: `<itemref idref="one"/><itemref idref="three"/>` }),
    );
    await expect(unlisted).rejects.toThrow(/names “three”, which its package does not list/);
    // A document outside the reading order (linear="no") is not read, listed or not.
    const aside = await readEpub(
      await smallEpub({ spine: `<itemref idref="notes" linear="no"/><itemref idref="two"/>` }),
    );
    expect(aside.text).toBe("Chapter Two\n\nThe end.");
  });

  it("refuses a file that asks for more reading than any book needs", async () => {
    // One chapter named over and over counts each time, in the reading order and in its bytes.
    const repeated = await smallEpub({ spine: `<itemref idref="two"/>`.repeat(5) });
    expect((await readEpub(repeated)).text.match(/The end\./g)).toHaveLength(5);
    await expect(readEpub(repeated, { spine: 4 })).rejects.toThrow(
      /reading order names 5 documents; Books reads at most 4/,
    );
    const chapter = zipEntries(repeated).get("OEBPS/Text/ch2.xhtml")?.size ?? 0; // stored as it is
    expect(chapter).toBeGreaterThan(0);
    await expect(readEpub(repeated, { decoded: chapter * 5 })).resolves.toBeDefined();
    await expect(readEpub(repeated, { decoded: chapter * 5 - 1 })).rejects.toThrow(
      /chapters are larger than Books reads/,
    );
    // A deflated chapter stops inflating at the budget.
    await expect(readEpub(await smallEpub(), { decoded: 100 })).rejects.toThrow(
      /chapters are larger than Books reads/,
    );
    await expect(readEpub(await smallEpub(), { text: 20 })).rejects.toThrow(
      /text is longer than Books reads \(20 characters\)/,
    );
  });

  it("holds a stored file to the same limits as a compressed one", async () => {
    // A stored (uncompressed) entry is read as it is, without inflating, so it is checked on its
    // own: against the chapters' budget, and against the most one file may hold.
    const archive = await zip({ "big.xhtml": "x".repeat(MAX_ENTRY_BYTES + 1), "small.txt": "ok" });
    const big = zipEntries(archive).get("big.xhtml");
    const small = zipEntries(archive).get("small.txt");
    if (!big || !small) throw new Error("the archive lists its files");
    expect(big.method).toBe(0);
    await expect(readEntry(archive, big)).rejects.toThrow(/too large to read/);
    await expect(
      readEntry(archive, small, { bytes: 1, message: "over the chapters' budget" }),
    ).rejects.toThrow("over the chapters' budget");
    expect(
      new TextDecoder().decode(await readEntry(archive, small, { bytes: 2, message: "" })),
    ).toBe("ok");
  });
});
