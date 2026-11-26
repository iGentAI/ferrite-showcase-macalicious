import { describe, expect, it } from "vitest";
import { completionsOf, wordBeforeCaret } from "./textedit-complete";
import { documentFromBytes } from "./textedit-files";
import { paragraphsOfContent, readRtf, writeRtf } from "./textedit-rtf";
import { htmlToContent } from "./textedit-server";

describe("the words Edit > Complete offers", () => {
  it("puts the document's words first, then the list's, shortest first, in the prefix's capitals", () => {
    expect(
      completionsOf("Pre", "present presto", ["prefab", "pretty", "preamble", "apple"]),
    ).toEqual(["Present", "Presto", "Prefab", "Pretty", "Preamble"]);
  });

  it("offers no word the prefix already is, and each word once", () => {
    expect(completionsOf("cat", "cat cats Cats", ["cat", "cats"])).toEqual(["cats"]);
  });

  it("finds the word at the insertion point of a text area, and none with a selection", () => {
    const area = document.createElement("textarea");
    area.value = "hello wor ld";
    area.setSelectionRange(9, 9);
    expect(wordBeforeCaret(area)).toBe("wor");
    area.setSelectionRange(6, 9);
    expect(wordBeforeCaret(area)).toBe("");
  });
});

describe("an RTF file in another code page", () => {
  it("opens in the code page it declares", () => {
    const bytes = new TextEncoder().encode(
      "{\\rtf1\\ansi\\ansicpg1251 \\'cf\\'f0\\'e8\\'e2\\'e5\\'f2}",
    );
    const opened = documentFromBytes("Russian.rtf", bytes, document);
    expect(opened.document.lines).toEqual(["Привет"]);
  });
});

describe("a paragraph's space before and after", () => {
  const content = () =>
    htmlToContent(
      '<div style="margin-top: 6px; margin-bottom: 12.5px">Spaced</div><div>Plain</div>',
      document,
    );

  it("is kept by a stored draft's rebuild", () => {
    const first = content().firstElementChild as HTMLElement;
    expect(first.style.marginTop).toBe("6px");
    expect(first.style.marginBottom).toBe("12.5px");
  });

  it("goes into an RTF file as \\sb and \\sa, in twips, and comes back", () => {
    const text = writeRtf(paragraphsOfContent(content()));
    expect(text).toContain("\\sb120\\sa250");
    const [spaced, plain] = readRtf(text).paragraphs;
    expect(spaced?.before).toBe(6);
    expect(spaced?.after).toBe(12.5);
    expect(plain?.before).toBeUndefined();
    expect(plain?.after).toBeUndefined();
  });
});
