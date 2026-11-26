import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapView } from "./maps-geo";
import { OSM_COPYRIGHT, TileMap } from "./maps-tiles";

const BRIDGE = { lat: 37.818292, lon: -122.478384 };

beforeEach(() => {
  // jsdom lays nothing out: give every element the map's size.
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const map = () => screen.getByRole("application", { name: "Map" });
const tiles = () => Array.from(document.querySelectorAll<HTMLImageElement>(".mac-maps-tiles-tile"));

function renderMap(view: MapView, more: Partial<Parameters<typeof TileMap>[0]> = {}) {
  const onViewChange = vi.fn();
  render(<TileMap view={view} onViewChange={onViewChange} label="Map" {...more} />);
  return onViewChange;
}

describe("the tile map", () => {
  it("loads OpenStreetMap's tiles for the view and credits OpenStreetMap", () => {
    renderMap({ center: { lat: 0, lon: 0 }, zoom: 2 });
    // The whole world at zoom 2 is 4 by 4 tiles, and an 800 by 600 view needs all of them.
    expect(tiles()).toHaveLength(16);
    expect(tiles().map((tile) => tile.getAttribute("src"))).toContain(
      "https://tile.openstreetmap.org/2/0/0.png",
    );
    const credit = screen.getByRole("link", { name: "© OpenStreetMap contributors" });
    expect(credit).toHaveAttribute("href", OSM_COPYRIGHT);
    expect(map()).toHaveAttribute("aria-roledescription", "map");
  });

  it("loads no tile while the page is hidden", () => {
    const state = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    renderMap({ center: BRIDGE, zoom: 15 });
    expect(tiles()).toHaveLength(0);
    state.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(tiles().length).toBeGreaterThan(0);
  });

  it("runs an owner's handlers with its own, and lets one that prevents the default veto it", () => {
    const onKeyDown = vi.fn();
    const onPointerDown = vi.fn();
    const onViewChange = renderMap({ center: BRIDGE, zoom: 15 }, { onKeyDown, onPointerDown });
    // Both run: the owner hears the key, and the map still moves.
    fireEvent.keyDown(map(), { key: "ArrowLeft" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledTimes(1);
    // A drag still works with the owner's pointer handler beside it.
    fireEvent.pointerDown(map(), { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 200, clientY: 100 });
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onViewChange).toHaveBeenCalledTimes(2);
    fireEvent.pointerUp(map(), { pointerId: 1 });
  });

  it("does nothing with a key whose owner's handler prevented the default", () => {
    const onViewChange = renderMap(
      { center: BRIDGE, zoom: 15 },
      { onKeyDown: (event) => event.preventDefault() },
    );
    fireEvent.keyDown(map(), { key: "ArrowLeft" });
    fireEvent.keyDown(map(), { key: "+" });
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it("keeps its own size and tiles when its owner passes a ref, and sets that ref too", () => {
    const objectRef = createRef<HTMLDivElement>();
    const { unmount } = render(
      <TileMap
        view={{ center: { lat: 0, lon: 0 }, zoom: 2 }}
        onViewChange={vi.fn()}
        label="Map"
        ref={objectRef}
      />,
    );
    expect(tiles()).toHaveLength(16);
    expect(objectRef.current).toBe(map());
    unmount();
    expect(objectRef.current).toBeNull();
    // A callback ref is called with the element, and its cleanup when the map goes.
    const cleanup = vi.fn();
    const callback = vi.fn(() => cleanup);
    const second = render(
      <TileMap
        view={{ center: { lat: 0, lon: 0 }, zoom: 2 }}
        onViewChange={vi.fn()}
        label="Map"
        ref={callback}
      />,
    );
    expect(tiles()).toHaveLength(16);
    expect(callback).toHaveBeenCalledWith(map());
    second.unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("moves with a drag, but not with a click", () => {
    const onViewChange = renderMap({ center: BRIDGE, zoom: 15 });
    fireEvent.pointerDown(map(), { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 101, clientY: 100 });
    expect(onViewChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 200, clientY: 100 });
    const moved = onViewChange.mock.lastCall?.[0] as MapView;
    expect(moved.zoom).toBe(15);
    expect(moved.center.lon).toBeLessThan(BRIDGE.lon);
    expect(moved.center.lat).toBeCloseTo(BRIDGE.lat, 6);
    fireEvent.pointerUp(map(), { pointerId: 1 });
  });

  /** The map with an owner that keeps the view it asks for, as Maps and Find My do. */
  function renderOwned(start: MapView) {
    const asked: MapView[] = [];
    function Owner() {
      const [view, setView] = useState(start);
      return (
        <TileMap
          view={view}
          onViewChange={(next) => {
            asked.push(next);
            setView(next);
          }}
          label="Map"
        />
      );
    }
    render(<Owner />);
    return asked;
  }

  it("turned east up, draws its tiles turned, north to the left, and pans with the pointer", () => {
    const onViewChange = vi.fn();
    const placed: { x: number; y: number }[] = [];
    const view = { center: BRIDGE, zoom: 15 };
    render(
      <TileMap view={view} heading={90} onViewChange={onViewChange} label="Map">
        {(layer) => {
          placed.push(layer.project({ lat: BRIDGE.lat + 0.01, lon: BRIDGE.lon }));
          return null;
        }}
      </TileMap>,
    );
    const tiles = map().querySelector(".mac-maps-tiles-layer") as HTMLElement;
    expect(tiles.style.transform).toBe("rotate(-90deg)");
    const point = placed.at(-1) as { x: number; y: number };
    expect(point.x, "north is to the left").toBeLessThan(400 - 100);
    expect(point.y).toBeCloseTo(300, 3);
    fireEvent.pointerDown(map(), { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 200, clientY: 100 });
    const moved = onViewChange.mock.lastCall?.[0] as MapView;
    // The pointer goes right, towards south on this map: the map's middle goes north.
    expect(moved.center.lat).toBeGreaterThan(BRIDGE.lat);
    expect(moved.center.lon).toBeCloseTo(BRIDGE.lon, 6);
    fireEvent.pointerUp(map(), { pointerId: 1 });
  });

  it("keeps a zoom made during a drag, and pans on from it", () => {
    const asked = renderOwned({ center: BRIDGE, zoom: 15 });
    fireEvent.pointerDown(map(), { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 200, clientY: 100 });
    const panned = asked.at(-1) as MapView;
    fireEvent.wheel(map(), { deltaY: -100, clientX: 400, clientY: 300 });
    expect(asked.at(-1)?.zoom).toBe(16);
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 210, clientY: 100 });
    const after = asked.at(-1) as MapView;
    expect(after.zoom, "the drag does not undo the zoom").toBe(16);
    expect(after.center.lon).toBeLessThan(panned.center.lon);
    fireEvent.pointerUp(map(), { pointerId: 1 });
  });

  it("pans by each move once, also when moves come before the owner answers", () => {
    // An owner that never takes the view: every move pans on from the drag's own last view.
    const onViewChange = renderMap({ center: BRIDGE, zoom: 15 });
    fireEvent.pointerDown(map(), { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 150, clientY: 100 });
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 200, clientY: 100 });
    const twoSteps = onViewChange.mock.lastCall?.[0] as MapView;
    fireEvent.pointerUp(map(), { pointerId: 1 });
    // One move of the same 100 pixels from the same view ends at the same place.
    const onOneMove = vi.fn();
    render(
      <TileMap view={{ center: BRIDGE, zoom: 15 }} onViewChange={onOneMove} label="Other map" />,
    );
    const other = screen.getByRole("application", { name: "Other map" });
    fireEvent.pointerDown(other, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(other, { pointerId: 1, clientX: 200, clientY: 100 });
    const oneStep = onOneMove.mock.lastCall?.[0] as MapView;
    expect(twoSteps.center.lon).toBeCloseTo(oneStep.center.lon, 9);
    fireEvent.pointerUp(other, { pointerId: 1 });
  });

  it("takes no second pointer as a new drag while one is under way", () => {
    const asked = renderOwned({ center: BRIDGE, zoom: 15 });
    fireEvent.pointerDown(map(), { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 200, clientY: 100 });
    const count = asked.length;
    fireEvent.pointerDown(map(), { pointerId: 2, button: 0, clientX: 500, clientY: 300 });
    fireEvent.pointerMove(map(), { pointerId: 2, clientX: 700, clientY: 300 });
    expect(asked, "the second pointer moves nothing").toHaveLength(count);
    // The first drag goes on.
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 220, clientY: 100 });
    expect(asked).toHaveLength(count + 1);
    fireEvent.pointerUp(map(), { pointerId: 2 });
    fireEvent.pointerMove(map(), { pointerId: 1, clientX: 240, clientY: 100 });
    expect(asked, "lifting the second pointer does not end the first's drag").toHaveLength(
      count + 2,
    );
    fireEvent.pointerUp(map(), { pointerId: 1 });
    // Once it ends, a new press drags.
    fireEvent.pointerDown(map(), { pointerId: 2, button: 0, clientX: 500, clientY: 300 });
    fireEvent.pointerMove(map(), { pointerId: 2, clientX: 600, clientY: 300 });
    expect(asked).toHaveLength(count + 3);
    fireEvent.pointerUp(map(), { pointerId: 2 });
  });

  it("zooms with the wheel, a double-click and the keyboard", () => {
    const onViewChange = renderMap({ center: BRIDGE, zoom: 15 });
    const last = (): MapView => {
      const view = onViewChange.mock.lastCall?.[0];
      if (!view) throw new Error("the map asked for no view");
      return view as MapView;
    };
    fireEvent.wheel(map(), { deltaY: -100, clientX: 400, clientY: 300 });
    expect(last().zoom).toBe(16);
    fireEvent.wheel(map(), { deltaY: 100, clientX: 400, clientY: 300 });
    expect(last().zoom).toBe(14);
    fireEvent.doubleClick(map(), { clientX: 400, clientY: 300 });
    expect(last().zoom).toBe(16);
    fireEvent.keyDown(map(), { key: "-" });
    expect(last().zoom).toBe(14);
    fireEvent.keyDown(map(), { key: "ArrowRight" });
    expect(last().center.lon).toBeGreaterThan(BRIDGE.lon);
  });

  it("drops a pin where the context menu is asked for", () => {
    const onDropPin = vi.fn();
    renderMap({ center: BRIDGE, zoom: 15 }, { onDropPin });
    fireEvent.contextMenu(map(), { clientX: 400, clientY: 300 });
    const point = onDropPin.mock.lastCall?.[0];
    expect(point.lat).toBeCloseTo(BRIDGE.lat, 6);
    expect(point.lon).toBeCloseTo(BRIDGE.lon, 6);
  });

  it("draws the location and the owner's overlay where they are", () => {
    renderMap(
      { center: BRIDGE, zoom: 15 },
      {
        location: { ...BRIDGE, accuracy_m: 100 },
        children: (layer) => {
          const at = layer.project(BRIDGE);
          return <span data-testid="pin" style={{ left: at.x, top: at.y }} />;
        },
      },
    );
    const dot = document.querySelector<HTMLElement>(".mac-maps-tiles-location");
    expect(dot?.style.left).toBe("400px");
    expect(document.querySelector(".mac-maps-tiles-accuracy")).not.toBeNull();
    expect(screen.getByTestId("pin").style.top).toBe("300px");
  });
});
