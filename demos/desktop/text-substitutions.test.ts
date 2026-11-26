import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SUBSTITUTIONS,
  linkAtEnd,
  pasteEdges,
  replaceAllSubstitutions,
  smartQuote,
  spaceAfterPaste,
  substitutedText,
} from "./text-substitutions";

const realExecCommand = document.execCommand;

afterEach(() => {
  document.execCommand = realExecCommand;
  document.body.innerHTML = "";
});

describe("smart quotes and dashes", () => {
  it("open after a space or nothing, and close after a word", () => {
    expect(smartQuote("", '"')).toBe("“");
    expect(smartQuote("say ", '"')).toBe("“");
    expect(smartQuote("word", '"')).toBe("”");
    expect(smartQuote("it", "'")).toBe("’");
    expect(smartQuote("(", "'")).toBe("‘");
  });

  it("are what Replace All makes of text, as far as they are on", () => {
    expect(substitutedText(`"it's" -- so`, DEFAULT_SUBSTITUTIONS)).toBe("“it’s” — so");
    expect(substitutedText(`"a" -- b`, { ...DEFAULT_SUBSTITUTIONS, quotes: false })).toBe(
      `"a" — b`,
    );
    expect(substitutedText(`"a" -- b`, { ...DEFAULT_SUBSTITUTIONS, dashes: false })).toBe(
      "“a” -- b",
    );
  });
});

describe("Smart Copy/Paste in rich text", () => {
  it("takes the paste and its spaces as one Undo, and brings them back as one Redo", async () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>aaXYbb</div>";
    document.body.append(view);
    const text = view.firstElementChild?.firstChild as Text;
    document.getSelection()?.collapse(text, 4);
    const asked: string[] = [];
    document.execCommand = ((command: string, _: boolean, next: string) => {
      asked.push(next ?? command);
      return true;
    }) as typeof document.execCommand;
    spaceAfterPaste(view, "XY", undefined);
    expect(asked).toEqual([" ", " "]);
    asked.length = 0;
    const history = (inputType: string) =>
      view.dispatchEvent(new InputEvent("input", { inputType, bubbles: true }));
    history("historyUndo");
    await new Promise((done) => setTimeout(done));
    expect(asked).toEqual(["undo", "undo"]);
    asked.length = 0;
    history("historyRedo");
    await new Promise((done) => setTimeout(done));
    expect(asked).toEqual(["redo", "redo"]);
    asked.length = 0;
    // Anything else ends it: this Undo belongs to some other edit.
    history("insertText");
    history("historyUndo");
    await new Promise((done) => setTimeout(done));
    expect(asked).toEqual([]);
  });
  const insertAtSelection = () => {
    document.execCommand = ((_: string, __: boolean, next: string) => {
      const range = document.getSelection()?.getRangeAt(0);
      range?.insertNode(document.createTextNode(next));
      return true;
    }) as typeof document.execCommand;
  };

  it("spaces a formatted paste, a node of its own, from the words on each side", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>aa<b>XY</b>bb</div>";
    document.body.append(view);
    document.getSelection()?.collapse(view.querySelector("b")?.firstChild as Text, 2);
    insertAtSelection();
    spaceAfterPaste(view, "XY", undefined);
    expect(view.textContent).toBe("aa XY bb");
    const caret = document.getSelection()?.getRangeAt(0).cloneRange();
    caret?.setStart(view, 0);
    expect(caret?.toString()).toBe("aa XY");
  });

  it("keeps a paste at a block's end in that block, from a caret between elements", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>aa<b>XY</b></div><div>bb</div>";
    document.body.append(view);
    document.getSelection()?.collapse(view.children[0] as Element, 2);
    insertAtSelection();
    spaceAfterPaste(view, "XY", undefined);
    expect(view.children[0]?.textContent).toBe("aa XY");
    expect(view.children[1]?.textContent).toBe("bb");
  });

  it("keeps a paste that ends in a line break, from a caret between elements", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>aa<b>XY</b><br>bb</div>";
    document.body.append(view);
    document.getSelection()?.collapse(view.children[0] as Element, 3);
    insertAtSelection();
    spaceAfterPaste(view, "XY\n", undefined);
    expect(view.children[0]?.firstChild?.textContent).toBe("aa");
    expect(view.querySelector("b")?.textContent).toBe(" XY");
    expect(view.children[0]?.lastChild?.textContent).toBe("bb");
  });

  it("leaves the caret in the block a paste ended in, so typing stays there", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>aa<b>XY</b><br></div><div>bb</div>";
    document.body.append(view);
    document.getSelection()?.collapse(view.children[0] as Element, 3);
    insertAtSelection();
    spaceAfterPaste(view, "XY\n", undefined);
    document.execCommand("insertText", false, "Z");
    expect(view.children[0]?.textContent).toBe("aa XYZ");
    expect(view.children[1]?.textContent).toBe("bb");
  });

  it("adds nothing where a space is already there", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>aa <i>XY</i> bb</div>";
    document.body.append(view);
    document.getSelection()?.collapse(view.querySelector("i")?.firstChild as Text, 2);
    insertAtSelection();
    spaceAfterPaste(view, "XY", undefined);
    expect(view.textContent).toBe("aa XY bb");
  });

  it("leaves the text and the caret after the paste when the browser refuses the space", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>aXYb</div>";
    document.body.append(view);
    const text = view.firstElementChild?.firstChild as Text;
    document.getSelection()?.collapse(text, 3);
    document.execCommand = (() => false) as typeof document.execCommand;
    spaceAfterPaste(view, "XY", { before: "a" });
    expect(view.textContent).toBe("aXYb");
    expect(document.getSelection()?.focusNode).toBe(text);
    expect(document.getSelection()?.focusOffset).toBe(3);
  });
});

