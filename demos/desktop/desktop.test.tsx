import { existsSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InspectorPanel } from "macalicious/inspector-panel";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { MenuItem } from "macalicious/menu-item";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import { PreferencesWindow, PreferencesWindowPane } from "macalicious/preferences-window";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BooksTextReader } from "../books/books-reader";
import type { OwnedBook } from "../books/books-server";
import { CatalinaDesktop } from "./desktop";
import { useDesktopAppMenu } from "./desktop-app-menus";
import {
  type DesktopApp,
  type DesktopPreferencesProps,
  type DesktopWindowProps,
  discoveredApps,
  inDockOrder,
  isDesktopApp,
  preferencesWindowId,
  secondaryWindowId,
} from "./desktop-apps";
import { beginDesktopValues, desktopValues, forgetDesktopValues } from "./desktop-personal";
import { sessionFetch } from "./desktop-server";
import { BATTERY_PERCENTAGE, desktopSystem, RECENT_APPS } from "./desktop-system";

/**
 * A test double for a demo application: a window with a title bar, its controls and one
 * button. The desktop's own behaviour is tested with two of these, so that a change inside a
 * demo does not fail these tests; the demos themselves are hosted in the last block.
 */
function double(name: string, extra?: Partial<DesktopApp>): DesktopApp {
  const id = name.toLowerCase();
  function Double({
    onClose,
    onMinimize,
    onZoom,
    zoomRole,
    minimizeDisabled,
    zoomDisabled,
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
    ...windowProps
  }: ManagedWindowRenderProps) {
    return (
      <Window {...windowProps}>
        <TitleBar
          title={name}
          data-testid={`${id}-bar`}
          controls={
            <WindowControls
              onClose={onClose}
              onMinimize={onMinimize}
              onZoom={onZoom}
              zoomRole={zoomRole}
              minimizeDisabled={minimizeDisabled}
              zoomDisabled={zoomDisabled}
            />
          }
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
        />
        <WindowBody>
          <button type="button">{name} button</button>
        </WindowBody>
      </Window>
    );
  }
  return {
    id,
    name,
    component: Double,
    defaultSize: { width: 400, height: 300 },
    minSize: { width: 200, height: 120 },
    menus: [name, "File", "Edit", "View", "Window", "Help"],
    ...extra,
  };
}

const APPS = [double("Alpha"), double("Beta", { menus: ["Beta", "File", "Tools", "Window"] })];

/**
 * A test double for an application with a Preferences window that the desktop hosts: the
 * main window shows the settings it is given, and counts the Command-commas that reach it
 * (some demos answer the key themselves, and the desktop must be ahead of them); the
 * Preferences window is the library's, with one pane that changes the settings.
 */
function GammaPreferences({
  settings,
  onSettingsChange,
  ...props
}: DesktopPreferencesProps & {
  // Both are required, as a Preferences window that cannot do without them declares them.
  settings: string | undefined;
  onSettingsChange: (settings: string) => void;
}) {
  return (
    <PreferencesWindow
      toolbar={
        <PreferencesToolbar aria-label="Gamma preferences">
          <PreferencesToolbarItem value="general">General</PreferencesToolbarItem>
        </PreferencesToolbar>
      }
      {...props}
    >
      <PreferencesWindowPane value="general">
        <button type="button" onClick={() => onSettingsChange("weekly")}>
          Choose weekly
        </button>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}

function withPreferences(extra?: Partial<DesktopApp>, onComma?: () => void): DesktopApp {
  const { component: Main, ...app } = double("Gamma");
  function Gamma({ settings = "daily", ...props }: DesktopWindowProps & { settings?: string }) {
    return (
      <>
        <Main
          {...props}
          onKeyDown={(event) => {
            if (event.key === "," && (event.metaKey || event.ctrlKey)) onComma?.();
          }}
        />
        <output aria-label="Gamma settings">{settings}</output>
      </>
    );
  }
  return {
    ...app,
    component: Gamma,
    preferences: {
      component: GammaPreferences,
      defaultSize: { width: 300, height: 200 },
      sharesSettings: true,
    },
    ...extra,
  };
}

/**
 * A test double for an application that opens further windows, as Mail opens a New Message
 * window and the Finder an Info window: a note, whose root is a window with a title bar, and
 * an inspector, whose root is the library's inspector panel, which has no drag region props.
 * Each is open while the application says so, and the application says where it renders it.
 */
function withWindows(extra?: Partial<DesktopApp>): DesktopApp {
  const { component: Main, ...app } = double("Epsilon");
  const Note = double("Note").component;
  function Epsilon({ DesktopWindow, ...props }: DesktopWindowProps) {
    const [note, setNote] = useState(false);
    const [inspector, setInspector] = useState(false);
    return (
      <>
        <Main {...props} />
        <output aria-label="Epsilon windows">{DesktopWindow ? "hosted" : "own"}</output>
        <button type="button" onClick={() => setNote(true)}>
          New note
        </button>
        <button type="button" onClick={() => setInspector(true)}>
          Show inspector
        </button>
        {DesktopWindow && note ? (
          <DesktopWindow
            id="note"
            title="Epsilon Note"
            defaultSize={{ width: 320, height: 240 }}
            minSize={{ width: 200, height: 120 }}
            onClose={() => setNote(false)}
            render={(windowProps) => <Note {...windowProps} />}
          />
        ) : null}
        {DesktopWindow && inspector ? (
          <DesktopWindow
            id="inspector"
            title="Epsilon Inspector"
            panel
            defaultSize={{ width: 265, height: 300 }}
            resizable={false}
            fitsContent
            dragRegion="[data-window-drag-region]"
            onClose={() => setInspector(false)}
            render={({
              onClose,
              onMinimize,
              onZoom,
              zoomRole,
              minimizeDisabled,
              zoomDisabled,
              onDragRegionPointerDown,
              onDragRegionDoubleClick,
              variant,
              fullScreen,
              ...panelProps
            }) => (
              <InspectorPanel title="Inspector" onClose={onClose} {...panelProps}>
                <button type="button">Inspector button</button>
              </InspectorPanel>
            )}
          />
        ) : null}
      </>
    );
  }
  return { ...app, component: Epsilon, windows: true, ...extra };
}

/**
 * A test double for an application that renders its Preferences window itself, as the Mail,
 * Music and Podcasts demos do: a dialog beside its window while `preferencesOpen`.
 */
function withOwnPreferences(): DesktopApp {
  const { component: Main, ...app } = double("Delta");
  function Delta({ preferencesOpen, onPreferencesOpenChange, ...props }: DesktopWindowProps) {
    return (
      <>
        <Main {...props} />
        {preferencesOpen ? (
          <div role="dialog" aria-label="Delta Preferences">
            <button type="button" onClick={() => onPreferencesOpenChange?.(false)}>
              Done
            </button>
          </div>
        ) : null}
      </>
    );
  }
  return { ...app, component: Delta, preferences: "own" };
}

// jsdom lays nothing out. The desktop is given the size of a 1440 by 900 pt screen, which the
// window manager reads to keep a window within reach and the desktop to place a new one.
const SCREEN = { clientWidth: 1440, clientHeight: 900 } as const;
const sized = (element: HTMLElement) =>
  element.classList.contains("mac-window-manager") || element.classList.contains("mac-desktop");

beforeEach(() => {
  for (const property of ["clientWidth", "clientHeight"] as const) {
    vi.spyOn(HTMLElement.prototype, property, "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return sized(this) ? SCREEN[property] : 0;
    });
  }
});

afterEach(() => {
  document.documentElement.removeAttribute("data-appearance");
  document.documentElement.removeAttribute("data-accent");
});

const dock = () => screen.getByRole("toolbar", { name: "Dock" });
const tile = (name: string) => within(dock()).getByRole("button", { name });
const frame = (id: string) =>
  document.querySelector<HTMLElement>(`.mac-managed-window[data-window-id="${id}"]`);
const shown = (id: string) => {
  const element = frame(id);
  if (!element) throw new Error(`no window "${id}"`);
  return element;
};
/** The titles of the application's menus: the menu bar's, without the Apple menu. */
const menuTitles = () =>
  within(screen.getByRole("menubar", { name: "" }))
    .getAllByRole("menuitem")
    .slice(1)
    .map((title) => title.textContent);
const launch = (name: string) => act(() => tile(name).click());

