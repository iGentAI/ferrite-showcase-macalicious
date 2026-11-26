import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { app, mapsApp } from "./app";
import { Maps } from "./maps";
import { APPLE_PARK, defaultPlaces, scaleOf, searchPlaces } from "./maps-data";
import { DesktopMaps } from "./maps-desktop";

const frame = () => screen.getByRole("region", { name: "Maps" });
const toolbar = () => within(screen.getByRole("toolbar", { name: "Toolbar" }));
const field = () => screen.getByRole("searchbox", { name: "Search for a place or address" });
const mapType = (name: string) =>
  within(screen.getByRole("group", { name: "Map type" })).getByRole("button", { name });
const tabs = () => within(screen.getByRole("tablist", { name: "Tabs" })).getAllByRole("tab");
const selectedTab = () => tabs().find((tab) => tab.getAttribute("aria-selected") === "true");
const map = () => screen.getByRole("img", { name: /placeholder for a map/ });
const pin = (name: string) => screen.queryByRole("button", { name });
const card = (name: string) => screen.queryByRole("dialog", { name });
const zoomIn = () => screen.getByRole("button", { name: "Zoom in" });
const zoomOut = () => screen.getByRole("button", { name: "Zoom out" });
/** How the drawing is placed: its scale, and the point of the map at the view's middle. */
const placed = () => document.querySelector(".mac-maps-art > g")?.getAttribute("transform");
/** The route as it is drawn, or null when none is. */
const route = () => document.querySelector(".mac-maps-art-route")?.getAttribute("d") ?? null;

type User = ReturnType<typeof userEvent.setup>;
const search = async (user: User, text: string) => {
  await user.clear(field());
  await user.type(field(), `${text}{Enter}`);
};
const openCard = async (user: User, name: string) => {
  await user.click(pin(name) as HTMLElement);
  return within(card(name) as HTMLElement);
};

describe("the window", () => {
  it("opens on the place of the captures, at the captured size, with its card closed", () => {
    render(<Maps />);
    expect(frame()).toHaveClass("mac-window");
    expect(frame().style.width).toBe("1000px");
    expect(frame().style.height).toBe("690px");
    expect(field()).toHaveValue("Apple Park");
    expect(mapType("Map")).toHaveAttribute("aria-pressed", "true");
    expect(tabs().map((tab) => tab.textContent)).toEqual([
      "Cupertino — Santa Clara",
      "Manhattan — Jersey City",
    ]);
    expect(selectedTab()).toHaveTextContent("Cupertino — Santa Clara");
    expect(map()).toHaveAccessibleName(/Map of Cupertino — Santa Clara, zoom 100%/);
    expect(pin("Apple Park")).toBeVisible();
    expect(card("Apple Park")).not.toBeInTheDocument();
    const weather = within(screen.getByRole("group", { name: "Weather" }));
    expect(weather.getByText("72°")).toBeVisible();
    expect(weather.getByText("AQI 49")).toBeVisible();
  });

  it("opens the card at once when asked to, and shows no weather when given none", async () => {
    render(<Maps defaultCardOpen weather={null} />);
    expect(await screen.findByRole("dialog", { name: "Apple Park" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "Weather" })).not.toBeInTheDocument();
  });

  it("passes window props to the library window and the hosting callbacks to its parts", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLDivElement>();
    const onClose = vi.fn();
    const onMinimize = vi.fn();
    render(
      <Maps
        ref={ref}
        state="inactive"
        width={720}
        height="50vh"
        className="mine"
        data-kind="app"
        onClose={onClose}
        onMinimize={onMinimize}
      />,
    );
    expect(ref.current).toBe(frame());
    expect(frame()).toHaveClass("mac-window", "mine");
    expect(frame()).toHaveAttribute("data-window-state", "inactive");
    expect(frame()).toHaveAttribute("data-kind", "app");
    expect(frame().style.width).toBe("720px");
    expect(frame().style.height).toBe("50vh");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Minimize" }));
    expect(onMinimize).toHaveBeenCalledTimes(1);
  });

  it("exports a descriptor a desktop can host", () => {
    expect(app).toBe(mapsApp);
    expect(app.id).toBe("maps");
    expect(app.name).toBe("Maps");
    expect(app.component).toBe(DesktopMaps);
    expect(app.defaultSize).toEqual({ width: 1000, height: 690 });
    expect(app.menus[0]).toBe("Maps");
  });
});

