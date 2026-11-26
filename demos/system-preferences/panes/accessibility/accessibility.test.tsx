import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });
const categories = () => screen.getByRole("listbox", { name: "Accessibility features" });
const selected = () => within(categories()).getByRole("option", { selected: true });
const menuBar = () =>
  screen.getByRole("checkbox", { name: "Show Accessibility status in menu bar" });

describe("Accessibility pane", () => {
  it("opens on the Overview at its frame size in the captured state", () => {
    render(<SystemPreferences defaultPane="accessibility" />);
    expect(frame("Accessibility")).toHaveStyle({ width: "668px", height: "476px" });
    const rows = within(categories()).getAllByRole("option");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Overview",
      "VoiceOver",
      "Zoom",
      "Display",
      "Speech",
      "Descriptions",
      "Audio",
      "Captions",
    ]);
    expect(selected()).toHaveTextContent("Overview");
    const overview = within(screen.getByRole("group", { name: "Overview" }));
    expect(
      overview.getByText(/^Accessibility features adapt your Mac to your\s*individual needs\.$/),
    ).toBeVisible();
    expect(overview.getByText(/^Your Mac can be customized/)).toBeVisible();
    expect(menuBar()).not.toBeChecked();
  });

  it("says so for a category that is not captured, and comes back to the Overview", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="accessibility" />);
    await user.click(within(categories()).getByText("Zoom"));
    expect(selected()).toHaveTextContent("Zoom");
    expect(
      within(screen.getByRole("group", { name: "Zoom" })).getByText(
        "The Zoom settings are not part of this demo.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/^Your Mac can be customized/)).toBeNull();

    // The list is one tab stop; the arrow keys move the selection past the headings.
    await user.keyboard("{ArrowUp}");
    expect(selected()).toHaveTextContent("VoiceOver");
    await user.keyboard("{ArrowUp}");
    expect(selected()).toHaveTextContent("Overview");
    expect(screen.getByText(/^Your Mac can be customized/)).toBeVisible();
  });

  it("keeps the category and the checkbox after leaving the pane and coming back", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="accessibility" />);
    await user.click(menuBar());
    expect(menuBar()).toBeChecked();
    await user.click(within(categories()).getByText("Captions"));

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(menuBar()).toBeChecked();
    expect(selected()).toHaveTextContent("Captions");
    expect(screen.getByText("The Captions settings are not part of this demo.")).toBeVisible();
  });
});

describePaneControls("accessibility");