describe("the desktop", () => {
  it("shows the menu bar with Finder in front, the desktop's icons and the Dock", () => {
    render(<CatalinaDesktop apps={APPS} clock="Thu 10:07 AM" />);
    expect(menuTitles()).toEqual(["Finder", "File", "Edit", "View", "Go", "Window", "Help"]);
    expect(screen.getByRole("menubar", { name: "Status menus" })).toHaveTextContent("Thu 10:07 AM");
    const desktop = screen.getByRole("group", { name: "Desktop" });
    expect(within(desktop).getByRole("button", { name: "Macintosh SSD" })).toBeInTheDocument();
    expect(
      within(dock())
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Finder", "Launchpad", "Alpha", "Beta", "System Preferences", "Downloads", "Trash"]);
    expect(tile("Finder")).toHaveAttribute("data-running");
    expect(tile("Alpha")).not.toHaveAttribute("data-running");
  });

  it("opens an application from the Dock as the key window, with its menus in the bar", () => {
    render(<CatalinaDesktop apps={APPS} />);
    launch("Alpha");
    const window = within(shown("alpha")).getByRole("region", { name: "Alpha" });
    expect(window).toHaveAttribute("data-window-state", "key");
    expect(shown("alpha")).toContainElement(document.activeElement as HTMLElement);
    expect(tile("Alpha")).toHaveAttribute("data-running");
    expect(menuTitles()).toEqual(["Alpha", "File", "Edit", "View", "Window", "Help"]);
    // At the application's size, centred, a third of the way down between menu bar and Dock.
    expect(shown("alpha").style.transform).toBe("translate3d(520px,188px,0)");
    expect(shown("alpha").style.width).toBe("400px");
    // A second click on the tile opens no second window.
    launch("Alpha");
    expect(document.querySelectorAll(".mac-managed-window")).toHaveLength(1);
  });

  it("makes the pressed window key, brings it to the front and follows it in the menu bar", () => {
    render(<CatalinaDesktop apps={APPS} defaultOpen={["alpha"]} />);
    launch("Beta");
    expect(menuTitles()).toEqual(["Beta", "File", "Tools", "Window"]);
    expect(Number(shown("beta").style.zIndex)).toBeGreaterThan(Number(shown("alpha").style.zIndex));

    fireEvent.pointerDown(screen.getByRole("button", { name: "Alpha button" }));
    expect(menuTitles()[0]).toBe("Alpha");
    expect(Number(shown("alpha").style.zIndex)).toBeGreaterThan(Number(shown("beta").style.zIndex));
    expect(within(shown("beta")).getByRole("region")).toHaveAttribute(
      "data-window-state",
      "inactive",
    );

    // The Dock tile of a running application brings its window forward.
    launch("Beta");
    expect(menuTitles()[0]).toBe("Beta");
  });

  it("moves a window by its title bar", () => {
    render(<CatalinaDesktop apps={APPS} />);
    launch("Alpha");
    const bar = screen.getByTestId("alpha-bar");
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 600, clientY: 200 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 660, clientY: 250 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 660, clientY: 250 });
    expect(shown("alpha").style.transform).toBe("translate3d(580px,238px,0)");
    // No title bar goes under the menu bar.
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 600, clientY: 250 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 600, clientY: -400 });
    fireEvent.pointerUp(bar, { pointerId: 1 });
    expect(shown("alpha").style.transform).toBe("translate3d(580px,22px,0)");
  });

  it("resizes a window at its corner, down to the application's smallest size", () => {
    render(<CatalinaDesktop apps={APPS} />);
    launch("Alpha");
    const corner = shown("alpha").querySelector<HTMLElement>('[data-edge="se"]') as HTMLElement;
    fireEvent.pointerDown(corner, { button: 0, pointerId: 1, clientX: 920, clientY: 488 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 950, clientY: 508 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
    expect(shown("alpha").style.width).toBe("430px");
    expect(shown("alpha").style.height).toBe("320px");

    fireEvent.pointerDown(corner, { button: 0, pointerId: 1, clientX: 950, clientY: 508 });
    fireEvent.pointerMove(corner, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(corner, { pointerId: 1 });
    expect(shown("alpha").style.width).toBe("200px");
    expect(shown("alpha").style.height).toBe("120px");
  });

  it("gives a window that cannot be resized no handles and a disabled zoom button", () => {
    render(<CatalinaDesktop apps={[double("Fixed", { resizable: false })]} />);
    launch("Fixed");
    expect(shown("fixed").querySelector(".mac-managed-window-resize")).toBeNull();
    expect(within(shown("fixed")).getByRole("button", { name: "Zoom" })).toBeDisabled();
  });

  it("minimizes a window into the Dock and restores it from its tile", () => {
    render(<CatalinaDesktop apps={APPS} defaultOpen={["beta"]} />);
    launch("Alpha");
    act(() => within(shown("alpha")).getByRole("button", { name: "Minimize" }).click());
    expect(shown("alpha")).toHaveAttribute("data-minimized");
    // The next window is key, and the bar is its application's.
    expect(menuTitles()[0]).toBe("Beta");
    // The application is still running, and its window has a tile after the separator.
    expect(tile("Alpha")).toHaveAttribute("data-running");
    act(() => tile("Alpha, minimized window").click());
    expect(shown("alpha")).not.toHaveAttribute("data-minimized");
    expect(within(dock()).queryByRole("button", { name: "Alpha, minimized window" })).toBeNull();
    expect(menuTitles()[0]).toBe("Alpha");
  });

  it("zooms from the Window menu and enters full screen from the green button", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} />);
    launch("Alpha");
    await user.click(screen.getByRole("menuitem", { name: "Window" }));
    await user.click(await screen.findByRole("menuitem", { name: "Zoom" }));
    expect(shown("alpha")).toHaveAttribute("data-zoomed");

    act(() => within(shown("alpha")).getByRole("button", { name: "Enter Full Screen" }).click());
    expect(shown("alpha")).toHaveAttribute("data-full-screen");
    // The window covers the menu bar and the Dock, which the keyboard then cannot reach.
    expect(dock()).toHaveAttribute("inert");
    act(() => within(shown("alpha")).getByRole("button", { name: "Exit Full Screen" }).click());
    expect(dock()).not.toHaveAttribute("inert");
  });

  it("closes a window: the application stops running and Finder is in front again", () => {
    render(<CatalinaDesktop apps={APPS} />);
    launch("Alpha");
    act(() => within(shown("alpha")).getByRole("button", { name: "Close" }).click());
    expect(frame("alpha")).toBeNull();
    expect(tile("Alpha")).not.toHaveAttribute("data-running");
    expect(menuTitles()[0]).toBe("Finder");
  });

  it("opens an application from Finder's Go menu, lists it in Recent Items, and quits it from its application menu", async () => {
    // jsdom lays nothing out, so a submenu never leaves the state in which it ignores the
    // pointer while it is placed.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<CatalinaDesktop apps={APPS} />);
    await user.click(screen.getByRole("menuitem", { name: "Go" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Applications" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Beta" }));
    expect(frame("beta")).not.toBeNull();
    expect(menuTitles()[0]).toBe("Beta");
    // The Apple menu's Recent Items has it now, and opens it again from there.
    await user.click(screen.getByRole("menuitem", { name: "Apple" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Recent Items" }));
    expect(await screen.findByRole("menuitem", { name: "Beta" })).toBeInTheDocument();
    await user.keyboard("{Escape}{Escape}");

    await user.click(screen.getByRole("menuitem", { name: "Beta" }));
    await user.click(await screen.findByRole("menuitem", { name: /Quit Beta/ }));
    expect(frame("beta")).toBeNull();
  });

  it("opens Launchpad from the Dock and launches the application chosen in it", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} />);
    // The Dock is hidden from assistive technology while Launchpad, a modal overlay, shows.
    const launchpadTile = tile("Launchpad");
    act(() => launchpadTile.click());
    const launchpad = await screen.findByRole("dialog");
    // Every application of the desktop is in it, and it is rendered on the desktop.
    expect(launchpad.closest(".mac-desktop-shell")).not.toBeNull();
    expect(within(launchpad).getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    await user.click(within(launchpad).getByRole("button", { name: "Beta" }));
    expect(frame("beta")).not.toBeNull();
    expect(menuTitles()[0]).toBe("Beta");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // The tile shows it and hides it: the press that hides it is a press outside Launchpad.
    await user.click(launchpadTile);
    await screen.findByRole("dialog");
    await user.click(launchpadTile);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // A click no pointer made, as the keyboard and assistive technology make, toggles it too.
    act(() => launchpadTile.click());
    await screen.findByRole("dialog");
    act(() => launchpadTile.click());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Launchpad fades in and out four times here: more than the default time on a busy machine.
  }, 20_000);

  it("opens the Spotlight result that is double clicked, not the first one found", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} />);
    await user.click(screen.getByRole("menuitem", { name: "Spotlight" }));
    await user.type(screen.getByRole("combobox", { name: "Spotlight Search" }), "a");
    // Both applications are found ahead of the Preferences panes that match too, and the first is the one selected.
    expect(
      screen
        .getAllByRole("option")
        .map((option) => option.getAttribute("data-value"))
        .slice(0, 3),
    ).toEqual(["alpha", "beta", "pane:apple-id"]);
    expect(screen.getByRole("option", { name: "Alpha" })).toHaveAttribute("aria-selected", "true");
    await user.dblClick(screen.getByRole("option", { name: "Beta" }));
    expect(frame("beta")).not.toBeNull();
    expect(frame("alpha")).toBeNull();
    expect(menuTitles()[0]).toBe("Beta");
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("searches the applications in Spotlight and opens the first one found with Return", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} />);
    await user.click(screen.getByRole("menuitem", { name: "Spotlight" }));
    const field = screen.getByRole("combobox", { name: "Spotlight Search" });
    expect(field).toHaveFocus();
    // Nothing is listed until something is typed.
    expect(screen.queryByRole("option")).toBeNull();
    await user.type(field, "BET");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "BBeta",
      "Hand off work between devices",
    ]);
    expect(screen.getByRole("option", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(frame("beta")).not.toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    // Escape closes an empty field, and the extra shows and hides the window.
    await user.click(screen.getByRole("menuitem", { name: "Spotlight" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("combobox")).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Spotlight" }));
    await user.click(screen.getByRole("menuitem", { name: "Spotlight" }));
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows Siri from its extra, one overlay at a time, and closes it from its window", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} />);
    await user.click(screen.getByRole("menuitem", { name: "Spotlight" }));
    await user.click(screen.getByRole("menuitem", { name: "Siri" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    const siri = document.querySelector(".mac-desktop-shell-siri") as HTMLElement;
    expect(within(siri).getByText("What can I help you with?")).toBeInTheDocument();
    await user.click(within(siri).getByRole("button", { name: "Close" }));
    expect(document.querySelector(".mac-desktop-shell-siri")).toBeNull();
  });

  it("fills a menu the desktop knows no commands for with one dimmed row", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["beta"]} />);
    await user.click(screen.getByRole("menuitem", { name: "Tools" }));
    expect(
      await screen.findByRole("menuitem", { name: "This demo has no Tools commands" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("leaves its dimmed rows out of a menu the front window fills, and keeps the rows it carries out", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const base = double("Gamma", { menus: ["Gamma", "File", "Edit", "Go", "Window", "Help"] });
    const Inner = base.component;
    const selectAll = vi.fn();
    function Filling(props: DesktopWindowProps) {
      useDesktopAppMenu("gamma", "Edit", <MenuItem onClick={selectAll}>Select All</MenuItem>);
      useDesktopAppMenu("gamma", "Help", <MenuItem disabled>Gamma User Guide</MenuItem>);
      return <Inner {...props} />;
    }
    render(<CatalinaDesktop apps={[{ ...base, component: Filling }]} defaultOpen={["gamma"]} />);
    const dimmed = (row: Element) =>
      row.getAttribute("aria-disabled") === "true" || row.hasAttribute("data-disabled");
    /**
     * The rows of a menu, by label (its accessible name where it has one, as a dimmed placeholder does, whose text also
     * holds the reason it carries; else its text, the key equivalent left out) and whether each is dimmed.
     */
    const rowsOf = async (title: string) => {
      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("menuitem", { name: title }));
      const menu = await screen.findByRole("menu");
      return within(menu)
        .getAllByRole("menuitem")
        .map((row) => ({
          label: (
            row.getAttribute("aria-label") ??
            (row.textContent ?? "").replace(/[\u2318\u21e7\u2325\u2303].*$/u, "")
          ).trim(),
          dimmed: dimmed(row),
        }));
    };

    // Edit: the window's Select All, once and working, none of the desktop's dimmed rows, and what every Edit menu ends with.
    expect(await rowsOf("Edit")).toEqual([
      { label: "Select All", dimmed: false },
      { label: "Start Dictation…", dimmed: true },
      { label: "Emoji & Symbols", dimmed: false },
    ]);
    await user.click(screen.getByRole("menuitem", { name: "Select All" }));
    expect(selectAll).toHaveBeenCalledTimes(1);
    // Help: the window's row, not the desktop's dimmed "Gamma Help".
    expect((await rowsOf("Help")).map((row) => row.label)).toEqual(["Gamma User Guide"]);
    // A menu the window does not fill keeps the desktop's rows, working and dimmed alike.
    expect(await rowsOf("File")).toEqual([{ label: "Close Window", dimmed: false }]);
    expect((await rowsOf("Go")).slice(0, 2)).toEqual([
      { label: "Back", dimmed: true },
      { label: "Forward", dimmed: true },
    ]);
  });

  it("keeps its dimmed Edit rows for a window that puts no commands of its own there", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["alpha"]} />);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    const menu = within(await screen.findByRole("menu"));
    expect(menu.getByRole("menuitem", { name: /^Undo/ })).toHaveAttribute("aria-disabled", "true");
    expect(menu.getByRole("menuitem", { name: /^Select All/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("gives the keyboard back to the window after a command, and to the title after Escape", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const base = double("Gamma", { menus: ["Gamma", "File", "Format", "Window"] });
    const Inner = base.component;
    const bold = vi.fn();
    function Typing(props: DesktopWindowProps) {
      useDesktopAppMenu("gamma", "Format", <MenuItem onClick={bold}>Bold</MenuItem>);
      return (
        <>
          <Inner {...props} />
          <input aria-label="Gamma text" />
        </>
      );
    }
    render(<CatalinaDesktop apps={[{ ...base, component: Typing }]} defaultOpen={["gamma"]} />);
    const field = screen.getByRole("textbox", { name: "Gamma text" });
    await user.click(field);
    await user.keyboard("ab");

    // A command: the keyboard is back in the field, and the next key goes on where it was.
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await user.click(await screen.findByRole("menuitem", { name: "Bold" }));
    expect(bold).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(field).toHaveFocus());
    await user.keyboard("c");
    expect(field).toHaveValue("abc");

    // Escape: the keyboard goes back to the field too, as on a Mac.
    await user.click(screen.getByRole("menuitem", { name: "Format" }));
    await screen.findByRole("menuitem", { name: "Bold" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(field).toHaveFocus());
    await user.keyboard("d");
    expect(field).toHaveValue("abcd");
  });

  it("gives the keyboard back only within the key window, never to another application's", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const gamma = double("Gamma", { menus: ["Gamma", "File", "Window"] });
    const GammaInner = gamma.component;
    function Typing(props: DesktopWindowProps) {
      return (
        <>
          <GammaInner {...props} />
          <input aria-label="Gamma text" />
        </>
      );
    }
    const beta = double("Beta", { menus: ["Beta", "File", "Tools", "Window"] });
    const BetaInner = beta.component;
    const sharpen = vi.fn();
    function Tooling(props: DesktopWindowProps) {
      useDesktopAppMenu("beta", "Tools", <MenuItem onClick={sharpen}>Sharpen</MenuItem>);
      return <BetaInner {...props} />;
    }
    render(
      <CatalinaDesktop
        apps={[
          { ...gamma, component: Typing },
          { ...beta, component: Tooling },
        ]}
        defaultOpen={["gamma", "beta"]}
      />,
    );
    const field = screen.getByRole("textbox", { name: "Gamma text" });
    await user.click(field);
    expect(menuTitles()[0]).toBe("Gamma");
    // Beta comes forward from a press that moves no focus, as a window opened from Spotlight may
    // take none: the element focused last in a window is still Gamma's field.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Beta button" }));
    expect(menuTitles()[0]).toBe("Beta");
    await user.click(screen.getByRole("menuitem", { name: "Tools" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sharpen" }));
    expect(sharpen).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Gamma's field was not in the key window: it does not get the keyboard, and Beta stays in
    // front.
    expect(field).not.toHaveFocus();
    expect(menuTitles()[0]).toBe("Beta");
  });

  it("switches the appearance and the accent of the page from its General preferences", () => {
    document.documentElement.setAttribute("data-accent", "green");
    const { unmount } = render(<CatalinaDesktop apps={APPS} />);
    launch("System Preferences");
    const general = within(shown("system-preferences"));
    expect(general.getByRole("region", { name: "General" })).toBeInTheDocument();
    // The page's accent is the one chosen at first.
    expect(general.getByRole("radio", { name: "Green" })).toBeChecked();
    expect(general.getByRole("radio", { name: "Auto" })).toBeChecked();

    act(() => general.getByRole("radio", { name: "Dark" }).click());
    expect(document.documentElement).toHaveAttribute("data-appearance", "dark");
    act(() => general.getByRole("radio", { name: "Purple" }).click());
    expect(document.documentElement).toHaveAttribute("data-accent", "purple");
    act(() => general.getByRole("radio", { name: "Auto" }).click());
    expect(document.documentElement).not.toHaveAttribute("data-appearance");

    // The page gets back what it had when the desktop goes.
    act(() => general.getByRole("radio", { name: "Light" }).click());
    unmount();
    expect(document.documentElement).not.toHaveAttribute("data-appearance");
    expect(document.documentElement).toHaveAttribute("data-accent", "green");
  });

  it("shows the time in the menu bar when the clock is not pinned", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2019, 9, 10, 16, 10));
      render(<CatalinaDesktop apps={APPS} />);
      const status = screen.getByRole("menubar", { name: "Status menus" });
      expect(status).toHaveTextContent("Thu 4:10 PM");
      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      expect(status).toHaveTextContent("Thu 4:11 PM");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("an application's Preferences", () => {
  const choosePreferences = async (name: string) => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("menuitem", { name }));
    await user.click(await screen.findByRole("menuitem", { name: /^Preferences…/ }));
  };
  const preferences = () => shown(preferencesWindowId("gamma"));
  /** Command-comma with the keyboard focus on the button of Gamma's main window. */
  const pressCommandComma = () => {
    const button = screen.getByRole("button", { name: "Gamma button" });
    act(() => button.focus());
    fireEvent.keyDown(button, { key: ",", code: "Comma", metaKey: true });
  };

  it("open as a second window of the desktop from the application menu", async () => {
    render(<CatalinaDesktop apps={[withPreferences(), double("Alpha")]} defaultOpen={["gamma"]} />);
    await choosePreferences("Gamma");
    // A window of its own, of the same application: key, in front, and the menu bar is
    // still Gamma's.
    const window = within(preferences()).getByRole("region", { name: "General" });
    expect(window).toHaveAttribute("data-window-state", "key");
    expect(Number(preferences().style.zIndex)).toBeGreaterThan(Number(shown("gamma").style.zIndex));
    expect(within(shown("gamma")).getByRole("region", { name: "Gamma" })).toHaveAttribute(
      "data-window-state",
      "inactive",
    );
    expect(menuTitles()[0]).toBe("Gamma");
    // At its descriptor's width, without resize handles, and with a zoom button that is off.
    expect(preferences().style.width).toBe("300px");
    expect(preferences().querySelector(".mac-managed-window-resize")).toBeNull();
    expect(within(preferences()).getByRole("button", { name: "Zoom" })).toBeDisabled();

    // The command again brings the same window forward; it does not open another.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Gamma button" }));
    expect(within(preferences()).getByRole("region")).toHaveAttribute(
      "data-window-state",
      "inactive",
    );
    await choosePreferences("Gamma");
    expect(document.querySelectorAll(".mac-managed-window")).toHaveLength(2);
    expect(within(preferences()).getByRole("region")).toHaveAttribute("data-window-state", "key");
  });

  it("are moved by their title bar, minimized into the Dock and closed by themselves", async () => {
    render(<CatalinaDesktop apps={[withPreferences()]} defaultOpen={["gamma"]} />);
    pressCommandComma();
    // Opened from inside the desktop, the window takes the keyboard focus.
    expect(preferences()).toContainElement(document.activeElement as HTMLElement);
    const before = preferences().style.transform;
    const bar = preferences().querySelector<HTMLElement>("[data-window-drag-region]");
    if (!bar) throw new Error("the preferences window has no title bar");
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 600, clientY: 200 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 640, clientY: 230 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 640, clientY: 230 });
    const [, x, y] = /\((-?\d+)px,(-?\d+)px/.exec(before) ?? [];
    expect(preferences().style.transform).toBe(
      `translate3d(${Number(x) + 40}px,${Number(y) + 30}px,0)`,
    );
    // A press on a toolbar item selects a pane; it does not move the window.
    const moved = preferences().style.transform;
    const item = within(preferences()).getByRole("tab", { name: "General" });
    fireEvent.pointerDown(item, { button: 0, pointerId: 1, clientX: 600, clientY: 200 });
    fireEvent.pointerMove(item, { pointerId: 1, clientX: 700, clientY: 300 });
    fireEvent.pointerUp(item, { pointerId: 1 });
    expect(preferences().style.transform).toBe(moved);

    act(() => within(preferences()).getByRole("button", { name: "Minimize" }).click());
    expect(preferences()).toHaveAttribute("data-minimized");
    act(() => tile("Gamma Preferences, minimized window").click());
    expect(preferences()).not.toHaveAttribute("data-minimized");

    // Closing the main window leaves the preferences, and the application running.
    act(() => within(shown("gamma")).getByRole("button", { name: "Close" }).click());
    expect(frame("gamma")).toBeNull();
    expect(tile("Gamma")).toHaveAttribute("data-running");
    expect(menuTitles()[0]).toBe("Gamma");
    act(() => within(preferences()).getByRole("button", { name: "Close" }).click());
    expect(frame(preferencesWindowId("gamma"))).toBeNull();
    expect(tile("Gamma")).not.toHaveAttribute("data-running");
  });

  it("share the application's settings with its main window", () => {
    render(<CatalinaDesktop apps={[withPreferences()]} defaultOpen={["gamma"]} />);
    const settings = screen.getByRole("status", { name: "Gamma settings" });
    // Until the preferences change one, each window has its own default.
    expect(settings).toHaveTextContent("daily");
    pressCommandComma();
    act(() => within(preferences()).getByRole("button", { name: "Choose weekly" }).click());
    expect(settings).toHaveTextContent("weekly");
    // They are the application's: closing the preferences does not put them back.
    act(() => within(preferences()).getByRole("button", { name: "Close" }).click());
    expect(settings).toHaveTextContent("weekly");
  });

  it("open on Command-comma for the front application, from any of its windows", () => {
    const seen = vi.fn();
    render(
      <CatalinaDesktop
        apps={[withPreferences(undefined, seen), double("Alpha")]}
        defaultOpen={["gamma"]}
      />,
    );
    // Control-comma is the command off Apple platforms; Command-comma is Meta.
    const comma = (target: Element, modifiers: KeyboardEventInit) =>
      fireEvent.keyDown(target, { key: ",", code: "Comma", ...modifiers });
    const button = screen.getByRole("button", { name: "Gamma button" });
    // Not the key alone, nor with another modifier: those are left to the application.
    expect(comma(button, {})).toBe(true);
    comma(button, { metaKey: true, shiftKey: true });
    expect(frame(preferencesWindowId("gamma"))).toBeNull();
    expect(seen).toHaveBeenCalledTimes(1);
    // fireEvent returns false when the event's default was prevented: the key was taken, and
    // before the application's window, which does not see it.
    expect(comma(button, { metaKey: true })).toBe(false);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(within(preferences()).getByRole("region")).toHaveAttribute("data-window-state", "key");

    act(() => within(preferences()).getByRole("button", { name: "Close" }).click());
    expect(comma(button, { ctrlKey: true })).toBe(false);
    expect(frame(preferencesWindowId("gamma"))).not.toBeNull();

    // An application without preferences: the key is not taken.
    launch("Alpha");
    expect(comma(screen.getByRole("button", { name: "Alpha button" }), { metaKey: true })).toBe(
      true,
    );
  });

  it("are the application's own window when its descriptor says so", async () => {
    render(<CatalinaDesktop apps={[withOwnPreferences()]} defaultOpen={["delta"]} />);
    expect(screen.queryByRole("dialog", { name: "Delta Preferences" })).toBeNull();
    await choosePreferences("Delta");
    expect(screen.getByRole("dialog", { name: "Delta Preferences" })).toBeInTheDocument();
    // The desktop opens no window of its own for them.
    expect(document.querySelectorAll(".mac-managed-window")).toHaveLength(1);
    // The application closes them, and Command-comma reaches the desktop when the
    // application leaves the key alone.
    act(() => screen.getByRole("button", { name: "Done" }).click());
    expect(screen.queryByRole("dialog", { name: "Delta Preferences" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("button", { name: "Delta button" }), {
      key: ",",
      metaKey: true,
    });
    expect(screen.getByRole("dialog", { name: "Delta Preferences" })).toBeInTheDocument();
    // They go with the application's window, and are closed when it opens again.
    act(() => within(shown("delta")).getByRole("button", { name: "Close" }).click());
    launch("Delta");
    expect(screen.queryByRole("dialog", { name: "Delta Preferences" })).toBeNull();
  });

  it("dim the command of an application that has none", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} defaultOpen={["alpha"]} />);
    await user.click(screen.getByRole("menuitem", { name: "Alpha" }));
    expect(await screen.findByRole("menuitem", { name: /^Preferences…/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("the shell's own facts and commands", () => {
  // The desktop values are the page's, shared by every test: start each from none.
  beforeEach(() => {
    forgetDesktopValues();
    beginDesktopValues();
  });

  /** The rows of the open (last) menu: label without its key equivalent, and dimmed. */
  const rows = (menu: HTMLElement) =>
    Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).map((row) => ({
      label: (row.textContent ?? "").replace(/[\u2318\u21e7\u2325\u2303\u238b].*$/u, "").trim(),
      dimmed: row.getAttribute("aria-disabled") === "true" || row.hasAttribute("data-disabled"),
    }));
  const lastMenu = async () => {
    const menus = await screen.findAllByRole("menu");
    return menus.at(-1) as HTMLElement;
  };

  it("lists the apps this account opened in Recent Items, newest first, and Clear Menu forgets them", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<CatalinaDesktop apps={APPS} />);
    const recentItems = async () => {
      await user.keyboard("{Escape}{Escape}");
      await user.click(screen.getByRole("menuitem", { name: "Apple" }));
      await user.hover(await screen.findByRole("menuitem", { name: "Recent Items" }));
      await screen.findByRole("menuitem", { name: "Clear Menu" });
      return rows(await lastMenu());
    };
    expect(await recentItems()).toEqual([
      { label: "Applications", dimmed: true },
      { label: "No Recent Applications", dimmed: true },
      { label: "Clear Menu", dimmed: true },
    ]);
    await user.keyboard("{Escape}{Escape}");
    launch("Alpha");
    launch("Beta");
    launch("Alpha");
    // Kept with the person's desktop values, which a served desktop saves per account.
    expect(desktopValues()[RECENT_APPS]).toEqual(["alpha", "beta"]);
    expect((await recentItems()).map((row) => row.label)).toEqual([
      "Applications",
      "Alpha",
      "Beta",
      "Clear Menu",
    ]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Clear Menu" }));
    expect(desktopValues()[RECENT_APPS]).toEqual([]);
  });

  it("says only what the browser reports in the status menus, and why the rest is dimmed", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} />);
    const menu = async (name: string) => {
      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("menuitem", { name }));
      return rows(await lastMenu());
    };
    const timeMachine = await menu("Time Machine");
    expect(timeMachine).toEqual(
      expect.arrayContaining([
        { label: "Latest Backup: None", dimmed: true },
        { label: "This desktop has no Time Machine disk.", dimmed: true },
        { label: "Back Up Now", dimmed: true },
        { label: "Enter Time Machine", dimmed: true },
        { label: "Open Time Machine Preferences…", dimmed: false },
      ]),
    );
    expect(JSON.stringify(timeMachine)).not.toMatch(/Today/);
    expect(await menu("Wi-Fi")).toEqual(
      expect.arrayContaining([
        { label: "Network: Connected", dimmed: true },
        { label: "Turn Wi-Fi Off", dimmed: true },
        { label: "A web page cannot switch Wi-Fi.", dimmed: true },
      ]),
    );
    // The browser goes offline: the menu says so.
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect((await menu("Wi-Fi")).map((row) => row.label)).toContain("Network: Offline");
    online.mockRestore();
    // jsdom, like Firefox and WebKit, has no navigator.getBattery: the battery is unknown.
    expect(await menu("Battery")).toEqual(
      expect.arrayContaining([
        { label: "Battery status unknown", dimmed: true },
        { label: "This browser does not report the battery.", dimmed: true },
        { label: "Show Percentage", dimmed: true },
      ]),
    );
  });

  it("shows the battery the browser reports, and Show Percentage puts its level in the menu bar and keeps it", async () => {
    const manager = {
      level: 0.42,
      charging: false,
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(navigator, "getBattery", {
      configurable: true,
      value: () => Promise.resolve(manager),
    });
    try {
      const user = userEvent.setup();
      render(<CatalinaDesktop apps={APPS} />);
      await user.click(screen.getByRole("menuitem", { name: "Battery" }));
      await screen.findByRole("menuitem", { name: "Battery: 42%" });
      expect(rows(await lastMenu())).toEqual(
        expect.arrayContaining([
          { label: "Battery: 42%", dimmed: true },
          { label: "Power Source: Battery", dimmed: true },
          { label: "Show Percentage", dimmed: false },
        ]),
      );
      await user.click(screen.getByRole("menuitemcheckbox", { name: "Show Percentage" }));
      expect(desktopValues()[BATTERY_PERCENTAGE]).toBe(true);
      expect(screen.getByRole("menubar", { name: "Status menus" })).toHaveTextContent("42%");
    } finally {
      delete (navigator as { getBattery?: unknown }).getBattery;
    }
  });

  it("asks before Restart and Shut Down, sleeps until a key, and opens About Finder", async () => {
    const reload = vi.spyOn(desktopSystem, "reload").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={APPS} />);
    const choose = async (menu: string, row: string) => {
      await user.click(screen.getByRole("menuitem", { name: menu }));
      await user.click(await screen.findByRole("menuitem", { name: row }));
    };

    // Restart…: Cancel does nothing; Restart starts the desktop again.
    await choose("Apple", "Restart…");
    let alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("Are you sure you want to restart your computer now?");
    expect(alert).toHaveTextContent("automatically in 60 seconds");
    await user.click(within(alert).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(reload).not.toHaveBeenCalled();
    await choose("Apple", "Restart…");
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Restart" }),
    );
    expect(reload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    // Sleep: the display goes dark until a key.
    await choose("Apple", "Sleep");
    expect(await screen.findByRole("img", { name: "Display asleep" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 80));
    fireEvent.keyDown(window, { key: "a" });
    await waitFor(() => expect(screen.queryByRole("img", { name: "Display asleep" })).toBeNull());

    // About Finder: Finder's About window, closed by its close button.
    await choose("Finder", "About Finder");
    const about = await waitFor(() => {
      const found = document.querySelector<HTMLElement>(".mac-desktop-shell-about-finder");
      if (!found) throw new Error("no About Finder window");
      return found;
    });
    expect(about).toHaveTextContent("Finder");
    expect(about).toHaveTextContent("10.15");
    act(() => within(about).getByRole("button", { name: "Close" }).click());
    expect(document.querySelector(".mac-desktop-shell-about-finder")).toBeNull();

    // Shut Down… on a page with no account: the display goes off until a press starts it again.
    await choose("Apple", "Shut Down…");
    alert = await screen.findByRole("alertdialog");
    expect(alert).toHaveTextContent("Are you sure you want to shut down your computer now?");
    await user.click(within(alert).getByRole("button", { name: "Shut Down" }));
    const off = await screen.findByRole("img", { name: "Shut down" });
    await new Promise((resolve) => setTimeout(resolve, 80));
    fireEvent.pointerDown(off);
    expect(reload).toHaveBeenCalledTimes(2);
    // Without an account, Lock Screen, Log Out and Login Window… have nothing to act on.
    reload.mockRestore();
  });
});

describe("an application's further windows", () => {
  const note = () => shown(secondaryWindowId("epsilon", "note"));
  const inspector = () => shown(secondaryWindowId("epsilon", "inspector"));
  const press = (name: string) => {
    const button = screen.getByRole("button", { name });
    act(() => button.focus());
    act(() => button.click());
  };
  const drag = (bar: Element, x: number, y: number) => {
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 600, clientY: 200 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 600 + x, clientY: 200 + y });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 600 + x, clientY: 200 + y });
  };
  const origin = (element: HTMLElement) => {
    const [, x, y] = /\((-?\d+)px,(-?\d+)px/.exec(element.style.transform) ?? [];
    return [Number(x), Number(y)];
  };

  it("are windows of the desktop for an application whose descriptor says so", () => {
    render(<CatalinaDesktop apps={[withWindows(), double("Alpha")]} defaultOpen={["epsilon"]} />);
    expect(screen.getByRole("status", { name: "Epsilon windows" })).toHaveTextContent("hosted");
    press("New note");
    // A window of the same application beside its main window, not inside it: key, in front,
    // with the keyboard focus, at its size, and the menu bar is still the application's.
    expect(note().parentElement).toBe(shown("epsilon").parentElement);
    expect(within(note()).getByRole("region", { name: "Note" })).toHaveAttribute(
      "data-window-state",
      "key",
    );
    expect(note()).toContainElement(document.activeElement as HTMLElement);
    expect(Number(note().style.zIndex)).toBeGreaterThan(Number(shown("epsilon").style.zIndex));
    expect(note().style.width).toBe("320px");
    expect(note().style.height).toBe("240px");
    expect(note().querySelectorAll(".mac-managed-window-resize")).toHaveLength(8);
    // desktop.css tells them from the window's own content by this.
    expect(note().querySelectorAll(":scope > [data-edge]")).toHaveLength(8);
    expect(menuTitles()[0]).toBe("Epsilon");
    expect(within(shown("epsilon")).getByRole("region", { name: "Epsilon" })).toHaveAttribute(
      "data-window-state",
      "inactive",
    );

    // It is moved by its title bar, and minimized into the Dock under its own name.
    const [x, y] = origin(note());
    drag(screen.getByTestId("note-bar"), 30, 20);
    expect(origin(note())).toEqual([(x ?? 0) + 30, (y ?? 0) + 20]);
    act(() => within(note()).getByRole("button", { name: "Minimize" }).click());
    expect(note()).toHaveAttribute("data-minimized");
    act(() => tile("Epsilon Note, minimized window").click());
    expect(note()).not.toHaveAttribute("data-minimized");

    // A press in the main window makes it key again; the note stays.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Epsilon button" }));
    expect(within(note()).getByRole("region")).toHaveAttribute("data-window-state", "inactive");
    expect(within(shown("epsilon")).getByRole("region", { name: "Epsilon" })).toHaveAttribute(
      "data-window-state",
      "key",
    );

    // Its close button closes it: the application is told, and renders it no more.
    act(() => within(note()).getByRole("button", { name: "Close" }).click());
    expect(frame(secondaryWindowId("epsilon", "note"))).toBeNull();
    press("New note");
    expect(note()).toBeInTheDocument();
  });

  it("move by the part named as their drag region, and are as tall as what they show", () => {
    render(<CatalinaDesktop apps={[withWindows()]} defaultOpen={["epsilon"]} />);
    press("Show inspector");
    const panel = within(inspector()).getByRole("region", { name: "Inspector" });
    expect(panel).toHaveAttribute("data-window-state", "key");
    // Not resizable, and its height is its own: the frame follows it in a browser.
    expect(inspector().querySelector(".mac-managed-window-resize")).toBeNull();
    expect(panel.style.height).toBe("auto");
    const bar = inspector().querySelector("[data-window-drag-region]");
    if (!bar) throw new Error("the inspector has no title bar");
    const [x, y] = origin(inspector());
    drag(bar, -40, 25);
    expect(origin(inspector())).toEqual([(x ?? 0) - 40, (y ?? 0) + 25]);
    // A press on a control in the bar, or in the body, does not move it.
    drag(within(inspector()).getByRole("button", { name: "Close" }), 50, 50);
    drag(within(inspector()).getByRole("button", { name: "Inspector button" }), 50, 50);
    expect(origin(inspector())).toEqual([(x ?? 0) - 40, (y ?? 0) + 25]);
  });

  it("go from its Quit command, and stay when its main window closes until the last has closed", async () => {
    const user = userEvent.setup();
    render(<CatalinaDesktop apps={[withWindows()]} defaultOpen={["epsilon"]} />);
    press("New note");
    press("Show inspector");
    expect(document.querySelectorAll(".mac-managed-window")).toHaveLength(3);
    await user.click(screen.getByRole("menuitem", { name: "Epsilon" }));
    await user.click(await screen.findByRole("menuitem", { name: /Quit Epsilon/ }));
    expect(document.querySelectorAll(".mac-managed-window")).toHaveLength(0);
    expect(tile("Epsilon")).not.toHaveAttribute("data-running");

    launch("Epsilon");
    press("New note");
    act(() => within(shown("epsilon")).getByRole("button", { name: "Close" }).click());
    // The main window stays mounted out of sight, for it is what renders the note, and has no tile.
    expect(note()).toBeInTheDocument();
    expect(shown("epsilon")).toHaveAttribute("data-minimized");
    expect(screen.queryByRole("button", { name: /minimized window/ })).toBeNull();
    expect(tile("Epsilon")).toHaveAttribute("data-running");
    act(() => within(note()).getByRole("button", { name: "Close" }).click());
    expect(document.querySelectorAll(".mac-managed-window")).toHaveLength(0);

    // A panel alone is nothing to stay for.
    launch("Epsilon");
    press("Show inspector");
    act(() => within(shown("epsilon")).getByRole("button", { name: "Close" }).click());
    expect(document.querySelectorAll(".mac-managed-window")).toHaveLength(0);
  });

  it("are the application's own to place when its descriptor does not say so", () => {
    render(<CatalinaDesktop apps={[withWindows({ windows: false })]} defaultOpen={["epsilon"]} />);
    expect(screen.getByRole("status", { name: "Epsilon windows" })).toHaveTextContent("own");
    press("New note");
    expect(document.querySelectorAll(".mac-managed-window")).toHaveLength(1);
  });
});

describe("the demo applications", () => {
  it("are found in demos/ and put in Dock order", () => {
    expect(discoveredApps.length).toBeGreaterThan(0);
    expect(new Set(discoveredApps.map((app) => app.id)).size).toBe(discoveredApps.length);
    const ids = inDockOrder([double("Zeta"), double("Notes"), double("Mail"), double("Abacus")]);
    expect(ids.map((app) => app.id)).toEqual(["mail", "notes", "abacus", "zeta"]);
  });

  it("takes only descriptors it can host", () => {
    expect(isDesktopApp(double("Alpha"))).toBe(true);
    expect(isDesktopApp(undefined)).toBe(false);
    expect(isDesktopApp({ id: "x", name: "X", component: () => null })).toBe(false);
    expect(isDesktopApp({ ...double("Alpha"), menus: [] })).toBe(false);
    // Preferences are a window with a component and a size, or the application's own.
    expect(isDesktopApp(withPreferences())).toBe(true);
    expect(isDesktopApp(withOwnPreferences())).toBe(true);
    expect(isDesktopApp({ ...double("Alpha"), preferences: true })).toBe(false);
    expect(isDesktopApp({ ...double("Alpha"), preferences: { component: () => null } })).toBe(
      false,
    );
  });

  // Every demo that names its preferences: the command of its application menu opens them,
  // as a second window of the desktop or as the application's own, and nothing that the
  // desktop gives the demo for it ends up on an element.
  it("names the Preferences of the demos that have a Preferences window", () => {
    const named = discoveredApps.filter((app) => app.preferences).map((app) => app.id);
    expect(named).toEqual(expect.arrayContaining(["calendar", "mail", "music", "podcasts"]));
    // Safari is hosted wherever its demo is in the tree.
    if (hosted("safari")) expect(named).toContain("safari");
  });

  it.each(discoveredApps.filter((app) => app.preferences).map((app) => [app.id, app] as const))(
    "opens the Preferences of %s",
    async (id, app) => {
      const error = vi.spyOn(console, "error");
      const user = userEvent.setup();
      render(<CatalinaDesktop />);
      launch(app.name);
      const before = document.querySelectorAll("[data-window-state]").length;
      await user.click(screen.getByRole("menuitem", { name: app.name }));
      await user.click(await screen.findByRole("menuitem", { name: /^Preferences…/ }));
      expect(document.querySelectorAll("[data-window-state]")).toHaveLength(before + 1);
      expect(frame(preferencesWindowId(id)) !== null).toBe(app.preferences !== "own");
      expect(menuTitles()).toEqual([...app.menus]);
      expect(tile(app.name)).toHaveAttribute("data-running");
      expect(error).not.toHaveBeenCalled();
    },
  );

  it.each(discoveredApps.filter((app) => app.preferences).map((app) => [app.id, app] as const))(
    "brings forward the Preferences of %s, already open behind its main window",
    async (id, app) => {
      const user = userEvent.setup();
      render(<CatalinaDesktop />);
      launch(app.name);
      const main = shown(id).querySelector("[data-window-state]") as HTMLElement;
      const before = new Set(document.querySelectorAll("[data-window-state]"));
      const choose = async () => {
        await user.click(screen.getByRole("menuitem", { name: app.name }));
        await user.click(await screen.findByRole("menuitem", { name: /^Preferences…/ }));
      };
      await choose();
      const window = [...document.querySelectorAll("[data-window-state]")].find(
        (element) => !before.has(element),
      ) as HTMLElement;
      const count = document.querySelectorAll("[data-window-state]").length;

      fireEvent.pointerDown(main, { button: 0, pointerId: 1 });
      if (["chess", "mail", "podcasts", "terminal"].includes(id)) {
        expect(main).toHaveAttribute("data-window-state", "key");
        expect(window).toHaveAttribute("data-window-state", "inactive");
      }
      await choose();
      expect(window).toHaveAttribute("data-window-state", "key");
      expect(document.querySelectorAll("[data-window-state]")).toHaveLength(count);

      // Command-comma is the same command.
      fireEvent.pointerDown(main, { button: 0, pointerId: 1 });
      fireEvent.keyDown(main, { key: ",", code: "Comma", metaKey: true });
      expect(window).toHaveAttribute("data-window-state", "key");
      expect(document.querySelectorAll("[data-window-state]")).toHaveLength(count);
    },
  );

  // Every demo that is in the tree: opened from the Dock, it is one window that is key, takes
  // the manager's props without passing any on to the DOM, and puts its menus in the bar.
  it.each(discoveredApps.map((app) => [app.id, app] as const))("hosts %s", (id, app) => {
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    render(<CatalinaDesktop />);
    launch(app.name);
    const element = shown(id);
    // The frame holds the application's window (only a window says which state it is in), and with
    // it only the resize handles and, for Mail, its hidden file input.
    const [root, ...others] = Array.from(element.children);
    const rest = others.filter(
      (child) => !(child instanceof HTMLInputElement && child.type === "file"),
    );
    expect(root).toHaveAttribute("data-window-state", "key");
    expect(rest.every((child) => child.classList.contains("mac-managed-window-resize"))).toBe(true);
    expect(rest).toHaveLength(app.resizable === false ? 0 : 8);
    expect(menuTitles()).toEqual([...app.menus]);
    expect(tile(app.name)).toHaveAttribute("data-running");
    // Its own controls close it.
    act(() => within(element).getAllByRole("button", { name: "Close" })[0]?.click());
    expect(frame(id)).toBeNull();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  const hosted = (id: string) => discoveredApps.some((app) => app.id === id);

  // The rows of the Apple menu that are windows of the system open the demos of those windows.
  // A tree without the demo's folder has nothing to open; one that has the folder must have
  // found its descriptor under this id. A tree without the folder reports the test as skipped.
  for (const [row, id] of [
    ["About This Mac", "about-this-mac"],
    ["Force Quit…", "force-quit"],
  ] as const) {
    it.skipIf(!existsSync(path.resolve(import.meta.dirname, "..", id)))(
      `opens ${row} from the Apple menu`,
      async () => {
        expect(hosted(id)).toBe(true);
        const user = userEvent.setup();
        render(<CatalinaDesktop />);
        expect(frame(id)).toBeNull();
        await user.click(screen.getByRole("menuitem", { name: "Apple" }));
        await user.click(await screen.findByRole("menuitem", { name: new RegExp(`^${row}`) }));
        expect(shown(id).firstElementChild).toHaveAttribute("data-window-state", "key");
        // Neither has menus of its own: the bar keeps the Finder's.
        expect(menuTitles()[0]).toBe("Finder");
      },
    );
  }

  it.runIf(hosted("force-quit"))(
    "takes a key pressed on the page's body only when the desktop fills the page",
    () => {
      render(<CatalinaDesktop />);
      const press = () =>
        fireEvent.keyDown(document.body, {
          key: "Escape",
          code: "Escape",
          ctrlKey: true,
          altKey: true,
        });
      const root = document.querySelector(".mac-desktop-shell");
      if (!root) throw new Error("no desktop");

      const page = document.documentElement;
      vi.spyOn(page, "clientWidth", "get").mockReturnValue(1024);
      vi.spyOn(page, "clientHeight", "get").mockReturnValue(768);

      // A test's elements measure nothing, as a desktop smaller than the page does.
      press();
      expect(frame("force-quit")).toBeNull();

      // As big as the page, but further down it.
      const measure = vi.spyOn(root, "getBoundingClientRect");
      measure.mockReturnValue(new DOMRect(0, 400, 1024, 768));
      press();
      expect(frame("force-quit")).toBeNull();

      measure.mockReturnValue(new DOMRect(0, 0, 1024, 768));
      press();
      expect(shown("force-quit").firstElementChild).toHaveAttribute("data-window-state", "key");
    },
  );

  it.runIf(hosted("system-preferences"))(
    "gives System Preferences the frame of each pane, and its General pane themes the page",
    async () => {
      const user = userEvent.setup();
      render(<CatalinaDesktop />);
      launch("System Preferences");
      const element = shown("system-preferences");
      // Where the window stands: the frame's transform up to its third, constant, part.
      const place = element.style.transform.replace(/,[^,]*$/, "");
      const grid = element.style.height;

      await user.click(
        within(within(element).getByRole("group", { name: "All preferences" })).getByRole(
          "button",
          { name: "General" },
        ),
      );
      // The window takes the pane's height where it stands.
      expect(element.style.height).not.toBe(grid);
      expect(element.style.transform.replace(/,[^,]*$/, "")).toBe(place);

      await user.click(within(element).getByRole("radio", { name: "Dark" }));
      expect(document.documentElement).toHaveAttribute("data-appearance", "dark");
      await user.click(within(element).getByRole("radio", { name: "Purple" }));
      expect(document.documentElement).toHaveAttribute("data-accent", "purple");
    },
  );

  it.runIf(hosted("stickies"))("zooms a Stickies note, which has no full screen", () => {
    render(<CatalinaDesktop />);
    launch("Stickies");
    const element = shown("stickies");
    expect(within(element).queryByRole("button", { name: "Enter Full Screen" })).toBeNull();
    act(() => within(element).getByRole("button", { name: "Zoom" }).click());
    expect(element).toHaveAttribute("data-zoomed");
  });

  // The demos that open further windows: each is a window of the desktop, of the same
  // application, and nothing the desktop gives the demo for it ends up on an element.
  it("names the further windows of the demos that open them on the desktop", () => {
    const named = discoveredApps.filter((app) => app.windows).map((app) => app.id);
    expect(named).toEqual(expect.arrayContaining(["finder", "mail"]));
  });

  it.runIf(hosted("mail"))(
    "opens Mail's New Message window as a window of the desktop",
    async () => {
      const error = vi.spyOn(console, "error");
      const user = userEvent.setup();
      render(<CatalinaDesktop />);
      launch("Mail");
      const viewer = within(shown("mail")).getByRole("region", { name: /messages?\)/ });
      await user.click(within(shown("mail")).getByRole("button", { name: "New Message" }));
      const compose = shown(secondaryWindowId("mail", "compose-1"));
      expect(compose.parentElement).toBe(shown("mail").parentElement);
      expect(within(compose).getByRole("region", { name: "New Message" })).toHaveAttribute(
        "data-window-state",
        "key",
      );
      expect(viewer).toHaveAttribute("data-window-state", "inactive");
      expect(compose.style.width).toBe("886px");
      expect(menuTitles()[0]).toBe("Mail");
      // The viewer is the key window again when it is pressed, whatever Mail's own order was.
      fireEvent.pointerDown(viewer);
      expect(viewer).toHaveAttribute("data-window-state", "key");
      // The window's own close button closes it, and the next message is a window again.
      act(() => within(compose).getByRole("button", { name: "Close" }).click());
      expect(frame(secondaryWindowId("mail", "compose-1"))).toBeNull();
      await user.click(within(shown("mail")).getByRole("button", { name: "New Message" }));
      expect(shown(secondaryWindowId("mail", "compose-1"))).toBeInTheDocument();
      expect(error).not.toHaveBeenCalled();
    },
  );

  it.runIf(hosted("finder"))(
    "opens the Finder's Info window and Quick Look as windows of the desktop",
    async () => {
      const error = vi.spyOn(console, "error");
      const user = userEvent.setup();
      render(<CatalinaDesktop />);
      launch("Finder");
      const finder = shown("finder");
      await user.click(within(finder).getByRole("option", { name: "Music" }));
      await user.keyboard("{Control>}i{/Control}");
      const info = shown(secondaryWindowId("finder", "info"));
      expect(info.parentElement).toBe(finder.parentElement);
      expect(within(info).getByRole("region", { name: "Music Info" })).toHaveAttribute(
        "data-window-state",
        "key",
      );
      expect(info.style.width).toBe("265px");
      expect(info.querySelector(".mac-managed-window-resize")).toBeNull();

      await user.click(within(finder).getByRole("option", { name: "Music" }));
      await user.keyboard(" ");
      const look = shown(secondaryWindowId("finder", "quick-look"));
      expect(within(look).getByRole("dialog", { name: "Music" })).toHaveAttribute(
        "data-window-state",
        "key",
      );
      // Three windows of one application: the menu bar is the Finder's, and each closes by
      // itself.
      expect(document.querySelectorAll(".mac-managed-window")).toHaveLength(3);
      expect(menuTitles()[0]).toBe("Finder");
      act(() => within(look).getByRole("button", { name: "Close" }).click());
      expect(frame(secondaryWindowId("finder", "quick-look"))).toBeNull();
      act(() => within(info).getByRole("button", { name: "Close" }).click());
      expect(frame(secondaryWindowId("finder", "info"))).toBeNull();
      expect(frame("finder")).not.toBeNull();
      expect(error).not.toHaveBeenCalled();
    },
  );
});

describe("the desktop served by its Ferrite application, before the session's library has loaded", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /**
   * The desktop as the application's build serves it, on a server that starts a session for
   * every request without a cookie and sets the cookie when its reply arrives. No reply arrives
   * before `release`. Beta asks its module for data as it opens, as Messages, Chess and the
   * Calculator's tape do. No other test here serves the page by the application, so the page's
   * session gate is still closed. (A fresh copy of the modules is not used: it would put two
   * pages' worth of documents and gates in one, which no browser does.)
   */
  function servedDesktop() {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let cookie: string | null = null;
    const sessions = new Set<string>();
    const sent: { url: string; cookie: string | null }[] = [];
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const carried = cookie;
        sent.push({ url, cookie: carried });
        await released;
        const session = carried ?? `session ${sessions.size + 1}`;
        sessions.add(session);
        cookie = session;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            entries: [],
            installed: null,
            order: null,
            page: null,
            rev: 0,
            session,
          }),
        };
      }),
    );
    const beta = double("Beta");
    const Opened = beta.component;
    function Fetching(props: DesktopWindowProps) {
      useEffect(() => {
        void sessionFetch("/api/beta/data").catch(() => {});
      }, []);
      return <Opened {...props} />;
    }
    render(<CatalinaDesktop apps={[double("Alpha"), { ...beta, component: Fetching }]} />);
    return { sent, sessions, release };
  }

  it("lets nothing opened before the library has loaded, from Spotlight or the Go menu, start a second session", async () => {
    // jsdom lays nothing out, so a submenu never leaves the state in which it ignores the
    // pointer while it is placed.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { sent, sessions, release } = servedDesktop();
    // The Dock offers nothing to open until the library has loaded.
    expect(within(dock()).queryByRole("button", { name: "Finder" })).toBeNull();
    // Spotlight searches the session's apps, which the server has not named yet.
    await user.click(screen.getByRole("menuitem", { name: "Spotlight" }));
    await user.type(screen.getByRole("combobox", { name: "Spotlight Search" }), "Beta");
    expect(screen.queryByRole("option", { name: "Beta" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Spotlight" }));
    // The Go menu opens Beta, whose request waits behind the page's first.
    await user.click(screen.getByRole("menuitem", { name: "Go" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Applications" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Beta" }));
    await waitFor(() => expect(frame("beta")).not.toBeNull());
    expect(sent).toHaveLength(1);
    release();
    await waitFor(() => expect(sent.map((request) => request.url)).toContain("/api/beta/data"));
    await waitFor(() => expect(tile("Finder")).toBeInTheDocument());
    // One session, whose cookie every later request carried.
    expect([...sessions]).toEqual(["session 1"]);
    expect(sent.slice(1).every((request) => request.cookie === "session 1")).toBe(true);
  });
});

// Last: the Books reader below asks the server for its book, which starts the page's session
// request; the served desktop's test above needs the page's session gate still closed.
describe("the demo applications' own menus", () => {
  const hosted = (id: string) => discoveredApps.some((app) => app.id === id);
  // jsdom lays nothing out, so a submenu never leaves the state in which it ignores the pointer.
  const user = () => userEvent.setup({ pointerEventsCheck: 0 });
  /** Open the front application's menu `title` and answer its rows. */
  const rowsOf = async (u: ReturnType<typeof user>, title: string) => {
    await u.keyboard("{Escape}{Escape}");
    await u.click(
      within(screen.getByRole("menubar", { name: "" })).getByRole("menuitem", { name: title }),
    );
    const menu = (await screen.findAllByRole("menu")).at(-1) as HTMLElement;
    return Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).map((row) => ({
      label: (row.textContent ?? "").replace(/[\u2318\u21e7\u2325\u2303].*$/u, "").trim(),
      dimmed: row.getAttribute("aria-disabled") === "true" || row.hasAttribute("data-disabled"),
      checked: row.getAttribute("aria-checked") === "true",
    }));
  };
  const labels = (rows: { label: string }[]) => rows.map((row) => row.label);
  /** Choose the row whose label starts with `label` in the open (last) menu. */
  const choose = async (u: ReturnType<typeof user>, label: string) => {
    const menu = (await screen.findAllByRole("menu")).at(-1) as HTMLElement;
    const row = Array.from(menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')).find((each) =>
      (each.textContent ?? "").startsWith(label),
    );
    if (!row) throw new Error(`no row "${label}" in the open menu`);
    await u.click(row);
  };

  it.runIf(hosted("contacts"))(
    "puts New Card in Contacts' File menu and Edit Card in its Card menu",
    async () => {
      const u = user();
      render(<CatalinaDesktop />);
      launch("Contacts");
      expect(labels(await rowsOf(u, "File"))).toEqual([
        "New Card",
        "New Group",
        "New Group from Selection",
        "New Smart Group…",
        "New Smart Group from Current Search",
        "Save",
        "Import…",
        "Export",
        "Export as PDF…",
        "Print…",
        "Close Window",
      ]);
      expect(labels(await rowsOf(u, "Card"))).toEqual([
        "Edit Card",
        "Discard Changes",
        "Add Field",
        "Go to Next Card",
        "Go to Previous Card",
        "Go to My Card",
        "Make This My Card",
        "Share My Card",
        "Mark as a Company",
        "Reorder Last Name Before First",
        "Choose Custom Image…",
        "Edit Custom Image…",
        "Clear Custom Image",
        "Look for Duplicates…",
        "Open in New Window",
        "Merge Selected Cards",
      ]);
      const cards = () => within(shown("contacts")).queryAllByRole("option").length;
      const before = cards();
      await rowsOf(u, "File");
      await choose(u, "New Card");
      // A new card, open for editing: Edit Card has nothing to do until it is done.
      expect(cards()).toBe(before + 1);
      expect((await rowsOf(u, "Card"))[0]).toEqual({
        label: "Edit Card",
        dimmed: true,
        checked: false,
      });
    },
  );

  it.runIf(hosted("console"))(
    "puts Clear, Reload and Get Info in Console's Action menu",
    async () => {
      const u = user();
      render(<CatalinaDesktop />);
      launch("Console");
      const rows = await rowsOf(u, "Action");
      expect(labels(rows)).toEqual(["Clear", "Reload", "Get Info"]);
      expect(rows.every((row) => !row.dimmed)).toBe(true);
      const shownBefore = rows[2]?.checked ?? false;
      await choose(u, "Get Info");
      // The info pane follows the command, and the menu shows its state.
      expect((await rowsOf(u, "Action"))[2]?.checked).toBe(!shownBefore);
      expect(within(shown("console")).queryByText("No Message Selected") !== null).toBe(
        !shownBefore,
      );
    },
  );

  it.runIf(hosted("app-store"))(
    "puts Sign In and Show Updates in the App Store's Store menu",
    async () => {
      const u = user();
      render(<CatalinaDesktop />);
      launch("App Store");
      expect(labels(await rowsOf(u, "Store"))).toEqual([
        "Back",
        "Forward",
        "Reload Page",
        "Search",
        "Sign In",
        "Sign Out",
        "Show Updates",
        "Check for Updates",
        "Redeem…",
        "Purchased",
      ]);
      await choose(u, "Show Updates");
      const selected = Array.from(
        shown("app-store").querySelectorAll(
          '[aria-selected="true"], [aria-current], [data-selected]',
        ),
      ).map((element) => element.textContent?.trim());
      expect(selected.join("|")).toMatch(/Updates/);
      await rowsOf(u, "Store");
      await choose(u, "Sign In");
      expect(labels(await rowsOf(u, "Store"))).toContain("View My Account");
    },
  );

  it.runIf(hosted("calculator"))(
    "puts the paper tape's commands in Calculator's Window and File menus, and its conversions in Convert",
    async () => {
      const u = user();
      render(<CatalinaDesktop />);
      launch("Calculator");
      // Not served here, so there is no tape to show or clear: both rows are dimmed.
      const window = await rowsOf(u, "Window");
      expect(window[0]).toEqual({ label: "Show Paper Tape", dimmed: true, checked: false });
      expect(labels(window)).toContain("Minimize");
      expect(await rowsOf(u, "File")).toEqual([
        { label: "Clear Tape", dimmed: true, checked: false },
        { label: "Save Tape As…", dimmed: true, checked: false },
        { label: "Page Setup…", dimmed: true, checked: false },
        { label: "Print Tape…", dimmed: true, checked: false },
        { label: "Close Window", dimmed: false, checked: false },
      ]);
      const convert = await rowsOf(u, "Convert");
      expect(convert).toContainEqual({ label: "Length…", dimmed: false, checked: false });
      expect(convert).toContainEqual({ label: "Currency…", dimmed: true, checked: false });
    },
  );

  it.runIf(hosted("books"))(
    "opens the Books stores and the library from its Store menu",
    async () => {
      const u = user();
      render(<CatalinaDesktop />);
      launch("Books");
      const view = () =>
        shown("books").querySelector(".mac-books-content")?.getAttribute("data-view") ?? null;
      expect(labels(await rowsOf(u, "Store"))).toEqual([
        "Book Store",
        "Audiobook Store",
        "Library",
      ]);
      await choose(u, "Audiobook Store");
      expect(view()).toBe("audiobook-store");
      await rowsOf(u, "Store");
      await choose(u, "Book Store");
      expect(view()).toBe("book-store");
      await rowsOf(u, "Store");
      await choose(u, "Library");
      expect(view()).toBe("library");
    },
  );

  it("puts the open book's page turns, bookmark and Library in Books' Controls menu", async () => {
    // The book's text never arrives here: the reader stays loading, as one does while the server
    // gets the book, and its menu is there all the same.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    try {
      const u = user();
      const onLibrary = vi.fn();
      const book: OwnedBook = {
        id: "pg-11",
        title: "Alice's Adventures in Wonderland",
        author: "Lewis Carroll",
        source: "gutenberg",
        added: 0,
      };
      const base = double("Books", { menus: ["Books", "Controls", "Window"] });
      const Inner = base.component;
      function Reading(props: DesktopWindowProps) {
        return (
          <>
            <Inner {...props} />
            <BooksTextReader book={book} onLibrary={onLibrary} />
          </>
        );
      }
      render(<CatalinaDesktop apps={[{ ...base, component: Reading }]} defaultOpen={["books"]} />);
      // No page is laid out yet, so there is nothing to bookmark: that row is dimmed.
      expect(await rowsOf(u, "Controls")).toEqual([
        { label: "Previous Page", dimmed: false, checked: false },
        { label: "Next Page", dimmed: false, checked: false },
        { label: "Add Bookmark", dimmed: true, checked: false },
        { label: "Show Library", dimmed: false, checked: false },
        { label: "Play", dimmed: true, checked: false },
      ]);
      await choose(u, "Show Library");
      expect(onLibrary).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
