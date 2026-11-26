import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });
const paneButton = (name: string) =>
  within(screen.getByRole("group", { name: "All preferences" })).getByRole("button", { name });
const categories = () => screen.getByRole("grid", { name: "Categories" });

describe("Spotlight pane", () => {
  it("opens on Search Results at its frame size with every category on", () => {
    render(<SystemPreferences defaultPane="spotlight" />);
    expect(frame("Spotlight")).toHaveStyle({ width: "668px", height: "597px" });
    expect(screen.getByRole("tab", { name: "Search Results" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const boxes = within(categories()).getAllByRole("checkbox");
    expect(boxes).toHaveLength(20);
    for (const box of boxes) expect(box).toBeChecked();
    expect(within(categories()).getByRole("checkbox", { name: "Music" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Allow Spotlight Suggestions in Look up" }),
    ).toBeChecked();
  });

  it("switches a category off from its box or its title, and keeps it off", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="spotlight" />);
    const category = (name: string) => within(categories()).getByRole("checkbox", { name });

    await user.click(category("Fonts"));
    await user.click(within(categories()).getByText("Movies"));
    expect(category("Fonts")).not.toBeChecked();
    expect(category("Movies")).not.toBeChecked();
    expect(category("Music")).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(paneButton("Spotlight"));
    expect(category("Fonts")).not.toBeChecked();
    expect(category("Movies")).not.toBeChecked();

    await user.click(within(categories()).getByText("Movies"));
    expect(category("Movies")).toBeChecked();
  });

  it("says that the Privacy tab is not part of the demo", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="spotlight" />);
    await user.click(screen.getByRole("tab", { name: "Privacy" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "The Privacy tab is not part of this demo.",
    );
    expect(screen.queryByRole("grid", { name: "Categories" })).toBeNull();
  });
});

// Twenty-one checkboxes, each used in a window opened anew: spread over four tests.
describePaneControls("spotlight", { parts: 4 });
