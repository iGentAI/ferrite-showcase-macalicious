import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { type DriveEntry, loadDrive } from "../desktop/desktop-files";
import { PreviewApp } from "./preview-app";
import type { PreviewDrive } from "./preview-drive";
import {
  isPdf,
  isPicture,
  nameFor,
  opensInPreview,
  saveFormatOf,
  stemOf,
  writePdf,
} from "./preview-export";
import {
  EMPTY_MARKUP,
  flipped,
  fromView,
  heldOrder,
  MARKUP_LIMITS,
  type Mark,
  type Markup,
  markAt,
  marksOf,
  markupFromServer,
  markupReadable,
  mergedLines,
  moved,
  noteMark,
  type Point,
  piecesMatching,
  placeSignature,
  rearranged,
  rectFromView,
  renderScale,
  shapeBetween,
  signatureFromStrokes,
  textBox,
  textMarks,
  thinPoints,
  toView,
  type View,
  viewSize,
  withinLimits,
  withMarks,
} from "./preview-markup";
import { pagedPdf } from "./preview-pages";
import type { PdfFile } from "./preview-pdf";
import type { Place } from "./preview-places";

/*
 * Preview on the Ferrite desktop. The markup geometry and the PDF writer are pure and tested as
 * they are. The window is tested against stand-ins: a `PreviewDrive` that keeps files in memory
 * (for the person's drive), a stand-in for the drive listing `/api/files/` that the shared Open
 * dialog reads, a PDF reader in place of pdf.js and a recording 2D context in place of the
 * browser's canvas, which jsdom does not draw. The real drive, pdf.js and drawing are exercised by
 * `ferrite-apps/desktop/e2e/preview-journey.mjs` in three browsers.
 */

const near = (a: Point, b: Point) => {
  expect(a[0]).toBeCloseTo(b[0], 9);
  expect(a[1]).toBeCloseTo(b[1], 9);
};

describe("text typed on a turned page", () => {
  it("runs along the view's right and down, whichever way those lie on the page", () => {
    expect(textBox(0.5, 0.1, 0, 1000, 800)).toEqual({ w: 0.5, h: 0.1 });
    // A clockwise quarter turn: the view's right is the page's up, its down the page's right.
    expect(textBox(0.5, 0.1, 1, 1000, 800)).toEqual({ w: 0.08, h: -0.625 });
    expect(textBox(0.5, 0.1, 2, 1000, 800)).toEqual({ w: -0.5, h: -0.1 });
    expect(textBox(0.5, 0.1, 3, 1000, 800)).toEqual({ w: -0.08, h: 0.625 });
  });

  it("is found under the pointer where it lies on the page", () => {
    const mark = { ...box("t", 0.5, 0.5), kind: "text" as const, w: -0.08, h: 0.625 };
    expect(markAt([mark], [0.47, 0.8])?.id).toBe("t");
    expect(markAt([mark], [0.6, 0.8])).toBeNull();
  });

  it("reads only quarter turns from the server", () => {
    const stored = (turns: number) => ({
      markup: { rotation: 1, pages: [{ page: 1, items: [{ ...box("t", 0, 0), turns }] }] },
    });
    expect(markupReadable(stored(3))).toBe(true);
    expect(markupReadable(stored(4))).toBe(false);
  });
});

describe("a flipped picture", () => {
  const crop = { x: 0.2, y: 0.1, w: 0.5, h: 0.6 };

  it("mirrors page space in the view and back, turned or not", () => {
    near(toView([0.2, 0.1], { crop, turns: 0, mirrored: true }), [1, 0]);
    near(toView([0.2, 0.1], { crop, turns: 1, mirrored: true }), [1, 1]);
    for (const turns of [0, 1, 2, 3] as const) {
      const view: View = { crop, turns, mirrored: true };
      near(fromView(toView([0.33, 0.5], view), view), [0.33, 0.5]);
    }
  });

  it("flips what the window shows, whichever way it is turned", () => {
    for (const turns of [0, 1, 2, 3] as const) {
      for (const mirrored of [false, true]) {
        const before: View = { crop, turns, mirrored };
        const point: Point = [0.3, 0.4];
        const [x, y] = toView(point, before);
        near(toView(point, { crop, ...flipped(before, "horizontal") }), [1 - x, y]);
        near(toView(point, { crop, ...flipped(before, "vertical") }), [x, 1 - y]);
      }
    }
  });

  it("runs a typed text against the page's width", () => {
    expect(textBox(0.5, 0.1, 0, 1000, 800, true)).toEqual({ w: -0.5, h: 0.1 });
  });

  it("reads only a true mirror from the server", () => {
    const stored = (mirrored: unknown) => ({
      markup: { rotation: 0, pages: [{ page: 1, items: [{ ...box("t", 0, 0), mirrored }] }] },
    });
    expect(markupReadable(stored(true))).toBe(true);
    expect(markupReadable(stored(false))).toBe(false);
  });
});

describe("a PDF's pages laid out anew", () => {
  const mark = (id: string) => box(id, 0.1, 0.1);
  const marked: Markup = {
    rotation: 0,
    pages: [
      { page: 2, items: [mark("two")] },
      { page: 3, items: [mark("three")] },
    ],
  };

  it("moves each page's marks with it, and drops those of a page left out", () => {
    expect(rearranged(marked, 3, [2, 1])).toEqual({
      rotation: 0,
      order: [2, 1],
      pages: [{ page: 1, items: [mark("two")] }],
    });
  });

  it("takes the pages as numbered now, after an earlier change", () => {
    const once = rearranged({ rotation: 0, pages: [] }, 3, [3, 1, 2]);
    expect(rearranged(once, 3, [2, 1, 3]).order).toEqual([1, 3, 2]);
  });

  it("names a blank page 0, which has no marks", () => {
    expect(rearranged(marked, 3, [1, 0, 2, 3])).toEqual({
      rotation: 0,
      order: [1, 0, 2, 3],
      pages: [
        { page: 3, items: [mark("two")] },
        { page: 4, items: [mark("three")] },
      ],
    });
  });

  it("takes an order past the file's last as the file's own", () => {
    const stale: Markup = { rotation: 0, pages: [], order: [99, 1, 2] };
    expect(heldOrder(stale.order, 3)).toBeUndefined();
    expect(rearranged(stale, 3, [1, 0, 2, 3]).order).toEqual([1, 0, 2, 3]);
  });

  it("keeps no order for the file's own", () => {
    const moved = rearranged(marked, 3, [2, 1, 3]);
    expect("order" in rearranged(moved, 3, [2, 1, 3])).toBe(false);
  });

  it("reads an order from the server only as whole numbers", () => {
    const stored = (order: unknown) => ({ markup: { rotation: 0, pages: [], order } });
    expect(markupReadable(stored([2, 0, 1]))).toBe(true);
    expect(markupReadable(stored([]))).toBe(false);
    expect(markupReadable(stored([1.5]))).toBe(false);
  });
});

