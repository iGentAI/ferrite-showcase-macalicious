import { describe, expect, it } from "vitest";
import {
  copyRuler,
  paragraphIndents,
  pasteRuler,
  setParagraphIndents,
  stepRuler,
} from "./textedit-document";
import { paragraphsOfContent, paragraphsToHtml, readRtf, writeRtf } from "./textedit-rtf";
import { contentToHtml, htmlToContent } from "./textedit-server";

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
const TWO = "<div>One</div><div>Two</div>";

describe("a paragraph's own ruler", () => {
  it("goes on the paragraphs of the selection only, and Undo takes it back", () => {
    const node = view(TWO);
    const [one, two] = [...node.children] as HTMLElement[];
    setParagraphIndents(node, rangeIn(two as Element), { first: 36, head: 18, tail: 9 });
    expect(two?.getAttribute("style")).toBe(
      "margin-inline-start: 18px; margin-inline-end: 9px; text-indent: 18px;",
    );
    expect(paragraphIndents(two as HTMLElement)).toEqual({ first: 36, head: 18, tail: 9 });
    expect(paragraphIndents(one as HTMLElement)).toBeUndefined();
    expect(stepRuler(node, "undo")).toBe(true);
    expect(two?.getAttribute("style")).toBeNull();
  });

  it("leaves room for a list's marker, which the ruler does not count", () => {
    const node = view('<div data-list="disc">One</div>');
    const item = node.children[0] as HTMLElement;
    setParagraphIndents(node, rangeIn(item), { first: 10, head: 10, tail: 0 });
    expect(item.style.getPropertyValue("margin-inline-start")).toBe("38px");
    expect(item.style.getPropertyValue("text-indent")).toBe("");
    expect(paragraphIndents(item)).toEqual({ first: 10, head: 10, tail: 0 });
  });

  it("Copy Ruler and Paste Ruler carry it", () => {
    const node = view(TWO);
    const [one, two] = [...node.children] as HTMLElement[];
    setParagraphIndents(node, rangeIn(one as Element), { first: 5, head: 5, tail: 0 });
    const copied = copyRuler(node, rangeIn(one as Element));
    pasteRuler(node, rangeIn(two as Element), copied as NonNullable<typeof copied>);
    expect(paragraphIndents(two as HTMLElement)).toEqual({ first: 5, head: 5, tail: 0 });
  });

  it("survives an RTF file, beside a paragraph that follows the document", () => {
    const node = view(TWO);
    setParagraphIndents(node, rangeIn(node.children[1] as Element), {
      first: 36,
      head: 18,
      tail: 9,
    });
    const { paragraphs, ruler } = readRtf(
      writeRtf(paragraphsOfContent(node), { first: 0, head: 0, tail: 0, tabStops: [72] }),
    );
    expect(ruler?.head).toBe(0);
    expect(paragraphs[0]?.indents).toBeUndefined();
    expect(paragraphs[1]?.indents).toEqual({ first: 36, head: 18, tail: 9 });
    expect(paragraphsToHtml(paragraphs)).toContain(
      'style="margin-inline-start: 18px; margin-inline-end: 9px; text-indent: 18px"',
    );
  });

  it("is kept by what a stored draft is cleaned with", () => {
    const clean = contentToHtml(
      htmlToContent(
        '<div style="margin-inline-start: 18px; margin-inline-end: 9px; text-indent: 18px;">Two</div>',
        document,
      ),
    );
    expect(clean).toContain("margin-inline-start: 18px");
    expect(clean).toContain("text-indent: 18px");
  });
});
