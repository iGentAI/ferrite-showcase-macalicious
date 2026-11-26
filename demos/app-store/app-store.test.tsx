import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, appStoreApp } from "./app";
import { AppStore } from "./app-store";
import {
  APPS,
  type AppStoreApp,
  type AppStoreOffers,
  appMatches,
  appsOf,
  CATEGORIES,
  categoryCount,
  DOWNLOAD_INTERVAL,
  PAGES,
  reduceOffers,
  SECTIONS,
} from "./app-store-data";

const frame = () => screen.getByRole("region", { name: "App Store" });
const tree = () => screen.getByRole("tree", { name: "Sections" });
const row = (name: string) => within(tree()).getByRole("treeitem", { name });
const selected = () =>
  within(tree())
    .getAllByRole("treeitem")
    .filter((item) => item.getAttribute("aria-selected") === "true")
    .map((item) => item.textContent);
/** The page's headings: its title first, then its stories and collections. */
const headings = () => screen.getAllByRole("heading").map((heading) => heading.textContent);
const title = () => screen.getByRole("heading", { level: 1 }).textContent;
const searchField = () => screen.getByRole("searchbox", { name: "Search" });
/** The names of the apps listed in the collection with this title. */
const listed = (collection: string) =>
  within(screen.getByRole("region", { name: collection }))
    .getAllByRole("listitem")
    .map((item) => item.querySelector(".mac-card-grid-card-title")?.textContent);
const offer = (name: string) => screen.getByRole("button", { name });
const catalogued = (id: string) => APPS.find((item) => item.id === id) as AppStoreApp;

/** Fakes the timer that moves the downloads; the user's own timers stay real. */
const fakeClock = () => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

/** Lets a download run to its end: ten ticks of the timer. */
const download = () => act(() => vi.advanceTimersByTime(DOWNLOAD_INTERVAL * 10));

afterEach(() => {
  vi.useRealTimers();
});

