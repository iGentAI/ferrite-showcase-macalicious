import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { StorageManagement } from "./storage-management";
import {
  formatDate,
  formatSize,
  type StorageCategory,
  type StorageFile,
  sortFiles,
} from "./storage-management-data";

/*
 * jsdom has no layout, so a table is never measured and renders its first rows: every
 * category of the demo lists fewer than that.
 */
/* The window is the region named by its title; an open category is a region of its own. */
const frame = () => screen.getByRole("region", { name: /available of/ });
const sidebar = () => screen.getByRole("tree", { name: "Categories" });
const rows = () => within(sidebar()).getAllByRole("treeitem");
const row = (name: string) => within(sidebar()).getByRole("treeitem", { name });
const selectedRow = () =>
  rows()
    .filter((item) => item.getAttribute("aria-selected") === "true")
    .map((item) => item.textContent);
const button = (name: string) => screen.getByRole("button", { name });
const recommendation = (name: string) =>
  screen.getByRole("heading", { name }).closest("li") as HTMLElement;
const table = (name: string) => screen.getByRole("grid", { name });
/** The Name column of a category's table, top to bottom. */
const listed = (name: string) =>
  within(table(name))
    .getAllByRole("row")
    .filter((item) => item.hasAttribute("aria-selected"))
    .map((item) => within(item).getAllByRole("gridcell")[0]?.textContent);
const heading = (name: string) => screen.getByRole("columnheader", { name });

describe("the window", () => {
  it("opens on Recommendations at the captured size, titled with the free space", () => {
    render(<StorageManagement />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("801px");
    expect(frame().style.height).toBe("532px");
    expect(frame()).toHaveAccessibleName("Macintosh SSD - 195.81 GB available of 249.85 GB");
    expect(rows().map((item) => item.textContent)).toEqual([
      "Recommendations",
      "Documents6.92 GB",
      "iCloud Drive3.6 MB",
      "Music58.4 MB",
      "Photos256.3 MB",
      "TV6 GB",
      "System16.36 GB",
      "Other6.32 GB",
    ]);
    expect(selectedRow()).toEqual(["Recommendations"]);
    expect(
      within(screen.getByRole("list", { name: "Recommendations" }))
        .getAllByRole("heading")
        .map((item) => item.textContent),
    ).toEqual([
      "Store in iCloud",
      "Optimize Storage",
      "Empty Trash Automatically",
      "Reduce Clutter",
    ]);
    expect(button("Enter Full Screen")).toBeEnabled();
  });

  it("hands the window's props to the frame and the hosting callbacks to their parts", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    render(
      <StorageManagement
        state="inactive"
        data-host="desk"
        className="mine"
        onClose={onClose}
        onDragRegionPointerDown={onDragRegionPointerDown}
      />,
    );
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-host", "desk");
    expect(frame()).toHaveClass("mac-window", "mine");
    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(frame().querySelector("[data-window-drag-region]") as HTMLElement, {
      button: 0,
    });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
  });
});

describe("the recommendations", () => {
  it("carries one out when its button is pressed, and says so in its place", async () => {
    const user = userEvent.setup();
    const onRecommendation = vi.fn();
    render(<StorageManagement onRecommendation={onRecommendation} />);

    await user.click(button("Turn On…"));
    expect(onRecommendation).toHaveBeenLastCalledWith("trash");
    const trash = within(recommendation("Empty Trash Automatically"));
    expect(trash.getByRole("status")).toHaveTextContent("Completed");
    expect(trash.queryByRole("button")).toBeNull();
    // The others still wait for their button.
    expect(screen.getAllByRole("status")).toHaveLength(1);

    await user.click(button("Optimize…"));
    expect(onRecommendation).toHaveBeenLastCalledWith("optimize");
    expect(within(recommendation("Optimize Storage")).getByRole("status")).toHaveTextContent(
      "Completed",
    );
  });

  it("opens Documents for Review Files, and stays completed while a category is shown", async () => {
    const user = userEvent.setup();
    const onRecommendation = vi.fn();
    const onSelectedIdChange = vi.fn();
    render(
      <StorageManagement
        onRecommendation={onRecommendation}
        onSelectedIdChange={onSelectedIdChange}
      />,
    );
    await user.click(button("Store in iCloud…"));
    await user.click(button("Review Files"));
    expect(onRecommendation).toHaveBeenLastCalledWith("clutter");
    expect(onSelectedIdChange).toHaveBeenLastCalledWith("documents");
    expect(selectedRow()).toEqual(["Documents6.92 GB"]);
    expect(table("Documents files")).toBeInTheDocument();

    await user.click(row("Recommendations"));
    expect(onSelectedIdChange).toHaveBeenLastCalledWith("recommendations");
    expect(within(recommendation("Store in iCloud")).getByRole("status")).toHaveTextContent(
      "Completed",
    );
    // Review Files completes nothing: it can be used again.
    expect(button("Review Files")).toBeEnabled();
  });

  it("reviews the first category that can be opened when there is no Documents, or nothing", async () => {
    const user = userEvent.setup();
    const music: StorageCategory = { id: "music", name: "Music", size: 5e6 };
    const system: StorageCategory = { id: "system", name: "System", size: 1e9, selectable: false };
    const { rerender } = render(<StorageManagement categories={[system, music]} />);
    await user.click(button("Review Files"));
    expect(selectedRow()).toEqual(["Music5 MB"]);

    rerender(<StorageManagement categories={[system]} />);
    // Music is gone, so the window is back on Recommendations, with nothing to review.
    expect(selectedRow()).toEqual(["Recommendations"]);
    expect(button("Review Files")).toBeDisabled();
  });
});

