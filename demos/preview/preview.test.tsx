import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { isDesktopApp } from "../desktop/desktop-apps";
import { app, previewApp } from "./app";
import { Preview } from "./preview";
import { PreviewApp } from "./preview-app";
import {
  desktopPicture,
  islandFerry,
  type PreviewPdfDocument,
  searchDocument,
  splitMatches,
} from "./preview-data";

/**
 * jsdom has no layout: the list view renders its first 40 rows, nothing has a size and nothing
 * scrolls by itself. What a page's place in the view decides (bringing a page to the top,
 * following the scrolling) is tested with the rectangles of the view and its pages given by
 * hand; the same behaviour is checked in Chromium by the `expect` comparisons of
 * preview.visual.json, and the geometry by its comparisons with the screenshots.
 */
const frame = () => screen.getByRole("region", { name: /^(Island Ferry\.pdf|Desktop|Notes\.pdf)/ });
const list = () => screen.getByRole("listbox");
const rows = () => within(list()).getAllByRole("option");
const names = () => rows().map((row) => row.querySelector(".mac-preview-row-title")?.textContent);
const row = (name: string) => {
  const found = rows().find(
    (item) => item.querySelector(".mac-preview-row-title")?.textContent === name,
  );
  if (!found) throw new Error(`no row named ${name}`);
  return found;
};
const view = () => screen.getByRole("document");
const pages = () => within(view()).getAllByRole("region");
const field = () => screen.getByRole("searchbox");
const canvas = () => frame().querySelector(".mac-preview-canvas") as HTMLElement;
const marks = () => [...view().querySelectorAll("mark")].map((mark) => mark.textContent);

/** Gives the view and its pages rectangles: pages 700 pt high, 8 pt apart, under a 4 pt inset. */
function layOut() {
  const element = view();
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(new DOMRect(206, 86, 941, 707));
  for (const leaf of element.querySelectorAll<HTMLElement>("[data-page]")) {
    const index = Number(leaf.dataset.page) - 1;
    vi.spyOn(leaf, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(213, 86 + 4 + index * 708 - element.scrollTop, 927, 700),
    );
  }
}

