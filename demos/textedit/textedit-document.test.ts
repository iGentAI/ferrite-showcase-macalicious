import { afterEach, describe, expect, it } from "vitest";
import {
  copyRuler,
  dropCopiedListStart,
  pasteRuler,
  setListStart,
  setParagraphFormat,
  setWritingDirection,
  stepRuler,
} from "./textedit-document";

/* Where a list counts from, as the Lists sheet, the format bar and Return leave it. */

const editor = (html: string) => {
  const node = document.createElement("div");
  node.innerHTML = html;
  document.body.append(node);
  return node;
};

const allOf = (node: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  return range;
};

const starts = (node: HTMLElement) =>
  [...node.children].map((each) => (each as HTMLElement).dataset.listStart ?? null);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("writing direction and the ruler", () => {
  it("undoes and redoes a direction, on the same paragraph", () => {
    const node = editor("<div>a</div>");
    const paragraph = node.firstElementChild;
    setWritingDirection(node, allOf(node), "rtl");
    expect(node.innerHTML).toBe('<div dir="rtl">a</div>');
    expect(stepRuler(node, "undo")).toBe(true);
    expect(node.innerHTML).toBe("<div>a</div>");
    expect(node.firstElementChild).toBe(paragraph);
    expect(stepRuler(node, "redo")).toBe(true);
    expect(node.innerHTML).toBe('<div dir="rtl">a</div>');
  });

  it("leaves Undo to the browser once the document has changed since", () => {
    const node = editor("<div>a</div>");
    setWritingDirection(node, allOf(node), "rtl");
    (node.firstElementChild as HTMLElement).append("typed");
    expect(stepRuler(node, "undo")).toBe(false);
    expect(node.innerHTML).toBe('<div dir="rtl">atyped</div>');
  });

  it("puts attributes back in their order, so that Redo and earlier steps still apply", () => {
    const node = editor('<div style="text-align: center;" dir="ltr">a</div>');
    const original = node.innerHTML;
    setWritingDirection(node, allOf(node), "rtl");
    const directed = node.innerHTML;
    pasteRuler(node, allOf(node), {
      direction: null,
      align: "",
      lineHeight: "",
      spacing: undefined,
    });
    const pasted = node.innerHTML;
    expect(pasted).toBe("<div>a</div>");
    expect(stepRuler(node, "undo")).toBe(true);
    expect(node.innerHTML).toBe(directed);
    expect(stepRuler(node, "redo")).toBe(true);
    expect(node.innerHTML).toBe(pasted);
    expect(stepRuler(node, "undo")).toBe(true);
    expect(stepRuler(node, "undo")).toBe(true);
    expect(node.innerHTML).toBe(original);
  });

  it("records nothing when a paragraph already has the direction", () => {
    const directed = editor('<div dir="rtl">a</div>');
    setParagraphFormat(directed, allOf(directed), { align: "left" });
    expect((directed.firstElementChild as HTMLElement).style.textAlign).toBe("left");
    const node = editor('<div dir="ltr">a</div>');
    setWritingDirection(node, allOf(node), "ltr");
    expect(stepRuler(node, "undo")).toBe(false);
  });

  it("copies one paragraph's ruler to another, with its spacing, as one step", () => {
    const node = editor(
      '<div dir="rtl" data-spacing="1.5" style="text-align: center; line-height: 1.75;">a</div><div>b</div>',
    );
    const first = document.createRange();
    first.selectNodeContents(node.children[0] as Element);
    const second = document.createRange();
    second.selectNodeContents(node.children[1] as Element);
    const ruler = copyRuler(node, first);
    expect(ruler).toEqual({
      direction: "rtl",
      align: "center",
      lineHeight: "1.75",
      spacing: "1.5",
    });
    pasteRuler(node, second, ruler as NonNullable<typeof ruler>);
    expect(node.children[1]?.getAttribute("dir")).toBe("rtl");
    expect((node.children[1] as HTMLElement).style.textAlign).toBe("center");
    expect((node.children[1] as HTMLElement).dataset.spacing).toBe("1.5");
    expect(stepRuler(node, "undo")).toBe(true);
    expect(node.children[1]?.outerHTML).toBe("<div>b</div>");
  });
});

describe("a list's start", () => {
  it("leaves one start on the first of the selected paragraphs when two lists are joined", () => {
    const node = editor(
      '<div data-list="decimal" data-list-start="4">a</div><div data-list="decimal" data-list-start="9">b</div>',
    );
    setParagraphFormat(node, allOf(node), { list: "roman" });
    setListStart(node, allOf(node), 7);
    expect(starts(node)).toEqual(["7", null]);
  });

  it("goes when the list goes, and does not come back with a new list", () => {
    const node = editor('<div data-list="decimal" data-list-start="4">a</div>');
    setParagraphFormat(node, allOf(node), { list: "none" });
    expect(node.innerHTML).toBe("<div>a</div>");
    setParagraphFormat(node, allOf(node), { list: "decimal" });
    expect(starts(node)).toEqual([null]);
  });

  it("takes the copy off the paragraph Return made, and leaves other starts alone", () => {
    const node = editor(
      '<div data-list="decimal" data-list-start="4">a</div><div data-list="decimal" data-list-start="4">b</div><div data-list="decimal" data-list-start="4">c</div>',
    );
    document.getSelection()?.collapse(node.children[1] as Element, 0);
    dropCopiedListStart(node);
    expect(starts(node)).toEqual(["4", null, "4"]);
  });

  it("can start again at 1 inside a list, and needs no number at 1 outside one", () => {
    const node = editor('<div data-list="decimal">a</div><div data-list="decimal">b</div>');
    const second = document.createRange();
    second.selectNodeContents(node.children[1] as Element);
    setListStart(node, second, 1);
    expect(starts(node)).toEqual([null, "1"]);
    setListStart(node, allOf(node), 1);
    expect(starts(node)).toEqual([null, "1"]);
    setListStart(node, second, null);
    expect(starts(node)).toEqual([null, null]);
  });
});
