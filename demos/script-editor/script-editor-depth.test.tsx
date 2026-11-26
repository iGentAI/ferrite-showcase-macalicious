import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import {
  beginDesktopValues,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { readScript, ScriptEditor } from "./script-editor";
import { fileText, readFileText } from "./script-editor-draft";
import type { ScriptEditorServer, ScriptFile } from "./script-editor-server";

/*
 * The window's File, Script and View commands and its unsaved script. A drive in memory stands in
 * for the desktop's server (`server` prop), and a menu bar shows what the window registers for it.
 * e2e/script-editor-depth-journey.mjs runs the same commands on the served desktop.
 */

function driveServer() {
  const files = new Map<string, ScriptFile & { code: string }>([
    ["f1", { id: "f1", name: "Tidy.js", parent: "scripts", version: 3, code: "return 'tidy';" }],
  ]);
  const info = ({ id, name, parent, version }: ScriptFile): ScriptFile => ({
    id,
    name,
    parent,
    version,
  });
  const entry = (id: string) => {
    const found = files.get(id);
    if (!found) throw new Error("The script is no longer on the drive.");
    return found;
  };
  const server: ScriptEditorServer = {
    exportBundle: async (name) => ({ id: "b", name: `${name}.scptd` }),
    exportCopy: async (name, code) => {
      const id = `f${files.size + 1}`;
      files.set(id, { id, name, parent: "scripts", version: 1, code });
      return info(entry(id));
    },
    run: async (code) => ({ result: `ran ${code.length}`, failed: false, log: [] }),
    dictionary: async () => ({ actions: [], globals: [] }),
    scripts: async () =>
      [...files.values()].map((file) => ({
        id: file.id,
        name: file.name,
        path: `Documents/Scripts/${file.name}`,
        size: file.code.length,
        modified: null,
      })),
    open: async (id) => entry(id).code,
    save: async (name, code) => {
      const id = `f${files.size + 1}`;
      files.set(id, { id, name: `${name}.js`, parent: "scripts", version: 1, code });
      return { id, path: `Documents/Scripts/${name}.js` };
    },
    fileHolding: async (id, code) => {
      const found = entry(id);
      if (found.code !== code) throw new Error("The file changed on the drive.");
      return info(found);
    },
    write: async (file, code) => {
      const found = entry(file.id);
      if (file.version === undefined) throw new Error("The version could not be read.");
      if (file.version !== found.version) throw new Error("The file changed on the drive.");
      found.code = code;
      found.version = (found.version ?? 0) + 1;
      return info(found);
    },
    rename: async (file, name) => {
      const found = entry(file.id);
      found.name = name.endsWith(".js") ? name : `${name}.js`;
      return info(found);
    },
    move: async (file, parent) => {
      const found = entry(file.id);
      found.parent = parent;
      return info(found);
    },
    folders: async () => [
      { id: "documents", path: "Documents" },
      { id: "scripts", path: "Documents/Scripts" },
    ],
    scriptsFolder: async () => "scripts",
  };
  return { server, files };
}

function Menus() {
  const file = useDesktopAppMenuItems("script-editor", "File");
  const view = useDesktopAppMenuItems("script-editor", "View");
  const scriptMenu = useDesktopAppMenuItems("script-editor", "Script");
  return (
    <MenuBar aria-label="Menus">
      <MenuBarMenu title="File">{file}</MenuBarMenu>
      <MenuBarMenu title="View">{view}</MenuBarMenu>
      <MenuBarMenu title="Script">{scriptMenu}</MenuBarMenu>
    </MenuBar>
  );
}

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });
const scriptView = () => screen.getByRole("textbox", { name: "Script" });
const title = (name: string) => screen.getByRole("region", { name });

async function choose(user: ReturnType<typeof setup>, menu: string, item: RegExp) {
  await user.click(screen.getByRole("menuitem", { name: menu }));
  const entries = within(await screen.findByRole("menu")).getAllByRole("menuitem");
  const entry = entries.find((each) => item.test(each.textContent ?? ""));
  if (!entry) throw new Error(`no ${item} in ${menu}`);
  await user.click(entry);
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
}

