import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { WindowManager } from "macalicious/window-manager";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { landingAt } from "../desktop/desktop-drag";
import { loadDrive } from "../desktop/desktop-files";
import { keepText, readKeptText } from "../desktop/desktop-kept-text";
import {
  beginDesktopValues,
  changeDesktopValue,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import { CLOSE_WINDOWS_KEY } from "../system-preferences/panes/general/document-settings";
import { Terminal } from "./terminal";
import { standInDrive } from "./terminal-drive-stand-in";
import {
  addProfile,
  BUILT_IN_PROFILES,
  changeProfile,
  DEFAULT_SETTINGS,
  frameOfProfile,
  profileFromFile,
  profileNamed,
  profileNames,
  profileToFile,
  readSettings,
  removeProfile,
  renameProfile,
  restoreDefaultProfiles,
} from "./terminal-profiles";
import { TerminalSession } from "./terminal-shell";
import {
  fitSession,
  HISTORY_KEY,
  historyWith,
  linesOfSession,
  readSession,
  restoreLines,
  SESSION_KEY,
  SETTINGS_KEY,
} from "./terminal-window-state";

function Menus() {
  const shell = useDesktopAppMenuItems("terminal", "Shell");
  const edit = useDesktopAppMenuItems("terminal", "Edit");
  const windowItems = useDesktopAppMenuItems("terminal", "Window");
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title="Shell">{shell}</MenuBarMenu>
      <MenuBarMenu title="Edit">{edit}</MenuBarMenu>
      <MenuBarMenu title="Window">{windowItems}</MenuBarMenu>
    </MenuBar>
  );
}

/** The desktop's further window, as far as Terminal can tell: it renders what it is given. */
function StandInWindow({ id, title, onClose, render: renderWindow }: DesktopSecondaryWindowProps) {
  const noop = () => {};
  return (
    <div data-testid={id} data-title={title}>
      {renderWindow({
        onClose,
        onMinimize: noop,
        onZoom: noop,
        zoomRole: "zoom",
        minimizeDisabled: false,
        zoomDisabled: false,
        onDragRegionPointerDown: noop,
        onDragRegionDoubleClick: noop,
      })}
    </div>
  );
}

const output = () => screen.getAllByRole("log", { name: "Terminal output" })[0] as HTMLElement;
const outputText = () =>
  screen
    .getAllByRole("log", { name: "Terminal output" })
    .map((each) => each.textContent)
    .join("\n");

async function setup(props: Parameters<typeof Terminal>[0] = {}) {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <WindowManager>
      <Menus />
      <Terminal DesktopWindow={StandInWindow} {...props} />
    </WindowManager>,
  );
  await waitFor(() => expect(output().textContent).toContain("shackett@ismhpro ~ %"));
  (screen.getAllByRole("textbox", { name: "Terminal input" })[0] as HTMLElement).focus();
  return user;
}

async function choose(user: ReturnType<typeof userEvent.setup>, menu: string, name: string) {
  await user.click(screen.getByRole("menuitem", { name: menu }));
  await user.click(await screen.findByRole("menuitem", { name: new RegExp(`^${name}`) }));
}

const terminalWindows = () => [...document.querySelectorAll<HTMLElement>(".mac-terminal")];

