import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { WindowManager } from "macalicious/window-manager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import {
  beginDesktopValues,
  changeDesktopValue,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { DesktopSecondaryWindow, DesktopWindowHostContext } from "../desktop/desktop-windows";
import { ScriptEditor } from "./script-editor";
import { tellsApplication, translateAppleScript } from "./script-editor-applescript";
import { compile, errorLine } from "./script-editor-data";
import { useLogHistory } from "./script-editor-history";
import { NO_PLUG_INS, ScriptEditorPreferences } from "./script-editor-preferences";
import {
  bundlePlist,
  type ScriptDictionary,
  type ScriptEditorServer,
} from "./script-editor-server";
import { completionsOf, fillSnippet, wordBefore } from "./script-editor-snippets";
import { appOfItem, dictionaryApps } from "./script-editor-windows";

/*
 * The rows of batch 2: the Library, Dictionary and Log History windows, Complete, Paste Reply, the
 * snippets, Styles…, Make Plain Text, the ruler, the AppleScript that reaches the apps, the bundle
 * and the Preferences panes. The desktop's real secondary windows and window manager host them; a
 * server in memory stands in for the desktop's, and the browser's editing command is recorded:
 * jsdom has none.
 */

const DICTIONARY: ScriptDictionary = {
  globals: ["Notes", "Reminders"],
  actions: [
    {
      name: "notes.make",
      title: "New Note",
      app: "notes",
      summary: "Makes a note in Notes.",
      takes_input: true,
      writes: true,
      params: [{ name: "title", kind: "text", required: false, summary: "The first line" }],
    },
    {
      name: "notes.list",
      title: "Get Notes",
      app: "notes",
      summary: "Every note.",
      takes_input: false,
      writes: false,
      params: [],
    },
    {
      name: "reminders.add",
      title: "New Reminders Item",
      app: "reminders",
      summary: "Adds a reminder.",
      takes_input: true,
      writes: true,
      params: [],
    },
  ],
};