describe("the map type", () => {
  it("switches between Map, Transit and Satellite, and never has none selected", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    await user.click(mapType("Transit"));
    expect(mapType("Transit")).toHaveAttribute("aria-pressed", "true");
    expect(mapType("Map")).toHaveAttribute("aria-pressed", "false");
    expect(map()).toHaveAccessibleName(/Transit of Cupertino/);

    await user.click(mapType("Satellite"));
    expect(mapType("Satellite")).toHaveAttribute("aria-pressed", "true");
    expect(mapType("Transit")).toHaveAttribute("aria-pressed", "false");
    expect(map()).toHaveAccessibleName(/Satellite of Cupertino/);

    await user.click(mapType("Satellite"));
    expect(mapType("Satellite")).toHaveAttribute("aria-pressed", "true");
  });

  it("belongs to the tab: another tab keeps its own", async () => {
    const user = userEvent.setup();
    render(<Maps defaultMapType="satellite" />);
    expect(mapType("Satellite")).toHaveAttribute("aria-pressed", "true");
    await user.click(tabs()[1] as HTMLElement);
    expect(mapType("Map")).toHaveAttribute("aria-pressed", "true");
    await user.click(tabs()[0] as HTMLElement);
    expect(mapType("Satellite")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("tabs", () => {
  it("shows each tab's own search, place and part of the map", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    await user.click(tabs()[1] as HTMLElement);
    expect(selectedTab()).toHaveTextContent("Manhattan — Jersey City");
    expect(field()).toHaveValue("");
    expect(pin("Apple Park")).not.toBeInTheDocument();
    expect(map()).toHaveAccessibleName(/Map of Manhattan — Jersey City/);

    await user.click(tabs()[0] as HTMLElement);
    expect(field()).toHaveValue("Apple Park");
    expect(pin("Apple Park")).toBeVisible();
  });

  it("closes a tab with its close button and brings its neighbour to the front", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    await user.click(screen.getByRole("button", { name: "Close Cupertino — Santa Clara" }));
    expect(tabs().map((tab) => tab.textContent)).toEqual(["Manhattan — Jersey City"]);
    expect(selectedTab()).toHaveTextContent("Manhattan — Jersey City");
    expect(field()).toHaveValue("");
    // The last tab stays: it has no close button, and Delete does not close it.
    expect(screen.queryByRole("button", { name: /^Close Manhattan/ })).not.toBeInTheDocument();
    (tabs()[0] as HTMLElement).focus();
    await user.keyboard("{Delete}");
    expect(tabs()).toHaveLength(1);
  });

  it("closes the tab that has the keyboard with Delete", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    (tabs()[1] as HTMLElement).focus();
    await user.keyboard("{Delete}");
    expect(tabs().map((tab) => tab.textContent)).toEqual(["Cupertino — Santa Clara"]);
    expect(pin("Apple Park")).toBeVisible();
  });

  it("opens a new tab on the same part of the map, without the search", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    await user.click(screen.getByRole("button", { name: "New Tab" }));
    expect(tabs()).toHaveLength(3);
    expect(selectedTab()).toBe(tabs()[2]);
    expect(selectedTab()).toHaveTextContent("Cupertino — Santa Clara");
    expect(field()).toHaveValue("");
    expect(pin("Apple Park")).not.toBeInTheDocument();

    await user.click(tabs()[0] as HTMLElement);
    expect(pin("Apple Park")).toBeVisible();
  });

  it("reports the place of the tab in front when the tabs change it", async () => {
    const user = userEvent.setup();
    const onPlaceChange = vi.fn();
    render(<Maps onPlaceChange={onPlaceChange} />);
    expect(onPlaceChange).not.toHaveBeenCalled();
    await user.click(tabs()[1] as HTMLElement);
    expect(onPlaceChange).toHaveBeenLastCalledWith(null);
    await user.click(tabs()[0] as HTMLElement);
    expect(onPlaceChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: "apple-park" }));
    await user.click(screen.getByRole("button", { name: "New Tab" }));
    expect(onPlaceChange).toHaveBeenLastCalledWith(null);
    await user.click(tabs()[0] as HTMLElement);
    expect(onPlaceChange).toHaveBeenCalledTimes(4);
    // Closing the tab in front brings one without a place to the front. The new tab has
    // the first one's title, so there are two such close buttons: the first is the first's.
    await user.click(
      screen.getAllByRole("button", { name: "Close Cupertino — Santa Clara" })[0] as HTMLElement,
    );
    expect(onPlaceChange).toHaveBeenCalledTimes(5);
    expect(onPlaceChange).toHaveBeenLastCalledWith(null);
  });

  it("reports the place with the pin again when the places give it other details", () => {
    const onPlaceChange = vi.fn();
    const { rerender } = render(<Maps onPlaceChange={onPlaceChange} />);
    // The same places as other objects are no change, in whatever order their keys are.
    rerender(
      <Maps places={defaultPlaces.map((item) => ({ ...item }))} onPlaceChange={onPlaceChange} />,
    );
    const reordered = defaultPlaces.map(
      (item) =>
        ({
          ...Object.fromEntries(Object.entries(item).reverse()),
          coordinate: { y: item.coordinate.y, x: item.coordinate.x },
        }) as typeof item,
    );
    expect(Object.keys(reordered[0] ?? {})).not.toEqual(Object.keys(defaultPlaces[0] ?? {}));
    rerender(<Maps places={reordered} onPlaceChange={onPlaceChange} />);
    expect(onPlaceChange).not.toHaveBeenCalled();
    const moved = { ...APPLE_PARK, coordinate: { x: 1100, y: 800 } };
    rerender(<Maps places={[moved]} onPlaceChange={onPlaceChange} />);
    expect(onPlaceChange).toHaveBeenCalledTimes(1);
    expect(onPlaceChange).toHaveBeenLastCalledWith(moved);
  });

  it("opens a new tab without the note of the last search", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    await search(user, "zebra");
    expect(screen.getByRole("status")).toHaveTextContent("No Results Found");
    await user.click(screen.getByRole("button", { name: "New Tab" }));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("searching", () => {
  it("puts the pin on the best match at Return and opens its place card", async () => {
    const user = userEvent.setup();
    const onPlaceChange = vi.fn();
    render(<Maps onPlaceChange={onPlaceChange} />);
    await search(user, "theater");
    expect(pin("Steve Jobs Theater")).toBeVisible();
    expect(pin("Apple Park")).not.toBeInTheDocument();
    const shown = within(card("Steve Jobs Theater") as HTMLElement);
    expect(shown.getByText("Theater · 1,786 mi")).toBeVisible();
    expect(shown.queryByText("Address")).not.toBeInTheDocument();
    expect(onPlaceChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "steve-jobs-theater" }),
    );
    // The map is moved so that the place, at 1090, 1010, stands 1 pt right of the view's
    // middle and 62.5 pt above it.
    expect(placed()).toBe("scale(1) translate(-1089 -1072.5)");
  });

  it("takes the best of several matches, not the first in the list", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    // "Steve Jobs Theater" has a word that starts with it and comes first in the list;
    // "Tantau Reception Center" starts with it.
    await search(user, "t");
    expect(pin("Tantau Reception Center")).toBeVisible();
    expect(pin("Steve Jobs Theater")).not.toBeInTheDocument();
    expect(placed()).toBe("scale(1) translate(-1149 -992.5)");
  });

  it("says so when nothing is found, and takes the pin away", async () => {
    const user = userEvent.setup();
    const onPlaceChange = vi.fn();
    render(<Maps onPlaceChange={onPlaceChange} />);
    await search(user, "zebra");
    expect(screen.getByRole("status")).toHaveTextContent("No Results Found");
    expect(pin("Apple Park")).not.toBeInTheDocument();
    expect(onPlaceChange).toHaveBeenLastCalledWith(null);

    await user.type(field(), "{Backspace}");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("takes the pin away when the field is cleared", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(field()).toHaveValue("");
    expect(pin("Apple Park")).not.toBeInTheDocument();
    expect(toolbar().getByRole("button", { name: "Directions" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("ranks a name that starts with the text before one that only contains it", () => {
    expect(searchPlaces(defaultPlaces, "apple").map((place) => place.id)).toEqual([
      "apple-park",
      "visitor-center",
    ]);
    expect(searchPlaces(defaultPlaces, "PARK").map((place) => place.id)).toEqual([
      "apple-park",
      "visitor-center",
      "westwood-oaks-park",
    ]);
    expect(searchPlaces(defaultPlaces, "  ")).toEqual([]);
    expect(searchPlaces([APPLE_PARK], "zebra")).toEqual([]);
  });
});

describe("the place card", () => {
  it("opens from the pin and shows what the captures' card shows", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    const shown = await openCard(user, "Apple Park");
    expect(shown.getByRole("heading", { name: "Apple Park" })).toBeVisible();
    expect(shown.getByText("Corporate Headquarters · 1,786 mi")).toBeVisible();
    expect(shown.getByRole("button", { name: "Directions" })).toBeEnabled();
    expect(shown.getByRole("button", { name: "Call" })).toBeDisabled();
    expect(
      shown.getAllByRole("img", { name: "Abstract placeholder for a photograph" }),
    ).toHaveLength(3);
    expect(shown.getByText("One Apple Park Way")).toBeVisible();
    expect(shown.getByText("+1 (408) 996-1010")).toBeVisible();
    expect(shown.getByRole("link", { name: "apple.com" })).toHaveAttribute(
      "href",
      "https://www.apple.com/",
    );
    expect(shown.getByRole("link", { name: "Open Wikipedia" })).toHaveAttribute(
      "href",
      "https://en.wikipedia.org/wiki/Apple_Park",
    );
    expect(shown.getByRole("link", { name: "More Photos on Wikipedia" })).toBeVisible();
  });

  it("closes with Escape and with a press outside it, and the pin stays", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    await openCard(user, "Apple Park");
    await user.keyboard("{Escape}");
    expect(card("Apple Park")).not.toBeInTheDocument();
    expect(pin("Apple Park")).toBeVisible();

    await openCard(user, "Apple Park");
    await user.click(field());
    expect(card("Apple Park")).not.toBeInTheDocument();
    expect(pin("Apple Park")).toBeVisible();
  });

  it("closes when another tab comes to the front", async () => {
    const user = userEvent.setup();
    render(<Maps defaultCardOpen />);
    expect(await screen.findByRole("dialog", { name: "Apple Park" })).toBeVisible();
    await user.click(tabs()[1] as HTMLElement);
    expect(card("Apple Park")).not.toBeInTheDocument();
    await user.click(tabs()[0] as HTMLElement);
    expect(card("Apple Park")).not.toBeInTheDocument();
    expect(pin("Apple Park")).toBeVisible();
  });

  it("draws the route and closes when Directions is chosen; the toolbar button takes it away", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    const directions = () => toolbar().getByRole("button", { name: "Directions" });
    expect(directions()).toHaveAttribute("aria-pressed", "false");
    expect(route()).toBeNull();
    const shown = await openCard(user, "Apple Park");
    await user.click(shown.getByRole("button", { name: "Directions" }));
    expect(card("Apple Park")).not.toBeInTheDocument();
    expect(directions()).toHaveAttribute("aria-pressed", "true");
    // An elbow from the current location, at 640, 1040, to the place, at 1000, 700.
    expect(route()).toBe("M640 1040H1000V700");

    await user.click(directions());
    expect(directions()).toHaveAttribute("aria-pressed", "false");
    expect(route()).toBeNull();

    // The route ends at the place that has the pin: another place, another end.
    await search(user, "theater");
    await user.click(
      within(card("Steve Jobs Theater") as HTMLElement).getByRole("button", {
        name: "Directions",
      }),
    );
    expect(route()).toBe("M640 1040H1090V1010");
  });

  it("marks the place a favourite and reports a share", async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(<Maps onShare={onShare} />);
    const shown = await openCard(user, "Apple Park");
    const favorite = shown.getByRole("button", { name: "Favorite" });
    expect(favorite).toHaveAttribute("aria-pressed", "false");
    await user.click(favorite);
    expect(favorite).toHaveAttribute("aria-pressed", "true");

    await user.click(shown.getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: "Messages" }));
    expect(onShare).toHaveBeenCalledWith("Messages", expect.objectContaining({ id: "apple-park" }));
  });
});

