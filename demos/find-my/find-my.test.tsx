import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { app, findMyApp } from "./app";
import { FindMy } from "./find-my";
import {
  CAPTURED_CENTER,
  CURRENT_LOCATION,
  clampZoom,
  defaultDevices,
  initialsOf,
  ME,
  project,
  scaleOf,
} from "./find-my-data";
import { DesktopFindMy } from "./find-my-desktop";

const frame = () => screen.getByRole("region", { name: "Find My" });
const list = (name: string) =>
  within(screen.getByRole("radiogroup", { name: "Show" })).getByRole("radio", { name });
const mapType = (name: string) =>
  within(screen.getByRole("radiogroup", { name: "Map type" })).getByRole("radio", { name });
const rows = (name: string) => within(screen.getByRole("listbox", { name })).getAllByRole("option");
const row = (name: RegExp) => screen.getByRole("option", { name });
const map = () => screen.getByRole("img", { name: /placeholder for a map/ });
const mapBox = () => map().parentElement as HTMLElement;
const marker = (id: string) => mapBox().querySelector<HTMLElement>(`[data-marker="${id}"]`);
/** How the drawing is placed: its turn, its scale and the point at the view's middle. */
const drawing = () => mapBox().querySelector(".mac-find-my-art > g")?.getAttribute("transform");
/** Where the drawing has the dot of the current location, as "x, y". */
const dot = () => {
  const circle = mapBox().querySelector(".mac-find-my-art-location");
  return `${circle?.getAttribute("cx")}, ${circle?.getAttribute("cy")}`;
};
const note = () => screen.getByRole("status");
const share = () => screen.getByRole("button", { name: "Share My Location" });
const zoomIn = () => screen.getByRole("button", { name: "Zoom in" });
const zoomOut = () => screen.getByRole("button", { name: "Zoom out" });

