import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { AirPortUtility } from "./airport-utility";
import {
  type AirPortBaseStation,
  defaultNearbyDevices,
  nextAddress,
  PASSWORD_LENGTH,
  proposeSetup,
  renameStation,
  setUp,
  setupProblem,
  statusWords,
} from "./airport-utility-data";
import { airportUtilityApp, app } from "./app";

const frame = () => screen.getByRole("region", { name: "AirPort Utility" });
const button = (name: string) => screen.getByRole("button", { name });
const others = () => button("Other Wi-Fi Devices");
const status = () => screen.getByRole("status");
/** The names of the base stations in the graph, in order. */
const stationNames = () => {
  const list = screen.queryByRole("list", { name: "Base stations" });
  return list
    ? within(list)
        .getAllByRole("button")
        .map((node) => node.textContent)
    : [];
};

/** One of the two devices the demo finds nearby, by the start of its id. */
const nearby = (kind: string) => {
  const found = defaultNearbyDevices.find((device) => device.id.startsWith(kind));
  if (!found) throw new Error(`no nearby device ${kind}`);
  return found;
};
const express = nearby("express");
const extreme = nearby("extreme");
const station: AirPortBaseStation = {
  id: "hall",
  name: "Hall",
  model: "AirPort Extreme",
  network: "Harbor",
  address: "10.0.1.2",
  serial: "C86TEST00001",
  version: "7.9.1",
  status: "available",
};

/** Opens the setup sheet for a device of the Other Wi-Fi Devices menu. */
async function choose(user: UserEvent, label: string) {
  await user.click(others());
  await user.click(await screen.findByRole("menuitem", { name: label }));
  return screen.findByRole("dialog", { name: `Set up “${label}”` });
}

/** Types a password into both of the sheet's secure fields. */
async function typePasswords(user: UserEvent, sheet: HTMLElement, first: string, second = first) {
  const password = within(sheet).getByLabelText("Password:");
  const verify = within(sheet).getByLabelText("Verify:");
  await user.clear(password);
  await user.type(password, first);
  await user.clear(verify);
  await user.type(verify, second);
}

describe("the setup rules", () => {
  it("proposes names and says what is missing, field by field", () => {
    const proposed = proposeSetup(express);
    expect(proposed).toEqual({
      network: "Home Network",
      name: "AirPort Express",
      password: "",
      verify: "",
    });
    expect(setupProblem({ ...proposed, network: "  " })).toBe("Enter a network name.");
    expect(setupProblem({ ...proposed, name: "" })).toBe("Enter a base station name.");
    expect(setupProblem(proposed)).toBe(
      `The password must be at least ${PASSWORD_LENGTH} characters.`,
    );
    expect(setupProblem({ ...proposed, password: "12345678", verify: "1234567" })).toBe(
      "The passwords do not match.",
    );
    expect(setupProblem({ ...proposed, password: "12345678", verify: "12345678" })).toBeUndefined();
  });

  it("sets a device up once, with trimmed names and the next free address", () => {
    const setup = {
      network: " Harbor ",
      name: " Attic ",
      password: "12345678",
      verify: "12345678",
    };
    const one = setUp([station], express, setup);
    expect(one).toHaveLength(2);
    expect(one[1]).toEqual({
      id: express.id,
      name: "Attic",
      model: "AirPort Express",
      network: "Harbor",
      address: "10.0.1.3",
      serial: express.serial,
      version: express.version,
      status: "available",
    });
    // The same device again, and an incomplete setup, add nothing.
    expect(setUp(one, express, setup)).toEqual(one);
    expect(setUp([station], extreme, { ...setup, verify: "" })).toEqual([station]);
    expect(nextAddress([])).toBe("10.0.1.2");
    expect(nextAddress([{ ...station, address: "10.0.1.3" }])).toBe("10.0.1.2");
  });

  it("renames a base station, but not to nothing", () => {
    expect(renameStation([station], "hall", " Stairs ")).toEqual([{ ...station, name: "Stairs" }]);
    expect(renameStation([station], "hall", "   ")).toEqual([station]);
    expect(renameStation([station], "attic", "Stairs")).toEqual([station]);
  });

  it("puts a status into words", () => {
    expect(statusWords("available")).toBe("Connected");
    expect(statusWords("partially-available")).toBe("Needs attention");
    expect(statusWords("unavailable")).toBe("Not connected");
  });
});

