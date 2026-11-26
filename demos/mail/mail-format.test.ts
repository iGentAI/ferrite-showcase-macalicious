import { richTextFromHtml } from "macalicious/lib/rich-text";
import { describe, expect, it } from "vitest";
import { holdsStyles, makePlain, runMailText, stepQuoteLevel } from "./mail-format";
import { messageText } from "./mail-text";

const editor = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
};

const select = (node: Node) => {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

describe("Format's quote levels", () => {
  it("takes one item of a list out of the quote around the list, splitting the list", () => {
    const root = editor("<blockquote><ul><li>one</li><li>two</li><li>three</li></ul></blockquote>");
    select(root.querySelectorAll("li")[1] as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      "<blockquote><ul><li>one</li></ul></blockquote><ul><li>two</li></ul><blockquote><ul><li>three</li></ul></blockquote>",
    );
  });

  it("takes a line out of the quote above the blocks grouping it, splitting them", () => {
    const root = editor("<blockquote><div><div>one</div><div>two</div></div></blockquote>");
    select(root.querySelectorAll("div")[2] as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      "<blockquote><div><div>one</div></div></blockquote><div><div>two</div></div>",
    );
  });

  it("takes a line out of a quote inside the blocks grouping it", () => {
    const root = editor("<div><blockquote><div>one</div></blockquote><div>two</div></div>");
    select(root.querySelector("blockquote div") as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<div><div>one</div><div>two</div></div>");
  });

  it("takes each selected line one level down, across quotes of different depth, keeping all text", () => {
    const root = editor(
      "<blockquote><div>a</div><blockquote><div>b</div></blockquote><div>c</div></blockquote>",
    );
    select(root);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<div>a</div><blockquote><div>b</div></blockquote><div>c</div>");
  });

  it("leaves a line the selection starts at the very end of", () => {
    const root = editor("<div>one</div><div>two</div>");
    const range = document.createRange();
    range.setStart(root.children[0]?.firstChild as Node, 3);
    range.setEnd(root.children[1]?.firstChild as Node, 3);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<div>one</div><blockquote><div>two</div></blockquote>");
  });

  it("quotes the line a selection of nothing but its boundary starts on", () => {
    const root = editor("<div>one</div><div>two</div>");
    const range = document.createRange();
    range.setStart(root.children[0]?.firstChild as Node, 3);
    range.setEnd(root.children[1]?.firstChild as Node, 0);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote><div>one</div></blockquote><div>two</div>");
  });

  it("quotes lines with blank text between them in one quote", () => {
    const root = editor("<div>one</div>\n<div>two</div>");
    select(root);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote><div>one</div>\n<div>two</div></blockquote>");
  });

  it.each([
    ["the message", (root: HTMLElement) => root],
    ["the block of blocks", (root: HTMLElement) => root.firstChild as Node],
  ])("gives an insertion point at the start of %s to the first line", (_, container) => {
    const root = editor("<div><div>one</div><div>two</div></div>");
    const selection = document.getSelection();
    selection?.collapse(container(root), 0);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<div><blockquote><div>one</div></blockquote><div>two</div></div>");
    expect(selection?.isCollapsed).toBe(true);
    expect(root.querySelector("blockquote")?.contains(selection?.anchorNode ?? null)).toBe(true);
  });

  it("takes a line of a block of blocks by itself, quoting and unquoting only it", () => {
    const root = editor("<div><div>one</div><div>two</div></div>");
    select(root.children[0]?.children[1] as Element);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<div><div>one</div><blockquote><div>two</div></blockquote></div>");
    select(root.querySelector("blockquote div") as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<div><div>one</div><div>two</div></div>");
  });

  it("leaves a line the selection only reaches the start of", () => {
    const root = editor("<div>one</div><div>two</div>");
    const range = document.createRange();
    range.setStart(root.children[0]?.firstChild as Node, 0);
    range.setEnd(root.children[1]?.firstChild as Node, 0);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote><div>one</div></blockquote><div>two</div>");
    const again = document.createRange();
    again.setStart(root.querySelector("blockquote div")?.firstChild as Node, 0);
    again.setEnd(root.children[1]?.firstChild as Node, 0);
    selection?.removeAllRanges();
    selection?.addRange(again);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<div>one</div><div>two</div>");
  });
  it("takes only the message's part of a selection reaching beyond it", () => {
    const root = editor("<div>one</div><div>two</div>");
    const outside = document.createElement("p");
    outside.textContent = "outside";
    document.body.append(outside);
    const range = document.createRange();
    range.setStart(root.children[1]?.firstChild as Node, 0);
    range.setEnd(outside.firstChild as Node, 3);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<div>one</div><blockquote><div>two</div></blockquote>");
    expect(outside.outerHTML).toBe("<p>outside</p>");
    const back = document.createRange();
    back.setStart(outside.firstChild as Node, 3);
    back.setEnd(root.querySelector("blockquote div")?.firstChild as Node, 3);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(back);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<div>one</div><div>two</div>");
  });

  it("takes a level back and gives it again, with the selection, once for each command", () => {
    const root = editor("<blockquote><div>one</div><div>two</div><div>three</div></blockquote>");
    select(root.querySelectorAll("div")[1] as Element);
    runMailText(root, "quote-less");
    const split =
      "<blockquote><div>one</div></blockquote><div>two</div><blockquote><div>three</div></blockquote>";
    expect(root.innerHTML).toBe(split);
    expect(stepQuoteLevel(root, "undo")).toBe(true);
    expect(root.innerHTML).toBe(
      "<blockquote><div>one</div><div>two</div><div>three</div></blockquote>",
    );
    expect(document.getSelection()?.toString()).toBe("two");
    expect(stepQuoteLevel(root, "undo")).toBe(false);
    expect(stepQuoteLevel(root, "redo")).toBe(true);
    expect(root.innerHTML).toBe(split);
    expect(document.getSelection()?.toString()).toBe("two");
    expect(stepQuoteLevel(root, "redo")).toBe(false);
  });

  it("leaves no bullet of no text around a nested item a split takes out", () => {
    const nested = "<blockquote><ul><li>parent<ul><li>a</li><li>b</li></ul></li></ul></blockquote>";
    let root = editor(nested);
    select(root.querySelectorAll("li")[2] as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      "<blockquote><ul><li>parent<ul><li>a</li></ul></li></ul></blockquote><ul><ul><li>b</li></ul></ul>",
    );
    expect(document.getSelection()?.toString()).toBe("b");
    expect(stepQuoteLevel(root, "undo")).toBe(true);
    expect(root.innerHTML).toBe(nested);

    root = editor(nested);
    select(root.querySelectorAll("li")[1] as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      "<blockquote><ul><li>parent</li></ul></blockquote><ul><ul><li>a</li></ul></ul><blockquote><ul><ul><li>b</li></ul></ul></blockquote>",
    );
    // Such a list is still lines to the commands, and what a sent message keeps of it is the same.
    const kept = document.createElement("div");
    kept.append(richTextFromHtml(root.innerHTML, document));
    expect(kept.innerHTML).toBe(root.innerHTML);
    select(root.querySelectorAll("blockquote li")[1] as Element);
    runMailText(root, "quote-less");
    expect(root.querySelectorAll("blockquote").length).toBe(1);
    expect(root.textContent).toBe("parentab");
  });

  it("puts the very nodes back, so what the browser holds of the typing before a level still applies", () => {
    const root = editor("<div>typed</div><div>next</div>");
    const typed = root.querySelector("div")?.firstChild as Text;
    select(root.children[0] as Element);
    runMailText(root, "quote-more");
    expect(stepQuoteLevel(root, "undo")).toBe(true);
    expect(root.querySelector("div")?.firstChild).toBe(typed);
    expect(typed.isConnected).toBe(true);
    expect(stepQuoteLevel(root, "redo")).toBe(true);
    expect(root.querySelector("blockquote div")?.firstChild).toBe(typed);
  });

  it("leaves Undo to the browser once the message has changed since the level", () => {
    const root = editor("<div>one</div>");
    select(root.children[0] as Element);
    runMailText(root, "quote-more");
    (root.querySelector("div") as Element).append("typed");
    expect(stepQuoteLevel(root, "undo")).toBe(false);
    expect(root.innerHTML).toBe("<blockquote><div>onetyped</div></blockquote>");
  });

  it("keeps own text on each side of a nested list where it is", () => {
    const root = editor("<ul><li>before<ul><li>child</li></ul>after</li></ul>");
    select(root.querySelector("li")?.firstChild as Text);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(
      "<ul><li><blockquote>before</blockquote><ul><li>child</li></ul><blockquote>after</blockquote></li></ul>",
    );
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<ul><li>before<ul><li>child</li></ul>after</li></ul>");
  });

  it("keeps a nested list where it is between own text when its item leaves a quote", () => {
    const root = editor(
      "<blockquote><ul><li>before<ul><li>child</li></ul>after</li></ul></blockquote>",
    );
    select(root.querySelector("li")?.firstChild as Text);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      "<ul><li>before<blockquote><ul><li>child</li></ul></blockquote>after</li></ul>",
    );
  });

  it("takes a nested item inside a group by itself, leaving its parent item", () => {
    const root = editor("<ul><li>parent<div><ul><li>child</li></ul></div></li></ul>");
    select(root.querySelectorAll("li")[1] as Element);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(
      "<ul><li>parent<div><ul><li><blockquote>child</blockquote></li></ul></div></li></ul>",
    );
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<ul><li>parent<div><ul><li>child</li></ul></div></li></ul>");
  });

  it("quotes a parent item's own line and leaves a list inside a group in it", () => {
    const root = editor("<ul><li>parent<div><ul><li>child</li></ul></div></li></ul>");
    select(root.querySelector("li")?.firstChild as Text);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(
      "<ul><li><blockquote>parent</blockquote><div><ul><li>child</li></ul></div></li></ul>",
    );
  });

  it("keeps an unselected nested list where it is when its parent item leaves the quote", () => {
    const root = editor("<blockquote><ul><li>parent<ul><li>child</li></ul></li></ul></blockquote>");
    select(root.querySelector("li")?.firstChild as Text);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      "<ul><li>parent<blockquote><ul><li>child</li></ul></blockquote></li></ul>",
    );
    const child = root.querySelectorAll("li")[1] as Element;
    select(child);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<ul><li>parent<ul><li>child</li></ul></li></ul>");
  });

  it("takes a parent item and its nested list out together when both are selected", () => {
    const root = editor("<blockquote><ul><li>parent<ul><li>child</li></ul></li></ul></blockquote>");
    select(root.querySelector("blockquote") as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<ul><li>parent<ul><li>child</li></ul></li></ul>");
  });

  it("gives a parent item's own quote back without touching its quoted nested list", () => {
    const root = editor(
      "<ul><li><blockquote>parent</blockquote><blockquote><ul><li>child</li></ul></blockquote></li></ul>",
    );
    select(root.querySelector("blockquote") as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      "<ul><li>parent<blockquote><ul><li>child</li></ul></blockquote></li></ul>",
    );
  });

  it.each([
    [
      "between two lines",
      "<div>one</div>\n<div>two</div>",
      1,
      "<blockquote><div>one</div></blockquote>\n<div>two</div>",
    ],
    [
      "before the first line",
      "\n<div>one</div><div>two</div>",
      0,
      "\n<blockquote><div>one</div></blockquote><div>two</div>",
    ],
  ])("gives an insertion point in blank text %s to the nearest line", (_, html, at, expected) => {
    const root = editor(html);
    document.getSelection()?.collapse(root.childNodes[at] as Node, 0);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(expected);
  });

  it("quotes one paragraph of a table's cell, and leaves the rest of the table", () => {
    const root = editor(
      "<table><tbody><tr><td><p>one</p><p>two</p></td><td>three</td></tr></tbody></table>",
    );
    select(root.querySelectorAll("p")[1] as Element);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(
      "<table><tbody><tr><td><p>one</p><blockquote><p>two</p></blockquote></td><td>three</td></tr></tbody></table>",
    );
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      "<table><tbody><tr><td><p>one</p><p>two</p></td><td>three</td></tr></tbody></table>",
    );
  });

  it("quotes a table cell of plain text inside the cell", () => {
    const root = editor("<table><tbody><tr><td>one</td><td>two</td></tr></tbody></table>");
    select(root.querySelectorAll("td")[1] as Element);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(
      "<table><tbody><tr><td>one</td><td><blockquote>two</blockquote></td></tr></tbody></table>",
    );
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<table><tbody><tr><td>one</td><td>two</td></tr></tbody></table>");
  });

  it("quotes the line selected, then a level more, and takes each off again", () => {
    const root = editor("<div>one</div><div>two</div>");
    select(root.children[1] as Element);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<div>one</div><blockquote><div>two</div></blockquote>");
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(
      "<div>one</div><blockquote><blockquote><div>two</div></blockquote></blockquote>",
    );
    runMailText(root, "quote-less");
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<div>one</div><div>two</div>");
  });

  it("keeps the selection on the same text, and says the message changed", () => {
    const root = editor("<div>one</div>");
    const text = (root.firstChild as Element).firstChild as Text;
    select(text);
    let changes = 0;
    root.addEventListener("input", () => {
      changes += 1;
    });
    runMailText(root, "quote-more");
    expect(document.getSelection()?.toString()).toBe("one");
    expect(changes).toBe(1);
  });

  it("leaves lines outside a quote alone when a level is taken off", () => {
    const root = editor("<div>one</div>");
    select(root.children[0] as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<div>one</div>");
  });

  it("changes only the line selected inside a quote of two", () => {
    const root = editor("<blockquote><div>one</div><div>two</div></blockquote>");
    select(root.querySelectorAll("div")[1] as Element);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(
      "<blockquote><div>one</div><blockquote><div>two</div></blockquote></blockquote>",
    );
    const other = editor("<blockquote><div>one</div><div>two</div></blockquote>");
    select(other.querySelectorAll("div")[1] as Element);
    runMailText(other, "quote-less");
    expect(other.innerHTML).toBe("<blockquote><div>one</div></blockquote><div>two</div>");
  });

  it("keeps a quote of what follows the line taken out of it", () => {
    const root = editor("<blockquote><div>one</div><div>two</div><div>three</div></blockquote>");
    select(root.querySelectorAll("div")[1] as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      "<blockquote><div>one</div></blockquote><div>two</div><blockquote><div>three</div></blockquote>",
    );
  });

  it("keeps a selection of the whole message, whose ends are in the message itself", () => {
    const root = editor("<div>one</div><div>two</div>");
    select(root);
    let changes = 0;
    root.addEventListener("input", () => {
      changes += 1;
    });
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote><div>one</div><div>two</div></blockquote>");
    expect(document.getSelection()?.toString().replace(/\s/g, "")).toBe("onetwo");
    expect(changes).toBe(1);
  });

  it("puts the insertion point in the quote of an empty message", () => {
    const root = editor("");
    const range = document.createRange();
    range.setStart(root, 0);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote><br></blockquote>");
    const now = document.getSelection();
    expect(now?.isCollapsed).toBe(true);
    expect(now?.anchorNode).toBe(root.querySelector("blockquote"));
  });

  it("leaves an insertion point at the start of the message where it was, collapsed", () => {
    const root = editor("<div>one</div><div>two</div>");
    const range = document.createRange();
    range.setStart(root, 0);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote><div>one</div></blockquote><div>two</div>");
    const now = document.getSelection();
    expect(now?.isCollapsed).toBe(true);
    expect(now?.anchorNode).toBe(root.querySelector("blockquote"));
    expect(now?.anchorOffset).toBe(0);
  });

  it("gives what follows a line taken out of a quote the quote's own attributes", () => {
    const root = editor(
      '<blockquote dir="rtl" style="color: red"><div>one</div><div>two</div><div>three</div></blockquote>',
    );
    select(root.querySelectorAll("div")[1] as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      '<blockquote dir="rtl" style="color: red"><div>one</div></blockquote><div>two</div><blockquote dir="rtl" style="color: red"><div>three</div></blockquote>',
    );
  });

  it("quotes the line an insertion point follows, when it is between two lines", () => {
    const root = editor("<div>one</div><div>two</div>");
    const range = document.createRange();
    range.setStart(root, 1);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote><div>one</div></blockquote><div>two</div>");
    const caret = document.getSelection();
    expect(caret?.isCollapsed).toBe(true);
    expect(root.querySelector("blockquote")?.contains(caret?.anchorNode ?? null)).toBe(true);
  });

  it("quotes one item of a list, in the item, and leaves the other", () => {
    const root = editor("<ul><li>one</li><li>two</li></ul>");
    select(root.querySelectorAll("li")[1] as Element);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<ul><li>one</li><li><blockquote>two</blockquote></li></ul>");
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("quotes a whole list item when only a word of it is selected", () => {
    const root = editor("<ul><li>one<b>two</b>three</li><li>four</li></ul>");
    select(root.querySelector("b") as Element);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(
      "<ul><li><blockquote>one<b>two</b>three</blockquote></li><li>four</li></ul>",
    );
  });

  it("takes the quote around a list off, keeping the list", () => {
    const root = editor("<blockquote><ul><li>one</li><li>two</li></ul></blockquote>");
    select(root.querySelector("ul") as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("quotes inside the item an insertion point between two items follows", () => {
    const root = editor("<ul><li>one</li><li>two</li></ul>");
    const range = document.createRange();
    range.setStart(root.querySelector("ul") as Element, 1);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<ul><li><blockquote>one</blockquote></li><li>two</li></ul>");
    const now = document.getSelection();
    expect(now?.isCollapsed).toBe(true);
    expect(root.querySelector("blockquote")?.contains(now?.anchorNode ?? null)).toBe(true);
  });

  it("quotes one item of a nested list, and leaves the item it is in and the one beside it", () => {
    const root = editor("<ul><li>parent<ul><li>child one</li><li>child two</li></ul></li></ul>");
    select(root.querySelectorAll("li")[1] as Element);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(
      "<ul><li>parent<ul><li><blockquote>child one</blockquote></li><li>child two</li></ul></li></ul>",
    );
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe(
      "<ul><li>parent<ul><li>child one</li><li>child two</li></ul></li></ul>",
    );
  });

  it("quotes a parent item's own line, not the list nested in it", () => {
    const root = editor("<ul><li>parent<ul><li>child</li></ul></li></ul>");
    const parent = root.querySelector("li")?.firstChild as Text;
    select(parent);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe(
      "<ul><li><blockquote>parent</blockquote><ul><li>child</li></ul></li></ul>",
    );
  });

  it("takes one level off a list inside two quotes, however many items are selected", () => {
    const root = editor(
      "<blockquote><blockquote><ul><li>one</li><li>two</li></ul></blockquote></blockquote>",
    );
    select(root.querySelector("ul") as Element);
    runMailText(root, "quote-less");
    expect(root.innerHTML).toBe("<blockquote><ul><li>one</li><li>two</li></ul></blockquote>");
    expect(document.getSelection()?.toString().replace(/\s/g, "")).toBe("onetwo");
  });

  it("quotes all of a line of bare text when a word of it is selected", () => {
    const root = editor("hello <b>world</b>!<br><div>next</div>");
    select(root.querySelector("b") as Element);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote>hello <b>world</b>!<br></blockquote><div>next</div>");
    expect(document.getSelection()?.toString()).toBe("world");
  });

  it("quotes all of a bare line for an insertion point between its parts, and leaves it there", () => {
    const root = editor("hello <b>world</b>!");
    const range = document.createRange();
    range.setStart(root, 1);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote>hello <b>world</b>!</blockquote>");
    const now = document.getSelection()?.getRangeAt(0);
    expect(now?.collapsed).toBe(true);
    expect(now?.startContainer).toBe(root.querySelector("blockquote"));
    expect(now?.startOffset).toBe(1);
  });

  it("keeps an insertion point after a bare line with the line it quotes", () => {
    const root = editor("hello<br><div>next</div>");
    const range = document.createRange();
    range.setStart(root, 2);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote>hello<br></blockquote><div>next</div>");
    const now = document.getSelection();
    expect(now?.isCollapsed).toBe(true);
    expect(root.querySelector("blockquote")?.contains(now?.anchorNode ?? null)).toBe(true);
  });

  it("leaves an insertion point inside a line where it was", () => {
    const root = editor("<div>one<b>two</b>three</div>");
    const line = root.children[0] as Element;
    const range = document.createRange();
    range.setStart(line, 1);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    runMailText(root, "quote-more");
    const now = document.getSelection()?.getRangeAt(0);
    expect(now?.collapsed).toBe(true);
    expect(now?.startContainer).toBe(line);
    expect(now?.startOffset).toBe(1);
  });

  it("quotes the line of an insertion point at the start of the message", () => {
    const root = editor("<div>one</div>");
    select(root.children[0] as Element);
    document.getSelection()?.collapseToStart();
    runMailText(root, "quote-more");
    expect(root.innerHTML).toBe("<blockquote><div>one</div></blockquote>");
  });
});

describe("what Make Plain Text would take away", () => {
  it("is any style, on any element, and any list or quote", () => {
    expect(holdsStyles(editor('<p style="color: red">one</p>'))).toBe(true);
    expect(holdsStyles(editor("<ul><li>one</li></ul>"))).toBe(true);
    expect(holdsStyles(editor("<blockquote>one</blockquote>"))).toBe(true);
    expect(holdsStyles(editor('<a href="https://example.com">one</a>'))).toBe(true);
    expect(holdsStyles(editor("<div>one</div><div><br></div>"))).toBe(false);
    expect(holdsStyles(editor("<p>one</p><span>two</span>"))).toBe(false);
  });

  it.each(["mark", "del", "code", "small"])("is a %s, as any element but plain lines", (tag) => {
    expect(holdsStyles(editor(`<div><${tag}>one</${tag}></div>`))).toBe(true);
  });
});

describe("Make Plain Text", () => {
  it("keeps every line and drops every style", () => {
    const root = editor("<div><b>one</b></div><ul><li>two</li></ul><blockquote>three</blockquote>");
    makePlain(root, messageText(root));
    expect(root.innerHTML).toBe("<div>one</div><div>two</div><div>three</div>");
  });
});
