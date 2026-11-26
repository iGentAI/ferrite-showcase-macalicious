import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });
const devices = () => screen.getByRole("listbox", { name: "Devices" });

describe("Bluetooth pane", () => {
  it("opens at its frame size with Bluetooth on and the mouse connected", () => {
    render(<SystemPreferences defaultPane="bluetooth" />);
    expect(frame("Bluetooth")).toHaveStyle({ width: "668px", height: "432px" });
    expect(screen.getByText("Bluetooth: On")).toBeVisible();
    expect(screen.getByText("Now discoverable as")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Looking for devices" })).toBeVisible();

    const rows = within(devices()).getAllByRole("option");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAccessibleName("Alex’s Magic Mouse 2, Connected - Charged");
    expect(rows[0]).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("checkbox", { name: "Show Bluetooth in menu bar" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Advanced…" })).toBeEnabled();
  });

  it("turns Bluetooth off and on again, and keeps it off across panes", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="bluetooth" />);
    await user.click(screen.getByRole("button", { name: "Turn Bluetooth Off" }));
    expect(screen.getByText("Bluetooth: Off")).toBeVisible();
    expect(screen.queryByText("Now discoverable as")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(within(devices()).getByRole("option")).toHaveAccessibleName(
      "Alex’s Magic Mouse 2, Not Connected",
    );

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Bluetooth: Off")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Turn Bluetooth On" }));
    expect(screen.getByText("Bluetooth: On")).toBeVisible();
    expect(within(devices()).getByRole("option")).toHaveAccessibleName(
      "Alex’s Magic Mouse 2, Connected - Charged",
    );
  });

  it("selects the device and toggles the menu bar checkbox", async () => {
    const user = userEvent.setup();
    render(
      <SystemPreferences
        defaultPane="bluetooth"
        defaultSettings={{ "bluetooth.connected": false }}
      />,
    );
    const row = within(devices()).getByRole("option");
    expect(row).toHaveAccessibleName("Alex’s Magic Mouse 2, Not Connected");
    await user.click(within(row).getByText("Alex’s Magic Mouse 2"));
    expect(row).toHaveAttribute("aria-selected", "true");

    const menuBar = screen.getByRole("checkbox", { name: "Show Bluetooth in menu bar" });
    await user.click(menuBar);
    expect(menuBar).toBeChecked();
  });
});

describePaneControls("bluetooth");
