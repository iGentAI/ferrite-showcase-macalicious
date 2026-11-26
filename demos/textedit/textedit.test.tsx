import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, texteditApp } from "./app";
import {
  TextEdit,
  type TextEditActions,
  TextEditMenuBar,
  type TextEditProps,
  type TextEditStatus,
} from "./textedit";
import { defaultPlaces, listFolder, withFolder } from "./textedit-data";
import { paragraphsOf, readLines } from "./textedit-document";

/*
 * jsdom has no layout and does not edit `contenteditable` content: an edit is made here as the
 * browser makes it, by changing the view's content and dispatching the `input` event the
 * browser would. It has no editing commands either (`document.execCommand`), so the tests of
 * character formats install a stand-in that records the command; what the browser then does
 * to the text is not under test. Command is the Control key off Apple platforms, which is what
 * jsdom reports.
 */
type User = ReturnType<typeof userEvent.setup>;

const frame = (name = "512 Pixels") => screen.getByRole("region", { name });
const button = (name: string) => screen.getByRole("button", { name });
const popUp = (name: string) => screen.getByRole("combobox", { name });
const editor = () => screen.getByRole("textbox", { name: "Document" });
const paragraphs = () => [...editor().children] as HTMLElement[];
const openPanel = () => screen.getByRole("dialog", { name: "Open" });
const sheet = (name: string) => screen.getByRole("dialog", { name });
const file = (name: string) => within(openPanel()).getByRole("option", { name });
const command = (key: string, shiftKey = false) =>
  fireEvent.keyDown(editor(), { key, ctrlKey: true, shiftKey });

/** Replace the document's paragraphs, as typing would. */
const write = (...lines: string[]) => {
  const node = editor();
  node.replaceChildren(
    ...lines.map((line) => {
      const element = document.createElement("div");
      // The browser keeps an empty line open with a line break.
      element.append(line === "" ? document.createElement("br") : line);
      return element;
    }),
  );
  fireEvent.input(node);
};

/** Put the selection in the paragraphs from `first` to `last`, as a drag across them would. */
const selectParagraphs = (first: number, last = first) => {
  const range = document.createRange();
  range.setStart(paragraphs()[first]?.firstChild as Node, 0);
  range.setEnd(paragraphs()[last]?.firstChild as Node, 1);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent(document, new Event("selectionchange"));
};

/** Lets the changes go when the window asks about them. */
async function dontSave(user: User) {
  const ask = await screen.findByRole("dialog", { name: /save the changes/ });
  await user.click(within(ask).getByRole("button", { name: "Don’t Save" }));
}

async function choose(user: User, name: string, option: string) {
  await user.click(popUp(name));
  await user.click(await screen.findByRole("option", { name: option }));
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

async function chooseFromMenu(user: User, name: string, item: string | RegExp, role = "menuitem") {
  await user.click(button(name));
  await user.click(await screen.findByRole(role, { name: item }));
}

/**
 * The browser's editing commands, recorded: jsdom has none. Each entry is the command, its
 * value and whether the selection was in the document when it ran. Bold, italic, underline
 * and strikethrough are also done as a browser would, in elements of their own around the
 * selected paragraphs' text, so that what the text holds can be read back.
 */
function recordCommands(run?: (command: string, value: string) => void) {
  const commands: [string, string | undefined, boolean][] = [];
  document.execCommand = (name: string, _ui?: boolean, value?: string) => {
    if (name !== "styleWithCSS") {
      const anchor = document.getSelection()?.anchorNode ?? null;
      commands.push([name, value, anchor !== null && editor().contains(anchor)]);
      const tag = STYLE_TAGS[name];
      if (tag) toggleStyle(tag);
      if (name === "removeFormat") removeStyles();
      run?.(name, value ?? "");
    }
    return true;
  };
  return commands;
}

const STYLE_TAGS: Record<string, string> = {
  bold: "b",
  italic: "i",
  underline: "u",
  strikeThrough: "s",
};

/** Take the style elements out of the paragraphs the selection touches, as Default does. */
function removeStyles() {
  const selection = document.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  for (const paragraph of paragraphs()) {
    if (!range?.intersectsNode(paragraph)) continue;
    for (const element of paragraph.querySelectorAll("b, i, u, s")) {
      element.replaceWith(...element.childNodes);
    }
  }
}

/** Toggle a style element around the text of the paragraphs the selection touches. */
function toggleStyle(tag: string) {
  const selection = document.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (!range) return;
  const touched = paragraphs().filter((paragraph) => range.intersectsNode(paragraph));
  for (const paragraph of touched) {
    const existing = paragraph.querySelector(tag);
    if (existing) existing.replaceWith(...existing.childNodes);
    else {
      const element = document.createElement(tag);
      element.append(...paragraph.childNodes);
      paragraph.append(element);
    }
  }
  // Moving the text moved the selection's ends: it holds the same paragraphs again.
  const first = touched[0];
  const last = touched.at(-1);
  if (!first || !last) return;
  const again = document.createRange();
  again.setStart(first, 0);
  again.setEnd(last, last.childNodes.length);
  selection?.removeAllRanges();
  selection?.addRange(again);
}

afterEach(() => {
  delete (document as Partial<Document>).execCommand;
});

describe("the window", () => {
  it("opens on the document of the reference capture, at its size", () => {
    render(<TextEdit />);
    expect(frame()).toHaveClass("mac-window", "mac-textedit");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().style.width).toBe("624px");
    expect(frame().style.height).toBe("537px");
    expect(editor()).toHaveTextContent("Here's to the crazy ones...");
    const bar = screen.getByRole("toolbar", { name: "Format" });
    expect(within(bar).getByRole("combobox", { name: "Font family" })).toHaveTextContent(
      "Helvetica",
    );
    expect(popUp("Typeface")).toHaveTextContent("Regular");
    expect(popUp("Font size")).toHaveValue("12");
    expect(popUp("Line spacing")).toHaveTextContent("1.0");
    expect(button("Align left")).toHaveAttribute("aria-pressed", "true");
    expect(button("Bold")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("group", { name: "Ruler" })).toBeInTheDocument();
  });

  it("hands a host's callbacks to the window controls and the title bar", async () => {
    const user = userEvent.setup();
    const on = { close: vi.fn(), minimize: vi.fn(), zoom: vi.fn(), press: vi.fn() };
    render(
      <TextEdit
        state="inactive"
        width={700}
        onClose={on.close}
        onMinimize={on.minimize}
        onZoom={on.zoom}
        zoomRole="zoom"
        onDragRegionPointerDown={on.press}
      />,
    );
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame().style.width).toBe("700px");
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(on.close).toHaveBeenCalledTimes(1);
    expect(on.minimize).toHaveBeenCalledTimes(1);
    expect(on.zoom).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(screen.getByRole("toolbar", { name: "Format" }));
    expect(on.press).toHaveBeenCalledTimes(1);
    // A press on a control of the format bar is the control's, not the window's.
    fireEvent.pointerDown(button("Bold"));
    expect(on.press).toHaveBeenCalledTimes(1);
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(texteditApp);
    expect(app.menus[0]).toBe(app.name);
    render(
      <WindowManager style={{ height: 700 }}>
        <ManagedWindow
          id={app.id}
          defaultFrame={{ x: 20, y: 20, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().parentElement).toHaveAttribute("data-window-id", "textedit");
    await user.click(within(frame()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "512 Pixels" })).toBeNull();
  });

  it("marks the document as edited once it is changed", () => {
    const onStatusChange = vi.fn();
    render(<TextEdit onStatusChange={onStatusChange} />);
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "512 Pixels", format: "rich", edited: false }),
    );
    write("Here's to the misfits.");
    expect(frame("512 Pixels — Edited")).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: "512 Pixels", format: "rich", edited: true }),
    );
  });
});

