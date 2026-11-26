import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { app } from "./app";
import { Books, BooksReader } from "./books";
import { capturedBook, defaultBooks } from "./books-data";

const frame = () => screen.getByRole("region", { name: "Books" });
const reader = (title = "Aqua and Bondi") => screen.getByRole("region", { name: title });
const noReader = (title = "Aqua and Bondi") => screen.queryByRole("region", { name: title });
const button = (name: string | RegExp) => within(frame()).getByRole("button", { name });
const row = (name: string) =>
  within(screen.getByRole("tree", { name: "Library" })).getByRole("treeitem", { name });
const search = () => screen.getByRole("searchbox");
/** The covers shown, in order: the titles of the books, from the names of their buttons. */
const covers = (within_: HTMLElement = frame()) =>
  [...within_.querySelectorAll(".mac-books-cover")].map(
    (cover) => cover.getAttribute("aria-label")?.split(", ")[0],
  );
const cover = (title: string) => button(new RegExp(`^${title}, `));
/** A control that is there and cannot be used: disabled, or kept focusable and marked so. */
const unavailable = (control: HTMLElement) =>
  control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true";
const level = (window: HTMLElement) => Number(window.style.zIndex);
/** What the book window shows: the name of its page. */
const page = (title?: string) => within(reader(title)).getByRole("img").getAttribute("aria-label");
const thumbnail = (number: number, title?: string) =>
  within(within(reader(title)).getByRole("group", { name: "Pages" })).getByRole("button", {
    name: `Page ${number}`,
  });
const currentBadge = (title?: string) =>
  reader(title).querySelector('.mac-books-thumbnail[aria-current="page"] .mac-books-badge')
    ?.textContent;

const RECENT = [
  "Aqua and Bondi",
  "A Field Guide to Small Things",
  "Notes on a Long Walk",
  "The Handbook",
  "Collected Short Stories",
  "A Year in the Garden",
  "The Second Novel",
  "Quarterly Report",
  "The First Novel",
];

