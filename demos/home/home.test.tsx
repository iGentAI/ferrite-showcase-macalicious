import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { app, homeApp } from "./app";
import { Home } from "./home";

const frame = () => screen.getByRole("region", { name: "Home" });
const button = (name: string) => screen.getByRole("button", { name });
const title = () => screen.getByRole("heading", { level: 2 });
const tiles = (group: string) =>
  within(screen.getByRole("group", { name: group })).getAllByRole("button");
/** The lines of every tile of a grid, as they are read: "Front Light Off". */
const names = (group: string) => tiles(group).map((tile) => tile.textContent?.trim());
/** The scenes that are in effect. */
const activeScenes = () =>
  tiles("Favorite Scenes")
    .filter((tile) => tile.hasAttribute("data-active"))
    .map((tile) => tile.textContent?.trim());
const said = (line: string) => screen.queryByText(line) !== null;
/** The toolbar row: the window's drag region. */
const bar = () => frame().querySelector("[data-window-drag-region]") as HTMLElement;
/** A popup is closed once it has left the page; the rest of the page is hidden until then. */
const closed = (role: "menu" | "listbox" | "dialog") =>
  waitFor(() => expect(screen.queryByRole(role)).toBeNull());

describe("Home", () => {
  it("selects several accessories with Command and Shift, and acts on them together", async () => {
    const user = userEvent.setup();
    render(<Home />);
    const tile = (name: RegExp) =>
      within(screen.getByRole("group", { name: "Favorite Accessories" })).getByRole("button", {
        name,
      });
    const front = tile(/^Front Light/);
    const turtle = tile(/^Front Turtle/);
    const den = tile(/^Den Light/);
    fireEvent.click(front, { metaKey: true });
    fireEvent.click(tile(/^Master Corner/), { shiftKey: true });
    expect(front).toHaveAttribute("data-home-selected");
    expect(turtle).toHaveAttribute("data-home-selected");
    expect(den).not.toHaveAttribute("data-home-selected");
    expect(front).not.toHaveAttribute("data-active");
    fireEvent.click(den, { ctrlKey: true });
    expect(den).toHaveAttribute("data-home-selected");
    fireEvent.click(den, { metaKey: true });
    expect(den).not.toHaveAttribute("data-home-selected");

    fireEvent.contextMenu(front);
    await user.click(await screen.findByRole("menuitem", { name: "Turn On 3 Accessories" }));
    await waitFor(() => expect(front).toHaveAttribute("data-active"));
    expect(turtle).toHaveAttribute("data-active");

    fireEvent.click(tile(/^Front Turtle/));
    expect(front).not.toHaveAttribute("data-home-selected");
  });

  it("opens on the home of the reference capture, at its size", () => {
    render(<Home />);
    expect(frame()).toHaveClass("mac-window", "mac-home");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveStyle({ width: "914px", height: "768px" });

    const controls = within(screen.getByRole("group", { name: "Window controls" }));
    expect(controls.getAllByRole("button")).toHaveLength(3);
    const views = within(screen.getByRole("group", { name: "View" })).getAllByRole("button");
    expect(views.map((view) => [view.textContent, view.getAttribute("aria-pressed")])).toEqual([
      ["Home", "true"],
      ["Rooms", "false"],
      ["Automation", "false"],
    ]);

    expect(title()).toHaveTextContent(/^Home$/);
    expect(said("6 lights on.")).toBe(true);
    expect(said("Studio humidity 47%.")).toBe(true);
    expect(said("Master light on.")).toBe(true);

    expect(names("Favorite Scenes")).toEqual([
      "Street On",
      "Street Off",
      "Studio On",
      "Studio Off",
      "Recording",
    ]);
    expect(activeScenes()).toEqual(["Studio On"]);
    expect(names("Favorite Accessories")).toEqual([
      "Front Light Off",
      "Front Turtle Off",
      "Master Corner Light On",
      "Den Light Off",
      "Den Apple TV Playing",
      "Garage Door Closed",
      "Studio Work 100%",
      "Studio Humidity Sensor 4 Sensors",
      "Master Bedroom HomePod Paused",
      "Kitchen HomePod Paused",
      "Studio HomePod Paused, microphone off",
    ]);
    const on = tiles("Favorite Accessories").filter(
      (tile) => tile.getAttribute("aria-pressed") === "true",
    );
    expect(on.map((tile) => tile.textContent?.trim())).toEqual([
      "Master Corner Light On",
      "Den Apple TV Playing",
      "Studio Work 100%",
    ]);
  });

  it("keeps the status lines beyond the third behind a button", async () => {
    const user = userEvent.setup();
    render(<Home />);
    expect(said("Den Apple TV playing.")).toBe(false);
    expect(button("and 1 More")).toHaveAttribute("aria-expanded", "false");

    await user.click(button("and 1 More"));
    expect(said("Den Apple TV playing.")).toBe(true);
    expect(button("Show Less")).toHaveAttribute("aria-expanded", "true");

    await user.click(button("Show Less"));
    expect(said("Den Apple TV playing.")).toBe(false);
  });

  it("switches an accessory, in its tile's words and in the status lines", async () => {
    const user = userEvent.setup();
    render(<Home />);

    // A light that goes on is counted, and the room it completes is named.
    await user.click(button("Front Light Off"));
    expect(button("Front Light On")).toHaveAttribute("aria-pressed", "true");
    expect(said("7 lights on.")).toBe(true);
    expect(said("Front lights on.")).toBe(true);
    expect(button("and 2 More")).toBeInTheDocument();

    await user.click(button("Master Corner Light On"));
    expect(button("Master Corner Light Off")).toHaveAttribute("aria-pressed", "false");
    expect(said("6 lights on.")).toBe(true);

    // Each kind of accessory has its own words.
    await user.click(button("Den Apple TV Playing"));
    expect(button("Den Apple TV Paused")).toHaveAttribute("aria-pressed", "false");
    await user.click(button("Kitchen HomePod Paused"));
    expect(button("Kitchen HomePod Playing")).toHaveAttribute("aria-pressed", "true");
    await user.click(button("Garage Door Closed"));
    expect(button("Garage Door Open")).toHaveAttribute("aria-pressed", "true");
    await user.click(button("Front Turtle Off"));
    expect(button("Front Turtle On")).toHaveAttribute("aria-pressed", "true");
    // A dimmable light says its brightness while it is on.
    await user.click(button("Studio Work 100%"));
    expect(button("Studio Work Off")).toHaveAttribute("aria-pressed", "false");

    await user.click(button("and 3 More"));
    for (const line of [
      "5 lights on.",
      "Studio humidity 47%.",
      "Front lights on.",
      "Front Turtle on.",
      "Garage Door open.",
      "Kitchen HomePod playing.",
    ]) {
      expect(said(line)).toBe(true);
    }
    expect(said("Den Apple TV playing.")).toBe(false);
  });

  it("does not switch a sensor", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(button("Studio Humidity Sensor 4 Sensors"));
    expect(button("Studio Humidity Sensor 4 Sensors")).toHaveAttribute("aria-pressed", "false");
    expect(said("Studio humidity 47%.")).toBe(true);
  });

  it("runs a scene and marks the scenes whose accessories match", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(button("Studio Off"));
    expect(activeScenes()).toEqual(["Studio Off"]);
    expect(button("Studio Work Off")).toHaveAttribute("aria-pressed", "false");
    expect(said("3 lights on.")).toBe(true);

    // Recording sets what Studio On sets and more, so both are in effect after it.
    await user.click(button("Recording"));
    expect(activeScenes()).toEqual(["Studio On", "Recording"]);
    expect(button("Studio Work 100%")).toHaveAttribute("aria-pressed", "true");
    expect(button("Den Apple TV Paused")).toHaveAttribute("aria-pressed", "false");
    expect(said("7 lights on.")).toBe(true);
    // The fourth line waits behind "and 1 More".
    expect(said("Studio lights on.")).toBe(false);
    await user.click(screen.getByRole("button", { name: /and 1 More/ }));
    expect(said("Studio lights on.")).toBe(true);

    // An accessory switched by hand ends the scenes that set it.
    await user.click(button("Studio Work 100%"));
    expect(activeScenes()).toEqual([]);

    await user.click(button("Street On"));
    expect(activeScenes()).toEqual(["Street On"]);
    expect(button("Front Light On")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows one room at a time on the Rooms tab", async () => {
    const user = userEvent.setup();
    render(<Home />);
    expect(screen.queryByRole("navigation", { name: "Rooms" })).toBeNull();

    await user.click(button("Rooms"));
    expect(button("Rooms")).toHaveAttribute("aria-pressed", "true");
    expect(button("Home")).toHaveAttribute("aria-pressed", "false");
    const rooms = within(screen.getByRole("navigation", { name: "Rooms" }));
    expect(rooms.getAllByRole("button").map((room) => room.textContent)).toEqual([
      "Front",
      "Master",
      "Den",
      "Garage",
      "Studio",
      "Kitchen",
    ]);
    expect(rooms.getByRole("button", { name: "Front" })).toHaveAttribute("aria-current", "page");
    expect(title()).toHaveTextContent(/^Front$/);
    expect(names("Accessories")).toEqual(["Front Light Off", "Front Turtle Off", "Front Porch On"]);
    expect(said("1 light on.")).toBe(true);
    expect(screen.queryByRole("group", { name: "Favorite Scenes" })).toBeNull();

    await user.click(rooms.getByRole("button", { name: "Studio" }));
    expect(rooms.getByRole("button", { name: "Studio" })).toHaveAttribute("aria-current", "page");
    expect(rooms.getByRole("button", { name: "Front" })).not.toHaveAttribute("aria-current");
    expect(title()).toHaveTextContent(/^Studio$/);
    expect(names("Accessories")).toEqual([
      "Studio Work 100%",
      "Studio Humidity Sensor 4 Sensors",
      "Studio HomePod Paused, microphone off",
      "Studio Key Light On",
      "Studio Fill Light On",
      "Studio Backdrop Off",
    ]);
    // A room's lines are about that room and leave its name out.
    expect(said("3 lights on.")).toBe(true);
    expect(said("Humidity 47%.")).toBe(true);

    // What is switched in a room is switched in the home.
    await user.click(button("Studio Backdrop Off"));
    expect(said("4 lights on.")).toBe(true);
    await user.click(button("Home"));
    expect(screen.queryByRole("navigation", { name: "Rooms" })).toBeNull();
    expect(title()).toHaveTextContent(/^Home$/);
    expect(said("7 lights on.")).toBe(true);
    // Recording would also pause the Apple TV, which is still playing.
    expect(activeScenes()).toEqual(["Studio On"]);
  });

  it("has an Automation tab with nothing in it, which offers one once there is a scene", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(button("Automation"));
    expect(title()).toHaveTextContent(/^Automation$/);
    expect(screen.getByText("No Automations")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Favorite Accessories" })).toBeNull();
  });

  it("switches to another home from the toolbar's menu and keeps each home's state", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(button("Front Light Off"));

    await user.click(button("Homes"));
    const cabin = await screen.findByRole("menuitemradio", { name: "Cabin" });
    expect(screen.getByRole("menuitemradio", { name: "Home" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // The settings are commands of the window.
    expect(screen.getByRole("menuitem", { name: "Home Settings…" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(cabin);
    await closed("menu");
    expect(title()).toHaveTextContent(/^Cabin$/);
    expect(names("Favorite Scenes")).toEqual(["Arrive", "Leave"]);
    expect(names("Favorite Accessories")).toEqual([
      "Living Room Lamp Off",
      "Living Room HomePod Paused",
      "Loft Light On",
    ]);

    await user.click(button("Homes"));
    await user.click(await screen.findByRole("menuitemradio", { name: "Home" }));
    await closed("menu");
    expect(title()).toHaveTextContent(/^Home$/);
    expect(button("Front Light On")).toHaveAttribute("aria-pressed", "true");
  });

  it("adds a light to a room through the sheet", async () => {
    const user = userEvent.setup();
    render(<Home />);
    const home = frame();
    await user.click(button("Add"));
    await user.click(await screen.findByRole("menuitem", { name: "Add Accessory…" }));

    const sheet = within(await screen.findByRole("dialog", { name: "Add Accessory" }));
    // The window is main, not key, while its sheet is open.
    expect(home).toHaveAttribute("data-window-state", "main");
    expect(sheet.getByRole("button", { name: "Add" })).toBeDisabled();
    await user.type(sheet.getByRole("textbox", { name: "Name:" }), "Lantern");
    await user.click(sheet.getByRole("button", { name: "Add" }));

    await closed("dialog");
    expect(home).toHaveAttribute("data-window-state", "key");
    expect(names("Favorite Accessories")).toHaveLength(12);
    await user.click(button("Front Lantern Off"));
    expect(button("Front Lantern On")).toHaveAttribute("aria-pressed", "true");
    expect(said("7 lights on.")).toBe(true);
  });

  it("adds a scene for the lights of a chosen room", async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(button("Add"));
    await user.click(await screen.findByRole("menuitem", { name: "Add Scene…" }));

    const sheet = within(await screen.findByRole("dialog", { name: "Add Scene" }));
    await user.type(sheet.getByRole("textbox", { name: "Name:" }), "Kitchen On");
    await user.click(sheet.getByRole("combobox", { name: "Room:" }));
    const kitchen = await screen.findByRole("option", { name: "Kitchen" });
    // The garage has no light, so no scene can be made for it.
    expect(screen.queryByRole("option", { name: "Garage" })).toBeNull();
    await user.click(kitchen);
    await closed("listbox");
    await user.click(sheet.getByRole("button", { name: "Add" }));

    await closed("dialog");
    expect(names("Favorite Scenes")).toHaveLength(6);
    expect(activeScenes()).toEqual(["Studio On"]);
    await user.click(button("Kitchen On"));
    expect(activeScenes()).toEqual(["Studio On", "Kitchen On"]);
    expect(said("7 lights on.")).toBe(true);
  });

  it("passes window props to its root", () => {
    const ref = createRef<HTMLDivElement>();
    const onPointerDown = vi.fn();
    render(
      <Home
        ref={ref}
        state="inactive"
        width="100%"
        height={500}
        className="mine"
        style={{ left: 10 }}
        id="home"
        aria-label="Home 2"
        onPointerDown={onPointerDown}
      />,
    );
    const root = screen.getByRole("region", { name: "Home 2" });
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-window", "mac-home", "mine");
    expect(root).toHaveAttribute("data-window-state", "inactive");
    expect(root).toHaveAttribute("id", "home");
    expect(root).toHaveStyle({ width: "100%", height: "500px", left: "10px" });
    fireEvent.pointerDown(root);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("hands the window controls their props", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const { rerender } = render(
      <Home onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} zoomRole="zoom" />,
    );
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    // The window controls' props are not attributes of the window.
    expect(frame()).not.toHaveAttribute("zoomrole");

    rerender(<Home minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
    expect(button("Close")).toBeEnabled();
  });

  it("reports a press and a double click on the toolbar row, its drag region", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Home
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(bar()).toContainElement(button("Add"));

    fireEvent.pointerDown(bar(), { button: 2 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar(), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    // The toolbar's controls and the content are not part of the drag region.
    fireEvent.pointerDown(button("Add"), { button: 0 });
    fireEvent.pointerDown(title(), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(bar());
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(homeApp);
    expect(app).toMatchObject({
      id: "home",
      name: "Home",
      component: Home,
      defaultSize: { width: 914, height: 768 },
      minSize: { width: 600, height: 400 },
      resizable: true,
    });
    expect(app.menus).toEqual(["Home", "File", "Edit", "View", "Window", "Help"]);

    render(
      <WindowManager style={{ height: 900 }}>
        <ManagedWindow
          id={app.id}
          title={app.name}
          resizable={app.resizable}
          minWidth={app.minSize.width}
          minHeight={app.minSize.height}
          defaultFrame={{ x: 20, y: 30, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    const host = frame().parentElement as HTMLElement;
    expect(host).toHaveAttribute("data-window-id", "home");
    expect(host).toHaveStyle({ width: "914px", height: "768px" });
    // The manager sizes the wrapper; the window fills it.
    expect(frame()).toHaveStyle({ width: "100%", height: "100%" });
    expect(frame()).toHaveAttribute("data-window-state", "key");

    // The manager moves the window by its toolbar row.
    const before = host.style.transform;
    fireEvent.pointerDown(bar(), { button: 0, pointerId: 1, clientX: 300, clientY: 50 });
    fireEvent.pointerMove(bar(), { pointerId: 1, clientX: 340, clientY: 80 });
    fireEvent.pointerUp(bar(), { pointerId: 1, clientX: 340, clientY: 80 });
    expect(host.style.transform).not.toBe(before);

    // The app still works in there.
    await user.click(button("Front Light Off"));
    expect(button("Front Light On")).toHaveAttribute("aria-pressed", "true");

    await user.click(button("Close"));
    expect(screen.queryByRole("region", { name: "Home" })).toBeNull();
  });
});
