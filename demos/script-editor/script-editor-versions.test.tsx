import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { requestOpenFile } from "../finder/finder-open";
import { ScriptEditor } from "./script-editor";
import type { ScriptEditorServer } from "./script-editor-server";

/*
 * File > Revert To on a server in memory (`server` prop) and a stand-in `fetch` for the bytes a
 * version holds. e2e/versions-rest-batch10-journey.mjs drives the real drive.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function Menus() {
  const file = useDesktopAppMenuItems("script-editor", "File");
  return (
    <MenuBar modal={false} aria-label="Menus">
      <MenuBarMenu title="File">{file}</MenuBarMenu>
    </MenuBar>
  );
}

/** A file `f9` whose kept versions are 1 and 2, and the script at version 3. */
function driveInMemory() {
  const versionText: Record<string, string> = {
    "1": "return 'one';",
    "2": 'return \'two\';\n/* Script Editor: {"description":"<div>Older</div>"} */\n',
  };
  const kept = [2, 1].map((version) => ({
    version,
    size: 10,
    type: "text/javascript",
    modifiedMs: 1_700_000_000_000 + version * 60_000,
    saved: true,
  }));
  const state = { code: "return 'three';", version: 3 };
  const restore = vi.fn(async (_id: string, version: number) => {
    state.code = versionText[String(version)] ?? "";
    state.version += 1;
  });
  const keep = vi.fn(async () => undefined);
  const write = vi.fn<ScriptEditorServer["write"]>(async (file, code) => {
    state.code = code;
    state.version += 1;
    return { ...file, version: state.version };
  });
  const server: ScriptEditorServer = {
    exportCopy: async (name) => ({ id: "e", name }),
    exportBundle: async (name) => ({ id: "b", name }),
    run: async () => ({ result: "", failed: false, log: [] }),
    dictionary: async () => ({ actions: [], globals: [] }),
    scripts: async () => [],
    open: async () => state.code,
    save: async (name) => ({ id: "s", path: `Documents/Scripts/${name}.js` }),
    fileHolding: async (id) => ({ id, name: "Kept.js", version: state.version }),
    write,
    versions: { list: async () => kept, restore, keep },
    rename: async (file) => file,
    move: async (file) => file,
    folders: async () => [],
    scriptsFolder: async () => "scripts",
  };
  return { server, restore, keep, write, versionText };
}

const scriptView = () => screen.getByRole("textbox", { name: "Script" });
const rowNow = (name: string) =>
  screen.queryAllByRole("menuitem", { name: new RegExp(`^${name}`) }).at(0);
async function revertRow(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("menuitem", { name: "File" }));
  const trigger = await waitFor(() => {
    const found = rowNow("Revert To");
    if (!found) throw new Error("no Revert To");
    return found;
  });
  return waitFor(() => {
    const found = rowNow(name);
    if (found) return found;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    throw new Error(`no row named ${name}`);
  });
}

async function opened(server: ScriptEditorServer) {
  requestOpenFile({ app: "script-editor", id: "f9", name: "Kept.js" });
  render(
    <>
      <Menus />
      <ScriptEditor
        server={server}
        defaultLanguage="JavaScript"
        defaultSource=""
        title="Untitled"
      />
    </>,
  );
  await waitFor(() => expect(scriptView().textContent).toBe("return 'three';"));
}

describe("Script Editor's File > Revert To", () => {
  it("goes back to the save before with Previous Save, naming the file's version", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { server, restore } = driveInMemory();
    await opened(server);
    const previous = await revertRow(user, "Previous Save");
    await waitFor(() => expect(previous).not.toHaveAttribute("aria-disabled", "true"));
    expect(rowNow("Last Saved")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(previous);
    await waitFor(() => expect(scriptView().textContent).toBe("return 'two';"));
    expect(restore).toHaveBeenCalledWith("f9", 2, 3);
  });

  it("saves the window's changes first, so the restore keeps them as a version", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { server, restore, write, keep } = driveInMemory();
    await opened(server);
    scriptView().textContent = "return 'unsaved';";
    fireEvent.input(scriptView());
    const previous = await revertRow(user, "Previous Save");
    await waitFor(() => expect(previous).not.toHaveAttribute("aria-disabled", "true"));
    fireEvent.click(previous);
    await waitFor(() => expect(scriptView().textContent).toBe("return 'two';"));
    expect(write.mock.calls[0]?.[1]).toBe("return 'unsaved';");
    expect(keep).toHaveBeenCalledWith("f9", 4);
    expect(restore).toHaveBeenCalledWith("f9", 2, 4);
  });

  it("shows the chosen version beside the script, and Restore makes it the window's", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { server, restore, versionText } = driveInMemory();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const asked = /versions\/f9\/(\d+)/.exec(String(url))?.[1];
        if (!asked) {
          return new Response(
            JSON.stringify({
              version: 3,
              modified_ms: 1_700_000_900_000,
              versions: [2, 1].map((version) => ({
                version,
                size: 10,
                type: "text/javascript",
                modified_ms: 1_700_000_000_000 + version * 60_000,
                saved: true,
              })),
            }),
          );
        }
        return new Response(versionText[asked] ?? "", { headers: { "x-file-pieces": "1" } });
      }),
    );
    await opened(server);
    const browse = await revertRow(user, "Browse All Versions");
    await waitFor(() => expect(browse).not.toHaveAttribute("aria-disabled", "true"));
    fireEvent.click(browse);
    const sheet = within(await screen.findByRole("dialog", { name: "Versions of “Kept.js”" }));
    expect(await sheet.findByText("return 'two';")).toBeInTheDocument();
    expect(sheet.getByText("return 'three';")).toBeInTheDocument();
    await user.click(sheet.getAllByRole("row")[1] as HTMLElement);
    expect(await sheet.findByText("return 'one';")).toBeInTheDocument();
    fireEvent.click(sheet.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(scriptView().textContent).toBe("return 'one';"));
    expect(restore).toHaveBeenCalledWith("f9", 1, 3);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
