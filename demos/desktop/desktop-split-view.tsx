"use client";

import type { ManagedWindowInfo, WindowManagerStore } from "macalicious/window-manager";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DesktopApp } from "./desktop-apps";
import {
  boundShare,
  isDesktopSpace,
  SPLIT_DIVIDER,
  type SpacesApi,
  type SplitTiles,
  spaceOfWindow,
  splitFrames,
  splitWindowsOf,
} from "./desktop-spaces";
import { followDrag } from "./desktop-spaces-bar";
import "./desktop-split-view.css";

/**
 * Split View on the desktop: two windows on a Space of their own, each filling its side of a divider.
 * It starts from the green button held down, or from the Window menu, with the window on one side and
 * the windows that can share the screen on the other. The windows are the live ones at the frames the
 * Space gives them, so nothing in them restarts.
 */

/** How long the green button is held before it means Split View, as on a Mac. */
const HOLD_MS = 600;

/** How far a key moves the divider. */
const KEY_STEP = 0.05;

const sameFrame = (a: SplitTiles["frames"][string], b: SplitTiles["frames"][string]) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export type TileSide = "left" | "right";

interface Tiling {
  window: string;
  side: TileSide;
  from: SplitTiles["frames"][string];
}

/** Whether a window can share the screen: one that goes full screen, showing on this Desktop. */
const canTile = (window: ManagedWindowInfo) =>
  window.resizable && !window.panel && !window.minimized && !window.away && !window.fullScreen;

export interface SplitView {
  /** The chooser, if a window is waiting for its other side; `null` otherwise. */
  tiling: Tiling | null;
  /** Puts a window on one side and asks what goes on the other. */
  start: (window: string, side: TileSide) => void;
  /** Tiles the window waiting with this one. */
  choose: (other: string) => void;
  /** Puts the window waiting back where it was. */
  cancel: () => void;
  /** The left window's share of the width of the Split View showing, while the divider moves too. */
  share: number | null;
  setShare: (share: number) => void;
  commitShare: (share: number) => void;
  width: number;
  height: number;
  /** The desktop the windows stand on. */
  screen: HTMLElement | null;
}

/** Holds the windows of every Split View at their frames, and gives them back when it ends. */
export function useSplitView(
  store: WindowManagerStore,
  spaces: SpacesApi,
  windows: readonly ManagedWindowInfo[],
  screen: HTMLElement | null,
): SplitView {
  const { state } = spaces;
  const [tiling, setTiling] = useState<Tiling | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!screen) return;
    const measure = () => setSize({ width: screen.clientWidth, height: screen.clientHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [screen]);
  const { width, height } = size;

  // The window waiting has closed, or gone where it cannot be tiled: there is nothing to ask.
  const waiting = windows.find(({ id }) => id === tiling?.window);
  const waitingGone =
    tiling !== null && (!waiting || waiting.minimized || waiting.away || waiting.fullScreen);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the moment it stops waiting counts.
  useEffect(() => {
    if (!waitingGone) return;
    if (tiling) store.patch(tiling.window, { frame: tiling.from });
    setTiling(null);
  }, [waitingGone]);

  // Whatever moved a window (its title bar, a restored frame), it goes back to its side.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a window that changed is why it runs.
  useLayoutEffect(() => {
    if (width === 0) return;
    for (const space of state.spaces) {
      const pair = splitWindowsOf(space);
      const tile = state.tiles?.[space];
      if (!pair || !tile) continue;
      const share = space === state.current && moving !== null ? moving : tile.share;
      const frames = splitFrames(share, width, height);
      pair.forEach((id, side) => {
        const info = store.get(id);
        const frame = frames[side];
        if (info && frame && (info.zoomed || !sameFrame(info.frame, frame))) {
          store.patch(id, { frame, zoomed: false });
        }
      });
    }
  }, [state, windows, width, height, moving, store]);

  // A Split View over: each of its windows goes back to where it stood, once. One not open now keeps
  // its turn, and nothing that happens to a window after that is undone.
  useEffect(() => {
    for (const [space, { frames }] of Object.entries(state.tiles ?? {})) {
      if (state.spaces.includes(space)) continue;
      const open = Object.keys(frames).filter((id) => store.get(id));
      for (const id of open) store.patch(id, { frame: frames[id] });
      if (open.length > 0) spaces.forgetTiles(space, open);
    }
  });

  const start = (id: string, side: TileSide) => {
    const info = store.get(id);
    // A window in full screen or in a Split View already has a Space of its own.
    if (!info?.resizable || info.fullScreen || width === 0) return;
    if (!isDesktopSpace(spaceOfWindow(state, id))) return;
    const waiting = tiling;
    if (waiting && waiting.window !== id) store.patch(waiting.window, { frame: waiting.from });
    const [left, right] = splitFrames(0.5, width, height);
    setTiling({ window: id, side, from: waiting?.window === id ? waiting.from : info.frame });
    store.patch(
      id,
      { frame: side === "left" ? left : right, zoomed: false, minimized: false },
      true,
    );
  };
  const choose = (other: string) => {
    const info = store.get(other);
    if (!tiling || !info) return;
    if (waitingGone || !canTile(info)) {
      cancel();
      return;
    }
    const pair: readonly [string, string] =
      tiling.side === "left" ? [tiling.window, other] : [other, tiling.window];
    spaces.tile(pair[0], pair[1], { [tiling.window]: tiling.from, [other]: info.frame });
    setTiling(null);
    store.focus(other);
  };
  const cancel = () => {
    if (tiling) store.patch(tiling.window, { frame: tiling.from });
    setTiling(null);
  };
  const space = state.current;
  return {
    tiling,
    start,
    choose,
    cancel,
    share: splitWindowsOf(space) ? (moving ?? state.tiles?.[space]?.share ?? null) : null,
    setShare: setMoving,
    commitShare: (share) => {
      setMoving(null);
      spaces.setShare(space, share);
    },
    width,
    height,
    screen,
  };
}