describe("a PDF shown in another order", () => {
  const file = {
    pageCount: 2,
    size: vi.fn(async () => ({ width: 1, height: 1 })),
    render: vi.fn(async (_page: number) => true),
    text: vi.fn(async (page: number) => `page ${page}`),
    layOutText: vi.fn(async () => {}),
    textRuns: vi.fn(async () => []),
    outline: vi.fn(async () => []),
    links: vi.fn(async () => []),
    fields: vi.fn(async () => []),
    setField: vi.fn(),
    filled: vi.fn(async () => new Uint8Array()),
    security: vi.fn(async () => ({})),
    combined: vi.fn(async () => new Uint8Array()),
    destroy: vi.fn(),
  };
  const sizes = [
    { width: 100, height: 200 },
    { width: 300, height: 400 },
  ];

  it("draws and reads the file's page each page names", async () => {
    const { pdf, sizes: shown } = pagedPdf(file, sizes, [2, 0, 1]);
    expect(pdf.pageCount).toBe(3);
    expect(shown).toEqual([sizes[1], sizes[0], sizes[0]]);
    expect(await pdf.text(1)).toBe("page 2");
    expect(await pdf.text(2)).toBe("");
    await pdf.render(3, document.createElement("canvas"), 50, 0, 1);
    expect(file.render.mock.calls.at(-1)?.[0]).toBe(1);
  });

  it("draws a blank page at the first page's proportions, turned", async () => {
    const { pdf } = pagedPdf(file, sizes, [0]);
    const canvas = document.createElement("canvas");
    await pdf.render(1, canvas, 100, 1, 2);
    expect([canvas.width, canvas.height]).toEqual([200, 100]);
  });
});

describe("the view transform", () => {
  const crop = { x: 0.2, y: 0.1, w: 0.5, h: 0.6 };
  it("turns page space into view space and back for every quarter turn and crop", () => {
    for (const turns of [0, 1, 2, 3] as const) {
      const view: View = { crop, turns };
      for (const point of [
        [0.2, 0.1],
        [0.7, 0.7],
        [0.33, 0.5],
      ] as Point[]) {
        near(fromView(toView(point, view), view), point);
      }
    }
  });

  it("puts the crop's top left corner where a clockwise turn puts it", () => {
    near(toView([0.2, 0.1], { crop, turns: 0 }), [0, 0]);
    // One quarter turn clockwise: the top left corner goes to the top right.
    near(toView([0.2, 0.1], { crop, turns: 1 }), [1, 0]);
    near(toView([0.2, 0.1], { crop, turns: 2 }), [1, 1]);
    near(toView([0.2, 0.1], { crop, turns: 3 }), [0, 1]);
  });

  it("swaps width and height for a quarter turn and keeps the crop's share", () => {
    expect(viewSize(1000, 800, { crop, turns: 0 })).toEqual({ width: 500, height: 480 });
    expect(viewSize(1000, 800, { crop, turns: 1 })).toEqual({ width: 480, height: 500 });
  });

  it("reads a rectangle chosen on a turned picture as the rectangle of the page under it", () => {
    const view: View = { crop: { x: 0, y: 0, w: 1, h: 1 }, turns: 1 };
    // The right half of the view of a picture turned clockwise is the top half of the page.
    const rect = rectFromView([0.5, 0], [1, 1], view);
    expect(rect.x).toBeCloseTo(0);
    expect(rect.y).toBeCloseTo(0);
    expect(rect.w).toBeCloseTo(1);
    expect(rect.h).toBeCloseTo(0.5);
  });
});

const box = (id: string, x: number, y: number): Mark => ({
  id,
  kind: "rect",
  color: "#ff3b30",
  stroke: 0.004,
  x,
  y,
  w: 0.2,
  h: 0.1,
});

