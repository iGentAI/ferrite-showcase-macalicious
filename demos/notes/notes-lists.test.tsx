import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Notes } from "./notes";
import { noteContent, noteHtml } from "./notes-editor";

/*
 * Notes' bulleted and numbered lists. jsdom has no editing commands, so the browser's are recorded
 * with whether the selection was in the note; the lists themselves are measured in the three
 * engines by e2e/editors-lists-journey.mjs. The Table commands are tested in notes-table.test.tsx.
 */

const editor = () => screen.getByRole("textbox", { name: "Note" });

/** The browser's editing commands, recorded with whether the selection was in the note shown. */
function recordCommands() {
  const commands: [string, boolean][] = [];
  document.execCommand = (name: string) => {
    if (name !== "styleWithCSS") {
      const anchor = document.getSelection()?.anchorNode ?? null;
      commands.push([name, anchor !== null && editor().contains(anchor)]);
    }
    return true;
  };
  return commands;
}

afterEach(() => {
  delete (document as Partial<Document>).execCommand;
});

/** Fill the note with `html` and put the insertion point at the end of the text `word`. */
function caretAfter(html: string, word: string) {
  editor().innerHTML = html;
  const walker = document.createTreeWalker(editor(), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.includes(word)) continue;
    editor().focus();
    const range = document.createRange();
    range.setStart(node, (node.nodeValue ?? "").indexOf(word) + word.length);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    // jsdom does not report it: the browser would.
    document.dispatchEvent(new Event("selectionchange"));
    return;
  }
  throw new Error(`no ${word} in the note`);
}

const LIST = "<ul><li>Milk</li><li>Eggs</li></ul><div>Plain line</div>";

describe("Notes' lists", () => {
  const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

  it("makes the lines a bulleted or a numbered list from the format button", async () => {
    const user = setup();
    render(<Notes />);
    caretAfter("<div>One</div><div>Two</div>", "Two");
    const commands = recordCommands();
    await user.click(screen.getByRole("button", { name: "Format" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /^Bulleted List/ }));
    expect(commands).toEqual([["insertUnorderedList", true]]);
    await user.click(screen.getByRole("button", { name: "Format" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: /^Numbered List/ }));
    expect(commands.at(-1)).toEqual(["insertOrderedList", true]);
  });

  it("keeps the insertion point where it was in the line that becomes a list item", async () => {
    const user = setup();
    render(<Notes />);
    caretAfter("<div>One</div><div>Two</div>", "Two");
    const commands = recordCommands();
    const recording = document.execCommand;
    // What Chromium does: a new node holds the text, the insertion point at its start.
    document.execCommand = (name: string) => {
      const at = document.getSelection()?.anchorNode as Text | null;
      if (at) {
        const moved = at.cloneNode() as Text;
        at.replaceWith(moved);
        document.getSelection()?.collapse(moved, 0);
      }
      return recording.call(document, name);
    };
    await user.click(screen.getByRole("button", { name: "Make a Checklist" }));
    expect(commands).toEqual([["insertUnorderedList", true]]);
    expect(document.getSelection()?.anchorNode?.nodeValue).toBe("Two");
    expect(document.getSelection()?.anchorOffset).toBe(3);
  });

  it("takes a line out of its list when it is given a paragraph style", async () => {
    const user = setup();
    render(<Notes />);
    caretAfter("<ul><li>Milk</li><li>Eggs</li><li>Ham</li></ul><div>Plain line</div>", "Eggs");
    await user.click(screen.getByRole("button", { name: "Format" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /^Title/ }));
    expect(editor().innerHTML).toBe(
      "<ul><li>Milk</li></ul><h1>Eggs</h1><ul><li>Ham</li></ul><div>Plain line</div>",
    );

    caretAfter("<ul><li>Milk</li><li>Eggs</li></ul>", "Milk");
    await user.click(screen.getByRole("button", { name: "Format" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /^Body/ }));
    expect(editor().innerHTML).toBe('<div data-paragraph="body">Milk</div><ul><li>Eggs</li></ul>');

    caretAfter('<div>One</div><div><ul class="mac-notes-checklist"><li>Two</li></ul></div>', "Two");
    await user.click(screen.getByRole("button", { name: "Format" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /^Heading/ }));
    expect(editor().innerHTML).toBe("<div>One</div><h2>Two</h2>");
  });

  it("checks the kind of list the insertion point is in", async () => {
    const user = setup();
    render(<Notes />);
    caretAfter(LIST, "Eggs");
    await user.click(screen.getByRole("button", { name: "Format" }));
    expect(await screen.findByRole("menuitemcheckbox", { name: /^Bulleted List/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemcheckbox", { name: /^Numbered List/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("indents and outdents a list item with Tab and Shift-Tab, and leaves Tab alone outside a list", () => {
    render(<Notes />);
    caretAfter(LIST, "Eggs");
    const commands = recordCommands();
    expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(false);
    expect(fireEvent.keyDown(editor(), { key: "Tab", shiftKey: true })).toBe(false);
    expect(commands).toEqual([
      ["indent", true],
      ["outdent", true],
    ]);
    caretAfter(LIST, "Plain line");
    expect(fireEvent.keyDown(editor(), { key: "Tab" })).toBe(true);
    expect(commands).toHaveLength(2);
  });

  it("makes a list from Shift-Command-7 and Shift-Command-9 (Control off Apple platforms)", () => {
    render(<Notes />);
    caretAfter("<div>One</div>", "One");
    const commands = recordCommands();
    fireEvent.keyDown(editor(), { key: "&", code: "Digit7", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(editor(), { key: "(", code: "Digit9", ctrlKey: true, shiftKey: true });
    expect(commands).toEqual([
      ["insertUnorderedList", true],
      ["insertOrderedList", true],
    ]);
  });

  it("keeps lists, nested ones too, in the saved formats", () => {
    const markup =
      "<ul><li>Milk<ul><li>Oat</li></ul></li><li>Eggs</li></ul><ol><li>First</li><li>Second</li></ol>";
    const root = document.createElement("div");
    root.innerHTML = markup;
    expect(noteHtml(root)).toBe(markup);
    const holder = document.createElement("div");
    holder.append(
      noteContent({ lines: ["Milk", "Oat", "Eggs", "First", "Second"], html: markup }, document),
    );
    expect(holder.innerHTML).toBe(markup);
  });
});

describe("Notes' Table commands", () => {
  it("are dimmed while the insertion point is not in a table", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Notes />);
    caretAfter("<div>One</div>", "One");
    await user.click(screen.getByRole("button", { name: "Format" }));
    const table = await screen.findByRole("menuitem", { name: "Table" });
    table.focus();
    await user.keyboard("{ArrowRight}");
    for (const name of ["Add Row Above", "Add Column After", "Delete Row", "Delete Column"]) {
      expect(await screen.findByRole("menuitem", { name: new RegExp(`^${name}`) })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
  });
});
