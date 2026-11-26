import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mapTextOffset, RichTextView, readTextSelection, restoreTextSelection } from "./index";

const view = () => screen.getByRole("textbox", { name: "Note" });

/** Select from `start` to `end` in the text node `node`, with the view focused. */
function select(node: Node, start: number, end = start) {
  view().focus();
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

describe("mapTextOffset", () => {
  it("keeps an offset before a change and moves one after it by the change in length", () => {
    // Text inserted after the offset: it stays.
    expect(mapTextOffset("alpha beta", "alpha beta gamma", 3)).toBe(3);
    // Text inserted before it: it moves along.
    expect(mapTextOffset("alpha beta", "new alpha beta", 8)).toBe(12);
    // Text removed before it: it moves back.
    expect(mapTextOffset("old alpha beta", "alpha beta", 10)).toBe(6);
    // Inside the part that changed, with none of the text around it left: where the change
    // begins.
    expect(mapTextOffset("alpha beta", "alpha BETA", 8)).toBe(6);
    // The same text: the same offset, at most the length.
    expect(mapTextOffset("same", "same", 9)).toBe(4);
  });

  it("follows the text around an offset through separate changes before and after it", () => {
    // "be|ta" in "alphabeta", with " extra" added before it and " more" after it.
    expect(mapTextOffset("alphabeta", "alpha extrabeta more", 7)).toBe(13);
    // A word changed before the caret's line and another after it, in a longer text.
    const before = "First line here\nSecond line, caret after this|tail\nThird line";
    const after = "First LINE here\nSecond line, caret after this|tail\nThird line and more";
    const caret = before.indexOf("|");
    expect(mapTextOffset(before, after, caret)).toBe(after.indexOf("|"));
  });
});

describe("readTextSelection and restoreTextSelection", () => {
  it("read the selection as offsets into the view's text across its elements", () => {
    render(
      <RichTextView aria-label="Note">
        <div>
          One <b>two</b>
        </div>
        <div>three four</div>
      </RichTextView>,
    );
    const three = view().lastElementChild?.firstChild as Text;
    select(three, 0, 5);
    expect(readTextSelection(view())).toEqual({ start: 7, end: 12, text: "One twothree four" });
    // A selection outside the view is none of its.
    const outside = document.createElement("p");
    outside.textContent = "elsewhere";
    document.body.append(outside);
    const range = document.createRange();
    range.selectNodeContents(outside);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    expect(readTextSelection(view())).toBeNull();
    outside.remove();
  });

  it("put the caret back where it was after the content is rebuilt with a change before it", () => {
    render(
      <RichTextView aria-label="Note">
        <div>alpha</div>
        <div>beta</div>
      </RichTextView>,
    );
    // The caret after "be" in "beta".
    select(view().lastElementChild?.firstChild as Text, 2);
    const saved = readTextSelection(view());
    expect(saved).toEqual({ start: 7, end: 7, text: "alphabeta" });
    // Another window's change, read and shown in a rebuilt content: a word added before the
    // caret's line, and one after it.
    view().replaceChildren();
    for (const line of ["alpha extra", "beta more"]) {
      const block = document.createElement("div");
      block.textContent = line;
      view().append(block);
    }
    view().blur();
    if (!saved) throw new Error("no selection read");
    const range = restoreTextSelection(view(), saved);
    expect(view()).toHaveFocus();
    expect(range.collapsed).toBe(true);
    expect(range.startContainer.nodeValue).toBe("beta more");
    expect(range.startOffset).toBe(2);
    expect(document.getSelection()?.getRangeAt(0).startOffset).toBe(2);
  });

  it("select a range again, and fall back to the end of shorter text", () => {
    render(
      <RichTextView aria-label="Note">
        <div>keep these words</div>
      </RichTextView>,
    );
    const line = view().firstElementChild?.firstChild as Text;
    select(line, 5, 10);
    const saved = readTextSelection(view());
    if (!saved) throw new Error("no selection read");
    restoreTextSelection(view(), saved);
    expect(document.getSelection()?.toString()).toBe("these");
    line.nodeValue = "keep";
    const range = restoreTextSelection(view(), saved);
    expect(range.startOffset).toBe(4);
    expect(range.endOffset).toBe(4);
  });
});
