import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FocusEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { Finder } from "./finder";
import { HOME, NETWORK } from "./finder-data";

/** The window, found by its title: the title bar names the window's region. */
const titled = (name: string) => screen.getByRole("region", { name });
const place = (name: string) => screen.getByRole("treeitem", { name });
const item = (name: string) => screen.getByRole("option", { name });
const items = () => screen.queryAllByRole("option").map((option) => option.textContent);
const button = (name: string) => screen.getByRole("button", { name });
const status = () => screen.getByRole("status");
/** A toolbar control that is disabled stays reachable, so it may carry `aria-disabled`. */
const unavailable = (name: string) =>
  button(name).hasAttribute("disabled") || button(name).getAttribute("aria-disabled") === "true";
/**
 * A host that takes the Share menu's destinations. The toolbar's Share is dimmed where no host
 * takes them ("dims Share where no host takes the shared items"), so the tests of what the
 * selection enables give the window one.
 */
const share = () => {};

type User = ReturnType<typeof userEvent.setup>;

async function choose(user: User, menu: string, command: string, role = "menuitem") {
  await user.click(button(menu));
  await user.click(await screen.findByRole(role, { name: command }));
}

describe("navigation", () => {
  it("opens the home folder, follows the sidebar and opens folders with a double click", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    expect(titled("shackett")).toBeInTheDocument();
    expect(items()).toEqual([
      "Desktop",
      "Documents",
      "Downloads",
      "Movies",
      "Music",
      "Pictures",
      "Public",
    ]);
    expect(screen.getByText("Shared Folder")).toBeInTheDocument();

    await user.click(place("Applications"));
    expect(titled("Applications")).toBeInTheDocument();
    expect(place("Applications")).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("Shared Folder")).not.toBeInTheDocument();

    await user.dblClick(item("Utilities"));
    expect(titled("Utilities")).toBeInTheDocument();
    expect(item("Terminal")).toBeInTheDocument();
    expect(place("Applications")).toHaveAttribute("aria-selected", "false");
  });

  it("goes back and forward through the folders visited, and drops the way forward on a new visit", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    expect(unavailable("Back")).toBe(true);
    expect(unavailable("Forward")).toBe(true);

    await user.click(place("Applications"));
    await user.dblClick(item("Utilities"));
    await user.click(button("Back"));
    expect(titled("Applications")).toBeInTheDocument();
    await user.click(button("Back"));
    expect(titled("shackett")).toBeInTheDocument();
    expect(unavailable("Back")).toBe(true);

    await user.click(button("Forward"));
    expect(titled("Applications")).toBeInTheDocument();
    await user.click(place("Documents"));
    expect(unavailable("Forward")).toBe(true);
    await user.click(button("Back"));
    expect(titled("Applications")).toBeInTheDocument();
  });

  it("shows the path of the folder and opens an ancestor from the path bar", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    const path = within(screen.getByRole("navigation", { name: "Path" }));
    expect(path.getAllByRole("listitem").map((entry) => entry.textContent)).toEqual([
      "Macintosh SSD",
      "Users",
      "shackett",
    ]);
    await user.dblClick(path.getByRole("button", { name: "Users" }));
    expect(titled("Users")).toBeInTheDocument();
    expect(items()).toEqual(["shackett", "Shared"]);
  });

  it("opens the home folder when it is given no tabs at all", () => {
    render(<Finder onShare={share} defaultTabs={[]} />);
    expect(titled("shackett")).toBeInTheDocument();
  });

  it("lists the places that are not folders: Recents, a tag, the computer", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(place("Recents"));
    expect(items()[0]).toBe("10-9.jpg");
    // Sorted by name, also when Name is chosen by its heading, Recents stays most recent first.
    const rowNames = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelector(".mac-finder-name-text")?.textContent);
    await user.click(button("List"));
    const recent = rowNames();
    expect(recent[0]).toBe("10-9.jpg");
    await user.click(button("Size"));
    expect(rowNames()).not.toEqual(recent);
    await user.click(button("Name"));
    expect(rowNames()).toEqual(recent);
    await user.click(button("Icons"));
    await user.click(place("Green"));
    expect(items()).toEqual(["Documents"]);
    await user.click(place("ismhpro"));
    expect(items()).toEqual(["Macintosh HD", "Macintosh SSD", "Network", "Time Machine"]);
    await user.click(place("AirDrop"));
    expect(screen.getByText("No People Found")).toBeInTheDocument();
  });
});

