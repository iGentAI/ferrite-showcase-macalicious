import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const checkbox = (name: string) => screen.getByRole("checkbox", { name });

describe("Time Machine pane", () => {
  it("opens at its frame size in the middle of a backup", () => {
    render(<SystemPreferences defaultPane="time-machine" />);
    expect(screen.getByRole("region", { name: "Time Machine" })).toHaveStyle({ height: "440px" });
    expect(checkbox("Back Up Automatically")).toBeChecked();
    expect(checkbox("Show Time Machine in menu bar")).toBeChecked();
    expect(screen.getByText("49.7 GB of 60 GB available")).toBeVisible();
    const progress = screen.getByRole("progressbar", {
      name: "Backing up: 504.6 MB of 787.8 MB",
    });
    expect(progress).toHaveAttribute("aria-valuenow", "504.6");
    expect(progress).toHaveAttribute("aria-valuemax", "787.8");
    expect(screen.getByText("Less than a minute remaining")).toBeVisible();
    const kept = within(screen.getByRole("list", { name: "Time Machine keeps:" }));
    expect(kept.getAllByRole("listitem")).toHaveLength(4);
  });

  it("stops the backup and lists the dates of the backups, as the dark capture does", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="time-machine" />);
    await user.click(screen.getByRole("button", { name: "Stop backing up" }));
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("button", { name: "Stop backing up" })).toBeNull();
    expect(screen.getByText("Latest backup: Today, 10:15 AM")).toBeVisible();
    expect(screen.getByText("Next backup: Today, 11:15 AM")).toBeVisible();

    await user.click(checkbox("Back Up Automatically"));
    expect(checkbox("Back Up Automatically")).not.toBeChecked();
    expect(screen.getByText("Next backup: Automatic backups off")).toBeVisible();
  });

  it("opens idle with the settings an example gives, and keeps a setting after leaving", async () => {
    const user = userEvent.setup();
    render(
      <SystemPreferences
        defaultPane="time-machine"
        defaultSettings={{ "time-machine.backingUp": false, "time-machine.available": "41.3 GB" }}
      />,
    );
    expect(screen.getByText("41.3 GB of 60 GB available")).toBeVisible();
    expect(screen.getByText("Oldest backup: Yesterday, 10:17 AM")).toBeVisible();

    await user.click(checkbox("Show Time Machine in menu bar"));
    await user.click(screen.getByRole("button", { name: "Show All" }));
    const grid = screen.getByRole("group", { name: "All preferences" });
    await user.click(
      within(grid).getByRole("button", {
        name: (accessible) => accessible.replace(/\s+/g, " ") === "Time Machine",
      }),
    );
    expect(checkbox("Show Time Machine in menu bar")).not.toBeChecked();
    expect(screen.getByText("Oldest backup: Yesterday, 10:17 AM")).toBeVisible();
  });
});

describePaneControls("time-machine");