describe("the window", () => {
  it("opens as the captures show it: People, nobody selected, the map north up", () => {
    render(<FindMy />);
    expect(frame()).toHaveClass("mac-window", "mac-find-my");
    expect(frame().style.width).toBe("1135px");
    expect(frame().style.height).toBe("723px");
    expect(list("People")).toHaveAttribute("aria-checked", "true");
    expect(list("Devices")).toHaveAttribute("aria-checked", "false");
    expect(rows("People").map((option) => option.textContent)).toEqual(["MeMemphis, TN"]);
    expect(row(/^Me/)).toHaveAttribute("aria-selected", "false");
    expect(mapType("Map")).toHaveAttribute("aria-checked", "true");
    expect(map()).toHaveAccessibleName(/Map, zoom 100%, north up$/);
    expect(mapBox()).toHaveAttribute("data-map-type", "map");
    expect(marker("me")).toBeNull();
    expect(note()).toBeEmptyDOMElement();
    expect(share()).toHaveAttribute("aria-pressed", "false");
    // Find My offers no 3D: the button is there and unavailable.
    expect(screen.getByRole("button", { name: "3D" })).toBeDisabled();
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    render(
      <FindMy
        ref={ref}
        state="inactive"
        width={720}
        height="50vh"
        className="mine"
        data-kind="app"
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        zoomRole="zoom"
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mac-find-my", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-kind", "app");
    expect(frame().style.width).toBe("720px");
    expect(frame().style.height).toBe("50vh");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    expect(onMinimize).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Zoom" }));
    expect(onZoom).toHaveBeenCalledTimes(1);
  });

  it("disables minimize and zoom when the host says so", () => {
    render(<FindMy minimizeDisabled zoomDisabled />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toBeDisabled();
  });

  it("reports a press and a double click on the top strip, its drag region", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <FindMy
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const strip = frame().querySelector("[data-window-drag-region]") as HTMLElement;
    const close = screen.getByRole("button", { name: "Close" });
    expect(strip).toContainElement(close);

    // Only the primary button starts a move, and never from a window control.
    fireEvent.pointerDown(strip, { button: 2 });
    fireEvent.pointerDown(close, { button: 0 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(strip, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(close);
    expect(onDragRegionDoubleClick).not.toHaveBeenCalled();
    await user.dblClick(strip);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("exports a descriptor a desktop can host", () => {
    expect(app).toBe(findMyApp);
    expect(app.id).toBe("find-my");
    expect(app.name).toBe("Find My");
    expect(app.component).toBe(DesktopFindMy);
    expect(app.defaultSize).toEqual({ width: 1135, height: 723 });
    expect(app.menus[0]).toBe("Find My");
  });
});

describe("the sidebar", () => {
  it("switches between People and Devices, which is a radio group", async () => {
    const user = userEvent.setup();
    render(<FindMy />);
    await user.click(list("Devices"));
    expect(list("Devices")).toHaveAttribute("aria-checked", "true");
    expect(list("People")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("listbox", { name: "People" })).not.toBeInTheDocument();
    expect(rows("Devices").map((option) => option.textContent)).toEqual([
      "Desk LaptopHome · Now",
      "Pocket PhoneWith You",
      "Travel TabletOffice · 2 hr ago",
    ]);
    // Every device has a marker on the map; none has its name under it yet.
    for (const device of defaultDevices) {
      expect(marker(device.id)).toBeInTheDocument();
      expect(within(mapBox()).queryByText(device.name)).not.toBeInTheDocument();
    }

    // The arrow keys move the selection of the switch, as in any radio group.
    list("Devices").focus();
    await user.keyboard("{ArrowLeft}");
    expect(list("People")).toHaveAttribute("aria-checked", "true");
    expect(rows("People")).toHaveLength(1);
    expect(marker("desk-laptop")).toBeNull();
  });

  it("selects a device: its marker comes to the middle of the map and shows its name", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<FindMy defaultList="devices" onSelectionChange={onSelectionChange} />);
    const laptop = marker("desk-laptop") as HTMLElement;
    // At the captured view the laptop stands right of and above the middle.
    expect(laptop.style.transform).toBe("translate(110.25px, -61.25px)");

    await user.click(row(/^Desk Laptop/));
    expect(row(/^Desk Laptop/)).toHaveAttribute("aria-selected", "true");
    expect(laptop.style.transform).toBe("translate(0px, 0px)");
    // The drawing moves with the markers: the laptop's point is at its middle.
    expect(drawing()).toBe("rotate(0) scale(1) translate(-1010 -548)");
    expect(laptop).toHaveAttribute("data-selected");
    expect(within(laptop).getByText("Desk Laptop")).toBeVisible();
    expect(note()).toHaveTextContent("Desk Laptop: Home · Now");
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "desk-laptop" }),
    );

    await user.click(row(/^Travel Tablet/));
    expect(row(/^Desk Laptop/)).toHaveAttribute("aria-selected", "false");
    expect(within(mapBox()).queryByText("Desk Laptop")).not.toBeInTheDocument();
    expect(within(marker("travel-tablet") as HTMLElement).getByText("Travel Tablet")).toBeVisible();
    expect((marker("travel-tablet") as HTMLElement).style.transform).toBe("translate(0px, 0px)");
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
  });

  it("selects Me: the map centres on the current location and names its dot", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<FindMy onSelectionChange={onSelectionChange} />);
    await user.click(row(/^Me/));
    expect(row(/^Me/)).toHaveAttribute("aria-selected", "true");
    const mine = marker("me") as HTMLElement;
    expect(mine.style.transform).toBe("translate(0px, 0px)");
    expect(within(mine).getByText("Me")).toBeVisible();
    expect(note()).toHaveTextContent("Me: Memphis, TN");
    expect(onSelectionChange).toHaveBeenCalledWith(ME);
  });

  it("keeps the selection of each list and reports the one that is shown", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<FindMy defaultSelectedId="me" onSelectionChange={onSelectionChange} />);
    expect(row(/^Me/)).toHaveAttribute("aria-selected", "true");
    await user.click(list("Devices"));
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    await user.click(row(/^Pocket Phone/));
    await user.click(list("People"));
    expect(row(/^Me/)).toHaveAttribute("aria-selected", "true");
    expect(onSelectionChange).toHaveBeenLastCalledWith(ME);
    await user.click(list("Devices"));
    expect(row(/^Pocket Phone/)).toHaveAttribute("aria-selected", "true");
    expect((marker("pocket-phone") as HTMLElement).style.transform).toBe("translate(0px, 0px)");
  });

  it("reports a switch between a person and a device that have the same id", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const person = { id: "ada", name: "Ada", place: "Away", coordinate: { x: 700, y: 500 } };
    const device = { ...person, name: "Ada’s Phone", kind: "phone" as const };
    render(
      <FindMy
        people={[person]}
        devices={[device]}
        defaultSelectedId="ada"
        onSelectionChange={onSelectionChange}
      />,
    );
    await user.click(list("Devices"));
    await user.click(row(/^Ada’s Phone/));
    expect(onSelectionChange).toHaveBeenLastCalledWith(device);
    await user.click(list("People"));
    expect(onSelectionChange).toHaveBeenLastCalledWith(person);
    await user.click(list("Devices"));
    expect(onSelectionChange).toHaveBeenLastCalledWith(device);
    expect(onSelectionChange).toHaveBeenCalledTimes(4);
  });

  it("treats a device whose id is “me” as a device", () => {
    const watch = {
      id: "me",
      name: "Wrist Watch",
      kind: "phone" as const,
      place: "With You",
      coordinate: { x: 950, y: 600 },
    };
    render(<FindMy devices={[watch]} defaultList="devices" defaultSharing />);
    // It has its marker without being selected, and sharing is not said of it.
    expect(marker("me")).toBeInTheDocument();
    expect(row(/^Wrist Watch/)).toHaveTextContent(/With You$/);
  });

  it("says so when a list is empty", async () => {
    const user = userEvent.setup();
    render(<FindMy devices={[]} />);
    await user.click(list("Devices"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("No Devices")).toBeVisible();
  });

  it("shares the location and stops again: the row, the map and the note say so", async () => {
    const user = userEvent.setup();
    const onSharingChange = vi.fn();
    render(<FindMy onSharingChange={onSharingChange} />);
    expect(mapBox()).not.toHaveAttribute("data-sharing");

    await user.click(share());
    expect(share()).toHaveAttribute("aria-pressed", "true");
    expect(row(/^Me/)).toHaveTextContent("Memphis, TN · Sharing Location");
    expect(mapBox()).toHaveAttribute("data-sharing");
    expect(note()).toHaveTextContent("Sharing My Location");
    expect(onSharingChange).toHaveBeenLastCalledWith(true);

    await user.click(share());
    expect(share()).toHaveAttribute("aria-pressed", "false");
    expect(row(/^Me/)).toHaveTextContent(/Memphis, TN$/);
    expect(mapBox()).not.toHaveAttribute("data-sharing");
    expect(note()).toHaveTextContent("Not Sharing My Location");
    expect(onSharingChange).toHaveBeenLastCalledWith(false);
  });

  it("opens sharing when asked to", () => {
    render(<FindMy defaultSharing />);
    expect(share()).toHaveAttribute("aria-pressed", "true");
    expect(row(/^Me/)).toHaveTextContent("Memphis, TN · Sharing Location");
  });
});

