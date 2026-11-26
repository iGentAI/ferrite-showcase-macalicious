import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { type DesktopDrag, landingAt } from "../desktop/desktop-drag";
import { onDesktopEffects } from "../desktop/desktop-effects";
import { takeHelpRequest } from "../desktop/desktop-help";
import {
  beginDesktopValues,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { registerFileReceivers, takeSharedFiles } from "../desktop/desktop-share-link";
import { appsForFile, registerFileOpeners, requestOpenFile } from "../finder/finder-open";
import { scriptEditorApp } from "./app";
import { ScriptEditor } from "./script-editor";
import type { ScriptEditorServer } from "./script-editor-server";

/*
 * The rows of Edit, Font, Format, File and Help that act through the desktop's shared tools, Finder's
 * requests and the drops. A server in memory stands in for the desktop's (`server` prop) and the
 * browser's editing commands are recorded: e2e/script-editor-census-journey.mjs runs them on the
 * served desktop.
 */

const server: ScriptEditorServer = {
  exportCopy: async (name) => ({ id: "e", name }),
  exportBundle: async (name) => ({ id: "b", name: `${name}.scptd` }),
  run: async () => ({ result: "1", failed: false, log: ["first line", "second line"] }),
  dictionary: async () => ({ actions: [], globals: [] }),
  scripts: async () => [],
  open: async (id) => `return "${id}";`,
  save: async (name) => ({ id: "s", path: `Documents/Scripts/${name}.js` }),
  fileHolding: async (id) => ({ id, name: `${id}.js`, version: 1 }),
  write: async (file) => file,
  rename: async (file) => file,
  move: async (file) => file,
  folders: async () => [],
  scriptsFolder: async () => "scripts",
};

const MENUS = ["File", "Edit", "Font", "Format", "Help"] as const;

function Menus() {
  const file = useDesktopAppMenuItems("script-editor", "File");
  const edit = useDesktopAppMenuItems("script-editor", "Edit");
  const font = useDesktopAppMenuItems("script-editor", "Font");
  const format = useDesktopAppMenuItems("script-editor", "Format");
  const help = useDesktopAppMenuItems("script-editor", "Help");
  const items = { File: file, Edit: edit, Font: font, Format: format, Help: help };
  return (
    <MenuBar modal={false} aria-label="Menus">
      {MENUS.map((title) => (
        <MenuBarMenu key={title} title={title}>
          {items[title]}
        </MenuBarMenu>
      ))}
    </MenuBar>
  );
}

function show() {
  render(
    <>
      <Menus />
      <ScriptEditor
        server={server}
        defaultLanguage="JavaScript"
        defaultSource="return 1;"
        title="Untitled"
      />
    </>,
  );
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });
const scriptView = () => screen.getByRole("textbox", { name: "Script" });
const isDimmed = (item: Element) => item.getAttribute("aria-disabled") === "true";
const rowNow = (name: string) => {
  const pattern = new RegExp(`^${name}`);
  return ["menuitem", "menuitemcheckbox", "menuitemradio"]
    .flatMap((role) => screen.queryAllByRole(role, { name: pattern }))
    .at(0);
};
const row = (name: string) =>
  waitFor(() => {
    const entry = rowNow(name);
    if (!entry) throw new Error(`no row named ${name}`);
    return entry;
  });

/**
 * Waits for the menu just opened to take the keyboard, as a person's next key does: Base UI moves
 * focus into a popup a moment after it opens, and a key pressed before that makes the whole menu
 * close. `trigger` is the row whose submenu is opening, which holds focus until then.
 */
const menuHasKeyboard = (trigger?: Element) =>
  waitFor(() => {
    const at = document.activeElement;
    if (at === trigger || !at?.closest('[role="menu"]'))
      throw new Error("no menu has the keyboard");
  });

/** Opens the menu bar's `menu` and the submenus of `trail`; answers the last row of the trail. */
async function reach(user: ReturnType<typeof setup>, menu: string, ...trail: string[]) {
  await user.click(screen.getByRole("menuitem", { name: menu }));
  await menuHasKeyboard();
  let entry = await row(trail[0] ?? "");
  for (const name of trail.slice(1)) {
    const trigger = entry;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    await menuHasKeyboard(trigger);
    entry = await row(name);
  }
  return entry;
}

