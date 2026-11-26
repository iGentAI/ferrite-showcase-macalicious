import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, photosApp } from "./app";
import { Photos } from "./photos";
import {
  cellSize,
  countText,
  dateRange,
  defaultPhotos,
  fitted,
  matches,
  type Photo,
  photosOf,
} from "./photos-data";
import { DesktopPhotos } from "./photos-desktop";

/*
 * jsdom has no layout, so the grid is never measured: it is one column wide and renders its
 * first 40 rows, which is every picture of the library.
 */
const frame = (title = "My Albums") => screen.getByRole("region", { name: title });
const tree = () => screen.getByRole("tree", { name: "Library" });
const row = (name: string) => within(tree()).getByRole("treeitem", { name });
const rowNames = () =>
  within(tree())
    .getAllByRole("treeitem")
    .map((item) => item.textContent);
const heading = () => screen.getByRole("heading", { level: 1 });
const grid = (name = "Wallpapers") => screen.getByRole("listbox", { name });
const pictures = (name?: string) => within(grid(name)).queryAllByRole("option");
const picture = (name: string) => screen.getByRole("option", { name });
/** The drawing of a picture, which is what takes the pointer in its cell. */
const thumbnail = (name: string) =>
  picture(name).querySelector(".mac-photos-thumbnail") as HTMLElement;
const selection = () =>
  screen.queryAllByRole("option", { selected: true }).map((item) => item.textContent);
const button = (name: string) => screen.getByRole("button", { name });
const available = (control: HTMLElement) => control.getAttribute("aria-disabled") !== "true";
const field = () => screen.getByRole("searchbox", { name: "Search" });
const zoom = () => screen.getByRole("slider", { name: "Zoom" });
const showing = (choice = "All Items") => button(`Showing: ${choice}`);
const show = async (user: ReturnType<typeof userEvent.setup>, from: string, choice: string) => {
  await user.click(showing(from));
  await user.click(await screen.findByRole("menuitemradio", { name: choice }));
};

