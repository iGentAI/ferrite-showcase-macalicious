import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "./app";
import { CATALOGUE } from "./catalogue";
import { createHistory, currentPane, historyReducer } from "./history";
import { GRID_HEIGHT, WINDOW_WIDTH } from "./pane";
import { PANES } from "./panes";
import { SystemPreferences } from "./system-preferences";

afterEach(() => {
  for (const name of ["data-appearance", "data-accent", "data-highlight"]) {
    document.documentElement.removeAttribute(name);
  }
});

const frame = (name: string) => screen.getByRole("region", { name });
// A caption on two lines is one name with a line break in it; compare it as it is read.
const paneButton = (name: string) =>
  within(screen.getByRole("group", { name: "All preferences" })).getByRole("button", {
    name: (accessible) => accessible.replace(/\s+/g, " ") === name,
  });
const toolbarButton = (name: string) => screen.getByRole("button", { name });

describe("history", () => {
  it("drops what lay ahead when another pane is shown", () => {
    let history = createHistory(null);
    history = historyReducer(history, { type: "show", pane: "general" });
    history = historyReducer(history, { type: "show", pane: "dock" });
    history = historyReducer(history, { type: "back" });
    expect(currentPane(history)).toBe("general");
    history = historyReducer(history, { type: "show", pane: "sound" });
    expect(history.entries).toEqual([null, "general", "sound"]);
    expect(historyReducer(history, { type: "forward" })).toBe(history);
  });

  it("does not record the pane that is already shown", () => {
    const history = createHistory("general");
    expect(historyReducer(history, { type: "show", pane: "general" })).toBe(history);
    expect(historyReducer(history, { type: "back" })).toBe(history);
  });
});

describe("pane folders", () => {
  it("are named after a pane of the catalogue and declare a frame and a component", () => {
    expect(PANES.has("general")).toBe(true);
    for (const [id, pane] of PANES) {
      expect(CATALOGUE.has(id), `panes/${id}/ is not an id of catalogue.ts`).toBe(true);
      expect(pane.height, `panes/${id}/pane.tsx height`).toBeGreaterThan(38);
      expect(typeof pane.component, `panes/${id}/pane.tsx component`).toBe("function");
    }
  });
});