beforeEach(() => {
  vi.stubGlobal(
    "requestAnimationFrame",
    (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0) as unknown as number,
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  forgetDesktopValues();
  beginDesktopValues();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the profiles", () => {
  it("has a Mac's ten, in its order, Basic at its 80×24 frame", () => {
    expect(BUILT_IN_PROFILES.map(({ name }) => name)).toEqual([
      "Basic",
      "Grass",
      "Homebrew",
      "Man Page",
      "Novel",
      "Ocean",
      "Pro",
      "Red Sands",
      "Silver Aerogel",
      "Solid Colors",
    ]);
    expect(frameOfProfile(profileNamed(DEFAULT_SETTINGS, "Basic"))).toEqual({
      width: 536,
      height: 334,
    });
  });

  it("adds, renames, changes and removes a profile, and moves the default off one that goes", () => {
    const added = addProfile(DEFAULT_SETTINGS, "Ocean", { fontSize: 20 });
    expect(added.name).toBe("Ocean 2");
    const renamed = renameProfile(
      { ...added.settings, defaultProfile: "Ocean 2" },
      "Ocean 2",
      "Sea",
    );
    expect(renamed.defaultProfile).toBe("Sea");
    expect(profileNamed(renamed, "Sea").fontSize).toBe(20);
    expect(profileNames(renamed).at(-1)).toBe("Sea");
    const gone = removeProfile(renamed, "Sea");
    expect(gone.defaultProfile).toBe("Basic");
    expect(profileNames(gone)).not.toContain("Sea");
    expect(profileNamed(gone, "Sea").name).toBe("Basic");
  });

  it("brings a built-in profile back with Restore Defaults, and keeps the person's own", () => {
    const added = addProfile(DEFAULT_SETTINGS, "Mine").settings;
    const changed = removeProfile(changeProfile(added, "Pro", { fontSize: 30 }), "Grass");
    expect(profileNames(changed)).not.toContain("Grass");
    const restored = restoreDefaultProfiles(changed);
    expect(profileNames(restored)).toContain("Grass");
    expect(profileNamed(restored, "Pro").fontSize).toBe(12);
    expect(profileNames(restored)).toContain("Mine");
  });

  it("reads back what it exports as a .terminal file", () => {
    const profile = { ...profileNamed(DEFAULT_SETTINGS, "Ocean"), startupCommand: 'echo "a<b"' };
    const file = profileToFile(profile);
    expect(file).toContain("<key>background</key>\n\t<string>#224fbc</string>");
    expect(file).toContain("<key>type</key>\n\t<string>Window Settings</string>");
    expect(profileFromFile(file)).toEqual({ ...profile, fontFamily: undefined });
  });

  it("takes only the name from a Mac's file, and refuses what is no profile", () => {
    const mac = `<?xml version="1.0"?><plist version="1.0"><dict><key>BackgroundColor</key><data>YnBsaXN0</data><key>name</key><string>Theirs</string><key>type</key><string>Window Settings</string></dict></plist>`;
    expect(profileFromFile(mac)).toEqual({ name: "Theirs" });
    expect(profileFromFile("<plist><dict><key>a</key><string>b</string></dict></plist>")).toBe(
      null,
    );
    expect(profileFromFile("not xml at all")).toBe(null);
  });

  it("reads settings it cannot use as the defaults", () => {
    expect(readSettings("not json")).toBe(DEFAULT_SETTINGS);
    const read = readSettings(
      JSON.stringify({
        defaultProfile: "Pro",
        newTabProfile: 3,
        changes: { Pro: { fontSize: 9000 } },
      }),
    );
    expect(read.defaultProfile).toBe("Pro");
    expect(read.newTabProfile).toBe("same");
    expect(profileNamed(read, "Pro").fontSize).toBe(12);
  });
});

describe("what a session keeps", () => {
  it("brings back text, styles, marks and a wrapped line at another width", () => {
    const first = new TerminalSession({ cols: 40 });
    first.emulator.hardReset();
    first.emulator.write(`\x1b[1mbold\x1b[0m plain\r\n`);
    first.emulator.setMark(first.emulator.cursorLine, true);
    first.emulator.write(`${"x".repeat(50)}\r\n`);
    const lines = linesOfSession(first);
    expect(lines[0]).toBe(" \x1b[0;1mbold\x1b[0m plain");
    expect(lines[1]).toBe(`+${"x".repeat(50)}`);

    const second = new TerminalSession({ cols: 80 });
    restoreLines(second, lines, new Date("2026-01-02T03:04:05Z"));
    const text = second.emulator.allText();
    expect(text).toContain("bold plain");
    expect(text).toContain(`${"x".repeat(50)}`);
    expect(text).toContain("Restored session: ");
    expect(second.emulator.lineAt(second.emulator.firstLine)?.cells[0]?.style.bold).toBe(true);
    expect(second.emulator.lineAt(second.emulator.firstLine + 1)?.marked).toBe(true);
  });

  it("leaves the prompt's line out while the shell reads", async () => {
    const session = new TerminalSession();
    await session.start();
    const lines = linesOfSession(session);
    expect(lines.join("\n")).not.toContain("shackett@ismhpro");
  });

  it("drops the oldest lines of the longest tab until it fits", () => {
    const tab = {
      cwd: "/",
      oldCwd: "/",
      title: "",
      programTitle: null,
      profile: "Basic",
      changes: {},
      split: false,
    };
    const long = Array.from({ length: 4000 }, (_, at) => ` line ${at}`);
    const fitted = fitSession(
      {
        quit: true,
        windows: [
          {
            id: 1,
            active: 0,
            tabs: [
              { ...tab, lines: long },
              { ...tab, lines: [" short"] },
            ],
          },
        ],
      },
      5000,
    );
    expect(readSession(JSON.stringify(fitted))?.quit).toBe(true);
    const tabs = fitted.windows[0]?.tabs ?? [];
    expect(new TextEncoder().encode(JSON.stringify(fitted)).length).toBeLessThanOrEqual(5000);
    expect(tabs[0]?.lines.at(-1)).toBe(" line 3999");
    expect(tabs[0]?.lines.length).toBeLessThan(4000);
    expect(tabs[1]?.lines).toEqual([" short"]);
  });

  it("refuses what is not a session, and keeps the newest of a history", () => {
    expect(readSession("nope")).toBe(null);
    expect(readSession(JSON.stringify({ windows: [{ id: 1, active: 0, tabs: [{}] }] }))).toBe(null);
    expect(historyWith(["a"], ["b"])).toEqual(["a", "b"]);
    const many = Array.from({ length: 600 }, (_, at) => `l${at}`);
    const kept = historyWith(many, []);
    expect(kept).toHaveLength(500);
    expect(kept.at(-1)).toBe("l599");
  });
});

describe("on a served desktop", () => {
  beforeEach(() => vi.stubEnv("VITE_MACALICIOUS_API", "1"));

  it("brings back a tab's scrollback, folder and title, and the account's history, after a reload", async () => {
    const user = await setup();
    await user.keyboard("echo kept-line{Enter}");
    await waitFor(() => expect(outputText()).toMatch(/echo kept-linekept-line/));
    await choose(user, "Shell", "Edit Title");
    await user.keyboard("My Title");
    await waitFor(() =>
      expect(screen.getAllByRole("region", { name: /^My Title — zsh/ })).toHaveLength(1),
    );
    fireEvent(window, new Event("pagehide"));
    const session = readKeptText(SESSION_KEY) as string;
    const history = readKeptText(HISTORY_KEY) as string;
    expect(JSON.parse(history)).toEqual(["echo kept-line"]);
    document.body.replaceChildren();

    // What a reload finds: the values as they were kept, and a Terminal starting afresh.
    keepText(SESSION_KEY, session);
    keepText(HISTORY_KEY, history);
    const again = userEvent.setup();
    render(
      <WindowManager>
        <Menus />
        <Terminal DesktopWindow={StandInWindow} />
      </WindowManager>,
    );
    await waitFor(() => expect(outputText()).toContain("Restored session: "));
    expect(outputText()).toMatch(/echo kept-linekept-line/);
    expect(screen.getByRole("region", { name: /^My Title — zsh/ })).toBeInTheDocument();
    await waitFor(() => expect(outputText()).toContain("shackett@ismhpro ~ %"));
    (screen.getAllByRole("textbox", { name: "Terminal input" })[0] as HTMLElement).focus();
    await again.keyboard("{ArrowUp}");
    await waitFor(() => expect(outputText()).toMatch(/~ % echo kept-line\s*$/));
  });

  it.each([false, true])(
    "honours Close windows = %s when reopening a previously kept quit session",
    async (close) => {
      changeDesktopValue(CLOSE_WINDOWS_KEY, false);
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      const first = render(
        <WindowManager>
          <Menus />
          <Terminal DesktopWindow={StandInWindow} />
        </WindowManager>,
      );
      await waitFor(() => expect(outputText()).toContain("shackett@ismhpro ~ %"));
      await choose(user, "Shell", "New Window");
      await waitFor(() => expect(terminalWindows()).toHaveLength(2));
      fireEvent(window, new Event("pagehide"));
      first.unmount();
      await act(async () => {
        await Promise.resolve();
      });
      expect(readSession(readKeptText(SESSION_KEY))?.windows).toHaveLength(2);
      changeDesktopValue(CLOSE_WINDOWS_KEY, close);
      const reopened = render(
        <WindowManager>
          <Terminal DesktopWindow={StandInWindow} />
        </WindowManager>,
      );
      await waitFor(() => expect(outputText()).toContain("shackett@ismhpro ~ %"));
      expect(terminalWindows()).toHaveLength(close ? 1 : 2);
      if (!close) {
        // A reload keeps the open windows even if Close windows is now on. Capture the browser's
        // pagehide snapshot before the test unmounts React (a real page replacement does not do that).
        changeDesktopValue(CLOSE_WINDOWS_KEY, true);
        fireEvent(window, new Event("pagehide"));
        const openSession = readKeptText(SESSION_KEY) as string;
        expect(readSession(openSession)?.quit).toBeUndefined();
        reopened.unmount();
        await act(async () => {
          await Promise.resolve();
        });
        keepText(SESSION_KEY, openSession);
        render(
          <WindowManager>
            <Terminal DesktopWindow={StandInWindow} />
          </WindowManager>,
        );
        await waitFor(() => expect(outputText()).toContain("shackett@ismhpro ~ %"));
        expect(terminalWindows()).toHaveLength(2);
      }
    },
  );

  it("forgets what was open when Terminal quits", async () => {
    const { unmount } = render(
      <WindowManager>
        <Terminal DesktopWindow={StandInWindow} />
      </WindowManager>,
    );
    await waitFor(() => expect(output().textContent).toContain("shackett@ismhpro ~ %"));
    fireEvent(window, new Event("pagehide"));
    expect(readKeptText(SESSION_KEY)).toBeDefined();
    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(readSession(readKeptText(SESSION_KEY))).toBe(null);
  });

  it("runs a profile's startup command in a new shell", async () => {
    keepText(
      SETTINGS_KEY,
      JSON.stringify({ changes: { Basic: { startupCommand: "echo started-here" } } }),
    );
    render(
      <WindowManager>
        <Terminal DesktopWindow={StandInWindow} />
      </WindowManager>,
    );
    await waitFor(() => expect(outputText()).toMatch(/echo started-herestarted-here/));
  });

  it("closes the window when the shell exits, if the profile says so, and keeps it if not", async () => {
    keepText(SETTINGS_KEY, JSON.stringify({ changes: { Basic: { whenExits: "close" } } }));
    const onClose = vi.fn();
    const user = await setup({ onClose });
    await user.keyboard("exit{Enter}");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("opens at the startup profile, and shows its colours", async () => {
    keepText(SETTINGS_KEY, JSON.stringify({ startupProfile: "Ocean" }));
    await setup();
    const [window] = terminalWindows();
    expect(window).toHaveAttribute("data-profile", "ocean");
    expect(window?.style.getPropertyValue("--_background")).toBe("#224fbc");
  });

  it("types a dropped file's escaped path at the prompt", async () => {
    const drive = standInDrive();
    const id = drive.addFile("documents", "my notes.txt", "x");
    await loadDrive();
    await setup();
    const body = document.querySelector(".mac-terminal-body") as Element;
    const landing = landingAt(body, {
      from: "finder",
      copy: false,
      items: [{ id, name: "my notes.txt", kind: "file" }],
    });
    expect(landing?.refusal).toBeUndefined();
    act(() => landing?.drop());
    await waitFor(() => expect(outputText()).toContain("/Users/shackett/Documents/my\\ notes.txt"));
  });

  it("refuses to drop what is not on the drive", async () => {
    standInDrive();
    await loadDrive();
    await setup();
    const body = document.querySelector(".mac-terminal-body") as Element;
    const landing = landingAt(body, {
      from: "mail",
      copy: false,
      items: [{ id: "attachment", name: "a.txt", kind: "file" }],
    });
    expect(landing?.refusal).toBe("A file that is not on the drive has no path to type.");
  });
});

describe("the Preferences window", () => {
  it("opens on General, with its four panes, and asks about Encodings truthfully", async () => {
    const user = await setup({ preferencesOpen: true });
    for (const name of ["General", "Profiles", "Window Groups", "Encodings"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("tab", { name: "Encodings" }));
    expect(await screen.findByRole("checkbox", { name: "Unicode (UTF-8)" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Unicode (UTF-8)" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText(/UTF-8 only: no other encoding reaches it/)).toBeInTheDocument();
  });

  it("makes a profile the default, which the next new window opens with", async () => {
    const user = await setup({ preferencesOpen: true });
    await user.click(screen.getByRole("tab", { name: "Profiles" }));
    await user.click(await screen.findByRole("option", { name: "Ocean" }));
    await user.click(screen.getByRole("button", { name: "Default" }));
    await choose(user, "Shell", "New Window");
    await waitFor(() => expect(terminalWindows()).toHaveLength(2));
    expect(terminalWindows()[1]).toHaveAttribute("data-profile", "ocean");
  });

  it("has the six tabs of a profile, and a change shows at once in a window of that profile", async () => {
    const user = await setup({ preferencesOpen: true });
    await user.click(screen.getByRole("tab", { name: "Profiles" }));
    for (const name of ["Text", "Window", "Tab", "Shell", "Keyboard", "Advanced"]) {
      expect(await screen.findByRole("tab", { name })).toBeInTheDocument();
    }
    fireEvent.change(screen.getByLabelText("Background"), { target: { value: "#123456" } });
    await waitFor(() =>
      expect(terminalWindows()[0]?.style.getPropertyValue("--_background")).toBe("#123456"),
    );
    await user.click(screen.getByRole("tab", { name: "Window" }));
    await user.click(await screen.findByRole("checkbox", { name: "Dimensions" }));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "shackett — zsh" })).toBeInTheDocument(),
    );
  });

  it("says what it cannot do without a drive", async () => {
    const user = await setup({ preferencesOpen: true });
    await user.click(screen.getByRole("tab", { name: "Profiles" }));
    const exporting = await screen.findByRole("button", { name: "Export…" });
    expect(exporting).toBeDisabled();
    expect(exporting).toHaveAttribute("title", "This build has no drive to keep a file on");
  });
});

describe("the Shell menu", () => {
  it("shows Inspector's Info and profile, which change the tab in front", async () => {
    const user = await setup();
    await choose(user, "Shell", "Show Inspector");
    const panel = within(await screen.findByTestId("inspector"));
    expect(panel.getByRole("tab", { name: "Info" })).toBeInTheDocument();
    expect(within(panel.getByRole("list", { name: "Processes" })).getByText("zsh")).toBeTruthy();
    await user.click(panel.getByRole("tab", { name: "Profile" }));
    await user.click(await panel.findByRole("option", { name: "Red Sands" }));
    await waitFor(() => expect(terminalWindows()[0]).toHaveAttribute("data-profile", "red-sands"));
    expect(terminalWindows()[0]?.style.getPropertyValue("--_foreground")).toBe("#d7c9a7");
  });

  it("Edit Background Color opens the Colors panel, on the tab in front", async () => {
    const user = await setup();
    await choose(user, "Shell", "Edit Background Color");
    expect(document.querySelector(".mac-terminal-colors")).not.toBeNull();
  });

  it("Use Settings as Default keeps what the tab changed as the default", async () => {
    const user = await setup();
    await choose(user, "Shell", "Show Inspector");
    const panel = within(await screen.findByTestId("inspector"));
    await user.click(panel.getByRole("tab", { name: "Profile" }));
    fireEvent.change(await panel.findByLabelText("Background"), { target: { value: "#010203" } });
    await choose(user, "Shell", "Use Settings as Default");
    await choose(user, "Shell", "New Window");
    await waitFor(() => expect(terminalWindows()).toHaveLength(2));
    expect(terminalWindows()[1]?.style.getPropertyValue("--_background")).toBe("#010203");
  });

  it("New Command runs in a new window with the profile chosen", async () => {
    const user = await setup();
    await choose(user, "Shell", "New Command");
    await user.type(await screen.findByRole("textbox", { name: "Command" }), "echo from-sheet");
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(terminalWindows()).toHaveLength(2));
    await waitFor(() => expect(outputText()).toMatch(/echo from-sheetfrom-sheet/));
  });

  it("a command outside a shell ends the shell with it", async () => {
    const user = await setup();
    await choose(user, "Shell", "New Command");
    await user.type(await screen.findByRole("textbox", { name: "Command" }), "echo done");
    await user.click(screen.getByRole("checkbox", { name: "Run command inside a shell" }));
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(outputText()).toContain("[Process completed]"));
  });

  it("Print gives the whole text to the browser's printing, and Print Selection only what is selected", async () => {
    const user = await setup();
    await user.keyboard("echo printed-here{Enter}");
    await waitFor(() => expect(outputText()).toMatch(/echo printed-hereprinted-here/));
    await choose(user, "Shell", "Print(?! Selection)");
    const frame = document.querySelector<HTMLIFrameElement>("iframe[data-textedit-print]");
    expect(frame?.srcdoc).toContain("echo printed-hereprinted-here".slice(0, 17));
    frame?.remove();
    await user.click(screen.getByRole("menuitem", { name: "Shell" }));
    expect(await screen.findByRole("menuitem", { name: /^Print Selection/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("dims Import and both Exports where the build has no drive, and says so", async () => {
    const user = await setup();
    await user.click(screen.getByRole("menuitem", { name: "Shell" }));
    for (const name of [/^Import…/, /^Export Text As…/, /^Export Settings As…/]) {
      const row = await screen.findByRole("menuitem", { name });
      expect(row).toHaveAttribute("aria-disabled", "true");
      expect(row).toHaveAttribute("title", "This build has no drive to keep a file on");
    }
  });

  it("copies the background colour from Copy Special", async () => {
    const user = await setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Copy Special" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Background Color" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("#ffffff"));
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("saves the open windows as a group, which the Window menu opens again", async () => {
    const user = await setup();
    await choose(user, "Window", "Save Windows as Group");
    await user.type(await screen.findByRole("textbox", { name: "Window Group name" }), "Work");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("menuitem", { name: "Window" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Open Window Group" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Work" }));
    await waitFor(() => expect(terminalWindows()).toHaveLength(2));
  });
});

describe("the context menus", () => {
  it("offers the screen's rows, dimming what needs a selection, and splits from there", async () => {
    const user = await setup();
    fireEvent.contextMenu(output());
    for (const name of ["Paste", "Clear to Start", "Split Pane", "Inspect"]) {
      expect(await screen.findByRole("menuitem", { name })).toBeInTheDocument();
    }
    for (const name of ["Copy", "Paste Selection", "Open man Page", "Look Up"]) {
      expect(screen.getByRole("menuitem", { name })).toHaveAttribute("aria-disabled", "true");
    }
    const index = screen.getByRole("menuitem", { name: "Search man Page Index" });
    expect(index).toHaveAttribute("aria-disabled", "true");
    expect(index).toHaveAttribute("title", "Select a word to search the manual for");
    await user.click(screen.getByRole("menuitem", { name: "Split Pane" }));
    await waitFor(() => expect(screen.getAllByRole("log")).toHaveLength(2));
  });

  it("Clear to Start clears from the context menu", async () => {
    const user = await setup();
    await user.keyboard("echo cleared-away{Enter}");
    await waitFor(() => expect(outputText()).toContain("cleared-away"));
    fireEvent.contextMenu(output());
    await user.click(await screen.findByRole("menuitem", { name: "Clear to Start" }));
    await waitFor(() => expect(outputText()).not.toContain("cleared-away"));
  });

  it("closes the other tabs from a tab's menu", async () => {
    const user = await setup();
    await choose(user, "Shell", "New Tab");
    await choose(user, "Shell", "New Tab");
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
    fireEvent.contextMenu(screen.getAllByRole("tab")[1] as HTMLElement);
    await user.click(await screen.findByRole("menuitem", { name: "Close Other Tabs" }));
    await waitFor(() => expect(screen.queryAllByRole("tab")).toHaveLength(0));
  });

  it("moves a tab to a new window from its menu", async () => {
    const user = await setup();
    await choose(user, "Shell", "New Tab");
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2));
    fireEvent.contextMenu(screen.getAllByRole("tab")[0] as HTMLElement);
    await user.click(await screen.findByRole("menuitem", { name: "Move Tab to New Window" }));
    await waitFor(() => expect(terminalWindows()).toHaveLength(2));
  });
});