describe("the sidebar", () => {
  it("does not select a row that cannot be opened, by a click or by its id", async () => {
    const user = userEvent.setup();
    const onSelectedIdChange = vi.fn();
    const { unmount } = render(<StorageManagement onSelectedIdChange={onSelectedIdChange} />);
    expect(row("System 16.36 GB")).toHaveAttribute("aria-disabled", "true");
    await user.click(row("System 16.36 GB"));
    expect(selectedRow()).toEqual(["Recommendations"]);
    expect(onSelectedIdChange).not.toHaveBeenCalled();
    unmount();

    render(<StorageManagement defaultSelectedId="system" />);
    expect(selectedRow()).toEqual(["Recommendations"]);
    expect(screen.getByRole("list", { name: "Recommendations" })).toBeInTheDocument();
  });

  it("shows the row its host selects, and Recommendations for an id that names none", async () => {
    const user = userEvent.setup();
    function Host() {
      const [id, setId] = useState("tv");
      return (
        <>
          <button type="button" onClick={() => setId("abacus")}>
            Show Abacus
          </button>
          <StorageManagement selectedId={id} />
        </>
      );
    }
    render(<Host />);
    expect(selectedRow()).toEqual(["TV6 GB"]);
    expect(table("TV files")).toBeInTheDocument();
    // The host does not follow the choice, so the window stays where the host has it.
    await user.click(row("Music 58.4 MB"));
    expect(selectedRow()).toEqual(["TV6 GB"]);

    await user.click(button("Show Abacus"));
    expect(selectedRow()).toEqual(["Recommendations"]);
    expect(screen.queryByRole("grid")).toBeNull();
  });
});