const closedMenus = () => waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

function selectFirstWord(view = scriptView()) {
  const walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const match = /[A-Za-z]{3,}/.exec(node.nodeValue ?? "");
    if (!match) continue;
    view.focus();
    const range = document.createRange();
    range.setStart(node, match.index);
    range.setEnd(node, match.index + match[0].length);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    return match[0];
  }
  throw new Error("no word in the view");
}

/** The browser's editing commands, with their value. */
function recordCommands() {
  const commands: [string, string | undefined][] = [];
  document.execCommand = (name: string, _ui?: boolean, value?: string) => {
    if (name !== "styleWithCSS") commands.push([name, value]);
    return true;
  };
  return commands;
}

const dragOf = (
  ...items: { id: string; name: string; kind?: "file" | "folder"; bytes?: () => Promise<Blob> }[]
): DesktopDrag => ({
  from: "finder",
  copy: false,
  items: items.map((item) => ({ kind: "file", ...item })),
});

beforeEach(() => {
  forgetDesktopValues();
  beginDesktopValues();
});
afterEach(() => {
  delete (document as Partial<Document>).execCommand;
  delete (navigator as { clipboard?: unknown }).clipboard;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("opening a script from Finder", () => {
  let forget = () => {};
  beforeAll(() => {
    forget = registerFileOpeners([scriptEditorApp]);
  });
  afterAll(() => forget());

  it("says it opens .js files, and no others", () => {
    expect(appsForFile({ name: "Tidy.js" })).toEqual(["script-editor"]);
    expect(appsForFile({ name: "Tidy.JS" })).toEqual(["script-editor"]);
    expect(appsForFile({ name: "Tidy.exe" })).toEqual([]);
  });

  it("opens a script asked for before the window was there", async () => {
    requestOpenFile({ app: "script-editor", id: "f1", name: "Asked.js" });
    show();
    await waitFor(() => expect(scriptView().textContent).toBe('return "f1";'));
    expect(screen.getByRole("region", { name: "Asked" })).toBeInTheDocument();
  });

  it("opens a script asked for while the window is open, asking first over unsaved changes", async () => {
    show();
    const view = scriptView();
    view.textContent = "typed";
    fireEvent.input(view);
    act(() => requestOpenFile({ app: "script-editor", id: "f2", name: "Later.js" }));
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveTextContent("Do you want to keep the changes");
    await setup().click(within(sheet).getByRole("button", { name: "Don’t Save" }));
    await waitFor(() => expect(scriptView().textContent).toBe('return "f2";'));
  });
});

describe("dropping on the window", () => {
  it("opens a script dropped on the window, and refuses anything else", async () => {
    show();
    const bar = screen.getByRole("toolbar", { name: "Toolbar" });
    const landing = landingAt(bar, dragOf({ id: "f3", name: "Dropped.js" }));
    expect(landing?.refusal).toBeUndefined();
    act(() => landing?.drop());
    await waitFor(() => expect(scriptView().textContent).toBe('return "f3";'));
    expect(landingAt(bar, dragOf({ id: "p", name: "Picture.png" }))?.refusal).toBe(
      "Script Editor opens JavaScript scripts (.js).",
    );
  });

  it("puts the drive path of what is dropped on the script in where it was let go", async () => {
    const commands = recordCommands();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              session: "s",
              rev: 1,
              entries: [
                { id: "root", name: "Drive", kind: "folder", parent: null },
                { id: "docs", name: "Documents", kind: "folder", parent: "root" },
                { id: "p", name: "Picture.png", kind: "file", parent: "docs" },
              ],
            }),
            { headers: { "content-type": "application/json" } },
          ),
      ),
    );
    show();
    selectFirstWord();
    const landing = landingAt(
      scriptView(),
      dragOf({ id: "p", name: "Picture.png" }, { id: "gone", name: "Gone.txt" }),
    );
    expect(landing?.refusal).toBeUndefined();
    act(() => landing?.drop());
    await waitFor(() => expect(commands.length).toBe(1));
    expect(commands[0]?.[0]).toBe("insertText");
    expect(commands[0]?.[1]).toMatch(/Documents\/Picture\.png\nGone\.txt$/);
  });

  it("refuses a dragged item that is not on the drive", () => {
    show();
    const attachment = {
      id: "mail:1",
      name: "Attached.txt",
      bytes: async () => new Blob(["x"]),
    };
    expect(landingAt(scriptView(), dragOf(attachment))?.refusal).toBe(
      "Only what is on your drive has a path to put in the script.",
    );
  });
});

