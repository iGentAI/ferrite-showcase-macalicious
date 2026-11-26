import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuItem } from "macalicious/menu-item";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultNotes } from "./notes-data";

// A test that re-imports TextEdit or Stickies after `vi.resetModules` transforms that whole app again:
// 2.6 s on an idle machine, past the default 5 s on a loaded one.
vi.setConfig({ testTimeout: 30_000 });

/*
 * The editors' Edit menu (`notes-edit-menu.tsx`) as the desktop's menu bar shows it: filled from
 * the items each window registers (`desktop-app-menus.ts`), as `desktop-menus.tsx` fills it.
 * jsdom has no editing commands, so the browser's are recorded with where the selection was; and
 * no clipboard, so one is stood in for, as each browser answers a page that asks to read it. Each
 * test loads the modules afresh: a page remembers a refused clipboard for the rest of its life.
 */

/** The browser's editing commands, recorded: name, value, and whether they acted on `field`. */
function recordCommands(field: () => HTMLElement) {
  const commands: [string, string | undefined, boolean][] = [];
  document.execCommand = (name: string, _ui?: boolean, value?: string) => {
    if (name !== "styleWithCSS") {
      const anchor = document.getSelection()?.anchorNode ?? null;
      const there =
        document.activeElement === field() || (anchor !== null && field().contains(anchor));
      commands.push([name, value, there]);
    }
    return true;
  };
  return commands;
}

/** A clipboard that answers `read` (and `readText`) as given, in place of the one user-event sets. */
function stubClipboard(read: () => Promise<unknown>, text = "Plain words") {
  const clipboard = { read: vi.fn(read), readText: vi.fn(async () => text) };
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
  return clipboard;
}
/** One item of the clipboard, with its text for each type. */
const clipItem = (types: Record<string, string>) => ({
  types: Object.keys(types),
  getType: async (type: string) => ({ text: async () => types[type] ?? "" }),
});

/** Select the text node of `field` that holds `word`, the field focused, as a drag would. */
function selectWord(field: HTMLElement, word: string) {
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const at = node.nodeValue?.indexOf(word) ?? -1;
    if (at < 0) continue;
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + word.length);
    field.focus();
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    // jsdom does not report it: the browser would.
    document.dispatchEvent(new Event("selectionchange"));
    return;
  }
  throw new Error(`no ${word} in the text`);
}

/** The desktop's menu `title` of the application `app`, filled from the registry of `registry`. */
function desktopMenu(
  registry: typeof import("../desktop/desktop-app-menus"),
  app: string,
  title: string,
) {
  return function DesktopMenu() {
    const items = registry.useDesktopAppMenuItems(app, title);
    return (
      <MenuBar modal={false} aria-label={`Desktop ${title} menu`}>
        <MenuBarMenu title={title}>
          {items ?? <MenuItem disabled>This demo has no {title} commands</MenuItem>}
        </MenuBarMenu>
      </MenuBar>
    );
  };
}

const item = (name: string) =>
  screen.findByRole("menuitem", { name: new RegExp(`^${name}(?! and (Match|Retain) Style)`) });
const dimmed = async (name: string) => (await item(name)).getAttribute("aria-disabled") === "true";

afterEach(() => {
  delete (document as Partial<Document>).execCommand;
  delete (navigator as { clipboard?: unknown }).clipboard;
  delete (navigator as { permissions?: unknown }).permissions;
});

