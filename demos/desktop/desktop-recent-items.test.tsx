import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalinaDesktop } from "./desktop";
import type { DesktopApp } from "./desktop-apps";
import {
  beginDesktopValues,
  changeDesktopValue,
  desktopValues,
  forgetDesktopValues,
} from "./desktop-personal";
import { RECENT_APPS, RECENT_ITEMS_SETTING } from "./desktop-system";

/** A demo application with a window and nothing else. */
function app(name: string): DesktopApp {
  function Plain({
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
          controls={<WindowControls onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} />}
        />
      </Window>
    );
  }
  return {
    id: name.toLowerCase(),
    name,
    component: Plain,
    defaultSize: { width: 300, height: 200 },
    menus: [name, "File", "Window"],
  };
}

const NAMES = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];

beforeEach(() => {
  forgetDesktopValues();
  beginDesktopValues();
  // jsdom lays nothing out: the desktop is given a screen's size, as in desktop.test.tsx.
  for (const property of ["clientWidth", "clientHeight"] as const) {
    vi.spyOn(HTMLElement.prototype, property, "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      const sized =
        this.classList.contains("mac-window-manager") || this.classList.contains("mac-desktop");
      return sized ? (property === "clientWidth" ? 1440 : 900) : 0;
    });
  }
});

describe("the Apple menu's Recent Items", () => {
  it("lists as many apps as General › Recent items says, and none for None", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<CatalinaDesktop apps={NAMES.map(app)} />);
    const recent = async () => {
      await user.click(screen.getByRole("menuitem", { name: "Apple" }));
      await user.hover(await screen.findByRole("menuitem", { name: "Recent Items" }));
      await screen.findByRole("menuitem", { name: "Clear Menu" });
      const menu = (await screen.findAllByRole("menu")).at(-1) as HTMLElement;
      const rows = Array.from(menu.querySelectorAll('[role^="menuitem"]')).map((row) =>
        (row.textContent ?? "").trim(),
      );
      // Close both menus and leave the menu bar, so the next read opens the Apple menu again
      // (a press on the title of a menu bar the keyboard is still in would close it).
      await user.keyboard("{Escape}{Escape}");
      await user.click(document.body);
      return rows;
    };
    const tile = (name: string) => screen.getByRole("button", { name });
    for (const name of NAMES) act(() => tile(name).click());
    // Ten by default: all seven, newest first.
    expect(await recent()).toEqual(["Applications", ...[...NAMES].reverse(), "Clear Menu"]);
    // General › Recent items: 5.
    act(() => changeDesktopValue(RECENT_ITEMS_SETTING, "5"));
    expect(await recent()).toEqual([
      "Applications",
      "Seven",
      "Six",
      "Five",
      "Four",
      "Three",
      "Clear Menu",
    ]);
    // None: the menu lists none, and Clear Menu has nothing to clear.
    act(() => changeDesktopValue(RECENT_ITEMS_SETTING, "None"));
    expect(await recent()).toEqual(["Applications", "No Recent Applications", "Clear Menu"]);
    // The apps opened are still kept: a larger number lists them again.
    expect(desktopValues()[RECENT_APPS]).toHaveLength(NAMES.length);
    act(() => changeDesktopValue(RECENT_ITEMS_SETTING, "10"));
    expect(await recent()).toHaveLength(NAMES.length + 2);
  });
});