describe("views", () => {
  it("shows the folder as a list with dates, sizes and kinds", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={[`${HOME}/Documents`]} />);
    await user.click(button("List"));
    expect(button("List")).toHaveAttribute("aria-pressed", "true");
    const row = within(screen.getByRole("row", { name: /Budget\.txt/ }));
    expect(row.getByText("Sep 12, 2019 at 4:40 PM")).toBeInTheDocument();
    expect(row.getByText("13 KB")).toBeInTheDocument();
    expect(row.getByText("Plain Text Document")).toBeInTheDocument();
    await user.dblClick(screen.getByText("Letters"));
    expect(titled("Letters")).toBeInTheDocument();
  });

  it("expands a folder in the list and sorts by a column heading", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="list" />);
    const names = () =>
      screen.getAllByRole("row").flatMap((row) => {
        const cell = within(row).queryAllByRole("gridcell")[0];
        return cell ? [cell.textContent] : [];
      });
    expect(names()).not.toContain("Harbour.jpg");
    await user.click(screen.getByText("Pictures"));
    await user.keyboard("{ArrowRight}");
    expect(names().slice(5, 9)).toEqual(["Pictures", "Dunes.jpg", "Harbour.jpg", "Public"]);

    await user.click(screen.getByText("Size"));
    // Folders have no size and come first; inside Pictures the smaller file leads.
    expect(names().slice(5, 8)).toEqual(["Pictures", "Dunes.jpg", "Harbour.jpg"]);
    await user.click(screen.getByText("Size"));
    expect(names().slice(1, 4)).toEqual(["Pictures", "Harbour.jpg", "Dunes.jpg"]);
  });

  it("deselects a row that a collapsed folder takes out of sight", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="list" />);
    await user.click(screen.getByText("Pictures"));
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByText("Harbour.jpg"));
    expect(status()).toHaveTextContent("1 of 9 selected");
    expect(unavailable("Share")).toBe(false);

    // The folder's disclosure triangle collapses it while the row inside stays selected.
    const triangle = () =>
      screen.getByRole("row", { name: /Pictures/ }).querySelector("button") as HTMLElement;
    await user.click(triangle());
    expect(screen.queryByText("Harbour.jpg")).not.toBeInTheDocument();
    expect(status()).toHaveTextContent("7 items");
    expect(unavailable("Share")).toBe(true);
    await user.click(triangle());
    expect(screen.getByRole("row", { name: /Harbour\.jpg/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("keeps the column selection through a search, and closes a column whose item is gone", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="columns" />);
    await user.click(item("Documents"));
    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "bondi");
    await user.click(button("Clear"));
    // Back in the columns, Documents is selected again and the toolbar acts on it.
    expect(item("Documents")).toHaveAttribute("aria-selected", "true");
    expect(unavailable("Share")).toBe(false);

    // Seen through its tag, the folder goes away with the tag: no column stays open on it.
    await user.click(place("Green"));
    await user.click(item("Documents"));
    expect(titled("Documents")).toBeInTheDocument();
    await choose(user, "Edit Tags", "Green", "menuitemcheckbox");
    expect(items()).toEqual([]);
    expect(titled("Green")).toBeInTheDocument();
    expect(unavailable("Share")).toBe(true);
  });

  it("drops a selection in a tab that is not shown when its item leaves the tab's listing", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(place("Green"));
    await user.click(item("Documents"));
    await choose(user, "Action", "New Tab");
    // In the second tab, at home, the folder loses the tag and gets it back.
    await user.click(place("Documents"));
    await user.keyboard("{Control>}{ArrowUp}{/Control}");
    await user.click(item("Documents"));
    await choose(user, "Edit Tags", "Green", "menuitemcheckbox");
    await choose(user, "Edit Tags", "Green", "menuitemcheckbox");
    await user.click(screen.getByRole("tab", { name: "Green" }));
    expect(item("Documents")).toHaveAttribute("aria-selected", "false");
    expect(unavailable("Share")).toBe(true);
  });

  it("leaves nothing selected when the one selected item of a nested column is Command-clicked", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="columns" />);
    await user.click(item("Documents"));
    const inside = within(screen.getAllByRole("listbox").at(-1) as HTMLElement).getAllByRole(
      "option",
    )[0] as HTMLElement;
    await user.click(inside);
    await user.keyboard("{Control>}");
    await user.click(inside);
    await user.keyboard("{/Control}");
    expect(unavailable("Share")).toBe(true);
    expect(inside).toHaveAttribute("aria-selected", "false");
    // The column is still there, and a click goes on from it.
    await user.click(inside);
    expect(inside).toHaveAttribute("aria-selected", "true");
    expect(unavailable("Share")).toBe(false);
  });

  it("goes back to the columns with what was selected in another view after clearing them", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="columns" />);
    await user.click(item("Documents"));
    await user.keyboard("{Control>}");
    await user.click(item("Documents"));
    await user.keyboard("{/Control}");
    expect(unavailable("Share")).toBe(true);
    await user.click(button("List"));
    await user.click(screen.getByText("Downloads", { selector: ".mac-finder-name-text" }));
    await user.click(button("Columns"));
    expect(item("Downloads")).toHaveAttribute("aria-selected", "true");
    expect(unavailable("Share")).toBe(false);
  });

  it("selects several items of an earlier column, closing the columns after it", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="columns" />);
    await user.click(item("Documents"));
    const lists = () => screen.getAllByRole("listbox");
    await user.click(
      within(lists().at(-1) as HTMLElement).getAllByRole("option")[0] as HTMLElement,
    );
    await user.keyboard("{Control>}");
    await user.click(item("Downloads"));
    await user.keyboard("{/Control}");
    expect(item("Documents")).toHaveAttribute("aria-selected", "true");
    expect(item("Downloads")).toHaveAttribute("aria-selected", "true");
    expect(lists()).toHaveLength(1);
  });

  it("empties the Trash with no question on Option-Shift-Command-Delete", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(button("Action"));
    expect(await screen.findByRole("menuitem", { name: "Empty Trash…" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");
    const window_ = document.querySelector(".mac-finder") as HTMLElement;
    fireEvent.keyDown(window_, { key: "Backspace", ctrlKey: true, altKey: true, shiftKey: true });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await user.click(button("Action"));
    expect(await screen.findByRole("menuitem", { name: "Empty Trash…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("selects several items of a column, and one again with a plain click", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="columns" />);
    await user.click(item("Documents"));
    await user.keyboard("{Control>}");
    await user.click(item("Downloads"));
    await user.keyboard("{/Control}");
    expect(item("Documents")).toHaveAttribute("aria-selected", "true");
    expect(item("Downloads")).toHaveAttribute("aria-selected", "true");
    await user.click(item("Downloads"));
    expect(item("Documents")).toHaveAttribute("aria-selected", "false");
    expect(item("Downloads")).toHaveAttribute("aria-selected", "true");
  });

  it("opens the columns on an item inside the startup disk listed with the computer's disks", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="list" />);
    await user.click(place("ismhpro"));
    await user.click(screen.getByText("Macintosh SSD"));
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByText("Applications", { selector: ".mac-finder-name-text" }));
    await user.click(button("Columns"));
    expect(item("Macintosh SSD")).toHaveAttribute("aria-selected", "true");
    expect(item("Applications")).toHaveAttribute("aria-selected", "true");
    expect(titled("Applications")).toBeInTheDocument();
  });

  it("opens the columns on the item selected at first", () => {
    render(
      <Finder onShare={share} defaultView="columns" defaultSelection={[`${HOME}/Documents`]} />,
    );
    expect(item("Documents")).toHaveAttribute("aria-selected", "true");
    expect(item("Budget.txt")).toBeInTheDocument();
    expect(unavailable("Share")).toBe(false);
    expect(status()).toHaveTextContent("1 of 7 selected");
  });

  it("counts the rows of expanded folders, and keeps a list of gathered items flat", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="list" />);
    await user.click(screen.getByText("Pictures"));
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByText("Harbour.jpg"));
    // Seven folders and the two pictures inside the expanded one.
    expect(status()).toHaveTextContent("1 of 9 selected");

    // A tag's list can hold a folder and an item inside it, so its folders do not expand.
    expect(screen.getByRole("row", { name: /Documents/ })).toHaveAttribute("aria-expanded");
    await user.click(place("Green"));
    expect(screen.getByRole("row", { name: /Documents/ })).not.toHaveAttribute("aria-expanded");
  });

  it("carries the selection into the columns and back out of them", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(item("Documents"));
    await user.click(button("Columns"));
    // The folder selected in the icon view is open in the columns.
    expect(item("Documents")).toHaveAttribute("aria-selected", "true");
    expect(titled("Documents")).toBeInTheDocument();
    await user.click(item("Budget.txt"));

    await user.click(button("Icons"));
    // The file is not among the home folder's icons, so nothing there is selected.
    expect(status()).toHaveTextContent("7 items");
    await user.click(item("Music"));
    await user.click(button("Columns"));
    expect(item("Music")).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("option", { name: "Budget.txt" })).not.toBeInTheDocument();
    expect(titled("Music")).toBeInTheDocument();
  });

  it("forgets the column path when the columns are left outside a search", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="columns" />);
    await user.click(item("Documents"));
    await user.click(item("Budget.txt"));
    // The icons do not show the file, so it is deselected and its column path goes with it.
    await user.click(button("Icons"));
    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "bondi");
    await user.click(button("Columns"));
    await user.click(button("Clear"));
    expect(screen.queryByRole("option", { name: "Budget.txt" })).not.toBeInTheDocument();
    expect(item("Documents")).toHaveAttribute("aria-selected", "false");
    expect(unavailable("Share")).toBe(true);

    // So does the path of a search that began in the columns and ended in another view.
    await user.click(item("Documents"));
    await user.type(field, "bondi");
    await user.click(button("Icons"));
    await user.click(button("Clear"));
    await user.type(field, "bondi");
    await user.click(button("Columns"));
    await user.click(button("Clear"));
    expect(item("Documents")).toHaveAttribute("aria-selected", "false");
    expect(unavailable("Share")).toBe(true);
  });

  it("sizes the icons with the status bar's slider", () => {
    render(<Finder onShare={share} />);
    const icon = () => item("Desktop").querySelector("svg");
    expect(icon()).toHaveAttribute("width", "64");
    fireEvent.change(screen.getByRole("slider", { name: "Icon size" }), {
      target: { value: "96" },
    });
    expect(icon()).toHaveAttribute("width", "96");
  });

  it("hides and shows the path bar and the status bar from the Action menu", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await choose(user, "Action", "Hide Path Bar");
    expect(screen.queryByRole("navigation", { name: "Path" })).not.toBeInTheDocument();
    await choose(user, "Action", "Hide Status Bar");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await choose(user, "Action", "Show Path Bar");
    expect(screen.getByRole("navigation", { name: "Path" })).toBeInTheDocument();
  });

  it("shows a column per folder along the selection and names the window after the last", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(button("Columns"));
    await user.click(item("Documents"));
    expect(titled("Documents")).toBeInTheDocument();
    await user.click(item("Budget.txt"));
    // The file's preview column; the window keeps the name of the folder it is in.
    expect(screen.getByText("Plain Text Document - 13 KB")).toBeInTheDocument();
    expect(titled("Documents")).toBeInTheDocument();
  });

  it("shows one item at a time in the gallery, with its details in the Preview pane", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={[`${HOME}/Downloads`]} defaultView="gallery" />);
    const preview = within(screen.getByRole("region", { name: "Preview" }));
    expect(preview.getByText("10-1.jpg")).toBeInTheDocument();
    await user.click(item("10-9.jpg"));
    expect(preview.getByText("JPEG image - 9.4 MB")).toBeInTheDocument();
    expect(preview.getAllByText("April 17, 2018 at 10:11 PM")).toHaveLength(2);
    expect(preview.getByText("5/29/18, 10:33 AM")).toBeInTheDocument();
    expect(preview.getByText("5120×2880")).toBeInTheDocument();
  });

  it("tags and turns a picture from the Preview pane", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Finder defaultTabs={[`${HOME}/Downloads`]} defaultView="gallery" />,
    );
    expect(container.querySelector('[style*="rotate: -90deg"]')).toBeNull();
    await user.click(button("Rotate Left"));
    expect(container.querySelector('[style*="rotate: -90deg"]')).not.toBeNull();

    await user.type(screen.getByRole("textbox", { name: "Tags" }), "Red,");
    await user.click(place("Red"));
    expect(screen.getAllByRole("option", { name: "10-1.jpg" }).length).toBeGreaterThan(0);
    expect(titled("Red")).toBeInTheDocument();
  });

  it("switches the view with Command or Control and a digit", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(item("Desktop"));
    await user.keyboard("{Control>}2{/Control}");
    expect(screen.getByRole("treegrid")).toBeInTheDocument();
    await user.keyboard("{Meta>}1{/Meta}");
    expect(screen.queryByRole("treegrid")).not.toBeInTheDocument();
    expect(button("Icons")).toHaveAttribute("aria-pressed", "true");
  });

  it("puts the items in sections by the column chosen in the Group menu", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={[`${HOME}/Documents`]} />);
    await choose(user, "Group", "Size", "menuitemradio");
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["1 MB to 100 MB", "Less than 100 KB", "Folders"]);
    expect(
      within(screen.getByRole("region", { name: "Folders" })).getByRole("option"),
    ).toHaveTextContent("Letters");
    await choose(user, "Group", "None", "menuitemradio");
    expect(screen.queryByRole("region", { name: "Folders" })).toBeNull();
    expect(items()).toHaveLength(5);
  });
});

