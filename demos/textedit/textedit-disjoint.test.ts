// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { placeOf, rangeAt, spanOf, subtractSpan } from "./textedit-disjoint";

function view(html: string): HTMLElement {
  const node = document.createElement("div");
  node.innerHTML = html;
  return node;
}

describe("a place in a view's text", () => {
  const html = "<div>one <b>two</b></div><div><br></div><div>three</div>";

  it("counts characters, line breaks and blocks entered", () => {
    const node = view(html);
    const two = node.querySelector("b")?.firstChild as Text;
    expect(placeOf(node, two, 1)).toBe(6);
    const three = node.children[2]?.firstChild as Text;
    expect(placeOf(node, three, 0)).toBe(11);
    expect(placeOf(node, node, node.childNodes.length)).toBe(16);
  });

  it("tells the end of one paragraph from the start of the next", () => {
    const node = view("<div>ab</div><div>cd</div>");
    const end = rangeAt(node, { start: 3, end: 3 });
    expect(end.startContainer.textContent).toBe("ab");
    const next = rangeAt(node, { start: 4, end: 4 });
    expect(next.startContainer.textContent).toBe("cd");
    expect(next.startOffset).toBe(0);
  });

  it("finds the same text again after its nodes are replaced by formatting", () => {
    const node = view("<div>alpha beta gamma</div>");
    const before = spanOf(node, rangeAt(node, { start: 7, end: 11 }));
    expect(rangeAt(node, before).toString()).toBe("beta");
    node.innerHTML = "<div>alpha <b>be</b>ta gamma</div>";
    expect(rangeAt(node, before).toString()).toBe("beta");
  });

  it("stands in an empty paragraph, before its line break", () => {
    const node = view("<div>a</div><div><br></div>");
    const range = rangeAt(node, { start: 3, end: 3 });
    expect(range.startContainer).toBe(node.children[1]);
    expect(range.startOffset).toBe(0);
  });
});

describe("taking a drag out of a selection", () => {
  it("splits a range the drag lands inside", () => {
    expect(subtractSpan([{ start: 2, end: 10 }], { start: 4, end: 6 })).toEqual({
      spans: [
        { start: 2, end: 4 },
        { start: 6, end: 10 },
      ],
      touched: true,
    });
  });

  it("removes a range the drag covers and leaves one it misses", () => {
    expect(
      subtractSpan(
        [
          { start: 2, end: 4 },
          { start: 8, end: 9 },
        ],
        { start: 1, end: 5 },
      ),
    ).toEqual({ spans: [{ start: 8, end: 9 }], touched: true });
  });

  it("says when the drag touches nothing, so that it adds a range", () => {
    expect(subtractSpan([{ start: 2, end: 4 }], { start: 4, end: 6 })).toEqual({
      spans: [{ start: 2, end: 4 }],
      touched: false,
    });
  });
});
