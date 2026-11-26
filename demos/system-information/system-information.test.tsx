import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuItem } from "macalicious/menu-item";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SystemInformation } from "./system-information";
import {
  formatDate,
  type SystemInformationColumn,
  type SystemInformationItem,
  type SystemInformationRow,
  sortRows,
} from "./system-information-data";

/*
 * jsdom has no layout, so the outline is never measured and renders its first 40 rows. The
 * tests that need a Software category open the window with only that group expanded.
 */
const frame = () => screen.getByRole("region", { name: "MacBook Pro" });
const outline = () => screen.getByRole("treegrid", { name: "Categories" });
const category = (name: string) => within(outline()).getByText(name);
const selectedCategory = () =>
  within(outline())
    .getAllByRole("row")
    .filter((row) => row.getAttribute("aria-selected") === "true")
    .map((row) => row.textContent);
const report = (name: string) => screen.getByRole("textbox", { name });
const path = () => screen.getByRole("group", { name: "Path" }).textContent;
/** The first column of a table report, top to bottom. */
const listed = (name: string) =>
  within(screen.getByRole("grid", { name }))
    .getAllByRole("row")
    .filter((row) => row.hasAttribute("aria-selected"))
    .map((row) => within(row).getAllByRole("gridcell")[0]?.textContent);
const heading = (name: string) => screen.getByRole("columnheader", { name });
/** A heading sorts through the button inside it. */
const sortBy = (name: string) => screen.getByRole("button", { name });