describe("Notes' Edit menu in the desktop menu bar", () => {
  const setup = () => userEvent.setup({ pointerEventsCheck: 0 });
  /** The editor of the note shown (those of notes shown before stay, hidden). */
  const editor = () => {
    const shown = screen
      .getAllByRole("textbox", { name: "Note" })
      .find((each) => !each.closest("[hidden]"));
    if (!shown) throw new Error("no note shown");
    return shown;
  };
  const load = async () => {
    vi.resetModules();
    const { Notes } = await import("./notes");
    const registry = await import("../desktop/desktop-app-menus");
    return { Notes, Edit: desktopMenu(registry, "notes", "Edit") };
  };
  const openEdit = (user: ReturnType<typeof setup>) =>
    user.click(screen.getByRole("menuitem", { name: "Edit" }));

  it("runs Copy, Cut, Undo and Redo on the note's selection, and Select All selects the whole note", async () => {
    const user = setup();
    const { Notes, Edit } = await load();
    render(
      <>
        <Notes />
        <Edit />
      </>,
    );
    selectWord(editor(), "Gallery");
    const commands = recordCommands(editor);
    for (const [name, command] of [
      ["Copy", "copy"],
      ["Cut", "cut"],
      ["Undo", "undo"],
      ["Redo", "redo"],
    ] as const) {
      await openEdit(user);
      expect(await dimmed(name)).toBe(false);
      await user.click(await item(name));
      expect(commands.at(-1)).toEqual([command, undefined, true]);
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    }
    await waitFor(() => expect(editor()).toHaveFocus());

    await openEdit(user);
    await user.click(await item("Select All"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await waitFor(() => expect(editor()).toHaveFocus());
    expect(document.getSelection()?.toString()).toBe(editor().textContent);
  });

  it("dims Cut and Copy with nothing selected, and every change for a locked note", async () => {
    const user = setup();
    const { Notes, Edit } = await load();
    const view = render(
      <>
        <Notes />
        <Edit />
      </>,
    );
    selectWord(editor(), "Gallery");
    document.getSelection()?.collapseToEnd();
    document.dispatchEvent(new Event("selectionchange"));
    await openEdit(user);
    expect(await dimmed("Cut")).toBe(true);
    expect(await dimmed("Copy")).toBe(true);
    for (const name of ["Undo", "Redo", "Paste", "Select All"])
      expect(await dimmed(name)).toBe(false);
    await user.keyboard("{Escape}");
    view.unmount();

    // A locked note that isn't open: no text to reach, so every row is dimmed.
    const { lines: _lines, ...plain } = defaultNotes[1] as (typeof defaultNotes)[number];
    const locked = {
      ...plain,
      lines: [],
      locked: true,
      sealed: {
        rev: 1,
        kdf: { name: "PBKDF2-SHA-256", iterations: 100_000, salt: "c2FsdHNhbHRzYWx0c2FsdA==" },
        iv: "aXZpdml2aXZpdml2",
        ciphertext: "Y2lwaGVy",
      },
    };
    render(
      <>
        <Notes defaultNotes={[locked]} />
        <Edit />
      </>,
    );
    await openEdit(user);
    for (const name of ["Undo", "Redo", "Cut", "Paste", "Copy", "Select All"])
      expect(await dimmed(name)).toBe(true);
  });

  it("pastes the clipboard's formatted text, rebuilt, where the selection was, and closes the menu", async () => {
    const user = setup();
    const { Notes, Edit } = await load();
    render(
      <>
        <Notes />
        <Edit />
      </>,
    );
    const clipboard = stubClipboard(async () => [
      clipItem({
        "text/html": '<b>Pasted</b><img src="x" onerror="alert(1)"><script>alert(2)</script>',
        "text/plain": "Pasted",
      }),
    ]);
    selectWord(editor(), "Gallery");
    const commands = recordCommands(editor);
    await openEdit(user);
    await user.click(await item("Paste"));
    await waitFor(() => expect(commands.some(([name]) => name === "insertHTML")).toBe(true));
    const [, html, inNote] = commands.find(([name]) => name === "insertHTML") ?? [];
    expect(html).toContain("<b>Pasted</b>");
    expect(html).not.toMatch(/img|script|onerror/);
    expect(inNote).toBe(true);
    expect(clipboard.read).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(editor()).toHaveFocus();
  });

  it("dims Paste with the reason when the browser refuses the clipboard, in the menu still open", async () => {
    const user = setup();
    const { Notes, Edit } = await load();
    render(
      <>
        <Notes />
        <Edit />
      </>,
    );
    stubClipboard(async () => {
      throw new DOMException("Read permission denied.", "NotAllowedError");
    });
    selectWord(editor(), "Gallery");
    const commands = recordCommands(editor);
    await openEdit(user);
    await user.click(await item("Paste"));
    await waitFor(async () => expect(await dimmed("Paste")).toBe(true));
    expect(await item("This browser keeps the clipboard from menus")).toHaveTextContent(
      /(⌘V|Ctrl\+V) still pastes/,
    );
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(commands.filter(([name]) => name.startsWith("insert"))).toEqual([]);

    // Opened again, Paste stays dimmed with its reason for the rest of the page's life.
    await user.keyboard("{Escape}");
    await openEdit(user);
    expect(await dimmed("Paste")).toBe(true);
    expect(await item("This browser keeps the clipboard from menus")).toBeInTheDocument();
  });

  it("dims Paste from the start where the browser says reading the clipboard is denied", async () => {
    const user = setup();
    const { Notes, Edit } = await load();
    render(
      <>
        <Notes />
        <Edit />
      </>,
    );
    stubClipboard(async () => []);
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn(async () => ({ state: "denied", addEventListener() {} })) },
      configurable: true,
    });
    await openEdit(user);
    await waitFor(async () => expect(await dimmed("Paste")).toBe(true));
    expect(await item("This browser keeps the clipboard from menus")).toBeInTheDocument();
  });

  it("inserts nothing when another note is shown while the clipboard is read", async () => {
    const user = setup();
    const { Notes, Edit } = await load();
    render(
      <>
        <Notes />
        <Edit />
      </>,
    );
    let answer: (items: unknown) => void = () => {};
    stubClipboard(() => new Promise((resolve) => (answer = resolve)));
    selectWord(editor(), "Gallery");
    const commands = recordCommands(editor);
    await openEdit(user);
    await user.click(await item("Paste"));
    // The person leaves the menu and shows another note before the browser answers.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    const rows = screen.getByRole("listbox", { name: "Notes" });
    const other = [...rows.querySelectorAll('[role="option"]')].find((row) =>
      row.textContent?.startsWith("All computers should be orange"),
    );
    await user.click(other as HTMLElement);
    answer([clipItem({ "text/plain": "Late" })]);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(commands.filter(([name]) => name.startsWith("insert"))).toEqual([]);
  });
});

