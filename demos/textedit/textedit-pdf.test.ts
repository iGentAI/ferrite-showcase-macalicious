import { describe, expect, it } from "vitest";
import { layoutPdf, type MeasureText, type PdfMark } from "./textedit-pdf";
import { DEFAULT_STYLE, paragraphsOfLines, type RtfParagraph } from "./textedit-rtf";

/** Every character six points wide. */
const measure: MeasureText = (text) => text.length * 6;
const LETTER = { paper: "letter", orientation: "portrait", scale: 100 } as const;

const textsOf = (page: { marks: readonly PdfMark[] }) =>
  page.marks.flatMap((mark) => (mark.kind === "text" ? [mark.text] : []));

describe("File > Export as PDF… layout", () => {
  it("breaks a line at the page's width, which is 468 points of text on Letter", () => {
    // 78 characters fit at six points each.
    const word = "x".repeat(40);
    const [page, ...others] = layoutPdf(paragraphsOfLines([`${word} ${word}`]), LETTER, measure);
    expect(others).toEqual([]);
    expect(page?.width).toBe(612);
    expect(page?.height).toBe(792);
    const marks = page?.marks.filter((mark) => mark.kind === "text") ?? [];
    expect(textsOf(page as NonNullable<typeof page>).filter((text) => text.trim())).toEqual([
      word,
      word,
    ]);
    expect(marks[0]?.y).not.toBe(marks.at(-1)?.y);
    expect(marks.at(-1)?.x).toBe(0);
  });

  it("goes on to the next page when the page is full, by whole lines", () => {
    // A 12 pt line is 14 points high, and 648 points of text hold 46 of them.
    const pages = layoutPdf(
      paragraphsOfLines(Array.from({ length: 47 }, (_, at) => `Line ${at}`)),
      LETTER,
      measure,
    );
    expect(pages).toHaveLength(2);
    expect(textsOf(pages[1] as NonNullable<(typeof pages)[1]>)).toContain("46");
  });

  it("follows Page Setup's paper, orientation and scale", () => {
    const [wide] = layoutPdf(
      paragraphsOfLines(["x".repeat(150)]),
      { paper: "a4", orientation: "landscape", scale: 50 },
      measure,
    );
    expect([wide?.width, wide?.height]).toEqual([842, 595]);
    // At half size 1396 points of text fit, so the long word stays on one line.
    expect(wide?.marks).toHaveLength(1);
  });

  it("aligns, numbers a list, and places a picture and a table's cells", () => {
    const style = { ...DEFAULT_STYLE };
    const paragraphs: RtfParagraph[] = [
      { align: "right", runs: [{ text: "end", style }] },
      { align: "left", list: "decimal", runs: [{ text: "one", style }] },
      { align: "left", list: "decimal", runs: [{ text: "two", style }] },
      {
        align: "left",
        runs: [
          {
            text: "",
            style,
            picture: { src: "data:image/png;base64,AA==", width: 936, height: 100 },
          },
        ],
      },
      {
        align: "left",
        runs: [],
        table: {
          border: 1,
          rows: [
            [
              { paragraphs: [{ align: "left", runs: [{ text: "A", style }] }] },
              { paragraphs: [{ align: "left", runs: [{ text: "B", style }] }] },
            ],
          ],
        },
      },
    ];
    const [page] = layoutPdf(paragraphs, LETTER, measure);
    const marks = page?.marks ?? [];
    const at = (text: string) => marks.find((mark) => mark.kind === "text" && mark.text === text);
    expect(at("end")?.x).toBe(468 - 18);
    expect(at("1.")).toBeDefined();
    expect(at("2.")).toBeDefined();
    expect(at("one")?.x).toBe(28);
    const picture = marks.find((mark) => mark.kind === "picture");
    // Scaled down to the width of the text.
    expect([picture?.width, (picture as { height?: number } | undefined)?.height]).toEqual([
      468, 50,
    ]);
    expect(marks.filter((mark) => mark.kind === "box").map((mark) => mark.x)).toEqual([0, 234]);
    expect(at("B")?.x).toBe(238);
  });
});