describe("selection", () => {
  it("counts the selection in the status bar and shows the selected item in the path bar", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    expect(status()).toHaveTextContent("7 items, 212.4 GB available");
    expect(unavailable("Share")).toBe(true);

    await user.click(item("Music"));
    expect(item("Music")).toHaveAttribute("aria-selected", "true");
    expect(status()).toHaveTextContent("1 of 7 selected, 212.4 GB available");
    expect(unavailable("Share")).toBe(false);
    const path = within(screen.getByRole("navigation", { name: "Path" }));
    expect(path.getAllByRole("listitem").at(-1)).toHaveTextContent("Music");
  });

  it("tags the selected items from the Tags menu, and the tag's place lists them", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(item("Music"));
    await choose(user, "Edit Tags", "Red", "menuitemcheckbox");
    await user.click(place("Red"));
    expect(items()).toEqual(["Music"]);

    // Without the tag the item leaves the tag's place, and the selection with it.
    await user.click(item("Music"));
    await choose(user, "Edit Tags", "Red", "menuitemcheckbox");
    expect(items()).toEqual([]);
    expect(unavailable("Share")).toBe(true);
    expect(status()).toHaveTextContent("0 items");
  });

  it("shows the dot of the first coloured tag, also after a tag without a colour", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(item("Music"));
    await choose(user, "Edit Tags", "Work", "menuitemcheckbox");
    expect(item("Music").querySelector(".mac-tag-dot")).toBeNull();
    await choose(user, "Edit Tags", "Red", "menuitemcheckbox");
    expect(item("Music").querySelector(".mac-tag-dot")).toHaveAttribute("data-color", "red");
  });

  it("makes a new folder with a name that is free, and selects it", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={[`${HOME}/Movies`]} />);
    await choose(user, "Action", "New Folder");
    await choose(user, "Action", "New Folder");
    expect(items()).toEqual(["untitled folder", "untitled folder 2"]);
    expect(item("untitled folder 2")).toHaveAttribute("aria-selected", "true");
    expect(status()).toHaveTextContent("1 of 2 selected");
  });

  it("makes the new folder in the folder the columns show, selected in its column", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="columns" />);
    await user.click(item("Movies"));
    await choose(user, "Action", "New Folder");
    expect(item("untitled folder")).toHaveAttribute("aria-selected", "true");
    expect(item("Movies")).toHaveAttribute("aria-selected", "true");
    expect(titled("untitled folder")).toBeInTheDocument();
  });

  it("dims Share where no host takes the shared items, and says why", async () => {
    const user = userEvent.setup();
    render(<Finder />);
    await user.click(item("Music"));
    expect(status()).toHaveTextContent("1 of");
    expect(unavailable("Share")).toBe(true);
    expect(button("Share")).toHaveAttribute("title", "Sharing is not available here.");
  });

  it("shares the selected items with the destination chosen", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(<Finder onShare={onShare} />);
    await user.click(item("Music"));
    await choose(user, "Share", "Mail");
    expect(onShare).toHaveBeenCalledWith("Mail", [`${HOME}/Music`]);
  });

  it("reports a file that is opened and opens nothing itself", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<Finder onShare={share} defaultTabs={["/Applications"]} onOpen={onOpen} />);
    await user.dblClick(item("Calculator"));
    expect(onOpen).toHaveBeenCalledWith(
      "/Applications/Calculator",
      expect.objectContaining({ kind: "application" }),
    );
    expect(titled("Applications")).toBeInTheDocument();
  });
});

