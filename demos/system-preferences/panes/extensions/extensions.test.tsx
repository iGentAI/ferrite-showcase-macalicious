import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const frame = (name: string) => screen.getByRole("region", { name });
const paneButton = (name: string) =>
  within(screen.getByRole("group", { name: "All preferences" })).getByRole("button", { name });
const categories = () => screen.getByRole("listbox", { name: "Extension categories" });
const extension = (name: string) => screen.getByRole("checkbox", { name });

describe("Extensions pane", () => {
  it("opens on the Share Menu at its frame size in the captured state", () => {
    render(<SystemPreferences defaultPane="extensions" />);
    expect(frame("Extensions")).toHaveStyle({ width: "668px", height: "508px" });
    expect(within(categories()).getByRole("option", { selected: true })).toHaveTextContent(
      "Share MenuAdd to Reading List, Mail, and 6 more…",
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(9);
    expect(extension("Add to Reading List")).toBeChecked();
    expect(extension("Mail")).toBeChecked();
    expect(extension("Mail")).toHaveAttribute("aria-disabled", "true");
    expect(extension("Add People")).toHaveAttribute("aria-disabled", "true");
    expect(extension("Save to Books")).not.toBeChecked();
    expect(screen.getByRole("img", { name: "New" })).toBeInTheDocument();
  });

  it("switches an extension on, which clears its dot and is kept", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="extensions" />);
    await user.click(extension("Save to Books"));
    await user.click(screen.getByText("Notes"));
    expect(extension("Save to Books")).toBeChecked();
    expect(extension("Notes")).not.toBeChecked();
    expect(screen.queryByRole("img", { name: "New" })).toBeNull();
    expect(within(categories()).getByRole("option", { selected: true })).toHaveTextContent(
      "Add to Reading List, Mail, and 6 more…",
    );

    // A built-in extension stays on.
    await user.click(screen.getByText("AirDrop"));
    expect(extension("AirDrop")).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(paneButton("Extensions"));
    expect(extension("Save to Books")).toBeChecked();
    expect(extension("Notes")).not.toBeChecked();
  });

  it("says so for a category that is not captured", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="extensions" />);
    await user.click(within(categories()).getByText("Today"));
    expect(within(categories()).getByRole("option", { selected: true })).toHaveTextContent("Today");
    expect(screen.getByText("The Today extensions are not part of this demo.")).toBeVisible();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describePaneControls("extensions");
