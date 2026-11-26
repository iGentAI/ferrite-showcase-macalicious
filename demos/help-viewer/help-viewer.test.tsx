import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopAppMenuItems } from "../desktop/desktop-app-menus";
import { app, helpViewerApp } from "./app";
import { HelpViewer, type HelpViewerProps } from "./help-viewer";
import {
  CAPTURED_COUNT,
  CAPTURED_QUERY,
  darkRanking,
  findTopic,
  lightRanking,
  searchHelp,
  sections,
  topics,
} from "./help-viewer-data";

const frame = () => screen.getByRole("region", { name: "macOS User Guide" });
const button = (name: string) => screen.getByRole("button", { name });
const search = () => screen.getByRole("searchbox", { name: "Search" });
const contents = () => screen.queryByRole("treegrid", { name: "Table of Contents" });
/** The titles in the table of contents, in order: the entries and the topics of expanded ones. */
const rows = () =>
  within(contents() as HTMLElement)
    .getAllByRole("row")
    .map((row) => row.textContent);
const row = (title: string) =>
  within(contents() as HTMLElement)
    .getAllByRole("row")
    .find((candidate) => candidate.textContent === title) as HTMLElement;
/** The title of the page that is shown. */
const page = () => screen.getByRole("heading", { level: 1 }).textContent;
/** The titles of the listed search results, in order. */
const results = () =>
  [...frame().querySelectorAll(".mac-help-viewer-result-title")].map((title) => title.textContent);
const result = (title: string) =>
  screen.getAllByRole("link").find((link) => link.textContent?.startsWith(title)) as HTMLElement;
/** A toolbar keeps a disabled item reachable, so it says that it is with aria-disabled. */
const unavailable = (name: string) => button(name).getAttribute("aria-disabled") === "true";
/** The title bar with its toolbar: the window's drag region. */
const bar = () => frame().querySelector("[data-window-drag-region]") as HTMLElement;

/**
 * The table of contents renders the rows in view only, and the test environment lays nothing
 * out: give every element the height the list has in the captured window.
 */