describe("tabs", () => {
  it("shows the tab bar from the second tab on; each tab keeps its own folder and history", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();

    await choose(user, "Action", "New Tab");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "shackett",
      "shackett",
    ]);
    await user.click(place("Applications"));
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "shackett",
      "Applications",
    ]);

    await user.click(screen.getByRole("tab", { name: "shackett" }));
    expect(titled("shackett")).toBeInTheDocument();
    expect(unavailable("Back")).toBe(true);
    await user.click(screen.getByRole("tab", { name: "Applications" }));
    expect(unavailable("Back")).toBe(false);
  });

  it("opens with the tabs it is given, adds one with the plus button and closes one", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={["/Applications", HOME]} defaultActiveTab={1} />);
    expect(screen.getByRole("tab", { name: "shackett" })).toHaveAttribute("aria-selected", "true");

    await user.click(button("New Tab"));
    expect(screen.getAllByRole("tab")).toHaveLength(3);

    await user.click(screen.getByRole("tab", { name: "Applications" }));
    await user.keyboard("{Delete}");
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(titled("shackett")).toBeInTheDocument();
  });
});

describe("search", () => {
  it("searches the folder shown, then the whole disk, and ends when the field is cleared", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={[`${HOME}/Documents`]} />);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "aqua");
    expect(titled("Searching “Documents”")).toBeInTheDocument();
    expect(items()).toEqual([
      "Aqua and Bondi.ibooks",
      "Aqua and Bondi.pdf",
      "Aqua_and_Bondi-preview.ibooks",
    ]);

    await user.click(screen.getByRole("radio", { name: "This Mac" }));
    expect(titled("Searching This Mac")).toBeInTheDocument();
    expect(items()).toEqual([
      "Aqua and Bondi.ibooks",
      "Aqua and Bondi.pdf",
      "Aqua_and_Bondi-preview.ibooks",
      "com.apple.AquaAppearanceHelper",
      "com.apple.AquaAppearanceHelper",
    ]);

    await user.click(button("Clear"));
    expect(titled("Documents")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("drops a selected result that a longer query no longer finds", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={[`${HOME}/Documents`]} defaultQuery="aqua" />);
    await user.click(item("Aqua and Bondi.pdf"));
    expect(unavailable("Share")).toBe(false);
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "_");
    expect(items()).toEqual(["Aqua_and_Bondi-preview.ibooks"]);
    expect(unavailable("Share")).toBe(true);
    expect(status()).toHaveTextContent("1 item, 212.4 GB available");

    // Found again by the shorter query, the result is no longer selected.
    await user.keyboard("{Backspace}");
    expect(item("Aqua and Bondi.pdf")).toHaveAttribute("aria-selected", "false");
    expect(unavailable("Share")).toBe(true);
  });

  it("searches the folder the columns show, and the whole disk from a place without one", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultView="columns" />);
    await user.click(item("Documents"));
    const field = screen.getByRole("searchbox", { name: "Search" });
    await user.type(field, "bondi");
    expect(titled("Searching “Documents”")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "“Documents”" })).toBeChecked();

    // The search keeps the folder it began in when another view shows the results.
    await user.click(button("Icons"));
    expect(titled("Searching “Documents”")).toBeInTheDocument();
    expect(items()).toHaveLength(3);

    await user.click(place("Recents"));
    await user.type(field, "bondi");
    expect(titled("Searching This Mac")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: "This Mac" })).toBeChecked();
  });

  it("narrows the results with a criterion row, until it is taken away", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={["/"]} defaultQuery="Aqua" />);
    expect(items()).toHaveLength(5);

    await user.click(button("Add search criterion"));
    await user.click(screen.getByRole("combobox", { name: "Search attribute" }));
    await user.click(await screen.findByRole("option", { name: "Name" }));
    await user.type(screen.getByRole("textbox", { name: "Search for" }), "bondi.pdf");
    const results = () =>
      within(screen.getByRole("listbox", { name: /^Searching/ }))
        .getAllByRole("option")
        .map((option) => option.textContent);
    expect(results()).toEqual(["Aqua and Bondi.pdf"]);

    await user.click(button("Remove search criterion"));
    expect(items()).toHaveLength(5);
  });

  it("shows the path of a selected result, and keeps a saved search in the sidebar", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={["/"]} defaultQuery="bondi-preview" />);
    const path = within(screen.getByRole("navigation", { name: "Path" }));
    expect(path.queryAllByRole("listitem")).toHaveLength(0);
    await user.click(item("Aqua_and_Bondi-preview.ibooks"));
    expect(path.getAllByRole("listitem").map((entry) => entry.textContent)).toEqual([
      "Macintosh SSD",
      "Users",
      "shackett",
      "Documents",
      "Aqua_and_Bondi-preview.ibooks",
    ]);

    await user.click(button("Save"));
    const naming = within(await screen.findByRole("dialog", { name: "Save Search" }));
    const name = naming.getByRole("textbox", { name: "Save As:" });
    await user.clear(name);
    await user.type(name, "Bondi previews");
    await user.click(naming.getByRole("button", { name: "Save" }));
    await user.click(place("Applications"));
    expect(titled("Applications")).toBeInTheDocument();
    await user.click(place("Bondi previews"));
    expect(titled("Searching “Macintosh SSD”")).toBeInTheDocument();
    expect(items()).toEqual(["Aqua_and_Bondi-preview.ibooks"]);
  });
});