describe("Preview", () => {
  it("opens the booklet at its first page, with a thumbnail for every page", () => {
    render(<Preview />);
    expect(frame()).toHaveClass("mac-window", "mac-preview");
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 1 of 22)");
    expect(list()).toHaveAccessibleName("Thumbnails");
    expect(names()).toHaveLength(22);
    expect(names().slice(0, 3)).toEqual(["Page 1", "Page 2", "Page 3"]);
    expect(row("Page 1")).toHaveAttribute("aria-selected", "true");
    expect(pages()).toHaveLength(22);
    expect(pages()[0]).toHaveAccessibleName("Page 1");
    expect(pages()[0]).toHaveTextContent("A Crossing Every Morning");
    expect(field()).toHaveValue("");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Highlight Color" })).toBeEnabled();
  });

  it("switches to the page whose thumbnail is chosen in the sidebar", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Preview onPageChange={onPageChange} />);
    layOut();
    await user.click(row("Page 5"));
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(5);
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 5 of 22)");
    expect(row("Page 5")).toHaveAttribute("aria-selected", "true");
    expect(row("Page 1")).toHaveAttribute("aria-selected", "false");
    // Page 5 starts 4 * 708 pt down the document: it is brought to the top of the view.
    expect(view().scrollTop).toBe(4 * 708);
    // The arrow keys move through the thumbnails, and the document follows.
    await user.keyboard("{ArrowDown}");
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 6 of 22)");
    expect(view().scrollTop).toBe(5 * 708);
    await user.click(row("Page 1"));
    expect(view().scrollTop).toBe(0);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it("follows the document as it is scrolled", () => {
    const onPageChange = vi.fn();
    render(<Preview onPageChange={onPageChange} />);
    layOut();
    // Most of page 3 is in view, and its top is above the view's: page 3 is the page shown.
    view().scrollTop = 2 * 708 + 300;
    fireEvent.scroll(view());
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 3 of 22)");
    expect(row("Page 3")).toHaveAttribute("aria-selected", "true");
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(3);
    // Scrolling within the page changes nothing.
    view().scrollTop = 2 * 708 + 500;
    fireEvent.scroll(view());
    expect(onPageChange).toHaveBeenCalledOnce();
  });

  it("starts at the page it is given, within the document", () => {
    const { unmount } = render(<Preview defaultPage={9} />);
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 9 of 22)");
    expect(row("Page 9")).toHaveAttribute("aria-selected", "true");
    unmount();
    render(<Preview defaultPage={99} />);
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 22 of 22)");
  });

  it("lists the pages that hold the text searched for, and goes to the first", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Preview onPageChange={onPageChange} />);
    await user.type(field(), "pilot");
    expect(list()).toHaveAccessibleName("Pages found");
    expect(names()).toEqual([
      "Page 9",
      "Page 13",
      "Page 14",
      "Page 17",
      "Page 18",
      "Page 19",
      "Page 21",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("Found on 7 pages");
    expect(row("Page 9")).toHaveTextContent("1 match");
    expect(row("Page 9")).toHaveTextContent("When the harbour pilot refused to guide the boat");
    expect(row("Page 17")).toHaveTextContent("4 matches");
    expect(row("Page 21")).toHaveTextContent("5 matches");
    // The first page found is shown and selected.
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 9 of 22)");
    expect(row("Page 9")).toHaveAttribute("aria-selected", "true");
    expect(onPageChange).toHaveBeenLastCalledWith(9);
    // Every occurrence is marked in the document: 14 in all.
    expect(marks()).toHaveLength(14);
    expect(new Set(marks())).toEqual(new Set(["pilot"]));
    // Choosing a page found goes to it.
    await user.click(row("Page 17"));
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 17 of 22)");
    expect(row("Page 17")).toHaveAttribute("aria-selected", "true");
  });

  it("opens a search it is given on the page given if the text is found there, or else on the first page found", () => {
    const onPageChange = vi.fn();
    // No page given: page 1 holds no “pilot”, and page 9 is the first that does.
    let mounted = render(<Preview defaultQuery="pilot" onPageChange={onPageChange} />);
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 9 of 22)");
    expect(list()).toHaveAccessibleName("Pages found");
    expect(row("Page 9")).toHaveAttribute("aria-selected", "true");
    // The page a window opens on is not a change of page.
    expect(onPageChange).not.toHaveBeenCalled();
    mounted.unmount();
    // A page given that is not one of the pages found: the first of them in the order given.
    mounted = render(<Preview defaultQuery="pilot" defaultPage={15} defaultSort="rank" />);
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 21 of 22)");
    expect(row("Page 21")).toHaveAttribute("aria-selected", "true");
    mounted.unmount();
    // A page given that is one of the pages found is the page shown.
    mounted = render(<Preview defaultQuery="pilot" defaultPage={17} />);
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 17 of 22)");
    expect(row("Page 17")).toHaveAttribute("aria-selected", "true");
    mounted.unmount();
    // Nothing found: the page given.
    render(<Preview defaultQuery="zeppelin" defaultPage={4} />);
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 4 of 22)");
  });

  it("keeps the page shown when it is one of the pages found", async () => {
    const user = userEvent.setup();
    render(<Preview defaultPage={17} />);
    await user.type(field(), "pilot");
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 17 of 22)");
  });

  it("steps through the pages found, sorts them and closes the find bar with Done", async () => {
    const user = userEvent.setup();
    render(<Preview defaultQuery="pilot" defaultPage={9} />);
    const previous = screen.getByRole("button", { name: "Previous" });
    const next = screen.getByRole("button", { name: "Next" });
    expect(previous).toBeDisabled();
    await user.click(next);
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 13 of 22)");
    expect(previous).toBeEnabled();
    await user.click(previous);
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 9 of 22)");
    // By rank the page with the most matches comes first; pages with as many keep their order.
    expect(screen.getByRole("radio", { name: "Page Order" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Search Rank" }));
    expect(names()).toEqual([
      "Page 21",
      "Page 17",
      "Page 9",
      "Page 13",
      "Page 14",
      "Page 18",
      "Page 19",
    ]);
    // Next and Previous follow the list as it is sorted.
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 13 of 22)");
    await user.click(row("Page 19"));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(list()).toHaveAccessibleName("Thumbnails");
    expect(names()).toHaveLength(22);
    // The page stays the one that was shown.
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 19 of 22)");
    expect(marks()).toEqual([]);
  });

  it("says so when the text is not found, and keeps the page", async () => {
    const user = userEvent.setup();
    render(<Preview defaultPage={4} />);
    // Pasted, not typed: a search runs with every letter, and its first letters are found.
    await user.click(field());
    await user.paste("zeppelin");
    expect(screen.getByRole("status")).toHaveTextContent("Not found");
    expect(within(list()).queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(frame()).toHaveAccessibleName("Island Ferry.pdf (page 4 of 22)");
  });

  it("zooms in steps of a quarter, between its limits", async () => {
    const user = userEvent.setup();
    render(<Preview />);
    const zoom = () => Number(canvas().style.getPropertyValue("--mac-preview-zoom"));
    expect(zoom()).toBe(1);
    await user.click(screen.getByRole("button", { name: "Zoom In" }));
    expect(zoom()).toBe(1.25);
    await user.click(screen.getByRole("button", { name: "Zoom Out" }));
    await user.click(screen.getByRole("button", { name: "Zoom Out" }));
    expect(zoom()).toBe(0.8);
    for (let press = 0; press < 5; press++)
      await user.click(screen.getByRole("button", { name: "Zoom Out" }));
    expect(zoom()).toBeCloseTo(1.25 ** -4);
    // A toolbar keeps its disabled items reachable with the arrow keys.
    expect(screen.getByRole("button", { name: "Zoom Out" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("turns the pages and their thumbnails a quarter to the left", async () => {
    const user = userEvent.setup();
    render(<Preview />);
    expect(canvas()).toHaveAttribute("data-turns", "0");
    await user.click(screen.getByRole("button", { name: "Rotate Left" }));
    expect(canvas()).toHaveAttribute("data-turns", "1");
    expect(row("Page 1").querySelector(".mac-preview-thumbnail")).toHaveAttribute(
      "data-turns",
      "1",
    );
    for (let press = 0; press < 3; press++)
      await user.click(screen.getByRole("button", { name: "Rotate Left" }));
    expect(canvas()).toHaveAttribute("data-turns", "0");
  });

  it("hides and shows the sidebar from the View button's menu", async () => {
    const user = userEvent.setup();
    render(<Preview />);
    const pane = () => frame().querySelector(".mac-preview-sidebar");
    expect(pane()).not.toHaveAttribute("data-collapsed");
    await user.click(screen.getByRole("button", { name: "View" }));
    expect(await screen.findByRole("menuitemradio", { name: "Thumbnails" })).toBeChecked();
    await user.click(screen.getByRole("menuitemradio", { name: "Hide Sidebar" }));
    expect(pane()).toHaveAttribute("data-collapsed");
    // A search shows the pages found in the sidebar, although it is hidden.
    await user.type(field(), "bell");
    expect(pane()).not.toHaveAttribute("data-collapsed");
    await user.clear(field());
    expect(pane()).toHaveAttribute("data-collapsed");
    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Thumbnails" }));
    expect(pane()).not.toHaveAttribute("data-collapsed");
  });

  it("highlights the text found in the colour chosen, or not at all", async () => {
    const user = userEvent.setup();
    render(<Preview defaultQuery="pilot" />);
    expect(canvas()).toHaveAttribute("data-highlight", "green");
    await user.click(screen.getByRole("button", { name: "Stop Highlighting" }));
    expect(canvas()).not.toHaveAttribute("data-highlight");
    // The text found stays marked for assistive technology; only its colour goes.
    expect(marks()).toHaveLength(14);
    await user.click(screen.getByRole("button", { name: "Highlight Color" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Pink" }));
    expect(canvas()).toHaveAttribute("data-highlight", "pink");
    expect(screen.getByRole("button", { name: "Stop Highlighting" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Highlight Color" }));
    await user.click(await screen.findByRole("menuitem", { name: "No Highlight" }));
    expect(canvas()).not.toHaveAttribute("data-highlight");
    expect(screen.getByRole("button", { name: "Highlight" })).toBeInTheDocument();
  });

  it("shows the markup bar while its button is on, and keeps the tool chosen", async () => {
    const user = userEvent.setup();
    render(<Preview />);
    const button = screen.getByRole("button", { name: "Show Markup Toolbar" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("toolbar", { name: "Markup" })).not.toBeInTheDocument();
    await user.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    const markup = screen.getByRole("toolbar", { name: "Markup" });
    expect(within(markup).getByRole("button", { name: "Sketch" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(markup).getByRole("button", { name: "Text" }));
    expect(within(markup).getByRole("button", { name: "Text" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(markup).getByRole("button", { name: "Sketch" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(button);
    expect(screen.queryByRole("toolbar", { name: "Markup" })).not.toBeInTheDocument();
  });

  it("tells the caller which service of the Share menu was chosen", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(<Preview onShare={onShare} />);
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Messages" }));
    expect(onShare).toHaveBeenCalledExactlyOnceWith("messages");
  });

  it("shows an image without pages, sidebar or highlighting", async () => {
    const user = userEvent.setup();
    render(<Preview document={desktopPicture} />);
    expect(frame()).toHaveAccessibleName("Desktop");
    expect(frame().querySelector(".mac-preview-sidebar")).toHaveAttribute("data-collapsed");
    expect(
      within(view()).getByRole("img", {
        name: "A turquoise bay with rocky islands at sunrise",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Highlight Color" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Searching an image finds nothing and opens no find bar.
    await user.type(field(), "ring");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(frame().querySelector(".mac-preview-sidebar")).toHaveAttribute("data-collapsed");
    // Its thumbnail is the one row of the sidebar.
    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Thumbnails" }));
    expect(names()).toEqual(["Desktop"]);
    expect(canvas().style.getPropertyValue("--mac-preview-aspect")).toBe("1.6");
  });

  it("shows a document of its caller's", () => {
    const notes: PreviewPdfDocument = {
      kind: "pdf",
      name: "Notes.pdf",
      pages: [
        { heading: "One", text: ["The first page."] },
        { section: "Part 2", title: "Two", heading: "Second", text: ["The second page."] },
      ],
    };
    render(<Preview document={notes} defaultPage={2} defaultSidebar="hidden" />);
    expect(frame()).toHaveAccessibleName("Notes.pdf (page 2 of 2)");
    expect(pages()).toHaveLength(2);
    expect(pages()[1]).toHaveTextContent("Part 2");
    expect(frame().querySelector(".mac-preview-sidebar")).toHaveAttribute("data-collapsed");
  });

  it("shows a PDF without pages as an empty document", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <Preview
        document={{ kind: "pdf", name: "Notes.pdf", pages: [] }}
        onPageChange={onPageChange}
      />,
    );
    expect(frame()).toHaveAccessibleName("Notes.pdf");
    expect(within(view()).getByRole("status")).toHaveTextContent("No Pages");
    expect(within(view()).queryByRole("region")).not.toBeInTheDocument();
    expect(within(list()).queryAllByRole("option")).toHaveLength(0);
    // Nothing is found in it, and nothing scrolled moves a page.
    await user.type(field(), "a");
    expect(screen.getByText("Not found")).toBeInTheDocument();
    fireEvent.scroll(view());
    expect(onPageChange).not.toHaveBeenCalled();
    expect(frame()).toHaveAccessibleName("Notes.pdf");
  });

  it("is a window: it takes the window's props and hands on the controls' and the title bar's", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Preview
        ref={ref}
        state="inactive"
        width={900}
        height={600}
        className="mine"
        data-testid="window"
        style={{ left: 10 }}
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const root = screen.getByTestId("window");
    expect(ref.current).toBe(root);
    expect(root).toHaveClass("mac-window", "mac-preview", "mine");
    expect(root).toHaveAttribute("data-window-state", "inactive");
    expect(root).toHaveStyle({ width: "900px", height: "600px", left: "10px" });
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    await user.click(screen.getByRole("button", { name: /Zoom$|Full Screen/ }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onMinimize).toHaveBeenCalledOnce();
    expect(onZoom).toHaveBeenCalledOnce();
    const bar = root.querySelector(".mac-title-bar") as HTMLElement;
    fireEvent.pointerDown(bar, { button: 0 });
    fireEvent.doubleClick(bar);
    expect(onDragRegionPointerDown).toHaveBeenCalledOnce();
    expect(onDragRegionDoubleClick).toHaveBeenCalledOnce();
    // A press on a control of the toolbar is the control's.
    fireEvent.pointerDown(screen.getByRole("button", { name: "Rotate Left" }), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledOnce();
  });
});

describe("the booklet and its search", () => {
  it("finds text in any letter case, with the number of matches and the sentence", () => {
    const found = searchDocument(islandFerry, "PILOT");
    expect(found.map((result) => [result.page, result.count])).toEqual([
      [9, 1],
      [13, 1],
      [14, 1],
      [17, 4],
      [18, 1],
      [19, 1],
      [21, 5],
    ]);
    expect(found[1]?.snippet).toMatch(/^Her builders sent a pilot/);
    expect(searchDocument(islandFerry, "pilot", "rank").map((result) => result.page)).toEqual([
      21, 17, 9, 13, 14, 18, 19,
    ]);
    expect(searchDocument(islandFerry, "   ")).toEqual([]);
    // Titles, section lines and headings are searched too.
    expect(searchDocument(islandFerry, "fog & bells").map((result) => result.page)).toEqual([9]);
  });

  it("cuts a string at the matches", () => {
    expect(splitMatches("A pilot, the Pilot.", "pilot")).toEqual([
      "A ",
      "pilot",
      ", the ",
      "Pilot",
      ".",
    ]);
    expect(splitMatches("nothing here", "pilot")).toEqual(["nothing here"]);
    expect(splitMatches("anything", "")).toEqual(["anything"]);
    // A letter whose lowercase form is longer does not move the matches after it.
    expect(splitMatches("İİİ pilot, İ Pilot", "pilot")).toEqual([
      "İİİ ",
      "pilot",
      ", İ ",
      "Pilot",
      "",
    ]);
    // What is searched for is text, not a pattern.
    expect(splitMatches("a.c abc (x)", "a.c")).toEqual(["", "a.c", " abc (x)"]);
    expect(splitMatches("a.c abc (x)", "(x)")).toEqual(["a.c abc ", "(x)", ""]);
  });

  it("searches what a page shows: a section line only with the title it belongs to", () => {
    const pdf: PreviewPdfDocument = {
      kind: "pdf",
      name: "Notes.pdf",
      pages: [
        { section: "Appendix", heading: "One", text: ["İzmir. The second sentence has a ferry."] },
        { section: "Appendix", title: "Two", heading: "Second", text: ["Nothing."] },
      ],
    };
    expect(searchDocument(pdf, "appendix").map((result) => result.page)).toEqual([2]);
    expect(searchDocument(pdf, "ferry")[0]?.snippet).toBe("The second sentence has a ferry.");
  });
});

describe("the app descriptor", () => {
  it("is what the desktop hosts", () => {
    expect(app).toBe(previewApp);
    expect(isDesktopApp(app)).toBe(true);
    expect(app.id).toBe("preview");
    expect(app.component).toBe(PreviewApp);
    expect(app.defaultSize).toEqual({ width: 1147, height: 793 });
    expect(app.menus[0]).toBe("Preview");
  });
});
