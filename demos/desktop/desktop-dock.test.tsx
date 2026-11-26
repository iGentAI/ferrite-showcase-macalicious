import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { Dock } from "macalicious/dock";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DockAppTile,
  dockLayout,
  dropOf,
  useDockApps,
  useDockAutoHide,
  useDockDrag,
} from "./desktop-dock";
import {
  beginDesktopValues,
  connectDesktopValues,
  DOCK_ORDER,
  DOCK_REMOVED,
  desktopValues,
  dockPreferences,
} from "./desktop-personal";

afterEach(() => {
  cleanup();
  // An empty page copy, with no change waiting to be saved, no session connected and none ended.
  connectDesktopValues(() => {})();
  beginDesktopValues();
});

describe("the person's Dock apps", () => {
  const installed = ["notes", "safari", "music"];

  it("moves, removes and keeps apps, and keeps the arrangement with the settings", () => {
    const { result } = renderHook(() => useDockApps(installed));
    expect(result.current.docked).toEqual(installed);
    act(() => result.current.move("music", 0));
    expect(result.current.docked).toEqual(["music", "notes", "safari"]);
    expect(desktopValues()[DOCK_ORDER]).toEqual(["music", "notes", "safari"]);
    act(() => result.current.remove("notes"));
    expect(result.current.docked).toEqual(["music", "safari"]);
    expect(desktopValues()[DOCK_REMOVED]).toEqual(["notes"]);
    act(() => result.current.keep("notes"));
    expect(result.current.docked).toEqual(["music", "safari", "notes"]);
    expect(desktopValues()[DOCK_REMOVED]).toEqual([]);
  });
});

describe("the Dock's layout", () => {
  it("keeps windows clear of the Dock's edge, and of nothing while it hides itself", () => {
    expect(dockLayout(dockPreferences({}), 10, 22).insets).toEqual({
      bottom: 80,
      left: 0,
      right: 0,
    });
    expect(dockLayout(dockPreferences({ "dock.position": "left" }), 10, 22).insets).toEqual({
      bottom: 0,
      left: 80,
      right: 0,
    });
    expect(
      dockLayout(dockPreferences({ "dock.position": "right", "dock.autohide": true }), 10, 22)
        .insets,
    ).toEqual({ bottom: 0, left: 0, right: 0 });
    expect(dockLayout(dockPreferences({ "dock.size": 0 }), 10, 22).style).toEqual({
      "--mac-dock-tile-size": "clamp(12px, calc((100cqw - 24px) / 10 - 4px), 16px)",
    });
  });
});

function Tile({ docked, running = false }: { docked: boolean; running?: boolean }) {
  return (
    <Dock>
      <DockAppTile
        id="notes"
        label="Notes"
        docked={docked}
        running={running}
        position="bottom"
        dragging={() => false}
        onOpen={open}
        onKeepChange={keep}
      />
    </Dock>
  );
}
const open = vi.fn();
const keep = vi.fn();

