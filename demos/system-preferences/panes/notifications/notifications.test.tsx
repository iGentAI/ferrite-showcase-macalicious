import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";

const element = (picker: string, name: string) =>
  within(screen.getByRole("group", { name: picker })).getByRole("spinbutton", { name });

describe("Notifications pane", () => {
  it("has the two times of Do Not Disturb as the library's date pickers", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="notifications" />);
    expect(element("From", "Hour")).toHaveAttribute("aria-valuetext", "10");
    expect(element("From", "Minute")).toHaveAttribute("aria-valuetext", "00");
    expect(element("From", "AM/PM")).toHaveAttribute("aria-valuetext", "PM");
    expect(element("to:", "Hour")).toHaveAttribute("aria-valuetext", "7");
    expect(element("to:", "AM/PM")).toHaveAttribute("aria-valuetext", "AM");

    element("to:", "Hour").focus();
    await user.keyboard("{ArrowUp}");
    expect(element("to:", "Hour")).toHaveAttribute("aria-valuetext", "8");

    // The time is a setting of the pane: it survives leaving it and coming back.
    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(element("to:", "Hour")).toHaveAttribute("aria-valuetext", "8");
  });
});