describe("the format bar", () => {
  it("aligns the paragraphs of the selection and shows the alignment where the caret is", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    write("One", "Two", "Three");
    selectParagraphs(1, 2);
    await user.click(button("Center"));
    expect(paragraphs().map((paragraph) => paragraph.style.textAlign)).toEqual([
      "",
      "center",
      "center",
    ]);
    expect(button("Center")).toHaveAttribute("aria-pressed", "true");
    // The bar follows the insertion point: the first paragraph is still left-aligned.
    selectParagraphs(0);
    expect(button("Align left")).toHaveAttribute("aria-pressed", "true");
    expect(button("Center")).toHaveAttribute("aria-pressed", "false");
    selectParagraphs(2);
    expect(button("Center")).toHaveAttribute("aria-pressed", "true");
  });

  it("formats every paragraph of a selection that ends at the view's own boundaries", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    write("One", "Two", "Three");
    // Select All: from before the view's first child to after its last.
    const all = document.createRange();
    all.selectNodeContents(editor());
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(all);
    fireEvent(document, new Event("selectionchange"));
    await user.click(button("Center"));
    expect(paragraphs().map((paragraph) => paragraph.style.textAlign)).toEqual([
      "center",
      "center",
      "center",
    ]);
    // From the start of the second paragraph to the boundary after it: that paragraph only.
    const second = document.createRange();
    second.setStart(editor(), 1);
    second.setEnd(editor(), 2);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(second);
    fireEvent(document, new Event("selectionchange"));
    await user.click(button("Align right"));
    expect(paragraphs().map((paragraph) => paragraph.style.textAlign)).toEqual([
      "center",
      "right",
      "center",
    ]);
  });

  it("sets the line spacing and the list style of the paragraph", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    write("One", "Two");
    selectParagraphs(1);
    await choose(user, "Line spacing", "2.0");
    expect(Number(paragraphs()[1]?.style.lineHeight)).toBeCloseTo(7 / 3, 2);
    expect(paragraphs()[0]?.style.lineHeight).toBe("");
    await chooseFromMenu(user, "List bullets and numbering", "1. 2. 3.", "menuitemradio");
    expect(paragraphs().map((paragraph) => paragraph.dataset.list)).toEqual([undefined, "decimal"]);
    await chooseFromMenu(user, "List bullets and numbering", "None", "menuitemradio");
    expect(paragraphs()[1]).not.toHaveAttribute("data-list");
    // Back to single spacing: nothing of the format is left on the paragraph.
    await choose(user, "Line spacing", "1.0");
    expect(paragraphs()[1]).not.toHaveAttribute("style");
  });

  it("formats a document whose first line the browser left as bare text", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    editor().replaceChildren(document.createTextNode("Bare"));
    fireEvent.input(editor());
    await user.click(button("Align right"));
    expect(paragraphs()).toHaveLength(1);
    expect(paragraphs()[0]).toHaveTextContent("Bare");
    expect(paragraphs()[0]?.style.textAlign).toBe("right");
  });

  it("runs the browser's editing commands on the selection for character formats", async () => {
    const user = userEvent.setup();
    const commands = recordCommands();
    render(<TextEdit />);
    selectParagraphs(0);
    await user.click(button("Bold"));
    expect(button("Bold")).toHaveAttribute("aria-pressed", "true");
    expect(popUp("Typeface")).toHaveTextContent("Bold");
    await choose(user, "Typeface", "Bold Oblique");
    await choose(user, "Font family", "Georgia");
    fireEvent.change(screen.getByLabelText("Text color"), { target: { value: "#ff0000" } });
    await chooseFromMenu(user, "Highlight color", "Yellow", "menuitemradio");
    await chooseFromMenu(user, "Highlight color", "No Color", "menuitemradio");
    // Every command ran with the selection back in the document, not on the control used.
    expect(commands).toEqual([
      ["bold", undefined, true],
      // Bold is on already: the typeface adds only what differs.
      ["italic", undefined, true],
      ["fontName", "Georgia, serif", true],
      ["foreColor", "#ff0000", true],
      ["hiliteColor", "#ffea00", true],
      ["hiliteColor", "transparent", true],
    ]);
    expect(frame("512 Pixels — Edited")).toBeInTheDocument();
  });

  it("gives the selection any size in points, beyond the browser's seven", async () => {
    const user = userEvent.setup();
    // The browser's fontSize command wraps the selected text in <font size>.
    recordCommands((name, value) => {
      if (name !== "fontSize") return;
      const text = paragraphs()[0]?.firstChild as Text;
      const font = document.createElement("font");
      font.setAttribute("size", value);
      text.before(font);
      font.append(text);
      document.getSelection()?.selectAllChildren(font);
    });
    render(<TextEdit />);
    selectParagraphs(0);
    // The size control is a combo box: its button opens the list of AppKit's sizes.
    await user.click(button("Show choices"));
    await user.click(await screen.findByRole("option", { name: "36" }));
    await waitFor(() => expect(editor().querySelector("[style*='font-size']")).not.toBeNull());
    expect(editor().querySelector("font[size]")).toBeNull();
    const sized = paragraphs()[0]?.firstElementChild as HTMLElement;
    expect(sized.style.fontSize).toBe("36px");
    expect(sized).toHaveTextContent("Here's to the crazy ones...");
    expect(popUp("Font size")).toHaveValue("36");
  });

  it("applies a size typed into the size field on Return, and only then", async () => {
    const user = userEvent.setup();
    const commands = recordCommands();
    render(<TextEdit />);
    selectParagraphs(0);
    const field = popUp("Font size");
    await user.tripleClick(field);
    await user.keyboard("17");
    expect(field).toHaveValue("17");
    expect(commands.filter(([name]) => name === "fontSize")).toEqual([]);
    await user.keyboard("{Enter}");
    expect(commands.filter(([name]) => name === "fontSize")).toHaveLength(1);

    // Text that is not a size changes nothing and goes back to the size at the insertion point.
    await user.tripleClick(popUp("Font size"));
    await user.keyboard("big{Enter}");
    expect(commands.filter(([name]) => name === "fontSize")).toHaveLength(1);
    expect(popUp("Font size")).not.toHaveValue("big");
  });

  it("clears the formats of the selection with the styles menu's Default", async () => {
    const user = userEvent.setup();
    const commands = recordCommands();
    render(<TextEdit />);
    selectParagraphs(0);
    await user.click(button("Justify"));
    await user.click(button("Underline"));
    await chooseFromMenu(user, "Paragraph styles", "Default");
    expect(commands).toEqual([
      ["underline", undefined, true],
      ["removeFormat", undefined, true],
    ]);
    expect(paragraphs()[0]).not.toHaveAttribute("style");
    expect(button("Align left")).toHaveAttribute("aria-pressed", "true");
    expect(button("Underline")).toHaveAttribute("aria-pressed", "false");
  });

  it("indents the text by the ruler's markers", () => {
    // jsdom lays nothing out: the ruler is given the window's width to keep its markers in.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(624);
    render(<TextEdit />);
    const head = screen.getByRole("slider", { name: "head indent" });
    const tail = screen.getByRole("slider", { name: "tail indent" });
    // The text container is the 624 pt window less 5 pt at each side.
    expect(tail).toHaveAttribute("aria-valuenow", "614");
    fireEvent.keyDown(head, { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("slider", { name: "head indent" }), { key: "ArrowRight" });
    expect(editor().style.getPropertyValue("--mac-textedit-head-indent")).toBe("18px");
    // The first line stays where it was: its indent is relative to the head indent.
    expect(editor().style.getPropertyValue("--mac-textedit-first-indent")).toBe("-18px");
    fireEvent.keyDown(tail, { key: "ArrowLeft" });
    expect(editor().style.getPropertyValue("--mac-textedit-tail-indent")).toBe("11px");
  });
});