describe("Books", () => {
  it("lists the books of the sidebar row that is chosen and marks the row", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    render(<Books onSectionChange={onSectionChange} />);
    expect(row("All Books")).toHaveAttribute("aria-selected", "true");
    expect(covers()).toEqual(RECENT);

    await user.click(row("Audiobooks"));
    expect(onSectionChange).toHaveBeenLastCalledWith("audiobooks");
    expect(row("Audiobooks")).toHaveAttribute("aria-selected", "true");
    expect(row("All Books")).toHaveAttribute("aria-selected", "false");
    expect(covers()).toEqual(["Notes on a Long Walk", "Collected Short Stories"]);

    await user.click(row("PDFs"));
    expect(covers()).toEqual(["The Handbook", "Quarterly Report"]);
    await user.click(row("Books"));
    expect(covers()).toHaveLength(5);
    expect(covers()).not.toContain("The Handbook");

    // Authors and Categories put every book under a heading.
    await user.click(row("Authors"));
    const author = (name: string) => covers(screen.getByRole("region", { name }));
    expect(author("Author Two")).toEqual(["The Second Novel", "The First Novel"]);
    expect(author("Stephen Hackett")).toEqual(["Aqua and Bondi"]);
    await user.click(row("Categories"));
    expect(covers(screen.getByRole("region", { name: "Nature" }))).toEqual([
      "A Field Guide to Small Things",
      "A Year in the Garden",
    ]);
    expect(covers()).toHaveLength(defaultBooks.length);
  });

  it("reorders the covers with Sort By", async () => {
    const user = userEvent.setup();
    render(<Books />);
    const sortBy = async (name: string) => {
      await user.click(button("Sort By"));
      await user.click(await screen.findByRole("menuitemradio", { name }));
    };
    await user.click(button("Sort By"));
    expect(await screen.findByRole("menuitemradio", { name: "Most Recent" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(screen.getByRole("menuitemradio", { name: "Title" }));
    expect(covers()).toEqual([
      "A Field Guide to Small Things",
      "A Year in the Garden",
      "Aqua and Bondi",
      "Collected Short Stories",
      "Notes on a Long Walk",
      "Quarterly Report",
      "The First Novel",
      "The Handbook",
      "The Second Novel",
    ]);

    // By author, and by title under one author.
    await sortBy("Author");
    expect(covers().slice(0, 4)).toEqual([
      "Quarterly Report",
      "Collected Short Stories",
      "A Field Guide to Small Things",
      "The Handbook",
    ]);
    expect(covers().at(-1)).toBe("Aqua and Bondi");

    // Manually is the order the library was given in; the order holds in another row.
    await sortBy("Manually");
    expect(covers()).toEqual(defaultBooks.map((book) => book.title));
    await user.click(row("PDFs"));
    expect(covers()).toEqual(["The Handbook", "Quarterly Report"]);
    await sortBy("Title");
    expect(covers()).toEqual(["Quarterly Report", "The Handbook"]);
  });

  it("switches between the library and the two stores with the segmented control", async () => {
    const user = userEvent.setup();
    render(<Books />);
    const pressed = () =>
      within(screen.getByRole("group", { name: "View" }))
        .getAllByRole("button")
        .map((segment) => [segment.textContent, segment.getAttribute("aria-pressed")]);
    expect(pressed()).toEqual([
      ["Library", "true"],
      ["Book Store", "false"],
      ["Audiobook Store", "false"],
    ]);

    await user.click(button("Book Store"));
    expect(button("Book Store")).toHaveAttribute("aria-pressed", "true");
    // The stores have no sidebar and no covers of the library: shelves of placeholder cards.
    expect(screen.queryByRole("tree")).toBeNull();
    expect(unavailable(button("Hide Sidebar"))).toBe(true);
    expect(covers()).toEqual([]);
    const cards = (name: string) =>
      within(screen.getByRole("region", { name })).getAllByRole("listitem");
    expect(cards("New Release")).toHaveLength(5);
    expect(cards("Top Book")[0]).toHaveTextContent("Top Book 1");

    await user.click(button("Audiobook Store"));
    expect(screen.queryByRole("region", { name: "New Release" })).toBeNull();
    expect(cards("Popular Audiobook")).toHaveLength(4);
    // A selected segment is not deselected by a second click.
    await user.click(button("Audiobook Store"));
    expect(button("Audiobook Store")).toHaveAttribute("aria-pressed", "true");

    // The library comes back as it was left.
    await user.click(button("Library"));
    expect(row("All Books")).toHaveAttribute("aria-selected", "true");
    expect(covers()).toEqual(RECENT);
  });

  it("filters by title or author as the search field is typed in", async () => {
    const user = userEvent.setup();
    render(<Books />);
    await user.type(search(), "NOVEL");
    expect(covers()).toEqual(["The Second Novel", "The First Novel"]);
    await user.clear(search());
    await user.type(search(), "author three");
    expect(covers()).toEqual(["Notes on a Long Walk", "A Year in the Garden"]);

    // The search is within the row that is chosen.
    await user.click(row("Audiobooks"));
    expect(covers()).toEqual(["Notes on a Long Walk"]);

    await user.clear(search());
    await user.type(search(), "no such thing");
    expect(screen.getByRole("status")).toHaveTextContent("No Results");
    // Escape clears the field.
    await user.keyboard("{Escape}");
    expect(search()).toHaveValue("");
    expect(covers()).toEqual(["Notes on a Long Walk", "Collected Short Stories"]);

    // A store's cards are searched the same way.
    await user.click(button("Book Store"));
    // The test's typing keeps its own record of the field, which Escape did not go through.
    await user.clear(search());
    await user.type(search(), "release 2");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("listitem")).toHaveTextContent("New Release 2");
  });

  it("hides and shows the sidebar with the toolbar's button", async () => {
    const user = userEvent.setup();
    render(<Books />);
    await user.click(button("Hide Sidebar"));
    expect(screen.queryByRole("tree")).toBeNull();
    expect(covers()).toEqual(RECENT);
    await user.click(button("Show Sidebar"));
    expect(row("All Books")).toHaveAttribute("aria-selected", "true");
  });

  it("adds a collection as a sidebar row, selects it and shows that it is empty", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    render(<Books onSectionChange={onSectionChange} />);
    expect(screen.queryByRole("treeitem", { name: "Untitled Collection" })).toBeNull();

    await user.click(button("New Collection"));
    expect(row("Untitled Collection")).toHaveAttribute("aria-selected", "true");
    expect(row("All Books")).toHaveAttribute("aria-selected", "false");
    expect(onSectionChange).toHaveBeenLastCalledWith("collection-1");
    expect(screen.getByRole("status")).toHaveTextContent("No Books");

    await user.click(button("New Collection"));
    expect(row("Untitled Collection 2")).toHaveAttribute("aria-selected", "true");
    expect(row("Untitled Collection")).toHaveAttribute("aria-selected", "false");
    await user.click(row("All Books"));
    expect(covers()).toEqual(RECENT);
  });

  it("draws its covers, add button and thumbnails with the library's components", async () => {
    const user = userEvent.setup();
    render(<Books />);
    expect(cover("Aqua and Bondi")).toHaveClass("mac-book-cover");
    expect(button("New Collection")).toHaveClass("mac-round-rect-button");
    await user.dblClick(cover("Aqua and Bondi"));
    expect(thumbnail(1)).toHaveClass("mac-borderless-button");
  });

  it("gives the keyboard to the book window that opens, and back to the cover when it closes", async () => {
    const user = userEvent.setup();
    render(<Books />);
    const title = "The Handbook";
    cover(title).focus();
    await user.keyboard("{Enter}");
    // The page's thumbnail has the keyboard: the arrow keys turn the pages at once.
    expect(thumbnail(1, title)).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(page(title)).toBe("Page 2 of 4");
    expect(thumbnail(2, title)).toHaveFocus();

    // Closed from inside, the window hands the keyboard back to the cover it came from.
    await user.click(within(reader(title)).getByRole("button", { name: "Library" }));
    expect(noReader(title)).toBeNull();
    expect(cover(title)).toHaveFocus();

    // Opened again, at the page it was left on, and closed with its close button.
    await user.keyboard(" ");
    expect(thumbnail(2, title)).toHaveFocus();
    await user.click(within(reader(title)).getByRole("button", { name: "Close" }));
    expect(cover(title)).toHaveFocus();

    // A book that is open at first does not take the keyboard from the page.
    cleanup();
    render(<Books defaultOpenBook="aqua-and-bondi" />);
    expect(document.body).toHaveFocus();
  });

  it("keeps a book's bookmarks while its window is closed and another book is read", async () => {
    const user = userEvent.setup();
    render(<Books />);
    const item = (name: string) => screen.findByRole("menuitem", { name });
    const bookmarks = (title: string) =>
      within(reader(title)).getByRole("button", { name: "Bookmarks" });
    const first = "The Handbook";
    const second = "Aqua and Bondi";

    await user.dblClick(cover(first));
    await user.click(thumbnail(3, first));
    await user.click(bookmarks(first));
    await user.click(await item("Add Bookmark"));
    await user.click(thumbnail(1, first));
    await user.click(within(reader(first)).getByRole("button", { name: "Library" }));

    // Another book has none of them.
    await user.dblClick(cover(second));
    await user.click(bookmarks(second));
    expect(await item("Add Bookmark")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Page 3" })).toBeNull();
    await user.keyboard("{Escape}");

    // The first book has its bookmark still, and it leads to the page.
    await user.dblClick(cover(first));
    await user.click(bookmarks(first));
    await user.click(await item("Page 3"));
    expect(page(first)).toBe("Page 3 of 4");
    expect(bookmarks(first)).toHaveAttribute("data-marked");
  });

  it("opens a book with a double click on its cover, as a second window in front", async () => {
    const user = userEvent.setup();
    const onOpenBookChange = vi.fn();
    render(<Books onOpenBookChange={onOpenBookChange} />);
    expect(noReader()).toBeNull();

    // One click selects nothing and opens nothing.
    await user.click(cover("Aqua and Bondi"));
    expect(noReader()).toBeNull();

    await user.dblClick(cover("Aqua and Bondi"));
    expect(onOpenBookChange).toHaveBeenLastCalledWith("aqua-and-bondi");
    expect(reader()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    // It is a window of its own, beside the library window and over it.
    expect(frame()).not.toContainElement(reader());
    expect(level(reader())).toBeGreaterThan(level(frame()));
    expect(page()).toBe("Page 1 of 3");

    // A press on either window brings it to the front.
    fireEvent.pointerDown(search());
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(reader()).toHaveAttribute("data-window-state", "inactive");
    expect(level(frame())).toBeGreaterThan(level(reader()));
    fireEvent.pointerDown(thumbnail(2));
    expect(reader()).toHaveAttribute("data-window-state", "key");
    expect(level(reader())).toBeGreaterThan(level(frame()));

    // Its close button closes it, and the library is key again.
    await user.click(within(reader()).getByRole("button", { name: "Close" }));
    expect(onOpenBookChange).toHaveBeenLastCalledWith(null);
    expect(noReader()).toBeNull();
    expect(frame()).toHaveAttribute("data-window-state", "key");
  });

  it("opens a book with Return on its cover, and its Library button returns to the library", async () => {
    const user = userEvent.setup();
    render(<Books />);
    cover("The Handbook").focus();
    await user.keyboard("{Enter}");
    expect(reader("The Handbook")).toHaveAttribute("data-window-state", "key");
    expect(page("The Handbook")).toBe("Page 1 of 4");

    await user.click(within(reader("The Handbook")).getByRole("button", { name: "Library" }));
    expect(noReader("The Handbook")).toBeNull();
    expect(frame()).toHaveAttribute("data-window-state", "key");

    // Another book opens in the same place: one book window at a time.
    await user.dblClick(cover("Quarterly Report"));
    await user.dblClick(cover("The First Novel"));
    expect(noReader("Quarterly Report")).toBeNull();
    expect(page("The First Novel")).toBe("Page 1 of 3");
  });

  it("turns the pages from the thumbnails, the page buttons, the arrow keys and the contents", async () => {
    const user = userEvent.setup();
    render(<Books />);
    const title = "A Field Guide to Small Things";
    await user.dblClick(cover(title));
    const control = (name: string) => within(reader(title)).getByRole("button", { name });
    expect(page(title)).toBe("Page 1 of 4");
    expect(thumbnail(1, title)).toHaveAttribute("aria-current", "page");
    expect(currentBadge(title)).toBe("1");
    expect(unavailable(control("Previous Page"))).toBe(true);

    // A thumbnail: the page and the badge that is marked follow.
    await user.click(thumbnail(3, title));
    expect(page(title)).toBe("Page 3 of 4");
    expect(thumbnail(3, title)).toHaveAttribute("aria-current", "page");
    expect(thumbnail(1, title)).not.toHaveAttribute("aria-current");
    expect(currentBadge(title)).toBe("3");

    // The page buttons, which stop at the last page.
    await user.click(control("Next Page"));
    expect(page(title)).toBe("Page 4 of 4");
    expect(unavailable(control("Next Page"))).toBe(true);
    await user.click(control("Previous Page"));
    expect(currentBadge(title)).toBe("3");

    // The arrow keys, with the focus following the current thumbnail.
    thumbnail(3, title).focus();
    await user.keyboard("{ArrowLeft}");
    expect(page(title)).toBe("Page 2 of 4");
    expect(thumbnail(2, title)).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(page(title)).toBe("Page 4 of 4");

    // Table of Contents lists the pages.
    await user.click(control("Table of Contents"));
    await user.click(await screen.findByRole("menuitem", { name: "Page 2" }));
    expect(page(title)).toBe("Page 2 of 4");
    expect(currentBadge(title)).toBe("2");

    // A book is opened again at the page it was closed on.
    await user.click(control("Library"));
    await user.dblClick(cover(title));
    expect(page(title)).toBe("Page 2 of 4");
    await user.click(control("Library"));
    await user.dblClick(cover("Aqua and Bondi"));
    expect(page()).toBe("Page 1 of 3");
  });

  it("opens the book it is given at first, behind which the library is inactive", () => {
    const { unmount } = render(<Books defaultOpenBook="aqua-and-bondi" />);
    expect(reader()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    unmount();

    // In an application that is not in front, neither window is key.
    render(<Books defaultOpenBook="aqua-and-bondi" state="inactive" />);
    expect(reader()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
  });

  it("opens no window for a book the library does not hold", () => {
    render(<Books books={[]} defaultOpenBook="aqua-and-bondi" />);
    expect(noReader()).toBeNull();
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(screen.getByRole("status")).toHaveTextContent("No Books");
  });

  it("renders the book window where it is told to, at the given place and size", () => {
    const container = document.createElement("div");
    document.body.append(container);
    render(
      <Books
        defaultOpenBook="aqua-and-bondi"
        windowsContainer={container}
        bookOffset={{ x: 300, y: 40 }}
        readerProps={{ width: 500, height: 400 }}
      />,
    );
    expect(container).toContainElement(reader());
    // Its size is its own, set on it: a host that sizes its children does not resize it.
    expect(reader()).toHaveStyle({
      position: "absolute",
      left: "300px",
      top: "40px",
      width: "500px",
      height: "400px",
    });
    container.remove();
  });

  it("is the library's window and passes its props on", () => {
    const onPointerDown = vi.fn();
    render(
      <Books
        id="books"
        width="100%"
        height={500}
        style={{ left: 10 }}
        onPointerDown={onPointerDown}
      />,
    );
    const root = frame();
    expect(root).toHaveClass("mac-window", "mac-books");
    expect(root).toHaveAttribute("id", "books");
    expect(root).toHaveStyle({ width: "100%", height: "500px", left: "10px" });
    fireEvent.pointerDown(root);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("hands the window controls their props", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const { rerender } = render(
      <Books onClose={onClose} onMinimize={onMinimize} onZoom={onZoom} zoomRole="zoom" />,
    );
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    // The window controls' props are not attributes of the window.
    expect(frame()).not.toHaveAttribute("zoomrole");

    rerender(<Books minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
    expect(button("Close")).toBeEnabled();
  });

  it("reports a press and a double click on its toolbar row, not on the controls in it", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Books
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const bar = screen.getByRole("toolbar", { name: "Books toolbar" });
    expect(bar.closest("[data-window-drag-region]")).not.toBeNull();

    fireEvent.pointerDown(bar, { button: 2 });
    fireEvent.pointerDown(button("Book Store"), { button: 0 });
    fireEvent.pointerDown(button("Hide Sidebar"), { button: 0 });
    fireEvent.pointerDown(search(), { button: 0 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toMatchObject({
      id: "books",
      name: "Books",
      defaultSize: { width: 1184, height: 784 },
      resizable: true,
      menus: ["Books", "File", "Edit", "View", "Controls", "Store", "Window", "Help"],
    });
    render(
      <WindowManager style={{ height: 900 }}>
        <ManagedWindow
          id={app.id}
          title={app.name}
          resizable={app.resizable}
          minWidth={app.minSize.width}
          minHeight={app.minSize.height}
          defaultFrame={{ x: 20, y: 30, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    const host = frame().parentElement as HTMLElement;
    expect(host).toHaveAttribute("data-window-id", "books");
    expect(host).toHaveStyle({ width: "1184px", height: "784px" });
    // The manager sizes the wrapper; the window fills it.
    expect(frame()).toHaveStyle({ width: "100%", height: "100%" });
    expect(frame()).toHaveAttribute("data-window-state", "key");

    // The manager moves the window by its toolbar row.
    const bar = screen.getByRole("toolbar", { name: "Books toolbar" });
    const before = host.style.transform;
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 300, clientY: 20 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 340, clientY: 50 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 340, clientY: 50 });
    expect(host.style.transform).not.toBe(before);

    // The app works in there: a book opens as a second window, in front of the library's.
    await user.click(row("PDFs"));
    expect(covers()).toEqual(["The Handbook", "Quarterly Report"]);
    await user.dblClick(cover("The Handbook"));
    expect(reader("The Handbook")).toHaveAttribute("data-window-state", "key");
    expect(frame()).not.toContainElement(reader("The Handbook"));
    expect(frame()).toHaveAttribute("data-window-state", "inactive");

    // The manager's close button closes the application's window, and its book with it.
    await user.click(button("Close"));
    expect(screen.queryByRole("region", { name: "Books" })).toBeNull();
    expect(noReader("The Handbook")).toBeNull();
  });
});

describe("BooksReader", () => {
  const control = (name: string) => screen.getByRole("button", { name });

  it("is a window named by the book, with the bar's buttons and one thumbnail per page", () => {
    render(<BooksReader book={capturedBook} />);
    const root = reader();
    expect(root).toHaveClass("mac-window", "mac-books-reader");
    expect(root).toHaveStyle({ width: "786px", height: "785px" });
    const bar = within(screen.getByRole("group", { name: "Book controls" }));
    expect(bar.getAllByRole("button").map((item) => item.getAttribute("aria-label"))).toEqual([
      "Library",
      "Table of Contents",
      "Notes",
      "Search",
      "Bookmarks",
    ]);
    // Notes and Search are not built.
    expect(unavailable(control("Notes"))).toBe(true);
    expect(unavailable(control("Search"))).toBe(true);
    const pages = within(screen.getByRole("group", { name: "Pages" })).getAllByRole("button");
    expect(pages.map((item) => item.textContent)).toEqual(["1", "2", "3"]);
    expect(pages.map((item) => item.getAttribute("aria-current"))).toEqual(["page", null, null]);
  });

  it("starts at the page it is given, reports each turn and stays within the book", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onLibrary = vi.fn();
    render(
      <BooksReader
        book={capturedBook}
        defaultPage={9}
        onPageChange={onPageChange}
        onLibrary={onLibrary}
      />,
    );
    // A page past the end is the last page.
    expect(page()).toBe("Page 3 of 3");
    expect(unavailable(control("Next Page"))).toBe(true);
    await user.click(control("Previous Page"));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(page()).toBe("Page 2 of 3");
    // The page that is shown is not turned to again.
    await user.click(thumbnail(2));
    expect(onPageChange).toHaveBeenCalledTimes(1);

    await user.click(control("Library"));
    expect(onLibrary).toHaveBeenCalledTimes(1);
  });

  it("shows the page its owner gives it", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <BooksReader book={capturedBook} page={2} onPageChange={onPageChange} />,
    );
    expect(page()).toBe("Page 2 of 3");
    await user.click(thumbnail(3));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    // The owner has not followed: the page stays.
    expect(page()).toBe("Page 2 of 3");
    rerender(<BooksReader book={capturedBook} page={3} onPageChange={onPageChange} />);
    expect(thumbnail(3)).toHaveAttribute("aria-current", "page");
  });

  it("keeps bookmarks: adds the page, lists it, goes to it and removes it", async () => {
    const user = userEvent.setup();
    render(<BooksReader book={capturedBook} />);
    // A menu opens a moment after its button is pressed.
    const item = (name: string) => screen.findByRole("menuitem", { name });
    expect(control("Bookmarks")).not.toHaveAttribute("data-marked");

    await user.click(thumbnail(2));
    await user.click(control("Bookmarks"));
    await user.click(await item("Add Bookmark"));
    expect(control("Bookmarks")).toHaveAttribute("data-marked");

    // On another page the bookmark is listed and leads back.
    await user.click(thumbnail(1));
    expect(control("Bookmarks")).not.toHaveAttribute("data-marked");
    await user.click(control("Bookmarks"));
    await user.click(await item("Page 2"));
    expect(page()).toBe("Page 2 of 3");

    await user.click(control("Bookmarks"));
    await user.click(await item("Remove Bookmark"));
    await user.click(control("Bookmarks"));
    await item("Add Bookmark");
    expect(screen.queryByRole("menuitem", { name: "Page 2" })).toBeNull();
    expect(await item("Add Bookmark")).toBeInTheDocument();
  });

  it("shows the bookmarks its owner keeps, and reports each change to them", async () => {
    const user = userEvent.setup();
    const onBookmarksChange = vi.fn();
    render(
      <BooksReader book={capturedBook} bookmarks={[2]} onBookmarksChange={onBookmarksChange} />,
    );
    const item = (name: string) => screen.findByRole("menuitem", { name });
    await user.click(control("Bookmarks"));
    expect(await item("Page 2")).toBeInTheDocument();
    await user.click(await item("Add Bookmark"));
    expect(onBookmarksChange).toHaveBeenLastCalledWith([1, 2]);
    // The owner has not followed: the page is not marked.
    expect(control("Bookmarks")).not.toHaveAttribute("data-marked");
  });

  it("hands its title bar the hosting props: the window controls and the drag region", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <BooksReader
        book={capturedBook}
        onClose={onClose}
        minimizeDisabled
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    await user.click(control("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(control("Minimize")).toBeDisabled();

    const bar = screen.getByRole("group", { name: "Book controls" });
    fireEvent.pointerDown(control("Library"), { button: 0 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    await user.dblClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });
});

/** A box as `getBoundingClientRect` gives it, for the cases that stand in for layout. */
const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

describe("Books, its two windows", () => {
  it("brings forward the window that Tab or Shift-Tab moves the keyboard into", async () => {
    const user = userEvent.setup();
    render(<Books defaultOpenBook="aqua-and-bondi" />);
    const holds = (window: HTMLElement) => window.contains(document.activeElement);
    within(reader()).getByRole("button", { name: "Library" }).focus();
    expect(reader()).toHaveAttribute("data-window-state", "key");

    // Shift-Tab out of the book window, into the library window behind it.
    for (let step = 0; step < 30 && holds(reader()); step++) await user.tab({ shift: true });
    expect(holds(frame())).toBe(true);
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(reader()).toHaveAttribute("data-window-state", "inactive");
    expect(level(frame())).toBeGreaterThan(level(reader()));

    // Tab into the book window again: it comes back to the front.
    for (let step = 0; step < 60 && !holds(reader()); step++) await user.tab();
    expect(holds(reader())).toBe(true);
    expect(reader()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(level(reader())).toBeGreaterThan(level(frame()));
  });

  it("calls the callbacks given in readerProps after its own", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onBookmarksChange = vi.fn();
    const onLibrary = vi.fn();
    const onClose = vi.fn();
    render(
      <Books
        defaultOpenBook="aqua-and-bondi"
        readerProps={{ onPageChange, onBookmarksChange, onLibrary, onClose }}
      />,
    );
    const control = (name: string) => within(reader()).getByRole("button", { name });
    await user.click(thumbnail(2));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(page()).toBe("Page 2 of 3");

    await user.click(control("Bookmarks"));
    await user.click(await screen.findByRole("menuitem", { name: "Add Bookmark" }));
    expect(onBookmarksChange).toHaveBeenLastCalledWith([2]);
    expect(control("Bookmarks")).toHaveAttribute("data-marked");

    await user.click(control("Library"));
    expect(onLibrary).toHaveBeenCalledTimes(1);
    expect(noReader()).toBeNull();

    // The app kept the page and the bookmark, and its close button still closes the window.
    await user.dblClick(cover("Aqua and Bondi"));
    expect(page()).toBe("Page 2 of 3");
    expect(control("Bookmarks")).toHaveAttribute("data-marked");
    await user.click(control("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(noReader()).toBeNull();
  });

  it("keeps the window in front over the other whatever level the caller gives", () => {
    // The caller's levels lift both windows and never decide which is in front.
    render(
      <Books
        defaultOpenBook="aqua-and-bondi"
        style={{ zIndex: 10 }}
        readerProps={{ style: { zIndex: 3 } }}
      />,
    );
    expect(reader()).toHaveAttribute("data-window-state", "key");
    expect(level(reader())).toBeGreaterThan(level(frame()));
    expect(level(frame())).toBeGreaterThanOrEqual(10);
    fireEvent.pointerDown(search());
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(level(frame())).toBeGreaterThan(level(reader()));
    fireEvent.pointerDown(thumbnail(2));
    expect(level(reader())).toBeGreaterThan(level(frame()));
  });

  it("closes the book window from its close button when readerProps gives the controls a close handler too", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Books defaultOpenBook="aqua-and-bondi" readerProps={{ controlsProps: { onClose } }} />);
    await user.click(within(reader()).getByRole("button", { name: "Close" }));
    // The app's own close runs, then the caller's.
    expect(noReader()).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls both its own window-control handlers and the ones in controlsProps", async () => {
    const user = userEvent.setup();
    const own = { onClose: vi.fn(), onMinimize: vi.fn(), onZoom: vi.fn() };
    const extra = { onClose: vi.fn(), onMinimize: vi.fn(), onZoom: vi.fn() };
    render(<Books {...own} controlsProps={extra} />);
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button(/Zoom|Full Screen/));
    for (const handlers of [own, extra]) {
      expect(handlers.onClose).toHaveBeenCalledTimes(1);
      expect(handlers.onMinimize).toHaveBeenCalledTimes(1);
      expect(handlers.onZoom).toHaveBeenCalledTimes(1);
    }
  });

  it("decides which window is key itself, whatever state readerProps gives the book window", () => {
    render(<Books defaultOpenBook="aqua-and-bondi" readerProps={{ state: "key" }} />);
    expect(reader()).toHaveAttribute("data-window-state", "key");
    fireEvent.pointerDown(search());
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(reader()).toHaveAttribute("data-window-state", "inactive");
  });

  it("leaves a caller's zIndex as it is while no book is open", () => {
    render(<Books style={{ zIndex: 10 }} />);
    expect(frame()).toHaveStyle({ zIndex: "10" });
  });

  it.each([
    ["no level", undefined],
    ["a fractional level", 1.5],
    ["a level the browser does not take", "invalid"],
  ])(
    "does not lift the windows on every render when the book window inherits the library's level, given %s",
    (_, given) => {
      // The book window is rendered inside the library window and inherits its z-index; the
      // inheritance is stood in for, as jsdom does not compute it.
      const real = window.getComputedStyle.bind(window);
      const computed = vi
        .spyOn(window, "getComputedStyle")
        .mockImplementation((element: Element, pseudo?: string | null) => {
          const style = real(element, pseudo);
          if (!(element instanceof HTMLElement) || element.style.zIndex !== "inherit") return style;
          const from = element.parentElement?.closest<HTMLElement>(".mac-books");
          const level = from?.style.zIndex || "auto";
          return new Proxy(style, {
            get: (target, name) => {
              if (name === "zIndex") return level;
              const value = Reflect.get(target, name);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
        });
      function Nested() {
        const [library, setLibrary] = useState<HTMLDivElement | null>(null);
        return (
          <Books
            ref={setLibrary}
            style={given === undefined ? undefined : { zIndex: given }}
            windowsContainer={library}
            defaultOpenBook="aqua-and-bondi"
            bookOffset={{ x: 4000, y: 4000 }}
            readerProps={{ style: { zIndex: "inherit" } }}
          />
        );
      }
      try {
        render(<Nested />);
        expect(frame()).toContainElement(reader());
        // The caller gave the library no level the browser takes: the windows stand on the
        // defaults.
        expect(frame().style.getPropertyValue("z-index")).toBe("1");
      } finally {
        computed.mockRestore();
      }
    },
  );

  it("measures the order anew when the book window's container changes", () => {
    // Layout and hit testing are stood in for: the two windows overlap, and at first the
    // library is drawn over the book window up to level 5 whatever the levels say, as a
    // stacking context the computed style does not tell would; afterwards the drawn order is
    // the levels' own.
    const first = document.createElement("div");
    const second = document.createElement("div");
    document.body.append(first, second);
    const measure = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("mac-books")) return rect(0, 0, 500, 500);
        if (this.classList.contains("mac-books-reader")) return rect(100, 100, 300, 300);
        return rect(0, 0, 0, 0);
      });
    let trapped = true;
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: () => {
        const library = document.querySelector<HTMLElement>(".mac-books");
        const book = document.querySelector<HTMLElement>(".mac-books-reader");
        if (!library || !book) return [];
        const over = trapped
          ? Number(library.style.zIndex) >= 5
          : Number(library.style.zIndex) > Number(book.style.zIndex);
        return over ? [library, book] : [book, library];
      },
    });
    try {
      const { rerender } = render(
        <Books defaultOpenBook="aqua-and-bondi" style={{ zIndex: 10 }} windowsContainer={first} />,
      );
      // Measured: the highest level that keeps the library under the book window.
      expect(frame().style.getPropertyValue("z-index")).toBe("4");
      trapped = false;
      rerender(
        <Books defaultOpenBook="aqua-and-bondi" style={{ zIndex: 10 }} windowsContainer={second} />,
      );
      // In the new container both windows stand on the caller's level again.
      expect(second).toContainElement(reader());
      expect(frame().style.getPropertyValue("z-index")).toBe("11");
      expect(reader().style.getPropertyValue("z-index")).toBe("12");
    } finally {
      measure.mockRestore();
      Reflect.deleteProperty(document, "elementsFromPoint");
      cleanup();
      first.remove();
      second.remove();
    }
  });

  it("measures the order anew when the level a caller's zIndex comes to changes", () => {
    // The library's level is `var(--layer)` throughout; what it comes to is stood in for, as
    // jsdom does not resolve custom properties. Layout and hit testing are stood in for as
    // above: at first the library is drawn over the book window from level 5 up, whatever the
    // levels say; afterwards the drawn order is the levels' own.
    let layer = 10;
    const real = window.getComputedStyle.bind(window);
    const computed = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element: Element, pseudo?: string | null) => {
        const style = real(element, pseudo);
        if (!(element instanceof HTMLElement) || element.style.zIndex !== "var(--layer)") {
          return style;
        }
        return new Proxy(style, {
          get: (target, name) => {
            if (name === "zIndex") return String(layer);
            const value = Reflect.get(target, name);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      });
    const container = document.createElement("div");
    document.body.append(container);
    const measure = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("mac-books")) return rect(0, 0, 500, 500);
        if (this.classList.contains("mac-books-reader")) return rect(100, 100, 300, 300);
        return rect(0, 0, 0, 0);
      });
    let trapped = true;
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: () => {
        const library = document.querySelector<HTMLElement>(".mac-books");
        const book = document.querySelector<HTMLElement>(".mac-books-reader");
        if (!library || !book) return [];
        const over = trapped
          ? Number(library.style.zIndex) >= 5
          : Number(library.style.zIndex) > Number(book.style.zIndex);
        return over ? [library, book] : [book, library];
      },
    });
    try {
      const { rerender } = render(
        <Books
          defaultOpenBook="aqua-and-bondi"
          style={{ zIndex: "var(--layer)" }}
          windowsContainer={container}
        />,
      );
      // Measured: the highest level that keeps the library under the book window.
      expect(frame().style.getPropertyValue("z-index")).toBe("4");
      layer = 20;
      trapped = false;
      rerender(
        <Books
          defaultOpenBook="aqua-and-bondi"
          style={{ zIndex: "var(--layer)" }}
          windowsContainer={container}
        />,
      );
      // The same text, a new level: both windows stand on it again, the book window in front.
      expect(frame().style.getPropertyValue("z-index")).toBe("21");
      expect(reader().style.getPropertyValue("z-index")).toBe("22");
    } finally {
      computed.mockRestore();
      measure.mockRestore();
      Reflect.deleteProperty(document, "elementsFromPoint");
      cleanup();
      container.remove();
    }
  });

  it.each<[string, number | null]>([
    ["12", 12],
    ["+12", 12],
    ["-3", -3],
    ["1e3", null],
    ["0x10", null],
    ["1.0", null],
    ["1.5", null],
    [" ", null],
    ["\u00a012", null],
    ["\v12", null],
    ["9".repeat(400), null],
  ])("reads a zIndex of %s the browser does not resolve as CSS would take it", (given, taken) => {
    // The browser resolves no level here (its computed z-index is `auto`), so the level given
    // is read as text: only an integer CSS takes counts, and anything else is none.
    const real = window.getComputedStyle.bind(window);
    const computed = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element: Element, pseudo?: string | null) => {
        const style = real(element, pseudo);
        return new Proxy(style, {
          get: (target, name) => {
            if (name === "zIndex") return "auto";
            const value = Reflect.get(target, name);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      });
    try {
      render(<Books defaultOpenBook="aqua-and-bondi" style={{ zIndex: given }} />);
      const base = taken ?? 0;
      expect(level(frame())).toBe(base + 1);
      expect(level(reader())).toBe(base + 2);
    } finally {
      computed.mockRestore();
    }
  });

  it("measures where the book window's containing block is, as in a scaled body", () => {
    // Layout is stood in for: the body is drawn at half its size from (10, 20), which is where
    // the hidden 10-point probe is drawn, 5 pixels wide. The library window is at (140, 80).
    const measure = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("mac-books-probe")) return rect(10, 20, 5, 5);
        if (this.classList.contains("mac-books")) return rect(140, 80, 592, 392);
        return rect(0, 0, 0, 0);
      });
    try {
      render(
        <Books
          defaultOpenBook="aqua-and-bondi"
          windowsContainer={document.body}
          bookOffset={{ x: 96, y: 48 }}
          // The window's own transform does not change where its containing block is.
          readerProps={{ style: { transform: "scale(0.5)" } }}
        />,
      );
      // The library is (140 - 10) * 2 by (80 - 20) * 2 points into the body: 260 by 120.
      expect(reader()).toHaveStyle({ left: "356px", top: "168px" });
    } finally {
      measure.mockRestore();
    }
  });

  it.each([
    [2147483647, "2147483646", "2147483647"],
    [-1e12, "-2147483647", "-2147483646"],
    ["auto", "1", "2"],
    // CSS takes whole levels only: a fraction is no level, and the defaults apply.
    [1.5, "1", "2"],
    ["1.5", "1", "2"],
  ])(
    "stands both windows on a zIndex of %s, two different levels apart",
    (given, behind, front) => {
      render(<Books defaultOpenBook="aqua-and-bondi" style={{ zIndex: given }} />);
      expect(reader().style.getPropertyValue("z-index")).toBe(front);
      expect(frame().style.getPropertyValue("z-index")).toBe(behind);
      // Bringing the library forward swaps them.
      fireEvent.pointerDown(search());
      expect(frame().style.getPropertyValue("z-index")).toBe(front);
      expect(reader().style.getPropertyValue("z-index")).toBe(behind);
    },
  );

  it("places the book window in the coordinates of a scaled container", () => {
    // Layout is stood in for: the container is drawn at half its size, 100 by 50 pixels from
    // the screen's corner, and the library window 40 by 30 pixels into it, 80 by 60 of its own.
    const container = document.createElement("div");
    document.body.append(container);
    Object.defineProperty(container, "offsetWidth", { value: 1000 });
    Object.defineProperty(container, "offsetHeight", { value: 800 });
    const measure = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this === container) return rect(100, 50, 500, 400);
        if (this.classList.contains("mac-books")) return rect(140, 80, 592, 392);
        return rect(0, 0, 0, 0);
      });
    try {
      render(
        <Books
          defaultOpenBook="aqua-and-bondi"
          windowsContainer={container}
          bookOffset={{ x: 96, y: 48 }}
        />,
      );
      expect(container).toContainElement(reader());
      expect(reader()).toHaveStyle({ left: "176px", top: "108px" });
    } finally {
      measure.mockRestore();
      cleanup();
      container.remove();
    }
  });

  it("keeps the current thumbnail in view when the strip is made narrower", () => {
    // Layout and resizing are stood in for: thumbnails 160 pt wide, 169 pt apart, from 8 pt.
    const observed: { target: Element; callback: () => void }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        callback: () => void;
        constructor(callback: () => void) {
          this.callback = callback;
        }
        observe(target: Element) {
          observed.push({ target, callback: this.callback });
        }
        unobserve() {}
        disconnect() {}
      },
    );
    let width = 800;
    let scroll = 0;
    const measure = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("mac-books-strip-scroller")) return rect(0, 0, width, 120);
        const number = Number(this.dataset.page);
        if (number) return rect(8 + (number - 1) * 169 - scroll, 0, 160, 100);
        return rect(0, 0, 0, 0);
      });
    try {
      render(<BooksReader book={capturedBook} defaultPage={3} />);
      const scroller = reader().querySelector(".mac-books-strip-scroller") as HTMLElement;
      Object.defineProperty(scroller, "scrollLeft", {
        configurable: true,
        get: () => scroll,
        set: (value: number) => {
          scroll = value;
        },
      });
      // The third thumbnail ends at 506 pt: in view at 800 pt, out of it at 400.
      expect(scroll).toBe(0);
      width = 400;
      const strip = observed.filter(({ target }) => target === scroller);
      expect(strip).not.toHaveLength(0);
      for (const { callback } of strip) callback();
      expect(scroll).toBe(506 - 400 + 8);
    } finally {
      measure.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("scrolls the strip in its own points when its host is scaled", () => {
    // As above, with everything drawn at half size: 800 points of strip are 400 pixels.
    const observed: { target: Element; callback: () => void }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        callback: () => void;
        constructor(callback: () => void) {
          this.callback = callback;
        }
        observe(target: Element) {
          observed.push({ target, callback: this.callback });
        }
        unobserve() {}
        disconnect() {}
      },
    );
    let width = 800;
    let scroll = 0;
    const measure = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("mac-books-strip-scroller")) return rect(0, 0, width / 2, 60);
        const number = Number(this.dataset.page);
        if (number) return rect((8 + (number - 1) * 169 - scroll) / 2, 0, 80, 50);
        return rect(0, 0, 0, 0);
      });
    try {
      render(<BooksReader book={capturedBook} defaultPage={3} />);
      const scroller = reader().querySelector(".mac-books-strip-scroller") as HTMLElement;
      Object.defineProperty(scroller, "offsetWidth", { configurable: true, get: () => width });
      Object.defineProperty(scroller, "scrollLeft", {
        configurable: true,
        get: () => scroll,
        set: (value: number) => {
          scroll = value;
        },
      });
      width = 400;
      for (const { target, callback } of observed) if (target === scroller) callback();
      // The same 114 points as unscaled, not the 57 pixels the screen shows.
      expect(scroll).toBe(506 - 400 + 8);
    } finally {
      measure.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