describe("the window", () => {
  it("opens on Discover at the captured size", () => {
    render(<AppStore />);
    expect(frame()).toHaveClass("mac-window", "mac-app-store");
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().style.width).toBe("1246px");
    expect(frame().style.height).toBe("857px");
    expect(
      within(tree())
        .getAllByRole("treeitem")
        .map((item) => item.textContent),
    ).toEqual(["Discover", "Arcade", "Create", "Work", "Play", "Develop", "Categories", "Updates"]);
    expect(selected()).toEqual(["Discover"]);
    expect(headings()).toEqual([
      "Discover",
      "Extensions for Fast Photo Edits",
      "Act Fast!",
      "Print a Photo Project",
      "Apps and Games We Love Right Now",
    ]);
    expect(listed("Apps and Games We Love Right Now")).toEqual([
      "Cozy Corners",
      "Launchwell",
      "Margin Notes",
      "Rainroom Lite",
      "Banners of the Nine Rivers",
      "Dynasties of Dawn",
      "Longhand",
      "Draftreel",
      "Ember Covenant",
    ]);
    expect(offer("Get, Cozy Corners")).toHaveAccessibleDescription("In-App Purchases");
    expect(offer("$14.99, Launchwell")).not.toHaveAccessibleDescription();
    expect(searchField()).toHaveValue("");
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <AppStore
        ref={ref}
        state="inactive"
        width={900}
        height="50vh"
        className="mine"
        data-kind="app"
        style={{ left: 12 }}
        zoomRole="zoom"
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mac-app-store", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-kind", "app");
    expect(frame().style.width).toBe("900px");
    expect(frame().style.height).toBe("50vh");
    expect(frame().style.left).toBe("12px");

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    await user.click(screen.getByRole("button", { name: "Zoom" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);

    // The store has no title bar: the strip over the sidebar's rows is its drag region.
    const strip = frame().querySelector("[data-window-drag-region]") as HTMLElement;
    expect(strip).toContainElement(searchField());
    fireEvent.pointerDown(strip, { button: 0 });
    fireEvent.doubleClick(strip);
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A press on a control in the strip is the control's, and another button does not drag.
    fireEvent.pointerDown(searchField(), { button: 0 });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Close" }), { button: 0 });
    fireEvent.pointerDown(strip, { button: 2 });
    fireEvent.doubleClick(searchField());
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("disables the controls a host disables", () => {
    render(<AppStore minimizeDisabled zoomDisabled />);
    expect(screen.getByRole("button", { name: "Minimize" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enter Full Screen" })).toBeDisabled();
  });

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    expect(app).toBe(appStoreApp);
    expect(app).toMatchObject({
      id: "app-store",
      name: "App Store",
      component: AppStore,
      defaultSize: { width: 1246, height: 857 },
      minSize: { width: 760, height: 480 },
      resizable: true,
      menus: ["App Store", "Edit", "Store", "Window", "Help"],
    });
    render(
      <WindowManager style={{ height: 900 }}>
        <ManagedWindow
          id={app.id}
          defaultFrame={{ x: 20, y: 20, ...app.defaultSize }}
          minWidth={app.minSize.width}
          minHeight={app.minSize.height}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(frame().parentElement).toHaveAttribute("data-window-id", "app-store");
    expect(title()).toBe("Discover");
    await user.click(row("Play"));
    expect(title()).toBe("Play");
    await user.click(within(frame()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "App Store" })).toBeNull();
  });
});

describe("sections", () => {
  it("shows the page of the row pressed", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    render(<AppStore onSectionChange={onSectionChange} />);

    await user.click(row("Create"));
    expect(selected()).toEqual(["Create"]);
    expect(headings()).toEqual([
      "Create",
      "Draw Anything",
      "Grade a Photo in a Minute",
      "Essential Creative Apps",
    ]);
    expect(listed("Essential Creative Apps")).toEqual([
      "Inkwell Studio",
      "Chromatica",
      "Loopsmith",
      "Framecraft",
      "Glyphworks",
      "Clay Sketch",
    ]);
    expect(onSectionChange).toHaveBeenLastCalledWith("create");

    await user.click(row("Arcade"));
    expect(headings()).toEqual([
      "Arcade",
      "Set Sail at Dusk",
      "Games for the Sofa",
      "New Arcade Games",
    ]);
    await user.click(row("Work"));
    expect(headings()).toEqual(["Work", "Stay on Task", "Paperwork, Done", "Get More Done"]);
    await user.click(row("Play"));
    expect(headings()).toEqual([
      "Play",
      "Weekend Quests",
      "Five-Minute Rounds",
      "Games We Are Playing",
    ]);
    await user.click(row("Develop"));
    expect(headings()).toEqual(["Develop", "Ship Faster", "See the Wire", "Developer Essentials"]);
    await user.click(row("Categories"));
    expect(headings()).toEqual(["Categories"]);
    await user.click(row("Updates"));
    expect(headings()).toEqual(["Updates", "Pending", "Updated Recently"]);
    await user.click(row("Discover"));
    expect(headings()[1]).toBe("Extensions for Fast Photo Edits");
    expect(onSectionChange.mock.calls.map(([section]) => section)).toEqual([
      "create",
      "arcade",
      "work",
      "play",
      "develop",
      "categories",
      "updates",
      "discover",
    ]);
  });

  it("moves through the sections with the keyboard", async () => {
    const user = userEvent.setup();
    render(<AppStore />);
    // Close, minimize, zoom, the search field, then the list of sections.
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(tree()).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(selected()).toEqual(["Arcade"]);
    expect(title()).toBe("Arcade");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(title()).toBe("Work");
    expect(headings()).toContain("Get More Done");
    await user.keyboard("{End}");
    expect(title()).toBe("Updates");
    await user.keyboard("{ArrowUp}");
    expect(title()).toBe("Categories");
    await user.keyboard("{Home}");
    expect(title()).toBe("Discover");
    // Typing the start of a name selects its row.
    await user.keyboard("de");
    expect(selected()).toEqual(["Develop"]);
    expect(headings()).toContain("Developer Essentials");
  });

  it("opens on the section given and follows a controlled one", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    const { rerender, unmount } = render(
      <AppStore section="work" onSectionChange={onSectionChange} />,
    );
    expect(selected()).toEqual(["Work"]);
    expect(title()).toBe("Work");
    await user.click(row("Play"));
    expect(onSectionChange).toHaveBeenCalledWith("play");
    expect(title()).toBe("Work");
    rerender(<AppStore section="play" onSectionChange={onSectionChange} />);
    expect(selected()).toEqual(["Play"]);
    expect(title()).toBe("Play");
    unmount();

    render(<AppStore defaultSection="updates" />);
    expect(selected()).toEqual(["Updates"]);
    expect(title()).toBe("Updates");
  });

  it("lists the rest of a collection after See All", async () => {
    const user = userEvent.setup();
    render(<AppStore />);
    const action = screen.getByRole("button", { name: "See All" });
    expect(action).toHaveAttribute("aria-expanded", "false");
    await user.click(action);
    expect(listed("Apps and Games We Love Right Now")).toHaveLength(12);
    expect(listed("Apps and Games We Love Right Now").slice(9)).toEqual([
      "Tile Garden",
      "Daybook",
      "Skyline Weather",
    ]);
    const less = screen.getByRole("button", { name: "See Less" });
    expect(less).toHaveAttribute("aria-expanded", "true");
    // Return on the focused action puts the collection back.
    less.focus();
    await user.keyboard("{Enter}");
    expect(listed("Apps and Games We Love Right Now")).toHaveLength(9);
    // A collection that is listed in full has no action.
    await user.click(row("Play"));
    expect(screen.queryByRole("button", { name: "See All" })).toBeNull();
  });

  it("lists a category's apps when the category is chosen", async () => {
    const user = userEvent.setup();
    render(<AppStore defaultSection="categories" />);
    const categories = within(screen.getByRole("region", { name: "Categories" }));
    expect(categories.getAllByRole("button")).toHaveLength(CATEGORIES.length);
    await user.click(categories.getByRole("button", { name: /^Developer Tools/ }));
    expect(title()).toBe("Results for “Developer Tools”");
    expect(searchField()).toHaveValue("Developer Tools");
    expect(listed("6 Apps")).toEqual([
      "Branchline",
      "Regex Garden",
      "Packet Peek",
      "Schema Loom",
      "Hex Lantern",
      "Build Barn",
    ]);
  });
});

describe("search", () => {
  it("lists the apps whose name, line or category contains the text", async () => {
    const user = userEvent.setup();
    render(<AppStore />);
    await user.type(searchField(), "NOTES");
    expect(headings()).toEqual(["Results for “NOTES”", "2 Apps"]);
    expect(listed("2 Apps")).toEqual(["Margin Notes", "Harbor Notes"]);
    // No row of the sidebar is selected while results are shown.
    expect(selected()).toEqual([]);

    await user.clear(searchField());
    await user.type(searchField(), "weather");
    expect(listed("1 App")).toEqual(["Skyline Weather"]);

    // Escape clears the field, and the section is back.
    await user.keyboard("{Escape}");
    expect(searchField()).toHaveValue("");
    expect(title()).toBe("Discover");
    expect(selected()).toEqual(["Discover"]);
  });

  it("says when nothing matches, and ends when a section is chosen", async () => {
    const user = userEvent.setup();
    render(<AppStore />);
    await user.type(searchField(), "zzz");
    expect(title()).toBe("Results for “zzz”");
    expect(screen.getByText("No Results").closest("[role='status']")).not.toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);

    await user.click(row("Work"));
    expect(searchField()).toHaveValue("");
    expect(title()).toBe("Work");
    // The section that was shown is also back by a press on its own row.
    await user.type(searchField(), "zzz");
    await user.click(row("Work"));
    expect(title()).toBe("Work");
    expect(selected()).toEqual(["Work"]);
  });

  it("matches whatever the case and ignores space around the text", () => {
    const sideNotes = catalogued("margin-notes");
    expect(appMatches(sideNotes, "  sIDe ")).toBe(true);
    expect(appMatches(sideNotes, "monitor")).toBe(true);
    expect(appMatches(sideNotes, "productivity")).toBe(true);
    expect(appMatches(sideNotes, "games")).toBe(false);
    expect(appMatches(sideNotes, "   ")).toBe(false);
  });
});

