import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const open = () => render(<SystemPreferences defaultPane="apple-id" />);
const pages = () => screen.getByRole("listbox", { name: "Apple ID" });
const page = (name: string | RegExp) => within(pages()).getByRole("option", { name });
const apps = () => screen.getByRole("grid", { name: "Apps on this Mac using iCloud:" });
const app = (name: string) => within(apps()).getByRole("checkbox", { name });

describe("Apple ID pane", () => {
  it("opens on iCloud at its frame size with every app on", () => {
    open();
    expect(screen.getByRole("region", { name: "Apple ID" })).toHaveStyle({
      width: "668px",
      height: "598px",
    });
    expect(page("iCloud")).toHaveAttribute("aria-selected", "true");
    expect(page(/Media & Purchases/)).toHaveAttribute("aria-disabled", "true");
    expect(page(/Media & Purchases/)).toHaveTextContent("Not Signed In");

    const boxes = within(apps()).getAllByRole("checkbox");
    expect(boxes).toHaveLength(9);
    for (const box of boxes) expect(box).toBeChecked();
    expect(app("iCloud Drive")).toBeChecked();
    expect(app("Siri")).toBeChecked();
    expect(screen.getByRole("button", { name: "iCloud Drive Options…" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Optimize Mac Storage" })).toBeChecked();

    expect(screen.getByText("5 GB (4.81 GB Available)")).toBeVisible();
    expect(screen.getByRole("meter", { name: "iCloud Storage:" })).toHaveAttribute(
      "aria-valuetext",
      "0.19 GB of 5 GB used, 4.81 GB available",
    );
  });

  it("switches apps off by the checkbox or the name, and keeps them off after leaving", async () => {
    const user = userEvent.setup();
    open();
    await user.click(app("Photos"));
    await user.click(within(apps()).getByText("Notes"));
    await user.click(screen.getByRole("checkbox", { name: "Optimize Mac Storage" }));
    expect(app("Photos")).not.toBeChecked();
    expect(app("Notes")).not.toBeChecked();
    expect(app("Mail")).toBeChecked();

    // The pane is opened from the account header of the grid, not from an icon of the bands.
    await user.click(screen.getByRole("button", { name: "Show All" }));
    const grid = screen.getByRole("group", { name: "All preferences" });
    await user.click(within(grid).getByRole("button", { name: "Apple ID" }));
    expect(app("Photos")).not.toBeChecked();
    expect(app("Notes")).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Optimize Mac Storage" })).not.toBeChecked();

    await user.click(within(apps()).getByText("Notes"));
    expect(app("Notes")).toBeChecked();
  });

  it("says so for a page that is not captured, and does not open Media & Purchases", async () => {
    const user = userEvent.setup();
    open();
    await user.click(within(pages()).getByText("Password & Security"));
    expect(page("Password & Security")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByText("The Password & Security page is not part of this demo."),
    ).toBeVisible();
    expect(screen.queryByRole("grid")).toBeNull();

    await user.click(within(pages()).getByText("Media & Purchases"));
    expect(page("Password & Security")).toHaveAttribute("aria-selected", "true");

    // The page that is open is kept, too.
    await user.click(screen.getByRole("button", { name: "Show All" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(page("Password & Security")).toHaveAttribute("aria-selected", "true");
    await user.click(within(pages()).getByText("iCloud"));
    expect(app("iCloud Drive")).toBeChecked();

    // What Manage and Options open is in no screenshot.
    await user.click(screen.getByRole("button", { name: "Manage…" }));
    expect(await screen.findByRole("dialog", { name: "Not part of this demo" })).toHaveTextContent(
      "“Manage…”",
    );
  });
});

describePaneControls("apple-id");