describe("Edit's Spelling and Substitutions", () => {
  it("shows the Spelling panel on a word the list does not hold, from the menu and from its key", async () => {
    const user = setup();
    show();
    const view = scriptView();
    view.textContent = "return zzqxv;";
    fireEvent.input(view);
    view.focus();
    await user.click(
      await reach(user, "Edit", "Spelling and Grammar", "Show Spelling and Grammar"),
    );
    const panel = await screen.findByRole("dialog", { name: "Spelling and Grammar" });
    await waitFor(() => expect(panel).toHaveTextContent("Not in the dictionary: “zzqxv”"));
    await user.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Spelling and Grammar" })).toBeNull();
    fireEvent.keyDown(view, { key: ":", code: "Semicolon", ctrlKey: true, shiftKey: true });
    expect(await screen.findByRole("dialog", { name: "Spelling and Grammar" })).toBeInTheDocument();
  });

  it("selects the next unknown word for Check Document Now", async () => {
    const user = setup();
    show();
    const view = scriptView();
    view.textContent = "return zzqxv;";
    fireEvent.input(view);
    view.focus();
    await user.click(await reach(user, "Edit", "Spelling and Grammar", "Check Document Now"));
    await waitFor(() => expect(document.getSelection()?.toString()).toBe("zzqxv"));
  });

  it("turns the browser's underlines on in both views with Check Spelling While Typing, kept with the account", async () => {
    const user = setup();
    show();
    expect(scriptView()).toHaveAttribute("spellcheck", "false");
    await user.click(
      await reach(user, "Edit", "Spelling and Grammar", "Check Spelling While Typing"),
    );
    await waitFor(() => expect(scriptView()).toHaveAttribute("spellcheck", "true"));
    expect(desktopValues()["scriptEditor.spelling"]).toBe(true);
  });

  it("makes quotes curly and dashes long in the Description only, and keeps Smart Quotes off when turned off", async () => {
    const user = setup();
    const commands = recordCommands();
    show();
    await user.click(screen.getByRole("button", { name: "Description" }));
    const description = screen.getByRole("textbox", { name: "Description" });
    const typeIn = (view: HTMLElement, text: string, data: string) => {
      view.textContent = text;
      const node = view.firstChild as Text;
      document.getSelection()?.collapse(node, text.length);
      fireEvent.input(view, { inputType: "insertText", data });
    };
    typeIn(description, 'say "', '"');
    expect(commands).toEqual([["insertText", "“"]]);
    typeIn(description, "a--", "-");
    expect(commands.at(-1)).toEqual(["insertText", "—"]);
    commands.length = 0;
    typeIn(scriptView(), 'say "', '"');
    expect(commands).toEqual([]);
    expect(scriptView()).toHaveAttribute("data-text-replacement", "off");
    expect(description).toHaveAttribute("data-text-replacement", "on");

    await user.click(await reach(user, "Edit", "Substitutions", "Smart Quotes"));
    await closedMenus();
    expect(desktopValues()["scriptEditor.substitutions"]).toMatchObject({ quotes: false });
    typeIn(screen.getByRole("textbox", { name: "Description" }), 'say "', '"');
    expect(commands).toEqual([]);
    await user.click(await reach(user, "Edit", "Substitutions", "Text Replacement"));
    await closedMenus();
    expect(screen.getByRole("textbox", { name: "Description" })).toHaveAttribute(
      "data-text-replacement",
      "off",
    );
  });

  it("shows the Substitutions panel on the Description, whose Replace All leaves the script alone", async () => {
    const user = setup();
    const commands = recordCommands();
    show();
    await user.click(screen.getByRole("button", { name: "Result" }));
    await user.click(await reach(user, "Edit", "Substitutions", "Show Substitutions"));
    const panel = await screen.findByRole("dialog", { name: "Substitutions" });
    const description = screen.getByRole("textbox", { name: "Description" });
    description.textContent = 'a "word"';
    scriptView().textContent = 'return "code";';
    await user.click(within(panel).getByRole("button", { name: "Replace All" }));
    expect(commands).toEqual([["insertText", "a “word”"]]);
    await user.click(screen.getByRole("button", { name: "Result" }));
    expect(within(panel).getByRole("button", { name: "Replace All" })).toBeDisabled();
  });
});

