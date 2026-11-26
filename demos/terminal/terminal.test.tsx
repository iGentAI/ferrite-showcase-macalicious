import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuItem } from "macalicious/menu-item";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { Terminal } from "./terminal";
import { TerminalScreen } from "./terminal-screen";
import { TerminalSession } from "./terminal-shell";

/*
 * The window as a person uses it, with its menus filled from the desktop's registry as the menu bar
 * fills them. This build has no drive: what the shell does on one is in `terminal-shell.test.ts`.
 */

function Menus() {
  const application = useDesktopAppMenuItems("terminal", "Terminal");
  const shell = useDesktopAppMenuItems("terminal", "Shell");
  const edit = useDesktopAppMenuItems("terminal", "Edit");
  const view = useDesktopAppMenuItems("terminal", "View");
  const windowItems = useDesktopAppMenuItems("terminal", "Window");
  const none = <MenuItem disabled>None</MenuItem>;
  return (
    <MenuBar modal={false} aria-label="Desktop menus">
      <MenuBarMenu title="Terminal">{application ?? none}</MenuBarMenu>
      <MenuBarMenu title="Shell">{shell ?? none}</MenuBarMenu>
      <MenuBarMenu title="Edit">{edit ?? none}</MenuBarMenu>
      <MenuBarMenu title="View">{view ?? none}</MenuBarMenu>
      <MenuBarMenu title="Window">{windowItems ?? none}</MenuBarMenu>
    </MenuBar>
  );
}

const input = () => screen.getByRole("textbox", { name: "Terminal input" });
const output = () => screen.getByRole("log", { name: "Terminal output" });
const tabs = () => screen.queryAllByRole("tab");

async function setup(props: Parameters<typeof Terminal>[0] = {}) {
  const user = userEvent.setup();
  render(
    <>
      <Menus />
      <Terminal {...props} />
    </>,
  );
  await waitFor(() => expect(output().textContent).toContain("shackett@ismhpro ~ %"));
  input().focus();
  return user;
}

async function choose(user: ReturnType<typeof userEvent.setup>, menu: string, name: string) {
  await user.click(screen.getByRole("menuitem", { name: menu }));
  await user.click(await screen.findByRole("menuitem", { name: new RegExp(`^${name}`) }));
}

const pretendMac = () => {
  vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
};