describe("SystemPreferences", () => {
  it("opens on the grid of every pane at the grid's frame size", () => {
    render(<SystemPreferences />);
    const grid = screen.getByRole("group", { name: "All preferences" });
    expect(within(grid).getAllByRole("button")).toHaveLength(CATALOGUE.size);
    expect(frame("System Preferences")).toHaveStyle({ width: "668px", height: "554px" });
    expect(toolbarButton("Back")).toHaveAttribute("aria-disabled", "true");
    expect(toolbarButton("Forward")).toHaveAttribute("aria-disabled", "true");
  });

  it("opens a pane, takes its height and reports both", async () => {
    const user = userEvent.setup();
    const onPaneChange = vi.fn();
    const onFrameSizeChange = vi.fn();
    render(<SystemPreferences onPaneChange={onPaneChange} onFrameSizeChange={onFrameSizeChange} />);
    expect(onPaneChange).not.toHaveBeenCalled();

    await user.click(paneButton("General"));
    expect(frame("General")).toHaveStyle({ width: "668px", height: "678px" });
    expect(onPaneChange).toHaveBeenLastCalledWith("general");
    expect(onFrameSizeChange).toHaveBeenLastCalledWith({ width: 668, height: 678 });
    // The icon that was clicked is gone: the pane has the keyboard focus.
    expect(screen.getByRole("group", { name: "General" })).toHaveFocus();
  });

  it("asks for the frame of the pane it opens on", () => {
    const onPaneChange = vi.fn();
    const onFrameSizeChange = vi.fn();
    render(
      <SystemPreferences
        defaultPane="general"
        onPaneChange={onPaneChange}
        onFrameSizeChange={onFrameSizeChange}
      />,
    );
    expect(onFrameSizeChange).toHaveBeenCalledTimes(1);
    expect(onFrameSizeChange).toHaveBeenCalledWith({ width: 668, height: 678 });
    expect(onPaneChange).not.toHaveBeenCalled();
  });

  it("goes back, forward and to the grid", async () => {
    const user = userEvent.setup();
    const onFrameSizeChange = vi.fn();
    render(<SystemPreferences onFrameSizeChange={onFrameSizeChange} />);
    await user.click(paneButton("General"));

    await user.click(toolbarButton("Back"));
    expect(frame("System Preferences")).toBeInTheDocument();
    expect(onFrameSizeChange).toHaveBeenLastCalledWith({
      width: WINDOW_WIDTH,
      height: GRID_HEIGHT,
    });
    // A toolbar item stays focusable while it is disabled, so the focus is not lost.
    expect(toolbarButton("Back")).toHaveAttribute("aria-disabled", "true");
    expect(toolbarButton("Back")).toHaveFocus();

    await user.click(toolbarButton("Forward"));
    expect(frame("General")).toBeInTheDocument();
    expect(toolbarButton("Forward")).toHaveAttribute("aria-disabled", "true");

    await user.click(toolbarButton("Show All"));
    expect(frame("System Preferences")).toBeInTheDocument();
    await user.click(toolbarButton("Back"));
    expect(frame("General")).toBeInTheDocument();
  });

  it("dims the panes a search does not match and opens the first match on Return", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences />);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "font smoothing");

    expect(screen.getByRole("status")).toHaveTextContent("1 pane matches");
    expect(paneButton("General")).not.toHaveAttribute("data-dimmed");
    expect(paneButton("Dock")).toHaveAttribute("data-dimmed");

    await user.keyboard("{Enter}");
    expect(frame("General")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("");
  });

  it("matches a pane by its name and returns to the grid to show the matches", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="general" />);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "shar");

    expect(frame("System Preferences")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 panes match");
    expect(paneButton("Sharing")).not.toHaveAttribute("data-dimmed");
    expect(paneButton("Family Sharing")).not.toHaveAttribute("data-dimmed");
    expect(paneButton("General")).toHaveAttribute("data-dimmed");
  });

  it("shows an empty state for a pane of the catalogue that has no folder yet", () => {
    const unbuilt = [...CATALOGUE.values()].find((item) => !PANES.has(item.id));
    if (!unbuilt) return;
    render(<SystemPreferences defaultPane={unbuilt.id} />);
    expect(frame(unbuilt.name)).toHaveTextContent("is not part of this demo yet");
  });

  it("is a Window that forwards window, title bar and window control props", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    render(
      <SystemPreferences
        state="inactive"
        data-testid="frame"
        style={{ position: "absolute", left: 120 }}
        width={700}
        onClose={onClose}
        onDragRegionPointerDown={onDragRegionPointerDown}
      />,
    );
    const root = screen.getByTestId("frame");
    expect(root).toHaveClass("mac-window", "mac-system-preferences");
    expect(root).toHaveAttribute("data-window-state", "inactive");
    expect(root).toHaveStyle({ position: "absolute", left: "120px", width: "700px" });
    expect(toolbarButton("Enter Full Screen")).toBeDisabled();

    await user.click(toolbarButton("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.pointer({ keys: "[MouseLeft>]", target: screen.getByText("System Preferences") });
    expect(onDragRegionPointerDown).toHaveBeenCalled();
  });

  it("hands a window manager's control states to the window controls, not to the frame", async () => {
    const user = userEvent.setup();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    render(
      <SystemPreferences
        data-testid="frame"
        onMinimize={onMinimize}
        onZoom={onZoom}
        zoomRole="zoom"
        zoomDisabled={false}
        minimizeDisabled={false}
        onDragRegionDoubleClick={() => {}}
      />,
    );
    await user.click(toolbarButton("Minimize"));
    await user.click(toolbarButton("Zoom"));
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    const root = screen.getByTestId("frame");
    for (const name of ["zoomrole", "zoomdisabled", "minimizedisabled"]) {
      expect(root).not.toHaveAttribute(name);
    }
  });
});