describe("plain text", () => {
  it("turns the document into plain text and back, keeping its lines", async () => {
    render(<TextEdit />);
    write("First", "", "Third");
    command("t", true);
    fireEvent.click(await screen.findByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.queryByRole("toolbar", { name: "Format" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Ruler" })).toBeNull();
    expect(editor().tagName).toBe("TEXTAREA");
    expect(editor()).toHaveValue("First\n\nThird");
    fireEvent.change(editor(), { target: { value: "First\nSecond" } });
    command("t", true);
    expect(screen.getByRole("toolbar", { name: "Format" })).toBeInTheDocument();
    expect(readLines(editor())).toEqual(["First", "Second"]);
  });
});

describe("the Open panel", () => {
  it("opens a document chosen in the browser", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    command("o");
    expect(frame()).toHaveAttribute("data-window-state", "main");
    expect(openPanel()).toHaveAttribute("data-window-state", "key");
    // The panel has the keyboard: its file list.
    expect(within(openPanel()).getAllByRole("listbox")[0]).toHaveFocus();
    expect(button("Open")).toBeDisabled();
    // A file of another application is listed, and cannot be opened.
    await user.click(file("Aqua and Bondi.pdf"));
    expect(button("Open")).toBeDisabled();
    await user.click(file("For Desktop Stacks"));
    await user.click(file("Read Me.txt"));
    await user.click(button("Open"));
    expect(screen.queryByRole("dialog", { name: "Open" })).toBeNull();
    // A plain text document: no format bar, the text in a plain text view.
    expect(frame("Read Me.txt")).toHaveAttribute("data-window-state", "key");
    expect(editor()).toHaveValue(
      "Files in this folder are sorted into stacks on the desktop.\n\nGroup them by kind, by date or by tag.",
    );
    expect(editor()).toHaveFocus();
  });

  it("opens a rich text document as plain text when the options say so", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    command("o");
    await user.click(button("Options"));
    await user.click(screen.getByRole("checkbox", { name: "Ignore rich text commands" }));
    await user.click(file("For Desktop Stacks"));
    await user.dblClick(file("Packing List"));
    expect(frame("Packing List")).toBeInTheDocument();
    expect(editor()).toHaveValue("Packing list\nPassport\nCharger\nWalking shoes");
  });

  it("goes to a place of the sidebar and back, and finds files by name", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    command("o");
    const panel = within(openPanel());
    expect(button("Back")).toHaveAttribute("aria-disabled", "true");
    await user.click(panel.getByRole("treeitem", { name: "TextEdit" }));
    expect(panel.getByRole("combobox", { name: "Location" })).toHaveTextContent("TextEdit");
    expect(panel.getAllByRole("option").map((row) => row.textContent)).toEqual(["Shopping.txt"]);
    await user.click(button("Back"));
    expect(file("512 Pixels")).toBeInTheDocument();
    expect(button("Forward")).not.toHaveAttribute("aria-disabled", "true");
    // Search looks into the folders of the place as well.
    await user.type(panel.getByRole("searchbox"), "pack");
    expect(panel.getAllByRole("option").map((row) => row.textContent)).toEqual(["Packing List"]);
  });

  it("keeps showing a folder's files when the folder is double-clicked in column view", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    command("o");
    // The first click enters the folder; the double click's action must not enter it again.
    await user.dblClick(file("For Desktop Stacks"));
    expect(file("Read Me.txt")).toBeInTheDocument();
    await user.dblClick(file("Packing List"));
    expect(frame("Packing List")).toBeInTheDocument();
  });

  it("starts a new document, and closes without one on Cancel", async () => {
    const user = userEvent.setup();
    const onDialogChange = vi.fn();
    render(<TextEdit onDialogChange={onDialogChange} />);
    write("Changed");
    command("o");
    await user.click(button("Cancel"));
    expect(screen.queryByRole("dialog", { name: "Open" })).toBeNull();
    expect(editor()).toHaveTextContent("Changed");
    expect(onDialogChange.mock.calls).toEqual([["open"], [null]]);
    command("o");
    await user.click(button("New Document"));
    await dontSave(user);
    expect(frame("Untitled")).toBeInTheDocument();
    expect(editor()).toHaveTextContent("");
    expect(screen.queryByRole("dialog", { name: "Open" })).toBeNull();
  });
});

