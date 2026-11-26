import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Music } from "./music";
import { defaultSettings, type MusicAlbum } from "./music-data";

const display = () => within(screen.getByRole("group", { name: "Now Playing" }));
const sidebarRow = (name: string) => screen.getByRole("treeitem", { name });
/** A toolbar button that is disabled stays reachable, so it is marked with `aria-disabled`. */
const unavailable = (name: string) =>
  screen.getByRole("button", { name }).getAttribute("aria-disabled") === "true";

/** Two short songs, so that a test can run a queue to its end. */
const SHORT: MusicAlbum[] = [
  {
    id: "short",
    title: "Short Album",
    artist: "Test Artist",
    genre: "Test",
    year: 2019,
    added: 0,
    cover: { ground: "#222222", ink: "#444444", motif: "rings" },
    songs: [
      { id: "short-1", title: "First Song", duration: 10 },
      { id: "short-2", title: "Second Song", duration: 6 },
    ],
  },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("transport", () => {
  it("loads the library's first song on Play and steps through the queue", async () => {
    const user = userEvent.setup();
    render(<Music />);
    expect(unavailable("Previous")).toBe(true);
    expect(unavailable("Next")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(unavailable("Next")).toBe(false);
    expect(display().getByText("Streetlight Hours")).toBeInTheDocument();
    expect(display().getByText("The Placeholders — Night Lines")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(display().getByText("Paper Maps")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(display().getByText("Streetlight Hours")).toBeInTheDocument();
  });

  it("advances the position while playing, holds it while paused and unloads after the last song", () => {
    vi.useFakeTimers();
    render(<Music albums={SHORT} />);
    const position = () => screen.getByRole("slider", { name: "Playback position" });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(position()).toHaveAttribute("aria-valuetext", "0:05 of 0:10");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => vi.advanceTimersByTime(3000));
    expect(position()).toHaveAttribute("aria-valuetext", "0:05 of 0:10");

    // Five more seconds end the first song, six more the second: nothing is loaded then.
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(display().getByText("Second Song")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(6000));
    expect(display().queryByText("Second Song")).not.toBeInTheDocument();
    expect(unavailable("Play")).toBe(false);
    expect(unavailable("Next")).toBe(true);
  });

  it("goes back to the start of a song that has played for a while before the song before it", () => {
    vi.useFakeTimers();
    render(<Music albums={SHORT} />);
    const position = () => screen.getByRole("slider", { name: "Playback position" });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    // At the start of the second song Previous goes to the first.
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(display().getByText("First Song")).toBeInTheDocument();

    // More than three seconds in, it restarts the song instead.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(display().getByText("Second Song")).toBeInTheDocument();
    expect(position()).toHaveAttribute("aria-valuetext", "0:00 of 0:06");
  });

  it("lists the rest of the queue in Up Next", async () => {
    const user = userEvent.setup();
    render(<Music albums={SHORT} />);
    const upNext = screen.getByRole("button", { name: "Up Next" });
    await user.click(upNext);
    expect(upNext).toHaveAttribute("aria-pressed", "true");
    const panel = within(screen.getByRole("complementary", { name: "Up Next" }));
    expect(panel.getByText("No Upcoming Songs")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(panel.queryByText("No Upcoming Songs")).not.toBeInTheDocument();
    await user.click(upNext);
    expect(screen.queryByRole("complementary", { name: "Up Next" })).not.toBeInTheDocument();
  });
});

describe("volume", () => {
  it("starts at the given volume and follows the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Music defaultVolume={40} />);
    const volume = screen.getByRole("slider", { name: "Volume" });
    expect(volume).toHaveValue("40");
    volume.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(volume).toHaveValue("42");
    await user.keyboard("{Home}");
    expect(volume).toHaveValue("0");
  });
});

describe("sidebar navigation", () => {
  it("shows the place of the selected row and reports it", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    render(<Music onSectionChange={onSectionChange} />);
    expect(sidebarRow("Albums")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Albums" })).toBeInTheDocument();

    await user.click(sidebarRow("Songs"));
    expect(onSectionChange).toHaveBeenLastCalledWith("songs");
    expect(screen.getByRole("grid", { name: "Songs" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Albums" })).not.toBeInTheDocument();

    await user.click(sidebarRow("Artists"));
    expect(screen.getByRole("region", { name: "Ada Rowan" })).toBeInTheDocument();

    await user.click(sidebarRow("Radio"));
    expect(screen.getByText("Radio is not part of this demo")).toBeInTheDocument();
  });

  it("lists the album added last first in Recently Added", async () => {
    const user = userEvent.setup();
    render(<Music />);
    await user.click(sidebarRow("Recently Added"));
    const cards = within(screen.getByRole("region", { name: "Recently Added" })).getAllByRole(
      "button",
    );
    expect(cards[0]).toHaveTextContent("Orchard Road");
  });
});

describe("album selection", () => {
  it("opens the chosen album's details, plays it from there and closes them again", async () => {
    const user = userEvent.setup();
    render(<Music />);
    const card = screen.getByRole("button", { name: /Morning Walk/ });
    expect(card).toHaveAttribute("aria-pressed", "false");

    await user.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    const detail = within(screen.getByRole("region", { name: "Morning Walk by The Placeholders" }));
    expect(detail.getByText("Rock · 2016 · 4 songs")).toBeInTheDocument();

    await user.click(detail.getByRole("button", { name: "Play" }));
    expect(display().getByText("The Placeholders — Morning Walk")).toBeInTheDocument();

    await user.click(card);
    expect(
      screen.queryByRole("region", { name: "Morning Walk by The Placeholders" }),
    ).not.toBeInTheDocument();
  });

  it("plays an album on a double click of its cell", async () => {
    const user = userEvent.setup();
    render(<Music />);
    await user.dblClick(screen.getByRole("button", { name: /Slow Tide/ }));
    expect(display().getByText("Ada Rowan — Slow Tide")).toBeInTheDocument();
  });
});

describe("search", () => {
  it("finds albums by artist, reports an empty result and returns to the place when cleared", async () => {
    const user = userEvent.setup();
    render(<Music />);
    const field = screen.getByRole("searchbox");

    await user.type(field, "ada");
    const found = within(screen.getByRole("region", { name: "Albums" }));
    expect(found.getAllByRole("button").map((card) => card.textContent)).toEqual([
      "Paper LanternsAda Rowan",
      "Slow TideAda Rowan",
    ]);
    expect(screen.getByRole("grid", { name: "Songs found" })).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "zzz");
    expect(screen.getByText("No Results").closest('[role="status"]')).not.toBeNull();

    await user.clear(field);
    expect(screen.getByRole("button", { name: /Night Lines/ })).toBeInTheDocument();
  });

  it("leaves the search when a sidebar row is selected", async () => {
    const user = userEvent.setup();
    render(<Music />);
    await user.type(screen.getByRole("searchbox"), "zzz");
    await user.click(sidebarRow("Songs"));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("grid", { name: "Songs" })).toBeInTheDocument();
  });
});

describe("Preferences", () => {
  const openWithShortcut = () =>
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: ",", metaKey: true });

  it("opens on Command-comma as a key dialog over a main, inert Music window", () => {
    render(<Music />);
    const music = screen.getByRole("region", { name: "Music" });
    expect(music).toHaveAttribute("data-window-state", "key");

    openWithShortcut();
    const dialog = screen.getByRole("dialog", { name: "General" });
    expect(dialog).toHaveAttribute("data-window-state", "key");
    expect(music).toHaveAttribute("data-window-state", "main");
    expect(music).not.toContainElement(dialog);
    expect(screen.getByRole("searchbox").closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("tab", { name: "General" })).toHaveFocus();
  });

  it("gives the keyboard focus back when it closes, and to the window itself when open from the start", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Music />);
    const field = screen.getByRole("searchbox");
    field.focus();
    openWithShortcut();
    expect(field).not.toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(field).toHaveFocus();
    unmount();

    render(<Music defaultPreferencesOpen />);
    expect(screen.getByRole("dialog", { name: "General" })).toHaveFocus();
  });

  it("moves the selection to Albums when OK hides the selected Store row", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    render(<Music defaultSection="itunes-store" onSectionChange={onSectionChange} />);
    openWithShortcut();
    await user.click(screen.getByRole("checkbox", { name: "iTunes Store" }));
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(sidebarRow("Albums")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Albums" })).toBeInTheDocument();
    expect(onSectionChange).toHaveBeenLastCalledWith("albums");
  });

  it("starts on Albums when the settings it starts with hide the Store row asked for", () => {
    render(
      <Music
        defaultSection="itunes-store"
        defaultSettings={{ ...defaultSettings, showStore: false }}
      />,
    );
    expect(sidebarRow("Albums")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Albums" })).toBeInTheDocument();
  });

  it("switches panes with the toolbar and names the dialog after the pane", async () => {
    const user = userEvent.setup();
    render(<Music defaultPreferencesOpen />);
    expect(screen.getByRole("checkbox", { name: "Star ratings" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Playback" }));
    expect(screen.getByRole("dialog", { name: "Playback" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Crossfade songs" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Star ratings" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    expect(screen.getByRole("dialog", { name: "Advanced" })).toBeInTheDocument();
  });

  it("drops the edits on Cancel and on Escape, and applies them on OK", async () => {
    const user = userEvent.setup();
    render(<Music />);

    openWithShortcut();
    await user.click(screen.getByRole("checkbox", { name: "iTunes Store" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sidebarRow("iTunes Store")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Music" })).toHaveAttribute(
      "data-window-state",
      "key",
    );

    openWithShortcut();
    await user.click(screen.getByRole("checkbox", { name: "iTunes Store" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sidebarRow("iTunes Store")).toBeInTheDocument();

    openWithShortcut();
    expect(screen.getByRole("checkbox", { name: "iTunes Store" })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "iTunes Store" }));
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("treeitem", { name: "iTunes Store" })).not.toBeInTheDocument();
  });

  it("sets the song lists' row pitch with the List Size pop-up button when OK is chosen", async () => {
    const user = userEvent.setup();
    render(<Music defaultSection="songs" />);
    const pitch = () =>
      screen
        .getByRole("grid", { name: "Songs" })
        .querySelector<HTMLElement>(".mac-table-view-content")
        ?.style.getPropertyValue("--_row");
    expect(pitch()).toBe("24px");

    openWithShortcut();
    const size = screen.getByRole("combobox", { name: "List Size:" });
    expect(size).toHaveTextContent("Medium");
    await user.click(size);
    await user.click(await screen.findByRole("option", { name: "Large" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(size).toHaveTextContent("Large");
    expect(pitch()).toBe("24px");

    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(pitch()).toBe("28px");
  });

  it("keeps the Preferences open when Escape closes the List Size menu", async () => {
    const user = userEvent.setup();
    render(<Music defaultPreferencesOpen />);
    await user.click(screen.getByRole("combobox", { name: "List Size:" }));
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "General" })).toBeInTheDocument();
  });

  it("is opened and closed by its owner when controlled", async () => {
    const user = userEvent.setup();
    const onPreferencesOpenChange = vi.fn();
    const { rerender } = render(
      <Music preferencesOpen={false} onPreferencesOpenChange={onPreferencesOpenChange} />,
    );
    openWithShortcut();
    expect(onPreferencesOpenChange).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<Music preferencesOpen onPreferencesOpenChange={onPreferencesOpenChange} />);
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(onPreferencesOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("hosting", () => {
  it("gives the window its state, place and size, and the window controls their callbacks", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    const onZoom = vi.fn();
    render(
      <Music
        state="inactive"
        width={900}
        height={500}
        style={{ position: "absolute", left: 120, top: 80 }}
        zoomRole="zoom"
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
      />,
    );
    const music = screen.getByRole("region", { name: "Music" });
    expect(music).toHaveAttribute("data-window-state", "inactive");
    expect(music).toHaveStyle({ left: "120px", top: "80px", width: "900px", height: "500px" });

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    await user.click(screen.getByRole("button", { name: "Zoom" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onMinimize).toHaveBeenCalledTimes(1);
    expect(onZoom).toHaveBeenCalledTimes(1);
  });

  it("keeps its Preferences at the window's level and passes presses on them to the host", () => {
    const onPointerDown = vi.fn();
    const onPointerDownCapture = vi.fn();
    render(
      <Music
        defaultPreferencesOpen
        style={{ position: "absolute", zIndex: 7 }}
        onPointerDown={onPointerDown}
        onPointerDownCapture={onPointerDownCapture}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "General" });
    expect(screen.getByRole("region", { name: "Music" })).toHaveStyle({ zIndex: "7" });
    expect(dialog).toHaveStyle({ zIndex: "7" });
    // After the Music window in the document: in front of it at the same level.
    expect(
      screen.getByRole("region", { name: "Music" }).compareDocumentPosition(dialog) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.pointerDown(screen.getByRole("checkbox", { name: "Star ratings" }));
    expect(onPointerDownCapture).toHaveBeenCalledTimes(1);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("reports presses on the playback bar and the top of the sidebar, but not on their controls", () => {
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Music
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const bar = screen.getByRole("toolbar", { name: "Playback controls" });
    const controls = screen.getByRole("group", { name: "Window controls" });

    fireEvent.pointerDown(bar, { button: 0 });
    // The window controls' group is in the sidebar's header, beside the buttons themselves.
    fireEvent.pointerDown(controls, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(2);
    fireEvent.doubleClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(bar, { button: 2 });
    fireEvent.pointerDown(screen.getByRole("button", { name: "Play" }), { button: 0 });
    fireEvent.pointerDown(screen.getByRole("slider", { name: "Volume" }), { button: 0 });
    fireEvent.pointerDown(screen.getByRole("searchbox"), { button: 0 });
    fireEvent.pointerDown(sidebarRow("Songs"), { button: 0 });
    fireEvent.doubleClick(screen.getByRole("button", { name: "Close" }));
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(2);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("lets a window handler veto a press and a double click on the playback bar", () => {
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Music
        onPointerDownCapture={(event) => event.preventDefault()}
        onDoubleClickCapture={(event) => event.preventDefault()}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const bar = screen.getByRole("toolbar", { name: "Playback controls" });
    fireEvent.pointerDown(bar, { button: 0 });
    fireEvent.doubleClick(bar);
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    expect(onDragRegionDoubleClick).not.toHaveBeenCalled();
  });
});