describe("marks on a PDF's text", () => {
  it("joins the pieces of a line, drops their duplicates and keeps each line apart", () => {
    const lines = mergedLines(
      [
        { x: 0.5, y: 0.125, w: 0.125, h: 0.03125 },
        { x: 0.125, y: 0.125, w: 0.375, h: 0.03125 },
        { x: 0.125, y: 0.125, w: 0.375, h: 0.03125 },
        { x: 0.125, y: 0.25, w: 0.25, h: 0.03125 },
        { x: 0.125, y: 0.5, w: 0, h: 0 },
      ],
      792 / 612,
    );
    expect(lines).toEqual([
      { x: 0.125, y: 0.125, w: 0.5, h: 0.03125 },
      { x: 0.125, y: 0.25, w: 0.25, h: 0.03125 },
    ]);
  });

  it("leaves two columns on one line apart", () => {
    const lines = mergedLines(
      [
        { x: 0.1, y: 0.1, w: 0.2, h: 0.02 },
        { x: 0.6, y: 0.1, w: 0.2, h: 0.02 },
      ],
      792 / 612,
    );
    expect(lines).toHaveLength(2);
  });

  it("keeps its lines, the box around them and its words on one clean line", () => {
    const [mark] = textMarks(
      { kind: "underline", color: "#ff3b30" },
      [
        { x: 0.1, y: 0.1, w: 0.4, h: 0.02 },
        { x: 0.2, y: 0.13, w: 0.5, h: 0.02 },
      ],
      "the ferry\n\u0002 leaves",
    );
    expect(mark).toMatchObject({
      kind: "underline",
      x: 0.1,
      y: 0.1,
      w: 0.6,
      h: 0.05,
      text: "the ferry leaves",
      rects: [
        [0.1, 0.1, 0.4, 0.02],
        [0.2, 0.13, 0.5, 0.02],
      ],
    });
    expect(textMarks({ kind: "highlight", color: "#fbe04d" }, [], "x")).toEqual([]);
  });

  it("keeps every line of a selection longer than one mark holds, in marks of its own", () => {
    const lines = Array.from({ length: 257 }, (_, index) => ({
      x: 0.1,
      y: index / 300,
      w: 0.5,
      h: 0.002,
    }));
    const marks = textMarks({ kind: "highlight", color: "#fbe04d" }, lines, "long");
    expect(marks.map((mark) => mark.rects?.length)).toEqual([256, 1]);
    expect(marks[1]?.y).toBe(0.853333);
    expect(new Set(marks.map((mark) => mark.id)).size).toBe(2);
  });

  it("is found on a line it covers, and not between two lines far apart", () => {
    const [mark] = textMarks(
      { kind: "highlight", color: "#fbe04d" },
      [
        { x: 0.1, y: 0.1, w: 0.2, h: 0.02 },
        { x: 0.6, y: 0.8, w: 0.2, h: 0.02 },
      ],
      "both",
    ) as [Mark];
    expect(markAt([mark], [0.2, 0.11], 0)?.id).toBe(mark.id);
    expect(markAt([mark], [0.4, 0.5], 0)).toBeNull();
  });

  it("counts its lines against the file's limit of points", () => {
    const mark = { ...box("h", 0, 0), kind: "highlight" as const };
    const many = { ...mark, rects: Array.from({ length: 256 }, () => [0, 0, 1, 1] as const) };
    const items = Array.from({ length: 79 }, (_, index) => ({
      ...(many as unknown as Mark),
      id: `h${index}`,
    }));
    expect(withinLimits(withMarks(EMPTY_MARKUP, 1, items))).toBe(false);
  });

  it("reads its lines from the server, and nothing else in their place", () => {
    const stored = (rects: unknown) => ({
      markup: {
        rotation: 0,
        pages: [{ page: 1, items: [{ ...box("h", 0, 0), kind: "highlight", rects }] }],
      },
    });
    expect(markupReadable(stored([[0, 0, 1, 1]]))).toBe(true);
    expect(markupReadable(stored([[0, 0, 1]]))).toBe(false);
    expect(markupReadable(stored("x"))).toBe(false);
  });
});

describe("a note", () => {
  it("is square on the page, centred where it was placed, without control characters", () => {
    const note = noteMark([0.5, 0.5], "Check\nthis\u0002", 2);
    expect(note).toMatchObject({
      kind: "note",
      x: 0.4825,
      y: 0.49125,
      w: 0.035,
      h: 0.0175,
      text: "Check\nthis",
    });
  });
});

describe("what is found in a page's text", () => {
  it("finds each match, in any case, as a piece and an offset", () => {
    expect(piecesMatching(["The Ferry", "and the ferry"], "FERRY")).toEqual([
      { from: [0, 4], to: [0, 9] },
      { from: [1, 8], to: [1, 13] },
    ]);
  });

  it("finds words that run from one piece to the next, as the sidebar counts them", () => {
    expect(piecesMatching(["leaves at", "ten"], "at  ten")).toEqual([{ from: [0, 7], to: [1, 3] }]);
  });

  it("reads runs of white space as one, and finds nothing for nothing", () => {
    expect(piecesMatching(["a  \t b"], "a b")).toEqual([{ from: [0, 0], to: [0, 6] }]);
    expect(piecesMatching(["a b"], "  ")).toEqual([]);
    expect(piecesMatching(["a b"], "c")).toEqual([]);
  });

  it("keeps its offsets past a letter outside the basic plane", () => {
    expect(piecesMatching(["𝐀 ferry"], "ferry")).toEqual([{ from: [0, 3], to: [0, 8] }]);
  });
});

