import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { beginDesktopValues, forgetDesktopValues } from "../desktop/desktop-personal";
import { readEpub, readEpubPicture } from "./books-epub";
import { BooksTextReader } from "./books-reader";
import type { OwnedBook } from "./books-server";
import { fetchPictureFile, fetchPictures } from "./books-server";
import { zip } from "./books-test-epub";
import { pageParts, pictureSize, picturesIn, printedPage, runsOf } from "./books-text";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

function epub(
  chapters: readonly string[],
  { manifest = "", spine = "" }: { manifest?: string; spine?: string } = {},
) {
  const items = chapters
    .map(
      (_, at) => `<item id="c${at}" href="Text/c${at}.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join("");
  const refs = chapters.map((_, at) => `<itemref idref="c${at}"/>`).join("");
  return zip(
    {
      "META-INF/container.xml": `<container><rootfiles><rootfile full-path="OEBPS/a.opf"/></rootfiles></container>`,
      "OEBPS/a.opf": `<package><metadata/><manifest>${items}<item id="plate" href="art/plate.png" media-type="image/png"/><item id="tiff" href="art/old.tif" media-type="image/tiff"/>${manifest}</manifest><spine>${spine}${refs}</spine></package>`,
      "OEBPS/art/plate.png": PNG,
      "OEBPS/art/plain.jpg": PNG,
      "OEBPS/art/old.tif": PNG,
      ...Object.fromEntries(
        chapters.map((body, at) => [
          `OEBPS/Text/c${at}.xhtml`,
          `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink"><body>${body}</body></html>`,
        ]),
      ),
    },
    ["OEBPS/art/plate.png"],
  );
}

describe("an EPUB's pictures", () => {
  it("gives pictures positions without changing a character of the text", async () => {
    const plain = await readEpub(
      await epub([`<h1>One</h1><p>Alpha beta.</p><p>A plate</p><p>Gamma.</p>`, `<p>Delta</p>`]),
    );
    const pictured = await readEpub(
      await epub([
        `<h1>One</h1><p>Alpha <img src="../art/plate.png"/> beta.</p><p><img src="../art/plate.png" alt="A plate"/></p><img src="../art/plate.png"/><p>Gamma.</p>`,
        `<p>Delta</p><p><img src="../art/plain.jpg"/></p>`,
      ]),
    );
    expect(pictured.text).toBe(plain.text);
    expect(pictured.toc).toEqual(plain.toc);
    expect(pictured.text).toBe("One\n\nAlpha beta.\n\nA plate\n\nGamma.\n\nDelta");
    expect(pictured.pictures).toEqual([
      { at: 11, path: "OEBPS/art/plate.png", type: "image/png" },
      { at: 18, path: "OEBPS/art/plate.png", type: "image/png" },
      { at: 27, path: "OEBPS/art/plate.png", type: "image/png" },
      { at: 40, path: "OEBPS/art/plain.jpg", type: "image/jpeg" },
    ]);
    expect(pictured.text.slice(11)).toMatch(/^beta/);
    expect(pictured.text.slice(18)).toMatch(/^A plate/);
    expect(pictured.text.slice(27)).toMatch(/^Gamma/);
    expect(pictured.text.slice(40)).toBe("");
  });

  it("takes an SVG's image and a picture named by the reading order, past them no text changes", async () => {
    const book = await readEpub(
      await epub(
        [
          `<p>Words.</p><svg xmlns="http://www.w3.org/2000/svg"><image xlink:href="../art/plate.png"/><text>not read</text></svg><p>More.</p>`,
        ],
        { spine: `<itemref idref="plate"/>` },
      ),
    );
    expect(book.text).toBe("Words.\n\nMore.");
    expect(book.pictures.map(({ at }) => at)).toEqual([0, 8]);
  });

  it("never names a picture that is not in the archive, nor a kind no browser shows", async () => {
    const book = await readEpub(
      await epub([
        `<p>A <img src="https://example.com/a.png"/>b.</p><p><img src="../art/missing.png"/>c</p><p><img src="../art/old.tif"/>d</p><p>e<img src="data:image/png;base64,AAAA"/></p>`,
      ]),
    );
    expect(book.pictures).toEqual([]);
    expect(book.text).toBe("A b.\n\nc\n\nd\n\ne");
  });

  it("opens a book of pictures alone, each picture with a place of its own", async () => {
    const inSpine = await readEpub(await epub([], { spine: `<itemref idref="plate"/>` }));
    expect(inSpine.text).toBe("Picture 1");
    expect(inSpine.pictures).toEqual([{ at: 0, path: "OEBPS/art/plate.png", type: "image/png" }]);
    const inPages = await readEpub(
      await epub([
        `<p><img src="../art/plate.png"/></p>`,
        `<div><img src="../art/plain.jpg"/></div>`,
        `<p><img src="../art/plate.png"/></p>`,
      ]),
    );
    expect(inPages.text).toBe("Picture 1\n\nPicture 2\n\nPicture 3");
    expect(inPages.pictures.map(({ at, path }) => [at, path])).toEqual([
      [0, "OEBPS/art/plate.png"],
      [11, "OEBPS/art/plain.jpg"],
      [22, "OEBPS/art/plate.png"],
    ]);
  });

  it("keeps a book with a picture's alt text as the words it has", async () => {
    const book = await readEpub(await epub([`<p><img src="../art/plate.png" alt="A bay"/></p>`]));
    expect(book.text).toBe("A bay");
    expect(book.pictures.map(({ at }) => at)).toEqual([0]);
  });

  it("refuses a book whose reading order is empty, or whose pictures are not in the archive", async () => {
    await expect(readEpub(await epub([]))).rejects.toThrow("The EPUB has no chapters to read.");
    await expect(readEpub(await epub([`<p><img src="../art/missing.png"/></p>`]))).rejects.toThrow(
      "The EPUB has no text Books can show.",
    );
  });

  it("reads a picture's bytes back, inflated, with its type", async () => {
    const bytes = await epub([`<p>A <img src="../art/plate.png"/>b.</p>`]);
    const [picture] = (await readEpub(bytes)).pictures;
    if (!picture) throw new Error("no picture");
    const blob = await readEpubPicture(bytes, picture);
    expect(blob.type).toBe("image/png");
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([...PNG]);
  });
});

