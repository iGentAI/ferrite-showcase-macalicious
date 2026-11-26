import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { app } from "./app";
import { Tv } from "./tv";
import { defaultSettings, type TvSettings } from "./tv-data";
import { PREFERENCES_WIDTH, TvPreferences } from "./tv-preferences";

const frame = () => screen.getByRole("region", { name: "TV" });
const section = (name: string) => screen.getByRole("button", { name });
const shelf = (name: string) => within(screen.getByRole("region", { name }));
/** The names of the cards of a shelf or a grid, in order. */
const cards = (name: string) =>
  shelf(name)
    .getAllByRole("button")
    .map((card) => card.getAttribute("aria-label") ?? card.textContent);
const field = () => screen.getByRole("searchbox", { name: "Search" });

describe("the window", () => {
  it("opens on Watch Now with its three shelves, at the captured size", () => {
    render(<Tv />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("1294px");
    expect(frame().style.height).toBe("876px");
    expect(section("Watch Now")).toHaveAttribute("aria-pressed", "true");
    expect(cards("What to Watch")).toEqual([
      "See All",
      "Harbour Lights",
      "Paper Rockets",
      "The Long Table",
      "Night Shift Diner",
    ]);
    expect(cards("Originals")).toEqual(["The Morning Desk"]);
    expect(cards("Watch New Trailers")).toEqual(["Copper & Glass", "Tide Pool", "Field Day"]);
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Tv
        ref={ref}
        state="inactive"
        width={1000}
        onClose={onClose}
        zoomDisabled
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame().style.width).toBe("1000px");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /zoom|full screen/i })).toBeDisabled();
    // A double click on the bar is the host's; one on a control in it is not.
    await user.dblClick(screen.getByRole("toolbar", { name: "Toolbar" }));
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    await user.dblClick(section("Kids"));
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("reports Command-comma and Control-comma, and leaves the key alone without a listener", () => {
    const onOpenPreferences = vi.fn();
    const { rerender } = render(<Tv onOpenPreferences={onOpenPreferences} />);
    expect(fireEvent.keyDown(field(), { key: ",", metaKey: true })).toBe(false);
    fireEvent.keyDown(field(), { key: ",", ctrlKey: true });
    fireEvent.keyDown(field(), { key: "," });
    expect(onOpenPreferences).toHaveBeenCalledTimes(2);
    rerender(<Tv />);
    expect(fireEvent.keyDown(field(), { key: ",", metaKey: true })).toBe(true);
  });

  it("exports a descriptor whose window renders, and opens its own Preferences", () => {
    expect(app.preferences).toBe("own");
    render(<app.component preferencesOpen />);
    expect(frame()).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "General" }).style.width).toBe(
      `${PREFERENCES_WIDTH}px`,
    );
  });
});

