import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });

describe("Mission Control pane", () => {
  it("opens at its frame size in the captured state", () => {
    render(<SystemPreferences defaultPane="mission-control" />);
    expect(frame("Mission Control")).toHaveStyle({ width: "668px", height: "480px" });

    const spaces = screen.getByRole("group", { name: "Spaces" });
    expect(within(spaces).getAllByRole("checkbox")).toHaveLength(4);
    expect(
      screen.getByRole("checkbox", {
        name: "Automatically rearrange Spaces based on most recent use",
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Group windows by application" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Displays have separate Spaces" })).toBeChecked();

    const shortcuts = screen.getByRole("group", { name: "Keyboard and Mouse Shortcuts" });
    expect(within(shortcuts).getByRole("combobox", { name: "Mission Control:" })).toHaveTextContent(
      "⌃↑",
    );
    expect(
      within(shortcuts).getByRole("combobox", { name: "Application windows:" }),
    ).toHaveTextContent("⌃↓");
    expect(within(shortcuts).getByRole("combobox", { name: "Show Desktop:" })).toHaveTextContent(
      "F11",
    );
    expect(screen.getByRole("button", { name: "Hot Corners…" })).toBeEnabled();
  });

  it("toggles a checkbox and keeps it after leaving the pane and coming back", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="mission-control" />);
    const group = () => screen.getByRole("checkbox", { name: "Group windows by application" });
    await user.click(group());
    expect(group()).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    expect(frame("System Preferences")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(frame("Mission Control")).toBeInTheDocument();
    expect(group()).toBeChecked();
  });

  it("chooses another shortcut from a pop-up button's menu", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="mission-control" />);
    const showDesktop = () => screen.getByRole("combobox", { name: "Show Desktop:" });
    await user.click(showDesktop());
    expect(await screen.findByRole("option", { name: "F11" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("option", { name: "F12" }));
    expect(showDesktop()).toHaveTextContent("F12");
    // The other shortcuts are settings of their own.
    expect(screen.getByRole("combobox", { name: "Mission Control:" })).toHaveTextContent("⌃↑");
  });
});

describePaneControls("mission-control");
