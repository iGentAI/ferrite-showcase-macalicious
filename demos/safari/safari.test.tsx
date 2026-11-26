import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { changeDesktopValue } from "../desktop/desktop-personal";
import Desktop from "./examples/desktop";
import { Safari } from "./safari";
import { addressFor } from "./safari-pages";
import { SafariPreferences } from "./safari-preferences";
import { SAFARI_SETTINGS } from "./safari-settings";

const field = () => screen.getByRole("textbox", { name: "Search or enter website name" });
const tab = (name: string) => screen.getByRole("tab", { name });
const button = (name: string) => screen.getByRole("button", { name });
const heading = (name: string) => screen.queryByRole("heading", { level: 1, name });
// A disabled toolbar item stays focusable, so it is disabled for assistive technology only.
const unavailable = (name: string) => expect(button(name)).toHaveAttribute("aria-disabled", "true");

/** Type in the address field and press Return. */
async function go(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(field());
  await user.clear(field());
  await user.type(field(), `${text}{Enter}`);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Safari", () => {
  it("opens with three tabs, the middle one in front, and its address in the field", () => {
    render(<Safari />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(tab("About – Field Notes")).toHaveAttribute("aria-selected", "true");
    expect(field()).toHaveValue("https://fieldnotes.example/about");
    expect(heading("About")).toBeInTheDocument();
  });

  it("shows another tab's page and address when the tab is clicked", async () => {
    const user = userEvent.setup();
    render(<Safari />);
    await user.click(tab("Harbor Radio"));
    expect(tab("Harbor Radio")).toHaveAttribute("aria-selected", "true");
    expect(field()).toHaveValue("https://harbor.example/");
    expect(heading("About Harbor Radio")).toBeInTheDocument();
    expect(heading("About")).not.toBeInTheDocument();
  });

  it("opens a new tab on the start page and closes a tab with Delete", async () => {
    const user = userEvent.setup();
    render(<Safari />);
    await user.click(button("New Tab"));
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(tab("Favorites")).toHaveAttribute("aria-selected", "true");
    expect(field()).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Favorites" })).toBeInTheDocument();

    fireEvent.keyDown(tab("Favorites"), { key: "Delete" });
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.queryByRole("tab", { name: "Favorites" })).not.toBeInTheDocument();
    // The tab that takes the closed one's place comes to the front.
    expect(tab("Harbor Radio")).toHaveAttribute("aria-selected", "true");
  });

  it("hides the tab bar while one tab is open", () => {
    render(<Safari defaultTabs={[""]} />);
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("loads a typed address, and walks the tab's history with Back and Forward", async () => {
    const user = userEvent.setup();
    render(<Safari />);
    unavailable("Back");
    await go(user, "orchard.example");
    expect(field()).toHaveValue("https://orchard.example");
    expect(tab("Orchard")).toHaveAttribute("aria-selected", "true");
    expect(heading("Orchard")).toBeInTheDocument();
    unavailable("Forward");

    await user.click(button("Back"));
    expect(heading("About")).toBeInTheDocument();
    expect(field()).toHaveValue("https://fieldnotes.example/about");
    unavailable("Back");

    await user.click(button("Forward"));
    expect(heading("Orchard")).toBeInTheDocument();
  });

  it("searches the demo's pages for words typed in the field", async () => {
    const user = userEvent.setup();
    render(<Safari />);
    await go(user, "radio");
    expect(heading("Results for “radio”")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Harbor Radio" }));
    expect(heading("About Harbor Radio")).toBeInTheDocument();
    expect(field()).toHaveValue("https://harbor.example/");
  });

  it("shows an error page for an address outside the demo", async () => {
    const user = userEvent.setup();
    render(<Safari />);
    await go(user, "example.com");
    expect(screen.getByRole("heading", { name: "Safari Can’t Open the Page" })).toBeVisible();
    expect(tab("Failed to open page")).toHaveAttribute("aria-selected", "true");
    // A page that did not load has no Reader form.
    expect(screen.queryByRole("button", { name: "Show Reader View" })).not.toBeInTheDocument();
  });

  it("puts the address back when editing is cancelled with Escape", async () => {
    const user = userEvent.setup();
    render(<Safari />);
    await user.click(field());
    await user.clear(field());
    await user.type(field(), "half an addr{Escape}");
    expect(field()).toHaveValue("https://fieldnotes.example/about");
    expect(heading("About")).toBeInTheDocument();
  });

  it("opens a favourite from the start page", async () => {
    const user = userEvent.setup();
    render(<Safari defaultTabs={[""]} />);
    await user.click(screen.getByRole("link", { name: "Lantern" }));
    expect(heading("Lantern")).toBeInTheDocument();
    expect(field()).toHaveValue("https://lantern.example/");
  });

  it("opens the Bookmarks sidebar from a folder of favourites and from the toolbar", async () => {
    const user = userEvent.setup();
    render(<Safari defaultTabs={[""]} />);
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    await user.click(button("News 16 Websites"));
    expect(screen.getByRole("tree", { name: "Bookmarks" })).toBeInTheDocument();
    await user.click(button("Hide Sidebar"));
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
    await user.click(button("Show Sidebar"));
    expect(screen.getByRole("tree", { name: "Bookmarks" })).toBeInTheDocument();

    // A folder of favourites shows Bookmarks, whichever list the sidebar showed last.
    await user.click(button("Reading List"));
    await user.click(button("Hide Sidebar"));
    await user.click(button("Popular 8 Websites"));
    expect(screen.getByRole("tree", { name: "Bookmarks" })).toBeInTheDocument();
  });

  it("loads a bookmark chosen in the sidebar, and switches to the Reading List", async () => {
    const user = userEvent.setup();
    render(<Safari defaultTabs={[""]} defaultSidebarOpen />);
    const bookmarks = screen.getByRole("tree", { name: "Bookmarks" });
    await user.click(within(bookmarks).getByRole("treeitem", { name: "Coast Courier" }));
    expect(heading("Courier")).toBeInTheDocument();
    expect(field()).toHaveValue("https://courier.example/");

    await user.click(button("Reading List"));
    const readingList = screen.getByRole("tree", { name: "Reading List" });
    await user.click(within(readingList).getByRole("treeitem", { name: "About Harbor Radio" }));
    expect(heading("About Harbor Radio")).toBeInTheDocument();
  });

  it("switches a page to Reader and back, and leaves Reader when the tab navigates", async () => {
    const user = userEvent.setup();
    render(<Safari />);
    await user.click(button("Show Reader View"));
    expect(screen.getByRole("region", { name: "Reader: About – Field Notes" })).toBeVisible();
    expect(screen.getByRole("article")).toContainElement(heading("About"));
    // The site's own navigation is not part of the article, and Reload gives way to text size.
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reload this page" })).not.toBeInTheDocument();
    expect(button("Hide Reader View")).toHaveAttribute("aria-pressed", "true");

    await user.click(button("Hide Reader View"));
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();

    await user.click(button("Show Reader View"));
    await go(user, "https://harbor.example/");
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("changes the Reader's text size", async () => {
    const user = userEvent.setup();
    render(<Safari defaultActiveTab={2} defaultReader />);
    const article = screen.getByRole("article");
    const before = article.style.fontSize;
    await user.click(button("Change Reader text size"));
    expect(article.style.fontSize).not.toBe(before);
  });

  it("offers no Reader on the start page", () => {
    render(<Safari defaultTabs={[""]} defaultReader />);
    expect(screen.queryByRole("button", { name: /Reader View/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("shows every tab in the Tab Overview and brings the chosen one to the front", async () => {
    const user = userEvent.setup();
    render(<Safari />);
    await user.click(button("Show Tab Overview"));
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    const overview = screen.getByRole("group", { name: "Open tabs" });
    expect(within(overview).getAllByRole("button")).toHaveLength(4);
    expect(within(overview).getByRole("button", { name: "About – Field Notes" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(field()).toHaveValue("");
    unavailable("Back");

    await user.click(within(overview).getByRole("button", { name: "Lookup" }));
    expect(screen.queryByRole("group", { name: "Open tabs" })).not.toBeInTheDocument();
    expect(tab("Lookup")).toHaveAttribute("aria-selected", "true");
    expect(field()).toHaveValue("https://lookup.example/");
  });

  it("opens a tab from the Tab Overview's new-tab tile, and leaves it from the toolbar", async () => {
    const user = userEvent.setup();
    render(<Safari defaultTabOverview />);
    await user.click(button("Hide Tab Overview"));
    expect(tab("About – Field Notes")).toHaveAttribute("aria-selected", "true");

    await user.click(button("Show Tab Overview"));
    const overview = screen.getByRole("group", { name: "Open tabs" });
    await user.click(within(overview).getByRole("button", { name: "New Tab" }));
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(tab("Favorites")).toHaveAttribute("aria-selected", "true");
  });

  it("shows Stop while a page loads and Reload once it has", async () => {
    const user = userEvent.setup();
    render(<Safari />);
    await user.click(button("Reload this page"));
    expect(screen.getByRole("progressbar", { name: "Loading page" })).toBeInTheDocument();
    await user.click(button("Stop loading this page"));
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    await user.click(button("Reload this page"));
    expect(button("Stop loading this page")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(button("Reload this page")).toBeInTheDocument();
  });

  it("is a window a manager can host: state, size, controls and drag region", async () => {
    const user = userEvent.setup();
    const on = {
      close: vi.fn(),
      minimize: vi.fn(),
      zoom: vi.fn(),
      drag: vi.fn(),
      doubleClick: vi.fn(),
    };
    render(
      <Safari
        state="inactive"
        width={900}
        height={500}
        style={{ left: 40 }}
        onClose={on.close}
        onMinimize={on.minimize}
        onZoom={on.zoom}
        onDragRegionPointerDown={on.drag}
        onDragRegionDoubleClick={on.doubleClick}
      />,
    );
    const frame = screen.getByRole("region", { name: "Safari" });
    expect(frame).toHaveClass("mac-window");
    expect(frame).toHaveAttribute("data-window-state", "inactive");
    expect(frame).toHaveStyle({ width: "900px", height: "500px", left: "40px" });

    await user.click(button("Close"));
    await user.click(button("Minimize"));
    await user.click(button("Enter Full Screen"));
    expect(on.close).toHaveBeenCalledTimes(1);
    expect(on.minimize).toHaveBeenCalledTimes(1);
    expect(on.zoom).toHaveBeenCalledTimes(1);

    const toolbar = screen.getByRole("toolbar", { name: "Safari toolbar" });
    fireEvent.pointerDown(toolbar, { button: 0 });
    fireEvent.doubleClick(toolbar);
    expect(on.drag).toHaveBeenCalledTimes(1);
    expect(on.doubleClick).toHaveBeenCalledTimes(1);
    // A press on a control in the toolbar does not move the window.
    fireEvent.pointerDown(button("Show Sidebar"), { button: 0 });
    expect(on.drag).toHaveBeenCalledTimes(1);
  });

  it("shares a loaded page: the Share menu's services, and Add to Reading List", async () => {
    const user = userEvent.setup();
    render(<Safari defaultSidebarOpen />);
    await go(user, "orchard.example");
    await user.click(button("Share"));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(8);
    await user.click(within(menu).getByRole("menuitem", { name: "Add to Reading List" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    // A page that is in the list already is not added again.
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Add to Reading List" }));

    await user.click(button("Reading List"));
    const readingList = screen.getByRole("tree", { name: "Reading List" });
    expect(within(readingList).getAllByRole("treeitem", { name: "Orchard" })).toHaveLength(1);
  });

  it("has nothing to share on the start page", () => {
    render(<Safari defaultTabs={[""]} />);
    unavailable("Share");
  });

  it("does not bookmark a page that a folder of the Bookmarks already holds", async () => {
    const user = userEvent.setup();
    render(<Safari defaultSidebarOpen />);
    const bookmarks = screen.getByRole("tree", { name: "Bookmarks" });
    const rows = () => within(bookmarks).getAllByRole("treeitem").length;
    // Coast Courier is in the News folder; its address is typed without the last slash.
    await go(user, "courier.example");
    const before = rows();
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Add Bookmark" }));
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(rows()).toBe(before);

    // A page that no folder holds is added, at the end of the list.
    await go(user, "quarry.example");
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Add Bookmark" }));
    expect(within(bookmarks).getByRole("treeitem", { name: "Quarry" })).toBeInTheDocument();
    expect(rows()).toBe(before + 1);
  });

  it("loads a bookmark again when it is chosen after the tab went elsewhere", async () => {
    const user = userEvent.setup();
    render(<Safari defaultSidebarOpen />);
    const courier = () =>
      within(screen.getByRole("tree", { name: "Bookmarks" })).getByRole("treeitem", {
        name: "Coast Courier",
      });
    await user.click(courier());
    expect(heading("Courier")).toBeInTheDocument();
    expect(courier()).toHaveAttribute("aria-selected", "true");

    await go(user, "orchard.example");
    expect(heading("Orchard")).toBeInTheDocument();
    // The row is no longer the page in front, so it is not selected and can be chosen again.
    expect(courier()).not.toHaveAttribute("aria-selected", "true");
    await user.click(courier());
    expect(heading("Courier")).toBeInTheDocument();
  });

  it("keeps a tab loading while another tab is in front", () => {
    // The page's load is a timeout; it is faked, so that the load ends when the test says.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    render(<Safari />);
    fireEvent.click(button("Reload this page"));
    expect(screen.getByRole("progressbar", { name: "Loading page" })).toBeInTheDocument();

    // The other tab is not loading; the first one still is when it comes back.
    fireEvent.click(tab("Harbor Radio"));
    expect(tab("Harbor Radio")).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(button("Reload this page")).toBeInTheDocument();
    fireEvent.click(tab("About – Field Notes"));
    expect(screen.getByRole("progressbar", { name: "Loading page" })).toBeInTheDocument();

    // The load ends on its own tab once its time has passed.
    act(() => vi.runOnlyPendingTimers());
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(button("Reload this page")).toBeInTheDocument();
  });

  it("has its new-tab cell in the toolbar while one tab is open, and in the tab bar after", async () => {
    const user = userEvent.setup();
    render(<Safari defaultTabs={["https://harbor.example/"]} />);
    const toolbar = screen.getByRole("toolbar", { name: "Safari toolbar" });
    await user.click(within(toolbar).getByRole("button", { name: "New Tab" }));
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(tab("Favorites")).toHaveAttribute("aria-selected", "true");
    // With two tabs the tab bar has the cell, and the toolbar no longer does.
    expect(within(toolbar).queryByRole("button", { name: "New Tab" })).not.toBeInTheDocument();
    expect(button("New Tab")).toBeInTheDocument();
  });

  it("moves a page's video to Picture in Picture, which outlives a change of tab", async () => {
    const user = userEvent.setup();
    render(<Safari />);
    await go(user, "reel.example");
    expect(screen.queryByRole("group", { name: "Picture in Picture" })).not.toBeInTheDocument();
    await user.click(button("Enter Picture in Picture"));
    const floating = screen.getByRole("group", { name: "Picture in Picture" });
    expect(within(floating).getByRole("img", { name: "Placeholder video" })).toBeInTheDocument();
    expect(screen.getByText("This video is playing in Picture in Picture.")).toBeInTheDocument();

    await user.click(tab("Harbor Radio"));
    expect(screen.getByRole("group", { name: "Picture in Picture" })).toBeInTheDocument();

    // Return to Window brings the video's tab to the front with the video back on its page.
    await user.click(button("Return to Window"));
    expect(screen.queryByRole("group", { name: "Picture in Picture" })).not.toBeInTheDocument();
    expect(tab("Tide Pools at Dawn – Reel")).toHaveAttribute("aria-selected", "true");
    expect(button("Enter Picture in Picture")).toBeInTheDocument();
  });

  it("shows the generated still in the floating video, or the drawing without artwork", () => {
    const tabs = ["https://reel.example/"];
    const video = () =>
      within(screen.getByRole("group", { name: "Picture in Picture" })).getByRole("img", {
        name: "Placeholder video",
      });
    const { unmount } = render(<Safari defaultTabs={tabs} defaultPictureInPicture />);
    expect(video().style.background).toContain("page-reel");
    unmount();

    render(<Safari defaultTabs={tabs} defaultPictureInPicture artwork={false} />);
    expect(video().getAttribute("style")).toBeNull();
    expect(video()).toHaveAttribute("data-tint", "4");
  });

  it("ends Picture in Picture when the video's tab closes or leaves its page", async () => {
    const user = userEvent.setup();
    const tabs = ["https://harbor.example/", "https://reel.example/"];
    render(<Safari defaultTabs={tabs} defaultActiveTab={1} defaultPictureInPicture />);
    expect(screen.getByRole("group", { name: "Picture in Picture" })).toBeInTheDocument();
    await go(user, "orchard.example");
    expect(screen.queryByRole("group", { name: "Picture in Picture" })).not.toBeInTheDocument();

    await user.click(button("Back"));
    await user.click(button("Enter Picture in Picture"));
    fireEvent.keyDown(tab("Tide Pools at Dawn – Reel"), { key: "Delete" });
    expect(screen.queryByRole("group", { name: "Picture in Picture" })).not.toBeInTheDocument();
  });

  it("floats the Picture in Picture window in the screen it is given", () => {
    const screenElement = document.createElement("div");
    document.body.append(screenElement);
    try {
      render(
        <Safari
          defaultTabs={["https://reel.example/"]}
          defaultPictureInPicture
          pictureInPictureContainer={screenElement}
        />,
      );
      const floating = screen.getByRole("group", { name: "Picture in Picture" });
      expect(floating.parentElement).toBe(screenElement);
    } finally {
      screenElement.remove();
    }
  });
});

describe("addressFor", () => {
  it.each([
    ["", ""],
    ["  harbor.example ", "https://harbor.example"],
    ["http://harbor.example/shows", "http://harbor.example/shows"],
    ["harbor radio", "https://lookup.example/search?q=harbor%20radio"],
    ["radio", "https://lookup.example/search?q=radio"],
    ["what is 1.5", "https://lookup.example/search?q=what%20is%201.5"],
  ])("reads %j as %j", (typed, address) => {
    expect(addressFor(typed)).toBe(address);
  });
});

describe("on a desktop", () => {
  const frame = (name: string) => screen.getByRole("region", { name });

  it("is hosted by the window manager, which makes the clicked window key", async () => {
    const user = userEvent.setup();
    render(<Desktop />);
    // The window opened last is in front.
    expect(frame("General")).toHaveAttribute("data-window-state", "key");
    expect(frame("Safari")).not.toHaveAttribute("data-window-state", "key");
    expect(frame("Safari").parentElement).toHaveAttribute("data-window-id", "safari");

    await user.click(within(frame("Safari")).getByRole("tab", { name: "Harbor Radio" }));
    expect(frame("Safari")).toHaveAttribute("data-window-state", "key");
    expect(frame("General")).not.toHaveAttribute("data-window-state", "key");
  });

  it("closes each window from its own close button", async () => {
    const user = userEvent.setup();
    render(<Desktop />);
    await user.click(within(frame("General")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "General" })).not.toBeInTheDocument();
    await user.click(within(frame("Safari")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Safari" })).not.toBeInTheDocument();
  });

  it("gives the manager's frame the height the preferences window has", () => {
    // jsdom has no layout and no ResizeObserver: both are stood in for here.
    const observed: [Element, (entries: unknown[]) => void][] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private notify: (entries: unknown[]) => void) {}
        observe(element: Element) {
          observed.push([element, this.notify]);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    try {
      render(<Desktop />);
      const wrapper = frame("General").parentElement as HTMLElement;
      expect(wrapper.style.height).toBe("508px");
      const watchers = observed.filter(([element]) => element === frame("General"));
      expect(watchers.length).toBeGreaterThan(0);
      Object.defineProperty(frame("General"), "offsetHeight", { configurable: true, value: 212 });
      act(() => {
        for (const [, notify] of watchers) notify([]);
      });
      expect(wrapper.style.height).toBe("212px");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("moves the preferences window by its bar, not by a toolbar item", () => {
    render(<Desktop />);
    const wrapper = frame("General").parentElement as HTMLElement;
    const before = wrapper.style.transform;
    const drag = (from: Element) => {
      fireEvent.pointerDown(from, { button: 0, pointerId: 1, clientX: 300, clientY: 100 });
      fireEvent.pointerMove(frame("General"), { pointerId: 1, clientX: 340, clientY: 130 });
      fireEvent.pointerUp(frame("General"), { pointerId: 1, clientX: 340, clientY: 130 });
    };
    drag(screen.getByRole("tab", { name: "Tabs" }));
    expect(wrapper.style.transform).toBe(before);
    drag(screen.getByRole("tablist", { name: "Safari preferences" }));
    expect(wrapper.style.transform).not.toBe(before);
  });
});

describe("SafariPreferences", () => {
  afterEach(() => changeDesktopValue(SAFARI_SETTINGS, undefined));

  it("opens on General and retitles the window to the pane that is chosen", async () => {
    const user = userEvent.setup();
    render(<SafariPreferences animated={false} />);
    expect(screen.getByRole("region", { name: "General" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(10);
    await user.click(screen.getByRole("tab", { name: "Privacy" }));
    expect(screen.getByRole("region", { name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Prevent cross-site tracking" })).toBeChecked();
    expect(screen.queryByRole("textbox", { name: "Homepage:" })).not.toBeInTheDocument();
  });

  it("has the General pane's eight pop-up buttons, named by their labels, and changes one", async () => {
    const user = userEvent.setup();
    render(<SafariPreferences animated={false} />);
    expect(screen.getAllByRole("combobox")).toHaveLength(8);
    const opens = screen.getByRole("combobox", { name: "New windows open with:" });
    expect(opens).toHaveTextContent("Favorites");
    await user.click(opens);
    await user.click(await screen.findByRole("option", { name: "Homepage" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(opens).toHaveTextContent("Homepage");
    // The row under it has the same choices and keeps its own.
    expect(screen.getByRole("combobox", { name: "New tabs open with:" })).toHaveTextContent(
      "Favorites",
    );
  });

  it("keeps what was chosen in a pane while another pane is shown", async () => {
    const user = userEvent.setup();
    render(<SafariPreferences animated={false} />);
    await user.click(screen.getByRole("combobox", { name: "Top Sites shows:" }));
    await user.click(await screen.findByRole("option", { name: "24 sites" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: "Privacy" }));
    await user.click(screen.getByRole("checkbox", { name: "Block all cookies" }));
    await user.click(screen.getByRole("tab", { name: "General" }));
    expect(screen.getByRole("combobox", { name: "Top Sites shows:" })).toHaveTextContent(
      "24 sites",
    );
    await user.click(screen.getByRole("tab", { name: "Privacy" }));
    expect(screen.getByRole("checkbox", { name: "Block all cookies" })).toBeChecked();
  });

  it("sets the homepage to the browser's current page", async () => {
    const user = userEvent.setup();
    const onHomepageChange = vi.fn();
    render(
      <SafariPreferences
        animated={false}
        currentPage="https://harbor.example/"
        onHomepageChange={onHomepageChange}
      />,
    );
    const homepage = screen.getByRole("textbox", { name: "Homepage:" });
    expect(homepage).toHaveValue("https://start.example/");
    await user.click(button("Set to Current Page"));
    expect(homepage).toHaveValue("https://harbor.example/");
    expect(onHomepageChange).toHaveBeenLastCalledWith("https://harbor.example/");
  });

  it("cannot set the homepage without a current page, and reports its close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SafariPreferences animated={false} onClose={onClose} />);
    expect(button("Set to Current Page")).toBeDisabled();
    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
