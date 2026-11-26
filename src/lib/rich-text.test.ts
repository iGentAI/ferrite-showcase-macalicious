import { afterEach, describe, expect, it } from "vitest";
import {
  applyRichTextFormat,
  cssColorToHex,
  findFontFamily,
  keepRichTextSelection,
  keepTypingRuns,
  readRichTextFormat,
  richTextFromHtml,
  richTextKeyCommand,
  richTextStartNode,
} from "./rich-text";

/*
 * jsdom has no editing commands, so what `applyRichTextFormat` does to text is tested in the
 * browsers (demos/textedit/textedit.browser.test.tsx and the other text apps'). Here: the key
 * equivalents, the format read from the styles at the insertion point, the selection kept for
 * a command, and stored text read back safely. jsdom is not an Apple platform: Command is the
 * Control key.
 */
const key = (key: string, more: Partial<KeyboardEvent> = {}) =>
  richTextKeyCommand({
    key,
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...more,
  });

afterEach(() => {
  document.body.replaceChildren();
});

function editor(html: string) {
  const root = document.createElement("div");
  root.contentEditable = "true";
  root.tabIndex = 0;
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

function caretIn(node: Node, offset = 0) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

describe("richTextKeyCommand", () => {
  it("knows the key equivalents of the Format menu", () => {
    expect(key("b")).toBe("bold");
    expect(key("i")).toBe("italic");
    expect(key("u")).toBe("underline");
    expect(key("t")).toBe("show-fonts");
    expect(key("C", { shiftKey: true })).toBe("show-colors");
    expect(key("-")).toBe("smaller");
    // Typed with Shift on a US keyboard, and Command-= is Bigger too.
    expect(key("+", { shiftKey: true })).toBe("bigger");
    expect(key("=")).toBe("bigger");
    expect(key("{", { shiftKey: true })).toBe("align-left");
    expect(key("|", { shiftKey: true })).toBe("align-center");
    expect(key("}", { shiftKey: true })).toBe("align-right");
  });

  it("leaves other keys alone", () => {
    expect(key("b", { shiftKey: true })).toBeUndefined();
    expect(key("b", { altKey: true })).toBeUndefined();
    expect(key("c")).toBeUndefined();
    expect(key("s")).toBeUndefined();
    expect(key("b", { ctrlKey: false })).toBeUndefined();
    // Meta is the operating system's off Apple platforms.
    expect(key("b", { ctrlKey: false, metaKey: true })).toBeUndefined();
  });
});

describe("readRichTextFormat", () => {
  it("reads the styles, the decorations and the highlight where the caret is", () => {
    const root = editor(
      '<div style="text-align: center"><span style="font-family: Georgia, serif; font-size: 18px; color: rgb(255, 0, 0)"><u><span style="background-color: rgb(255, 234, 0)">mark</span></u></span></div><div><s>gone</s> <b>bold</b> <i>slanted</i></div>',
    );
    root.style.fontFamily = "Helvetica, Arial, sans-serif";
    root.style.fontSize = "12px";
    caretIn(root.querySelector("u span")?.firstChild as Node, 2);
    expect(readRichTextFormat(root)).toMatchObject({
      family: "Georgia",
      size: 18,
      color: "#ff0000",
      underline: true,
      strikethrough: false,
      highlight: "#ffea00",
      align: "center",
    });
    caretIn(root.querySelector("s")?.firstChild as Node, 1);
    expect(readRichTextFormat(root)).toMatchObject({
      family: "Helvetica",
      size: 12,
      underline: false,
      strikethrough: true,
      highlight: "none",
      align: "left",
    });
    caretIn(root.querySelector("b")?.firstChild as Node, 1);
    expect(readRichTextFormat(root)).toMatchObject({ bold: true, italic: false });
    caretIn(root.querySelector("i")?.firstChild as Node, 1);
    expect(readRichTextFormat(root)).toMatchObject({ bold: false, italic: true });
  });

  it("reads the editor itself when the selection is elsewhere", () => {
    const root = editor("<div><b>bold</b></div>");
    root.style.fontFamily = "'Marker Felt', cursive";
    root.style.fontSize = "14px";
    const elsewhere = document.createElement("p");
    elsewhere.textContent = "elsewhere";
    document.body.append(elsewhere);
    caretIn(elsewhere.firstChild as Node);
    expect(readRichTextFormat(root)).toMatchObject({
      family: "Marker Felt",
      size: 14,
      bold: false,
    });
  });
});

describe("richTextStartNode", () => {
  it("finds the first selected character, also when the range starts at a node's end", () => {
    const root = editor('<div>plain <span style="font-size: 20px">big</span></div>');
    const plain = root.firstChild?.firstChild as Text;
    const big = root.querySelector("span")?.firstChild as Text;
    const range = document.createRange();
    // As WebKit leaves the selection after it sized "big": from the end of "plain ".
    range.setStart(plain, plain.length);
    range.setEnd(big, 3);
    expect(richTextStartNode(root, range)).toBe(big);
    caretIn(big, 3);
    document.getSelection()?.getRangeAt(0).setStart(plain, plain.length);
    expect(readRichTextFormat(root).size).toBe(20);
    // A caret at a node's end stays in that node.
    range.collapse(true);
    expect(richTextStartNode(root, range)).toBe(plain);
    // An insertion point between the children of an element: the text before it, which
    // typing there continues; at the element's start, the first text after it.
    const between = document.createRange();
    between.setStart(root.firstChild as Node, 1);
    between.collapse(true);
    expect(richTextStartNode(root, between)).toBe(plain);
    between.setStart(root.firstChild as Node, 0);
    between.collapse(true);
    expect(richTextStartNode(root, between)).toBe(plain);
    between.setStart(root.firstChild as Node, 2);
    between.collapse(true);
    expect(richTextStartNode(root, between)).toBe(big);
    // Select All: from before the first paragraph, down to its first word in <b>.
    const deep = editor("<div><b>bold</b> plain</div>");
    const all = document.createRange();
    all.selectNodeContents(deep);
    expect(richTextStartNode(deep, all)).toBe(deep.querySelector("b")?.firstChild);
  });
});

describe("applyRichTextFormat", () => {
  it("changes nothing, in no editor, while the selection is outside the one it is given", () => {
    const commands: string[] = [];
    document.execCommand = (name: string) => {
      if (name !== "styleWithCSS") commands.push(name);
      return true;
    };
    try {
      const mine = editor("<div>mine</div>");
      const other = editor("<div>other</div>");
      caretIn(other.firstChild?.firstChild as Node, 1);
      expect(
        applyRichTextFormat(mine, {
          bold: true,
          family: "Georgia",
          color: "#ff0000",
          highlight: "#ffff00",
          align: "center",
          size: 20,
        }),
      ).toBe(false);
      expect(commands).toEqual([]);
      // With the selection in it, the commands run.
      caretIn(mine.firstChild?.firstChild as Node, 1);
      expect(applyRichTextFormat(mine, { family: "Georgia", align: "center" })).toBe(true);
      expect(commands).toEqual(["fontName", "justifyCenter"]);
    } finally {
      delete (document as Partial<Document>).execCommand;
    }
  });
});

describe("keepRichTextSelection", () => {
  it("gives the editor back the selection it had when a control took the focus", () => {
    const root = editor("<div>one two</div>");
    const keeper = keepRichTextSelection(root);
    const text = root.firstChild?.firstChild as Text;
    const range = document.createRange();
    range.setStart(text, 4);
    range.setEnd(text, 7);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    document.getSelection()?.removeAllRanges();
    const restored = keeper.restore();
    expect(document.activeElement).toBe(root);
    expect(restored.toString()).toBe("two");
    expect(document.getSelection()?.toString()).toBe("two");
    keeper.dispose();
  });

  it("gives back the selection a command left, before the browser has said it changed", () => {
    const root = editor("<div>Yosemite trail</div>");
    const keeper = keepRichTextSelection(root);
    const line = root.firstChild as HTMLElement;
    const text = line.firstChild as Text;
    const word = document.createRange();
    word.setStart(text, 0);
    word.setEnd(text, 8);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(word);
    document.dispatchEvent(new Event("selectionchange"));
    expect(keeper.restore().toString()).toBe("Yosemite");
    // What a command such as fontName does: the word moves into an element of its own, which
    // collapses the range kept before it, and the browser selects the new element's text. The
    // "selectionchange" that says so has not come yet when the next command restores.
    const word2 = text.splitText(8);
    const font = document.createElement("font");
    line.insertBefore(font, text);
    font.append(text);
    const moved = document.createRange();
    moved.selectNodeContents(font);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(moved);
    const restored = keeper.restore();
    expect(restored.toString()).toBe("Yosemite");
    expect(document.getSelection()?.toString()).toBe("Yosemite");
    expect(word2.nodeValue).toBe(" trail");
    keeper.dispose();
  });

  it("puts the caret at the end of an editor that never had the selection", () => {
    const root = editor("<div>text</div>");
    const keeper = keepRichTextSelection(root);
    const restored = keeper.restore();
    expect(restored.collapsed).toBe(true);
    expect(root.contains(restored.startContainer)).toBe(true);
    keeper.dispose();
  });
});

describe("richTextFromHtml", () => {
  it("keeps rgb colours and drops any other function or non-ASCII value, which a save refuses", () => {
    const fragment = richTextFromHtml(
      `<span style="color: color(srgb 0.1 0.2 0.3); font-size: 18px">a</span><span style="color: rgb(1, 2, 3); font-family: '日本'">b</span><span style="background-color: oklch(0.5 0.1 200)">c</span>`,
      document,
    );
    const holder = document.createElement("div");
    holder.append(fragment);
    const [first, second, third] = [...holder.children] as HTMLElement[];
    expect(first?.style.color).toBe("");
    expect(first?.style.fontSize).toBe("18px");
    expect(second?.style.color).toBe("rgb(1, 2, 3)");
    expect(second?.style.fontFamily).toBe("");
    expect(third?.style.backgroundColor).toBe("");
  });

  it("keeps the formats and drops everything that could run or load", () => {
    const fragment = richTextFromHtml(
      '<div style="text-align: right" onclick="alert(1)"><span style="font-weight: 700; text-decoration-line: underline line-through; color: rgb(1, 2, 3); background-image: url(x)">styled</span><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">link</a></div>',
      document,
    );
    const holder = document.createElement("div");
    holder.append(fragment);
    expect(holder.querySelector("script, img, a, [onclick]")).toBeNull();
    const span = holder.querySelector("span") as HTMLElement;
    expect(span.style.fontWeight).toBe("700");
    expect(span.style.textDecorationLine).toBe("underline line-through");
    expect(span.style.backgroundImage).toBe("");
    expect((holder.firstChild as HTMLElement).style.textAlign).toBe("right");
    expect(holder.textContent).toBe("styledlink");
  });

  it("keeps the elements and attributes it is told to", () => {
    const fragment = richTextFromHtml(
      '<h2 data-x="1">Title</h2><table data-kind="grid"><tbody><tr><td>cell</td></tr></tbody></table>',
      document,
      { elements: ["table", "tbody", "tr", "td"], attributes: { "data-kind": /^grid$/ } },
    );
    const holder = document.createElement("div");
    holder.append(fragment);
    expect(holder.innerHTML).toBe(
      '<h2>Title</h2><table data-kind="grid"><tbody><tr><td>cell</td></tr></tbody></table>',
    );
  });
});

describe("helpers", () => {
  it("turns CSS colours into hex, and transparent into none", () => {
    expect(cssColorToHex("rgb(255, 0, 16)")).toBe("#ff0010");
    expect(cssColorToHex("rgba(0, 0, 0, 0)")).toBeUndefined();
    expect(cssColorToHex("rgb(0 0 0 / 0)")).toBeUndefined();
    expect(cssColorToHex("#ABCDEF")).toBe("#abcdef");
    expect(cssColorToHex("red")).toBeUndefined();
  });

  it("finds a family by name in any case", () => {
    expect(findFontFamily("helvetica neue")?.css).toContain("'Helvetica Neue'");
    expect(findFontFamily("Comic Sans")).toBeUndefined();
  });
});

describe("keepTypingRuns", () => {
  const press = (target: Element) =>
    target.dispatchEvent(new Event("pointerup", { bubbles: true }));
  const key = (target: Element, name: string, init: KeyboardEventInit = {}) =>
    target.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true, ...init }));

  it("ends the typing run at the next typing key after a press in the view, at the end of a text node only", () => {
    const view = document.createElement("div");
    view.setAttribute("contenteditable", "true");
    view.innerHTML =
      "<div>Title</div><div>body</div><table><tbody><tr><td>cell</td></tr></tbody></table>";
    const menu = document.createElement("button");
    document.body.append(view, menu);
    const stop = keepTypingRuns();
    const selection = document.getSelection() as Selection;
    const body = view.children[1]?.firstChild as Text;

    // A press in the view, then the keyboard moves the insertion point to the end of a text node; the typing key moves
    // it into a new empty text node right after that node.
    selection.collapse(body, 1);
    press(view);
    selection.collapse(body, body.length);
    key(view, "a");
    expect(selection.anchorNode).not.toBe(body);
    expect(selection.anchorNode?.nodeType).toBe(Node.TEXT_NODE);
    expect(selection.anchorNode?.textContent).toBe("");
    expect(selection.anchorNode?.previousSibling).toBe(body);
    expect(view.textContent).toBe("Titlebodycell");

    // Only once per press: the next key leaves the insertion point where it is.
    selection.collapse(body, body.length);
    key(view, "b");
    expect(selection.anchorNode).toBe(body);

    // No press, a press elsewhere, a key that types nothing, a modified key: nothing moves.
    press(menu);
    key(view, "c");
    expect(selection.anchorNode).toBe(body);
    press(view);
    key(view, "ArrowLeft");
    key(view, "z", { ctrlKey: true });
    expect(selection.anchorNode).toBe(body);

    // In the middle of a text node, or in a table: the key clears the press and nothing moves.
    selection.collapse(body, 2);
    key(view, "d");
    expect(selection.anchorNode).toBe(body);
    const cell = view.querySelector("td")?.firstChild as Text;
    press(view);
    selection.collapse(cell, cell.length);
    key(view, "e");
    expect(selection.anchorNode).toBe(cell);

    // Enter is a typing key too; after the cleanup nothing moves.
    press(view);
    selection.collapse(body, body.length);
    key(view, "Enter");
    expect(selection.anchorNode).not.toBe(body);
    stop();
    press(view);
    selection.collapse(body, body.length);
    key(view, "f");
    expect(selection.anchorNode).toBe(body);
    view.remove();
    menu.remove();
  });

  it("shares its listeners between views and removes them after the last", () => {
    const view = document.createElement("div");
    view.setAttribute("contenteditable", "true");
    view.textContent = "text";
    document.body.append(view);
    const selection = document.getSelection() as Selection;
    const text = view.firstChild as Text;
    const first = keepTypingRuns();
    const second = keepTypingRuns();
    first();
    press(view);
    selection.collapse(text, text.length);
    key(view, "a");
    expect(selection.anchorNode).not.toBe(text);
    second();
    press(view);
    selection.collapse(text, text.length);
    key(view, "a");
    expect(selection.anchorNode).toBe(text);
    view.remove();
  });
});