const type = (text: string) => {
  const view = scriptView();
  view.textContent = text;
  fireEvent.input(view);
};

const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(scriptView(), { key, ctrlKey: true, ...init });

beforeEach(() => {
  forgetDesktopValues();
  beginDesktopValues();
});
afterEach(() => vi.useRealTimers());

describe("Script > and its keys", () => {
  it("runs, compiles, records and stops from the menu and from the keys", async () => {
    const user = setup();
    const { server } = driveServer();
    render(
      <>
        <Menus />
        <ScriptEditor server={server} defaultLanguage="JavaScript" defaultSource="return 1;" />
      </>,
    );

    await choose(user, "Script", /^Run/);
    await waitFor(() =>
      expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Result" }).value).toBe(
        "ran 9",
      ),
    );

    type("return 12345;");
    expect(press("r")).toBe(false);
    await waitFor(() =>
      expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Result" }).value).toBe(
        "ran 13",
      ),
    );

    press("k");
    await waitFor(() =>
      expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Result" }).value).toBe(
        "Compiled: this JavaScript script has no syntax errors.",
      ),
    );

    press("r", { shiftKey: true });
    expect(screen.getByRole("button", { name: "Record" })).toHaveAttribute("aria-disabled", "true");
    // During a recording Run is dimmed, and its key still does not reach the browser.
    expect(press("r")).toBe(false);
    press(".");
    expect(screen.getByRole("button", { name: "Record" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    press("3");
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Log" }).value).toBe(
      "(*Recording started. Nothing on this page can be recorded.*)\n(*Recording stopped.*)",
    );
  });

  it("dims Stop during a run on the server, saying why", async () => {
    const user = setup();
    const { server } = driveServer();
    let finish: (value: { result: string; failed: boolean; log: string[] }) => void = () => {};
    server.run = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    render(
      <>
        <Menus />
        <ScriptEditor server={server} defaultLanguage="JavaScript" defaultSource="return 1;" />
      </>,
    );
    press("r");
    await user.click(screen.getByRole("menuitem", { name: "Script" }));
    expect(await screen.findByRole("menuitem", { name: /^Stop/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("menuitem", {
        name: "A run on the server can’t be stopped: it ends within 5 seconds",
      }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await act(async () => finish({ result: "done", failed: false, log: [] }));
  });
});

describe("View >", () => {
  it("shows and hides the panes and picks the accessory view from the menu and the keys", async () => {
    const user = setup();
    render(
      <>
        <Menus />
        <ScriptEditor />
      </>,
    );
    await choose(user, "View", /^Show Bundle Contents/);
    expect(screen.getByRole("textbox", { name: "Identifier:" })).toBeInTheDocument();
    press("0");
    expect(screen.queryByRole("textbox", { name: "Identifier:" })).toBeNull();

    press("2");
    expect(screen.getByRole("textbox", { name: "Result" })).toBeInTheDocument();
    press("0", { altKey: true });
    expect(screen.queryByRole("textbox", { name: "Result" })).toBeNull();
    press("1");
    expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "View" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /^Log/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Log" })).toBeInTheDocument());
  });
});

describe("File >", () => {
  async function openTidy(user: ReturnType<typeof setup>) {
    await user.click(screen.getByRole("button", { name: "Open Script" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tidy" }));
    await waitFor(() => expect(readScript(scriptView())).toBe("return 'tidy';"));
  }
  const renderWindow = (server: ScriptEditorServer) =>
    render(
      <>
        <Menus />
        <ScriptEditor server={server} defaultLanguage="JavaScript" title="Untitled" />
      </>,
    );

  it("exports a copy beside the script and leaves the window's own file alone", async () => {
    const user = setup();
    const { server } = driveServer();
    const exported: [string, string][] = [];
    const write = server.exportCopy;
    server.exportCopy = (name, code) => {
      exported.push([name, code]);
      return write(name, code);
    };
    renderWindow(server);
    await choose(user, "File", /^Export/);
    const sheet = await screen.findByRole("dialog");
    await user.clear(within(sheet).getByRole("textbox"));
    await user.type(within(sheet).getByRole("textbox"), "Copy for later");
    await user.click(within(sheet).getByRole("combobox", { name: /File Format/ }));
    await user.click(await screen.findByRole("option", { name: "Text (.txt)" }));
    await user.click(within(sheet).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(exported).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(exported[0]).toEqual(["Copy for later.txt", readScript(scriptView())]);
    expect(screen.getByRole("textbox", { name: "Log" })).toHaveValue(
      "(*Exported Copy for later.txt.*)",
    );
    expect(title("Untitled")).toBeInTheDocument();
  });

  it("shows a template as an unsaved script, and shows the Log by tab", async () => {
    const user = setup();
    const { server } = driveServer();
    server.run = async () => ({
      result: "Done",
      failed: false,
      log: ["Started", "→ notes.make ✓"],
    });
    renderWindow(server);
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.click(await screen.findByRole("menuitem", { name: "New from Template" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Log Messages" }));
    await waitFor(() => expect(readScript(scriptView())).toContain('console.log("Started");'));
    await user.click(screen.getByRole("button", { name: "Run" }));
    await user.click(await screen.findByRole("button", { name: "Log" }));
    const log = () => screen.getByRole("textbox", { name: "Log" });
    await waitFor(() => expect(log()).toHaveValue("Started\n→ notes.make ✓"));
    await user.click(screen.getByRole("button", { name: "Events" }));
    expect(log()).toHaveValue("Started\n→ notes.make");
    await user.click(screen.getByRole("button", { name: "Messages" }));
    expect(log()).toHaveValue("Started");
  });

  it("has no commands of its own without a server, and leaves the browser its keys", () => {
    render(
      <>
        <Menus />
        <ScriptEditor />
      </>,
    );
    expect(press("s")).toBe(true);
    expect(press("o")).toBe(true);
  });

  it("saves an opened script into its own file, without asking", async () => {
    const user = setup();
    const { server, files } = driveServer();
    renderWindow(server);
    await openTidy(user);
    type("return 'neater';");
    press("s");
    await waitFor(() => expect(files.get("f1")?.code).toBe("return 'neater';"));
    expect(files.get("f1")?.version).toBe(4);
    expect(files.size).toBe(1);
    expect(screen.queryByRole("dialog")).toBeNull();

    // The next save is made from the version the last one left.
    type("return 'neatest';");
    await choose(user, "File", /^Save/);
    await waitFor(() => expect(files.get("f1")?.code).toBe("return 'neatest';"));
  });

  it("asks for a name when the file was saved over elsewhere, and never writes over it", async () => {
    const user = setup();
    const { server, files } = driveServer();
    renderWindow(server);
    await openTidy(user);
    const file = files.get("f1");
    if (file) file.version = 9;
    type("return 'mine';");
    press("s");
    const sheet = await screen.findByRole("dialog", { name: "Save Script" });
    expect(sheet).toHaveTextContent(
      "The script could not be saved. The file changed on the drive.",
    );
    expect(files.get("f1")?.code).toBe("return 'tidy';");
  });

  it("asks for a name when the script has no file, then saves into the file it made", async () => {
    const user = setup();
    const { server, files } = driveServer();
    renderWindow(server);
    type("return 'new';");
    press("s");
    const sheet = await screen.findByRole("dialog", { name: "Save Script" });
    const name = within(sheet).getByRole("textbox", { name: "Save As:" });
    await user.clear(name);
    await user.type(name, "Fresh{Enter}");
    await waitFor(() => expect(title("Fresh")).toBeInTheDocument());
    expect(files.get("f2")?.code).toBe("return 'new';");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    type("return 'newer';");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    press("s");
    await waitFor(() => expect(files.get("f2")?.code).toBe("return 'newer';"));
    expect(files.size).toBe(2);
  });

  it("duplicates into an unsaved copy after writing the original's changes", async () => {
    const user = setup();
    const { server, files } = driveServer();
    renderWindow(server);
    await openTidy(user);
    type("return 'changed';");
    await choose(user, "File", /^Duplicate/);
    await waitFor(() => expect(title("Tidy copy")).toBeInTheDocument());
    expect(files.get("f1")?.code).toBe("return 'changed';");
    expect(readScript(scriptView())).toBe("return 'changed';");

    // The copy has no file yet: Save asks for a name, under the copy's.
    press("s");
    const sheet = await screen.findByRole("dialog", { name: "Save Script" });
    expect(within(sheet).getByRole("textbox", { name: "Save As:" })).toHaveValue("Tidy copy");
  });

  it("asks for a name when the file changed while it was being opened", async () => {
    const user = setup();
    const { server, files } = driveServer();
    server.fileHolding = async () => {
      throw new Error("The file changed on the drive.");
    };
    renderWindow(server);
    await openTidy(user);
    const stored = files.get("f1");
    if (stored) stored.code = "return 'theirs';";
    type("return 'mine';");
    press("s");
    await screen.findByRole("dialog", { name: "Save Script" });
    expect(files.get("f1")?.code).toBe("return 'theirs';");
  });

  it("does not take a newer version from a rename: an edit made elsewhere is still refused", async () => {
    const user = setup();
    const { server, files } = driveServer();
    renderWindow(server);
    await openTidy(user);
    const stored = files.get("f1");
    if (stored) {
      stored.code = "return 'theirs';";
      stored.version = 4;
    }
    await choose(user, "File", /^Rename/);
    const rename = await screen.findByRole("dialog", { name: "Rename Script" });
    const field = within(rename).getByRole("textbox", { name: "Name:" });
    await user.clear(field);
    await user.type(field, "Tidier{Enter}");
    await waitFor(() => expect(title("Tidier")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    type("return 'mine';");
    press("s");
    await screen.findByRole("dialog", { name: "Save Script" });
    expect(files.get("f1")?.code).toBe("return 'theirs';");
  });

  it("leaves a script opened during Duplicate's save as it is", async () => {
    const user = setup();
    const { server, files } = driveServer();
    files.set("f2", {
      id: "f2",
      name: "Other.js",
      parent: "scripts",
      version: 1,
      code: "return 'other';",
    });
    const write = server.write;
    let release = () => {};
    server.write = async (file, code) => {
      server.write = write;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return write(file, code);
    };
    renderWindow(server);
    await openTidy(user);
    type("return 'changed';");
    await choose(user, "File", /^Duplicate/);
    await user.click(screen.getByRole("button", { name: "Open Script" }));
    await user.click(await screen.findByRole("menuitem", { name: "Other" }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Don’t Save" }));
    await waitFor(() => expect(readScript(scriptView())).toBe("return 'other';"));

    await act(async () => {
      release();
    });
    await waitFor(() => expect(files.get("f1")?.code).toBe("return 'changed';"));
    expect(title("Other")).toBeInTheDocument();
    expect(readScript(scriptView())).toBe("return 'other';");
    type("return 'other two';");
    press("s");
    await waitFor(() => expect(files.get("f2")?.code).toBe("return 'other two';"));
  });

  it("takes the new file when the script is typed on during a named save", async () => {
    const user = setup();
    const { server, files } = driveServer();
    const save = server.save;
    let release = () => {};
    server.save = async (name, code, replace) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return save(name, code, replace);
    };
    renderWindow(server);
    await openTidy(user);
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));
    const sheet = await screen.findByRole("dialog", { name: "Save Script" });
    const name = within(sheet).getByRole("textbox", { name: "Save As:" });
    await user.clear(name);
    await user.type(name, "Other{Enter}");
    await waitFor(() => expect(release).not.toBe(undefined));
    const view = screen.getByRole("textbox", { name: "Script", hidden: true });
    view.textContent = "return 'later';";
    fireEvent.input(view);
    await act(async () => {
      release();
    });
    await waitFor(() => expect(title("Other")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    press("s");
    await waitFor(() => expect(files.get("f2")?.code).toBe("return 'later';"));
    expect(files.get("f1")?.code).toBe("return 'tidy';");
  });

  it("renames and moves the file, and dims both while the script has none", async () => {
    const user = setup();
    const { server, files } = driveServer();
    renderWindow(server);
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    expect(await screen.findByRole("menuitem", { name: /^Rename/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /^Move To/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");

    await openTidy(user);
    await choose(user, "File", /^Rename/);
    const rename = await screen.findByRole("dialog", { name: "Rename Script" });
    const field = within(rename).getByRole("textbox", { name: "Name:" });
    await user.clear(field);
    await user.type(field, "Tidier{Enter}");
    await waitFor(() => expect(title("Tidier")).toBeInTheDocument());
    expect(files.get("f1")?.name).toBe("Tidier.js");

    await choose(user, "File", /^Move To/);
    const move = await screen.findByRole("dialog", { name: "Move “Tidier”" });
    const where = within(move).getByRole("combobox", { name: "Where:" });
    await waitFor(() => expect(where).toHaveTextContent("Documents/Scripts"));
    expect(within(move).getByRole("button", { name: "Move" })).toBeDisabled();
    await user.click(where);
    await user.click(await screen.findByRole("option", { name: "Documents" }));
    await user.click(within(move).getByRole("button", { name: "Move" }));
    await waitFor(() => expect(files.get("f1")?.parent).toBe("documents"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("lists what was opened in Open Recent, and clears the menu", async () => {
    const user = setup();
    const { server } = driveServer();
    renderWindow(server);
    await openTidy(user);
    expect(desktopValues()["scriptEditor.recents"]).toEqual([{ id: "f1", name: "Tidy.js" }]);

    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Open Recent" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Clear Menu" }));
    await waitFor(() => expect(desktopValues()["scriptEditor.recents"]).toEqual([]));
  });

  it("takes a recent script that is gone out of the list, and says so", async () => {
    const user = setup();
    const { server, files } = driveServer();
    renderWindow(server);
    await openTidy(user);
    files.delete("f1");
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Open Recent" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Tidy.js" }));
    await waitFor(() => expect(desktopValues()["scriptEditor.recents"]).toEqual([]));
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Result" }).value).toBe(
      "Error: The script “Tidy” could not be opened. The script is no longer on the drive.",
    );
  });
});

describe("the unsaved script", () => {
  const settled = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });

  it("comes back with its language, name and file when the window opens again", async () => {
    const user = setup();
    const { server, files } = driveServer();
    const first = render(<ScriptEditor server={server} defaultLanguage="AppleScript" title="U" />);
    await user.click(screen.getByRole("button", { name: "Open Script" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tidy" }));
    await waitFor(() => expect(readScript(scriptView())).toBe("return 'tidy';"));
    await act(async () => {});
    type("return 'kept';");
    await settled();
    expect(desktopValues()["scriptEditor.draft"]).toEqual({
      code: "return 'kept';",
      language: "JavaScript",
      title: "Tidy",
      file: { id: "f1", name: "Tidy.js", parent: "scripts", version: 3 },
    });
    first.unmount();

    render(<ScriptEditor server={server} defaultLanguage="AppleScript" title="U" />);
    await waitFor(() => expect(readScript(scriptView())).toBe("return 'kept';"));
    expect(title("Tidy")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("JavaScript");

    // Saved, it is written into its file, and no draft is left.
    press("s");
    await waitFor(() => expect(files.get("f1")?.code).toBe("return 'kept';"));
    await waitFor(() => expect(desktopValues()["scriptEditor.draft"]).toBeNull());
  });

  it("keeps in the file a Description a value of the person's could not hold", async () => {
    const user = setup();
    const { server, files } = driveServer();
    render(<ScriptEditor server={server} title="U" defaultLanguage="JavaScript" />);
    await user.click(screen.getByRole("button", { name: "Open Script" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tidy" }));
    await waitFor(() => expect(readScript(scriptView())).toBe("return 'tidy';"));
    type("return 'more';");
    await settled();
    await user.click(screen.getByRole("button", { name: "Description" }));
    const description = await screen.findByRole("textbox", { name: "Description" });
    const long = `<div>${"x".repeat(100_000)}</div>`;
    description.innerHTML = long;
    fireEvent.input(description);
    press("s");
    await waitFor(() =>
      expect(files.get("f1")?.code).toBe(fileText("return 'more';", { description: long })),
    );
    await waitFor(() => expect(desktopValues()["scriptEditor.draft"]).toBeNull());
  });

  it("opens a file's Description from the file, and shows the code without it", async () => {
    const user = setup();
    const { server, files } = driveServer();
    const tidy = files.get("f1");
    if (!tidy) throw new Error("no f1");
    tidy.code = fileText("return 'tidy';", { description: "<div>From the file</div>" });
    render(<ScriptEditor server={server} title="U" defaultLanguage="JavaScript" />);
    await user.click(screen.getByRole("button", { name: "Open Script" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tidy" }));
    await waitFor(() => expect(readScript(scriptView())).toBe("return 'tidy';"));
    await user.click(screen.getByRole("button", { name: "Description" }));
    expect(await screen.findByRole("textbox", { name: "Description" })).toHaveTextContent(
      "From the file",
    );
  });

  it("writes a file's last line so that it reads back whole and cannot end its comment", () => {
    const info = {
      description: "<b>*/ alert(1) /*</b>",
      bundle: { name: "N", identifier: "com.x", version: "2", copyright: "© */" },
    };
    const text = fileText("return 1;\n", info);
    expect(text.match(/\*\//g)).toHaveLength(1);
    expect(text.startsWith('return 1;\n\n/* Script Editor: {"description":"<b>*\\u002f')).toBe(
      true,
    );
    expect(readFileText(text)).toEqual({ code: "return 1;\n", info });
    expect(fileText("return 1;", {})).toBe("return 1;");
    expect(readFileText("return 1;")).toEqual({ code: "return 1;", info: null });
    const typed = "return 1;\n/* Script Editor: {not json} */\n";
    expect(readFileText(typed)).toEqual({ code: typed, info: null });
  });

  it("keeps with a file the Description it had when Save was chosen", async () => {
    const user = setup();
    const { server, files } = driveServer();
    render(<ScriptEditor server={server} title="U" defaultLanguage="JavaScript" />);
    await user.click(screen.getByRole("button", { name: "Open Script" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tidy" }));
    await waitFor(() => expect(readScript(scriptView())).toBe("return 'tidy';"));
    await user.click(screen.getByRole("button", { name: "Description" }));
    const description = await screen.findByRole("textbox", { name: "Description" });
    description.innerHTML = "<div>at Save</div>";
    fireEvent.input(description);
    let finish = () => {};
    const write = server.write;
    server.write = async (...args) => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return write(...args);
    };
    press("s");
    await act(async () => {});
    description.innerHTML = "<div>after Save</div>";
    fireEvent.input(description);
    await act(async () => finish());
    await waitFor(() =>
      expect(readFileText(files.get("f1")?.code ?? "").info?.description).toBe(
        "<div>at Save</div>",
      ),
    );
    expect(desktopValues()["scriptEditor.draft"]).toMatchObject({
      description: "<div>after Save</div>",
    });
  });

  it("is kept by each window under its own value", async () => {
    const { server } = driveServer();
    render(
      <div data-window-id="script-editor:2">
        <ScriptEditor server={server} title="Second" defaultLanguage="JavaScript" />
      </div>,
    );
    type("return 2;");
    await settled();
    expect(desktopValues()["scriptEditor.draft2"]).toMatchObject({ code: "return 2;" });
    expect(desktopValues()["scriptEditor.draft"]).toBeUndefined();
  });

  it("says so when it is too long to keep, and keeps what fitted last", async () => {
    const { server } = driveServer();
    render(<ScriptEditor server={server} title="Long" defaultLanguage="JavaScript" />);
    type("return 'short';");
    await settled();
    type(`// ${"x".repeat(100_000)}`);
    await settled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "This script is too long to keep across a reload. Save it to keep your changes.",
    );
    expect(desktopValues()["scriptEditor.draft"]).toMatchObject({ code: "return 'short';" });
  });

  it("has a script larger than one value back whole", async () => {
    const { server } = driveServer();
    const first = render(
      <ScriptEditor server={server} title="Long" defaultLanguage="JavaScript" />,
    );
    const long = `// ${"café ".repeat(2000)}`;
    type(long);
    await settled();
    expect(screen.queryByRole("status")).toBeNull();
    for (const value of Object.values(desktopValues())) {
      expect(new TextEncoder().encode(JSON.stringify(value)).length).toBeLessThanOrEqual(4096);
    }
    first.unmount();
    render(<ScriptEditor server={server} title="Long" defaultLanguage="JavaScript" />);
    await waitFor(() => expect(readScript(scriptView())).toBe(long));
  });

  it("keeps the Description and the bundle fields, unsaved and with a saved script", async () => {
    const user = setup();
    const { server } = driveServer();
    const first = render(<ScriptEditor server={server} title="U" defaultLanguage="JavaScript" />);
    await user.click(screen.getByRole("button", { name: "Open Script" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tidy" }));
    await waitFor(() => expect(readScript(scriptView())).toBe("return 'tidy';"));
    await user.click(screen.getByRole("button", { name: "Description" }));
    const description = await screen.findByRole("textbox", { name: "Description" });
    description.innerHTML = "<div>What it does</div>";
    fireEvent.input(description);
    await user.click(screen.getByRole("button", { name: "Bundle contents" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Version:" }), {
      target: { value: "2.5" },
    });
    await settled();
    expect(desktopValues()["scriptEditor.draft"]).toMatchObject({
      description: "<div>What it does</div>",
      bundle: { version: "2.5" },
    });
    first.unmount();

    // After a reload they come back with the unsaved script.
    const second = render(<ScriptEditor server={server} title="U" defaultLanguage="JavaScript" />);
    await waitFor(() => expect(title("Tidy")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Description" }));
    expect(await screen.findByRole("textbox", { name: "Description" })).toHaveTextContent(
      "What it does",
    );

    // Saved, they are the script's: opening it again has them, with no draft left.
    press("s");
    await waitFor(() => expect(desktopValues()["scriptEditor.draft"]).toBeNull());
    second.unmount();
    render(<ScriptEditor server={server} title="U" defaultLanguage="JavaScript" />);
    await user.click(screen.getByRole("button", { name: "Open Script" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tidy" }));
    await waitFor(() => expect(readScript(scriptView())).toBe("return 'tidy';"));
    await user.click(screen.getByRole("button", { name: "Description" }));
    expect(await screen.findByRole("textbox", { name: "Description" })).toHaveTextContent(
      "What it does",
    );
  });

  it("is dropped when the person closes the window without saving", async () => {
    const user = setup();
    const { server } = driveServer();
    const onClose = vi.fn();
    render(<ScriptEditor server={server} title="Gone" onClose={onClose} />);
    type("return 'gone';");
    await settled();
    expect(desktopValues()["scriptEditor.draft"]).toMatchObject({ code: "return 'gone';" });
    await user.click(screen.getByRole("button", { name: /close/i }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("button", { name: "Don’t Save" }));
    expect(onClose).toHaveBeenCalled();
    expect(desktopValues()["scriptEditor.draft"]).toBeNull();
  });
});