function makeServer(
  run: ScriptEditorServer["run"] = async () => ({ result: "7", failed: false, log: ["a line"] }),
) {
  const bundles: unknown[] = [];
  const server: ScriptEditorServer = {
    exportCopy: async (name) => ({ id: "e", name }),
    exportBundle: async (name, bundle) => {
      bundles.push({ name, ...bundle });
      return { id: "b", name: `${name}.scptd` };
    },
    run,
    dictionary: async () => DICTIONARY,
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
  return { server, bundles };
}

const MENUS = ["File", "Edit", "Font", "Format", "View", "Window"] as const;

function Menus() {
  const items = {
    File: useDesktopAppMenuItems("script-editor", "File"),
    Edit: useDesktopAppMenuItems("script-editor", "Edit"),
    Font: useDesktopAppMenuItems("script-editor", "Font"),
    Format: useDesktopAppMenuItems("script-editor", "Format"),
    View: useDesktopAppMenuItems("script-editor", "View"),
    Window: useDesktopAppMenuItems("script-editor", "Window"),
  };
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

function show(
  server: ScriptEditorServer,
  language: "JavaScript" | "AppleScript" = "JavaScript",
  source = "return 1;",
) {
  const host = {
    app: "script-editor",
    stage: () => document.querySelector(".mac-window-manager"),
    place: () => ({ x: 0, y: 0 }),
  };
  render(
    <>
      <Menus />
      <WindowManager>
        <DesktopWindowHostContext value={host}>
          <ManagedWindow
            id="script-editor"
            app="script-editor"
            title="Script Editor"
            defaultFrame={{ width: 700, height: 705 }}
            render={(props) => (
              <ScriptEditor
                {...props}
                server={server}
                defaultLanguage={language}
                defaultSource={source}
                title="Untitled"
                DesktopWindow={DesktopSecondaryWindow}
              />
            )}
          />
        </DesktopWindowHostContext>
      </WindowManager>
    </>,
  );
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });
const scriptView = () => screen.getByRole("textbox", { name: "Script" });

async function choose(user: ReturnType<typeof setup>, menu: string, name: RegExp) {
  await user.click(screen.getByRole("menuitem", { name: menu }));
  await user.click(await screen.findByRole("menuitem", { name }));
}

function caretAtEnd(view = scriptView()) {
  view.focus();
  const range = document.createRange();
  const walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
  let last: Node | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) last = node;
  if (!last) throw new Error("The script has no text.");
  range.setStart(last, last.nodeValue?.length ?? 0);
  range.collapse(true);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

let commands: [string, string | undefined][];

beforeEach(() => {
  forgetDesktopValues();
  beginDesktopValues();
  commands = [];
  document.execCommand = ((name: string, _ui?: boolean, value?: string) => {
    commands.push([name, value]);
    return true;
  }) as typeof document.execCommand;
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
});

afterEach(() => {
  vi.restoreAllMocks();
  forgetDesktopValues();
});

describe("AppleScript that reaches the apps", () => {
  it("translates a tell block into the actions a JavaScript script calls", () => {
    const translated = translateAppleScript(
      [
        'tell application "Notes"',
        '\tmake new note with properties {name:"Plan", body:"Buy " & "pears"}',
        "\tset all_notes to every note",
        "end tell",
        "return all_notes",
      ].join("\n"),
    );
    expect(translated).toEqual({
      ok: true,
      code: [
        "const __text = (items) => (Array.isArray(items) ? items.map((item) => item?.text ?? item) : items);",
        "let __result;",
        "let v_all_notes;",
        '__result = __text(await Notes.make({ title: "Plan", text: "Buy " + "pears" }));',
        "v_all_notes = __text(await Notes.list());",
        "__result = v_all_notes;",
        "return v_all_notes;",
        "return __result;",
      ].join("\n"),
    });
  });

  it("reaches reminders, calendar, messages, the appearance and any app's activate", () => {
    const code = (line: string) => {
      const translated = translateAppleScript(line);
      if (!translated.ok) throw new Error(translated.error);
      return translated.code;
    };
    expect(
      code('tell application "Reminders" to make new reminder with properties {name:"Call"}'),
    ).toContain('Reminders.add({ title: "Call" })');
    expect(code('tell application "Calendar" to get every event')).toContain("Calendar.events()");
    expect(code('tell application "Messages" to send "Hi" to chat "desktop"')).toContain(
      'Messages.send({ text: "Hi", room: "desktop" })',
    );
    expect(
      code(
        'tell application "System Events" to tell appearance preferences to set dark mode to true',
      ),
    ).toContain('Appearance.set({ mode: "dark" })');
    expect(code('tell application "Safari" to activate')).toContain(
      'Application("Safari").activate()',
    );
  });

  it("refuses what it does not know, naming the line, so nothing runs in part", () => {
    expect(
      translateAppleScript('tell application "Notes"\nmake new note\nclose window 1\nend tell'),
    ).toEqual({
      ok: false,
      line: 2,
      error: "“Notes” got a statement this desktop can’t carry out: close window 1",
    });
    const elsewhere = translateAppleScript('tell application "Mail"\nget every message\nend tell');
    expect(elsewhere).toMatchObject({ ok: false, line: 1 });
  });

  it("tells a script that addresses an application from one that does not", () => {
    expect(tellsApplication('(* tell application "Notes" *)\nreturn 1')).toBe(false);
    expect(tellsApplication('\ttell application "Notes" to activate')).toBe(true);
  });

  it("sends the translation to the server, and selects the line a refusal names", async () => {
    const sent: string[] = [];
    const { server } = makeServer(async (code) => {
      sent.push(code);
      return { result: "ok", failed: false, log: [] };
    });
    const user = setup();
    show(server, "AppleScript", 'tell application "Notes"\nmake new note\nend tell');
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toContain("await Notes.make({  })");
    expect(await screen.findByRole("textbox", { name: "Result" })).toHaveValue("ok");
  });

  it("shows a refusal as the Result without calling the server", async () => {
    const run = vi.fn(async () => ({ result: "", failed: false, log: [] }));
    const user = setup();
    show(makeServer(run).server, "AppleScript", 'tell application "Notes"\nbeep\nend tell');
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByRole("textbox", { name: "Result" })).toHaveValue(
      "Error: “Notes” got a statement this desktop can’t carry out: beep",
    );
    expect(run).not.toHaveBeenCalled();
    await waitFor(() => expect(document.getSelection()?.toString()).toBe("\tbeep"));
  });
});

describe("a compile error's place", () => {
  it("is the first line that gives the error", () => {
    const script = "const a = 1;\nconst b = ;\nreturn a;";
    const compiled = compile(script, "JavaScript");
    if (compiled.ok) throw new Error("It should not parse.");
    expect(errorLine(script, "JavaScript", compiled.error)).toBe(1);
    const unclosed = 'set a to 1\ntell application "Mail"\nbeep';
    const apple = compile(unclosed);
    if (apple.ok) throw new Error("It should not compile.");
    expect(errorLine(unclosed, "AppleScript", apple.error)).toBe(1);
  });

  it("is selected in the script when Compile refuses it", async () => {
    const user = setup();
    show(makeServer().server, "JavaScript", "const a = 1;\nconst b = ;\nreturn a;");
    await user.click(screen.getByRole("button", { name: "Compile" }));
    await waitFor(() => expect(document.getSelection()?.toString()).toBe("const b = ;"));
  });
});

