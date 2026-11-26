import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const sections = () => screen.getByRole("listbox", { name: "Screen Time" });
const apps = () => screen.getByRole("grid", { name: "Apps" });
const day = () => screen.getByRole("combobox", { name: "Day" });

describe("Screen Time pane", () => {
  it("opens at its frame size on the App Usage of October 3", () => {
    render(<SystemPreferences defaultPane="screen-time" />);
    expect(screen.getByRole("region", { name: "Screen Time" })).toHaveStyle({ height: "613px" });
    expect(within(sections()).getByRole("option", { selected: true })).toHaveTextContent(
      "App Usage",
    );
    expect(within(sections()).getAllByRole("option")).toHaveLength(8);
    expect(day()).toHaveTextContent("Today, October 3");
    expect(screen.getByText("48m")).toBeVisible();
    expect(screen.getByRole("radio", { name: "Apps" })).toBeChecked();
    expect(within(apps()).getByRole("row", { selected: true })).toHaveTextContent("All Apps");
    expect(
      within(apps())
        .getAllByRole("row")
        .map((row) => row.textContent),
    ).toEqual([
      "All Apps",
      "Finder47m",
      "Safari11m",
      "System Preferences10m",
      "System Information8m",
    ]);
    expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
    expect(screen.getByText("Updated today at 10:45 AM")).toBeVisible();
  });

  it("selects an app, and says so for the scope and the sections that are not captured", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="screen-time" />);
    await user.click(within(apps()).getByText("Safari"));
    expect(within(apps()).getByRole("row", { selected: true })).toHaveTextContent("Safari");

    await user.click(screen.getByRole("radio", { name: "Categories" }));
    expect(screen.getByText("The list of categories is not part of this demo.")).toBeVisible();
    expect(screen.queryByRole("grid", { name: "Apps" })).toBeNull();

    await user.click(within(sections()).getByText("Downtime"));
    expect(screen.getByText("The Downtime section is not part of this demo.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    const grid = screen.getByRole("group", { name: "All preferences" });
    await user.click(within(grid).getByRole("button", { name: "Screen Time" }));
    expect(within(sections()).getByRole("option", { selected: true })).toHaveTextContent(
      "Downtime",
    );
  });

  it("steps through the captured days up to the day an example calls today", async () => {
    const user = userEvent.setup();
    render(
      <SystemPreferences
        defaultPane="screen-time"
        defaultSettings={{ "screen-time.today": "2019-10-04", "screen-time.picture": "none" }}
      />,
    );
    expect(day()).toHaveTextContent("Today, October 4");
    expect(screen.getByText("14m", { selector: "[data-text-style='large-value']" })).toBeVisible();
    expect(within(apps()).getByText("TextEdit")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Previous day" }));
    expect(day()).toHaveTextContent("Thursday, October 3");
    expect(screen.getByText("48m")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next day" })).toBeEnabled();
    expect(screen.getByText("Updated today at 10:26 AM")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(day()).toHaveTextContent("Today, October 4");

    await user.click(day());
    await user.click(await screen.findByRole("option", { name: "Thursday, October 3" }));
    expect(within(apps()).getByText("Safari")).toBeVisible();
  });
});

describePaneControls("screen-time");
