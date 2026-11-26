import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { CatalinaDesktop } from "./desktop";
import type { DesktopApp } from "./desktop-apps";

/*
 * The menu bar's commands that the desktop carries out itself, by their key equivalents and after a command from a menu:
 * Hide, Hide Others, Quit, Close Window and Minimize from the keyboard (Command is Control off Apple platforms, as
 * here), a key a window answers itself left to it, and an application opened from Go > Applications while the keyboard
 * is in another window's field coming in front, key.
 */

function double(
  name: string,
  extra?: Partial<DesktopApp>,
  onKeyDown?: (event: KeyboardEvent) => void,
): DesktopApp {
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
      <Window {...windowProps} onKeyDown={onKeyDown}>
        <TitleBar
          title={name}
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
          <input aria-label={`${name} text`} />
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
    menus: [name, "File", "Edit", "View", "Go", "Window", "Help"],
    ...extra,
  };
}

const frame = (id: string) => document.querySelector(`.mac-managed-window[data-window-id="${id}"]`);
const stateOf = (id: string) =>
  frame(id)?.querySelector("[data-window-state]")?.getAttribute("data-window-state");
const menuTitles = () =>
  Array.from(
    document.querySelectorAll(
      ".mac-desktop-shell-menu-bar [role='menubar']:first-of-type > [role='menuitem']",
    ),
  )
    .map((item) => item.getAttribute("aria-label") ?? item.textContent ?? "")
    .slice(1);

describe("the menu bar's key equivalents", () => {
  it("hide, hide the others, minimize, close and quit from the keyboard, as their menu items do", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(
      <CatalinaDesktop apps={[double("Alpha"), double("Beta")]} defaultOpen={["alpha", "beta"]} />,
    );
    await user.click(screen.getByRole("button", { name: "Beta button" }));
    expect(stateOf("beta")).toBe("key");

    // Hide Others (Option-Command-H): Alpha goes to the Dock; Beta stays.
    await user.keyboard("{Control>}{Alt>}h{/Alt}{/Control}");
    expect(frame("alpha")).toHaveAttribute("data-minimized");
    expect(frame("beta")).not.toHaveAttribute("data-minimized");

    // Hide Beta (Command-H): gone, with no tile of its own in the Dock.
    await user.keyboard("{Control>}h{/Control}");
    expect(frame("beta")).toHaveAttribute("data-minimized");
    expect(screen.queryByRole("button", { name: "Beta, minimized window" })).toBeNull();

    // Back from its application's tile; Minimize (Command-M) sends the key window to the Dock.
    await user.click(screen.getByRole("button", { name: "Beta" }));
    await user.click(screen.getByRole("button", { name: "Beta button" }));
    await user.keyboard("{Control>}m{/Control}");
    expect(frame("beta")).toHaveAttribute("data-minimized");

    // Close Window (Command-W) closes the key window.
    await user.click(screen.getByRole("button", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Alpha button" }));
    await user.keyboard("{Control>}w{/Control}");
    expect(frame("alpha")).toBeNull();

    // Quit (Command-Q) closes every window of the front application.
    await user.click(screen.getByRole("button", { name: "Beta, minimized window" }));
    await user.click(screen.getByRole("button", { name: "Beta button" }));
    await user.keyboard("{Control>}q{/Control}");
    expect(frame("beta")).toBeNull();

    // With no window open Finder is in front: Command-Q and Command-W do nothing.
    await user.keyboard("{Control>}q{/Control}{Control>}w{/Control}");
    expect(menuTitles()[0]).toBe("Finder");
  });

  it("leave a key the window answers itself to the window", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const closeTab = vi.fn();
    const own = double("Gamma", undefined, (event) => {
      if (event.key === "w" && event.ctrlKey) {
        event.preventDefault();
        closeTab();
      }
    });
    render(<CatalinaDesktop apps={[own]} defaultOpen={["gamma"]} />);
    await user.click(screen.getByRole("button", { name: "Gamma button" }));
    await user.keyboard("{Control>}w{/Control}");
    expect(closeTab).toHaveBeenCalledTimes(1);
    expect(frame("gamma")).not.toBeNull();
  });

  it("do not repeat a command while the key is held", async () => {
    render(
      <CatalinaDesktop apps={[double("Alpha"), double("Beta")]} defaultOpen={["alpha", "beta"]} />,
    );
    const field = screen.getByRole("textbox", { name: "Beta text" });
    fireEvent.pointerDown(field);
    field.focus();
    fireEvent.keyDown(field, { key: "w", code: "KeyW", ctrlKey: true, repeat: true });
    expect(frame("beta")).not.toBeNull();
    fireEvent.keyDown(field, { key: "w", code: "KeyW", ctrlKey: true });
    expect(frame("beta")).toBeNull();
  });
});

describe("a command chosen from a menu", () => {
  it("leaves the application it opens in front and key, though the keyboard was in another window", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<CatalinaDesktop apps={[double("Alpha"), double("Beta")]} defaultOpen={["alpha"]} />);
    await user.click(screen.getByRole("textbox", { name: "Alpha text" }));
    await user.click(screen.getByRole("menuitem", { name: "Go" }));
    await user.hover(await screen.findByRole("menuitem", { name: "Applications" }));
    // jsdom lays nothing out, so a submenu never leaves the state in which it ignores the pointer while it is placed
    // (as desktop.test.tsx's Go menu test has it): its item is clicked directly.
    fireEvent.click(await screen.findByRole("menuitem", { name: "Beta" }));
    await waitFor(() => expect(stateOf("beta")).toBe("key"));
    // Once the menu has faded out and the keyboard has settled, Beta is still the key window, in front.
    await new Promise((done) => setTimeout(done, 400));
    expect(stateOf("beta")).toBe("key");
    expect(stateOf("alpha")).not.toBe("key");
    expect(menuTitles()[0]).toBe("Beta");
  });
});