describe("a picture's place on a page", () => {
  const at = (offset: number) => ({ at: offset });

  it("shows a picture on the page that starts at it, not on the one that ends there", () => {
    const pictures = [at(10), at(20), at(30)];
    expect(picturesIn(pictures, 0, 10, 30)).toEqual([]);
    expect(picturesIn(pictures, 10, 20, 30)).toEqual([at(10)]);
    expect(picturesIn(pictures, 20, 30, 30)).toEqual([at(20), at(30)]);
  });

  it("cuts a page's runs, a highlight too, where a picture stands", () => {
    const highlight = { id: "h", start: 2, end: 8, color: "yellow", text: "", note: "" } as const;
    const parts = pageParts(runsOf(0, 10, [highlight]), [at(0), at(5), at(10)]);
    expect(
      parts.map((part) =>
        part.picture
          ? `picture ${part.picture.at}`
          : `${part.from}-${part.to}${part.highlight ? " marked" : ""}`,
      ),
    ).toEqual(["picture 0", "0-2", "2-5 marked", "picture 5", "5-8 marked", "8-10", "picture 10"]);
  });

  it("prints the words of a page with its pictures where they stand, escaped", () => {
    expect(
      printedPage("a <b> & c", 100, [
        { at: 100, src: "data:image/png;base64,AA", width: 40 },
        { at: 105, src: 'data:x"y', width: 900 },
      ]),
    ).toBe(
      '<img src="data:image/png;base64,AA" alt="" style="display:block;width:40px;max-width:100%;max-height:9in;object-fit:contain;break-inside:avoid">' +
        "a &lt;b&gt;" +
        '<img src="data:x&quot;y" alt="" style="display:block;width:900px;max-width:100%;max-height:9in;object-fit:contain;break-inside:avoid">' +
        " &amp; c",
    );
  });

  it("lets a picture fill the page but for the words' room, and never grows one", () => {
    const room = { width: 400, height: 500, reserve: 56 };
    expect(pictureSize({ width: 24, height: 16 }, room)).toEqual({
      width: 24,
      height: 16,
      inline: true,
    });
    expect(pictureSize({ width: 800, height: 400 }, room)).toEqual({
      width: 400,
      height: 200,
      inline: false,
    });
    expect(pictureSize({ width: 300, height: 1000 }, room)).toEqual({
      width: 133,
      height: 444,
      inline: false,
    });
    expect(pictureSize({ width: 300, height: 1000 }, room, 2).height).toBe(175);
    expect(pictureSize({ width: 300, height: 100 }, { ...room, reserve: 400 }).height).toBe(100);
    expect(
      pictureSize({ width: 300, height: 1000 }, { width: 400, height: 200, reserve: 150 }).height,
    ).toBe(140);
    expect(pictureSize({ width: 900, height: 900 }, { width: 0, height: 0, reserve: 0 })).toEqual({
      width: 900,
      height: 900,
      inline: false,
    });
  });
});

const drive = vi.hoisted(() => ({ file: new Blob([]) as Blob }));
vi.mock("../desktop/desktop-files", async (original) => ({
  ...(await original<object>()),
  readFile: async () => drive.file,
}));

