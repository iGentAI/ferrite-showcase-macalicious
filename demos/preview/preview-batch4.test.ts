import { describe, expect, it } from "vitest";
import { type PdfTextRun, writePdf } from "./preview-export";
import {
  cutOut,
  handleAt,
  handlesOf,
  type Mark,
  markFont,
  markupReadable,
  moved,
  resized,
  shapeBetween,
  typedRuns,
  WHOLE_PAGE,
} from "./preview-markup";
import { outlineBetween } from "./preview-shapes";

const style = { color: "#ff3b30", stroke: 0.004 };
const latin = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

describe("a polygon", () => {
  const polygon = () => outlineBetween("polygon", [0.2, 0.2], [0.6, 0.6], style);

  it("has its box's four handles, one per corner, and one for its sides", () => {
    const mark = polygon();
    expect(mark.sides).toBe(6);
    expect(mark.points).toHaveLength(7);
    expect(handlesOf(mark)).toHaveLength(4 + 6 + 1);
  });

  it("moves one corner by its handle, and the first corner stays the closing point", () => {
    const mark = polygon();
    const first = resized(mark, 4, [0.4, 0.05]);
    expect(first.points?.[0]).toEqual([0.4, 0.05]);
    expect(first.points?.at(-1)).toEqual([0.4, 0.05]);
    const third = resized(mark, 6, [0.9, 0.9]);
    expect(third.points?.[2]).toEqual([0.9, 0.9]);
    expect(third.points?.[0]).toEqual(mark.points?.[0]);
  });

  it("asks for more or fewer sides by the handle across its middle", () => {
    const mark = polygon();
    const handle = handlesOf(mark).length - 1;
    const most = resized(mark, handle, [0.6, 0.4]);
    expect(most.sides).toBe(12);
    expect(most.points).toHaveLength(13);
    const least = resized(mark, handle, [0.2, 0.4]);
    expect(least.sides).toBe(3);
    expect(least.points).toHaveLength(4);
    // The same number of sides leaves corners moved by hand as they are.
    const shaped = resized(mark, 5, [0.9, 0.3]);
    const here = handlesOf(shaped)[handle] as [number, number];
    expect(resized(shaped, handle, here)).toBe(shaped);
  });

  it("finds a corner's handle before the box's at the same place", () => {
    const mark = polygon();
    const first = mark.points?.[0] ?? [0, 0];
    expect(handleAt(mark, [first[0], first[1]], 0.001)).toBe(4);
  });
});

describe("a loupe", () => {
  it("goes from 1 to 5 times by its second handle", () => {
    const mark = shapeBetween("loupe", [0.2, 0.2], [0.6, 0.6], style);
    expect(handlesOf(mark)).toHaveLength(5);
    expect(resized(mark, 4, [0.6, 0.4]).power).toBe(5);
    expect(resized(mark, 4, [0.2, 0.4]).power).toBe(1);
    expect(resized(mark, 4, [0.4, 0.4]).power).toBe(3);
    expect(resized(mark, 2, [0.8, 0.8]).w).toBe(0.6);
  });

  it("is what the window reads back from the server with its power", () => {
    const mark: Mark = { ...shapeBetween("loupe", [0, 0], [1, 1], style), power: 3 };
    expect(markupReadable({ markup: { rotation: 0, pages: [{ page: 1, items: [mark] }] } })).toBe(
      true,
    );
  });
});

describe("a speech bubble", () => {
  it("takes what it says along when it moves and when it is resized", () => {
    const mark: Mark = {
      ...outlineBetween("bubble", [0.2, 0.2], [0.6, 0.6], style),
      text: "Hello",
      size: 0.03,
    };
    expect(mark.bubble).toBe(true);
    const away = moved(mark, 0.1, 0.1);
    expect(away.text).toBe("Hello");
    expect(away.points?.[0]?.[0]).toBeCloseTo((mark.points?.[0]?.[0] ?? 0) + 0.1, 6);
    expect(resized(mark, 2, [0.9, 0.9]).text).toBe("Hello");
  });
});

describe("a text's style", () => {
  it("goes in the font a canvas draws with", () => {
    expect(markFont("Georgia", 12, { bold: true, italic: true })).toBe(
      "italic bold 12px Georgia, serif",
    );
    expect(markFont("Georgia", 12, { italic: true })).toBe("italic 12px Georgia, serif");
    expect(markFont("Georgia", 12)).toBe("12px Georgia, serif");
  });
});

describe("cutting a picture's selection", () => {
  const recording = () => {
    const calls: string[] = [];
    const context = {
      globalCompositeOperation: "source-over",
      fillStyle: "",
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      beginPath: () => calls.push("begin"),
      lineTo: (x: number, y: number) => calls.push(`to ${x},${y}`),
      closePath: () => calls.push("close"),
      fill() {
        calls.push(`fill ${this.globalCompositeOperation} ${this.fillStyle}`);
      },
    };
    return { calls, context: context as unknown as CanvasRenderingContext2D };
  };
  const cut = [
    [0.25, 0.5],
    [0.5, 0.5],
    [0.5, 1],
  ] as const;

  it("clears it to transparency in page pixels", () => {
    const { calls, context } = recording();
    cutOut(context, [cut as never], 100, 10);
    expect(calls).toEqual([
      "save",
      "begin",
      "to 25,5",
      "to 50,5",
      "to 50,10",
      "close",
      "fill destination-out ",
      "restore",
    ]);
  });

  it("fills it with white on a format without transparency", () => {
    const { calls, context } = recording();
    cutOut(context, [cut as never], 100, 10, "#ffffff");
    expect(calls).toContain("fill source-over #ffffff");
  });

  it("does nothing without a cut", () => {
    const { calls, context } = recording();
    cutOut(context, [], 100, 10);
    expect(calls).toEqual([]);
  });
});

describe("a PDF written with marks", () => {
  const page = {
    jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    pixelWidth: 2,
    pixelHeight: 2,
    width: 100,
    height: 200,
  };

  it("carries the page's text invisibly, mapped back to its characters", () => {
    const run: PdfTextRun = { text: "Hi", matrix: [10, 0, 0, 10, 5, 6], width: 20 };
    const written = latin(writePdf([{ ...page, text: [run] }], "T"));
    expect(written).toContain("BT 3 Tr /F0 1 Tf 200 Tz 10 0 0 10 5 6 Tm <00480069> Tj ET");
    expect(written).toContain("/Font << /F0 7 0 R >>");
    expect(written).toContain("/ToUnicode 9 0 R");
    expect(written).toContain("<0000> <ffff> <0000>");
    expect(written).toContain("/Size 10 ");
  });

  it("has no font on a page without text", () => {
    const written = latin(writePdf([page], "T"));
    expect(written).not.toContain("/Font");
    expect(written).toContain("/Size 7 ");
  });

  it("carries what a text mark and a bubble say, placed on the page", () => {
    const text: Mark = {
      ...shapeBetween("rect", [0.5, 0.25], [0.75, 0.5], style),
      kind: "text",
      text: "One\nTwo",
      size: 0.1,
    };
    const runs = typedRuns(
      [text],
      { width: 100, height: 200 },
      { crop: WHOLE_PAGE, turns: 0 },
      100,
      200,
    );
    expect(runs.map((run) => run.text)).toEqual(["One", "Two"]);
    expect(runs[0]?.matrix).toEqual([10, 0, 0, 10, 50, 138]);
    expect(runs[1]?.matrix).toEqual([10, 0, 0, 10, 50, 126]);
  });
});
