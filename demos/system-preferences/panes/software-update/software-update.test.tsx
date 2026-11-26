import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const automatic = () =>
  screen.getByRole("checkbox", { name: "Automatically keep my Mac up to date" });

describe("Software Update pane", () => {
  it("opens at its frame size, up to date, with the checkbox mixed", () => {
    render(<SystemPreferences defaultPane="software-update" />);
    expect(screen.getByRole("region", { name: "Software Update" })).toHaveStyle({
      width: "668px",
      height: "285px",
    });
    expect(
      screen.getByText("Your Mac is up to date — macOS Catalina Beta 10.15"),
    ).toBeInTheDocument();
    expect(screen.getByText("Last checked: Today at 10:47 AM")).toBeInTheDocument();
    expect(automatic()).toBePartiallyChecked();
    expect(screen.getByRole("button", { name: "Advanced…" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Help" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Details…" })).toBeInTheDocument();
  });

  it("turns the mixed checkbox on, then off, and keeps it across panes", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="software-update" />);
    await user.click(automatic());
    expect(automatic()).toBeChecked();
    await user.click(automatic());
    expect(automatic()).not.toBeChecked();
    expect(automatic()).not.toBePartiallyChecked();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    expect(screen.getByRole("region", { name: "System Preferences" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(automatic()).not.toBeChecked();
    expect(automatic()).not.toBePartiallyChecked();
  });

  it("shows the time it is given as the last check", () => {
    render(
      <SystemPreferences
        defaultPane="software-update"
        defaultSettings={{ "software-update.lastChecked": "Today at 10:29 AM" }}
      />,
    );
    expect(screen.getByText("Last checked: Today at 10:29 AM")).toBeInTheDocument();
  });
});

describePaneControls("software-update");
