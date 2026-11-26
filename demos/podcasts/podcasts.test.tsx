import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { WindowManager } from "macalicious/window-manager";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "./app";
import { Podcasts } from "./podcasts";
import {
  DEFAULT_SETTINGS,
  defaultEpisodes,
  defaultShows,
  type PodcastsEpisode,
  type PodcastsShow,
} from "./podcasts-data";
import { PodcastsPreferences } from "./podcasts-preferences";

const frame = () => screen.getByRole("region", { name: "Podcasts" });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const place = (name: string) =>
  within(screen.getByRole("tree", { name: "Podcasts" })).getByRole("treeitem", { name });
const heading = (name: string, level = 2) => screen.queryByRole("heading", { name, level });
const display = () => screen.getByRole("group", { name: "Now Playing" });
const search = () => screen.getByRole("searchbox");
/** The lockups of a section: the visible titles of its cards. */
const titles = (section: string) =>
  [
    ...screen.getByRole("region", { name: section }).querySelectorAll(".mac-card-grid-card-title"),
  ].map((title) => title.textContent);

/** The clock of the simulated transport runs on intervals; only those are faked. */
const fakeClock = () => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
const seconds = (count: number) => act(() => vi.advanceTimersByTime(count * 1000));

const UP_NEXT = "Notes From the Feedback Pile, Signal Path";

/** Two short new episodes of one followed show, for a queue that ends within a test. */
const SHORT: readonly PodcastsEpisode[] = ["First", "Second"].map((title, index) => ({
  id: title,
  show: "signal-path",
  title: `${title} Short`,
  description: "A few seconds long.",
  date: "October 1, 2019",
  day: "Tuesday",
  published: 2 - index,
  duration: 3,
  isNew: true,
  unplayed: true,
}));

afterEach(() => {
  vi.useRealTimers();
});