describe("the window", () => {
  it("opens on the album of the captures, at the captured size", () => {
    render(<Photos />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("1200px");
    expect(frame().style.height).toBe("720px");
    expect(row("Wallpapers")).toHaveAttribute("aria-selected", "true");
    expect(row("My Albums")).toHaveAttribute("aria-expanded", "true");
    expect(row("My Projects")).toHaveAttribute("aria-expanded", "false");
    expect(rowNames()).toEqual([
      "Photos",
      "Memories",
      "People",
      "Places",
      "Recents",
      "Imports",
      "Activity",
      "My Albums",
      "Wallpapers",
      "My Projects",
    ]);
    expect(heading()).toHaveTextContent("Wallpapers");
    expect(screen.getByText("May 2013 – September 2019")).toBeVisible();
    expect(screen.getByText("17 Photos")).toBeVisible();
    expect(button("Show as Memory")).toBeVisible();
    expect(button("Slideshow")).toBeVisible();
    expect(showing()).toBeVisible();
    expect(pictures()).toHaveLength(17);
    expect(selection()).toEqual([]);
    expect(field()).toHaveValue("");
    expect(zoom()).toHaveValue("50");
    // Back leads to the folder; nothing is selected for Favorite and Rotate to act on.
    expect(available(button("Back"))).toBe(true);
    expect(available(button("Info"))).toBe(true);
    expect(available(button("Share"))).toBe(true);
    expect(available(button("Favorite"))).toBe(false);
    expect(available(button("Rotate"))).toBe(false);
    // Info carries the library's outlined info mark, not a drawing of the demo's own.
    const mark = button("Info").querySelector("svg");
    expect(mark).toHaveClass("mac-system-image");
    expect(mark).toHaveAttribute("data-name", "info-outline");
    expect(mark).toHaveAttribute("aria-hidden", "true");
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(
      <Photos
        ref={ref}
        state="inactive"
        width={900}
        height="50vh"
        className="mine"
        data-kind="app"
        onClose={onClose}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-kind", "app");
    expect(frame().style.width).toBe("900px");
    expect(frame().style.height).toBe("50vh");
    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.dblClick(screen.getByText("My Albums", { selector: ".mac-title-bar-title *" }));
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("opens on another source and with another library", () => {
    const library: Photo[] = defaultPhotos.slice(0, 3).map((photo) => ({ ...photo, albums: [] }));
    render(<Photos photos={library} defaultSource="photos" defaultZoom={0} />);
    expect(frame("Photos")).toBeVisible();
    expect(pictures("Photos")).toHaveLength(3);
    expect(screen.getByText("3 Photos")).toBeVisible();
    expect(thumbnail("Disc 1").style.width).toBe("64px");
  });

  it("exports a descriptor a desktop can host", () => {
    expect(app).toBe(photosApp);
    expect(app.id).toBe("photos");
    expect(app.name).toBe("Photos");
    expect(app.component).toBe(DesktopPhotos);
    expect(app.defaultSize).toEqual({ width: 1200, height: 720 });
    expect(app.minSize.width).toBeLessThan(app.defaultSize.width);
    expect(app.resizable).toBe(true);
    expect(app.menus[0]).toBe("Photos");
  });
});

describe("the sidebar", () => {
  it("shows the whole library under Photos and the album again under Wallpapers", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(row("Photos"));
    expect(row("Photos")).toHaveAttribute("aria-selected", "true");
    expect(frame("Photos")).toBeVisible();
    expect(heading()).toHaveTextContent("Photos");
    expect(pictures("Photos")).toHaveLength(24);
    expect(screen.getByText("23 Photos, 1 Video")).toBeVisible();
    expect(screen.getByText("May 2013 – December 2019")).toBeVisible();
    // The two links belong to an album, and Back has nowhere to go from the library.
    expect(screen.queryByRole("button", { name: "Show as Memory" })).not.toBeInTheDocument();
    expect(available(button("Back"))).toBe(false);

    await user.click(row("Wallpapers"));
    expect(frame("My Albums")).toBeVisible();
    expect(heading()).toHaveTextContent("Wallpapers");
    expect(pictures()).toHaveLength(17);
    expect(available(button("Back"))).toBe(true);
  });

  it("lists the latest import and the items added last", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(row("Imports"));
    expect(pictures("Imports")).toHaveLength(7);
    expect(screen.getByText("6 Photos, 1 Video")).toBeVisible();
    await user.click(row("Recents"));
    expect(pictures("Recents")).toHaveLength(12);
    expect(pictures("Recents")[0]).toHaveTextContent("Squares 24");
  });

  it("says so where a source has nothing, and leaves the zoom slider without a use", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(row("People"));
    expect(frame("People")).toBeVisible();
    expect(screen.getByText("No People")).toBeVisible();
    // Announced, as the docs page says of every empty list.
    expect(screen.getByRole("status")).toHaveTextContent("No People");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(zoom()).toBeDisabled();
    await user.click(row("Memories"));
    expect(screen.getByRole("status")).toHaveTextContent("No Memories");
  });

  it("expands and collapses My Projects with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(row("My Projects"));
    expect(frame("My Projects")).toBeVisible();
    expect(rowNames()).not.toContain("Wallpaper Book");
    await user.keyboard("{ArrowRight}");
    expect(row("My Projects")).toHaveAttribute("aria-expanded", "true");
    expect(rowNames()).toContain("Wallpaper Book");
    // Right Arrow on an expanded row goes to its first child.
    await user.keyboard("{ArrowRight}");
    expect(row("Wallpaper Book")).toHaveAttribute("aria-selected", "true");
    expect(frame("My Projects")).toBeVisible();
    expect(heading()).toHaveTextContent("Wallpaper Book");
    expect(pictures("Wallpaper Book")).toHaveLength(5);
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(row("My Projects")).toHaveAttribute("aria-expanded", "false");
    expect(rowNames()).not.toContain("Wallpaper Book");
  });

  it("collapses My Albums onto the folder, whose album opens with a double click", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(row("Wallpapers"));
    // Left Arrow goes to the parent row, then collapses it.
    await user.keyboard("{ArrowLeft}");
    expect(row("My Albums")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(row("My Albums")).toHaveAttribute("aria-expanded", "false");
    expect(rowNames()).not.toContain("Wallpapers");
    // The folder lists its one album.
    expect(heading()).toHaveTextContent("My Albums");
    expect(screen.getByText("1 Album")).toBeVisible();
    expect(pictures("My Albums").map((item) => item.textContent)).toEqual(["Wallpapers"]);

    await user.dblClick(picture("Wallpapers").querySelector("svg") as SVGElement);
    expect(row("My Albums")).toHaveAttribute("aria-expanded", "true");
    expect(row("Wallpapers")).toHaveAttribute("aria-selected", "true");
    expect(pictures()).toHaveLength(17);
  });

  it("goes from an album to its folder with Back", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(button("Back"));
    expect(row("My Albums")).toHaveAttribute("aria-selected", "true");
    expect(heading()).toHaveTextContent("My Albums");
    expect(available(button("Back"))).toBe(false);
  });
});