describe("markup", () => {
  it("keeps marks per page, in page order, and drops a page left empty", () => {
    let markup = withMarks(EMPTY_MARKUP, 3, [box("a", 0.1, 0.1)]);
    markup = withMarks(markup, 1, [box("b", 0.1, 0.1)]);
    expect(markup.pages.map((page) => page.page)).toEqual([1, 3]);
    expect(marksOf(markup, 3).map((mark) => mark.id)).toEqual(["a"]);
    expect(withMarks(markup, 3, []).pages.map((page) => page.page)).toEqual([1]);
  });

  it("reads the server's reply, and nothing it cannot read", () => {
    expect(markupFromServer({ markup: null, rev: 0 })).toEqual(EMPTY_MARKUP);
    const stored = { rotation: 1, pages: [{ page: 1, items: [box("a", 0, 0)] }] };
    expect(markupFromServer({ markup: stored, rev: 3 })).toEqual(stored);
    expect(markupReadable({ markup: { rotation: 5, pages: [] } })).toBe(false);
    expect(
      markupReadable({ markup: { rotation: 0, pages: [{ page: 1, items: [{ id: 1 }] }] } }),
    ).toBe(false);
    expect(markupFromServer({ error: "x" })).toBeUndefined();
  });

  it("makes boxes from either corner and keeps a line's direction", () => {
    const style = { color: "#000000", stroke: 0.004 };
    const rect = shapeBetween("rect", [0.6, 0.5], [0.2, 0.1], style);
    expect([rect.x, rect.y, rect.w, rect.h]).toEqual([0.2, 0.1, 0.4, 0.4]);
    const arrow = shapeBetween("arrow", [0.6, 0.5], [0.2, 0.1], style);
    expect([arrow.x, arrow.y, arrow.w, arrow.h]).toEqual([0.6, 0.5, -0.4, -0.4]);
    expect(
      shapeBetween("line", [0, 0], [1, 1], { ...style, fill: "#ffffff" }).fill,
    ).toBeUndefined();
    expect(shapeBetween("oval", [0, 0], [1, 1], { ...style, fill: "#ffffff" }).fill).toBe(
      "#ffffff",
    );
  });

  it("finds the topmost mark under the pointer and moves it", () => {
    const marks = [box("under", 0.1, 0.1), box("over", 0.15, 0.12)];
    expect(markAt(marks, [0.2, 0.15])?.id).toBe("over");
    expect(markAt(marks, [0.9, 0.9])).toBeNull();
    const sketch: Mark = {
      ...box("s", 0, 0),
      kind: "sketch",
      points: [
        [0.1, 0.1],
        [0.2, 0.3],
      ],
    };
    expect(moved(sketch, 0.1, -0.05).points).toEqual([
      [0.2, 0.05],
      [0.3, 0.25],
    ]);
  });

  it("thins a long free line to the server's limit, keeping its ends", () => {
    const points: Point[] = Array.from({ length: 10_000 }, (_, i) => [i / 10_000, 0.5]);
    const thin = thinPoints(points);
    expect(thin.length).toBeLessThanOrEqual(4000);
    expect(thin[0]).toEqual([0, 0.5]);
    expect(thin.at(-1)).toEqual([0.9999, 0.5]);
    expect(thinPoints([[3, -4]])).toEqual([[2, -1]]);
  });

  it("knows when markup passes the server's limits", () => {
    const many = Array.from({ length: 501 }, (_, i) => box(`m${i}`, 0, 0));
    expect(withinLimits(withMarks(EMPTY_MARKUP, 1, many))).toBe(false);
    expect(withinLimits(withMarks(EMPTY_MARKUP, 1, many.slice(0, 500)))).toBe(true);
  });

  it("fits a signature to its strokes and places it in its own proportions", () => {
    const signature = signatureFromStrokes([
      [
        [10, 20],
        [110, 70],
      ],
      [[60, 45]],
    ]);
    expect(signature?.aspect).toBe(2);
    expect(signature?.strokes[0]).toEqual([
      [0, 0],
      [1, 1],
    ]);
    expect(signatureFromStrokes([])).toBeNull();
    // Long strokes share the server's limit of points, each keeping its ends.
    const long = (from: number): [number, number][] =>
      Array.from({ length: 4000 }, (_, at) => [from + at, at % 50]);
    const many = signatureFromStrokes([long(0), long(5000), [[1, 1]]]);
    const counts = many?.strokes.map((stroke) => stroke.length) ?? [];
    expect(counts.reduce((sum, n) => sum + n, 0)).toBeLessThanOrEqual(MARKUP_LIMITS.points);
    expect(counts[2]).toBe(1);
    expect(many?.strokes[0]?.[0]).toEqual([0, 0]);
    expect(many?.strokes[1]?.at(-1)?.[0]).toBe(1);
    // On a page twice as wide as it is high, a box 0.3 of the width wide is 0.3 of the height high
    // for a signature twice as wide as it is high.
    const placed = placeSignature(signature as NonNullable<typeof signature>, [0.5, 0.5], 0.3, 2, {
      color: "#000000",
      stroke: 0.003,
    });
    expect(placed.kind).toBe("signature");
    expect(placed.w).toBeCloseTo(0.3);
    expect(placed.h).toBeCloseTo(0.3);
    expect(placed.x).toBeCloseTo(0.35);
  });
});

describe("files and exports", () => {
  it("knows which files Preview opens and how it saves them", () => {
    expect(isPicture({ name: "a.PNG" })).toBe(true);
    expect(isPicture({ name: "scan", type: "image/jpeg" })).toBe(true);
    expect(isPdf({ name: "Report.pdf" })).toBe(true);
    expect(opensInPreview({ name: "notes.txt", type: "text/plain" })).toBe(false);
    expect(opensInPreview({ name: "Pictures", kind: "folder" })).toBe(false);
    expect(saveFormatOf({ name: "a.jpg" })).toBe("image/jpeg");
    expect(saveFormatOf({ name: "a.gif", type: "image/gif" })).toBeNull();
    expect(stemOf("Holiday.final.png")).toBe("Holiday.final");
    expect(nameFor("Holiday.png", "pdf")).toBe("Holiday.pdf");
  });

  it("writes a PDF whose cross-reference table points at each of its objects", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    const page = { jpeg, pixelWidth: 4, pixelHeight: 3, width: 200, height: 150 };
    const bytes = writePdf([page, { ...page, width: 150, height: 200 }], "Ferry (draft)");
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/MediaBox [0 0 150 200]");
    expect(text).toContain(`/Length ${jpeg.length}`);
    expect(text).toContain("/Title (Ferry \\(draft\\))");
    const xref = Number(text.match(/startxref\n(\d+)/)?.[1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    const offsets = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) =>
      Number(m[1]),
    );
    expect(offsets).toHaveLength(9);
    offsets.forEach((offset, index) => {
      expect(text.slice(offset, offset + 12)).toMatch(new RegExp(`^${index + 1} 0 obj`));
    });
    expect(() => writePdf([])).toThrow();
  });

  it("draws a PDF page at the scale asked for, on a canvas of at most 16 million pixels", () => {
    expect(renderScale(2, 612, 792)).toBe(2);
    // A thumbnail of a page 14,400 inches square (UserUnit 75) is drawn smaller than asked.
    const huge = 14_400 * 72;
    const scale = renderScale(0.05, huge, huge);
    expect(scale).toBeLessThan(0.05);
    expect(scale * huge * (scale * huge)).toBeLessThanOrEqual(16_000_000 * (1 + 1e-9));
    // Even when that cap is below the floor for a zero-width request.
    const vast = renderScale(0, 1e9, 1e9);
    expect(vast).toBeLessThan(1e-4);
    expect(vast * 1e9 * (vast * 1e9)).toBeLessThanOrEqual(16_000_000 * (1 + 1e-9));
    expect(renderScale(0, 612, 792)).toBe(1e-4);
  });
});

/* The window. */

const HOME = ["Desktop", "Documents", "Downloads", "Movies", "Music", "Pictures"];
const BEACH: DriveEntry = {
  id: "beach1",
  parent: "pictures",
  name: "beach.png",
  kind: "file",
  size: 5,
  type: "image/png",
  created_ms: 1,
  modified_ms: 1,
};
const REPORT: DriveEntry = {
  id: "report1",
  parent: "pictures",
  name: "report.pdf",
  kind: "file",
  size: 5,
  type: "application/pdf",
  created_ms: 1,
  modified_ms: 1,
};