describe("the map's controls", () => {
  it("zooms in and out by half steps, between its two limits", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    expect(scaleOf(2)).toBe(2);
    await user.click(zoomIn());
    expect(map()).toHaveAccessibleName(/zoom 141%/);
    await user.click(zoomIn());
    expect(map()).toHaveAccessibleName(/zoom 200%/);
    await user.click(zoomIn());
    await user.click(zoomIn());
    expect(map()).toHaveAccessibleName(/zoom 400%/);
    expect(zoomIn()).toHaveAttribute("aria-disabled", "true");
    await user.click(zoomIn());
    expect(map()).toHaveAccessibleName(/zoom 400%/);

    await user.click(zoomOut());
    expect(map()).toHaveAccessibleName(/zoom 283%/);
    expect(zoomIn()).not.toHaveAttribute("aria-disabled", "true");
    for (let step = 0; step < 7; step++) await user.click(zoomOut());
    expect(map()).toHaveAccessibleName(/zoom 25%/);
    expect(zoomOut()).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the zoom of each tab", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    await user.click(zoomIn());
    await user.click(tabs()[1] as HTMLElement);
    expect(map()).toHaveAccessibleName(/zoom 100%/);
    await user.click(tabs()[0] as HTMLElement);
    expect(map()).toHaveAccessibleName(/zoom 141%/);
  });

  it("shows the scale from the Show menu, and the scale follows the zoom", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    expect(screen.queryByText("500 ft")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Scale" }));
    expect(screen.getByText("500 ft")).toBeVisible();
    await user.click(zoomIn());
    expect(screen.getByText("350 ft")).toBeVisible();
    for (let step = 0; step < 5; step++) await user.click(zoomOut());
    expect(screen.getByText("2000 ft")).toBeVisible();
  });

  it("switches 3D from the compass and from the Show menu alike", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    const pitch = screen.getByRole("button", { name: "3D" });
    expect(pitch).toHaveAttribute("aria-pressed", "false");
    await user.click(pitch);
    expect(pitch).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Show" }));
    const item = await screen.findByRole("menuitemcheckbox", { name: "3D Map" });
    expect(item).toHaveAttribute("aria-checked", "true");
    await user.click(item);
    expect(pitch).toHaveAttribute("aria-pressed", "false");
  });

  it("moves the map to the current location and says so", async () => {
    const user = userEvent.setup();
    render(<Maps />);
    expect(placed()).toBe("scale(1) translate(-999 -761.5)");
    await user.click(screen.getByRole("button", { name: "Show Your Current Location" }));
    expect(screen.getByRole("status")).toHaveTextContent("Current Location");
    expect(placed()).toBe("scale(1) translate(-640 -1040)");
    expect(pin("Apple Park")).toBeVisible();
  });
});
