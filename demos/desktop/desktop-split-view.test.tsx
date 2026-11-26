import { act, fireEvent, render, renderHook, screen as view } from "@testing-library/react";
import type { ManagedWindowInfo } from "macalicious/window-manager";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ManagedWindow, useManagedWindow } from "../../src/components/managed-window";
import { TitleBar } from "../../src/components/title-bar";
import { WindowManager } from "../../src/components/window-manager";
import { createWindowManagerStore } from "../../src/components/window-manager/store";
import type { DesktopApp } from "./desktop-apps";
import { type DesktopSpaces, ONE_SPACE, type SpacesApi } from "./desktop-spaces";
import {
  chooserSlots,
  DesktopSplitChooser,
  type SplitView,
  useSplitSwap,
  useSplitView,
} from "./desktop-split-view";

const AT = { x: 40, y: 50, width: 400, height: 300 };
const OTHER = { x: 90, y: 60, width: 500, height: 200 };

const storeOf = () => {
  const store = createWindowManagerStore();
  for (const [id, frame] of [
    ["a", AT],
    ["b", OTHER],
  ] as const) {
    store.add(
      { id, app: id, title: id, panel: false, resizable: true, minWidth: 0, minHeight: 0, frame },
      () => undefined,
    );
  }
  return store;
};

const spacesWith = (state: DesktopSpaces) =>
  ({ state, tile: vi.fn(), setShare: vi.fn(), forgetTiles: vi.fn() }) as unknown as SpacesApi;

describe("Split View", () => {
  const screen = document.createElement("div");
  beforeEach(() => {
    Object.defineProperty(screen, "clientWidth", { value: 1006, configurable: true });
    Object.defineProperty(screen, "clientHeight", { value: 700, configurable: true });
  });
  const mount = (state: DesktopSpaces = ONE_SPACE) => {
    const store = storeOf();
    const spaces = spacesWith(state);
    const { result } = renderHook(() =>
      useSplitView(store, spaces, useSyncExternalStore(store.subscribe, store.list), screen),
    );
    return { store, spaces, result };
  };

  it.each([
    ["is minimized", "minimize"],
    ["enters full screen", "toggleFullScreen"],
    ["closes", "remove"],
  ] as const)("stops waiting when the window waiting %s, and puts it back", (_name, command) => {
    const { store, spaces, result } = mount();
    act(() => result.current.start("a", "left"));
    act(() => store[command]("a"));
    expect(result.current.tiling).toBeNull();
    if (command !== "remove") expect(store.get("a")?.frame).toEqual(AT);
    expect(spaces.tile).not.toHaveBeenCalled();
  });

  it("does not tile a window that can no longer be, and puts the one waiting back", () => {
    const { store, spaces, result } = mount();
    act(() => result.current.start("a", "left"));
    act(() => store.minimize("b"));
    act(() => result.current.choose("b"));
    expect(spaces.tile).not.toHaveBeenCalled();
    expect(result.current.tiling).toBeNull();
    expect(store.get("a")?.frame).toEqual(AT);
  });

  it("keeps where a window stood when its side is asked for again, and puts it back", () => {
    const { store, result } = mount();
    act(() => result.current.start("a", "left"));
    expect(store.get("a")?.frame).toEqual({ x: 0, y: 0, width: 500, height: 700 });
    act(() => result.current.start("a", "right"));
    expect(store.get("a")?.frame).toEqual({ x: 506, y: 0, width: 500, height: 700 });
    act(() => result.current.cancel());
    expect(store.get("a")?.frame).toEqual(AT);
  });

  it("puts the window waiting back when another is asked for", () => {
    const { store, result } = mount();
    act(() => result.current.start("a", "left"));
    act(() => result.current.start("b", "left"));
    expect(store.get("a")?.frame).toEqual(AT);
    expect(result.current.tiling?.window).toBe("b");
    act(() => result.current.cancel());
    expect(store.get("b")?.frame).toEqual(OTHER);
  });

  it("does not start on a window already on a Space of its own", () => {
    const { store, result } = mount({
      ...ONE_SPACE,
      spaces: ["1", "split:a|b"],
      current: "split:a|b",
      windows: { a: "split:a|b", b: "split:a|b" },
      tiles: { "split:a|b": { share: 0.5, frames: {} } },
    });
    act(() => result.current.start("a", "left"));
    expect(result.current.tiling).toBeNull();
    expect(store.get("a")?.frame).toEqual({ x: 0, y: 0, width: 500, height: 700 });
  });

  it("gives back each window of a Split View over once, and keeps the turn of one not open", () => {
    const { store, spaces } = mount({
      ...ONE_SPACE,
      tiles: { "split:a|gone": { share: 0.5, frames: { a: OTHER, gone: AT } } },
    });
    expect(store.get("a")?.frame).toEqual(OTHER);
    expect(spaces.forgetTiles).toHaveBeenCalledWith("split:a|gone", ["a"]);
  });
});

