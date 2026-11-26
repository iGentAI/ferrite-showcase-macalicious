import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SystemPreferences } from "../../system-preferences";
import { describePaneControls } from "../contract";

const services = () => screen.getByRole("grid", { name: "Services" });
const selectedRow = (table: HTMLElement) => within(table).getByRole("row", { selected: true });

describe("Sharing pane", () => {
  it("opens at its frame size with File Sharing on and selected", () => {
    render(<SystemPreferences defaultPane="sharing" />);
    expect(screen.getByRole("region", { name: "Sharing" })).toHaveStyle({ height: "530px" });
    expect(selectedRow(services())).toHaveTextContent("File Sharing");
    expect(screen.getByRole("checkbox", { name: "File Sharing" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Screen Sharing" })).not.toBeChecked();
    for (const name of ["Media Sharing", "Internet Sharing"]) {
      expect(screen.getByRole("checkbox", { name })).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.getByText("File Sharing: On")).toBeVisible();
    expect(selectedRow(screen.getByRole("grid", { name: "Shared Folders:" }))).toHaveTextContent(
      "alexmorgan",
    );
    expect(screen.getByRole("combobox", { name: "Access for Alex Morgan" })).toHaveTextContent(
      "Read & Write",
    );
    expect(screen.getByRole("button", { name: "Remove the selected user" })).toBeDisabled();
  });

  it("renames the computer, switches a service off and changes a permission", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="sharing" />);
    const name = screen.getByRole("textbox", { name: "Computer Name:" });
    expect(name).toHaveValue("Alex’s MacBook Pro");
    expect(screen.getByText(/Alexs-MacBook-Pro\.local/)).toBeVisible();
    await user.clear(name);
    await user.type(name, "Studio Mac");
    expect(screen.getByText(/Studio-Mac\.local/)).toBeVisible();

    await user.click(screen.getByRole("checkbox", { name: "File Sharing" }));
    expect(screen.getByText("File Sharing: Off")).toBeVisible();

    await user.click(screen.getByRole("combobox", { name: "Access for Everyone" }));
    await user.click(await screen.findByRole("option", { name: "No Access" }));
    expect(screen.getByRole("combobox", { name: "Access for Everyone" })).toHaveTextContent(
      "No Access",
    );

    const users = screen.getByRole("grid", { name: "Users:" });
    await user.click(within(users).getByText("Staff"));
    expect(selectedRow(users)).toHaveTextContent("Staff");
    expect(screen.getByRole("button", { name: "Remove the selected user" })).toBeEnabled();
  });

  it("says so for a service that is not captured, and keeps the selection after leaving", async () => {
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="sharing" />);
    await user.click(within(services()).getByText("Remote Login"));
    expect(selectedRow(services())).toHaveTextContent("Remote Login");
    expect(screen.getByText("Remote Login: Off")).toBeVisible();
    expect(
      screen.getByText("The settings of Remote Login are not part of this demo."),
    ).toBeVisible();
    expect(screen.queryByRole("grid", { name: "Users:" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Show All" }));
    const grid = screen.getByRole("group", { name: "All preferences" });
    await user.click(within(grid).getByRole("button", { name: "Sharing" }));
    expect(selectedRow(services())).toHaveTextContent("Remote Login");
  });

  it("lists the folders and the order of services an example gives", () => {
    render(
      <SystemPreferences
        defaultPane="sharing"
        defaultSettings={{
          "sharing.services": ["file-sharing", "internet-sharing", "bluetooth-sharing"],
          "sharing.folders": [
            {
              id: "public",
              name: "jordanlee’s Public Folder",
              title: "jordanlee’s…blic Folder",
              kind: "public",
              users: [{ id: "owner", name: "jordanlee", kind: "user", access: "read-write" }],
            },
          ],
          "sharing.folder": "public",
        }}
      />,
    );
    const rows = within(services()).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      "File Sharing",
      "Internet Sharing",
      "Bluetooth Sharing",
    ]);
    expect(
      within(screen.getByRole("grid", { name: "Shared Folders:" })).getByRole("row", {
        name: "jordanlee’s Public Folder",
      }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("combobox", { name: "Access for jordanlee" })).toBeInTheDocument();
  });
});

describePaneControls("sharing");