describe("a category", () => {
  const open = async (props: Parameters<typeof StorageManagement>[0] = {}) => {
    const user = userEvent.setup();
    render(<StorageManagement {...props} />);
    await user.click(row("Documents 6.92 GB"));
    return user;
  };

  it("lists its files, largest first, and sorts by the heading that is clicked", async () => {
    const user = await open();
    expect(heading("Size")).toHaveAttribute("aria-sort", "descending");
    expect(listed("Documents files")).toEqual([
      "Keynote Rehearsal.mov",
      "Family Archive.zip",
      "Project Backup.dmg",
      "Annual Report 2019.key",
      "Site Survey.pdf",
      "Budget Forecast.numbers",
      "Thesis Draft.pages",
      "Meeting Notes.rtf",
    ]);

    await user.click(button("Name"));
    expect(heading("Name")).toHaveAttribute("aria-sort", "ascending");
    expect(listed("Documents files").slice(0, 3)).toEqual([
      "Annual Report 2019.key",
      "Budget Forecast.numbers",
      "Family Archive.zip",
    ]);
    await user.click(button("Name"));
    expect(heading("Name")).toHaveAttribute("aria-sort", "descending");
    expect(listed("Documents files")[0]).toBe("Thesis Draft.pages");

    // Dates are ordered by day, not as the text the column shows ("Aug 19" before "Dec 27").
    await user.click(button("Last Accessed"));
    expect(listed("Documents files").slice(0, 3)).toEqual([
      "Family Archive.zip",
      "Project Backup.dmg",
      "Thesis Draft.pages",
    ]);
  });

  it("offers a recommendation's button again when it has gone and come back", async () => {
    const user = userEvent.setup();
    const trash = {
      id: "trash",
      title: "Empty Trash",
      description: "Erase it.",
      action: "Empty Trash",
    } as const;
    const { rerender } = render(<StorageManagement recommendations={[trash]} />);
    await user.click(screen.getByRole("button", { name: "Empty Trash" }));
    expect(screen.getByRole("status")).toHaveTextContent("Completed");
    rerender(<StorageManagement recommendations={[]} />);
    rerender(<StorageManagement recommendations={[trash]} />);
    expect(screen.getByRole("button", { name: "Empty Trash" })).toBeEnabled();
  });

  it("deletes the selected file: its size leaves the category and joins the free space", async () => {
    const onDelete = vi.fn();
    const user = await open({ onDelete });
    const status = () =>
      within(screen.getByRole("region", { name: "Documents" })).getByRole("status");
    expect(button("Delete…")).toBeDisabled();
    expect(status()).toHaveTextContent("8 items, 6.14 GB");

    await user.click(within(table("Documents files")).getByText("Keynote Rehearsal.mov"));
    expect(status()).toHaveTextContent("Keynote Rehearsal.mov, 2.31 GB");
    await user.click(button("Delete…"));

    expect(listed("Documents files")).not.toContain("Keynote Rehearsal.mov");
    expect(listed("Documents files")).toHaveLength(7);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete.mock.calls[0]?.[0]).toMatchObject({ id: "rehearsal", size: 2.31e9 });
    expect(onDelete.mock.calls[0]?.[1]).toBe("documents");
    // 6.92 GB less 2.31 GB, and 195.81 GB more 2.31 GB.
    expect(selectedRow()).toEqual(["Documents4.61 GB"]);
    expect(frame()).toHaveAccessibleName("Macintosh SSD - 198.12 GB available of 249.85 GB");
    // Nothing is selected after the file is gone.
    expect(button("Delete…")).toBeDisabled();
    expect(status()).toHaveTextContent("7 items, 3.83 GB");
  });

  it("keeps its selected file while another row of the sidebar is shown", async () => {
    const user = await open();
    await user.click(within(table("Documents files")).getByText("Site Survey.pdf"));
    await user.click(row("TV 6 GB"));
    expect(button("Delete…")).toBeDisabled();
    await user.click(row("Documents 6.92 GB"));
    expect(button("Delete…")).toBeEnabled();
    expect(within(table("Documents files")).getByRole("row", { selected: true })).toHaveTextContent(
      "Site Survey.pdf",
    );
  });
});

describe("odd data", () => {
  it("writes sizes that are nothing, negative or no number as Zero KB, and says a category is empty", async () => {
    const user = userEvent.setup();
    const categories: StorageCategory[] = [
      { id: "empty", name: "Empty", size: Number.NaN, files: [] },
      {
        id: "odd",
        name: "Odd",
        size: -4,
        files: [{ id: "a", name: "Nameless", kind: "", lastAccessed: "yesterday", size: -9 }],
      },
      // A second category under an id that is taken, and one under the reserved id.
      { id: "empty", name: "Twin", size: 1e9 },
      { id: "recommendations", name: "Impostor", size: 1e9 },
    ];
    render(
      <StorageManagement
        categories={categories}
        diskName=""
        capacity={Number.NaN}
        available={-1}
      />,
    );
    expect(frame()).toHaveAccessibleName("Zero KB available of Zero KB");
    expect(rows().map((item) => item.textContent)).toEqual([
      "Recommendations",
      "EmptyZero KB",
      "OddZero KB",
    ]);

    await user.click(row("Empty Zero KB"));
    const empty = screen.getByRole("region", { name: "Empty" });
    expect(empty).toHaveTextContent("No Files");
    expect(within(empty).getByRole("status")).toHaveTextContent("0 items, Zero KB");

    await user.click(row("Odd Zero KB"));
    const cells = within(table("Odd files")).getAllByRole("gridcell");
    expect(cells.map((cell) => cell.textContent)).toEqual(["Nameless", "", "--", "Zero KB"]);
    expect(frame().textContent).not.toMatch(/NaN|undefined/);
  });

  it("shows only Recommendations when there are no categories", () => {
    render(<StorageManagement categories={[]} />);
    expect(rows().map((item) => item.textContent)).toEqual(["Recommendations"]);
    expect(button("Review Files")).toBeDisabled();
    expect(button("Review Files")).toHaveAttribute("title", "There are no files to review.");
  });

  it("takes any string as a category's id, also the name of an object's own member", async () => {
    const user = userEvent.setup();
    const file = (id: string, size: number): StorageFile => ({
      id,
      name: id,
      kind: "",
      lastAccessed: "2019-10-03",
      size,
    });
    const categories: StorageCategory[] = ["constructor", "toString", "__proto__"].map((id) => ({
      id,
      name: id,
      size: 0,
      // A size that is not finite counts as nothing, in the bar as in the sidebar.
      files: [file("big", 2e9), file("small", 1e9), file("endless", Number.POSITIVE_INFINITY)],
    }));
    render(<StorageManagement categories={categories} />);
    expect(rows().map((item) => item.textContent)).toEqual([
      "Recommendations",
      "constructor3 GB",
      "toString3 GB",
      "__proto__3 GB",
    ]);
    for (const id of ["constructor", "toString", "__proto__"]) {
      await user.click(row(`${id} 3 GB`));
      const pane = screen.getByRole("region", { name: id });
      expect(within(pane).getByRole("status")).toHaveTextContent("3 items, 3 GB");
      await user.click(within(table(`${id} files`)).getByText("big"));
      await user.click(button("Delete…"));
      expect(listed(`${id} files`)).toEqual(["small", "endless"]);
      expect(within(pane).getByRole("status")).toHaveTextContent("2 items, 1 GB");
      expect(row(`${id} 1 GB`)).toBeInTheDocument();
    }
  });
});