function renderViewer(props: HelpViewerProps = {}) {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(673);
  return render(<HelpViewer {...props} />);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HelpViewer", () => {
  it("opens as the Aqua capture: the welcome page with the table of contents beside it", () => {
    renderViewer();
    expect(frame()).toHaveClass("mac-window", "mac-help-viewer");
    expect(frame()).toHaveAttribute("data-variant", "panel");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame()).toHaveStyle({ width: "877px", height: "722px" });

    expect(rows()).toEqual([
      "Welcome",
      "Basics",
      "Apps",
      "Customize your Mac",
      "Files and folders",
      "Apple ID and iCloud",
      "Use Apple devices together",
      "Music, books, news, and more",
      "Privacy and security",
      "Mac hardware",
      "Resources for your Mac",
      "Resources for your Apple devices",
    ]);
    expect(row("Welcome")).toHaveAttribute("aria-selected", "true");
    // Basics to Mac hardware have a disclosure triangle; Welcome and the last two have none.
    expect(row("Basics")).toHaveAttribute("aria-expanded", "false");
    expect(row("Mac hardware")).toHaveAttribute("aria-expanded", "false");
    expect(row("Welcome")).not.toHaveAttribute("aria-expanded");
    expect(row("Resources for your Mac")).not.toHaveAttribute("aria-expanded");

    expect(page()).toBe("macOS User Guide");
    expect(screen.getByText("for macOS 10.15")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Do more on the desktop");

    // The history has one page: neither direction is available. The other items are.
    expect(unavailable("Back")).toBe(true);
    expect(unavailable("Forward")).toBe(true);
    expect(unavailable("Hide Table of Contents")).toBe(false);
    expect(unavailable("Share")).toBe(false);
    expect(search()).toHaveValue("");
  });

  it("shows and hides the table of contents from the toolbar and from the welcome page", async () => {
    const user = userEvent.setup();
    renderViewer();
    const divider = screen.getByRole("separator", { name: "Resize the table of contents" });

    await user.click(button("Hide Table of Contents"));
    expect(contents()).toBeNull();
    // The collapsed pane leaves its divider, as the Dark Aqua capture has it.
    expect(divider).toBeInTheDocument();
    expect(divider.previousElementSibling).toHaveAttribute("data-collapsed");
    expect(page()).toBe("macOS User Guide");

    await user.click(button("Show Table of Contents"));
    expect(rows()).toHaveLength(12);

    const link = screen.getByRole("button", { name: "Table of Contents" });
    expect(link).toHaveAttribute("aria-expanded", "true");
    await user.click(link);
    expect(contents()).toBeNull();
    expect(link).toHaveAttribute("aria-expanded", "false");
    await user.click(link);
    expect(contents()).not.toBeNull();
  });

  it("starts without the table of contents when it is told to", () => {
    renderViewer({ defaultSidebarOpen: false });
    expect(contents()).toBeNull();
    expect(button("Show Table of Contents")).toBeInTheDocument();
    expect(page()).toBe("macOS User Guide");
  });

  it("shows a section's topics under its triangle and the page of the chosen row", async () => {
    const user = userEvent.setup();
    renderViewer();

    await user.click(row("Basics").querySelector("button.mac-outline-view-triangle") as Element);
    expect(row("Basics")).toHaveAttribute("aria-expanded", "true");
    expect(rows().slice(1, 5)).toEqual([
      "Basics",
      "Get to know the desktop",
      "Use the Dock",
      "Find things with Spotlight",
    ]);
    // The triangle does not choose its row.
    expect(page()).toBe("macOS User Guide");

    await user.click(row("Use the Dock"));
    expect(page()).toBe("Use the Dock");
    expect(row("Use the Dock")).toHaveAttribute("aria-selected", "true");
    expect(row("Welcome")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText(findTopic("use-the-dock")?.summary ?? "")).toBeInTheDocument();

    // An entry has a page of its own, which lists its topics as links.
    await user.click(row("Apps"));
    expect(page()).toBe("Apps");
    await user.click(screen.getByRole("link", { name: "Quit apps" }));
    expect(page()).toBe("Quit apps");
    // The topic's section is expanded, so its row is there to be marked.
    expect(row("Apps")).toHaveAttribute("aria-expanded", "true");
    expect(row("Quit apps")).toHaveAttribute("aria-selected", "true");

    // The keyboard expands and collapses the selected entry.
    await user.click(row("Mac hardware"));
    await user.keyboard("{ArrowRight}");
    expect(rows()).toContain("Connect a display");
    await user.keyboard("{ArrowLeft}");
    expect(rows()).not.toContain("Connect a display");
  });

  it("walks the history with Back and Forward, which are unavailable at its ends", async () => {
    const user = userEvent.setup();
    renderViewer();
    await user.click(row("Apps"));
    await user.click(row("Mac hardware"));
    expect(unavailable("Back")).toBe(false);
    expect(unavailable("Forward")).toBe(true);

    await user.click(button("Back"));
    expect(page()).toBe("Apps");
    expect(row("Apps")).toHaveAttribute("aria-selected", "true");
    expect(unavailable("Forward")).toBe(false);

    await user.click(button("Back"));
    expect(page()).toBe("macOS User Guide");
    expect(unavailable("Back")).toBe(true);

    await user.click(button("Forward"));
    await user.click(button("Forward"));
    expect(page()).toBe("Mac hardware");
    expect(unavailable("Forward")).toBe(true);

    // A page opened from the middle of the history drops what lay ahead.
    await user.click(button("Back"));
    await user.click(row("Basics"));
    expect(page()).toBe("Basics");
    expect(unavailable("Forward")).toBe(true);
  });

  it("lists the topics that mention the typed text, six at first and all on request", async () => {
    const user = userEvent.setup();
    renderViewer();
    await user.type(search(), "file");

    expect(page()).toBe("All Help");
    expect(screen.getByRole("status")).toHaveTextContent(`(${CAPTURED_COUNT} results)`);
    // The order of the Aqua capture, with its descriptions.
    expect(results()).toEqual([
      "Change FileVault preferences on Mac",
      "How does FileVault encryption work on a Mac?",
      "If you don’t have permission to open a file or folder on Mac",
      "Turn off FileVault encryption on Mac",
      "Share a document as a PDF file on Mac",
      "If you can’t move or copy a file or folder on Mac",
    ]);
    expect(result("Change FileVault preferences on Mac")).toHaveTextContent(
      "Use FileVault to protect the information on your Mac by encrypting it.",
    );
    // The results take the window: no table of contents, and nothing to show, hide or share.
    expect(contents()).toBeNull();
    expect(screen.queryByRole("separator", { name: /table of contents/ })).toBeNull();
    expect(unavailable("Hide Table of Contents")).toBe(true);
    expect(unavailable("Share")).toBe(true);
    // The search is a step of the history.
    expect(unavailable("Back")).toBe(false);
    expect(unavailable("Forward")).toBe(true);

    await user.click(button("Show all"));
    expect(results()).toHaveLength(CAPTURED_COUNT);
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
    // The button is gone: the first result it added has the focus.
    expect(screen.getAllByRole("link")[6]).toHaveFocus();

    // More text narrows the list within the same step.
    await user.type(search(), "vault");
    expect(search()).toHaveValue("filevault");
    expect(screen.getByRole("status")).toHaveTextContent("(4 results)");
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
    await user.click(button("Back"));
    expect(page()).toBe("macOS User Guide");
  });

  it("starts the results of another search at their top, and a followed link's page with the focus", async () => {
    const user = userEvent.setup();
    renderViewer();
    const viewport = () => frame().querySelector(".mac-help-viewer-scroll [data-id]");
    await user.type(search(), "file");
    const first = viewport();
    expect(first).not.toBeNull();

    // Show all adds to the list that is being read: the same view, where it was.
    await user.click(button("Show all"));
    expect(viewport()).toBe(first);
    // Another search is another list, shown from its top.
    await user.type(search(), "vault");
    expect(viewport()).not.toBe(first);

    // A result's link is gone with the results: the page it leads to has the focus.
    await user.click(result("Change FileVault preferences on Mac"));
    expect(page()).toBe("Change FileVault preferences on Mac");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    // Back and Forward keep the focus where the keyboard is: on the control that was used,
    // and not on the title of the page or the results they lead to.
    await user.click(button("Back"));
    expect(screen.getByRole("status")).toHaveTextContent("(4 results)");
    expect(button("Back")).toHaveFocus();
    await user.click(button("Forward"));
    expect(page()).toBe("Change FileVault preferences on Mac");
    expect(button("Forward")).toHaveFocus();
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveFocus();
  });

  it("says so when nothing mentions the text", async () => {
    const user = userEvent.setup();
    renderViewer();
    await user.type(search(), "zzz");
    expect(screen.getByRole("status")).toHaveTextContent("(0 results)");
    expect(screen.getByText("No Results")).toBeInTheDocument();
    expect(results()).toEqual([]);
  });

  it("opens the topic of a chosen result, and returns to the results with Back", async () => {
    const user = userEvent.setup();
    renderViewer();
    await user.type(search(), "dock");
    expect(results()).toEqual(["Get to know the desktop", "Use the Dock", "Open apps"]);

    await user.click(result("Use the Dock"));
    expect(page()).toBe("Use the Dock");
    // The field holds the text of the search that is shown: none, on a page.
    expect(search()).toHaveValue("");
    expect(row("Use the Dock")).toHaveAttribute("aria-selected", "true");

    await user.click(button("Back"));
    expect(page()).toBe("All Help");
    expect(search()).toHaveValue("dock");
    await user.click(button("Forward"));
    expect(page()).toBe("Use the Dock");
  });

  it("returns to the page that was shown when the field is cleared", async () => {
    const user = userEvent.setup();
    renderViewer();
    await user.click(row("Apps"));
    await user.type(search(), "music");
    expect(page()).toBe("All Help");

    await user.clear(search());
    expect(page()).toBe("Apps");
    expect(row("Apps")).toHaveAttribute("aria-selected", "true");
    // The search is gone from the history: Apps is its last page again.
    expect(unavailable("Forward")).toBe(true);
    await user.click(button("Back"));
    expect(page()).toBe("macOS User Guide");

    // Spaces alone are no search.
    await user.type(search(), "   ");
    expect(page()).toBe("macOS User Guide");
    expect(unavailable("Forward")).toBe(false);
  });

  it("clears the search with Escape and with the field's clear button", async () => {
    const user = userEvent.setup();
    renderViewer();
    await user.type(search(), "music");
    expect(page()).toBe("All Help");
    await user.keyboard("{Escape}");
    expect(page()).toBe("macOS User Guide");
    expect(search()).toHaveValue("");
    expect(unavailable("Back")).toBe(true);

    await user.type(search(), "books");
    expect(page()).toBe("All Help");
    await user.click(button("Clear"));
    expect(page()).toBe("macOS User Guide");
    expect(search()).toHaveValue("");
  });

  it("starts on the results of a search, in the order it is given", async () => {
    const user = userEvent.setup();
    renderViewer({ defaultQuery: CAPTURED_QUERY, searchRanking: darkRanking });
    expect(search()).toHaveValue("File");
    expect(screen.getByRole("status")).toHaveTextContent("(558 results)");
    // The order of the Dark Aqua capture.
    expect(results()).toEqual([
      "If you can’t move or copy a file or folder on Mac",
      "Encrypt Mac data with FileVault",
      "Choose an app to open a file on Mac",
      "Share a document as a PDF file on Mac",
      "If you don’t have permission to open a file or folder on Mac",
      "Turn off FileVault encryption on Mac",
    ]);
    // As captured: Back leads to the welcome page, and there is nothing ahead.
    expect(unavailable("Back")).toBe(false);
    expect(unavailable("Forward")).toBe(true);
    await user.click(button("Back"));
    expect(page()).toBe("macOS User Guide");
    expect(search()).toHaveValue("");
  });

  it("opens the Share menu: a help page has no web address, so every service is dimmed and the menu says why", async () => {
    const user = userEvent.setup();
    renderViewer();
    await user.click(button("Share"));
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Mail",
      "Messages",
      "Notes",
      "Reminders",
      "Add to Reading List",
      "AirDrop",
      "There is no web address to share.",
    ]);
    // No service is offered that would send nothing: each is dimmed, and the last row says why.
    for (const item of items) expect(item).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(page()).toBe("macOS User Guide");
  });

  it("passes the window's props to the window", () => {
    const ref = createRef<HTMLDivElement>();
    renderViewer({
      ref,
      state: "inactive",
      width: 700,
      height: 500,
      className: "mine",
      style: { left: 12 },
    });
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-help-viewer", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveStyle({ width: "700px", height: "500px", left: "12px" });
  });

  it("hands the window controls their callbacks and states", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const { rerender } = renderViewer({ onClose, onMinimize, onZoom, zoomRole: "zoom" });
    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Zoom"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
    // The window controls' props are not attributes of the window.
    expect(frame()).not.toHaveAttribute("zoomrole");

    rerender(<HelpViewer minimizeDisabled zoomDisabled />);
    expect(button("Minimize")).toBeDisabled();
    expect(button("Enter Full Screen")).toBeDisabled();
    expect(button("Close")).toBeEnabled();
  });

  it("reports a press and a double click on the title bar, its drag region", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    renderViewer({ onDragRegionPointerDown, onDragRegionDoubleClick });
    expect(bar()).toContainElement(button("Share"));

    fireEvent.pointerDown(bar(), { button: 2 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar(), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    // The toolbar's controls and the content are not part of the drag region.
    fireEvent.pointerDown(button("Share"), { button: 0 });
    fireEvent.pointerDown(search(), { button: 0 });
    fireEvent.pointerDown(screen.getByRole("heading", { level: 1 }), { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(bar());
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(673);
    expect(app).toBe(helpViewerApp);
    expect(app).toMatchObject({
      id: "help-viewer",
      name: "Help Viewer",
      component: HelpViewer,
      defaultSize: { width: 877, height: 722 },
      minSize: { width: 540, height: 300 },
      resizable: true,
    });
    expect(app.menus).toEqual(["Help Viewer", "File", "Edit", "View", "Go", "Window", "Help"]);

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
    expect(host).toHaveAttribute("data-window-id", "help-viewer");
    expect(host).toHaveStyle({ width: "877px", height: "722px" });
    // The manager sizes the wrapper; the window fills it.
    expect(frame()).toHaveStyle({ width: "100%", height: "100%" });
    expect(frame()).toHaveAttribute("data-window-state", "key");

    // The manager moves the window by its title bar.
    const before = host.style.transform;
    fireEvent.pointerDown(bar(), { button: 0, pointerId: 1, clientX: 300, clientY: 8 });
    fireEvent.pointerMove(bar(), { pointerId: 1, clientX: 340, clientY: 40 });
    fireEvent.pointerUp(bar(), { pointerId: 1, clientX: 340, clientY: 40 });
    expect(host.style.transform).not.toBe(before);

    // The app still works in there.
    await user.click(row("Apps"));
    expect(page()).toBe("Apps");

    await user.click(button("Close"));
    expect(screen.queryByRole("region", { name: "macOS User Guide" })).toBeNull();
  });
});

describe("the guide's data", () => {
  it("finds the captured number of topics for the captured search", () => {
    expect(searchHelp(CAPTURED_QUERY)).toHaveLength(CAPTURED_COUNT);
    // Whatever the case, and not for text that is only spaces.
    expect(searchHelp("FILE")).toHaveLength(CAPTURED_COUNT);
    expect(searchHelp("  ")).toEqual([]);
  });

  it("ranks a search by the ranking and keeps the order of the index after it", () => {
    const light = searchHelp(CAPTURED_QUERY, lightRanking).map((topic) => topic.id);
    const dark = searchHelp(CAPTURED_QUERY, darkRanking).map((topic) => topic.id);
    expect(light.slice(0, 6)).toEqual(lightRanking);
    expect(dark.slice(0, 6)).toEqual(darkRanking);
    expect(new Set(dark)).toEqual(new Set(light));
    // A ranked topic that does not mention the text is not listed.
    expect(searchHelp("dock", lightRanking).map((topic) => topic.title)).toEqual([
      "Get to know the desktop",
      "Use the Dock",
      "Open apps",
    ]);
  });

  it("gives every page an id of its own, and ranks only topics that exist", () => {
    const ids = [...sections.map((section) => section.id), ...topics.map((topic) => topic.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [...lightRanking, ...darkRanking]) expect(findTopic(id)).toBeDefined();
  });
});

/** The Edit menu as the menu bar shows it: its popup mounts, and reads the keyboard, as it opens. */
function EditMenu() {
  const items = useDesktopAppMenuItems("help-viewer", "Edit");
  return (
    <Menu>
      <MenuTrigger>Open Edit</MenuTrigger>
      <MenuPopup aria-label="Edit">{items}</MenuPopup>
    </Menu>
  );
}
const editRow = async (name: string) => {
  fireEvent.click(screen.getByRole("button", { name: "Open Edit" }));
  return screen.findByRole("menuitem", { name: new RegExp(`^${name}`) });
};
const closeEdit = async () => {
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
};

describe("Help Viewer's Edit menu", () => {
  const opened = () =>
    render(
      <>
        <HelpViewer />
        <EditMenu />
      </>,
    );

  it("has every standard row, and with no field and no selection says why they are dimmed", async () => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(673);
    opened();
    document.getSelection()?.removeAllRanges();
    await editRow("Undo");
    for (const name of ["Undo", "Redo", "Cut", "Copy", "Paste"]) {
      const row = screen.getByRole("menuitem", { name: new RegExp(`^${name}`) });
      expect(row).toHaveAttribute("aria-disabled", "true");
      expect(row).toHaveAttribute(
        "title",
        "Click in the search field, or select text on the page, first.",
      );
    }
    expect(screen.getByRole("menuitem", { name: /^Select All/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await closeEdit();
  });

  it("acts on the search field that has the keyboard", async () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(673);
    opened();
    const field = search() as HTMLInputElement;
    fireEvent.change(field, { target: { value: "wifi" } });
    act(() => field.focus());
    field.setSelectionRange(0, 2);
    const cut = await editRow("Cut");
    expect(cut).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(cut);
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("cut"));
    act(() => field.blur());
  });

  it("selects the page's words with Select All where no field has the keyboard", async () => {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(673);
    opened();
    act(() => search().blur());
    fireEvent.click(await editRow("Select All"));
    await waitFor(() => expect(document.getSelection()?.toString()).toContain("macOS User Guide"));
    const copy = await editRow("Copy");
    expect(copy).not.toHaveAttribute("aria-disabled", "true");
    await closeEdit();
    document.getSelection()?.removeAllRanges();
  });

  it("keeps the page's selection for Copy when a press on the menu bar lets go of it", async () => {
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(673);
    opened();
    act(() => search().blur());
    fireEvent.click(await editRow("Select All"));
    await waitFor(() => expect(document.getSelection()?.toString()).toContain("macOS User Guide"));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    act(() => document.getSelection()?.removeAllRanges());
    await act(async () => {});
    const copy = await editRow("Copy");
    expect(copy).not.toHaveAttribute("aria-disabled", "true");
    act(() => document.getSelection()?.removeAllRanges());
    let copied = "";
    execCommand.mockImplementationOnce(() => {
      copied = document.getSelection()?.toString() ?? "";
      return true;
    });
    fireEvent.click(copy);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copied).toContain("macOS User Guide");
    document.getSelection()?.removeAllRanges();
  });
});
