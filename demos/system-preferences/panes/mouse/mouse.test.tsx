import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });
const row = (id: string) => document.querySelector(`[data-gesture="${id}"]`);

describe("Mouse pane", () => {
  it("opens on Point & Click at its frame size in the captured state", () => {
    render(<SystemPreferences defaultPane="mouse" />);
    expect(frame("Mouse")).toHaveStyle({ width: "668px", height: "512px" });
    expect(screen.getByRole("tab", { name: "Point & Click" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const natural = screen.getByRole("checkbox", { name: "Scroll direction: Natural" });
    expect(natural).toBeChecked();
    expect(natural).toHaveAccessibleDescription("Content tracks finger movement");
    expect(row("scroll-direction")).toHaveAttribute("data-highlighted");
    expect(screen.getByRole("checkbox", { name: "Secondary click" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Smart zoom" })).not.toBeChecked();
    expect(screen.getByRole("slider", { name: "Tracking speed" })).toHaveValue("3");
    expect(screen.getByText("100%")).toBeVisible();
    expect(screen.getByRole("button", { name: "Set Up Bluetooth Mouse…" })).toBeEnabled();
  });

  it("offers the side of the secondary click only while the gesture is on", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="mouse" />);
    const side = (title: string) =>
      screen.getByRole("button", { name: `Secondary click: Click on ${title} side` });
    expect(side("right")).toBeDisabled();

    await user.click(screen.getByText("Secondary click"));
    expect(screen.getByRole("checkbox", { name: "Secondary click" })).toBeChecked();
    expect(row("secondary-click")).toHaveAttribute("data-highlighted");
    expect(row("scroll-direction")).not.toHaveAttribute("data-highlighted");
    expect(side("right")).toBeEnabled();

    await user.click(side("right"));
    await user.click(await screen.findByRole("menuitemradio", { name: "Click on left side" }));
    expect(side("left")).toHaveTextContent("Click on left side");
  });

  it("moves the tracking speed from tick mark to tick mark and keeps it", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="mouse" />);
    const speed = () => screen.getByRole("slider", { name: "Tracking speed" });
    speed().focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(speed()).toHaveValue("5");

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(speed()).toHaveValue("5");
  });

  it("says that More Gestures is not part of the demo", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="mouse" />);
    await user.click(screen.getByRole("tab", { name: "More Gestures" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "The More Gestures tab is not part of this demo.",
    );
  });
});

describePaneControls("mouse");