describe("the selection", () => {
  it("makes Favorite and Rotate available, and Favorite marks and unmarks the pictures", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(thumbnail("Bands 2"));
    expect(selection()).toEqual(["Bands 2"]);
    expect(available(button("Favorite"))).toBe(true);
    expect(available(button("Rotate"))).toBe(true);
    expect(button("Favorite")).toHaveAttribute("aria-pressed", "false");

    await user.click(button("Favorite"));
    expect(button("Favorite")).toHaveAttribute("aria-pressed", "true");
    // Another picture is not a favorite; the two together are not all favorites.
    await user.click(thumbnail("Ring 4"));
    expect(button("Favorite")).toHaveAttribute("aria-pressed", "false");
    await user.keyboard("{Shift>}");
    await user.click(thumbnail("Bands 2"));
    await user.keyboard("{/Shift}");
    expect(selection()).toEqual(["Bands 2", "Triangle 3", "Ring 4"]);
    expect(button("Favorite")).toHaveAttribute("aria-pressed", "false");
    await user.click(button("Favorite"));
    expect(button("Favorite")).toHaveAttribute("aria-pressed", "true");
    await user.click(button("Favorite"));
    expect(button("Favorite")).toHaveAttribute("aria-pressed", "false");
  });

  it("turns the selected picture a quarter to the left with Rotate", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    // The first picture is 4:3: 128 by 96 pt in its cell, and 96 by 128 once turned.
    expect(thumbnail("Disc 1").style.width).toBe("128px");
    expect(thumbnail("Disc 1").style.height).toBe("96px");
    await user.click(thumbnail("Disc 1"));
    await user.click(button("Rotate"));
    expect(thumbnail("Disc 1").style.width).toBe("96px");
    expect(thumbnail("Disc 1").style.height).toBe("128px");
    expect(thumbnail("Bands 2").style.height).toBe("80px");
  });

  it("keeps the turns of pictures whose ids are names an object already has", async () => {
    const user = userEvent.setup();
    const ids = ["__proto__", "constructor", "toString"];
    const library: Photo[] = ids.map((id, index) => ({
      ...(defaultPhotos[0] as Photo),
      id,
      title: `Odd ${index + 1}`,
      favorite: false,
    }));
    render(<Photos photos={library} defaultSource="photos" />);
    // Nothing is turned yet: no picture counts as edited.
    await show(user, "All Items", "Edited");
    expect(screen.getByRole("status")).toHaveTextContent("No Edited Photos");
    await show(user, "Edited", "All Items");
    for (const title of ["Odd 1", "Odd 2", "Odd 3"]) {
      expect(thumbnail(title).style.width).toBe("128px");
      expect(thumbnail(title).style.height).toBe("96px");
    }
    // Each turns on its own, and four turns bring it back.
    await user.click(thumbnail("Odd 1"));
    await user.click(button("Rotate"));
    expect(thumbnail("Odd 1").style.width).toBe("96px");
    expect(thumbnail("Odd 2").style.width).toBe("128px");
    await user.click(thumbnail("Odd 2"));
    await user.click(button("Rotate"));
    expect(thumbnail("Odd 2").style.width).toBe("96px");
    await show(user, "All Items", "Edited");
    expect(pictures("Photos").map((item) => item.textContent)).toEqual(["Odd 1", "Odd 2"]);
    await show(user, "Edited", "All Items");
    await user.click(thumbnail("Odd 1"));
    for (let turn = 0; turn < 3; turn++) await user.click(button("Rotate"));
    expect(thumbnail("Odd 1").style.width).toBe("128px");
    expect(thumbnail("Odd 3").style.width).toBe("128px");
    // The prototype of plain objects is untouched.
    expect(({} as Record<string, unknown>).constructor).toBe(Object);
  });

  it("is dropped by a click beside the pictures and by another source", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(thumbnail("Disc 1"));
    await user.click(grid());
    expect(selection()).toEqual([]);
    expect(available(button("Rotate"))).toBe(false);
    await user.click(thumbnail("Disc 1"));
    await user.click(row("Photos"));
    expect(selection()).toEqual([]);
  });

  it("describes the selection, or else the album, in the Info popover", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(button("Info"));
    const album = await screen.findByRole("dialog", { name: "Wallpapers" });
    expect(within(album).getByText("17 Photos")).toBeVisible();
    await user.keyboard("{Escape}");

    await user.click(thumbnail("Disc 1"));
    await user.click(button("Info"));
    const one = await screen.findByRole("dialog", { name: "Disc 1" });
    expect(within(one).getByText("May 20, 2013")).toBeVisible();
    expect(within(one).getByText("Photo, 4032 × 3024")).toBeVisible();
  });

  it("shares the selected pictures, or else the listed ones, through the chosen service", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(<Photos onShare={onShare} />);
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Mail" }));
    expect(onShare).toHaveBeenLastCalledWith("mail", photosOf("wallpapers", defaultPhotos, null));

    await user.click(thumbnail("Ring 4"));
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Notes" }));
    expect(onShare).toHaveBeenLastCalledWith("notes", [defaultPhotos[3]]);
  });
});