describe("offers", () => {
  it("confirms a free app, downloads it and offers to open it", async () => {
    fakeClock();
    const user = userEvent.setup();
    render(<AppStore />);

    await user.click(offer("Get, Rainroom Lite"));
    const confirm = offer("Install, Rainroom Lite");
    expect(confirm).toHaveAttribute("data-variant", "filled");
    // The same button all along, so the keyboard focus stays on it.
    expect(confirm).toHaveFocus();

    await user.click(confirm);
    const stop = offer("Stop downloading Rainroom Lite");
    expect(stop).toHaveAttribute("data-progress");
    expect(screen.getByRole("status")).toHaveTextContent("Downloading Rainroom Lite");

    act(() => vi.advanceTimersByTime(DOWNLOAD_INTERVAL * 9));
    expect(offer("Stop downloading Rainroom Lite")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(DOWNLOAD_INTERVAL));
    const open = offer("Open, Rainroom Lite");
    expect(open).not.toHaveAttribute("data-progress");
    expect(open).toHaveAttribute("data-variant", "tinted");
    expect(screen.getByRole("status")).toHaveTextContent("Rainroom Lite is installed");
    // The other offers have not moved.
    expect(offer("Get, Cozy Corners")).toBeInTheDocument();
  });

  it("asks to buy a paid app, and drops its caption once the app is installed", async () => {
    fakeClock();
    const user = userEvent.setup();
    render(<AppStore />);
    const price = offer("$59.99, Dynasties of Dawn");
    expect(price).toHaveAccessibleDescription("In-App Purchases");
    // With the keyboard: Return confirms, Space starts the download.
    price.focus();
    await user.keyboard("{Enter}");
    expect(offer("Buy App, Dynasties of Dawn")).toHaveFocus();
    await user.keyboard(" ");
    expect(offer("Stop downloading Dynasties of Dawn")).toBeInTheDocument();
    download();
    expect(offer("Open, Dynasties of Dawn")).not.toHaveAccessibleDescription();
  });

  it("withdraws a confirmation when the focus moves on, and stops a download", async () => {
    fakeClock();
    const user = userEvent.setup();
    render(<AppStore />);
    await user.click(offer("$14.99, Launchwell"));
    expect(offer("Buy App, Launchwell")).toBeInTheDocument();
    await user.tab();
    expect(offer("$14.99, Launchwell")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Buy App, Launchwell" })).toBeNull();

    await user.click(offer("$14.99, Launchwell"));
    await user.click(offer("Buy App, Launchwell"));
    act(() => vi.advanceTimersByTime(DOWNLOAD_INTERVAL * 4));
    await user.click(offer("Stop downloading Launchwell"));
    expect(offer("$14.99, Launchwell")).toBeInTheDocument();
    // Nothing arrives after the download was stopped.
    download();
    expect(offer("$14.99, Launchwell")).toBeInTheDocument();
  });

  it("keeps an app's offer wherever the app is listed", async () => {
    fakeClock();
    const user = userEvent.setup();
    render(<AppStore />);
    await user.click(offer("Get, Cozy Corners"));
    await user.click(offer("Install, Cozy Corners"));
    download();
    await user.type(searchField(), "cozy corners");
    expect(listed("1 App")).toEqual(["Cozy Corners"]);
    expect(offer("Open, Cozy Corners")).toBeInTheDocument();
  });

  it("updates one app, or all that wait, from the Updates page", async () => {
    fakeClock();
    const user = userEvent.setup();
    render(<AppStore defaultSection="updates" />);
    expect(listed("Pending")).toEqual(["Harbor Notes", "Pocket Atlas", "Tempo Trainer"]);
    expect(listed("Updated Recently")).toEqual(["Kiln", "Quill Reader", "Ridge Timer"]);
    expect(offer("Open, Kiln")).toBeInTheDocument();

    // An update is not confirmed: it downloads at once.
    await user.click(offer("Update, Pocket Atlas"));
    expect(offer("Stop downloading Pocket Atlas")).toBeInTheDocument();
    download();
    expect(offer("Open, Pocket Atlas")).toBeInTheDocument();

    const all = screen.getByRole("button", { name: "Update All" });
    expect(all).toBeEnabled();
    await user.click(all);
    expect(offer("Stop downloading Harbor Notes")).toBeInTheDocument();
    expect(offer("Stop downloading Tempo Trainer")).toBeInTheDocument();
    // The announcement names the whole batch, not only its last app.
    expect(screen.getByRole("status")).toHaveTextContent(
      /^Downloading (Harbor Notes and Tempo Trainer|Tempo Trainer and Harbor Notes)$/,
    );
    expect(screen.getByRole("button", { name: "Update All" })).toBeDisabled();
    download();
    expect(offer("Open, Harbor Notes")).toBeInTheDocument();
    expect(offer("Open, Tempo Trainer")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /^(Harbor Notes and Tempo Trainer|Tempo Trainer and Harbor Notes) are installed$/,
    );
    expect(screen.queryByRole("button", { name: /^Update,/ })).toBeNull();
  });

  it("runs the purchase sequence as a pure function of its state", () => {
    const free = catalogued("rainroom-lite");
    const update = catalogued("harbor-notes");
    const installed = catalogued("kiln");
    let offers: AppStoreOffers = {};
    offers = reduceOffers(offers, { type: "press", app: free });
    expect(offers).toEqual({ "rainroom-lite": { step: "confirm", progress: 0 } });
    expect(reduceOffers(offers, { type: "revert", app: free })).toEqual({});
    // A tick moves downloads only, and changes nothing when there is none.
    expect(reduceOffers(offers, { type: "tick" })).toBe(offers);
    offers = reduceOffers(offers, { type: "press", app: free });
    offers = reduceOffers(offers, { type: "press", app: update });
    expect(offers).toEqual({
      "rainroom-lite": { step: "downloading", progress: 0 },
      "harbor-notes": { step: "downloading", progress: 0 },
    });
    // A confirmation cannot be withdrawn once the download runs.
    expect(reduceOffers(offers, { type: "revert", app: free })).toBe(offers);
    offers = reduceOffers(offers, { type: "tick" });
    expect(offers["rainroom-lite"]).toEqual({ step: "downloading", progress: 0.1 });
    for (let tick = 0; tick < 9; tick++) offers = reduceOffers(offers, { type: "tick" });
    expect(offers["rainroom-lite"]).toEqual({ step: "open", progress: 1 });
    // An installed app stays as it is, whatever is pressed or started.
    expect(reduceOffers(offers, { type: "press", app: free })).toBe(offers);
    expect(reduceOffers(offers, { type: "press", app: installed })).toBe(offers);
    expect(reduceOffers(offers, { type: "start", apps: [free, installed] })).toEqual(offers);
  });
});

describe("the account", () => {
  it("signs in, lists what was got in this window, and signs out", async () => {
    fakeClock();
    const user = userEvent.setup();
    render(<AppStore />);
    await user.click(offer("Get, Longhand"));
    await user.click(offer("Install, Longhand"));
    download();

    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(headings()).toEqual(["Account", "Purchased"]);
    expect(screen.getByText("Signed in as Robin Vega.")).toBeInTheDocument();
    expect(listed("Purchased")).toEqual(["Longhand"]);
    expect(selected()).toEqual([]);
    const account = screen.getByRole("button", { name: "Robin Vega" });
    expect(account).toHaveAttribute("aria-pressed", "true");

    // A section takes the pane back; the account button returns to the account.
    await user.click(row("Discover"));
    expect(title()).toBe("Discover");
    expect(account).toHaveAttribute("aria-pressed", "false");
    account.focus();
    await user.keyboard("{Enter}");
    expect(title()).toBe("Account");

    await user.click(screen.getByRole("button", { name: "Sign Out" }));
    expect(title()).toBe("Discover");
    expect(screen.getByRole("button", { name: "Sign In" })).not.toHaveAttribute("aria-pressed");
  });

  it("says so when nothing was got yet", async () => {
    const user = userEvent.setup();
    render(<AppStore />);
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(headings()).toEqual(["Account"]);
    expect(screen.getByText("Apps you get in this window are listed here.")).toBeInTheDocument();
  });
});

describe("the catalogue", () => {
  it("holds every app a page lists, each under a category of the Categories page", () => {
    const ids = APPS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const page of Object.values(PAGES)) {
      expect(page.stories).toHaveLength(2);
      for (const collection of page.collections) {
        expect(appsOf(collection.apps)).toHaveLength(collection.apps.length);
      }
    }
    const names = CATEGORIES.map((category) => category.name);
    for (const item of APPS) expect(names).toContain(item.category);
    expect(names.reduce((sum, name) => sum + categoryCount(name), 0)).toBe(APPS.length);
    // Searching for a category's name finds its apps and no others in this catalogue. (Choosing the
    // category lists exactly its apps whatever the catalogue: app-store-server.test.tsx.)
    for (const name of names) {
      const found = APPS.filter((item) => appMatches(item, name));
      expect(found.every((item) => item.category === name)).toBe(true);
      expect(found).toHaveLength(categoryCount(name));
    }
    expect(SECTIONS).toHaveLength(8);
  });
});
