import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findRanges, useMailFind } from "./mail-find";

const editor = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
};

describe("findRanges", () => {
  it("reads across inline formatting, and not across lines or blocks", () => {
    const root = editor("<p>fer<b>ry</b> and <i>a f</i>ast ferry</p>");
    expect(findRanges(root, "ferry").map(String)).toEqual(["ferry", "ferry"]);
    expect(findRanges(root, "a fast").map(String)).toEqual(["a fast"]);
    expect(findRanges(editor("<div>fer</div><div>ry</div>"), "ferry")).toEqual([]);
    expect(findRanges(editor("fer<br>ry"), "ferry")).toEqual([]);
    expect(findRanges(editor('fer<div style="height:1em"></div>ry'), "ferry")).toEqual([]);
    expect(findRanges(editor("<div>fer</div>ry"), "ferry")).toEqual([]);
    expect(findRanges(editor("<div>fer</div>ry"), "fer\nry")).toEqual([]);
    const preformatted = editor("<pre>fer\nry</pre>");
    expect(findRanges(preformatted, "fer\nry")).toEqual([]);
    expect(findRanges(preformatted, "fer").map(String)).toEqual(["fer"]);
    expect(findRanges(preformatted, "ry").map(String)).toEqual(["ry"]);
    const lines = editor('<p style="white-space: pre-line">fer\nry</p>');
    expect(findRanges(lines, "fer\nry")).toEqual([]);
    const flowing = editor("<p>fer\nry</p>");
    expect(findRanges(flowing, "fer\nry")).toEqual([]);
    expect(findRanges(flowing, "fer ry").map(String)).toEqual(["fer\nry"]);
    expect(findRanges(lines, "fer ry")).toEqual([]);
    expect(findRanges(editor("<p>a\n  <b>fast</b></p>"), "a fast").map(String)).toEqual([
      "a\n  fast",
    ]);
    expect(findRanges(editor("<pre>a\n  fast</pre>"), "a fast")).toEqual([]);
    expect(findRanges(editor("<div><span>fer</span><em>ry</em></div>"), "ferry")).toHaveLength(1);
  });
  it("finds every place in any case, without overlapping", () => {
    const root = editor("<p>Ferry <b>FERRY</b></p><p>aaa</p>");
    expect(findRanges(root, "ferry").map((range) => range.toString())).toEqual(["Ferry", "FERRY"]);
    expect(findRanges(root, "aa")).toHaveLength(1);
    expect(findRanges(root, "")).toEqual([]);
  });
  it("gives offsets in the text as it stands when folding changes its length", () => {
    const root = editor("İa");
    const [letter] = findRanges(root, "a");
    expect([letter?.startOffset, letter?.endOffset]).toEqual([1, 2]);
    const [dotted] = findRanges(root, "i");
    expect([dotted?.startOffset, dotted?.endOffset]).toEqual([0, 1]);
    expect(dotted?.toString()).toBe("İ");
    expect(findRanges(root, "İA").map(String)).toEqual(["İa"]);
  });
  it("finds a character outside the first plane and a final sigma in any case", () => {
    const root = editor("😀b ΑΣ");
    const [letter] = findRanges(root, "B");
    expect([letter?.startOffset, letter?.endOffset]).toEqual([2, 3]);
    expect(findRanges(root, "ας").map(String)).toEqual(["ΑΣ"]);
  });
});

describe("useMailFind, with two readers on the page", () => {
  class FakeHighlight {
    ranges: Range[];
    constructor(...ranges: Range[]) {
      this.ranges = ranges;
    }
  }
  const marked = (highlights: Map<string, FakeHighlight>, name: string) =>
    (highlights.get(name)?.ranges ?? []).map(String);
  function Reader({ name, words }: { name: string; words: string }) {
    const pane = useRef<HTMLDivElement>(null);
    const { commands, bar } = useMailFind(pane);
    return (
      <section aria-label={name}>
        <button type="button" onClick={commands.find}>
          Find
        </button>
        {bar}
        <div ref={pane}>{words}</div>
      </section>
    );
  }
  const search = async (name: string, words: string) => {
    const reader = within(screen.getByRole("region", { name }));
    fireEvent.click(reader.getByRole("button", { name: "Find" }));
    fireEvent.change(await reader.findByLabelText("Find in Message"), {
      target: { value: words },
    });
    return reader;
  };
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps each reader's marks while the other searches, closes and goes", async () => {
    const highlights = new Map<string, FakeHighlight>();
    vi.stubGlobal("CSS", { highlights });
    vi.stubGlobal("Highlight", FakeHighlight);
    const page = render(
      <>
        <Reader name="Viewer" words="the ferry" />
        <Reader name="Window" words="the boat" />
      </>,
    );
    await search("Viewer", "ferry");
    await waitFor(() => expect(marked(highlights, "mail-find")).toEqual(["ferry"]));
    const window = await search("Window", "boat");
    await waitFor(() => expect(marked(highlights, "mail-find")).toEqual(["ferry", "boat"]));
    expect(marked(highlights, "mail-find-current")).toEqual(["ferry", "boat"]);

    fireEvent.click(window.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(marked(highlights, "mail-find")).toEqual(["ferry"]));
    expect(marked(highlights, "mail-find-current")).toEqual(["ferry"]);

    await search("Window", "boat");
    await waitFor(() => expect(marked(highlights, "mail-find")).toEqual(["ferry", "boat"]));
    page.rerender(<Reader name="Window" words="the boat" />);
    await waitFor(() => expect(marked(highlights, "mail-find")).not.toContain("ferry"));
    page.unmount();
    expect(marked(highlights, "mail-find")).toEqual([]);
    expect(marked(highlights, "mail-find-current")).toEqual([]);
  });
});