describe("the zoom slider", () => {
  it("makes the thumbnails larger and smaller", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    expect(thumbnail("Squares 6").style.width).toBe("128px");
    expect(thumbnail("Squares 6").style.height).toBe("80px");
    zoom().focus();
    await user.keyboard("{End}");
    expect(zoom()).toHaveValue("100");
    expect(thumbnail("Squares 6").style.width).toBe("256px");
    expect(thumbnail("Squares 6").style.height).toBe("160px");
    await user.keyboard("{Home}");
    expect(thumbnail("Squares 6").style.width).toBe("64px");
    await user.keyboard("{ArrowRight}");
    expect(zoom()).toHaveValue("5");
    expect(thumbnail("Squares 6").style.width).toBe("69px");
  });
});

describe("the search field", () => {
  it("lists the pictures whose title, keywords or month start with what is typed", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.type(field(), "disc");
    expect(pictures().map((item) => item.textContent)).toEqual(["Disc 1", "Disc 7", "Disc 13"]);
    expect(screen.getByText("3 Photos")).toBeVisible();
    // The header still names the whole album's months.
    expect(screen.getByText("May 2013 – September 2019")).toBeVisible();

    await user.clear(field());
    await user.type(field(), "june 2015");
    expect(pictures().map((item) => item.textContent)).toEqual(["Disc 7"]);

    await user.click(button("Clear"));
    expect(field()).toHaveValue("");
    expect(pictures()).toHaveLength(17);
  });

  it("says so when nothing is found", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.type(field(), "zebra");
    expect(screen.getByRole("status")).toHaveTextContent("No Results");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("0 Photos")).toBeVisible();
    expect(available(button("Share"))).toBe(false);
  });
});

