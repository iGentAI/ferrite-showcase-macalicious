import { describe, expect, it } from "vitest";
import { copyRuler, pasteRuler, setParagraphTabs, stepRuler } from "./textedit-document";
import { layoutPdf, type MeasureText } from "./textedit-pdf";
import { paragraphsOfContent, paragraphsToHtml, readRtf, writeRtf } from "./textedit-rtf";
import { contentToHtml, htmlToContent } from "./textedit-server";
import {
  type FollowingText,
  parseTabStops,
  type TabStop,
  tabEnd,
  tabStopsText,
  withoutTabLayout,
} from "./textedit-tab-stops";

const STOPS: readonly TabStop[] = [
  { at: 72, kind: "left" },
  { at: 144, kind: "center" },
  { at: 216, kind: "right" },
  { at: 288, kind: "decimal" },
];
const TEN: FollowingText = { width: 10, beforeDecimal: 4 };

const view = (html: string) => {
  const node = document.createElement("div");
  node.innerHTML = html;
  document.body.append(node);
  return node;
};
const rangeIn = (element: Element) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range;
};

describe("where a tab ends", () => {
  it("goes to the first stop past where it starts, placed by that stop's kind", () => {
    expect(tabEnd(0, STOPS, TEN)).toBe(72);
    expect(tabEnd(72, STOPS, TEN)).toBe(139);
    expect(tabEnd(150, STOPS, TEN)).toBe(206);
    expect(tabEnd(220, STOPS, TEN)).toBe(284);
  });

  it("counts stops from the ruler's origin, not the paragraph's edge", () => {
    expect(tabEnd(0, STOPS, TEN, 18)).toBe(54);
    expect(tabEnd(0, [{ at: 10, kind: "left" }], TEN, 18)).toBe(54);
  });

  it("goes to the next inch past the last stop", () => {
    expect(tabEnd(300, STOPS, TEN)).toBe(360);
    expect(tabEnd(0, [], TEN)).toBe(72);
  });

  it("lets text too wide for its stop follow the tab", () => {
    expect(tabEnd(210, [{ at: 216, kind: "right" }], { width: 50, beforeDecimal: 50 })).toBe(
      210.01,
    );
  });
});

describe("a paragraph's stops as text", () => {
  it("round-trips", () => {
    expect(tabStopsText(STOPS)).toBe("72l 144c 216r 288d");
    expect(parseTabStops("72l 144c 216r 288d")).toEqual(STOPS);
    expect(parseTabStops(undefined)).toBeUndefined();
  });

  it("leaves the layout's widths out of what two views compare", () => {
    expect(
      withoutTabLayout(
        '<div><span style="tab-size: 72.5px;">\t</span>a<span style="white-space: pre; tab-size: 9px;">\t</span></div>',
      ),
    ).toBe('<div><span>\t</span>a<span style="white-space: pre;">\t</span></div>');
  });
});

describe("stops of their own on a paragraph", () => {
  const TWO = "<div>One</div><div>Two</div>";

  it("go on the selection's paragraphs only, and Undo takes them back", () => {
    const node = view(TWO);
    const two = node.children[1] as HTMLElement;
    setParagraphTabs(node, rangeIn(two), STOPS);
    expect(two.dataset.tabs).toBe("72l 144c 216r 288d");
    expect((node.children[0] as HTMLElement).dataset.tabs).toBeUndefined();
    two.insertAdjacentHTML("afterbegin", '<span style="tab-size: 10px;">\t</span>');
    two.firstElementChild?.remove();
    expect(stepRuler(node, "undo")).toBe(true);
    expect(two.dataset.tabs).toBeUndefined();
  });

  it("are still undone after the layout has set a tab's width", () => {
    const node = view('<div><span style="tab-size: 10px;">\t</span>x</div>');
    const line = node.children[0] as HTMLElement;
    setParagraphTabs(node, rangeIn(line), STOPS);
    (line.firstElementChild as HTMLElement).style.setProperty("tab-size", "200px");
    expect(stepRuler(node, "undo")).toBe(true);
    expect(line.dataset.tabs).toBeUndefined();
  });

  it("go with Copy Ruler and Paste Ruler", () => {
    const node = view(TWO);
    const [one, two] = [...node.children] as HTMLElement[];
    setParagraphTabs(node, rangeIn(one as Element), STOPS);
    const copied = copyRuler(node, rangeIn(one as Element));
    pasteRuler(node, rangeIn(two as Element), copied as NonNullable<typeof copied>);
    expect(two?.dataset.tabs).toBe("72l 144c 216r 288d");
  });

  it("survive what a stored draft is cleaned with", () => {
    const clean = contentToHtml(
      htmlToContent(
        '<div data-tabs="72l 144c" onclick="x()"><span style="tab-size: 10.5px">\t</span>a</div>',
        document,
      ),
    );
    expect(clean).toBe(
      '<div data-tabs="72l 144c"><span style="tab-size: 10.5px;">\t</span>a</div>',
    );
  });

  it("are refused when they are not stops", () => {
    expect(contentToHtml(htmlToContent('<div data-tabs="x">a</div>', document))).toBe(
      "<div>a</div>",
    );
  });
});

describe("stops in an RTF file", () => {
  it("are written with \\tx, \\tqc, \\tqr and \\tqdec, only on the paragraph that has them", () => {
    const node = view(`<div>One</div><div data-tabs="${tabStopsText(STOPS)}">a\tb</div>`);
    const rtf = writeRtf(paragraphsOfContent(node), {
      first: 0,
      head: 0,
      tail: 0,
      tabStops: [36],
    });
    expect(rtf).toContain("\\pard\\tx1440\\tqc\\tx2880\\tqr\\tx4320\\tqdec\\tx5760");
    expect(rtf).toContain("\\pard\\tx720");
    const { paragraphs, ruler } = readRtf(rtf);
    expect(ruler?.tabStops).toEqual([36]);
    expect(paragraphs[0]?.tabs).toBeUndefined();
    expect(paragraphs[1]?.tabs).toEqual(STOPS);
    expect(paragraphsToHtml(paragraphs)).toContain('data-tabs="72l 144c 216r 288d"');
  });

  it("keeps a file whose paragraphs share the first one's stops on its ruler", () => {
    const { paragraphs, ruler } = readRtf(
      "{\\rtf1\\ansi\\pard\\tx720\\tx1440 One\\par\\pard\\tx720\\tx1440 Two\\par}",
    );
    expect(ruler?.tabStops).toEqual([36, 72]);
    expect(paragraphs[1]?.tabs).toBeUndefined();
  });

  it("reads a stop of another kind from Word's order of words", () => {
    const { paragraphs } = readRtf("{\\rtf1\\ansi\\pard\\tqr\\tx2880 a\\tab b\\par}");
    expect(paragraphs[0]?.tabs).toEqual([{ at: 144, kind: "right" }]);
  });
});

describe("stops in an exported PDF", () => {
  const measure: MeasureText = (text) => text.length * 6;
  const LETTER = { paper: "letter", orientation: "portrait", scale: 100, copies: 1 } as const;

  it("place the text after each tab as the stop's kind says", () => {
    const node = view(`<div data-tabs="${tabStopsText(STOPS)}">\tL\tCC\tRR\t12.5</div>`);
    const [page] = layoutPdf(paragraphsOfContent(node), LETTER, measure);
    const xs = Object.fromEntries(
      (page?.marks ?? []).flatMap((mark) => (mark.kind === "text" ? [[mark.text, mark.x]] : [])),
    );
    expect(xs).toEqual({ L: 72, CC: 138, RR: 204, "12.5": 276 });
  });
});