describe("General pane", () => {
  it("switches the appearance, accent and highlight of the page live", async () => {
    const user = userEvent.setup();
    const html = document.documentElement;
    render(<SystemPreferences defaultPane="general" />);

    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(html).toHaveAttribute("data-appearance", "dark");
    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(html).toHaveAttribute("data-appearance", "light");
    await user.click(screen.getByRole("radio", { name: "Auto" }));
    expect(html).not.toHaveAttribute("data-appearance");

    await user.click(screen.getByRole("radio", { name: "Purple" }));
    expect(html).toHaveAttribute("data-accent", "purple");
    expect(html).toHaveAttribute("data-highlight", "accent");
  });

  it("themes the given element instead of the page", async () => {
    const user = userEvent.setup();
    const target = document.createElement("div");
    render(<SystemPreferences defaultPane="general" themeTarget={target} />);

    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await user.click(screen.getByRole("radio", { name: "Green" }));
    expect(target).toHaveAttribute("data-appearance", "dark");
    expect(target).toHaveAttribute("data-accent", "green");
    expect(document.documentElement).not.toHaveAttribute("data-appearance");
    expect(document.documentElement).not.toHaveAttribute("data-accent");
  });

  it("shows what the page already has until something is chosen", () => {
    document.documentElement.setAttribute("data-appearance", "dark");
    document.documentElement.setAttribute("data-accent", "orange");
    render(<SystemPreferences defaultPane="general" />);
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Orange" })).toBeChecked();
  });

  it("applies the appearance and accent given by defaultSettings and opens in that state", () => {
    const target = document.createElement("div");
    target.setAttribute("data-accent", "green");
    render(
      <SystemPreferences
        defaultPane="general"
        themeTarget={target}
        defaultSettings={{
          "general.appearance": "dark",
          "general.accent": "pink",
          "general.hideMenuBar": true,
        }}
      />,
    );
    expect(target).toHaveAttribute("data-appearance", "dark");
    expect(target).toHaveAttribute("data-accent", "pink");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Pink" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Automatically hide and show the menu bar" }),
    ).toBeChecked();
  });

  it("follows a change of the theme made elsewhere, while open and while closed", async () => {
    const user = userEvent.setup();
    const html = document.documentElement;
    render(
      <SystemPreferences defaultPane="general" defaultSettings={{ "general.accent": "red" }} />,
    );
    await user.click(screen.getByRole("radio", { name: "Dark" }));

    html.setAttribute("data-appearance", "light");
    html.setAttribute("data-accent", "yellow");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Light" })).toBeChecked());
    expect(screen.getByRole("radio", { name: "Yellow" })).toBeChecked();

    await user.click(toolbarButton("Show All"));
    html.removeAttribute("data-appearance");
    html.setAttribute("data-accent", "graphite");
    await user.click(paneButton("General"));
    // Neither the earlier choice nor the starting value comes back: the page is the record.
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Graphite" })).toBeChecked();
    expect(html).toHaveAttribute("data-accent", "graphite");

    // The marked choice is the one in effect, so choosing another always applies it.
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(html).toHaveAttribute("data-appearance", "dark");
  });

  it("shows the accent a target inherits, and lets any swatch replace it", async () => {
    const user = userEvent.setup();
    const desktop = document.createElement("div");
    desktop.setAttribute("data-accent", "purple");
    desktop.setAttribute("data-appearance", "dark");
    const target = desktop.appendChild(document.createElement("div"));
    render(<SystemPreferences defaultPane="general" themeTarget={target} />);
    expect(screen.getByRole("radio", { name: "Purple" })).toBeChecked();
    // The target has no appearance of its own: it follows its surroundings, which is Auto.
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();

    desktop.setAttribute("data-accent", "green");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Green" })).toBeChecked());

    // Blue is not marked, so choosing it is a change and sets the target's own accent.
    await user.click(screen.getByRole("radio", { name: "Blue" }));
    expect(target).toHaveAttribute("data-accent", "blue");
    expect(desktop).toHaveAttribute("data-accent", "green");
    expect(screen.getByRole("radio", { name: "Blue" })).toBeChecked();
  });

  it("lets Auto be chosen for a target beneath an ancestor with an appearance", async () => {
    const user = userEvent.setup();
    const desktop = document.createElement("div");
    desktop.setAttribute("data-appearance", "dark");
    const target = desktop.appendChild(document.createElement("div"));
    render(<SystemPreferences defaultPane="general" themeTarget={target} />);

    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(target).toHaveAttribute("data-appearance", "light");
    await user.click(screen.getByRole("radio", { name: "Auto" }));
    expect(target).not.toHaveAttribute("data-appearance");
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(target).toHaveAttribute("data-appearance", "dark");
    expect(desktop).toHaveAttribute("data-appearance", "dark");
  });

  it("follows a target that is moved under another ancestor, in the page or outside it", async () => {
    const purple = document.createElement("div");
    purple.setAttribute("data-accent", "purple");
    const green = document.createElement("div");
    green.setAttribute("data-accent", "green");
    const target = purple.appendChild(document.createElement("div"));
    render(<SystemPreferences defaultPane="general" themeTarget={target} />);
    expect(screen.getByRole("radio", { name: "Purple" })).toBeChecked();

    green.append(target);
    await waitFor(() => expect(screen.getByRole("radio", { name: "Green" })).toBeChecked());
    green.setAttribute("data-accent", "orange");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Orange" })).toBeChecked());

    document.documentElement.setAttribute("data-accent", "red");
    document.body.append(target);
    await waitFor(() => expect(screen.getByRole("radio", { name: "Red" })).toBeChecked());
    document.documentElement.setAttribute("data-accent", "pink");
    await waitFor(() => expect(screen.getByRole("radio", { name: "Pink" })).toBeChecked());
    target.remove();
  });

  it("marks no swatch for a custom accent", () => {
    const target = document.createElement("div");
    target.setAttribute("data-accent", "custom");
    render(<SystemPreferences defaultPane="general" themeTarget={target} />);
    for (const swatch of within(
      screen.getByRole("radiogroup", { name: "Accent color:" }),
    ).getAllByRole("radio")) {
      expect(swatch).not.toBeChecked();
    }
  });

  it("shows the theme of another element when it becomes the target", () => {
    const first = document.createElement("div");
    first.setAttribute("data-appearance", "dark");
    const second = document.createElement("div");
    second.setAttribute("data-accent", "purple");
    const { rerender } = render(<SystemPreferences defaultPane="general" themeTarget={first} />);
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();

    rerender(<SystemPreferences defaultPane="general" themeTarget={second} />);
    expect(screen.getByRole("radio", { name: "Auto" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Purple" })).toBeChecked();
    expect(second).not.toHaveAttribute("data-appearance");
  });

  it("keeps its settings while another view is shown", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="general" />);
    await user.click(screen.getByRole("radio", { name: "When scrolling" }));
    await user.click(
      screen.getByRole("checkbox", { name: "Automatically hide and show the menu bar" }),
    );

    await user.click(toolbarButton("Show All"));
    await user.click(paneButton("General"));
    expect(screen.getByRole("radio", { name: "When scrolling" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Automatically hide and show the menu bar" }),
    ).toBeChecked();
  });
});

describe("Dock, Sound and Keyboard panes", () => {
  it("Dock: chooses a position from the title under a radio button, and keeps it", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="dock" />);
    expect(frame("Dock")).toHaveStyle({ height: "401px" });
    expect(screen.getByRole("radio", { name: "Bottom" })).toBeChecked();

    await user.click(screen.getByText("Left"));
    expect(screen.getByRole("radio", { name: "Left" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Magnification:" }));

    await user.click(toolbarButton("Show All"));
    await user.click(paneButton("Dock"));
    expect(screen.getByRole("radio", { name: "Left" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Magnification:" })).toBeChecked();
    expect(screen.getByRole("slider", { name: "Size:" })).toBeInTheDocument();
  });

  it("Sound: selects an alert sound and switches tabs", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="sound" />);
    const table = screen.getByRole("grid", { name: "Select an alert sound:" });
    expect(within(table).getByRole("row", { selected: true })).toHaveTextContent("Funk");

    await user.click(within(table).getByText("Basso"));
    expect(within(table).getByRole("row", { selected: true })).toHaveTextContent("Basso");

    await user.click(screen.getByRole("tab", { name: "Output" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "The Output tab is not part of this demo.",
    );
    // The output volume is under the tabs, whichever is open.
    expect(screen.getByRole("slider", { name: "Output volume:" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Mute" }));
    expect(screen.getByRole("checkbox", { name: "Mute" })).toBeChecked();
  });

  it("Keyboard: steps the key repeat rate from the keyboard, one tick at a time", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="keyboard" />);
    const repeat = screen.getByRole("slider", { name: "Key Repeat" });
    expect(repeat).toHaveValue("6");
    repeat.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(repeat).toHaveValue("7");

    await user.click(screen.getByRole("tab", { name: "Shortcuts" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "The Shortcuts tab is not part of this demo.",
    );
    expect(screen.getByRole("button", { name: "Set Up Bluetooth Keyboard…" })).toBeInTheDocument();
  });
});

describe("Displays, Trackpad, Date & Time and Notifications panes", () => {
  it("Displays: titles the window after the display and chooses a resolution", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="displays" />);
    expect(frame("Built-in Retina Display")).toHaveStyle({ height: "511px" });
    expect(screen.getByRole("radio", { name: "Default for display" })).toBeChecked();

    await user.click(screen.getByText("Scaled"));
    expect(screen.getByRole("radio", { name: "Scaled" })).toBeChecked();
    expect(screen.getByRole("slider", { name: "Brightness:" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Night Shift" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "The Night Shift tab is not part of this demo.",
    );
  });

  it("Trackpad: a gesture's title toggles it, and the callout follows the keyboard focus", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="trackpad" />);
    const row = (id: string) => document.querySelector(`[data-gesture="${id}"]`);
    const tap = screen.getByRole("checkbox", { name: "Tap to click" });
    expect(tap).not.toBeChecked();
    expect(tap).toHaveAccessibleDescription("Tap with one finger");
    expect(row("secondary-click")).toHaveAttribute("data-highlighted");

    await user.click(screen.getByText("Tap to click"));
    expect(tap).toBeChecked();
    expect(tap).toHaveFocus();
    expect(row("tap-to-click")).toHaveAttribute("data-highlighted");
    expect(row("secondary-click")).not.toHaveAttribute("data-highlighted");

    await user.click(toolbarButton("Show All"));
    await user.click(paneButton("Trackpad"));
    expect(screen.getByRole("checkbox", { name: "Tap to click" })).toBeChecked();
    expect(row("tap-to-click")).toHaveAttribute("data-highlighted");
  });

  it("Date & Time: is locked until the lock is clicked, and opens Language & Region", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="date-and-time" />);
    const automatic = () =>
      screen.getByRole("checkbox", { name: "Set date and time automatically:" });
    expect(automatic()).toBeChecked();
    expect(automatic()).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: /lock/i }));
    expect(automatic()).not.toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("button", { name: "Open Language & Region…" }));
    expect(frame("Language & Region")).toBeInTheDocument();
    await user.click(toolbarButton("Back"));
    expect(frame("Date & Time")).toHaveStyle({ height: "528px" });
  });

  it("Notifications: Do Not Disturb is chosen, and its settings toggle", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="notifications" />);
    expect(frame("Notifications")).toHaveStyle({ height: "528px" });
    const list = screen.getByRole("listbox", { name: "Applications" });
    expect(within(list).getByRole("option", { selected: true })).toHaveTextContent(
      "Do Not Disturb",
    );
    const locked = screen.getByRole("checkbox", { name: "When the screen is locked" });
    expect(locked).not.toBeChecked();
    await user.click(locked);
    expect(locked).toBeChecked();

    await user.click(within(list).getByText("Calendar"));
    expect(within(list).getByRole("option", { selected: true })).toHaveTextContent("Calendar");
    expect(screen.queryByRole("checkbox", { name: "When the screen is locked" })).toBeNull();
  });
});