describe("the Showing menu", () => {
  it("narrows the album to the favorites, the edited pictures or one kind", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(thumbnail("Triangle 3"));
    await user.click(button("Favorite"));
    await user.click(thumbnail("Diagonal 5"));
    await user.click(button("Rotate"));

    await show(user, "All Items", "Favorites");
    expect(showing("Favorites")).toBeVisible();
    expect(pictures().map((item) => item.textContent)).toEqual(["Triangle 3"]);
    expect(screen.getByText("1 Photo")).toBeVisible();

    await show(user, "Favorites", "Edited");
    expect(pictures().map((item) => item.textContent)).toEqual(["Diagonal 5"]);

    await show(user, "Edited", "Videos");
    expect(screen.getByRole("status")).toHaveTextContent("No Videos");

    await show(user, "Videos", "Photos");
    expect(pictures()).toHaveLength(17);
    await show(user, "Photos", "All Items");
    expect(pictures()).toHaveLength(17);
  });

  it("drops a picture from Favorites when it stops being one", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(thumbnail("Ring 4"));
    await user.click(button("Favorite"));
    await show(user, "All Items", "Favorites");
    await user.click(thumbnail("Ring 4"));
    await user.click(button("Favorite"));
    expect(screen.getByRole("status")).toHaveTextContent("No Favorites");
  });

  it("finds the one video of the library", async () => {
    const user = userEvent.setup();
    render(<Photos defaultSource="photos" />);
    await show(user, "All Items", "Videos");
    // The thumbnail of a video carries its length.
    expect(pictures("Photos")).toHaveLength(1);
    expect(within(picture("Bands 20")).getByText("0:12")).toBeVisible();
    expect(screen.getByText("1 Video")).toBeVisible();
  });
});

describe("an open picture", () => {
  it("fills the pane after a double click, and Back returns to the album with it selected", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.dblClick(thumbnail("Triangle 3"));
    expect(screen.getByRole("img", { name: "Triangle 3" })).toBeVisible();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    // The title names where Back goes, and the keyboard is on Back.
    expect(frame("Wallpapers")).toBeVisible();
    expect(button("Back")).toHaveFocus();
    expect(zoom()).toBeDisabled();
    expect(available(button("Favorite"))).toBe(true);
    expect(available(button("Rotate"))).toBe(true);

    await user.click(button("Back"));
    expect(screen.queryByRole("img", { name: "Triangle 3" })).not.toBeInTheDocument();
    expect(frame("My Albums")).toBeVisible();
    expect(pictures()).toHaveLength(17);
    expect(selection()).toEqual(["Triangle 3"]);
    expect(grid()).toHaveFocus();
  });

  it("closes for good when a search leaves it out, and the keyboard stays in the field", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.dblClick(thumbnail("Disc 1"));
    expect(screen.getByRole("img", { name: "Disc 1" })).toBeVisible();
    await user.type(field(), "bands");
    expect(screen.queryByRole("img", { name: "Disc 1" })).not.toBeInTheDocument();
    expect(pictures().length).toBeGreaterThan(0);
    expect(field()).toHaveFocus();
    // Emptying the field brings the album back, not the picture.
    await user.clear(field());
    expect(screen.queryByRole("img", { name: "Disc 1" })).not.toBeInTheDocument();
    expect(pictures()).toHaveLength(17);
    expect(field()).toHaveFocus();
  });

  it("leaves the keyboard in the sidebar when a source chosen there closes it", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.dblClick(thumbnail("Disc 1"));
    expect(button("Back")).toHaveFocus();
    await user.click(row("Recents"));
    expect(screen.queryByRole("img", { name: "Disc 1" })).not.toBeInTheDocument();
    expect(tree().contains(document.activeElement)).toBe(true);
  });

  it("opens with Return and takes Favorite", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(thumbnail("Disc 1"));
    await user.keyboard("{ArrowRight}{Enter}");
    expect(screen.getByRole("img", { name: "Bands 2" })).toBeVisible();
    await user.click(button("Favorite"));
    expect(button("Favorite")).toHaveAttribute("aria-pressed", "true");
    await user.click(button("Back"));
    await show(user, "All Items", "Favorites");
    expect(pictures().map((item) => item.textContent)).toEqual(["Bands 2"]);
  });

  it("closes when another source is chosen", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.dblClick(thumbnail("Disc 1"));
    await user.click(row("Imports"));
    expect(screen.queryByRole("img", { name: "Disc 1" })).not.toBeInTheDocument();
    expect(pictures("Imports")).toHaveLength(7);
  });
});