describe("The Split View chooser", () => {
  const info = (id: string, frame: typeof AT, z = 3) =>
    ({
      id,
      app: id,
      title: `${id} window`,
      resizable: true,
      panel: false,
      minimized: false,
      away: false,
      fullScreen: false,
      z,
      frame,
    }) as unknown as ManagedWindowInfo;
  const apps = [{ id: "b", name: "Bee" }] as unknown as DesktopApp[];
  const mount = (
    windows: readonly ManagedWindowInfo[],
    side: "left" | "right" = "left",
    choose = vi.fn(),
  ) => {
    const desk = document.createElement("div");
    desk.innerHTML = windows
      .map(({ id }) => `<div data-window-id="${id}" style="z-index: 3"></div>`)
      .join("");
    const split = {
      tiling: { window: "a", side, from: AT },
      choose,
      cancel: vi.fn(),
      screen: desk,
      width: 1006,
      height: 700,
    } as unknown as SplitView;
    const shown = render(<DesktopSplitChooser split={split} windows={windows} apps={apps} />);
    const shell = (id: string) => desk.querySelector(`[data-window-id="${id}"]`) as HTMLElement;
    return { ...shown, shell, split };
  };

  it("lays windows out no larger than they are, centred, in as many rows as columns", () => {
    const windows = [info("b", { x: 0, y: 0, width: 200, height: 100 })];
    expect(chooserSlots(windows, { width: 503, height: 700 })).toEqual([
      { id: "b", x: 151.5, y: 300, width: 200, height: 100, scale: 1 },
    ]);
    const four = ["b", "c", "d", "e"].map((id) =>
      info(id, { x: 0, y: 0, width: 452, height: 100 }),
    );
    const slots = chooserSlots(four, { width: 500, height: 500 });
    expect(slots.map(({ x, y, scale }) => [x, y, scale])).toEqual([
      [16, 104, 0.5],
      [258, 104, 0.5],
      [16, 346, 0.5],
      [258, 346, 0.5],
    ]);
  });

  it("stands the live window where its button is, and gives it back", () => {
    const windows = [
      info("a", AT),
      info("b", { x: 100, y: 50, width: 400, height: 300 }),
      info("c", { x: 0, y: 0, width: 942, height: 100 }),
    ];
    const { shell, unmount } = mount([
      windows[0] as ManagedWindowInfo,
      windows[1] as ManagedWindowInfo,
    ]);
    const button = view.getByRole("button", { name: "b window, Bee" });
    expect(button.textContent).toBe("");
    expect(button.style.left).toBe("51.5px");
    expect(button.style.top).toBe("200px");
    expect(button.style.width).toBe("400px");
    expect(button.style.height).toBe("300px");
    const moved = shell("b");
    expect(moved.dataset.missionControl).toBe("shown");
    expect(moved.style.translate).toBe("454.5px 150px");
    expect(moved.style.scale).toBe("1");
    expect(shell("a").dataset.missionControl).toBeUndefined();
    unmount();
    expect(moved.style.translate).toBe("");
    expect(moved.style.scale).toBe("");
    expect(moved.style.zIndex).toBe("3");
  });

  it("shrinks a window too wide for its side, on the side the window waiting leaves", () => {
    const { shell } = mount(
      [info("a", AT), info("c", { x: 10, y: 0, width: 942, height: 100 })],
      "right",
    );
    expect(shell("c").style.scale).toBe("0.5");
    expect(shell("c").style.translate).toBe("11px 325px");
  });

  it("tiles the window whose button is pressed", () => {
    const choose = vi.fn();
    mount([info("a", AT), info("b", OTHER)], "left", choose);
    fireEvent.click(view.getByRole("button", { name: "b window, Bee" }));
    expect(choose).toHaveBeenCalledWith("b");
  });

  it("says there are no windows when none can share the screen", () => {
    mount([info("a", AT)]);
    expect(view.getByRole("button", { name: "No Available Windows" })).toBeTruthy();
  });
});

describe("A window of a Split View let go past the divider", () => {
  const SPLIT = "split:a|b";
  const split = { share: 0.5, width: 1006, height: 700 } as SplitView;
  const state: DesktopSpaces = {
    ...ONE_SPACE,
    spaces: ["1", SPLIT],
    current: SPLIT,
    windows: { a: SPLIT, b: SPLIT },
    tiles: { [SPLIT]: { share: 0.5, frames: {} } },
  };
  function Bar({ cancels }: { cancels: boolean }) {
    const { titleBarProps } = useManagedWindow();
    return (
      <TitleBar
        title="A"
        data-testid="bar"
        {...titleBarProps}
        onPointerDown={(event) => {
          if (cancels) event.preventDefault();
        }}
      />
    );
  }
  function Swapping({ spaces, children }: { spaces: SpacesApi; children: ReactNode }) {
    useSplitSwap(document.body, spaces, split);
    return children;
  }
  const mount = (cancels = false) => {
    const swap = vi.fn();
    render(
      <Swapping spaces={{ state, swap } as unknown as SpacesApi}>
        <WindowManager>
          <ManagedWindow id="a" title="A">
            <Bar cancels={cancels} />
          </ManagedWindow>
        </WindowManager>
      </Swapping>,
    );
    fireEvent.pointerDown(view.getByTestId("bar"), {
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 5,
    });
    return swap;
  };

  it("changes sides", () => {
    const swap = mount();
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 700, clientY: 5 });
    expect(swap).toHaveBeenCalledWith(SPLIT);
  });

  it("stays when let go short of the divider", () => {
    const swap = mount();
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 300, clientY: 5 });
    expect(swap).not.toHaveBeenCalled();
  });

  it("does nothing when a handler of the window cancelled the press", () => {
    const swap = mount(true);
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 700, clientY: 5 });
    expect(swap).not.toHaveBeenCalled();
  });

  it("does nothing at the next release after the browser took the pointer away", () => {
    const swap = mount();
    fireEvent.pointerCancel(document, { pointerId: 1 });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 700, clientY: 5 });
    expect(swap).not.toHaveBeenCalled();
  });
});