describe("a store book's pictures", () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const picture = (at: number, path: string) => ({ at, path, type: "image/jpeg" });
  /** Answers each request from `routes`, in order for a URL with several answers, and records it. */
  function server(routes: Record<string, readonly (() => Response)[]>) {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const answers = routes[url];
        const next = asked.filter((each) => each === url).length;
        asked.push(url);
        const answer = answers?.[Math.min(next, answers.length - 1)];
        return answer ? answer() : json({ reading: null, rev: 1 });
      }),
    );
    return asked;
  }

  beforeEach(() => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    forgetDesktopValues();
    beginDesktopValues();
  });

  it("asks round by round until the list is complete, each picture knowing its number", async () => {
    const asked = server({
      "/api/books/pictures/pg-1400": [
        () => json({ pictures: [picture(0, "images/a.jpg")], complete: false }),
        () =>
          json({
            pictures: [picture(0, "images/a.jpg"), picture(90, "images/b.jpg")],
            complete: true,
          }),
      ],
    });
    expect(await fetchPictures("pg-1400", () => true)).toEqual([
      { at: 0, path: "images/a.jpg", type: "image/jpeg", n: 0 },
      { at: 90, path: "images/b.jpg", type: "image/jpeg", n: 1 },
    ]);
    expect(asked.length).toBe(2);
  });

  it("stops asking when the reader has gone", async () => {
    let live = true;
    const asked = server({
      "/api/books/pictures/pg-1400": [
        () => {
          live = false;
          return json({ pictures: [], complete: false });
        },
      ],
    });
    expect(await fetchPictures("pg-1400", () => live)).toEqual([]);
    expect(asked.length).toBe(1);
  });

  it("has none for a book the server cannot read, and refuses a list that is not one", async () => {
    server({ "/api/books/pictures/pg-1": [() => json({ error: "no" }, 404)] });
    expect(await fetchPictures("pg-1", () => true)).toEqual([]);
    server({
      "/api/books/pictures/pg-2": [
        () => json({ pictures: [{ at: -1, path: "a.jpg", type: "image/jpeg" }], complete: true }),
      ],
    });
    await expect(fetchPictures("pg-2", () => true)).rejects.toThrow(
      "not a list of a book's pictures",
    );
  });

  it("reads a picture's file by its number, and fails on a refusal", async () => {
    const asked = server({
      "/api/books/pictures/pg-1400/1": [() => new Response("bytes")],
      "/api/books/pictures/pg-1400/2": [() => json({ error: "too large" }, 413)],
    });
    const file = await fetchPictureFile("pg-1400", { ...picture(5, "images/b.jpg"), n: 1 });
    expect(await file.text()).toBe("bytes");
    expect(asked).toEqual(["/api/books/pictures/pg-1400/1"]);
    await expect(
      fetchPictureFile("pg-1400", { ...picture(9, "images/c.jpg"), n: 2 }),
    ).rejects.toMatchObject({ status: 413 });
  });

  it("shows the picture among the words of the store book's page, the text unchanged", async () => {
    server({
      "/api/books/text/pg-1400": [
        () =>
          json({
            id: "pg-1400",
            parts: [13],
            complete: true,
            start: 0,
            source: "gutenberg",
            credit: "",
            licence: "",
            link: "",
            toc: [],
          }),
      ],
      "/api/books/text/pg-1400/0": [
        () => json({ text: "Before after.", parts: [13], complete: true }),
      ],
      "/api/books/pictures/pg-1400": [
        () => json({ pictures: [picture(7, "images/plate.jpg")], complete: true }),
      ],
      "/api/books/pictures/pg-1400/0": [() => new Response("jpeg")],
    });
    Object.assign(URL, { createObjectURL: () => "blob:p", revokeObjectURL: vi.fn() });
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        naturalWidth = 50;
        naturalHeight = 30;
        decode = async () => {};
      },
    );
    const book: OwnedBook = {
      id: "pg-1400",
      title: "Great Expectations",
      author: "",
      source: "gutenberg",
      added: 1,
    };
    render(<BooksTextReader book={book} />);
    const page = await screen.findByRole("document", {}, { timeout: 3000 });
    const image = await waitFor(
      () => {
        const found = page.querySelector("img");
        if (!found) throw new Error("no picture yet");
        return found;
      },
      { timeout: 3000 },
    );
    expect(image.dataset.bookPicture).toBe("images/plate.jpg");
    expect(page.textContent).toBe("Before after.");
    expect(image.previousSibling?.textContent).toBe("Before ");
    expect(image.nextSibling?.textContent).toBe("after.");
  });

  it("shows a store book's underscored word in italics, with its offsets still counting the marks", async () => {
    const words = "It was _very_ good.";
    server({
      "/api/books/text/pg-1400": [
        () =>
          json({
            id: "pg-1400",
            parts: [words.length],
            complete: true,
            start: 0,
            source: "gutenberg",
            credit: "",
            licence: "",
            link: "",
            toc: [],
          }),
      ],
      "/api/books/text/pg-1400/0": [
        () => json({ text: words, parts: [words.length], complete: true }),
      ],
      "/api/books/pictures/pg-1400": [() => json({ pictures: [], complete: true })],
    });
    render(
      <BooksTextReader
        book={{
          id: "pg-1400",
          title: "Great Expectations",
          author: "",
          source: "gutenberg",
          added: 1,
        }}
      />,
    );
    const page = await screen.findByRole("document", {}, { timeout: 3000 });
    const emphasis = await waitFor(
      () => {
        const found = page.querySelector("em");
        if (!found) throw new Error("no emphasis yet");
        return found;
      },
      { timeout: 3000 },
    );
    expect(emphasis.textContent).toBe("very");
    expect(page.textContent).toBe(words);
    expect(
      [...page.querySelectorAll(".mac-books-emphasis-mark")].map((mark) => mark.textContent),
    ).toEqual(["_", "_"]);
  });
});