describe("network", () => {
  it("shows a computer's connection panel, and its shared folders once connected", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={[NETWORK]} defaultView="columns" />);
    await user.click(item("Castle"));
    expect(titled("Castle")).toBeInTheDocument();
    expect(screen.getByText("Not Connected")).toBeInTheDocument();
    // No host listens for Share Screen, so the button is disabled.
    expect(unavailable("Share Screen...")).toBe(true);

    await user.click(button("Connect As..."));
    expect(screen.queryByText("Not Connected")).not.toBeInTheDocument();
    expect(item("Public")).toBeInTheDocument();
  });
});

describe("Get Info and Quick Look", () => {
  it("opens Get Info on the selected item as the key window beside the Finder window", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(item("Music"));
    await choose(user, "Action", "Get Info");
    const info = titled("Music Info");
    await waitFor(() => expect(info).toHaveFocus());
    expect(info).toHaveAttribute("data-window-state", "key");
    expect(titled("shackett")).toHaveAttribute("data-window-state", "main");
    // A window of its own, not a part of the Finder window.
    expect(titled("shackett")).not.toContainElement(info);

    // A press in the Finder window makes it the key window again; the Info window stays.
    await user.click(item("Documents"));
    expect(titled("shackett")).toHaveAttribute("data-window-state", "key");
    expect(titled("Music Info")).toHaveAttribute("data-window-state", "inactive");

    await user.click(within(info).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Music Info" })).not.toBeInTheDocument();
    expect(titled("shackett")).toHaveFocus();
    expect(titled("shackett")).toHaveAttribute("data-window-state", "key");
  });

  it("describes the folder shown when nothing is selected, and changes tags in the tree", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={[`${HOME}/Pictures`]} />);
    await user.keyboard("{Control>}i{/Control}");
    // No key reaches a window that does not have the keyboard: press in it first.
    expect(screen.queryByRole("region", { name: "Pictures Info" })).not.toBeInTheDocument();
    await user.click(status());
    await user.keyboard("{Control>}i{/Control}");
    const info = titled("Pictures Info");
    await user.type(within(info).getByRole("textbox", { name: "Tags" }), "Red{Enter}");
    await user.click(place("Red"));
    expect(
      within(titled("Red"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Pictures"]);
    // The Info window stays open on its item wherever the Finder window goes.
    expect(titled("Pictures Info")).toBeInTheDocument();
  });

  it("gives a panel the key state only while its host has the window as the key window", async () => {
    const user = userEvent.setup();
    const focused: EventTarget[] = [];
    const onFocusCapture = (event: FocusEvent<HTMLDivElement>) => {
      focused.push(event.currentTarget);
    };
    const { rerender } = render(<Finder onShare={share} onFocusCapture={onFocusCapture} />);
    await user.click(item("Music"));
    await choose(user, "Action", "Get Info");
    const info = titled("Music Info");
    await waitFor(() => expect(info).toHaveFocus());
    // The host hears of the focus in the panel, as of the focus in the window itself.
    expect(focused.at(-1)).toBe(info);
    expect(info).toHaveAttribute("data-window-state", "key");

    // Another window of the host becomes the key window: no window of the Finder stays key.
    rerender(<Finder onShare={share} onFocusCapture={onFocusCapture} state="inactive" />);
    expect(titled("shackett")).toHaveAttribute("data-window-state", "inactive");
    expect(info).toHaveAttribute("data-window-state", "inactive");
    rerender(<Finder onShare={share} onFocusCapture={onFocusCapture} state="main" />);
    expect(titled("shackett")).toHaveAttribute("data-window-state", "main");
    expect(info).toHaveAttribute("data-window-state", "inactive");

    rerender(<Finder onShare={share} onFocusCapture={onFocusCapture} state="key" />);
    expect(titled("shackett")).toHaveAttribute("data-window-state", "main");
    expect(info).toHaveAttribute("data-window-state", "key");
  });

  it("places each panel where the window stood when that panel opened", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={[`${HOME}/Pictures`]} />);
    const finder = titled("Pictures");
    const stand = (left: number, top: number) => {
      finder.getBoundingClientRect = () => new DOMRect(left, top, 800, 600);
    };
    stand(100, 50);
    await user.click(item("Harbour.jpg"));
    await user.keyboard("{Control>}i{/Control}");
    const info = titled("Harbour.jpg Info");
    expect(info).toHaveStyle({ left: "124px", top: "74px" });

    // The window has moved since: Quick Look opens over it, and the Info window stays.
    stand(300, 200);
    await user.click(item("Harbour.jpg"));
    await user.keyboard(" ");
    expect(screen.getByRole("dialog", { name: "Harbour.jpg" })).toHaveStyle({
      left: "348px",
      top: "248px",
      width: "704px",
    });
    expect(info).toHaveStyle({ left: "124px", top: "74px" });
  });

  it("shows the selected item in Quick Look with the space bar and follows the selection", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onShare = vi.fn();
    render(<Finder defaultTabs={[`${HOME}/Pictures`]} onOpen={onOpen} onShare={onShare} />);
    // Nothing is selected: there is nothing to look at.
    await user.click(button("Action"));
    expect(await screen.findByRole("menuitem", { name: "Quick Look" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.keyboard("{Escape}");

    await user.click(item("Harbour.jpg"));
    await user.keyboard(" ");
    const look = screen.getByRole("dialog", { name: "Harbour.jpg" });
    expect(look).toHaveFocus();
    expect(look).toHaveAttribute("data-window-state", "key");
    expect(titled("Pictures")).toHaveAttribute("data-window-state", "main");
    expect(titled("Pictures")).not.toContainElement(look);

    // The panel's actions are the window's: Open and Share report the item.
    await user.click(within(look).getByRole("button", { name: "Open with Preview" }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(
      `${HOME}/Pictures/Harbour.jpg`,
      expect.objectContaining({ name: "Harbour.jpg" }),
    );
    await user.click(within(look).getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Mail" }));
    expect(onShare).toHaveBeenCalledExactlyOnceWith("Mail", [`${HOME}/Pictures/Harbour.jpg`]);

    // Another item selected in the window is the one the panel shows.
    await user.click(item("Dunes.jpg"));
    expect(screen.getByRole("dialog", { name: "Dunes.jpg" })).toHaveAttribute(
      "data-window-state",
      "inactive",
    );
    expect(screen.queryByRole("dialog", { name: "Harbour.jpg" })).not.toBeInTheDocument();

    // The space bar again closes it.
    await user.keyboard(" ");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("turns the picture from Quick Look, and closes it on Escape with the keyboard back in the window", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} defaultTabs={[`${HOME}/Pictures`]} defaultView="gallery" />);
    await user.click(titled("Pictures"));
    await user.keyboard("{Control>}y{/Control}");
    // The gallery always shows one item, the first at first: that is the one looked at.
    const look = screen.getByRole("dialog", { name: "Dunes.jpg" });
    const stage = look.querySelector(".mac-finder-quick-look-stage");
    expect(stage).not.toHaveAttribute("data-turned");
    await user.click(within(look).getByRole("button", { name: "Rotate Left" }));
    expect(stage).toHaveAttribute("data-turned");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(titled("Pictures")).toHaveFocus();
    expect(titled("Pictures")).toHaveAttribute("data-window-state", "key");
  });

  it("leaves the space bar to a control and to the search field", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(item("Music"));
    await user.type(screen.getByRole("searchbox", { name: "Search" }), "a b");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("a b");
  });

  it("ranks its panels with the window: beside it where the host ranks it, at its level", async () => {
    const user = userEvent.setup();
    const hosted = (level: number) => (
      <>
        <div data-testid="finder-wrapper" style={{ position: "absolute", zIndex: level }}>
          <Finder style={{ position: "relative", zIndex: 10 }} />
        </div>
        <div data-testid="other-window" style={{ position: "absolute", zIndex: level + 1 }} />
      </>
    );
    const { rerender } = render(hosted(5));
    await user.click(item("Music"));
    await choose(user, "Action", "Get Info");
    const info = titled("Music Info");
    await waitFor(() => expect(info).toHaveFocus());
    // The element around the window is the one the host ranks. The panels' group stands
    // beside it, later in the document and at the same level: over the Finder window and
    // under a window the host ranks higher, whichever of the Finder's windows is key.
    const wrapper = screen.getByTestId("finder-wrapper");
    const group = info.parentElement as HTMLElement;
    expect(group.parentElement).toBe(wrapper.parentElement);
    expect(wrapper.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(group).toHaveStyle({ zIndex: "5" });
    expect(screen.getByTestId("other-window")).toHaveStyle({ zIndex: "6" });

    // The host raises the Finder: its panels go along.
    rerender(hosted(9));
    expect(info.parentElement).toHaveStyle({ zIndex: "9" });
    expect(titled("Music Info")).toBe(info);
  });

  it("puts the panels of a window that nothing ranks into the body, over the page", async () => {
    const user = userEvent.setup();
    render(<Finder onShare={share} />);
    await user.click(item("Music"));
    await choose(user, "Action", "Get Info");
    const group = titled("Music Info").parentElement as HTMLElement;
    expect(group.parentElement).toBe(document.body);
    expect(group).toHaveStyle({ zIndex: "0" });
  });

  it("places a panel from the origin its group really has, whatever it is positioned against", async () => {
    const user = userEvent.setup();
    // The group's origin is not the page's: a positioned body with a margin, a bordered layer.
    const measure = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        if (this.classList.contains("mac-finder-panels")) return new DOMRect(45, 35, 0, 0);
        if (this.classList.contains("mac-finder")) return new DOMRect(100, 50, 800, 600);
        return new DOMRect();
      });
    render(<Finder onShare={share} />);
    await user.click(item("Music"));
    await choose(user, "Action", "Get Info");
    expect(titled("Music Info")).toHaveStyle({ left: "79px", top: "39px" });
    measure.mockRestore();
  });

  it("puts the panels into the element it is given", async () => {
    const user = userEvent.setup();
    const layer = document.createElement("div");
    document.body.append(layer);
    render(<Finder onShare={share} panelContainer={layer} />);
    await user.click(item("Music"));
    await choose(user, "Action", "Get Info");
    expect(layer).toContainElement(titled("Music Info"));
    layer.remove();
  });
});

describe("hosting", () => {
  it("takes the window's frame and reports presses and double clicks on its title bar", () => {
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Finder
        width={800}
        height={500}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(titled("shackett")).toHaveStyle({ width: "800px", height: "500px" });
    const bar = titled("shackett").querySelector("[data-window-drag-region]") as HTMLElement;
    fireEvent.pointerDown(bar, { button: 0 });
    fireEvent.doubleClick(bar);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a control of the toolbar is the control's, not a drag.
    fireEvent.pointerDown(button("Icons"), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
  });

  it("takes the window's state and reports its window controls", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    render(
      <Finder
        state="main"
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        zoomRole="zoom"
        minimizeDisabled
      />,
    );
    expect(titled("shackett")).toHaveAttribute("data-window-state", "main");
    await user.click(button("Close"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(button("Minimize")).toBeDisabled();
    expect(onMinimize).not.toHaveBeenCalled();
  });
});