describe("the map", () => {
  it("switches between Map, Hybrid and Satellite, which is a radio group", async () => {
    const user = userEvent.setup();
    render(<FindMy />);
    await user.click(mapType("Hybrid"));
    expect(mapType("Hybrid")).toHaveAttribute("aria-checked", "true");
    expect(mapType("Map")).toHaveAttribute("aria-checked", "false");
    expect(mapBox()).toHaveAttribute("data-map-type", "hybrid");
    expect(map()).toHaveAccessibleName(/Hybrid, zoom 100%/);

    await user.click(mapType("Satellite"));
    expect(mapType("Satellite")).toHaveAttribute("aria-checked", "true");
    expect(mapType("Hybrid")).toHaveAttribute("aria-checked", "false");
    expect(mapBox()).toHaveAttribute("data-map-type", "satellite");
    expect(map()).toHaveAccessibleName(/Satellite, zoom 100%/);

    mapType("Satellite").focus();
    await user.keyboard("{ArrowLeft}");
    expect(mapType("Hybrid")).toHaveAttribute("aria-checked", "true");
    expect(mapBox()).toHaveAttribute("data-map-type", "hybrid");
  });

  it("opens on the map type it is given", () => {
    render(<FindMy defaultMapType="satellite" />);
    expect(mapType("Satellite")).toHaveAttribute("aria-checked", "true");
    expect(mapBox()).toHaveAttribute("data-map-type", "satellite");
  });

  it("zooms in and out by half steps, between its two limits", async () => {
    const user = userEvent.setup();
    render(<FindMy defaultList="devices" />);
    await user.click(zoomIn());
    expect(map()).toHaveAccessibleName(/zoom 141%/);
    await user.click(zoomIn());
    expect(map()).toHaveAccessibleName(/zoom 200%/);
    // A marker stands twice as far from the middle at twice the scale.
    expect((marker("desk-laptop") as HTMLElement).style.transform).toBe(
      "translate(220.5px, -122.5px)",
    );
    expect(drawing()).toBe("rotate(0) scale(2) translate(-899.75 -609.25)");
    await user.click(zoomIn());
    await user.click(zoomIn());
    expect(map()).toHaveAccessibleName(/zoom 400%/);
    expect(zoomIn()).toHaveAttribute("aria-disabled", "true");
    await user.click(zoomIn());
    expect(map()).toHaveAccessibleName(/zoom 400%/);

    await user.click(zoomOut());
    expect(map()).toHaveAccessibleName(/zoom 283%/);
    expect(zoomIn()).not.toHaveAttribute("aria-disabled", "true");
    for (let step = 0; step < 7; step++) await user.click(zoomOut());
    expect(map()).toHaveAccessibleName(/zoom 25%/);
    expect(zoomOut()).toHaveAttribute("aria-disabled", "true");
    await user.click(zoomOut());
    expect(map()).toHaveAccessibleName(/zoom 25%/);
  });

  it("opens at a limit when given a zoom beyond it", () => {
    render(<FindMy defaultZoom={9} />);
    expect(map()).toHaveAccessibleName(/zoom 400%/);
    expect(zoomIn()).toHaveAttribute("aria-disabled", "true");
    expect(zoomOut()).not.toHaveAttribute("aria-disabled", "true");
  });

  it("moves the map to the current location and says so", async () => {
    const user = userEvent.setup();
    render(<FindMy defaultList="devices" defaultSelectedId="travel-tablet" />);
    const phone = marker("pocket-phone") as HTMLElement;
    const before = phone.style.transform;
    await user.click(screen.getByRole("button", { name: "Show Your Current Location" }));
    expect(note()).toHaveTextContent("Current Location");
    // The phone is 36 pt right of the current location and 28 pt above it.
    expect(phone.style.transform).toBe("translate(36px, -28px)");
    expect(phone.style.transform).not.toBe(before);
    expect(drawing()).toBe("rotate(0) scale(1) translate(-900 -620)");
    // The selection stays.
    expect(row(/^Travel Tablet/)).toHaveAttribute("aria-selected", "true");
  });

  it("has the current location where the person who is the user is", async () => {
    const user = userEvent.setup();
    const me = { id: "me", name: "Me", place: "Elsewhere", coordinate: { x: 500, y: 400 } };
    render(<FindMy people={[me]} />);
    expect(dot()).toBe("500, 400");
    await user.click(screen.getByRole("button", { name: "Show Your Current Location" }));
    expect(drawing()).toBe("rotate(0) scale(1) translate(-500 -400)");
    // The user's name stands under the dot: both are at the middle of the map.
    await user.click(row(/^Me/));
    expect((marker("me") as HTMLElement).style.transform).toBe("translate(0px, 0px)");
    expect(drawing()).toBe("rotate(0) scale(1) translate(-500 -400)");
  });

  it("turns north up from the compass's ring", async () => {
    const user = userEvent.setup();
    render(<FindMy defaultList="devices" defaultHeading={90} />);
    const ring = screen.getByRole("button", { name: "Face north" });
    const rose = ring.querySelector(".mac-map-controls-compass-rose") as HTMLElement;
    expect(rose.style.rotate).toBe("-90deg");
    expect(map()).toHaveAccessibleName(/heading 90°$/);
    // With east up, what was right of the middle is above it.
    const laptop = marker("desk-laptop") as HTMLElement;
    expect(laptop.style.transform).toBe("translate(-61.25px, -110.25px)");
    expect(drawing()).toBe("rotate(-90) scale(1) translate(-899.75 -609.25)");

    await user.click(ring);
    expect(rose.style.rotate).toBe("0deg");
    expect(map()).toHaveAccessibleName(/north up$/);
    expect(laptop.style.transform).toBe("translate(110.25px, -61.25px)");
    expect(drawing()).toBe("rotate(0) scale(1) translate(-899.75 -609.25)");
  });

  it("says what the map is from the Legal link, and takes the note away again", async () => {
    const user = userEvent.setup();
    render(<FindMy />);
    const legal = screen.getByRole("button", { name: "Legal" });
    await user.click(legal);
    expect(note()).toHaveTextContent("Placeholder map: an original drawing, no map data");
    await user.click(legal);
    expect(note()).toBeEmptyDOMElement();
  });
});

describe("the data", () => {
  it("draws the map at 2 to the power of half the zoom level, within the limits", () => {
    expect(scaleOf(0)).toBe(1);
    expect(scaleOf(2)).toBe(2);
    expect(scaleOf(-4)).toBe(0.25);
    expect(clampZoom(7)).toBe(4);
    expect(clampZoom(-7)).toBe(-4);
    expect(clampZoom(1.4)).toBe(1);
  });

  it("places a point about the middle of the view, by scale and heading", () => {
    expect(project(CURRENT_LOCATION, CAPTURED_CENTER, 1)).toEqual({ x: 0.25, y: 10.75 });
    expect(project({ x: 10, y: 0 }, { x: 0, y: 0 }, 2)).toEqual({ x: 20, y: 0 });
    expect(project({ x: 10, y: 0 }, { x: 0, y: 0 }, 1, 90)).toEqual({ x: 0, y: -10 });
    expect(project({ x: 0, y: -10 }, { x: 0, y: 0 }, 1, 180)).toEqual({ x: 0, y: 10 });
  });

  it("takes a person's initials from the first two words of the name", () => {
    expect(initialsOf("Me")).toBe("M");
    expect(initialsOf("  ada   lovelace king ")).toBe("AL");
  });
});