describe("a paste the browser answers late", () => {
  /** One text element that shows `shown.document`, and a clipboard that answers when told. */
  const page = async () => {
    vi.resetModules();
    const { EditorEditItems, EditorMoreItems } = await import("./notes-edit-menu");
    const shown = { document: "first" };
    const restore = vi.fn(() => screen.getByTestId("text").focus());
    const target = () => ({
      element: screen.getByTestId("text"),
      restore,
      editable: true,
      rich: false,
      document: shown.document,
    });
    render(
      <>
        <div data-testid="text" contentEditable suppressContentEditableWarning>
          plum and pear
        </div>
        <MenuBar modal={false} aria-label="Edit menu">
          <MenuBarMenu title="Edit">
            <EditorEditItems target={target} />
            <EditorMoreItems
              target={target}
              find={() => {
                throw new Error("no Find here");
              }}
            />
          </MenuBarMenu>
        </MenuBar>
      </>,
    );
    let answer: (text: string) => void = () => {};
    Object.defineProperty(navigator, "clipboard", {
      value: { readText: () => new Promise((resolve) => (answer = resolve)) },
      configurable: true,
    });
    const commands = recordCommands(() => screen.getByTestId("text"));
    const inserts = () => commands.filter(([name]) => name === "insertText");
    return { shown, restore, inserts, answer: (text: string) => answer(text) };
  };
  const user = () => userEvent.setup({ pointerEventsCheck: 0 });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

  it.each([
    ["Paste", /^Paste(?! and (Match|Retain) Style)/],
    ["Paste and Match Style", /^Paste and Match Style/],
  ])("%s goes into the document it was chosen for, and no other", async (_, name) => {
    const actor = user();
    const { shown, restore, inserts, answer } = await page();
    await actor.click(screen.getByRole("menuitem", { name: "Edit" }));
    await actor.click(await screen.findByRole("menuitem", { name }));
    answer("Late");
    await waitFor(() => expect(inserts()).toEqual([["insertText", "Late", true]]));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await settle();

    restore.mockClear();
    const late = inserts().length;
    await actor.click(screen.getByRole("menuitem", { name: "Edit" }));
    await actor.click(await screen.findByRole("menuitem", { name }));
    shown.document = "second";
    answer("Late again");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await settle();
    expect(inserts()).toHaveLength(late);
    expect(restore).not.toHaveBeenCalled();
  });

  it("dims Paste and Match Style as well once the browser refuses the clipboard", async () => {
    const actor = user();
    vi.resetModules();
    const { EditorEditItems, EditorMoreItems } = await import("./notes-edit-menu");
    const target = () => ({
      element: screen.getByTestId("text"),
      restore: () => undefined,
      editable: true,
      rich: false,
    });
    render(
      <>
        <div data-testid="text" contentEditable suppressContentEditableWarning>
          plum
        </div>
        <MenuBar modal={false} aria-label="Edit menu">
          <MenuBarMenu title="Edit">
            <EditorEditItems target={target} />
            <EditorMoreItems
              target={target}
              find={() => {
                throw new Error("no Find here");
              }}
            />
          </MenuBarMenu>
        </MenuBar>
      </>,
    );
    Object.defineProperty(navigator, "clipboard", {
      value: { readText: () => Promise.reject(new Error("refused")) },
      configurable: true,
    });
    await actor.click(screen.getByRole("menuitem", { name: "Edit" }));
    await actor.click(await screen.findByRole("menuitem", { name: /^Paste and Match Style/ }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await actor.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await screen.findByRole("menuitem", { name: /^Paste and Match Style/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(await dimmed("Paste")).toBe(true);
  });
});

describe("Look Up and Speech once a menu took the selection", () => {
  it("read only what is inside the text when the selection runs out of it", async () => {
    const { selectedText } = await import("./notes-edit-menu");
    const { container } = render(
      <div>
        <p data-testid="text">inside</p>
        <p>outside</p>
      </div>,
    );
    const [text, other] = container.querySelectorAll("p");
    const range = document.createRange();
    range.setStart((text as Element).firstChild as Text, 2);
    range.setEnd((other as Element).firstChild as Text, 3);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    expect(selectedText(text as HTMLElement)).toBe("side");
    expect(selectedText(other as HTMLElement)).toBe("");
  });

  it("take the selection back first, and read that text", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    vi.resetModules();
    const { EditorMoreItems } = await import("./notes-edit-menu");
    const { LOOK_UP_EVENT } = await import("../dictionary/dictionary-desktop");
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(readonly text: string) {}
      },
    );
    render(
      <>
        <div data-testid="text" contentEditable suppressContentEditableWarning>
          plum and pear
        </div>
        <MenuBar modal={false} aria-label="Edit menu">
          <MenuBarMenu title="Edit">
            <EditorMoreItems
              target={() => ({
                element: screen.getByTestId("text"),
                restore: () => selectWord(screen.getByTestId("text"), "pear"),
                editable: true,
                rich: true,
              })}
              find={() => {
                throw new Error("no Find here");
              }}
            />
          </MenuBarMenu>
        </MenuBar>
      </>,
    );
    selectWord(screen.getByTestId("text"), "pear");
    const words: string[] = [];
    const heard = (event: Event) => words.push((event as CustomEvent).detail.word);
    window.addEventListener(LOOK_UP_EVENT, heard);
    const openWithoutSelection = async () => {
      document.getSelection()?.removeAllRanges();
      await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    };

    await openWithoutSelection();
    await user.click(await item("Look Up"));
    expect(words).toEqual(["pear"]);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    await openWithoutSelection();
    await user.hover(await item("Speech"));
    fireEvent.click(await item("Start Speaking"));
    expect(speak.mock.calls[0]?.[0]).toMatchObject({ text: "pear" });

    window.removeEventListener(LOOK_UP_EVENT, heard);
    vi.unstubAllGlobals();
  });
});

describe("TextEdit's and Stickies' Edit menus in the desktop menu bar", () => {
  const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

  it("copies TextEdit's selection, and pastes text alone into a plain text document", async () => {
    const user = setup();
    vi.resetModules();
    const { TextEdit } = await import("../textedit/textedit");
    const registry = await import("../desktop/desktop-app-menus");
    const Edit = desktopMenu(registry, "textedit", "Edit");
    const Format = desktopMenu(registry, "textedit", "Format");
    render(
      <>
        <TextEdit />
        <Edit />
        <Format />
      </>,
    );
    const documentView = () => screen.getByRole("textbox", { name: "Document" });
    const line = document.createElement("div");
    line.textContent = "Sedgewick on a line";
    documentView().append(line);
    selectWord(documentView(), "Sedgewick");
    const commands = recordCommands(documentView);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(await item("Copy"));
    expect(commands.at(-1)).toEqual(["copy", undefined, true]);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    // A plain text document takes the clipboard's text alone.
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await user.click(await item("Make Plain Text"));
    await user.click(await screen.findByRole("button", { name: "OK" }));
    await waitFor(() => expect(documentView().tagName).toBe("TEXTAREA"));
    const clipboard = stubClipboard(async () => [clipItem({ "text/html": "<b>Bold</b>" })]);
    const area = documentView() as HTMLTextAreaElement;
    area.focus();
    area.setSelectionRange(0, 0);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(await item("Paste"));
    await waitFor(() => expect(commands.at(-1)).toEqual(["insertText", "Plain words", true]));
    expect(clipboard.readText).toHaveBeenCalledTimes(1);
    expect(clipboard.read).not.toHaveBeenCalled();
  });

  it("cuts a sticky's selection", async () => {
    const user = setup();
    vi.resetModules();
    const { StickiesNote } = await import("../stickies/stickies");
    const registry = await import("../desktop/desktop-app-menus");
    const Edit = desktopMenu(registry, "stickies", "Edit");
    render(
      <>
        <StickiesNote defaultText={"Groceries\nmilk and bread"} />
        <Edit />
      </>,
    );
    const text = () => screen.getByRole("textbox");
    selectWord(text(), "milk");
    const commands = recordCommands(text);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(await item("Cut"));
    expect(commands.at(-1)).toEqual(["cut", undefined, true]);
    await waitFor(() => expect(text()).toHaveFocus());
  });
});
