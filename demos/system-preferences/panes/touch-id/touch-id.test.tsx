import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });

describe("Touch ID pane", () => {
  it("opens at its frame size with one fingerprint and every use on", () => {
    render(<SystemPreferences defaultPane="touch-id" />);
    expect(frame("Touch ID")).toHaveStyle({ width: "668px", height: "338px" });
    expect(screen.getByRole("button", { name: "Finger 1" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add a fingerprint" })).toBeEnabled();

    const uses = screen.getByRole("group", { name: "Use Touch ID for:" });
    const boxes = within(uses).getAllByRole("checkbox");
    expect(boxes.map((box) => box.textContent)).toEqual([
      "Unlocking your Mac",
      "Apple Pay",
      "iTunes Store, App Store & Apple Books",
      "Password AutoFill",
    ]);
    for (const box of boxes) expect(box).toBeChecked();
  });

  it("turns a use off and keeps it off after leaving the pane and coming back", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="touch-id" />);
    const applePay = () => screen.getByRole("checkbox", { name: "Apple Pay" });
    await user.click(applePay());
    expect(applePay()).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Password AutoFill" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(applePay()).not.toBeChecked();
  });

  it("adds fingerprints up to three, then offers no more", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="touch-id" />);
    await user.click(screen.getByRole("button", { name: "Add a fingerprint" }));
    expect(screen.getByRole("button", { name: "Finger 2" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add a fingerprint" }));
    expect(screen.getByRole("button", { name: "Finger 3" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Add a fingerprint" })).toBeNull();
  });
});

describePaneControls("touch-id");