describe("Edit > Complete and Paste Reply", () => {
  it("offers the language, the dictionary and the script's own words", () => {
    expect(completionsOf("Not", "JavaScript", "Note = 1;", DICTIONARY)).toEqual([
      "Notes.make",
      "Notes.list",
      "Note",
    ]);
    expect(completionsOf("tel", "AppleScript", "", null)).toEqual(["tell application"]);
    expect(completionsOf("", "AppleScript", "tell", null)).toEqual([]);
    expect(wordBefore("await Notes.ma")).toBe("Notes.ma");
  });

  it("puts in the only completion at once", async () => {
    const user = setup();
    show(makeServer().server, "JavaScript", "retur");
    caretAtEnd();
    await choose(user, "Edit", /^Complete/);
    await waitFor(() => expect(commands).toContainEqual(["insertText", "return"]));
  });

  it("lists several, moves with the arrows and takes one with Return", async () => {
    const user = setup();
    show(makeServer().server, "JavaScript", "Notes");
    caretAtEnd();
    await user.keyboard("{Alt>}{Escape}{/Alt}");
    const list = await screen.findByRole("listbox", { name: "Completions" });
    expect(
      within(list)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Notes.make", "Notes.list"]);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(commands).toContainEqual(["insertText", "Notes.list"]);
    expect(screen.queryByRole("listbox", { name: "Completions" })).toBeNull();
  });

  it("is dimmed with Script Assistant off", async () => {
    changeDesktopValue("scriptEditor.assistant", false);
    const user = setup();
    show(makeServer().server);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await screen.findByRole("menuitem", { name: /^Complete/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("pastes the last result only once there is one", async () => {
    const user = setup();
    show(makeServer().server);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await screen.findByRole("menuitem", { name: "Paste Reply" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByDisplayValue("7");
    caretAtEnd();
    await choose(user, "Edit", /^Paste Reply/);
    expect(commands).toContainEqual(["insertText", "7"]);
  });
});

describe("the script's context menu snippets", () => {
  it("puts a snippet in at the insertion point", async () => {
    const user = setup();
    show(makeServer().server);
    caretAtEnd();
    fireEvent.contextMenu(scriptView());
    const group = await screen.findByRole("menuitem", { name: "App Calls" });
    const row = await waitFor(() => {
      const found = screen.queryByRole("menuitem", { name: "New Reminder" });
      if (found) return found;
      group.focus();
      fireEvent.keyDown(group, { key: "ArrowRight" });
      throw new Error("The submenu has not opened.");
    });
    await user.click(row);
    expect(commands).toContainEqual(["insertText", 'await Reminders.add({ title: "Title" });']);
  });

  it("fills a snippet around the selection", () => {
    expect(fillSnippet('tell application "Notes"\n§\nend tell', "activate")).toBe(
      'tell application "Notes"\nactivate\nend tell',
    );
  });
});

describe("the Library, Dictionary and Log History windows", () => {
  it("lists the apps of the dictionary by name; a dragged item names one", () => {
    expect(dictionaryApps(DICTIONARY)).toEqual(["notes", "reminders"]);
    expect(appOfItem("Notes.app", ["notes"])).toBe("notes");
    expect(appOfItem("Plan.txt", ["notes"])).toBeUndefined();
  });

  it("opens the Library from the Window menu, a dictionary from it, and removes several apps", async () => {
    const user = setup();
    show(makeServer().server);
    await choose(user, "Window", /^Library/);
    const library = await screen
      .findByRole("grid", { name: "Applications" })
      .catch(() => screen.findByRole("table", { name: "Applications" }));
    const notes = await within(library).findByText("Notes");
    await user.click(notes);
    await user.click(screen.getByRole("button", { name: "Open Dictionary" }));
    expect(await screen.findByText("Notes Dictionary")).toBeInTheDocument();
    await user.click(await screen.findByText("Notes Suite"));
    await user.click(await screen.findByText("New Note"));
    expect(await screen.findByText("Notes.make({ title })")).toBeInTheDocument();

    await user.click(within(library).getByText("Notes"));
    await user.keyboard("{Shift>}");
    await user.click(within(library).getByText("Reminders"));
    await user.keyboard("{/Shift}");
    await user.click(screen.getByRole("button", { name: "Remove from Library" }));
    await waitFor(() => expect(within(library).queryByText("Notes")).toBeNull());
    expect(desktopValues()["scriptEditor.libraryRemoved"]).toEqual(["notes", "reminders"]);
    await user.click(screen.getByRole("button", { name: "Add Notes" }));
    expect(await within(library).findByText("Notes")).toBeInTheDocument();
  });

  it("searches a dictionary, asked for through File > Open Dictionary", async () => {
    const user = setup();
    show(makeServer().server);
    await choose(user, "File", /^Open Dictionary/);
    const sheet = await screen.findByRole("dialog", { name: "Open Dictionary" });
    await waitFor(() =>
      expect(within(sheet).getByRole("button", { name: "Choose" })).toBeEnabled(),
    );
    await user.click(within(sheet).getByRole("button", { name: "Choose" }));
    const search = await screen
      .findByRole("searchbox", { name: "Search the dictionary" })
      .catch(() => screen.findByRole("textbox", { name: "Search the dictionary" }));
    await user.click(await screen.findByText("Notes Suite"));
    expect(await screen.findByText("Get Notes")).toBeInTheDocument();
    await user.type(search, "reminder of nothing");
    await waitFor(() => expect(screen.queryByText("Get Notes")).toBeNull());
    expect(screen.getByText("No commands match.")).toBeInTheDocument();
  });

  it("keeps each run in Log History, among the desktop values, until deleted", async () => {
    const user = setup();
    show(makeServer().server);
    await user.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByDisplayValue("7");
    await choose(user, "Window", /^Log History/);
    const row = await screen.findByText("Untitled", { selector: ".mac-script-editor-history *" });
    expect(String(desktopValues()["scriptEditor.history"])).toContain('"result":"7"');
    await user.click(row);
    expect(screen.getByRole("textbox", { name: "Selected runs" })).toHaveValue(
      "Untitled (JavaScript)\n7\na line",
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(String(desktopValues()["scriptEditor.history"])).toBe("[]"));
  });

  it("keeps no run with the history turned off", async () => {
    changeDesktopValue("scriptEditor.historyEnabled", false);
    const Reader = () => <output>{useLogHistory().length}</output>;
    const user = setup();
    show(makeServer().server);
    render(<Reader />);
    await user.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByDisplayValue("7");
    expect(screen.getByRole("status")).toHaveTextContent("0");
  });
});

describe("Format and the Font menu's Styles", () => {
  it("lists the script's styles in Font > Styles…", async () => {
    const user = setup();
    show(makeServer().server, "JavaScript", "return 1;");
    caretAtEnd();
    await choose(user, "Font", /^Styles/);
    expect(await screen.findByRole("dialog", { name: "Styles" })).toBeInTheDocument();
  });

  it("prints the script with its runs in the styles they show", async () => {
    const user = setup();
    show(makeServer().server, "JavaScript", "return 1;");
    await choose(user, "File", /^Print/);
    const page = document.querySelector<HTMLIFrameElement>("iframe[data-textedit-print]");
    expect(page?.srcdoc).toMatch(
      /<span style="[^"]*">return<\/span> <span style="[^"]*">1<\/span>;/,
    );
    expect(page?.srcdoc).not.toContain("mac-script-editor-run");
  });

  it("shows the ruler over the script at the tab stops, and keeps the setting", async () => {
    const user = setup();
    show(makeServer().server);
    expect(document.querySelector(".mac-script-editor-ruler")).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    const text = await screen.findByRole("menuitem", { name: "Text" });
    // The key opens the submenu only once the menu around it has settled: pressed until it has. The row
    // is clicked as it is found, since a menu settling can replace it in the next tick.
    await waitFor(() => {
      const found = screen.queryByRole("menuitem", { name: "Show Ruler" });
      if (found) {
        fireEvent.click(found);
        return;
      }
      text.focus();
      fireEvent.keyDown(text, { key: "ArrowRight" });
      throw new Error("The submenu has not opened.");
    });
    await waitFor(() => expect(document.querySelector(".mac-script-editor-ruler")).not.toBeNull());
    expect(desktopValues()["scriptEditor.ruler"]).toBe(true);
  });

  it("asks before Make Plain Text, then leaves the text with no styles", async () => {
    const user = setup();
    show(makeServer().server, "JavaScript", "return 1;");
    expect(scriptView().querySelector("[data-style]")).not.toBeNull();
    caretAtEnd();
    await choose(user, "Format", /^Make Plain Text/);
    const sheet = await screen.findByRole("dialog", { name: "Convert this text to plain text?" });
    await user.click(within(sheet).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(scriptView().querySelector("[data-style]")).toBeNull());
    expect(scriptView()).toHaveTextContent("return 1;");
  });
});

describe("File > Export as a script bundle", () => {
  it("writes Info.plist from the bundle's fields", () => {
    expect(
      bundlePlist({ name: "A & B", identifier: "x.y", version: "1.0", copyright: "<c>" }),
    ).toContain(
      "<key>CFBundleName</key>\n\t<string>A &amp; B</string>\n\t<key>CFBundleIdentifier</key>\n\t<string>x.y</string>\n\t<key>CFBundleShortVersionString</key>\n\t<string>1.0</string>\n\t<key>NSHumanReadableCopyright</key>\n\t<string>&lt;c&gt;</string>",
    );
  });

  it("hands the server the script and fields, and dims Application and Run-only", async () => {
    const { server, bundles } = makeServer();
    const user = setup();
    show(server);
    await user.click(screen.getByRole("button", { name: "Bundle contents" }));
    const version = await screen.findByRole("textbox", { name: "Version:" });
    await user.clear(version);
    await user.type(version, "2.5");
    await choose(user, "File", /^Export/);
    const sheet = await screen.findByRole("dialog", { name: /^Export/ });
    expect(within(sheet).getByRole("checkbox")).toHaveAttribute("aria-disabled", "true");
    expect(within(sheet).getByText("Run-only")).toBeInTheDocument();
    await user.click(within(sheet).getByRole("combobox", { name: /File Format/ }));
    expect(await screen.findByRole("option", { name: "Application" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(await screen.findByRole("option", { name: "Script Bundle (.scptd)" }));
    await user.click(within(sheet).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(bundles).toHaveLength(1));
    expect(bundles[0]).toMatchObject({
      name: "Untitled",
      code: "return 1;",
      info: { version: "2.5" },
    });
  });
});

describe("View > Customize Toolbar…", () => {
  it("takes items out of the toolbar at once, keeps them out, and Use Default Set puts them back", async () => {
    const user = setup();
    show(makeServer().server);
    const toolbar = screen.getByRole("toolbar", { name: "Toolbar" });
    expect(within(toolbar).getByRole("button", { name: "Record" })).toBeInTheDocument();
    await choose(user, "View", /^Customize Toolbar/);
    const sheet = await screen.findByRole("dialog", { name: "Choose the items the toolbar shows" });
    await user.click(within(sheet).getByRole("checkbox", { name: "Record" }));
    expect(within(toolbar).queryByRole("button", { name: "Record" })).toBeNull();
    expect(desktopValues()["scriptEditor.hiddenTools"]).toEqual(["record"]);
    await user.click(within(sheet).getByRole("button", { name: "Use Default Set" }));
    expect(within(toolbar).getByRole("button", { name: "Record" })).toBeInTheDocument();
    expect(desktopValues()["scriptEditor.hiddenTools"]).toEqual([]);
    await user.click(within(sheet).getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Choose the items the toolbar shows" }),
      ).toBeNull(),
    );
  });
});

describe("Preferences", () => {
  const pane = async (user: ReturnType<typeof setup>, name: string) =>
    user.click(screen.getByRole("tab", { name }));

  it("keeps the default language, Script Assistant and the history's size", async () => {
    const user = setup();
    render(<ScriptEditorPreferences />);
    await user.click(screen.getByRole("checkbox", { name: "Use Script Assistant" }));
    expect(desktopValues()["scriptEditor.assistant"]).toBe(false);
    await pane(user, "General");
    await user.click(screen.getByRole("combobox", { name: "Default language" }));
    await user.click(await screen.findByRole("option", { name: "AppleScript" }));
    expect(desktopValues()["scriptEditor.defaultLanguage"]).toBe("AppleScript");
    await pane(user, "History");
    await user.click(screen.getByRole("checkbox", { name: "Enable log history" }));
    expect(desktopValues()["scriptEditor.historyEnabled"]).toBe(false);
  });

  it("sets a style's colour for the script view, and says why there are no plug-ins", async () => {
    const user = setup();
    render(<ScriptEditorPreferences />);
    await pane(user, "Plug-ins");
    expect(screen.getByText(NO_PLUG_INS)).toBeInTheDocument();
    await act(async () => changeDesktopValue("scriptEditor.formatting", { comment: "#112233" }));
    await pane(user, "Formatting");
    expect(screen.getByLabelText("Comments")).toHaveValue("#112233");
  });

  it("gives the script view the colours chosen", async () => {
    changeDesktopValue("scriptEditor.formatting", { comment: "#112233" });
    show(makeServer().server);
    expect(scriptView().style.getPropertyValue("--mac-script-editor-comment")).toBe("#112233");
  });
});