describe("the sections and the shelves", () => {
  it("lists the films, the series and the titles for children in their sections", async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    render(<Tv onSectionChange={onSectionChange} />);

    await user.click(section("Movies"));
    expect(onSectionChange).toHaveBeenLastCalledWith("movies");
    expect(section("Movies")).toHaveAttribute("aria-pressed", "true");
    expect(shelf("Movies").getAllByRole("button")).toHaveLength(5);
    expect(
      shelf("Movies").getByRole("button", { name: /Signal Fires.*Movie · 2018/ }),
    ).toBeVisible();
    expect(shelf("Movies").queryByRole("button", { name: /Harbour Lights/ })).toBeNull();

    await user.click(section("TV Shows"));
    expect(shelf("TV Shows").getAllByRole("button")).toHaveLength(7);

    await user.click(section("Kids"));
    expect(cards("Kids").map((name) => name?.replace(/(Movie|Series) · .*/, ""))).toEqual([
      "Paper Rockets",
      "Little Engines",
      "Tide Pool",
      "Field Day",
    ]);
    // The selected section stays selected when it is clicked again.
    await user.click(section("Kids"));
    expect(section("Kids")).toHaveAttribute("aria-pressed", "true");
  });

  it("turns the pages of a shelf with its chevrons, which stop at the ends", async () => {
    const user = userEvent.setup();
    render(<Tv />);
    const previous = screen.getByRole("button", { name: "Previous in What to Watch" });
    const next = screen.getByRole("button", { name: "More in What to Watch" });
    expect(previous).toHaveAttribute("aria-disabled", "true");

    await user.click(next);
    expect(cards("What to Watch").slice(1)).toEqual([
      "Signal Fires",
      "Little Engines",
      "The Quiet Orbit",
      "Second String",
    ]);
    expect(next).toHaveAttribute("aria-disabled", "true");
    await user.click(next);
    expect(cards("What to Watch")[1]).toBe("Signal Fires");

    await user.click(previous);
    expect(cards("What to Watch")[1]).toBe("Harbour Lights");

    await user.click(screen.getByRole("button", { name: "More in Originals" }));
    expect(cards("Originals")).toEqual(["The Quiet Orbit"]);
    // The other shelves keep their page.
    expect(cards("Watch New Trailers")[0]).toBe("Copper & Glass");
  });

  it("draws a shelf's chevrons only while the pointer or the keyboard is in it", async () => {
    const user = userEvent.setup();
    render(<Tv />);
    const next = screen.getByRole("button", { name: "More in What to Watch" });
    const pager = next.parentElement as HTMLElement;
    expect(pager).not.toHaveAttribute("data-active");
    await user.hover(shelf("What to Watch").getByRole("button", { name: "Paper Rockets" }));
    expect(pager).toHaveAttribute("data-active");
    await user.unhover(pager);
    expect(pager).not.toHaveAttribute("data-active");
    act(() => next.focus());
    expect(pager).toHaveAttribute("data-active");
    // The pointer passing over and away leaves them drawn while the keyboard is there.
    await user.hover(pager);
    await user.unhover(pager);
    expect(pager).toHaveAttribute("data-active");
  });

  it("shows all of What to Watch, and goes back", async () => {
    const user = userEvent.setup();
    render(<Tv />);
    await user.click(screen.getByRole("button", { name: "See All" }));
    expect(shelf("What to Watch").getAllByRole("button")).toHaveLength(9);
    expect(screen.queryByRole("region", { name: "Originals" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("region", { name: "Originals" })).toBeVisible();
  });

  it("goes back from a title to all of What to Watch when it was opened there", async () => {
    const user = userEvent.setup();
    render(<Tv />);
    await user.click(screen.getByRole("button", { name: "See All" }));
    await user.click(shelf("What to Watch").getByRole("button", { name: /Paper Rockets/ }));
    expect(screen.getByRole("heading", { name: "Paper Rockets" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(shelf("What to Watch").getAllByRole("button")).toHaveLength(9);
    expect(screen.getByRole("button", { name: "Done" })).toBeVisible();
  });
});

describe("searching", () => {
  it("finds titles by name and by genre in every section, and says when there are none", async () => {
    const user = userEvent.setup();
    render(<Tv defaultSection="movies" />);

    await user.type(field(), "harb");
    expect(shelf("Results").getAllByRole("button")).toHaveLength(1);
    expect(shelf("Results").getByRole("button", { name: /Harbour Lights/ })).toBeVisible();

    await user.clear(field());
    await user.type(field(), "COMEDY");
    expect(shelf("Results").getAllByRole("button")).toHaveLength(2);

    await user.clear(field());
    await user.type(field(), "zzz");
    expect(screen.getByRole("status")).toHaveTextContent("No Results");

    // A result opens its title; Back returns to the results, and typing leaves the title.
    await user.clear(field());
    await user.type(field(), "orbit");
    await user.click(shelf("Results").getByRole("button", { name: /The Quiet Orbit/ }));
    expect(screen.getByRole("heading", { name: "The Quiet Orbit" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Add to Library" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(shelf("Results").getAllByRole("button")).toHaveLength(1);
    await user.click(shelf("Results").getByRole("button", { name: /The Quiet Orbit/ }));
    await user.type(field(), "x");
    expect(screen.getByRole("status")).toHaveTextContent("No Results");

    // Emptying the field brings the section back; choosing a section empties the field.
    await user.clear(field());
    expect(screen.getByRole("region", { name: "Movies" })).toBeVisible();
    await user.type(field(), "tide");
    await user.click(section("Kids"));
    expect(field()).toHaveValue("");
    expect(screen.getByRole("region", { name: "Kids" })).toBeVisible();
  });
});

describe("a title and the library", () => {
  it("opens a title's page, where it is added to the Library and removed again", async () => {
    const user = userEvent.setup();
    render(<Tv />);
    await user.click(section("Library"));
    expect(screen.getByRole("status")).toHaveTextContent("Your library is empty");

    await user.click(section("Watch Now"));
    await user.click(screen.getByRole("button", { name: "Paper Rockets" }));
    expect(screen.getByRole("heading", { name: "Paper Rockets" })).toBeVisible();
    expect(screen.getByText("Movie · 2019 · Animation")).toBeVisible();
    expect(screen.getByText(/fold a rocket/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add to Library" }));
    expect(screen.getByRole("button", { name: "Remove from Library" })).toBeVisible();

    // Back returns to the shelves, and the Library now lists the title.
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("region", { name: "What to Watch" })).toBeVisible();
    await user.click(section("Library"));
    expect(shelf("Library").getAllByRole("button")).toHaveLength(1);

    await user.click(shelf("Library").getByRole("button", { name: /Paper Rockets/ }));
    await user.click(screen.getByRole("button", { name: "Remove from Library" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("status")).toHaveTextContent("Your library is empty");
  });

  it("gives the Library a checkbox for every title when the settings ask for them", async () => {
    const user = userEvent.setup();
    const library = ["tide-pool", "field-day"];
    const { rerender } = render(<Tv defaultSection="library" defaultLibrary={library} />);
    expect(screen.queryByRole("checkbox")).toBeNull();

    rerender(
      <Tv
        defaultSection="library"
        defaultLibrary={library}
        settings={{ ...defaultSettings, checkboxes: true }}
      />,
    );
    const tide = screen.getByRole("checkbox", { name: "Tide Pool" });
    expect(tide).toBeChecked();
    await user.click(tide);
    expect(tide).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Field Day" })).toBeChecked();
    // The picture still opens the title.
    await user.click(shelf("Library").getByRole("button", { name: "Field Day" }));
    expect(screen.getByRole("heading", { name: "Field Day" })).toBeVisible();
  });
});

describe("the Preferences window", () => {
  /** The window as a host keeps it: closed when it asks, with the settings it reported. */
  function Hosted({ onReport }: { onReport: (settings: TvSettings) => void }) {
    const [open, setOpen] = useState(true);
    return open ? (
      <TvPreferences onSettingsChange={onReport} onClose={() => setOpen(false)} />
    ) : (
      <p>closed</p>
    );
  }

  it("opens on the General pane of the captures, with the downloads unavailable", () => {
    render(<TvPreferences />);
    expect(screen.getByRole("dialog", { name: "General" })).toHaveFocus();
    expect(
      screen.getByRole("checkbox", { name: "Always check for available downloads" }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Checkboxes in library" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Movies" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("combobox", { name: "List Size:" })).toHaveTextContent("Medium");
  });

  it("reports the edited settings on OK, and nothing on Cancel or Escape", async () => {
    const user = userEvent.setup();
    const onReport = vi.fn();
    const { unmount } = render(<Hosted onReport={onReport} />);
    await user.click(screen.getByRole("checkbox", { name: "Checkboxes in library" }));
    await user.click(screen.getByRole("tab", { name: "Playback" }));
    expect(screen.getByRole("dialog", { name: "Playback" })).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: "Use the screen saver while paused" }));
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(onReport).toHaveBeenCalledExactlyOnceWith({
      ...defaultSettings,
      checkboxes: true,
      screenSaver: true,
    });
    expect(screen.getByText("closed")).toBeVisible();
    unmount();

    onReport.mockClear();
    const cancelled = render(<Hosted onReport={onReport} />);
    await user.click(screen.getByRole("checkbox", { name: "Checkboxes in library" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("closed")).toBeVisible();
    cancelled.unmount();

    render(<Hosted onReport={onReport} />);
    await user.click(screen.getByRole("checkbox", { name: "Checkboxes in library" }));
    await user.keyboard("{Escape}");
    expect(screen.getByText("closed")).toBeVisible();
    expect(onReport).not.toHaveBeenCalled();
  });

  it("opens with the settings it is given", () => {
    render(
      <TvPreferences settings={{ ...defaultSettings, checkboxes: true, listSize: "large" }} />,
    );
    expect(screen.getByRole("checkbox", { name: "Checkboxes in library" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "List Size:" })).toHaveTextContent("Large");
  });
});