describe("the album's links", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the album under Memories", async () => {
    const user = userEvent.setup();
    render(<Photos />);
    await user.click(button("Show as Memory"));
    expect(row("Memories")).toHaveAttribute("aria-selected", "true");
    expect(frame("Memories")).toBeVisible();
    expect(heading()).toHaveTextContent("Wallpapers");
    expect(pictures()).toHaveLength(17);
  });

  it("plays a slideshow from the first picture, three seconds each, until Back", () => {
    vi.useFakeTimers();
    render(<Photos />);
    fireEvent.click(button("Slideshow"));
    expect(screen.getByRole("img", { name: "Disc 1" })).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole("img", { name: "Bands 2" })).toBeVisible();
    fireEvent.click(button("Back"));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(selection()).toEqual(["Bands 2"]);
    expect(screen.queryByRole("img", { name: "Triangle 3" })).not.toBeInTheDocument();
  });
});

describe("the data", () => {
  const album = photosOf("wallpapers", defaultPhotos, null) ?? [];

  it("holds the 17 pictures of the captured album in the shapes measured there", () => {
    expect(album).toHaveLength(17);
    const sizes = album.map((photo) => fitted(photo, 128));
    // Rows of 7, 7 and 3 in the captures: 4:3 and 16:10, then 16:9 with one 16:10, then
    // 16:9 and two squares.
    expect(sizes.map((size) => size.width)).toEqual(Array(17).fill(128));
    expect(sizes.map((size) => size.height)).toEqual([
      96, 80, 80, 80, 80, 80, 80, 72, 72, 72, 80, 72, 72, 72, 72, 128, 128,
    ]);
    expect(dateRange(album)).toBe("May 2013 – September 2019");
    expect(countText(album)).toBe("17 Photos");
  });

  it("fits a picture into its cell by its longer side, and swaps the sides of a turned one", () => {
    const tall = defaultPhotos.find((photo) => photo.height > photo.width) as Photo;
    expect(fitted(tall, 128)).toEqual({ width: 96, height: 128 });
    expect(fitted(tall, 128, 1)).toEqual({ width: 128, height: 96 });
    expect(fitted(tall, 128, 2)).toEqual({ width: 96, height: 128 });
  });

  it("maps the zoom slider to cells of 64 to 256 pt, 128 pt in the middle", () => {
    expect([0, 50, 100].map(cellSize)).toEqual([64, 128, 256]);
    expect(cellSize(-10)).toBe(64);
    expect(cellSize(400)).toBe(256);
  });

  it("matches the start of every typed word, whatever its case", () => {
    const first = defaultPhotos[0] as Photo;
    expect(matches(first, "")).toBe(true);
    expect(matches(first, "  DI ")).toBe(true);
    expect(matches(first, "may 2013")).toBe(true);
    expect(matches(first, "isc")).toBe(false);
    expect(matches(first, "disc 2014")).toBe(false);
  });

  it("lists nothing for a source that is not a collection, and a memory once there is one", () => {
    expect(photosOf("people", defaultPhotos, null)).toBeNull();
    expect(photosOf("my-albums", defaultPhotos, null)).toBeNull();
    expect(photosOf("memories", defaultPhotos, null)).toBeNull();
    expect(photosOf("memories", defaultPhotos, "wallpapers")).toEqual(album);
    expect(photosOf("wallpaper-book", defaultPhotos, null)).toHaveLength(5);
  });
});