describe("an app's Dock tile", () => {
  it("opens the app on a click and offers Open and Remove from Dock in its menu", async () => {
    render(<Tile docked />);
    const tile = screen.getByRole("button", { name: "Notes" });
    fireEvent.click(tile);
    expect(open).toHaveBeenCalledTimes(1);
    fireEvent.contextMenu(tile);
    expect(await screen.findByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove from Dock" }));
    expect(keep).toHaveBeenCalledWith(false);
  });

  it("lists a running app's windows and hides or quits it, or with Option hides others or force quits", async () => {
    const focus = vi.fn();
    const hide = vi.fn();
    const hideOthers = vi.fn();
    const quit = vi.fn();
    const forceQuit = vi.fn();
    render(
      <Dock>
        <DockAppTile
          id="notes"
          label="Notes"
          docked
          running
          position="bottom"
          dragging={() => false}
          onOpen={open}
          onKeepChange={keep}
          runningApp={{
            windows: [{ id: "notes", title: "Shopping" }],
            focus,
            hide,
            hideOthers,
            quit,
            forceQuit,
          }}
        />
      </Dock>,
    );
    fireEvent.contextMenu(screen.getByRole("button", { name: "Notes" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Shopping" }));
    expect(focus).toHaveBeenCalledWith("notes");

    fireEvent.contextMenu(screen.getByRole("button", { name: "Notes" }));
    fireEvent.keyDown(window, { key: "Alt", altKey: true });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Force Quit" }));
    expect(forceQuit).toHaveBeenCalledTimes(1);
    expect(quit).not.toHaveBeenCalled();

    fireEvent.keyUp(window, { key: "Alt", altKey: false });
    fireEvent.contextMenu(screen.getByRole("button", { name: "Notes" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Quit" }));
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("keeps Quit for a running app whose last window closed, without the rows for windows", async () => {
    const quit = vi.fn();
    render(
      <Dock>
        <DockAppTile
          id="notes"
          label="Notes"
          docked
          running
          position="bottom"
          dragging={() => false}
          onOpen={open}
          onKeepChange={keep}
          runningApp={{
            windows: [],
            focus: vi.fn(),
            hide: vi.fn(),
            hideOthers: vi.fn(),
            quit,
            forceQuit: vi.fn(),
            showAll: vi.fn(),
          }}
        />
      </Dock>,
    );
    fireEvent.contextMenu(screen.getByRole("button", { name: "Notes" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Quit" }));
    expect(quit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: "Hide" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Show All Windows" })).toBeNull();
  });

  it("with Option offers plain Quit for an app that has no way to force quit", async () => {
    const quit = vi.fn();
    render(
      <Dock>
        <DockAppTile
          id="notes"
          label="Notes"
          docked
          running
          position="bottom"
          dragging={() => false}
          onOpen={open}
          onKeepChange={keep}
          runningApp={{
            windows: [{ id: "notes", title: "Shopping" }],
            focus: vi.fn(),
            hide: vi.fn(),
            hideOthers: vi.fn(),
            quit,
          }}
        />
      </Dock>,
    );
    fireEvent.keyDown(window, { key: "Alt", altKey: true });
    fireEvent.contextMenu(screen.getByRole("button", { name: "Notes" }), { altKey: true });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Quit" }));
    expect(quit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menuitem", { name: "Force Quit" })).toBeNull();
    fireEvent.keyUp(window, { key: "Alt", altKey: false });
  });

  it("shows Hide Others and Force Quit when Option was held before the menu opened", async () => {
    render(
      <Dock>
        <DockAppTile
          id="notes"
          label="Notes"
          docked
          running
          position="bottom"
          dragging={() => false}
          onOpen={open}
          onKeepChange={keep}
          runningApp={{
            windows: [{ id: "notes", title: "Shopping" }],
            focus: vi.fn(),
            hide: vi.fn(),
            hideOthers: vi.fn(),
            quit: vi.fn(),
            forceQuit: vi.fn(),
          }}
        />
      </Dock>,
    );
    fireEvent.keyDown(window, { key: "Alt", altKey: true });
    fireEvent.contextMenu(screen.getByRole("button", { name: "Notes" }), { altKey: true });
    expect(await screen.findByRole("menuitem", { name: "Force Quit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Hide Others" })).toBeInTheDocument();
    fireEvent.keyUp(window, { key: "Alt", altKey: false });
    expect(await screen.findByRole("menuitem", { name: "Quit" })).toBeInTheDocument();
  });

  it("offers Keep in Dock for a running app the person took out", async () => {
    render(<Tile docked={false} running />);
    fireEvent.contextMenu(screen.getByRole("button", { name: "Notes" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Keep in Dock" }));
    expect(keep).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("menuitem", { name: "Open" })).toBeNull();
  });

  it("lets go of the Dock's hold when it goes with its menu open", async () => {
    const menu = vi.fn();
    const { unmount } = render(
      <Dock>
        <DockAppTile
          id="notes"
          label="Notes"
          docked
          position="bottom"
          dragging={() => false}
          onOpen={open}
          onKeepChange={keep}
          onMenuOpenChange={menu}
        />
      </Dock>,
    );
    fireEvent.contextMenu(screen.getByRole("button", { name: "Notes" }));
    await screen.findByRole("menuitem", { name: "Options" });
    expect(menu).toHaveBeenLastCalledWith(true);
    unmount();
    expect(menu).toHaveBeenLastCalledWith(false);
  });
});

describe("dragging a Dock tile", () => {
  // A bottom Dock from x 100 to 400, y 820 to 900, with tiles of 64 pt, measured at the press.
  const geometry = {
    dock: { top: 820, bottom: 900, left: 100, right: 400 } as DOMRect,
    size: 64,
    middles: [140, 210, 280],
  };

  it("puts the tile between the tiles the pointer is between", () => {
    expect(dropOf(geometry, "bottom", 90, 850, 4)).toEqual({ index: 0, removing: false });
    expect(dropOf(geometry, "bottom", 250, 850, 4)).toEqual({ index: 2, removing: false });
    expect(dropOf(geometry, "bottom", 900, 850, 4)).toEqual({ index: 3, removing: false });
  });

  it("takes the tile out when it is pulled well away from the Dock, by its edge", () => {
    expect(dropOf(geometry, "bottom", 250, 780, 4).removing).toBe(false);
    expect(dropOf(geometry, "bottom", 250, 700, 4).removing).toBe(true);
    const side = { ...geometry, dock: { top: 0, bottom: 600, left: 0, right: 80 } as DOMRect };
    expect(dropOf(side, "left", 200, 300, 4).removing).toBe(true);
    expect(dropOf(side, "left", 120, 300, 4).removing).toBe(false);
  });

  it("cancels a drag whose release never came when another press starts one", () => {
    const changes: boolean[] = [];
    function Tiles() {
      const apps = useDockApps(["notes", "safari"]);
      const { tileProps } = useDockDrag(apps, "bottom", (active) => changes.push(active));
      return (
        <div className="mac-dock">
          {apps.docked.map((id) => (
            <button key={id} type="button" {...tileProps(id)}>
              {id}
            </button>
          ))}
        </div>
      );
    }
    render(<Tiles />);
    const notes = screen.getByRole("button", { name: "notes" });
    fireEvent.pointerDown(notes, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 60, clientY: 10 });
    expect(notes).toHaveAttribute("data-dragging");
    // The release happened where the page never heard it; the next press of the same mouse is
    // not ignored.
    const safari = screen.getByRole("button", { name: "safari" });
    fireEvent.pointerDown(safari, { pointerId: 1, button: 0, clientX: 80, clientY: 10 });
    expect(notes).not.toHaveAttribute("data-dragging");
    expect(changes).toEqual([true, false]);
    // The new press is a drag of its own.
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 20, clientY: 10 });
    expect(safari).toHaveAttribute("data-dragging");
    // The drag that was let go moved nothing.
    expect(desktopValues()[DOCK_ORDER]).toBeUndefined();
  });
});

describe("auto-hide", () => {
  it("hides again when the pointer leaves the edge strip without going into the Dock", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useDockAutoHide(true, "bottom"));
      const { container } = render(<div>{result.current.edge}</div>);
      const strip = container.querySelector(".mac-desktop-shell-dock-edge") as HTMLElement;
      fireEvent.pointerEnter(strip);
      expect(result.current.dockProps).toHaveProperty("data-shown", "");
      fireEvent.pointerLeave(strip);
      act(() => vi.advanceTimersByTime(500));
      expect(result.current.dockProps["data-shown"]).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays out while the keyboard focus or the pointer is still in the Dock", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useDockAutoHide(true, "bottom"));
      const dock = document.createElement("div");
      const props = () => result.current.dockProps;
      // The focus comes in, then the pointer passes through: the focus keeps it out.
      act(() => props().onFocus?.());
      act(() => props().onPointerEnter?.());
      act(() => props().onPointerLeave?.());
      act(() => vi.advanceTimersByTime(1_000));
      expect(props()).toHaveProperty("data-shown", "");
      // The pointer comes back and the focus leaves: the pointer keeps it out.
      act(() => props().onPointerEnter?.());
      act(() => props().onBlur?.({ currentTarget: dock, relatedTarget: null }));
      act(() => vi.advanceTimersByTime(1_000));
      expect(props()).toHaveProperty("data-shown", "");
      // Both gone: it hides.
      act(() => props().onPointerLeave?.());
      act(() => vi.advanceTimersByTime(500));
      expect(props()["data-shown"]).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays out while anything holds it: a tile's menu or a drag, wherever the pointer goes", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useDockAutoHide(true, "bottom"));
      act(() => result.current.dockProps.onPointerEnter?.());
      act(() => result.current.hold("menu:notes", true));
      act(() => result.current.hold("drag", true));
      // The pointer goes out (to the menu in its portal, or dragging a tile away).
      act(() => result.current.dockProps.onPointerLeave?.());
      act(() => vi.advanceTimersByTime(1_000));
      expect(result.current.dockProps).toHaveProperty("data-shown", "");
      act(() => result.current.hold("drag", false));
      act(() => vi.advanceTimersByTime(1_000));
      expect(result.current.dockProps).toHaveProperty("data-shown", "");
      // The last hold let go, out there: it hides.
      act(() => result.current.hold("menu:notes", false));
      act(() => vi.advanceTimersByTime(500));
      expect(result.current.dockProps["data-shown"]).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("brings the Dock out at the edge and hides it again after the pointer leaves", () => {
    vi.useFakeTimers();
    try {
      const { result, rerender } = renderHook(({ on }) => useDockAutoHide(on, "bottom"), {
        initialProps: { on: true },
      });
      expect(result.current.dockProps).toMatchObject({ "data-autohide": "" });
      expect(result.current.dockProps).not.toHaveProperty("data-shown", "");
      act(() => result.current.dockProps.onPointerEnter?.());
      expect(result.current.dockProps).toHaveProperty("data-shown", "");
      act(() => result.current.dockProps.onPointerLeave?.());
      act(() => vi.advanceTimersByTime(500));
      expect(result.current.dockProps["data-shown"]).toBeUndefined();
      rerender({ on: false });
      expect(result.current.dockProps).toEqual({});
      expect(result.current.edge).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