describe("the window", () => {
  it("opens on the Hardware overview at the captured size", () => {
    render(<SystemInformation />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("751px");
    expect(frame().style.height).toBe("520px");
    expect(selectedCategory()).toEqual(["Hardware"]);
    const overview = within(report("Hardware report"));
    expect(overview.getByText("Hardware Overview:")).toBeInTheDocument();
    expect(overview.getByText("Model Identifier:").nextElementSibling).toHaveTextContent(
      "MacBookPro15,1",
    );
    expect(path()).toBe("ismh15 › Hardware");
  });

  it("hands the window's props to the frame and the controls' callbacks to the controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SystemInformation state="inactive" data-host="desk" onClose={onClose} />);
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-host", "desk");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("the outline", () => {
  it("shows the report of the category that is chosen, and its path", async () => {
    const user = userEvent.setup();
    const onSelectedIdChange = vi.fn();
    render(<SystemInformation onSelectedIdChange={onSelectedIdChange} />);

    await user.click(category("Memory"));
    expect(selectedCategory()).toEqual(["Memory"]);
    expect(onSelectedIdChange).toHaveBeenLastCalledWith("hardware/memory");
    expect(screen.queryByText("Hardware Overview:")).not.toBeInTheDocument();
    expect(within(report("Memory report")).getByText("Memory Slots:")).toBeInTheDocument();
    expect(path()).toBe("ismh15 › Hardware › Memory");

    // A category the computer has nothing for says so.
    await user.click(category("FireWire"));
    expect(report("FireWire report")).toHaveTextContent("No information found.");
    expect(path()).toBe("ismh15 › Hardware › FireWire");
  });

  it("moves the selection with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<SystemInformation />);
    await user.click(category("Hardware"));
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(selectedCategory()).toEqual(["Apple Pay"]);
    expect(report("Apple Pay report")).toHaveTextContent("Apple Pay Information:");
  });

  it("shows the first category when the one asked for does not exist", () => {
    render(<SystemInformation defaultSelectedId="hardware/abacus" />);
    expect(selectedCategory()).toEqual(["Hardware"]);
    expect(path()).toBe("ismh15 › Hardware");
  });

  it("shows the category its host selects", async () => {
    const user = userEvent.setup();
    function Host() {
      const [id, setId] = useState("network/firewall");
      return (
        <>
          <button type="button" onClick={() => setId("hardware/power")}>
            Show Power
          </button>
          <SystemInformation selectedId={id} onSelectedIdChange={setId} />
        </>
      );
    }
    render(<Host />);
    expect(path()).toBe("ismh15 › Network › Firewall");
    await user.click(screen.getByRole("button", { name: "Show Power" }));
    expect(selectedCategory()).toEqual(["Power"]);
    expect(report("Power report")).toHaveTextContent("Battery Information:");
  });
});

describe("a report that lists things", () => {
  const open = async () => {
    const user = userEvent.setup();
    render(<SystemInformation defaultExpanded={["software"]} />);
    await user.click(category("Applications"));
    return user;
  };

  it("chooses several rows, shows the first one's details, and reports them by category", async () => {
    const onSelectedRowsChange = vi.fn();
    const user = userEvent.setup();
    render(
      <SystemInformation
        defaultExpanded={["software"]}
        onSelectedRowsChange={onSelectedRowsChange}
      />,
    );
    await user.click(category("Applications"));
    const grid = screen.getByRole("grid", { name: "Applications" });
    await user.click(within(grid).getByText("Calendar"));
    await user.keyboard("{Meta>}");
    await user.click(within(grid).getByText("Calculator"));
    await user.keyboard("{/Meta}");
    expect(onSelectedRowsChange).toHaveBeenCalledTimes(2);
    const last = onSelectedRowsChange.mock.lastCall?.[0];
    expect(Object.values(last)).toEqual([
      expect.arrayContaining([expect.any(String), expect.any(String)]),
    ]);
    expect(path()).toContain("Calculator");
  });

  it("opens a report menu only when the host gives it items", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SystemInformation />);
    await user.pointer({ keys: "[MouseRight]", target: report("Hardware report") });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    unmount();
    render(<SystemInformation reportMenu={<MenuItem>Copy</MenuItem>} />);
    await user.pointer({ keys: "[MouseRight]", target: report("Hardware report") });
    expect(await screen.findByRole("menu")).toHaveTextContent("Copy");
  });

  it("sorts by the heading that is clicked, and the other way when it is clicked again", async () => {
    const user = await open();
    expect(listed("Applications").slice(0, 3)).toEqual([
      "Activity Monitor",
      "Calculator",
      "Calendar",
    ]);

    await user.click(sortBy("Version"));
    expect(heading("Version")).toHaveAttribute("aria-sort", "ascending");
    // Versions are ordered as numbers: 1.0 before 1.15 before 10.14.
    expect(listed("Applications").slice(0, 4)).toEqual([
      "Music",
      "Podcasts",
      "Console",
      "TextEdit",
    ]);

    await user.click(sortBy("Version"));
    expect(heading("Version")).toHaveAttribute("aria-sort", "descending");
    expect(listed("Applications")[0]).toBe("System Preferences");
  });

  it("shows the details of the selected row and adds it to the path", async () => {
    const user = await open();
    expect(report("Applications details")).toBeEmptyDOMElement();
    await user.click(within(screen.getByRole("grid", { name: "Applications" })).getByText("Notes"));
    const details = within(report("Applications details"));
    expect(details.getByText("Location:").nextElementSibling).toHaveTextContent(
      "/System/Applications/Notes.app",
    );
    expect(path()).toBe("ismh15 › Software › Applications › Notes");
  });

  it("labels a row by its first column, whatever the column is called", async () => {
    const user = userEvent.setup();
    const items: SystemInformationItem[] = [
      {
        id: "printers",
        name: "Printers",
        report: {
          kind: "table",
          columns: [
            { id: "queue", title: "Queue" },
            { id: "status", title: "Status", width: 80 },
          ],
          rows: [{ id: "1", cells: { queue: "Front Desk", status: "Idle" }, sections: [] }],
        },
      },
    ];
    render(<SystemInformation items={items} defaultSelectedId="printers" />);
    await user.click(within(screen.getByRole("grid", { name: "Printers" })).getByText("Idle"));
    expect(path()).toBe("ismh15 › Printers › Front Desk");
  });

  it("keeps its order and its selected row while another category is shown", async () => {
    const user = await open();
    await user.click(sortBy("Last Modified"));
    await user.click(within(screen.getByRole("grid", { name: "Applications" })).getByText("Mail"));

    await user.click(category("Extensions"));
    expect(heading("Extension Name")).not.toHaveAttribute("aria-sort", "ascending");
    expect(path()).toBe("ismh15 › Software › Extensions");

    await user.click(category("Applications"));
    expect(heading("Last Modified")).toHaveAttribute("aria-sort", "ascending");
    expect(listed("Applications")[0]).toBe("Typesetter");
    expect(path()).toBe("ismh15 › Software › Applications › Mail");
  });
});

describe("the report's data", () => {
  it("writes a date on the twelve-hour clock", () => {
    expect(formatDate("2019-09-29T18:20")).toBe("9/29/19, 6:20 PM");
    expect(formatDate("2019-10-01T00:05")).toBe("10/1/19, 12:05 AM");
    expect(formatDate("2018-11-02T12:00")).toBe("11/2/18, 12:00 PM");
  });

  it("orders a date column by time, not by the text it shows", () => {
    const columns: SystemInformationColumn[] = [{ id: "when", title: "When", kind: "date" }];
    const row = (id: string, when: string): SystemInformationRow => ({
      id,
      cells: { when },
      sections: [],
    });
    // As text, "11/2/18" sorts before "9/29/19" and after "10/1/19".
    const rows = [
      row("b", "2019-09-29T18:20"),
      row("c", "2019-10-01T00:05"),
      row("a", "2018-11-02T12:00"),
    ];
    const order = (direction: "ascending" | "descending") =>
      sortRows(rows, columns, { column: "when", direction }).map((entry) => entry.id);
    expect(order("ascending")).toEqual(["a", "b", "c"]);
    expect(order("descending")).toEqual(["c", "b", "a"]);
  });
});