describe("Network, Security & Privacy and Users & Groups panes", () => {
  it("Network: shows Wi-Fi, and says so for a service that is not captured", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="network" />);
    expect(frame("Network")).toHaveStyle({ height: "563px" });
    const list = screen.getByRole("listbox", { name: "Network services" });
    expect(within(list).getByRole("option", { selected: true })).toHaveAccessibleName(
      "Wi-Fi, Connected",
    );
    expect(screen.getByRole("checkbox", { name: "Ask to join new networks" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();

    await user.click(within(list).getByRole("option", { name: "Bluetooth PAN, Not Connected" }));
    expect(
      screen.getByText("The settings of Bluetooth PAN are not part of this demo."),
    ).toBeVisible();
  });

  it("Security & Privacy: keeps what the lock guards disabled", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="security-and-privacy" />);
    expect(frame("Security & Privacy")).toHaveStyle({ height: "573px" });
    const require = screen.getByRole("checkbox", { name: "Require password" });
    expect(require).toBeChecked();
    await user.click(require);
    expect(require).not.toBeChecked();

    expect(
      screen.getByRole("radio", { name: "App Store and identified developers" }),
    ).toBeChecked();
    expect(screen.getByRole("radio", { name: "App Store" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Set Lock Message…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Advanced…" })).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: "FileVault" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "The FileVault tab is not part of this demo.",
    );
  });

  it("Users & Groups: lists the accounts it is given and opens Login Options", async () => {
    const user = userEvent.setup();
    render(
      <SystemPreferences
        defaultPane="users-and-groups"
        defaultSettings={{
          "users-and-groups.otherUsers": [
            { id: "jordan", name: "Jordan Lee", status: "Standard", picture: "symbol" },
            { id: "guest", name: "Guest User", status: "Off", picture: "guest" },
          ],
        }}
      />,
    );
    expect(frame("Users & Groups")).toHaveStyle({ height: "486px" });
    const list = screen.getByRole("listbox", { name: "Users" });
    expect(within(list).getByRole("option", { selected: true })).toHaveTextContent("Admin");
    expect(within(list).getByRole("option", { name: /Jordan Lee/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("checkbox", { name: "Allow user to administer this computer" }),
    ).toBeChecked();

    await user.click(within(list).getByText("Login Options"));
    expect(screen.getByText("Login Options are not part of this demo.")).toBeVisible();
  });
});

describe("Pop-up buttons, pull-down buttons and menus of the panes", () => {
  const menuClosed = (role: "listbox" | "menu") =>
    waitFor(() => expect(screen.queryByRole(role)).not.toBeInTheDocument());

  it("Dock: a pop-up button keeps its choice, and the double-click action follows its checkbox", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="dock" />);
    const effect = () => screen.getByRole("combobox", { name: "Minimize windows using:" });
    const action = () =>
      screen.getByRole("combobox", { name: "Double-click a window’s title bar to" });
    expect(effect()).toHaveTextContent("Genie effect");
    expect(action()).toHaveTextContent("zoom");

    await user.click(effect());
    await user.click(await screen.findByRole("option", { name: "Scale effect" }));
    await menuClosed("listbox");
    expect(effect()).toHaveTextContent("Scale effect");

    await user.click(
      screen.getByRole("checkbox", { name: "Double-click a window’s title bar to" }),
    );
    expect(action()).toBeDisabled();

    await user.click(toolbarButton("Show All"));
    await user.click(paneButton("Dock"));
    expect(effect()).toHaveTextContent("Scale effect");
    expect(action()).toBeDisabled();
  });

  it("General: the highlight colour follows the accent until one is chosen", async () => {
    const user = userEvent.setup();
    const html = document.documentElement;
    render(<SystemPreferences defaultPane="general" />);
    const highlight = () => screen.getByRole("combobox", { name: "Highlight color:" });
    expect(highlight()).toHaveTextContent("Blue");

    await user.click(screen.getByRole("radio", { name: "Purple" }));
    expect(highlight()).toHaveTextContent("Purple");

    await user.click(highlight());
    await user.click(await screen.findByRole("option", { name: "Green" }));
    await menuClosed("listbox");
    expect(html).toHaveAttribute("data-highlight", "green");
    expect(html).toHaveAttribute("data-accent", "purple");
    expect(highlight()).toHaveTextContent("Green");

    // As in Catalina, choosing an accent makes the highlight follow it again.
    await user.click(screen.getByRole("radio", { name: "Orange" }));
    expect(html).toHaveAttribute("data-highlight", "accent");
    expect(highlight()).toHaveTextContent("Orange");
  });

  it("Trackpad: a gesture's second line is a menu of the ways to make it", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="trackpad" />);
    await user.click(screen.getByRole("button", { name: "Click with two fingers" }));
    await user.click(await screen.findByRole("menuitem", { name: "Click in bottom right corner" }));
    await menuClosed("menu");
    expect(
      screen.getByRole("button", { name: "Click in bottom right corner" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Secondary click" })).toBeChecked();
  });

  it("Network: the gear opens a menu of service commands", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="network" />);
    expect(screen.getByRole("combobox", { name: "Location:" })).toHaveTextContent("Automatic");
    expect(screen.getByRole("combobox", { name: "Network Name:" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Service actions" }));
    expect(await screen.findByRole("menuitem", { name: "Rename Service…" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await menuClosed("menu");
  });
});

describe("app descriptor", () => {
  it("names the component, the frame it opens at and its menus", () => {
    expect(app.id).toBe("system-preferences");
    expect(app.name).toBe("System Preferences");
    expect(app.component).toBe(SystemPreferences);
    expect(app.defaultSize).toEqual({ width: 668, height: 554 });
    expect(app.menus[0]).toBe(app.name);
  });
});