describe("Font's rows on the characters of the selection", () => {
  it("has every row, and Paste Style only once a style was copied", async () => {
    const user = setup();
    show();
    selectFirstWord();
    const paste = await reach(user, "Font", "Paste Style");
    expect(isDimmed(paste)).toBe(true);
    for (const name of ["Outline", "Kern", "Ligatures", "Baseline", "Copy Style"]) {
      expect(isDimmed(await row(name))).toBe(false);
    }
    await user.click(await row("Copy Style"));
    await closedMenus();
    expect(isDimmed(await reach(user, "Font", "Paste Style"))).toBe(false);
  });

  it("loosens the selected word's kerning through the browser, as a change to the document", async () => {
    const user = setup();
    const commands = recordCommands();
    show();
    selectFirstWord();
    await user.click(await reach(user, "Font", "Kern", "Loosen"));
    await closedMenus();
    expect(commands.map(([name]) => name)).toEqual(["insertHTML"]);
    expect(commands[0]?.[1]).toContain("letter-spacing");
    expect(screen.getByRole("region", { name: "Untitled" })).toBeInTheDocument();
  });

  it("copies and pastes a style from the keys", () => {
    const commands = recordCommands();
    show();
    selectFirstWord();
    fireEvent.keyDown(scriptView(), { key: "c", code: "KeyC", ctrlKey: true, altKey: true });
    selectFirstWord();
    fireEvent.keyDown(scriptView(), { key: "v", code: "KeyV", ctrlKey: true, altKey: true });
    expect(commands.map(([name]) => name)).toEqual(["insertHTML"]);
  });
});

describe("Format > Text > Writing Direction", () => {
  it("sets the lines of the selection right to left and back, and the Description keeps it", async () => {
    const user = setup();
    show();
    await user.click(screen.getByRole("button", { name: "Description" }));
    const description = screen.getByRole("textbox", { name: "Description" });
    description.innerHTML = "<div>first</div><div>second</div>";
    selectFirstWord(description);
    await user.click(await reach(user, "Format", "Text", "Writing Direction", "Right to Left"));
    await closedMenus();
    expect(description.innerHTML).toBe('<div dir="rtl">first</div><div>second</div>');

    await user.click(screen.getByRole("button", { name: "Result" }));
    await user.click(screen.getByRole("button", { name: "Description" }));
    const again = screen.getByRole("textbox", { name: "Description" });
    expect(again.innerHTML).toBe('<div dir="rtl">first</div><div>second</div>');
  });

  it("takes a line's direction away with Natural", async () => {
    const user = setup();
    show();
    await user.click(screen.getByRole("button", { name: "Description" }));
    const description = screen.getByRole("textbox", { name: "Description" });
    description.innerHTML = '<div dir="rtl">first</div><div>second</div>';
    selectFirstWord(description);
    await user.click(await reach(user, "Format", "Text", "Writing Direction", "Natural"));
    await closedMenus();
    expect(description.innerHTML).toBe("<div>first</div><div>second</div>");
  });
});