beforeEach(() => {
  vi.stubGlobal(
    "requestAnimationFrame",
    (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0) as unknown as number,
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const CLOSE = "Close(?! )";

describe("closing what runs", () => {
  it("asks before closing a tab whose command runs, and Cancel keeps it", async () => {
    const user = await setup();
    await choose(user, "Shell", "New Tab");
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await user.keyboard("sleep 100{Enter}");
    await waitFor(() => expect(screen.getAllByRole("tab")[1]?.textContent).toContain("sleep"));
    await choose(user, "Shell", CLOSE);
    expect(
      await screen.findByText("Do you want to terminate running processes in this tab?"),
    ).toBeTruthy();
    expect(screen.getByText(/will terminate the running processes: sleep/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(tabs()).toHaveLength(2);
    await choose(user, "Shell", CLOSE);
    await user.click(await screen.findByRole("button", { name: "Terminate" }));
    await waitFor(() => expect(tabs()).toHaveLength(0));
  });

  it("closes at once when nothing runs", async () => {
    const user = await setup();
    await choose(user, "Shell", "New Tab");
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await choose(user, "Shell", CLOSE);
    await waitFor(() => expect(tabs()).toHaveLength(0));
    expect(screen.queryByRole("button", { name: "Terminate" })).toBeNull();
  });
});

describe("the rows a page cannot carry out", () => {
  it("dims Allow Mouse Reporting, saying why", async () => {
    const user = await setup();
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    const row = await screen.findByRole("menuitem", { name: "Allow Mouse Reporting" });
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row.getAttribute("title")).toBe(
      "No program in this shell reads the mouse, so nothing would hear it.",
    );
  });
});

describe("the window", () => {
  it("says what it is on its first line, and names itself as Terminal does", async () => {
    await setup();
    expect(output().textContent).toContain(
      "This is a simulated shell in the page. This build has no drive.",
    );
    expect(screen.getByRole("region", { name: "shackett — zsh — 80×24" })).toBeInTheDocument();
  });

  it("takes what is typed, and shows what the command wrote", async () => {
    const user = await setup();
    await user.keyboard("echo hello{Enter}");
    await waitFor(() => expect(output().textContent).toContain("echo hello"));
    await waitFor(() => expect(output().textContent).toMatch(/echo hellohello/));
  });

  it("names the window after the folder it is in", async () => {
    const user = await setup();
    await user.keyboard("cd /{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "/ — zsh — 80×24" })).toBeInTheDocument(),
    );
  });

  it("gives Control and a letter to the shell off a Mac", async () => {
    const user = await setup();
    await user.keyboard("half{Control>}c{/Control}");
    await waitFor(() => expect(output().textContent).toContain("half^C"));
  });
});

describe("Shell", () => {
  it("dims Secure Keyboard Entry and says why", async () => {
    const user = await setup();
    await user.click(screen.getByRole("menuitem", { name: "Terminal" }));
    const item = await screen.findByRole("menuitem", { name: "Secure Keyboard Entry" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAccessibleDescription("A page cannot keep its keys from the browser");
  });

  it("dims New Remote Connection and says why", async () => {
    const user = await setup();
    await user.click(screen.getByRole("menuitem", { name: "Shell" }));
    const item = await screen.findByRole("menuitem", { name: /^New Remote Connection/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveAccessibleDescription("This page cannot reach other computers");
  });

  it("opens a tab from the menu, in the same folder, and shows the tab bar", async () => {
    const user = await setup();
    await user.keyboard("cd /{Enter}");
    await waitFor(() => expect(screen.getByRole("region", { name: /^\/ / })).toBeInTheDocument());
    expect(tabs()).toHaveLength(0);
    await choose(user, "Shell", "New Tab");
    await waitFor(() => expect(tabs()).toHaveLength(2));
    expect(tabs()[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs()[1]).toHaveTextContent("/ — zsh");
  });

  it("opens and closes tabs from the keys on a Mac, each with its own shell", async () => {
    pretendMac();
    const user = await setup();
    await user.keyboard("{Meta>}t{/Meta}");
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await waitFor(() => expect(input()).toHaveFocus());
    await user.keyboard("echo second{Enter}");
    await waitFor(() => expect(output().textContent).toContain("second"));
    await user.click(tabs()[0] as HTMLElement);
    await waitFor(() => expect(output().textContent).not.toContain("echo second"));
    await user.click(tabs()[1] as HTMLElement);
    await waitFor(() => expect(output().textContent).toContain("echo second"));
    input().focus();
    await user.keyboard("{Meta>}w{/Meta}");
    await waitFor(() => expect(tabs()).toHaveLength(0));
    expect(output().textContent).not.toContain("echo second");
  });

  it("goes to the next and the previous tab with Control-Tab", async () => {
    pretendMac();
    const user = await setup();
    await user.keyboard("{Meta>}t{/Meta}");
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await waitFor(() => expect(input()).toHaveFocus());
    await user.keyboard("{Control>}{Tab}{/Control}");
    await waitFor(() => expect(tabs()[0]).toHaveAttribute("aria-selected", "true"));
    await waitFor(() => expect(input()).toHaveFocus());
    await user.keyboard("{Control>}{Shift>}{Tab}{/Shift}{/Control}");
    await waitFor(() => expect(tabs()[1]).toHaveAttribute("aria-selected", "true"));
  });

  it("closes the window with the last tab", async () => {
    pretendMac();
    const onClose = vi.fn();
    const user = await setup({ onClose });
    await user.keyboard("{Meta>}w{/Meta}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("resets with Send Hard Reset, the prompt back on a clear screen", async () => {
    const user = await setup();
    await user.keyboard("echo gone{Enter}");
    await waitFor(() => expect(output().textContent).toContain("echo gone"));
    await choose(user, "Shell", "Send Hard Reset");
    await waitFor(() => expect(output().textContent).not.toContain("echo gone"));
    expect(output().textContent).toContain("shackett@ismhpro ~ %");
  });
});

describe("View", () => {
  it("splits a pane on one session, both showing it, and closes the split", async () => {
    pretendMac();
    const user = await setup();
    await user.keyboard("echo both{Enter}");
    await waitFor(() => expect(output().textContent).toContain("echo both"));
    await user.keyboard("{Meta>}d{/Meta}");
    await waitFor(() => expect(screen.getAllByRole("log")).toHaveLength(2));
    for (const pane of screen.getAllByRole("log")) {
      await waitFor(() => expect(pane.textContent).toContain("echo both"));
    }
    expect(screen.getByRole("separator", { name: "Split pane divider" })).toBeInTheDocument();
    await user.keyboard("{Meta>}{Shift>}d{/Shift}{/Meta}");
    await waitFor(() => expect(screen.getAllByRole("log")).toHaveLength(1));
  });

  it("makes the text bigger and smaller, and back", async () => {
    const user = await setup();
    const size = () =>
      (document.querySelector(".mac-terminal-screen") as HTMLElement).style.getPropertyValue(
        "--_font-size",
      );
    expect(size()).toBe("11px");
    await choose(user, "View", "Bigger");
    await waitFor(() => expect(size()).toBe("12px"));
    await choose(user, "View", "Smaller");
    await choose(user, "View", "Smaller");
    await waitFor(() => expect(size()).toBe("10px"));
    await choose(user, "View", "Default Font Size");
    await waitFor(() => expect(size()).toBe("11px"));
  });
});

describe("the wheel", () => {
  const wheeled = (setup: string) => {
    const session = new TerminalSession();
    session.emulator.write(setup);
    const input = vi.spyOn(session, "input").mockImplementation(() => {});
    render(
      <TerminalScreen
        session={session}
        fontSize={11}
        active
        showMarks={false}
        optionAsMeta={false}
      />,
    );
    const target = document.querySelector(".mac-terminal-screen") as HTMLElement;
    fireEvent.wheel(target, { deltaY: -1 });
    fireEvent.wheel(target, { deltaY: 1 });
    const lines = document.querySelector(".mac-terminal-lines") as HTMLElement;
    fireEvent.pointerDown(lines, { button: 0 });
    fireEvent.pointerMove(lines);
    fireEvent.pointerUp(lines, { button: 0 });
    return input.mock.calls.map(([bytes]) => bytes);
  };

  it.each(["\x1b[?1049h", "\x1b[?1049h\x1b[?1003h\x1b[?1006h"])(
    "sends only arrows on the alternate screen, whatever a program asked: %j",
    (setup) => {
      expect(wheeled(setup)).toEqual(["\x1b[A", "\x1b[B"]);
    },
  );

  it.each(["", "\x1b[?1003h\x1b[?1006h"])(
    "sends nothing on the main screen, whatever a program asked: %j",
    (setup) => {
      expect(wheeled(setup)).toEqual([]);
    },
  );
});

describe("Edit", () => {
  it("selects a word by a double click and a line by a triple click, and copies them", async () => {
    const user = await setup();
    const viewport = document.querySelector(".mac-terminal-viewport") as HTMLElement;
    const clicks = (keys: string) =>
      user.pointer({
        keys,
        target: output(),
        // No layout here: the view is scrolled to its end, and the first row is that far above.
        coords: { clientX: 20, clientY: 2 - viewport.scrollTop },
      });
    await clicks("[MouseLeft][MouseLeft]");
    await waitFor(() =>
      expect(
        Number.parseFloat(
          (document.querySelector(".mac-terminal-selection") as HTMLElement).style.width,
        ),
      ).toBeCloseTo(26.4),
    );
    await user.keyboard("{Control>}c{/Control}");
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe("This"));
    await user.click(document.body);
    await clicks("[MouseLeft][MouseLeft][MouseLeft]");
    input().focus();
    await user.keyboard("{Control>}c{/Control}");
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe(
        "This is a simulated shell in the page. This build has no drive.",
      ),
    );
  });

  it("copies what Select All selected", async () => {
    const user = await setup();
    await choose(user, "Edit", "Select All");
    await waitFor(() =>
      expect(document.querySelector(".mac-terminal-selection")).toBeInTheDocument(),
    );
    await choose(user, "Edit", "Copy(?! Special)");
    await waitFor(async () =>
      expect(await navigator.clipboard.readText()).toContain("This is a simulated shell"),
    );
  });

  it("dims Copy while nothing is selected, and Undo with its reason", async () => {
    const user = await setup();
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(await screen.findByRole("menuitem", { name: /^Copy(?! Special)/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /^Undo/ })).toHaveAccessibleDescription(
      "Use the shell's Control keys instead",
    );
  });

  it("pastes into the line without running it, and runs it at Return", async () => {
    const user = await setup();
    await user.paste("echo pasted");
    await waitFor(() => expect(output().textContent).toContain("echo pasted"));
    expect(output().textContent).not.toMatch(/echo pastedpasted/);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(output().textContent).toMatch(/echo pastedpasted/));
  });

  it("does not let a paste end itself and run what follows its end marker", async () => {
    const user = await setup();
    await user.paste("echo one\x1b[201~two\r");
    await waitFor(() => expect(output().textContent).toContain("echo onetwo"));
    expect(output().textContent).not.toMatch(/\nonetwo/);
  });

  it("pastes through Paste Selection what the window has selected", async () => {
    pretendMac();
    const user = await setup();
    await user.keyboard("{Meta>}f{/Meta}");
    const find = await screen.findByRole("searchbox", { name: "Find" });
    await user.type(find, "simulated");
    await waitFor(() =>
      expect(document.querySelector(".mac-terminal-selection")).toBeInTheDocument(),
    );
    await user.keyboard("{Escape}");
    await choose(user, "Edit", "Paste Selection");
    await waitFor(() => expect(output().textContent).toContain("% simulated"));
  });

  it("finds text past a wide character, and selects exactly what it found", async () => {
    pretendMac();
    const user = await setup();
    await user.keyboard("echo 界abc{Enter}");
    await waitFor(() => expect(output().textContent).toContain("echo 界abc"));
    await user.keyboard("{Meta>}f{/Meta}");
    const find = await screen.findByRole("searchbox", { name: "Find" });
    await user.type(find, "abc");
    await waitFor(() =>
      expect(document.querySelector(".mac-terminal-selection")).toBeInTheDocument(),
    );
    await user.keyboard("{Escape}");
    await choose(user, "Edit", "Copy(?! Special)");
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe("abc"));
  });

  it("dims Paste with its reason where the browser has no clipboard to read", async () => {
    const user = await setup();
    const kept = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    try {
      await choose(user, "Edit", "Paste(?! )");
      await user.click(screen.getByRole("menuitem", { name: "Edit" }));
      const paste = await screen.findByRole("menuitem", { name: /^Paste(?! )/ });
      await waitFor(() => expect(paste).toHaveAttribute("aria-disabled", "true"));
      expect(paste).toHaveAttribute(
        "title",
        "The browser does not let the page read the clipboard from a menu; the keyboard's Paste still works",
      );
    } finally {
      if (kept) Object.defineProperty(navigator, "clipboard", kept);
    }
  });

  it("finds text, and says when there is none", async () => {
    pretendMac();
    const user = await setup();
    await user.keyboard("{Meta>}f{/Meta}");
    const find = await screen.findByRole("searchbox", { name: "Find" });
    await user.type(find, "page");
    await waitFor(() =>
      expect(document.querySelector(".mac-terminal-selection")).toBeInTheDocument(),
    );
    await user.clear(find);
    await user.type(find, "zzzz");
    expect(await screen.findByRole("status")).toHaveTextContent("Not found");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("searchbox")).not.toBeInTheDocument());
    await waitFor(() => expect(input()).toHaveFocus());
  });

  it("clears the screen, keeping it in the scrollback, and the scrollback", async () => {
    const user = await setup();
    await user.keyboard("echo old{Enter}");
    await waitFor(() => expect(output().textContent).toContain("echo old"));
    await choose(user, "Edit", "Clear Scrollback");
    await choose(user, "Edit", "Clear to Start");
    await act(async () => {});
    await waitFor(() => expect(output().textContent).not.toContain("echo old"));
    expect(output().textContent).toContain("shackett@ismhpro ~ %");
  });
});

describe("Window", () => {
  it("dims the commands one window cannot do", async () => {
    const user = await setup();
    await user.click(screen.getByRole("menuitem", { name: "Window" }));
    expect(await screen.findByRole("menuitem", { name: /^Show Next Tab/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /^Merge All Windows/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