describe("AirPortUtility", () => {
  it("opens as captured: the Internet alone, dark, with the devices button", () => {
    render(<AirPortUtility />);
    expect(frame()).toHaveAttribute("data-appearance", "dark");
    expect(frame().style.width).toBe("696px");
    expect(frame().style.height).toBe("532px");
    expect(others()).toBeEnabled();
    expect(button("Internet, Connected")).toHaveTextContent("Internet");
    expect(stationNames()).toEqual([]);
    expect(status()).toBeEmptyDOMElement();
  });

  it("shows the Internet's details in a popover that Escape closes", async () => {
    const user = userEvent.setup();
    render(<AirPortUtility />);
    const internet = button("Internet, Connected");
    await user.click(internet);
    const popover = await screen.findByRole("dialog", { name: "Internet" });
    expect(within(popover).getByText("Status:")).toBeInTheDocument();
    expect(within(popover).getByText("Connected")).toBeInTheDocument();
    expect(within(popover).getByText("Router Address:")).toBeInTheDocument();
    expect(within(popover).getAllByText("10.0.1.1")).toHaveLength(2);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Internet" })).toBeNull();
    expect(internet).toHaveFocus();
  });

  it("lists the devices found nearby and sets one up as a base station", async () => {
    const user = userEvent.setup();
    const onStationsChange = vi.fn();
    render(<AirPortUtility onStationsChange={onStationsChange} />);

    await user.click(others());
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "AirPort Express 5f3a1c",
      "AirPort Extreme 0b72e4",
    ]);
    await user.click(screen.getByRole("menuitem", { name: "AirPort Express 5f3a1c" }));
    const sheet = await screen.findByRole("dialog", { name: "Set up “AirPort Express 5f3a1c”" });
    // The window behind its sheet is main, and is held.
    expect(document.querySelector(".mac-airport-utility")).toHaveAttribute(
      "data-window-state",
      "main",
    );
    expect(screen.getByRole("button", { name: "Close", hidden: true })).toBeDisabled();

    const done = within(sheet).getByRole("button", { name: "Done" });
    expect(within(sheet).getByRole("textbox", { name: "Network Name:" })).toHaveValue(
      "Home Network",
    );
    expect(within(sheet).getByRole("textbox", { name: "Base Station Name:" })).toHaveValue(
      "AirPort Express",
    );
    expect(done).toBeDisabled();
    expect(within(sheet).getByText("The password must be at least 8 characters.")).toBeVisible();

    await typePasswords(user, sheet, "correct horse", "correct house");
    expect(done).toBeDisabled();
    expect(within(sheet).getByText("The passwords do not match.")).toBeVisible();

    const name = within(sheet).getByRole("textbox", { name: "Base Station Name:" });
    await user.clear(name);
    expect(within(sheet).getByText("Enter a base station name.")).toBeVisible();
    await user.type(name, "Attic");
    await typePasswords(user, sheet, "correct horse");
    expect(done).toBeEnabled();
    await user.click(done);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(stationNames()).toEqual(["Attic"]);
    expect(button("Attic, Connected")).toBeInTheDocument();
    expect(status()).toHaveTextContent("Attic joined the network Home Network");
    expect(onStationsChange).toHaveBeenCalledTimes(1);
    expect(onStationsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: express.id, name: "Attic", address: "10.0.1.2" }),
    ]);

    // The device is no longer waiting; the other one still is.
    await user.click(others());
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "AirPort Extreme 0b72e4",
    ]);
  });

  it("leaves everything as it was when a setup is cancelled", async () => {
    const user = userEvent.setup();
    const onStationsChange = vi.fn();
    render(<AirPortUtility onStationsChange={onStationsChange} />);
    const sheet = await choose(user, "AirPort Extreme 0b72e4");
    await typePasswords(user, sheet, "correct horse");
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(stationNames()).toEqual([]);
    expect(onStationsChange).not.toHaveBeenCalled();
    expect(status()).toBeEmptyDOMElement();

    // The sheet opens again with its proposals, not with what was typed.
    const again = await choose(user, "AirPort Extreme 0b72e4");
    expect(within(again).getByLabelText("Password:")).toHaveValue("");
    expect(within(again).getByRole("textbox", { name: "Base Station Name:" })).toHaveValue(
      "AirPort Extreme",
    );
  });

  it("has nothing left to offer once every device is set up", async () => {
    const user = userEvent.setup();
    render(<AirPortUtility defaultNearbyDevices={[express]} />);
    const sheet = await choose(user, "AirPort Express 5f3a1c");
    await typePasswords(user, sheet, "correct horse");
    await user.click(within(sheet).getByRole("button", { name: "Done" }));
    expect(stationNames()).toEqual(["AirPort Express"]);
    expect(others()).toBeDisabled();
  });

  it("shows a base station's details and renames it from its popover", async () => {
    const user = userEvent.setup();
    const onStationsChange = vi.fn();
    render(
      <AirPortUtility
        defaultStations={[station, { ...station, id: "shed", name: "Shed", status: "unavailable" }]}
        onStationsChange={onStationsChange}
      />,
    );
    expect(stationNames()).toEqual(["Hall", "Shed"]);
    expect(button("Shed, Not connected")).toBeInTheDocument();

    await user.click(button("Hall, Connected"));
    const popover = await screen.findByRole("dialog", { name: "Hall" });
    expect(within(popover).getByText("Harbor")).toBeInTheDocument();
    expect(within(popover).getByText("10.0.1.2")).toBeInTheDocument();
    expect(within(popover).getByText("C86TEST00001")).toBeInTheDocument();
    expect(within(popover).queryByRole("textbox")).toBeNull();

    await user.click(within(popover).getByRole("button", { name: "Edit" }));
    const field = within(popover).getByRole("textbox", { name: "Base Station Name:" });
    expect(field).toHaveValue("Hall");
    // The keyboard focus follows the edit: to the field, and back to Edit when it is done.
    expect(field).toHaveFocus();
    await user.clear(field);
    expect(within(popover).getByRole("button", { name: "Done" })).toBeDisabled();
    await user.type(field, "Stairs");
    await user.click(within(popover).getByRole("button", { name: "Done" }));

    expect(stationNames()).toEqual(["Stairs", "Shed"]);
    expect(status()).toHaveTextContent("Hall is now named Stairs");
    expect(onStationsChange).toHaveBeenCalledTimes(1);
    expect(within(popover).queryByRole("textbox")).toBeNull();
    expect(within(popover).getByRole("button", { name: "Edit" })).toHaveFocus();
  });

  it("draws the line from the Internet beside the row of base stations, not in it", () => {
    const { container, unmount } = render(<AirPortUtility defaultStations={[station]} />);
    const list = screen.getByRole("list", { name: "Base stations" });
    const trunk = container.querySelector(".mac-airport-utility-trunk");
    expect(trunk).not.toBeNull();
    // The row scrolls sideways; a line inside it would leave the Internet behind.
    expect(list.contains(trunk)).toBe(false);
    expect(trunk).toHaveAttribute("aria-hidden", "true");
    unmount();

    // No base station, no line.
    const empty = render(<AirPortUtility />);
    expect(empty.container.querySelector(".mac-airport-utility-trunk")).toBeNull();
  });

  it("names a base station in full, whatever its label shows", () => {
    const name = "Upstairs Reading Room and Workshop";
    render(<AirPortUtility defaultStations={[{ ...station, name }]} />);
    const node = button(`${name}, Connected`);
    expect(node.querySelector(".mac-airport-utility-label")).toHaveTextContent(name);
  });

  it("stays dark whatever appearance a caller asks for", () => {
    const asked = { "data-appearance": "light" };
    render(<AirPortUtility {...asked} />);
    expect(frame()).toHaveAttribute("data-appearance", "dark");
  });

  it("drops an edit that is cancelled, and one left by closing the popover", async () => {
    const user = userEvent.setup();
    const onStationsChange = vi.fn();
    render(<AirPortUtility defaultStations={[station]} onStationsChange={onStationsChange} />);
    await user.click(button("Hall, Connected"));
    let popover = await screen.findByRole("dialog", { name: "Hall" });
    await user.click(within(popover).getByRole("button", { name: "Edit" }));
    await user.type(within(popover).getByRole("textbox"), "way");
    await user.click(within(popover).getByRole("button", { name: "Cancel" }));
    expect(within(popover).queryByRole("textbox")).toBeNull();
    expect(within(popover).getByRole("button", { name: "Edit" })).toHaveFocus();

    await user.click(within(popover).getByRole("button", { name: "Edit" }));
    expect(within(popover).getByRole("textbox")).toHaveValue("Hall");
    await user.keyboard("{Escape}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(button("Hall, Connected"));
    popover = await screen.findByRole("dialog", { name: "Hall" });
    expect(within(popover).queryByRole("textbox")).toBeNull();
    expect(stationNames()).toEqual(["Hall"]);
    expect(onStationsChange).not.toHaveBeenCalled();
  });

  it("does not list a nearby device that is a base station already", async () => {
    const user = userEvent.setup();
    render(<AirPortUtility defaultStations={[{ ...station, id: express.id }]} />);
    await user.click(others());
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual([
      "AirPort Extreme 0b72e4",
    ]);
  });

  it("is used from the keyboard", async () => {
    const user = userEvent.setup();
    render(<AirPortUtility />);
    // Close, minimize, zoom, then the devices button and the Internet.
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(others()).toHaveFocus();
    await user.tab();
    expect(button("Internet, Connected")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "Internet" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    others().focus();
    await user.keyboard("{Enter}");
    await screen.findAllByRole("menuitem");
    await user.keyboard("{ArrowDown}{Enter}");
    const sheet = await screen.findByRole("dialog", { name: /^Set up/ });
    // Escape cancels the sheet.
    await user.keyboard("{Escape}");
    expect(sheet).not.toBeInTheDocument();
    expect(stationNames()).toEqual([]);
  });

  it("passes the window's props on and hands the callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <AirPortUtility
        ref={ref}
        className="mine"
        state="inactive"
        width={700}
        height="50vh"
        style={{ left: 12 }}
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        zoomRole="zoom"
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mac-airport-utility", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame().style.width).toBe("700px");
    expect(frame().style.height).toBe("50vh");
    expect(frame().style.left).toBe("12px");

    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);

    const title = screen.getByText("AirPort Utility");
    fireEvent.pointerDown(title, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    fireEvent.doubleClick(title);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a window control is the control's, not a drag.
    fireEvent.pointerDown(button("Close"), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
  });

  it("disables the controls a host disables", () => {
    render(<AirPortUtility minimizeDisabled zoomDisabled zoomRole="zoom" />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Zoom")).toBeDisabled();
  });

  it("is hosted by a managed window through the descriptor", () => {
    expect(app).toBe(airportUtilityApp);
    expect(app).toMatchObject({
      id: "airport-utility",
      name: "AirPort Utility",
      defaultSize: { width: 696, height: 532 },
      resizable: true,
      menus: ["AirPort Utility", "File", "Edit", "Base Station", "Window", "Help"],
    });
    expect(app.minSize.width).toBeLessThan(app.defaultSize.width);
    expect(app.minSize.height).toBeLessThan(app.defaultSize.height);
    render(
      <WindowManager style={{ height: 700 }}>
        <ManagedWindow
          id={app.id}
          defaultFrame={{ x: 20, y: 20, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(button("Internet, Connected")).toBeInTheDocument();
  });
});