describe("Smart Copy/Paste in a text area", () => {
  const pastedInto = (value: string, caret: number, before: string, pasted: string) => {
    const area = document.createElement("textarea");
    document.body.append(area);
    area.value = value;
    area.setSelectionRange(caret, caret);
    document.execCommand = ((_: string, __: boolean, text: string) => {
      area.setRangeText(text, area.selectionStart, area.selectionEnd, "end");
      return true;
    }) as typeof document.execCommand;
    spaceAfterPaste(area, pasted, { before });
    return area;
  };

  it("puts a space on each side where a word meets a word, and the caret after the paste", () => {
    const area = pastedInto("aXYbc", 3, "a", "XY");
    expect(area.value).toBe("a XY bc");
    expect(area.selectionStart).toBe(4);
  });

  it("adds none where a space or an edge is already there", () => {
    expect(pastedInto("a XY b", 4, "a ", "XY").value).toBe("a XY b");
    expect(pastedInto("XY", 2, "", "XY").value).toBe("XY");
  });

  it("reads what is before the selection of a text area when the paste begins, and nothing of rich text", () => {
    const rich = document.createElement("div");
    expect(pasteEdges(rich)).toBeUndefined();
    const area = document.createElement("textarea");
    area.value = "abcd";
    area.setSelectionRange(2, 3);
    expect(pasteEdges(area)).toEqual({ before: "ab" });
  });
});

describe("smart links", () => {
  it("find a web address at the end of the text, without its last punctuation", () => {
    expect(linkAtEnd("see https://example.com/a")).toEqual({
      written: "https://example.com/a",
      href: "https://example.com/a",
    });
    expect(linkAtEnd("www.example.com")?.href).toBe("https://www.example.com");
    expect(linkAtEnd("https://example.com.")).toEqual(undefined);
    expect(linkAtEnd("a word")).toBeUndefined();
  });
});

describe("Replace All", () => {
  it("counts only what the browser changed", () => {
    const area = document.createElement("textarea");
    document.body.append(area);
    area.value = `"a"`;
    document.execCommand = (() => false) as typeof document.execCommand;
    expect(replaceAllSubstitutions(area, DEFAULT_SUBSTITUTIONS)).toBe(0);
    const view = document.createElement("div");
    view.innerHTML = `<div>"a"</div>`;
    document.body.append(view);
    document.getSelection()?.removeAllRanges();
    expect(replaceAllSubstitutions(view, DEFAULT_SUBSTITUTIONS)).toBe(0);
  });

  it("leaves what is outside a selection alone, in the same text node too", () => {
    const view = document.createElement("div");
    view.innerHTML = `<div>"out" "in" -- 'out'</div>`;
    document.body.append(view);
    const text = view.firstElementChild?.firstChild as Text;
    document.execCommand = ((_: string, __: boolean, next: string) => {
      const range = document.getSelection()?.getRangeAt(0);
      range?.deleteContents();
      range?.insertNode(document.createTextNode(next));
      return true;
    }) as typeof document.execCommand;
    document.getSelection()?.setBaseAndExtent(text, 6, text, 13);
    expect(replaceAllSubstitutions(view, DEFAULT_SUBSTITUTIONS)).toBe(1);
    expect(view.textContent).toBe(`"out" “in” — 'out'`);
  });

  it("reads a quote's place across styles, and starts afresh in a new paragraph", () => {
    const view = document.createElement("div");
    view.innerHTML = `<div><b>it</b>'s</div><div>'new</div>`;
    document.body.append(view);
    document.execCommand = ((_: string, __: boolean, next: string) => {
      const range = document.getSelection()?.getRangeAt(0);
      range?.deleteContents();
      range?.insertNode(document.createTextNode(next));
      return true;
    }) as typeof document.execCommand;
    document.getSelection()?.removeAllRanges();
    expect(replaceAllSubstitutions(view, DEFAULT_SUBSTITUTIONS)).toBe(2);
    expect(view.children[0]?.textContent).toBe("it’s");
    expect(view.children[1]?.textContent).toBe("‘new");
  });

  it("changes a text area, whole or only its selection", () => {
    const area = document.createElement("textarea");
    document.body.append(area);
    area.value = `"a"`;
    document.execCommand = ((_: string, __: boolean, text: string) => {
      area.setRangeText(text);
      return true;
    }) as typeof document.execCommand;
    expect(replaceAllSubstitutions(area, DEFAULT_SUBSTITUTIONS)).toBe(1);
    expect(area.value).toBe("“a”");
    expect(replaceAllSubstitutions(area, DEFAULT_SUBSTITUTIONS)).toBe(0);
  });
});