describe("File > Share and the rows a page cannot do", () => {
  it("dims Page Setup and AirDrop with what stops them", async () => {
    const user = setup();
    show();
    const setupRow = await reach(user, "File", "Page Setup");
    expect(isDimmed(setupRow)).toBe(true);
    expect(setupRow).toHaveAttribute("title", "The browser’s print dialog sets the page.");
    fireEvent.click(await row("Share"));
    const airdrop = await row("AirDrop");
    expect(isDimmed(airdrop)).toBe(true);
    expect(airdrop).toHaveAttribute(
      "title",
      "AirDrop sends to nearby devices, which a web page can’t reach.",
    );
  });

  it("dims Browse All Versions under Revert To where nothing keeps versions", async () => {
    const user = setup();
    requestOpenFile({ app: "script-editor", id: "f4", name: "Kept.js" });
    show();
    await waitFor(() => expect(scriptView().textContent).toBe('return "f4";'));
    scriptView().textContent = "changed";
    fireEvent.input(scriptView());
    const versions = await reach(user, "File", "Revert To", "Browse All Versions");
    expect(isDimmed(versions)).toBe(true);
  });

  it("hands Mail the text in the window as a file, unsaved changes included", async () => {
    const user = setup();
    const forget = registerFileReceivers([{ id: "mail", takesSharedFiles: true }]);
    show();
    const view = scriptView();
    view.textContent = "return 'unsaved';";
    fireEvent.input(view);
    await user.click(await reach(user, "File", "Share", "Mail"));
    const [shared] = takeSharedFiles("mail");
    expect(shared?.from).toBe("script-editor");
    const [item] = shared?.items ?? [];
    expect(item?.name).toBe("Untitled.js");
    const bytes = await item?.bytes?.();
    expect(bytes?.size).toBe("return 'unsaved';".length);
    expect(bytes?.type).toBe("text/javascript");
    forget();
  });
});

describe("Help", () => {
  it("opens Help Viewer on a search for the app and for AppleScript", async () => {
    const user = setup();
    const effects: unknown[] = [];
    const stop = onDesktopEffects((list) => effects.push(...list));
    show();
    await user.click(await reach(user, "Help", "Script Editor Help"));
    expect(takeHelpRequest()).toBe("Script Editor");
    await closedMenus();
    await user.click(await reach(user, "Help", "AppleScript Help"));
    expect(takeHelpRequest()).toBe("AppleScript");
    expect(effects).toEqual([{ open: "help-viewer" }, { open: "help-viewer" }]);
    stop();
  });
});

describe("the Log's menu", () => {
  it("copies the selected text, or the whole Log with none selected", async () => {
    const user = setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    show();
    await user.click(screen.getByRole("button", { name: "Run" }));
    await user.click(screen.getByRole("button", { name: "Log" }));
    const log = (await screen.findByRole("textbox", { name: "Log" })) as HTMLTextAreaElement;
    await waitFor(() => expect(log.value).toContain("first line"));
    fireEvent.contextMenu(log);
    await user.click(await screen.findByRole("menuitem", { name: "Copy" }));
    expect(writeText).toHaveBeenLastCalledWith(log.value);
    await closedMenus();
    log.setSelectionRange(0, 5);
    fireEvent.contextMenu(log);
    await user.click(await screen.findByRole("menuitem", { name: "Copy" }));
    expect(writeText).toHaveBeenLastCalledWith("first");
  });
});

describe("the script's menu", () => {
  it("has Font with Show Fonts, Bold and Italic, which act on the selection", async () => {
    const user = setup();
    show();
    selectFirstWord();
    fireEvent.contextMenu(scriptView());
    const popup = await screen.findByRole("menu", { name: "Script commands" });
    fireEvent.click(within(popup).getByRole("menuitem", { name: "Font" }));
    const font = await screen.findByRole("menu", { name: "Font" });
    expect(within(font).getByRole("menuitem", { name: /^Show Fonts/ })).toBeInTheDocument();
    expect(within(font).getByRole("menuitemcheckbox", { name: /^Italic/ })).toBeInTheDocument();
    await user.click(within(font).getByRole("menuitem", { name: /^Show Fonts/ }));
    expect(await screen.findByRole("region", { name: "Fonts" })).toBeInTheDocument();
    fireEvent.contextMenu(scriptView());
    const again = await screen.findByRole("menu", { name: "Script commands" });
    fireEvent.click(within(again).getByRole("menuitem", { name: "Font" }));
    const commands = recordCommands();
    await user.click(
      within(await screen.findByRole("menu", { name: "Font" })).getByRole("menuitemcheckbox", {
        name: /^Bold/,
      }),
    );
    await waitFor(() => expect(commands.map(([name]) => name)).toContain("bold"));
  });
});
