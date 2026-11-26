import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { standInDrive } from "../terminal/terminal-drive-stand-in";

/*
 * The Script menu as a person uses it. The drive's routes and the run route are stand-ins for the
 * server's: this proves the menu's list and what it asks the server to run, not the server.
 */

let drive: ReturnType<typeof standInDrive>;
let ran: string[];

async function showMenu() {
  const { ScriptMenu } = await import("./desktop-menu-extras");
  const { SCRIPT_MENU_SETTING } = await import("../script-editor/script-editor-server");
  const { changeDesktopValue } = await import("./desktop-personal");
  changeDesktopValue(SCRIPT_MENU_SETTING, true);
  render(<ScriptMenu titleProps={undefined} />);
  return (shown: boolean) => changeDesktopValue(SCRIPT_MENU_SETTING, shown);
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: "Script Menu" }));
  return screen.findByRole("menu", { name: "Script Menu" });
};

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  drive = standInDrive();
  ran = [];
  const forDrive = fetch;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      if (String(input).endsWith("/api/script-editor/run")) {
        ran.push((JSON.parse(init.body as string) as { code: string }).code);
        return new Response(JSON.stringify({ outcome: "completed", result: 42, logs: [] }), {
          headers: { "content-type": "application/json" },
        });
      }
      return forDrive(input, init);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the Script menu", () => {
  it("lists nothing without its setting", async () => {
    const { ScriptMenu } = await import("./desktop-menu-extras");
    render(<ScriptMenu titleProps={undefined} />);
    expect(screen.queryByRole("button", { name: "Script Menu" })).toBeNull();
  });

  it("says when there are no scripts", async () => {
    const user = userEvent.setup();
    await showMenu();
    const menu = await openMenu(user);
    expect(within(menu).getByRole("menuitem", { name: "No Scripts" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(menu).getByRole("menuitem", { name: "Open Scripts Folder" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("lists the scripts folder, by name and without other files, and runs the one chosen", async () => {
    const scripts = drive.addFolder("documents", "Scripts");
    drive.addFile(scripts, "Zebra.js", "1 + 1");
    drive.addFile(scripts, "Apple.js", "40 + 2");
    drive.addFile(scripts, "notes.txt", "not a script");
    drive.addFolder(scripts, "Nothing Here");
    const user = userEvent.setup();
    await showMenu();
    const menu = await openMenu(user);
    await within(menu).findByRole("menuitem", { name: "Apple" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((row) => row.textContent),
    ).toEqual(["Open Script Editor", "Open Scripts Folder", "Apple", "Zebra"]);
    await user.click(within(menu).getByRole("menuitem", { name: "Apple" }));
    await waitFor(() => expect(ran).toEqual(["40 + 2"]));
    const again = await openMenu(user);
    expect(await within(again).findByRole("menuitem", { name: "“Apple”: 42" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("shows why an AppleScript that cannot run stopped, without running it", async () => {
    const scripts = drive.addFolder("documents", "Scripts");
    drive.addFile(scripts, "Bad.applescript", "this is not ) a script (");
    const user = userEvent.setup();
    await showMenu();
    await user.click(await within(await openMenu(user)).findByRole("menuitem", { name: "Bad" }));
    const again = await openMenu(user);
    expect((await within(again).findByRole("menuitem", { name: /stopped/ })).textContent).toMatch(
      /^“Bad” stopped: /,
    );
    expect(ran).toEqual([]);
  });

  it("goes when its setting goes", async () => {
    const setShown = await showMenu();
    await screen.findByRole("button", { name: "Script Menu" });
    act(() => setShown(false));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Script Menu" })).toBeNull());
  });
});
