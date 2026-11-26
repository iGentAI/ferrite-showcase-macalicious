import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });
const option = (name: string | RegExp) => screen.getByRole("checkbox", { name });
const delay = () => screen.getByRole("slider", { name: "Turn display off after:" });
const restore = () => screen.getByRole("button", { name: "Restore Defaults" });

describe("Energy Saver pane", () => {
  it("opens on Power Adapter at its frame size in the captured state", () => {
    render(<SystemPreferences defaultPane="energy-saver" />);
    expect(frame("Energy Saver")).toHaveStyle({ width: "668px", height: "505px" });
    expect(screen.getByRole("tab", { name: "Power Adapter" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(option("Automatic graphics switching")).toBeChecked();
    expect(option(/^Prevent computer from sleeping/)).not.toBeChecked();
    expect(option("Put hard disks to sleep when possible")).toBeChecked();
    expect(option("Wake for Wi-Fi network access")).toBeChecked();
    expect(option(/^Enable Power Nap/)).toBeChecked();
    expect(option("Show battery status in menu bar")).toBeChecked();
    // The thumb is on the fourth of sixteen marks, between two the legend names.
    expect(delay()).toHaveValue("3");
    expect(delay()).toHaveAttribute("aria-valuetext", "Between 1 minute and 15 minutes");
    expect(screen.getByText("Battery is charged.")).toBeVisible();
    expect(restore()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Schedule…" })).toBeEnabled();
  });

  it("restores the captured settings of the tab once one has changed", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="energy-saver" />);
    await user.click(option("Wake for Wi-Fi network access"));
    expect(option("Wake for Wi-Fi network access")).not.toBeChecked();
    expect(restore()).toBeEnabled();

    delay().focus();
    await user.keyboard("{ArrowRight}");
    expect(delay()).toHaveValue("4");
    expect(delay()).toHaveAttribute("aria-valuetext", "15 minutes");
    await user.keyboard("{End}");
    expect(delay()).toHaveAttribute("aria-valuetext", "Never");

    await user.click(restore());
    expect(option("Wake for Wi-Fi network access")).toBeChecked();
    expect(delay()).toHaveValue("3");
    expect(restore()).toBeDisabled();
  });

  it("keeps its settings and its tab after leaving the pane and coming back", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="energy-saver" />);
    await user.click(option(/^Prevent computer from sleeping/));
    await user.click(option("Show battery status in menu bar"));
    await user.click(screen.getByRole("tab", { name: "Battery" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "The Battery tab is not part of this demo.",
    );

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("tab", { name: "Battery" })).toHaveAttribute("aria-selected", "true");
    expect(option("Show battery status in menu bar")).not.toBeChecked();
    await user.click(screen.getByRole("tab", { name: "Power Adapter" }));
    expect(option(/^Prevent computer from sleeping/)).toBeChecked();
    expect(restore()).toBeEnabled();
  });

  it("shows the line about the battery that an example gives", () => {
    render(
      <SystemPreferences
        defaultPane="energy-saver"
        defaultSettings={{ "energy-saver.batteryStatus": "Current battery charge: 95%" }}
      />,
    );
    const panel = within(screen.getByRole("tabpanel"));
    expect(panel.getByText("Current battery charge: 95%")).toBeVisible();
    expect(panel.queryByText("Battery is charged.")).toBeNull();
  });
});

describePaneControls("energy-saver");