/** The drive listing the shared Open dialog reads. */
function serveListing(files: DriveEntry[]) {
  const entries: DriveEntry[] = [
    ...HOME.map((name) => ({
      id: name.toLowerCase(),
      name,
      kind: "folder" as const,
      size: 0,
      created_ms: 1,
      modified_ms: 1,
    })),
    ...files,
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://desktop.test");
      if (url.pathname === "/api/files/") {
        return new Response(
          JSON.stringify({
            rev: 1,
            entries,
            usage: 0,
            quota: 1_000_000,
            piece_bytes: 4,
            max_file_bytes: 1000,
            max_entries: 100,
            session: `s-${Math.random()}`,
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }),
  );
}

/** A drive in memory, recording what the window writes. */
function memoryDrive() {
  const saved: { name: string; blob: Blob }[] = [];
  const replaced: { entry: DriveEntry; blob: Blob }[] = [];
  const drive: PreviewDrive = {
    read: vi.fn(async () => new Blob(["bytes"])),
    save: vi.fn(async (target, data) => {
      saved.push({ name: target.name, blob: data });
      return { ...BEACH, id: "saved1", name: target.name, parent: target.folder };
    }),
    replace: vi.fn(async (entry, data) => {
      replaced.push({ entry, blob: data });
      return { ...entry, id: `${entry.id}-2` };
    }),
    current: vi.fn(async () => BEACH),
    opened: vi.fn(),
    create: vi.fn(async (folder, name) => ({ ...BEACH, id: "made1", name, parent: folder })),
    duplicate: vi.fn(async (entry, name) => ({ ...entry, id: "copy1", name })),
    rename: vi.fn(async (entry, name) => ({ ...entry, name })),
    move: vi.fn(async (entry, folder) => ({ ...entry, parent: folder })),
    folders: vi.fn(async () => []),
  };
  return { drive, saved, replaced };
}

/** The text drawn on any canvas, line by line, since the test began. */
const drawnText: string[] = [];
/** The lines begun (`moveTo`) on each canvas since it was last cleared: the strokes it shows. */
const strokesShown = new WeakMap<HTMLCanvasElement, number>();

/** A 2D context of `canvas` that draws nothing and answers what the window asks of it. */
function fakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const values: Record<string | symbol, unknown> = {
    getTransform: () => ({ a: 1, b: 0 }),
    measureText: (text: string) => ({ width: text.length * 10 }),
    fillText: (text: string) => void drawnText.push(text),
    clearRect: () => void strokesShown.set(canvas, 0),
    moveTo: () => void strokesShown.set(canvas, (strokesShown.get(canvas) ?? 0) + 1),
  };
  return new Proxy(values, {
    get: (target, key) => (key in target ? target[key] : () => {}),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const stubPdf = (): PdfFile => ({
  pageCount: 2,
  size: async () => ({ width: 612, height: 792 }),
  render: vi.fn(async () => true),
  text: async (page) =>
    page === 1 ? "The harbour opens at nine" : "The ferry leaves the harbour at ten",
  layOutText: async () => {},
  textRuns: async () => [],
  outline: async () => [],
  fields: async () => [],
  setField: () => {},
  filled: async () => new Uint8Array([7]),
  security: async () => ({}),
  links: async () => [],
  combined: async () => new Uint8Array(),
  destroy: vi.fn(),
});

const stubImage = async () => ({
  image: document.createElement("canvas"),
  width: 400,
  height: 300,
  release: vi.fn(),
});

beforeEach(() => {
  drawnText.length = 0;
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return fakeContext(this) as unknown as ReturnType<HTMLCanvasElement["getContext"]>;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
    this: HTMLCanvasElement,
    done: BlobCallback,
    type?: string,
  ) {
    // The file's bytes name the canvas it was drawn from, so a test can tell what was saved.
    done(new Blob([`canvas ${this.width}x${this.height}`], { type: type ?? "image/png" }));
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function openFile(user: ReturnType<typeof userEvent.setup>, name: string) {
  const dialog = await screen.findByRole("dialog", { name: "Open" });
  await user.dblClick(await within(dialog).findByRole("option", { name }));
}

describe("PreviewApp", () => {
  it("is the demo of the reference captures where no drive is given", () => {
    render(<PreviewApp drive={null} />);
    expect(screen.getByText(/Island Ferry\.pdf \(page 1 of \d+\)/)).toBeInTheDocument();
  });

  it("opens a picture from the drive, turns it, and saves it in place with the edit drawn in", async () => {
    const user = userEvent.setup();
    serveListing([BEACH, REPORT]);
    await loadDrive();
    const { drive, replaced } = memoryDrive();
    render(
      <PreviewApp
        drive={drive}
        served={false}
        loadImage={stubImage}
        loadPdf={async () => stubPdf()}
      />,
    );
    await openFile(user, "beach.png");
    expect(
      await screen.findByText("beach.png", { selector: ".mac-title-bar-title-text" }),
    ).toBeInTheDocument();
    expect(drive.read).toHaveBeenCalledWith("beach1", expect.any(Function));
    expect(drive.opened).toHaveBeenCalledWith("beach1");
    expect(screen.getByRole("img", { name: "Page 1" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rotate Right" }));
    expect(screen.getByText("beach.png — Edited")).toBeInTheDocument();
    // A quarter turn makes the landscape picture's page taller than it is wide.
    const page = screen.getByRole("img", { name: "Page 1" });
    expect(Number.parseFloat(page.style.height)).toBeGreaterThan(
      Number.parseFloat(page.style.width),
    );

    await user.keyboard("{Meta>}s{/Meta}");
    await waitFor(() => expect(replaced).toHaveLength(1));
    expect(replaced[0]?.entry.id).toBe("beach1");
    expect(replaced[0]?.blob.type).toBe("image/png");
    // The quarter turn is in the picture saved: 400 × 300 comes back 300 × 400.
    expect(await replaced[0]?.blob.text()).toBe("canvas 300x400");
    expect(await screen.findByText("Saved “beach.png”.")).toBeInTheDocument();
    expect(screen.queryByText("beach.png — Edited")).toBeNull();
  });

  it("undoes an edit", async () => {
    const user = userEvent.setup();
    serveListing([BEACH]);
    await loadDrive();
    const { drive } = memoryDrive();
    render(<PreviewApp drive={drive} served={false} loadImage={stubImage} />);
    await openFile(user, "beach.png");
    await user.click(await screen.findByRole("button", { name: "Rotate Left" }));
    expect(screen.getByText("beach.png — Edited")).toBeInTheDocument();
    await user.keyboard("{Meta>}z{/Meta}");
    expect(screen.queryByText("beach.png — Edited")).toBeNull();
  });

  it("redoes what was undone, until a new change", async () => {
    const user = userEvent.setup();
    serveListing([BEACH]);
    const { drive } = memoryDrive();
    await loadDrive();
    render(
      <PreviewApp
        drive={drive}
        served={false}
        loadImage={stubImage}
        loadPdf={async () => stubPdf()}
      />,
    );
    await openFile(user, "beach.png");
    await screen.findByText("beach.png", { selector: ".mac-title-bar-title-text" });
    const edited = () => screen.queryByText(/Edited/);
    await user.click(screen.getByRole("button", { name: "Rotate Right" }));
    expect(edited()).not.toBeNull();
    await user.keyboard("{Meta>}z{/Meta}");
    expect(edited()).toBeNull();
    await user.keyboard("{Meta>}{Shift>}z{/Shift}{/Meta}");
    expect(edited()).not.toBeNull();
    await user.keyboard("{Meta>}z{/Meta}");
    await user.keyboard("{Meta>}l{/Meta}");
    await user.keyboard("{Meta>}{Shift>}z{/Shift}{/Meta}");
    await user.keyboard("{Meta>}z{/Meta}");
    expect(edited()).toBeNull();
  });

  it("downloads a picture as a PDF of one page", async () => {
    const user = userEvent.setup();
    serveListing([BEACH]);
    await loadDrive();
    const { drive } = memoryDrive();
    const urls: Blob[] = [];
    // jsdom has no createObjectURL: set both for this test and put back what was there after.
    const original = {
      createObjectURL: URL.createObjectURL,
      revokeObjectURL: URL.revokeObjectURL,
    };
    onTestFinished(() => void Object.assign(URL, original));
    Object.assign(URL, {
      createObjectURL: (blob: Blob) => {
        urls.push(blob);
        return "blob:test";
      },
      revokeObjectURL: () => {},
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<PreviewApp drive={drive} served={false} loadImage={stubImage} />);
    await openFile(user, "beach.png");
    await user.click(await screen.findByRole("button", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: "Download as PDF" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const pdf = urls.at(-1) as Blob;
    expect(pdf.type).toBe("application/pdf");
    expect(new TextDecoder().decode(new Uint8Array(await pdf.arrayBuffer())).slice(0, 8)).toBe(
      "%PDF-1.4",
    );
  });

  it("opens a PDF with a thumbnail per page and finds text on its pages", async () => {
    const user = userEvent.setup();
    serveListing([REPORT]);
    await loadDrive();
    const { drive } = memoryDrive();
    const pdf = stubPdf();
    render(<PreviewApp drive={drive} served={false} loadPdf={async () => pdf} />);
    await openFile(user, "report.pdf");
    expect(await screen.findByText("report.pdf (page 1 of 2)")).toBeInTheDocument();
    const thumbnails = screen.getByRole("listbox", { name: "Thumbnails" });
    expect(within(thumbnails).getAllByRole("option")).toHaveLength(2);
    await waitFor(() => expect(pdf.render).toHaveBeenCalled());
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "ferry");
    expect(await screen.findByText("Found on 1 page")).toBeInTheDocument();
    const found = screen.getByRole("listbox", { name: "Pages found" });
    expect(within(found).getByText("Page 2")).toBeInTheDocument();
  });

  // The document channel survives window remounts, as does this server revision.
  let placesRevision = 0;
  it.each([false, true])(
    "keeps a file opened during the initial places read, including its current layout (previously listed: %s)",
    async (previouslyListed) => {
      const user = userEvent.setup();
      serveListing([REPORT, BEACH]);
      await loadDrive();
      const listing = globalThis.fetch;
      const older: Place = {
        file: BEACH.id,
        name: BEACH.name,
        page: 1,
        zoom: 1,
        opened_ms: 1,
      };
      const initialRevision = ++placesRevision;
      let stored = {
        places: previouslyListed
          ? [{ ...older, file: REPORT.id, name: REPORT.name }, older]
          : [older],
        rev: initialRevision,
        session: "preview-late-places",
      };
      let release!: (response: Response) => void;
      const firstRead = new Promise<Response>((resolve) => {
        release = resolve;
      });
      let reads = 0;
      const writes: { places: Place[]; rev: number }[] = [];
      const reply = (body: unknown) =>
        new Response(JSON.stringify(body), {
          headers: { "content-type": "application/json" },
        });
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const path = new URL(String(input), "http://desktop.test").pathname;
          if (path === "/api/preview/places") {
            if (init?.method === "PUT") {
              const body = JSON.parse(String(init.body));
              writes.push(body);
              stored = { ...stored, places: body.places, rev: ++placesRevision };
              return reply(stored);
            }
            reads += 1;
            return reads === 1 ? firstRead : reply(stored);
          }
          if (path === "/api/preview/signatures") return reply({ signatures: [], rev: 1 });
          if (path.startsWith("/api/preview/markup/"))
            return reply({ markup: EMPTY_MARKUP, rev: 1 });
          if (path === "/api/spotlight/pdf-text") return reply({});
          return listing(input, init);
        }),
      );
      const { drive } = memoryDrive();
      drive.current = vi.fn(async (id) => [REPORT, BEACH].find((file) => file.id === id));
      const app = () => <PreviewApp drive={drive} served loadPdf={async () => stubPdf()} />;
      onTestFinished(() => release(reply(stored)));
      const mounted = render(app());
      await waitFor(() => expect(reads).toBe(1));
      await user.click(
        within(screen.getByRole("toolbar", { name: "Preview toolbar" })).getByRole("button", {
          name: "Open…",
        }),
      );
      await openFile(user, REPORT.name);
      await screen.findByText("report.pdf (page 1 of 2)");
      await user.click(screen.getByRole("button", { name: "View" }));
      await user.click(await screen.findByRole("menuitemradio", { name: "Single Page" }));
      screen.getByRole("button", { name: "Rotate Right" }).focus();
      await user.keyboard("{End}");
      await screen.findByText("report.pdf (page 2 of 2)");
      expect(writes).toHaveLength(0);

      await act(async () => release(reply(stored)));
      await waitFor(() =>
        expect(stored.places[0]).toMatchObject({
          file: REPORT.id,
          page: 2,
          display: "single",
        }),
      );
      expect(stored.places).toHaveLength(2);
      expect(stored.places[1]).toEqual(older);
      expect(stored.places[0]?.opened_ms).toBeGreaterThan(1);
      expect(writes[0]?.rev).toBe(initialRevision);
      expect(screen.queryByRole("dialog", { name: "Open" })).toBeNull();

      mounted.unmount();
      render(app());
      await screen.findByText("report.pdf (page 2 of 2)");
      expect(screen.getByRole("img", { name: "Page 2" })).toBeInTheDocument();
      expect(screen.queryByRole("img", { name: "Page 1" })).toBeNull();
    },
  );

  it("puts the cursor in the search field on Command-F, for a PDF only", async () => {
    const user = userEvent.setup();
    serveListing([REPORT, BEACH]);
    await loadDrive();
    const { drive } = memoryDrive();
    render(
      <PreviewApp
        drive={drive}
        served={false}
        loadImage={stubImage}
        loadPdf={async () => stubPdf()}
      />,
    );
    await openFile(user, "report.pdf");
    const search = await screen.findByRole("searchbox", { name: "Search" });
    await waitFor(() => expect(search).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Rotate Right" }));
    await user.keyboard("{Meta>}f{/Meta}");
    await waitFor(() => expect(search).toHaveFocus());
  });

  it("moves through a PDF's pages from the keys, and goes back where it was", async () => {
    const user = userEvent.setup();
    serveListing([REPORT]);
    await loadDrive();
    const { drive } = memoryDrive();
    render(<PreviewApp drive={drive} served={false} loadPdf={async () => stubPdf()} />);
    await openFile(user, "report.pdf");
    const title = async (text: string) =>
      expect(
        await screen.findByText(new RegExp(`page ${text} of 2`), {
          selector: ".mac-title-bar-title-text",
        }),
      ).toBeInTheDocument();
    await title("1");
    screen.getByRole("button", { name: "Rotate Right" }).focus();
    await user.keyboard("{End}");
    await title("2");
    await user.keyboard("{PageDown}");
    await title("2");
    await user.keyboard("{Home}");
    await title("1");
    await user.keyboard("{Meta>}{ArrowDown}{/Meta}");
    await title("2");
    await user.keyboard("{Meta>}{ArrowUp}{/Meta}");
    await title("1");
    await user.keyboard("{Meta>}[[{/Meta}");
    await title("2");
    await user.keyboard("{Meta>}]{/Meta}");
    await title("1");
  });

  it("goes to the page asked for, and refuses one the PDF does not have", async () => {
    const user = userEvent.setup();
    serveListing([REPORT]);
    await loadDrive();
    const { drive } = memoryDrive();
    render(<PreviewApp drive={drive} served={false} loadPdf={async () => stubPdf()} />);
    await openFile(user, "report.pdf");
    await screen.findByText(/page 1 of 2/, { selector: ".mac-title-bar-title-text" });
    screen.getByRole("button", { name: "Rotate Right" }).focus();
    await user.keyboard("{Alt>}{Meta>}g{/Meta}{/Alt}");
    const field = await screen.findByRole("textbox", { name: "Page" });
    await user.clear(field);
    await user.type(field, "9");
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
    await user.clear(field);
    await user.type(field, "2{Enter}");
    expect(
      await screen.findByText(/page 2 of 2/, { selector: ".mac-title-bar-title-text" }),
    ).toBeInTheDocument();
  });

  it("asks before closing on a picture whose edits are not saved", async () => {
    const user = userEvent.setup();
    serveListing([BEACH]);
    await loadDrive();
    const { drive } = memoryDrive();
    const onClose = vi.fn();
    render(<PreviewApp drive={drive} served={false} loadImage={stubImage} onClose={onClose} />);
    await openFile(user, "beach.png");
    const leave = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(leave()).toBe(false);
    await user.click(await screen.findByRole("button", { name: "Rotate Right" }));
    // Leaving the page asks too.
    expect(leave()).toBe(true);
    await user.click(screen.getByRole("button", { name: "Close" }));
    let alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("Do you want to save the changes made to the document");
    await user.click(within(alert).getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("beach.png — Edited")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    alert = await screen.findByRole("alertdialog");
    await user.click(within(alert).getByRole("button", { name: "Don’t Save" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves the drive as it was when the saved picture cannot be read back", async () => {
    const user = userEvent.setup();
    serveListing([BEACH]);
    await loadDrive();
    const { drive, replaced } = memoryDrive();
    const loadImage = vi
      .fn(stubImage)
      .mockImplementationOnce(stubImage)
      .mockRejectedValueOnce(new Error("The picture is damaged."));
    render(<PreviewApp drive={drive} served={false} loadImage={loadImage} />);
    await openFile(user, "beach.png");
    await user.click(await screen.findByRole("button", { name: "Rotate Right" }));
    await user.keyboard("{Meta>}s{/Meta}");
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("could not be saved. The picture is damaged.");
    expect(replaced).toHaveLength(0);
    expect(screen.getByText("beach.png — Edited")).toBeInTheDocument();
  });

  it("saves once at a time, and takes no edit while it saves", async () => {
    const user = userEvent.setup();
    serveListing([BEACH]);
    await loadDrive();
    const { drive, replaced } = memoryDrive();
    let finish: () => void = () => {};
    const replace = drive.replace;
    drive.replace = vi.fn(
      (entry: DriveEntry, data: Blob) =>
        new Promise<DriveEntry>((resolve, reject) => {
          finish = () => void replace(entry, data).then(resolve, reject);
        }),
    );
    render(<PreviewApp drive={drive} served={false} loadImage={stubImage} />);
    await openFile(user, "beach.png");
    await user.click(await screen.findByRole("button", { name: "Rotate Right" }));
    await user.keyboard("{Meta>}s{/Meta}");
    await waitFor(() => expect(drive.replace).toHaveBeenCalledTimes(1));
    // A second save and an edit while the first is under way do nothing.
    await user.keyboard("{Meta>}s{/Meta}");
    await user.keyboard("{Meta>}r{/Meta}");
    finish();
    expect(await screen.findByText("Saved “beach.png”.")).toBeInTheDocument();
    expect(drive.replace).toHaveBeenCalledTimes(1);
    expect(replaced).toHaveLength(1);
    expect(screen.queryByText("beach.png — Edited")).toBeNull();
  });

  it("keeps exactly the text the box shows when more than a text mark holds is pasted", async () => {
    const user = userEvent.setup();
    serveListing([BEACH]);
    await loadDrive();
    const { drive } = memoryDrive();
    render(<PreviewApp drive={drive} served={false} loadImage={stubImage} />);
    await openFile(user, "beach.png");
    await user.click(await screen.findByRole("button", { name: "Show Markup Toolbar" }));
    await user.click(screen.getByRole("button", { name: "Text" }));
    const marks = document.querySelector(".mac-preview-app-page-marks") as HTMLCanvasElement;
    fireEvent.pointerDown(marks, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    const box = await screen.findByRole("textbox", { name: "Text" });
    await user.click(box);
    const pasted = "  abcdefghij".repeat(200);
    await user.paste(pasted);
    // The box holds the first 2,000 characters, leading spaces too, and says it is full.
    expect((box as HTMLInputElement).value).toBe(pasted.slice(0, 2000));
    expect(await screen.findByText(/A text keeps at most 2,000 characters/)).toBeInTheDocument();
    drawnText.length = 0;
    await user.keyboard("{Enter}");
    // The mark kept is exactly what the box showed, spaces included.
    await waitFor(() => expect(drawnText).toContain(pasted.slice(0, 2000)));
    expect(drawnText.some((text) => text.length > 2000)).toBe(false);
  });

  it("shows why a file could not be opened", async () => {
    const user = userEvent.setup();
    serveListing([REPORT]);
    await loadDrive();
    const { drive } = memoryDrive();
    render(
      <PreviewApp
        drive={drive}
        served={false}
        loadPdf={async () => {
          throw new Error("Invalid PDF structure.");
        }}
      />,
    );
    await openFile(user, "report.pdf");
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("“report.pdf” could not be opened. Invalid PDF structure.");
  });

  it("refuses an eleventh signature and removes none of the ten kept", async () => {
    const user = userEvent.setup();
    serveListing([BEACH]);
    await loadDrive();
    const { drive } = memoryDrive();
    render(<PreviewApp drive={drive} served={false} loadImage={stubImage} />);
    await openFile(user, "beach.png");
    await user.click(await screen.findByRole("button", { name: "Show Markup Toolbar" }));
    const openSign = async () => {
      await user.click(screen.getByRole("button", { name: "Sign" }));
      return screen.findByRole("menu");
    };
    for (let made = 0; made < MARKUP_LIMITS.signatures; made += 1) {
      await user.click(
        within(await openSign()).getByRole("menuitem", { name: "Create Signature…" }),
      );
      const pad = await screen.findByRole("img", { name: "Signature pad" });
      fireEvent.pointerDown(pad, { button: 0, clientX: 10 + made, clientY: 10, pointerId: 1 });
      fireEvent.pointerMove(pad, { clientX: 60, clientY: 40 + made, pointerId: 1 });
      fireEvent.pointerUp(pad, { pointerId: 1 });
      await user.click(screen.getByRole("button", { name: "Done" }));
      await waitFor(() => expect(screen.queryByRole("img", { name: "Signature pad" })).toBeNull());
    }
    await user.click(within(await openSign()).getByRole("menuitem", { name: "Create Signature…" }));
    const alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent(
      "Preview keeps at most 10 signatures. Delete them (Sign → Delete All Signatures) to make another; none is removed for you.",
    );
    expect(screen.queryByRole("img", { name: "Signature pad" })).toBeNull();
    await user.click(within(alert).getByRole("button", { name: "OK" }));
    const kept = within(await openSign())
      .getAllByRole("menuitem")
      .map((item) => item.textContent)
      .filter((text) => text?.startsWith("Signature "));
    expect(kept).toEqual(Array.from({ length: 10 }, (_, i) => `Signature ${i + 1}`));
  });

  it("takes no stroke past a signature's limit on the pad, and says so", async () => {
    const user = userEvent.setup();
    serveListing([BEACH]);
    await loadDrive();
    const { drive } = memoryDrive();
    render(<PreviewApp drive={drive} served={false} loadImage={stubImage} />);
    await openFile(user, "beach.png");
    await user.click(await screen.findByRole("button", { name: "Show Markup Toolbar" }));
    await user.click(screen.getByRole("button", { name: "Sign" }));
    await user.click(await screen.findByRole("menuitem", { name: "Create Signature…" }));
    const pad = await screen.findByRole("img", { name: "Signature pad" });
    if (!(pad instanceof HTMLCanvasElement)) throw new Error("The signature pad is no canvas.");
    const draw = (at: number) => {
      fireEvent.pointerDown(pad, { button: 0, clientX: at, clientY: 10, pointerId: 1 });
      fireEvent.pointerMove(pad, { clientX: at, clientY: 30, pointerId: 1 });
      fireEvent.pointerUp(pad, { pointerId: 1 });
    };
    for (let at = 0; at < MARKUP_LIMITS.strokes; at += 1) draw(at);
    expect(
      await screen.findByText("A signature holds at most 64 strokes; Clear to start again."),
    ).toBeInTheDocument();
    await waitFor(() => expect(strokesShown.get(pad)).toBe(64));
    // A 65th stroke is not taken: had it been kept, its second point would have drawn the pad
    // again with 65.
    draw(200);
    await new Promise((settle) => setTimeout(settle, 50));
    expect(strokesShown.get(pad)).toBe(64);
    // The signature placed on the page holds the 64 strokes the pad showed.
    await user.click(screen.getByRole("button", { name: "Done" }));
    const marks = document.querySelector("canvas.mac-preview-app-page-marks");
    if (!(marks instanceof HTMLCanvasElement)) throw new Error("The page has no markup canvas.");
    await waitFor(() => expect(strokesShown.get(marks)).toBe(64));
  });
});