describe("Podcasts", () => {
  it("shows the place chosen in the sidebar", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    render(<Podcasts onSectionChange={onSectionChange} />);
    expect(place("Listen Now")).toHaveAttribute("aria-selected", "true");
    expect(heading("Listen Now")).toBeInTheDocument();
    expect(heading("Up Next", 3)).toBeInTheDocument();

    await user.click(place("Top Charts"));
    expect(onSectionChange).toHaveBeenLastCalledWith("top-charts");
    expect(heading("Listen Now")).toBeNull();
    expect(titles("Top Shows")[0]).toBe("1. Plain Sight");

    // The library lists what the followed shows hold, the newest first.
    await user.click(place("Episodes"));
    expect(titles("8 Episodes").slice(0, 2)).toEqual([
      "Notes From the Feedback Pile",
      "The Last Ferry of the Season",
    ]);

    // See All on the Up Next shelf leads there too.
    await user.click(place("Listen Now"));
    await user.click(button("See All"));
    expect(place("Episodes")).toHaveAttribute("aria-selected", "true");
  });

  it("opens a show from Browse, subscribes to it and lists it in the library", async () => {
    const user = userEvent.setup();
    render(<Podcasts />);
    await user.click(place("Shows"));
    expect(titles("4 Shows")).not.toContain("Tidewater");

    await user.click(place("Browse"));
    await user.click(
      within(screen.getByRole("region", { name: "All Shows" })).getByRole("button", {
        name: /Tidewater/,
      }),
    );
    expect(heading("Tidewater")).toBeInTheDocument();
    expect(heading("Browse")).toBeNull();
    expect(titles("Episodes")).toEqual(["Spring Tide", "Salt Marsh at Dawn"]);

    await user.click(button("Subscribe"));
    expect(button("Unsubscribe")).toBeInTheDocument();
    await user.click(button("Back to Browse"));
    expect(heading("Browse")).toBeInTheDocument();

    await user.click(place("Shows"));
    expect(titles("5 Shows")).toContain("Tidewater");

    // Top Charts follows and unfollows without leaving the chart.
    await user.click(place("Top Charts"));
    await user.click(button("Unsubscribe from Tidewater"));
    expect(button("Subscribe to Tidewater")).toBeInTheDocument();
    await user.click(place("Shows"));
    expect(titles("4 Shows")).not.toContain("Tidewater");
  });

  it("plays the episode that is clicked, pauses, and skips by the seconds on its buttons", async () => {
    fakeClock();
    const user = userEvent.setup();
    render(<Podcasts />);
    // Nothing is loaded: the display is idle and there is nothing to skip in.
    expect(display()).toHaveAttribute("data-state", "idle");
    const disabled = (name: string) => button(name).getAttribute("aria-disabled") === "true";
    expect(disabled("Back 15 seconds")).toBe(true);
    expect(disabled("Forward 30 seconds")).toBe(true);

    await user.click(button(UP_NEXT));
    expect(display()).toHaveTextContent("Notes From the Feedback Pile");
    expect(display()).toHaveTextContent("Signal Path — September 29, 2019");
    expect(button("Pause")).toBeInTheDocument();

    seconds(5);
    expect(within(display()).getByText("0:05")).toBeInTheDocument();
    expect(within(display()).getByText("-1:45:55")).toBeInTheDocument();

    await user.click(button("Forward 30 seconds"));
    expect(within(display()).getByText("0:35")).toBeInTheDocument();
    await user.click(button("Back 15 seconds"));
    expect(within(display()).getByText("0:20")).toBeInTheDocument();

    // Paused, the clock stops; the card says how much is left.
    await user.click(button("Pause"));
    seconds(10);
    expect(within(display()).getByText("0:20")).toBeInTheDocument();
    expect(button(UP_NEXT)).toHaveTextContent("1 hr 46 min left");

    // Skipping back never passes the start.
    await user.click(button("Back 15 seconds"));
    await user.click(button("Back 15 seconds"));
    expect(within(display()).getByText("0:00")).toBeInTheDocument();

    await user.click(button("Play"));
    seconds(2);
    expect(within(display()).getByText("0:02")).toBeInTheDocument();
  });

  it("starts Up Next from the play button when nothing is loaded", async () => {
    const user = userEvent.setup();
    render(<Podcasts />);
    await user.click(button("Play"));
    expect(display()).toHaveTextContent("Notes From the Feedback Pile");
  });

  it("goes on to the next episode of the queue when one ends, and empties after the last", async () => {
    fakeClock();
    const user = userEvent.setup();
    render(<Podcasts episodes={SHORT} />);
    await user.click(button("First Short, Signal Path"));
    seconds(3);
    expect(display()).toHaveTextContent("Second Short");
    // An episode heard to its end leaves Up Next.
    expect(screen.queryByRole("button", { name: "First Short, Signal Path" })).toBeNull();

    seconds(3);
    expect(display()).toHaveAttribute("data-state", "idle");
    expect(button("Play")).toBeInTheDocument();
    expect(screen.getByText(/all caught up/)).toBeInTheDocument();
  });

  it("stops after an episode when Continuous Playback is off", async () => {
    fakeClock();
    const user = userEvent.setup();
    render(
      <Podcasts episodes={SHORT} defaultSettings={{ ...DEFAULT_SETTINGS, continuous: false }} />,
    );
    await user.click(button("First Short, Signal Path"));
    seconds(3);
    expect(display()).toHaveAttribute("data-state", "idle");
    expect(button("Second Short, Signal Path")).toBeInTheDocument();
  });

  it("loads an episode paused at its start when it is given one", () => {
    render(<Podcasts defaultEpisode="signal-path-12" />);
    expect(display()).toHaveTextContent("Notes From the Feedback Pile");
    expect(button("Play")).toBeInTheDocument();
    expect(button("Forward 30 seconds")).not.toHaveAttribute("aria-disabled", "true");
    expect(button(UP_NEXT)).toHaveTextContent("1 hr 46 min left");
  });

  it("loads no episode whose show the catalogue lacks, and unloads one whose show is removed", () => {
    const others = defaultShows.filter((show) => show.id !== "signal-path");
    const absent = render(<Podcasts shows={others} defaultEpisode="signal-path-12" />);
    expect(display()).toHaveAttribute("data-state", "idle");
    absent.unmount();

    const { rerender } = render(<Podcasts defaultEpisode="signal-path-12" />);
    expect(display()).toHaveTextContent("Notes From the Feedback Pile");
    rerender(<Podcasts shows={others} defaultEpisode="signal-path-12" />);
    expect(display()).toHaveAttribute("data-state", "idle");
    expect(button("Forward 30 seconds")).toHaveAttribute("aria-disabled", "true");
  });

  it("takes a replaced episode's new record, and unloads an episode the catalogue drops", () => {
    const { rerender } = render(<Podcasts defaultEpisode="signal-path-12" />);
    expect(display()).toHaveTextContent("Notes From the Feedback Pile");

    const retitled = defaultEpisodes.map((episode) =>
      episode.id === "signal-path-12" ? { ...episode, title: "Retitled Since" } : episode,
    );
    rerender(<Podcasts episodes={retitled} defaultEpisode="signal-path-12" />);
    expect(display()).toHaveTextContent("Retitled Since");
    expect(display()).not.toHaveTextContent("Notes From the Feedback Pile");

    const without = retitled.filter((episode) => episode.id !== "signal-path-12");
    rerender(<Podcasts episodes={without} defaultEpisode="signal-path-12" />);
    expect(display()).toHaveAttribute("data-state", "idle");
    expect(button("Forward 30 seconds")).toHaveAttribute("aria-disabled", "true");
  });

  it("does not go on to a queued episode that the catalogue has dropped", async () => {
    fakeClock();
    const user = userEvent.setup();
    const { rerender } = render(<Podcasts episodes={SHORT} />);
    await user.click(button("First Short, Signal Path"));
    rerender(<Podcasts episodes={SHORT.slice(0, 1)} />);
    expect(display()).toHaveTextContent("First Short");
    seconds(3);
    expect(display()).toHaveAttribute("data-state", "idle");
  });

  it("goes on to a queued episode's new record when the catalogue replaced it", async () => {
    fakeClock();
    const user = userEvent.setup();
    const { rerender } = render(<Podcasts episodes={SHORT} />);
    await user.click(button("First Short, Signal Path"));
    const renamed = SHORT.map((episode) =>
      episode.id === "Second" ? { ...episode, title: "Second Renamed" } : episode,
    );
    rerender(<Podcasts episodes={renamed} />);
    expect(display()).toHaveTextContent("First Short");
    seconds(3);
    expect(display()).toHaveTextContent("Second Renamed");
    expect(display()).not.toHaveTextContent("Second Short");
  });

  it("goes straight on to the queued episode when the playing record becomes shorter than what was heard", async () => {
    fakeClock();
    const user = userEvent.setup();
    const { rerender } = render(<Podcasts episodes={SHORT} />);
    await user.click(button("First Short, Signal Path"));
    seconds(2);
    expect(display()).toHaveTextContent("First Short");

    const shortened = SHORT.map((episode) =>
      episode.id === "First" ? { ...episode, duration: 2 } : episode,
    );
    rerender(<Podcasts episodes={shortened} />);
    // Without another tick of the transport: the queued episode is the one playing.
    expect(display()).toHaveTextContent("Second Short");
    expect(display()).not.toHaveTextContent("First Short");
    expect(display()).toHaveAttribute("data-state", "playing");
  });

  it("stops at a shortened record instead of going on when Continuous Playback is off", async () => {
    fakeClock();
    const user = userEvent.setup();
    const settings = { ...DEFAULT_SETTINGS, continuous: false };
    const { rerender } = render(<Podcasts episodes={SHORT} defaultSettings={settings} />);
    await user.click(button("First Short, Signal Path"));
    seconds(2);

    const shortened = SHORT.map((episode) =>
      episode.id === "First" ? { ...episode, duration: 2 } : episode,
    );
    rerender(<Podcasts episodes={shortened} defaultSettings={settings} />);
    expect(display()).toHaveAttribute("data-state", "idle");
    expect(display()).not.toHaveTextContent("Second Short");
  });

  it("ends an episode whose new record is shorter than what was heard of it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Podcasts defaultEpisode="signal-path-12" />);
    screen.getByRole("slider", { name: "Playback position" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(within(display()).getByText("0:03")).toBeInTheDocument();

    const shortened = defaultEpisodes.map((episode) =>
      episode.id === "signal-path-12" ? { ...episode, duration: 2 } : episode,
    );
    rerender(<Podcasts episodes={shortened} defaultEpisode="signal-path-12" />);
    // Nothing is left to hear: the player is empty, not stopped past the end.
    expect(display()).toHaveAttribute("data-state", "idle");
    expect(screen.queryByRole("slider", { name: "Playback position" })).not.toBeInTheDocument();
  });

  it("seeks with the progress line and changes the volume with its slider", async () => {
    const user = userEvent.setup();
    render(<Podcasts defaultEpisode="signal-path-12" defaultVolume={50} />);
    const position = () => screen.getByRole("slider", { name: "Playback position" });
    expect(position()).toHaveAttribute("aria-valuetext", expect.stringMatching(/^0:00 of /));
    position().focus();
    await user.keyboard("{ArrowRight}");
    expect(position()).toHaveAttribute("aria-valuetext", expect.stringMatching(/^0:01 of /));
    expect(within(display()).getByText("0:01")).toBeInTheDocument();

    const volume = () => screen.getByRole("slider", { name: "Volume" });
    expect(volume()).toHaveAttribute("aria-valuenow", "50");
    volume().focus();
    await user.keyboard("{ArrowRight}");
    expect(volume()).toHaveAttribute("aria-valuenow", "51");
    // Both hold their values when the window renders again.
    await user.click(place("Browse"));
    expect(volume()).toHaveAttribute("aria-valuenow", "51");
    expect(position()).toHaveAttribute("aria-valuetext", expect.stringMatching(/^0:01 of /));
  });

  it("lists a followed show without episodes last in Recently Updated", () => {
    const empty: PodcastsShow = {
      id: "empty",
      title: "Aardvark Hour",
      author: "Nobody Yet",
      category: "Arts",
      description: "Nothing published so far.",
      colors: ["blue", "teal"],
      subscribed: true,
    };
    render(<Podcasts shows={[empty, ...defaultShows]} defaultSection="recently-updated" />);
    const list = titles("5 Shows");
    expect(list[0]).toBe("Signal Path");
    expect(list[4]).toBe("Aardvark Hour");
  });

  it("plays and pauses from an episode's own button in a list", async () => {
    const user = userEvent.setup();
    render(<Podcasts defaultSection="episodes" />);
    await user.click(button("Play The Last Ferry of the Season"));
    expect(display()).toHaveTextContent("The Last Ferry of the Season");
    expect(display()).toHaveTextContent("The Long Field — September 27, 2019");

    await user.click(button("Pause The Last Ferry of the Season"));
    expect(button("Play")).toBeInTheDocument();
    // The rest of the list is the queue.
    await user.click(button("Up Next"));
    expect(titles("Playing Next")[0]).toBe("The Baker Who Paints");
  });

  it("shows the loaded episode's notes in the panel of the info button", async () => {
    const user = userEvent.setup();
    render(<Podcasts />);
    await user.click(button("Episode Notes"));
    const panel = screen.getByRole("region", { name: "Episode Notes" });
    expect(button("Episode Notes")).toHaveAttribute("aria-pressed", "true");
    expect(panel).toHaveTextContent("Not Playing");

    await user.click(button(UP_NEXT));
    expect(panel).toHaveTextContent("revisit launchers and backups");

    // The two panels share the place: one replaces the other, and a second press closes it.
    await user.click(button("Up Next"));
    expect(screen.queryByRole("region", { name: "Episode Notes" })).toBeNull();
    expect(screen.getByRole("region", { name: "Queue" })).toHaveTextContent("No Upcoming Episodes");
    await user.click(button("Up Next"));
    expect(screen.queryByRole("region", { name: "Queue" })).toBeNull();
  });

  it("searches shows and episodes, and goes back to the place when the search is cleared", async () => {
    const user = userEvent.setup();
    render(<Podcasts />);
    await user.type(search(), "tide");
    expect(heading("Listen Now")).toBeNull();
    expect(titles("Shows")).toEqual(["Tidewater"]);
    expect(titles("Episodes")).toEqual(["Spring Tide"]);

    // A show found by the search opens from it, and typing again leaves the show.
    await user.click(button(/Tidewater/));
    expect(button("Back to Search")).toBeInTheDocument();
    await user.type(search(), "w");
    expect(heading("Tidewater")).toBeNull();
    expect(titles("Shows")).toEqual(["Tidewater"]);

    await user.clear(search());
    await user.type(search(), "no such thing");
    expect(screen.getByRole("status")).toHaveTextContent("No Results");

    await user.clear(search());
    expect(heading("Listen Now")).toBeInTheDocument();

    // Choosing a place ends a search.
    await user.type(search(), "ferry");
    await user.click(place("Browse"));
    expect(search()).toHaveValue("");
    expect(heading("Browse")).toBeInTheDocument();
  });

  it("reports a press and a double click on its drag region, not on the controls in it", async () => {
    const user = userEvent.setup();
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Podcasts
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    const bar = screen.getByRole("toolbar", { name: "Playback controls" });
    expect(bar).toHaveAttribute("data-window-drag-region");

    fireEvent.pointerDown(bar, { button: 2 });
    fireEvent.pointerDown(button("Play"), { button: 0 });
    fireEvent.pointerDown(search(), { button: 0 });
    fireEvent.pointerDown(place("Browse"), { button: 0 });
    expect(onDragRegionPointerDown).not.toHaveBeenCalled();
    fireEvent.pointerDown(bar, { button: 0 });
    expect(onDragRegionPointerDown).toHaveBeenCalledTimes(1);

    await user.dblClick(bar);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("lets a window handler veto a press and a double click on its drag region", () => {
    const onDragRegionPointerDown = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Podcasts
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

  it("is hosted by a managed window through the descriptor", async () => {
    const user = userEvent.setup();
    render(
      <WindowManager style={{ height: 900 }}>
        <ManagedWindow
          id={app.id}
          title={app.name}
          resizable={app.resizable}
          defaultFrame={{ x: 20, y: 30, ...app.defaultSize }}
          render={(props) => <app.component {...props} />}
        />
      </WindowManager>,
    );
    const host = frame().parentElement as HTMLElement;
    expect(host).toHaveAttribute("data-window-id", "podcasts");
    expect(host).toHaveStyle({ width: "1137px", height: "764px" });
    // The manager sizes the wrapper; the window fills it.
    expect(frame()).toHaveStyle({ width: "100%", height: "100%" });
    expect(frame()).toHaveAttribute("data-window-state", "key");

    // The manager moves the window by its playback bar.
    const bar = screen.getByRole("toolbar", { name: "Playback controls" });
    const before = host.style.transform;
    fireEvent.pointerDown(bar, { button: 0, pointerId: 1, clientX: 600, clientY: 50 });
    fireEvent.pointerMove(bar, { pointerId: 1, clientX: 640, clientY: 80 });
    fireEvent.pointerUp(bar, { pointerId: 1, clientX: 640, clientY: 80 });
    expect(host.style.transform).not.toBe(before);

    // The app still works in there, and the manager's close button closes it.
    await user.click(place("Browse"));
    expect(heading("Browse")).toBeInTheDocument();
    await user.click(button("Close"));
    expect(screen.queryByRole("region", { name: "Podcasts" })).toBeNull();
  });
});

describe("Preferences", () => {
  const preferences = () => screen.getByRole("region", { name: "General" });

  it("opens with Command-comma as a window of its own and closes with its close button", async () => {
    const user = userEvent.setup();
    const onPreferencesOpenChange = vi.fn();
    render(<Podcasts onPreferencesOpenChange={onPreferencesOpenChange} />);
    expect(screen.queryByRole("region", { name: "General" })).toBeNull();

    await user.click(place("Browse"));
    await user.keyboard("{Meta>},{/Meta}");
    expect(onPreferencesOpenChange).toHaveBeenLastCalledWith(true);
    expect(preferences()).toHaveAttribute("data-window-state", "key");
    expect(frame()).not.toContainElement(preferences());
    // Behind its key Preferences the player is the main window.
    expect(frame()).toHaveAttribute("data-window-state", "main");

    // A press on either window brings it to the front: it is key and stacked over the other.
    const level = (window: HTMLElement) => Number(window.style.zIndex);
    expect(level(preferences())).toBeGreaterThan(level(frame()));
    fireEvent.pointerDown(heading("Browse") as HTMLElement);
    expect(frame()).toHaveAttribute("data-window-state", "key");
    expect(preferences()).toHaveAttribute("data-window-state", "inactive");
    expect(level(frame())).toBeGreaterThan(level(preferences()));
    fireEvent.pointerDown(within(preferences()).getByRole("tab", { name: "General" }));
    expect(preferences()).toHaveAttribute("data-window-state", "key");
    expect(level(preferences())).toBeGreaterThan(level(frame()));

    // The command brings open Preferences back from behind the player.
    await user.click(place("Browse"));
    expect(level(frame())).toBeGreaterThan(level(preferences()));
    await user.keyboard("{Meta>},{/Meta}");
    expect(level(preferences())).toBeGreaterThan(level(frame()));
    expect(preferences()).toHaveAttribute("data-window-state", "key");

    await user.click(within(preferences()).getByRole("button", { name: "Close" }));
    expect(onPreferencesOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("region", { name: "General" })).toBeNull();
    expect(frame()).toHaveAttribute("data-window-state", "key");
  });

  it("follows the owner when the owner controls it", () => {
    const { rerender } = render(<Podcasts preferencesOpen={false} />);
    expect(screen.queryByRole("region", { name: "General" })).toBeNull();
    rerender(<Podcasts preferencesOpen />);
    expect(preferences()).toHaveAttribute("data-window-state", "key");
  });

  it("is not sized by a host that sizes its own children, as a managed window does", () => {
    // A managed window stretches each child of its wrapper over the wrapper, and that is
    // where Preferences are rendered when the app is hosted.
    const host = document.body.appendChild(document.createElement("div"));
    render(<Podcasts defaultPreferencesOpen preferencesContainer={host} />);
    expect(host).toContainElement(preferences());
    expect(preferences().parentElement).not.toBe(host);
    host.remove();
  });

  it("lists as downloaded what the General pane says to download", async () => {
    const user = userEvent.setup();
    render(<Podcasts defaultSection="downloaded" defaultPreferencesOpen />);
    // Only New: the one new episode of the followed shows.
    expect(titles("1 Episode")).toEqual(["Notes From the Feedback Pile"]);

    const download = () =>
      screen.getByRole("combobox", { name: "Automatically Download Episodes:" });
    await user.click(download());
    await user.click(await screen.findByRole("option", { name: "All Unplayed" }));
    expect(download()).toHaveTextContent("All Unplayed");
    expect(titles("3 Episodes")).toEqual([
      "Notes From the Feedback Pile",
      "The Last Ferry of the Season",
      "The Baker Who Paints",
    ]);

    await user.click(download());
    await user.click(await screen.findByRole("option", { name: "Never" }));
    expect(screen.getByText(/No downloaded episodes/)).toBeInTheDocument();
  });

  it("sets the seconds of the skip buttons from the Playback pane", async () => {
    const user = userEvent.setup();
    render(<Podcasts defaultEpisode="signal-path-12" defaultPreferencesOpen />);
    await user.click(screen.getByRole("tab", { name: "Playback" }));
    // The window takes the name of the pane it shows.
    const pane = screen.getByRole("region", { name: "Playback" });
    await user.click(within(pane).getByRole("combobox", { name: "Skip Forward:" }));
    await user.click(await screen.findByRole("option", { name: "60 Seconds" }));

    await user.click(button("Forward 60 seconds"));
    expect(within(display()).getByText("1:00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Forward 30 seconds" })).toBeNull();
  });

  it("holds its settings itself or follows its owner, and reports every change", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    const { rerender } = render(
      <PodcastsPreferences animated={false} onSettingsChange={onSettingsChange} />,
    );
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "General",
      "Playback",
      "Advanced",
    ]);
    const refresh = () => screen.getByRole("combobox", { name: "Refresh Podcasts:" });
    expect(refresh()).toHaveTextContent("Every Hour");
    await user.click(refresh());
    await user.click(await screen.findByRole("option", { name: "Every Day" }));
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SETTINGS,
      refresh: "Every Day",
    });
    expect(refresh()).toHaveTextContent("Every Day");

    // An owner that holds the settings decides what is shown.
    rerender(
      <PodcastsPreferences
        animated={false}
        settings={{ ...DEFAULT_SETTINGS, refresh: "Manually" }}
        onSettingsChange={onSettingsChange}
      />,
    );
    expect(refresh()).toHaveTextContent("Manually");

    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    await user.click(screen.getByRole("checkbox", { name: "Sync subscriptions across devices" }));
    expect(onSettingsChange).toHaveBeenLastCalledWith({
      ...DEFAULT_SETTINGS,
      refresh: "Manually",
      sync: false,
    });
  });
});