describe("the reader, with a stand-in for the browser's image decoder", () => {
  const book: OwnedBook = {
    id: `epub-${"d".repeat(32)}`,
    title: "Pictured",
    author: "",
    source: "epub",
    added: 1,
    file: "f-1",
  };
  const decode = vi.fn(async () => {});

  beforeEach(() => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ reading: null, rev: 1 }), {
            headers: { "content-type": "application/json" },
          }),
      ),
    );
    Object.assign(URL, { createObjectURL: () => "blob:p", revokeObjectURL: vi.fn() });
    decode.mockReset();
    decode.mockResolvedValue(undefined);
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        naturalWidth = 50;
        naturalHeight = 30;
        decode = decode;
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    forgetDesktopValues();
    beginDesktopValues();
  });

  it("puts the picture among the page's words, and adds nothing to their text", async () => {
    drive.file = new Blob([
      (await epub([
        `<p>Before <img src="../art/plate.png"/>after.</p>`,
      ])) as Uint8Array<ArrayBuffer>,
    ]);
    render(<BooksTextReader book={book} />);
    const page = await screen.findByRole("document", {}, { timeout: 3000 });
    const image = await waitFor(
      () => {
        const found = page.querySelector("img");
        if (!found) throw new Error("no picture yet");
        return found;
      },
      { timeout: 3000 },
    );
    expect(image.dataset.bookPicture).toBe("OEBPS/art/plate.png");
    expect(image.getAttribute("src")).toBe("blob:p");
    expect(image.style.width).toBe("50px");
    expect(page.textContent).toBe("Before after.");
    expect(image.previousSibling?.textContent).toBe("Before ");
    expect(image.nextSibling?.textContent).toBe("after.");
  });

  it("prints the page with its picture in it", async () => {
    drive.file = new Blob([
      (await epub([
        `<p>Before <img src="../art/plate.png"/>after.</p>`,
      ])) as Uint8Array<ArrayBuffer>,
    ]);
    const printRef: { current: (() => void) | null } = { current: null };
    render(<BooksTextReader book={book} printRef={printRef} />);
    const page = await screen.findByRole("document", {}, { timeout: 3000 });
    await waitFor(() => expect(page.querySelector("img")).not.toBeNull(), { timeout: 3000 });
    printRef.current?.();
    const frame = await waitFor(
      () => {
        const found = document.querySelector("iframe[data-textedit-print]");
        if (!found) throw new Error("nothing printed yet");
        return found;
      },
      { timeout: 3000 },
    );
    const printed = frame.getAttribute("srcdoc") ?? "";
    expect(printed).toContain("Before ");
    expect(printed).toContain('<img src="data:image/png;base64,iVBORwECAw=="');
    expect(printed).toContain(">after.");
    frame.remove();
  });

  it("says when a picture cannot be shown, and shows the words", async () => {
    decode.mockRejectedValue(new Error("damaged"));
    drive.file = new Blob([
      (await epub([
        `<p>Before <img src="../art/plate.png"/>after.</p>`,
      ])) as Uint8Array<ArrayBuffer>,
    ]);
    render(<BooksTextReader book={book} />);
    expect((await screen.findByRole("alert", {}, { timeout: 3000 })).textContent).toBe(
      "A picture of this book could not be shown.",
    );
    const page = screen.getByRole("document");
    await waitFor(() => expect(page.textContent).toBe("Before after."));
    expect(page.querySelector("img")).toBeNull();
  });
});