describe("the Save sheet", () => {
  it("names the document, clears its edited state and files it where Open finds it", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    // jsdom lays nothing out: the ruler is given the window's width to keep its markers in.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(624);
    render(<TextEdit onSave={onSave} />);
    write("Dear Sir", "Yours");
    selectParagraphs(1);
    await user.click(button("Align right"));
    fireEvent.keyDown(screen.getByRole("slider", { name: "first line indent" }), { key: "End" });
    const indent = editor().style.getPropertyValue("--mac-textedit-first-indent");
    command("s");
    const save = within(sheet("Save"));
    const name = save.getByRole("textbox", { name: "Save As:" });
    expect(name).toHaveValue("512 Pixels");
    expect(frame("512 Pixels — Edited")).toHaveAttribute("data-window-state", "main");
    await user.clear(name);
    await user.type(name, "Letter");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save" })).toBeNull());
    expect(frame("Letter")).toHaveAttribute("data-window-state", "key");
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Letter", format: "rich", lines: ["Dear Sir", "Yours"] }),
      "documents",
      [],
    );
    // The saved document is in the Documents folder now, and opens with what was saved: the
    // text, the paragraph's format and the ruler.
    write("Something else");
    fireEvent.keyDown(screen.getByRole("slider", { name: "first line indent" }), { key: "Home" });
    command("o");
    await user.dblClick(file("Letter"));
    await dontSave(user);
    expect(readLines(editor())).toEqual(["Dear Sir", "Yours"]);
    expect(paragraphs().map((paragraph) => paragraph.style.textAlign)).toEqual(["", "right"]);
    expect(editor().style.getPropertyValue("--mac-textedit-first-indent")).toBe(indent);
    // Edits to the open document do not reach the saved file.
    write("Changed after opening");
    command("o");
    await user.dblClick(file("Letter"));
    await dontSave(user);
    expect(readLines(editor())).toEqual(["Dear Sir", "Yours"]);
  });

  it("saves into the folder its browser shows", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<TextEdit onSave={onSave} />);
    command("s");
    const save = within(sheet("Save"));
    await user.click(save.getByRole("button", { name: "Show the file browser" }));
    await user.click(save.getByRole("option", { name: "For Desktop Stacks" }));
    await user.clear(save.getByRole("textbox", { name: "Save As:" }));
    await user.type(save.getByRole("textbox", { name: "Save As:" }), "Nested");
    await user.click(save.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save" })).toBeNull());
    expect(onSave).toHaveBeenCalledWith(expect.anything(), "documents", ["desktop-stacks"]);
    command("o");
    expect(within(openPanel()).queryByRole("option", { name: "Nested" })).toBeNull();
    await user.click(file("For Desktop Stacks"));
    expect(file("Nested")).toBeInTheDocument();
  });

  it("saves rich text as plain text when that format is chosen", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    command("s");
    await choose(user, "File Format:", "Plain Text");
    await user.click(within(sheet("Save")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save" })).toBeNull());
    expect(screen.queryByRole("toolbar", { name: "Format" })).toBeNull();
    expect(editor()).toHaveValue("Here's to the crazy ones...");
  });

  it("leaves the document as it was on Cancel", async () => {
    const user = userEvent.setup();
    render(<TextEdit />);
    write("Changed");
    command("s");
    await user.click(within(sheet("Save")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save" })).toBeNull());
    expect(frame("512 Pixels — Edited")).toBeInTheDocument();
  });
});

describe("replacing an edited document that has no file, on no server", () => {
  const actions = { current: null } as { current: TextEditActions | null };
  const start = () => {
    render(<TextEdit actionsRef={actions} />);
    write("Typed");
  };
  const asked = () => screen.getByRole("dialog", { name: /save the changes/ });

  it("asks before New replaces it, and Don't Save lets it go", async () => {
    const user = userEvent.setup();
    start();
    act(() => actions.current?.newDocument());
    expect(editor().textContent).toBe("Typed");
    await user.click(within(asked()).getByRole("button", { name: "Don’t Save" }));
    await waitFor(() => expect(editor().textContent).toBe(""));
  });

  it("finishes the New once Save… has saved", async () => {
    const user = userEvent.setup();
    start();
    act(() => actions.current?.newDocument());
    await user.click(within(asked()).getByRole("button", { name: "Save…" }));
    await user.click(within(sheet("Save")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(editor().textContent).toBe(""));
  });

  it("forgets the New when that Save is cancelled, so a later Save only saves", async () => {
    const user = userEvent.setup();
    start();
    act(() => actions.current?.newDocument());
    await user.click(within(asked()).getByRole("button", { name: "Save…" }));
    await user.click(within(sheet("Save")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save" })).toBeNull());
    act(() => actions.current?.show("save"));
    const again = await screen.findByRole("dialog", { name: "Save" });
    await user.click(within(again).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Save" })).toBeNull());
    expect(editor().textContent).toBe("Typed");
  });

  it("asks before the Open panel's New Document replaces it", async () => {
    const user = userEvent.setup();
    start();
    act(() => actions.current?.show("open"));
    await user.click(within(openPanel()).getByRole("button", { name: "New Document" }));
    expect(asked()).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Document", hidden: true }).textContent).toBe(
      "Typed",
    );
  });
});

describe("the Print sheet", () => {
  it("previews the document's pages and hands the settings over on Print", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    render(<TextEdit onPrint={onPrint} />);
    write(...Array.from({ length: 100 }, (_, index) => `Line ${index + 1}`));
    command("p");
    const print = within(sheet("Print"));
    const page = print.getByRole("img", { name: "Preview" });
    expect(print.getByText("1 of 3")).toBeInTheDocument();
    expect(page).toHaveTextContent(/^Line 1Line 2.*Line 46$/);
    await user.click(print.getByRole("button", { name: "Next page" }));
    expect(page).toHaveTextContent(/^Line 47.*Line 92$/);
    await user.click(print.getByRole("checkbox", { name: "Print header and footer" }));
    expect(page).toHaveTextContent(/^512 PixelsLine 47.*Line 92Page 2 of 3$/);
    await user.click(print.getByRole("button", { name: "Print" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Print" })).toBeNull());
    expect(onPrint).toHaveBeenCalledWith(
      expect.objectContaining({ printer: "brother", copies: 1, paperSize: "letter" }),
    );
  });

  it("keeps the preset when a command of the Presets menu is chosen", async () => {
    const user = userEvent.setup();
    render(<TextEdit defaultDialog="print" />);
    await choose(user, "Presets:", "Black and White");
    await choose(user, "Presets:", "Show Presets…");
    expect(popUp("Presets:")).toHaveTextContent("Black and White");
  });

  it("goes on to the Save sheet from the PDF button", async () => {
    const user = userEvent.setup();
    render(<TextEdit defaultDialog="print" />);
    await chooseFromMenu(user, "PDF", "Save as PDF…");
    expect(await screen.findByRole("dialog", { name: "Save" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Print" })).toBeNull());
  });
});

describe("the menu bar", () => {
  function Application(props: TextEditProps) {
    const actions = useRef<TextEditActions>(null);
    const [status, setStatus] = useState<TextEditStatus>();
    const [busy, setBusy] = useState(false);
    return (
      <>
        <TextEditMenuBar actions={actions} status={status} disabled={busy} />
        <TextEdit
          {...props}
          actionsRef={actions}
          onStatusChange={setStatus}
          onDialogChange={(dialog) => setBusy(dialog !== null)}
        />
      </>
    );
  }
  const pick = async (user: User, menu: string, item: string) => {
    await user.click(screen.getByRole("menuitem", { name: menu }));
    await user.click(await screen.findByRole("menuitem", { name: new RegExp(`^${item}`) }));
  };

  it("keeps the keyboard in the document after Shift-Command-T, both ways", async () => {
    render(<Application />);
    editor().focus();
    command("t", true);
    fireEvent.click(await screen.findByRole("button", { name: "OK" }));
    await waitFor(() => expect(editor().tagName).toBe("TEXTAREA"));
    expect(document.activeElement).toBe(editor());
    command("t", true);
    await waitFor(() => expect(editor().tagName).not.toBe("TEXTAREA"));
    expect(document.activeElement).toBe(editor());
  });

  it("runs its Edit menu on the document", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const commands: string[] = [];
    document.execCommand = (name: string) => {
      commands.push(name);
      return true;
    };
    render(<Application />);
    const line = document.createElement("div");
    line.textContent = "Quillwort";
    editor().append(line);
    const range = document.createRange();
    range.selectNodeContents(line);
    editor().focus();
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    const copy = await screen.findByRole("menuitem", { name: /^Copy/ });
    expect(copy).not.toHaveAttribute("aria-disabled", "true");
    await user.click(copy);
    expect(commands).toContain("copy");
    delete (document as Partial<Document>).execCommand;
  });

  it("offers Paste Style from the window's menu bar once Copy Style has run", async () => {
    const user = userEvent.setup();
    render(<Application />);
    const fontRow = async (name: string) => {
      await user.click(screen.getByRole("menuitem", { name: "Format" }));
      await user.hover(await screen.findByRole("menuitem", { name: /^Font/ }));
      return screen.findByRole("menuitem", { name: new RegExp(`^${name}`) });
    };
    expect(await fontRow("Paste Style")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Copy Style/ }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(await fontRow("Paste Style")).not.toHaveAttribute("aria-disabled", "true");
  });

  it("runs the app's commands on the window", async () => {
    const user = userEvent.setup();
    render(<Application />);
    await pick(user, "Format", "Make Plain Text");
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(editor().tagName).not.toBe("TEXTAREA");
    await pick(user, "Format", "Make Plain Text");
    await user.click(await screen.findByRole("button", { name: "OK" }));
    expect(editor().tagName).toBe("TEXTAREA");
    // The command is named for what it would do now.
    await pick(user, "Format", "Make Rich Text");
    expect(screen.getByRole("toolbar", { name: "Format" })).toBeInTheDocument();
    await pick(user, "File", "New");
    await dontSave(user);
    expect(frame("Untitled")).toBeInTheDocument();
    await pick(user, "File", "Open");
    expect(openPanel()).toBeInTheDocument();
    // While a dialog is shown the commands are dimmed.
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    expect(await screen.findByRole("menuitem", { name: /^Print/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("styles the selection from Format > Font and Format > Text", async () => {
    const user = userEvent.setup();
    const commands = recordCommands();
    render(<Application />);
    const fromSubmenu = async (submenu: string, item: string) => {
      await user.click(screen.getByRole("menuitem", { name: "Format" }));
      await user.click(await screen.findByRole("menuitem", { name: submenu }));
      // The submenu's items take the pointer once it has opened, which jsdom does not animate.
      fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(`^${item}`) }));
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    };
    selectParagraphs(0);
    await fromSubmenu("Font", "Bold");
    await fromSubmenu("Font", "Italic");
    await fromSubmenu("Font", "Underline");
    await fromSubmenu("Text", "Center");
    // Every command ran on the document's selection, not on the menu.
    expect(commands).toEqual([
      ["bold", undefined, true],
      ["italic", undefined, true],
      ["underline", undefined, true],
    ]);
    expect(paragraphs()[0]?.style.textAlign).toBe("center");
    // The format bar shows what the menu set.
    expect(button("Bold")).toHaveAttribute("aria-pressed", "true");
    expect(button("Italic")).toHaveAttribute("aria-pressed", "true");
    expect(button("Underline")).toHaveAttribute("aria-pressed", "true");
    expect(button("Center")).toHaveAttribute("aria-pressed", "true");
    // Show Fonts and Show Colors open the panels.
    await fromSubmenu("Font", "Show Fonts");
    expect(await screen.findByRole("region", { name: "Fonts" })).toBeInTheDocument();
    await fromSubmenu("Font", "Show Colors");
    expect(await screen.findByRole("region", { name: "Colors" })).toBeInTheDocument();
  });

  it("holds the document from Format > Prevent Editing, and lets it go", async () => {
    const user = userEvent.setup();
    render(<Application />);
    await pick(user, "Format", "Prevent Editing");
    expect(editor()).toHaveAttribute("aria-readonly", "true");
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    expect(await screen.findByRole("menuitem", { name: "Font" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(await screen.findByRole("menuitem", { name: /^Allow Editing/ }));
    await waitFor(() => expect(editor()).not.toHaveAttribute("aria-readonly"));
  });

  it("has no ruler menu while the document is held", async () => {
    const user = userEvent.setup();
    render(<Application />);
    fireEvent.contextMenu(screen.getByLabelText("Ruler"));
    expect(await screen.findByRole("menuitem", { name: "Left Tab Stop" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("menuitem", { name: "Left Tab Stop" })).toBeNull(),
    );

    await pick(user, "Format", "Prevent Editing");
    fireEvent.contextMenu(screen.getByLabelText("Ruler"));
    await act(() => new Promise((done) => setTimeout(done, 50)));
    expect(screen.queryByRole("menuitem", { name: "Left Tab Stop" })).toBeNull();
  });

  it("breaks words from Format > Allow Hyphenation, plain text too", async () => {
    const user = userEvent.setup();
    render(<Application />);
    await pick(user, "Format", "Allow Hyphenation");
    expect(editor().style.hyphens).toBe("auto");
    await pick(user, "Format", "Make Plain Text");
    await user.click(await screen.findByRole("button", { name: "OK" }));
    await waitFor(() => expect(editor().tagName).toBe("TEXTAREA"));
    expect(editor().style.hyphens).toBe("auto");
    await pick(user, "Format", "Disallow Hyphenation");
    expect(editor().style.hyphens).toBe("");
  });

  it("dims the Font and Text menus for plain text", async () => {
    const user = userEvent.setup();
    render(<Application />);
    await pick(user, "Format", "Make Plain Text");
    await user.click(await screen.findByRole("button", { name: "OK" }));
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    expect(await screen.findByRole("menuitem", { name: "Font" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Text" })).toHaveAttribute("aria-disabled", "true");
  });
});

describe("the Format menu's keys and the panels", () => {
  it("toggles bold, italic and underline with Command-B, I and U on the selection", () => {
    const commands = recordCommands();
    render(<TextEdit />);
    selectParagraphs(0);
    command("b");
    command("i");
    command("u");
    // Again: the style goes off, since the bar shows it on.
    command("b");
    expect(commands).toEqual([
      ["bold", undefined, true],
      ["italic", undefined, true],
      ["underline", undefined, true],
      ["bold", undefined, true],
    ]);
    expect(button("Bold")).toHaveAttribute("aria-pressed", "false");
    expect(button("Italic")).toHaveAttribute("aria-pressed", "true");
    expect(frame("512 Pixels — Edited")).toBeInTheDocument();
  });

  it("makes the text bigger and smaller by a point, and aligns it from the keyboard", () => {
    const commands = recordCommands();
    render(<TextEdit />);
    write("One", "Two");
    selectParagraphs(1);
    command("=");
    command("-");
    // jsdom does not size the text, so each command acts on the 12 pt the bar still shows: the
    // sizes themselves are read in the browsers (textedit.browser.test.tsx).
    expect(commands.filter(([name]) => name === "fontSize")).toHaveLength(2);
    expect(commands.every(([, , inDocument]) => inDocument)).toBe(true);
    command("|", true);
    expect(paragraphs()[1]?.style.textAlign).toBe("center");
    command("}", true);
    expect(paragraphs()[1]?.style.textAlign).toBe("right");
    command("{", true);
    expect(paragraphs()[1]?.style.textAlign).toBe("");
    expect(paragraphs()[0]?.style.textAlign).toBe("");
  });

  it("opens the Fonts panel with Command-T and applies what is chosen there", () => {
    // The browser's fontName command gives the paragraph the family.
    const commands = recordCommands((name, value) => {
      const paragraph = paragraphs()[0];
      if (name === "fontName" && paragraph) paragraph.style.fontFamily = value;
    });
    render(<TextEdit />);
    selectParagraphs(0);
    command("t");
    const fonts = screen.getByRole("region", { name: "Fonts" });
    const row = (list: string, name: string) =>
      [
        ...within(fonts)
          .getByRole("listbox", { name: list })
          .querySelectorAll<HTMLElement>("[role=option]"),
      ].find((option) => option.textContent === name) as HTMLElement;
    // The panel shows the format where the insertion point is.
    expect(row("Family", "Helvetica")).toHaveAttribute("aria-selected", "true");
    expect(row("Size", "12")).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(row("Family", "Futura"));
    fireEvent.mouseDown(row("Typeface", "Bold Italic"));
    fireEvent.change(within(fonts).getByLabelText("Text color"), {
      target: { value: "#0000ff" },
    });
    expect(commands).toEqual([
      ["fontName", "Futura, 'Century Gothic', sans-serif", true],
      ["bold", undefined, true],
      ["italic", undefined, true],
      ["foreColor", "#0000ff", true],
    ]);
    // The format bar follows.
    expect(popUp("Font family")).toHaveTextContent("Futura");
    expect(popUp("Typeface")).toHaveTextContent("Bold Oblique");
    // Command-T again closes it.
    command("t");
    expect(screen.queryByRole("region", { name: "Fonts" })).toBeNull();
  });

  it("strikes the selection through from the Fonts panel, and closes the panel", async () => {
    const user = userEvent.setup();
    const commands = recordCommands();
    render(<TextEdit />);
    selectParagraphs(0);
    command("t");
    const fonts = screen.getByRole("region", { name: "Fonts" });
    await user.click(within(fonts).getByRole("combobox", { name: "Text strikethrough" }));
    await user.click(await screen.findByRole("option", { name: "Single" }));
    expect(commands).toEqual([["strikeThrough", undefined, true]]);
    expect(within(fonts).getByRole("combobox", { name: "Text strikethrough" })).toHaveTextContent(
      "Single",
    );
    await user.click(within(fonts).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Fonts" })).toBeNull();
  });

  it("opens the Colors panel with Shift-Command-C and colours the selection", async () => {
    const user = userEvent.setup();
    const commands = recordCommands();
    render(<TextEdit />);
    selectParagraphs(0);
    command("C", true);
    const colors = screen.getByRole("region", { name: "Colors" });
    await user.click(within(colors).getByRole("tab", { name: "Color Palettes" }));
    await user.click(within(colors).getByRole("radio", { name: "Orange" }));
    expect(commands.at(-1)?.[0]).toBe("foreColor");
    expect(commands.at(-1)?.[2]).toBe(true);
  });

  it("leaves a plain text document unstyled, in Menlo 11", () => {
    const commands = recordCommands();
    render(<TextEdit defaultDocument={{ name: "Notes.txt", format: "plain", lines: ["x"] }} />);
    expect(editor().tagName).toBe("TEXTAREA");
    expect(editor().style.font).toMatch(/^11px \/ 14px Menlo/);
    command("b");
    command("t");
    expect(commands).toEqual([]);
    expect(screen.queryByRole("region", { name: "Fonts" })).toBeNull();
  });
});

describe("the files", () => {
  it("makes a new folder in the folder shown, under a name no file there has", () => {
    const once = withFolder(defaultPlaces, "documents", ["desktop-stacks"]);
    const twice = withFolder(once, "documents", ["desktop-stacks"]);
    const documents = twice.find((place) => place.id === "documents");
    const added = listFolder(documents, ["desktop-stacks"]).filter(
      (entry) => entry.kind === "folder",
    );
    expect(added.map((entry) => entry.name)).toEqual(["untitled folder", "untitled folder 2"]);
    expect(new Set(added.map((entry) => entry.id)).size).toBe(2);
    // Other places and the folder's other files are untouched.
    expect(twice.filter((place, index) => place !== defaultPlaces[index])).toEqual([documents]);
    expect(listFolder(documents, ["desktop-stacks"])).toHaveLength(4);
  });

  it("reads a view's lines however the browser kept them", () => {
    const view = document.createElement("div");
    view.innerHTML = "bare<div>in a <b>div</b></div><div><br></div><p>last line</p>";
    expect(readLines(view)).toEqual(["bare", "in a div", "", "last line"]);
    // Reading does not rearrange the content: only a format change wraps bare text.
    expect(view.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(paragraphsOf(view, null)).toEqual([]);
  });

  it("reads a block with nothing in it as an empty line", () => {
    const view = document.createElement("div");
    view.innerHTML = "<div>A</div><div></div><div>B</div>";
    expect(readLines(view)).toEqual(["A", "", "B"]);
    view.innerHTML = "<div><div>A</div></div>";
    expect(readLines(view)).toEqual(["A"]);
  });

  it("keeps a range on its characters when it wraps bare text into a paragraph", () => {
    const view = document.createElement("div");
    view.innerHTML = "bare text<div>second</div>";
    const bare = view.firstChild as Text;
    const range = document.createRange();
    range.setStart(bare, 2);
    range.setEnd(bare, 6);
    const paragraphs = paragraphsOf(view, range);
    expect(paragraphs.map((each) => each.textContent)).toEqual(["bare text"]);
    expect(range.startContainer).toBe(bare);
    expect(range.toString()).toBe("re t");

    // Select All names the view itself: both paragraphs, once the first is wrapped.
    view.innerHTML = "bare text<div>second</div>";
    range.selectNodeContents(view);
    expect(paragraphsOf(view, range).map((each) => each.textContent)).toEqual([
      "bare text",
      "second",
    ]);
    expect(range.toString()).toBe("bare textsecond");

    // An insertion point in the view, between the bare text and the next paragraph, stays there.
    view.innerHTML = "bare text<div>second</div>";
    range.setStart(view, 1);
    range.collapse(true);
    expect(paragraphsOf(view, range).map((each) => each.textContent)).toEqual(["second"]);
    expect(range.collapsed).toBe(true);
    expect(range.startContainer).toBe(view);
    expect(range.startOffset).toBe(1);
  });
});