describe("the data", () => {
  it("writes sizes in decimal units, without trailing zeros", () => {
    expect(formatSize(249.85e9)).toBe("249.85 GB");
    expect(formatSize(6e9)).toBe("6 GB");
    expect(formatSize(3.6e6)).toBe("3.6 MB");
    expect(formatSize(212_000)).toBe("212 KB");
    expect(formatSize(640)).toBe("640 bytes");
    // A value that would round to a thousand megabytes is a gigabyte.
    expect(formatSize(999_960_000)).toBe("1 GB");
    expect(formatSize(0)).toBe("Zero KB");
  });

  it("writes a date with its month's name, and a dash for no date", () => {
    expect(formatDate("2019-10-03")).toBe("Oct 3, 2019");
    expect(formatDate("2018-01-31T08:15")).toBe("Jan 31, 2018");
    expect(formatDate("2018-01-31T08:15:30.250Z")).toBe("Jan 31, 2018");
    // The whole string is a date, or it is none.
    expect(formatDate("2019-10-03garbage")).toBe("--");
    expect(formatDate("2019-10-03T25:00")).toBe("--");
    expect(formatDate("2019-10-03 08:15")).toBe("--");
    expect(formatDate(" 2019-10-03")).toBe("--");
    expect(formatDate("2019-13-01")).toBe("--");
    expect(formatDate("2019-02-29")).toBe("--");
    expect(formatDate("2020-02-29")).toBe("Feb 29, 2020");
    expect(formatDate("2019-04-31")).toBe("--");
    expect(formatDate("")).toBe("--");
  });

  it("orders sizes as numbers, and a file without a date after the dated ones either way", () => {
    const file = (id: string, size: number, lastAccessed: string): StorageFile => ({
      id,
      name: id,
      kind: "",
      lastAccessed,
      size,
    });
    // As text "212 KB" comes after "1.12 GB" and before "38.7 MB".
    const files = [
      file("b", 38.7e6, "2019-06-02"),
      file("a", 212e3, ""),
      file("d", 5e6, "2019-12-31garbage"),
      file("c", 1.12e9, "2018-03-04"),
    ];
    const order = (column: string, direction: "ascending" | "descending") =>
      sortFiles(files, { column, direction }).map((entry) => entry.id);
    expect(order("size", "ascending")).toEqual(["a", "d", "b", "c"]);
    expect(order("size", "descending")).toEqual(["c", "b", "d", "a"]);
    // A date with something after it is no date.
    expect(order("lastAccessed", "ascending")).toEqual(["c", "b", "a", "d"]);
    expect(order("lastAccessed", "descending")).toEqual(["b", "c", "a", "d"]);
    // A column that does not exist orders by name.
    expect(order("colour", "ascending")).toEqual(["a", "b", "c", "d"]);
  });
});