/**
 * The green button held down starts Split View, on the side of the screen it is let go on. On a window
 * in a Split View, the green button ends it.
 */
export function useGreenButton(
  screen: HTMLElement | null,
  start: (window: string, side: TileSide) => void,
  spaces: SpacesApi,
) {
  const latest = useRef({ start, spaces });
  latest.current = { start, spaces };
  useEffect(() => {
    if (!screen) return;
    const greenOf = (target: EventTarget | null) => {
      const button = (target as Element | null)?.closest?.(".mac-window-controls-button");
      return button?.getAttribute("aria-label") === "Enter Full Screen"
        ? button.closest<HTMLElement>("[data-window-id]")
        : null;
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let swallow = false;
    const down = (event: PointerEvent) => {
      swallow = false;
      const shell = greenOf(event.target);
      if (!shell || event.button !== 0) return;
      const id = shell.dataset.windowId ?? "";
      if (splitWindowsOf(latest.current.spaces.state.current)?.includes(id)) return;
      timer = setTimeout(() => {
        timer = undefined;
        const up = (release: PointerEvent) => {
          swallow = true;
          const { left, width } = screen.getBoundingClientRect();
          latest.current.start(id, release.clientX < left + width / 2 ? "left" : "right");
        };
        document.addEventListener("pointerup", up, { capture: true, once: true });
      }, HOLD_MS);
    };
    const up = () => clearTimeout(timer);
    const click = (event: MouseEvent) => {
      const shell = greenOf(event.target);
      if (!shell) return;
      const { state, leaveFullScreen } = latest.current.spaces;
      const inSplit = splitWindowsOf(state.current)?.includes(shell.dataset.windowId ?? "");
      if (!swallow && !inSplit) return;
      event.stopPropagation();
      event.preventDefault();
      swallow = false;
      if (inSplit) leaveFullScreen(state.current);
    };
    screen.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    screen.addEventListener("click", click, true);
    return () => {
      clearTimeout(timer);
      screen.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      screen.removeEventListener("click", click, true);
    };
  }, [screen]);
}

/**
 * A window of the Split View showing dragged by its title bar and let go past the divider: the two change
 * sides. Let go short of it, the window goes back to its side. It counts only as the window itself took
 * the press for a move, which it does not when a handler of the window cancelled it: the document hears
 * the press after the window has.
 */
export function useSplitSwap(screen: HTMLElement | null, spaces: SpacesApi, split: SplitView) {
  const latest = useRef({ spaces, split });
  latest.current = { spaces, split };
  useEffect(() => {
    if (!screen) return;
    const down = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const { state, swap } = latest.current.spaces;
      const space = state.current;
      const pair = splitWindowsOf(space);
      const shell = target?.closest<HTMLElement>("[data-window-id]");
      const id = shell?.dataset.windowId;
      if (
        !pair ||
        !id ||
        !pair.includes(id) ||
        !screen.contains(shell) ||
        !shell?.hasAttribute("data-dragging") ||
        !target?.closest("[data-window-drag-region]")
      ) {
        return;
      }
      const onLeft = pair[0] === id;
      const over = new AbortController();
      const up = (release: PointerEvent) => {
        over.abort();
        const { share, width, height } = latest.current.split;
        if (share === null) return;
        const [left] = splitFrames(share, width, height);
        const divider = screen.getBoundingClientRect().left + left.width;
        if (onLeft ? release.clientX > divider + SPLIT_DIVIDER : release.clientX < divider) {
          swap(space);
        }
      };
      document.addEventListener("pointerup", up, { capture: true, signal: over.signal });
      document.addEventListener("pointercancel", () => over.abort(), {
        capture: true,
        signal: over.signal,
      });
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [screen]);
}

/** The chooser's room between the menu bar and the Dock, in the desktop's own coordinates. */
export interface ChooserRoom {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ChooserSlot {
  id: string;
  /** Where the window stands, from the chooser's corner. */
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

const CHOOSER_GAP = 16;

/** The windows in rows, each no larger than it is and centred in its cell, as many rows as columns. */
export function chooserSlots(
  windows: readonly ManagedWindowInfo[],
  room: Pick<ChooserRoom, "width" | "height">,
): ChooserSlot[] {
  const columns = Math.ceil(Math.sqrt(windows.length));
  const rows = Math.ceil(windows.length / columns);
  const cellWidth = (room.width - CHOOSER_GAP * (columns + 1)) / columns;
  const cellHeight = (room.height - CHOOSER_GAP * (rows + 1)) / rows;
  return windows.map(({ id, frame }, at) => {
    const scale = Math.min(1, cellWidth / frame.width, cellHeight / frame.height);
    const width = frame.width * scale;
    const height = frame.height * scale;
    const column = at % columns;
    const row = Math.floor(at / columns);
    return {
      id,
      x: CHOOSER_GAP + column * (cellWidth + CHOOSER_GAP) + (cellWidth - width) / 2,
      y: CHOOSER_GAP + row * (cellHeight + CHOOSER_GAP) + (cellHeight - height) / 2,
      width,
      height,
      scale,
    };
  });
}

/** The half of the desktop the window waiting leaves, less what the menu bar and the Dock cover. */
function chooserRoom(
  screen: HTMLElement | null,
  side: TileSide,
  width: number,
  height: number,
): ChooserRoom {
  const edge = screen?.getBoundingClientRect().top ?? 0;
  const bar = screen?.querySelector(".mac-desktop-shell-menu-bar")?.getBoundingClientRect();
  const dock = screen?.querySelector(".mac-desktop-shell-dock")?.getBoundingClientRect();
  const top = bar ? Math.max(0, bar.bottom - edge) : 0;
  const dockTop = dock ? dock.top - edge : height;
  const bottom = dockTop > top && dockTop < height ? dockTop : height;
  return {
    left: side === "left" ? width / 2 : 0,
    top,
    width: width / 2,
    height: bottom - top,
  };
}

const shellOf = (screen: HTMLElement, id: string) =>
  screen.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(id)}"]`);

/** How long a window takes to go back, as `desktop-overview.css` says. */
const SETTLE_MS = 260;

/**
 * The other side of the screen while a window waits: the windows that can share it, the live ones
 * scaled with `translate` and `scale` as in Mission Control, so nothing in them restarts, with a
 * button over each. The blur stands below them and the buttons above.
 */
export function DesktopSplitChooser({
  split,
  windows,
  apps,
}: {
  split: SplitView;
  windows: readonly ManagedWindowInfo[];
  apps: readonly DesktopApp[];
}) {
  const { tiling, choose, cancel, screen, width, height } = split;
  const first = useRef<HTMLButtonElement>(null);
  const open = tiling !== null;
  const side = tiling?.side;
  const others = tiling ? windows.filter((each) => each.id !== tiling.window && canTile(each)) : [];
  const room = side ? chooserRoom(screen, side, width, height) : null;
  const slots = room ? chooserSlots(others, room) : [];
  const latestWindows = useRef(windows);
  latestWindows.current = windows;
  const framesOf = new Map(others.map(({ id, frame }) => [id, frame]));
  const placed = JSON.stringify(
    room
      ? slots.map(({ id, x, y, scale }) => {
          const frame = framesOf.get(id);
          return [
            id,
            room.left + x - (frame?.x ?? 0) * scale,
            room.top + y - (frame?.y ?? 0) * scale,
            scale,
          ];
        })
      : [],
  );
  useLayoutEffect(() => {
    if (!screen) return;
    const shells = (JSON.parse(placed) as [string, number, number, number][]).flatMap(
      ([id, x, y, scale]) => {
        const shell = shellOf(screen, id);
        if (!shell) return [];
        shell.dataset.missionControl = "shown";
        shell.style.translate = `${x}px ${y}px`;
        shell.style.scale = String(scale);
        shell.style.zIndex = "calc(var(--mac-window-manager-layer-chrome) - 2)";
        return [{ id, shell }];
      },
    );
    return () => {
      for (const { id, shell } of shells) {
        shell.style.translate = "";
        shell.style.scale = "";
        const z = latestWindows.current.find((each) => each.id === id)?.z;
        shell.style.zIndex = z === undefined ? "" : String(z);
        setTimeout(() => {
          if (shell.style.scale === "") delete shell.dataset.missionControl;
        }, SETTLE_MS);
      }
    };
  }, [screen, placed]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the chooser moves with the side, and takes the focus there.
  useEffect(() => {
    if (open) first.current?.focus({ preventScroll: true });
  }, [open, side]);
  const latestCancel = useRef(cancel);
  latestCancel.current = cancel;
  // Wherever the focus is, as long as a menu is not what Escape closes.
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('[role="menu"][data-open]')) return;
      event.stopPropagation();
      latestCancel.current();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [open]);
  // Mission Control lays the same windows out, and gives them back to no one in particular.
  useEffect(() => {
    if (!open || !screen) return;
    const watching = new MutationObserver(() => {
      if (screen.hasAttribute("data-mission-control-open")) latestCancel.current();
    });
    watching.observe(screen, { attributes: true, attributeFilter: ["data-mission-control-open"] });
    return () => watching.disconnect();
  }, [open, screen]);
  if (!tiling || !room) return null;
  const chooserSide = tiling.side === "left" ? "right" : "left";
  const nameOf = (app: string) => apps.find(({ id }) => id === app)?.name ?? app;
  return (
    <>
      <div
        aria-hidden="true"
        className="mac-desktop-shell-split-chooser"
        data-side={chooserSide}
        style={{
          zIndex: "calc(var(--mac-window-manager-layer-chrome) - 3)",
        }}
      />
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: a press on the empty half; the window's Escape listener above is its key. */}
      <div
        role="dialog"
        aria-label="Split View"
        className="mac-desktop-shell-split-chooser"
        data-side={chooserSide}
        style={{
          background: "none",
          backdropFilter: "none",
          display: others.length === 0 ? undefined : "block",
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) cancel();
        }}
      >
        {others.length === 0 ? (
          <button
            ref={first}
            type="button"
            className="mac-desktop-shell-split-none"
            onClick={cancel}
          >
            No Available Windows
          </button>
        ) : (
          slots.map((slot, at) => {
            const each = others[at];
            return (
              <button
                key={slot.id}
                ref={at === 0 ? first : undefined}
                type="button"
                className="mac-desktop-shell-split-choice"
                aria-label={`${each?.title}, ${nameOf(each?.app ?? "")}`}
                title={each?.title}
                style={{
                  position: "absolute",
                  left: slot.x,
                  top: room.top + slot.y,
                  width: slot.width,
                  height: slot.height,
                  padding: 0,
                }}
                onClick={() => choose(slot.id)}
              />
            );
          })
        )}
      </div>
    </>
  );
}

/** The black divider of the Split View showing: a drag or the arrow keys move it. */
export function DesktopSplitDivider({ split }: { split: SplitView }) {
  const { share, setShare, commitShare, width, height } = split;
  if (share === null || width === 0) return null;
  const [left] = splitFrames(share, width, height);
  const room = width - SPLIT_DIVIDER;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA pattern for a divider that moves.
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Split View divider"
      aria-valuemin={25}
      aria-valuemax={75}
      aria-valuenow={Math.round(boundShare(share) * 100)}
      tabIndex={0}
      className="mac-desktop-shell-split-divider"
      style={{ left: left.width, width: SPLIT_DIVIDER }}
      onPointerDown={(down) => {
        if (down.button !== 0) return;
        down.preventDefault();
        const from = boundShare(share);
        const shareAt = (x: number) => boundShare(from + (x - down.clientX) / room);
        followDrag(
          down,
          (move) => setShare(shareAt(move.clientX)),
          (up) => commitShare(up ? shareAt(up.clientX) : from),
        );
      }}
      onKeyDown={(event) => {
        const step =
          event.key === "ArrowLeft" ? -KEY_STEP : event.key === "ArrowRight" ? KEY_STEP : 0;
        if (step === 0) return;
        event.preventDefault();
        commitShare(boundShare(share + step));
      }}
    />
  );
}
