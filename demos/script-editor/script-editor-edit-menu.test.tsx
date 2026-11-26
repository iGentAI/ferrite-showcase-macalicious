import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { ScriptEditor } from "./script-editor";

/*
 * Script Editor's editor on the editors' shared path: the desktop's Edit menu (`EditorEditItems`,
 * as Notes, TextEdit, Stickies and Mail have it) acts on the script. jsdom has no editing
 * commands: the browser's commands are recorded. e2e/script-editor-edit-journey.mjs runs them in
 * the three engines on the served desktop.
 */

const scriptView = () => screen.getByRole("textbox", { name: "Script" });
const item = (name: string) =>
  screen.findByRole("menuitem", { name: new RegExp(`^${name}(?! and Match Style| Reply)`) });

/** The browser's editing commands, with their value and whether they acted in the script. */
function recordCommands() {
  const commands: [string, string | undefined, boolean][] = [];
  document.execCommand = (name: string, _ui?: boolean, value?: string) => {
    if (name !== "styleWithCSS") {
      const anchor = document.getSelection()?.anchorNode ?? null;
      commands.push([name, value, anchor !== null && scriptView().contains(anchor)]);
    }
    return true;
  };
  return commands;
}

/** Select the script's first word, the script focused, as a drag would. */
function selectFirstWord() {
  const root = scriptView();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const match = /[A-Za-z]{3,}/.exec(node.nodeValue ?? "");
    if (!match) continue;
    root.focus();
    const range = document.createRange();
    range.setStart(node, match.index);
    range.setEnd(node, match.index + match[0].length);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    return match[0];
  }
  throw new Error("no word in the script");
}

function EditMenu() {
  const items = useDesktopAppMenuItems("script-editor", "Edit");
  return (
    <MenuBar aria-label="Menus">
      <MenuBarMenu title="Edit">{items}</MenuBarMenu>
    </MenuBar>
  );
}

afterEach(() => {
  delete (document as Partial<Document>).execCommand;
  delete (navigator as { clipboard?: unknown }).clipboard;
});

describe("Script Editor's Edit menu in the desktop menu bar", () => {
  const setup = () => userEvent.setup({ pointerEventsCheck: 0 });
  const openEdit = (user: ReturnType<typeof setup>) =>
    user.click(screen.getByRole("menuitem", { name: "Edit" }));

  it("opens the find bar from Command-F, counts the matches, and offers Replace from Option-Command-F", async () => {
    render(
      <>
        <EditMenu />
        <ScriptEditor />
      </>,
    );
    const view = scriptView();
    view.focus();
    fireEvent.keyDown(view, { key: "f", code: "KeyF", ctrlKey: true });
    const field = await screen.findByRole("searchbox", { name: "Find" });
    const word = view.textContent?.trim().split(/\s+/)[0] ?? "";
    fireEvent.change(field, { target: { value: word } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^1 of \d+$/));
    expect(screen.queryByRole("searchbox", { name: "Replace" })).toBeNull();
    fireEvent.keyDown(field, { key: "f", code: "KeyF", ctrlKey: true, altKey: true });
    expect(await screen.findByRole("searchbox", { name: "Replace" })).toBeInTheDocument();
  });

  it("has the Find, Transformations and Speech rows on the script", async () => {
    const user = setup();
    render(
      <>
        <EditMenu />
        <ScriptEditor />
      </>,
    );
    selectFirstWord();
    await openEdit(user);
    for (const name of ["Delete", "Find", "Transformations", "Speech"]) {
      expect(await item(name)).toBeInTheDocument();
    }
    expect(
      await screen.findByRole("menuitem", { name: /^Paste and Match Style/ }),
    ).toBeInTheDocument();
  });

  it("prints only the script's text from Command-P, with no server", () => {
    render(<ScriptEditor />);
    const text = scriptView().textContent ?? "";
    fireEvent.keyDown(scriptView(), { key: "p", code: "KeyP", ctrlKey: true });
    const frame = document.querySelector<HTMLIFrameElement>("iframe[data-textedit-print]");
    expect(frame?.srcdoc).toContain(text.trim().split(/\s+/)[0]);
    frame?.remove();
  });

  it("puts a tab in the script for Tab, and leaves Shift-Tab to the keyboard's order", () => {
    render(<ScriptEditor />);
    const commands = recordCommands();
    selectFirstWord();
    expect(fireEvent.keyDown(scriptView(), { key: "Tab" })).toBe(false);
    expect(commands).toEqual([["insertText", "\t", true]]);
    expect(fireEvent.keyDown(scriptView(), { key: "Tab", shiftKey: true })).toBe(true);
    expect(commands).toHaveLength(1);
  });

  it("runs Copy, Cut, Undo and Redo on the script's selection, and Select All selects the whole script", async () => {
    const user = setup();
    render(
      <>
        <EditMenu />
        <ScriptEditor />
      </>,
    );
    selectFirstWord();
    const commands = recordCommands();
    for (const [name, command] of [
      ["Copy", "copy"],
      ["Cut", "cut"],
      ["Undo", "undo"],
      ["Redo", "redo"],
    ] as const) {
      await openEdit(user);
      const entry = await item(name);
      expect(entry).not.toHaveAttribute("aria-disabled", "true");
      await user.click(entry);
      expect(commands.at(-1)).toEqual([command, undefined, true]);
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    }
    await openEdit(user);
    await user.click(await item("Select All"));
    await waitFor(() => expect(scriptView()).toHaveFocus());
    expect(document.getSelection()?.toString()).toBe(scriptView().textContent);
  });

  it("pastes the clipboard's formats into the script, without what would run", async () => {
    const user = setup();
    render(
      <>
        <EditMenu />
        <ScriptEditor />
      </>,
    );
    Object.defineProperty(navigator, "clipboard", {
      value: {
        read: vi.fn(async () => [
          {
            types: ["text/html", "text/plain"],
            getType: async (type: string) => ({
              text: async () =>
                type === "text/html" ? '<b>pasted</b><img src="x" onerror="alert(1)">' : "pasted",
            }),
          },
        ]),
        readText: vi.fn(async () => "pasted"),
      },
      configurable: true,
    });
    selectFirstWord();
    const commands = recordCommands();
    await openEdit(user);
    await user.click(await item("Paste"));
    await waitFor(() =>
      expect(commands.filter(([, value]) => value?.includes("pasted"))).toEqual([
        ["insertHTML", "<b>pasted</b>", true],
      ]),
    );
  });
});
