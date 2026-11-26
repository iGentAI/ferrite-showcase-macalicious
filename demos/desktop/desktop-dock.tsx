"use client";

import { DockItem, type DockItemProps } from "macalicious/dock";
import { DockMenu, DockMenuPopup, DockMenuTrigger } from "macalicious/dock-menu";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import {
  type CSSProperties,
  type DragEvent,
  Fragment,
  type MouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { appsForFile, openFile, requestOpenFile } from "../finder/finder-open";
import { runUndoable } from "../finder/finder-undo";
import { ACCOUNT_PANES, GRID_BANDS } from "../system-preferences/catalogue";
import { requestPane } from "../system-preferences/pane-request";
import { useDesktopAppMenuItems } from "./desktop-app-menus";
import { registerDropTarget } from "./desktop-drag";
import { requestDesktopEffects } from "./desktop-effects";
import { LAUNCHPAD_APP_DRAG } from "./desktop-launchpad-folders";
import {
  DOCK_ORDER,
  DOCK_REMOVED,
  type DockPosition,
  type DockPreferences,
  dockedIds,
  keepInDock,
  moveId,
  readIds,
  useDesktopSetting,
} from "./desktop-personal";
import "./desktop-dock.css";

/**
 * The person's Dock on the desktop demo: which apps it keeps and in what order (drag a tile along
 * the Dock to move it, drag it up and out to take it out, or use its menu), and how it is set up in
 * System Preferences > Dock (size, magnification, edge, auto-hide). What the person arranges is
 * kept in `desktop-personal.ts`, which a served desktop saves per account.
 */

const NONE: readonly string[] = [];

/** How far a tile is pulled away from the Dock before letting go takes it out, in tiles. */
const REMOVE_DISTANCE = 1.25;
/** How far the pointer moves before a press on a tile becomes a drag, in points. */
const DRAG_THRESHOLD = 6;
/** How long the auto-hidden Dock stays after the pointer leaves it, in milliseconds. */
const HIDE_DELAY_MS = 400;

/** The apps of the Dock, in the person's order, and what changes it. */
export interface DockApps {
  docked: readonly string[];
  /** Move a docked app to `index`. */
  move: (id: string, index: number) => void;
  /** Take an app out of the Dock. */
  remove: (id: string) => void;
  /** Keep an app in the Dock, at its end. */
  keep: (id: string) => void;
}

/** The Dock's apps among `installed` (the apps the person has, in the desktop's order). */
export function useDockApps(installed: readonly string[]): DockApps {
  const [order, setOrder] = useDesktopSetting(DOCK_ORDER, readIds, NONE);
  const [removed, setRemoved] = useDesktopSetting(DOCK_REMOVED, readIds, NONE);
  const docked = useMemo(() => dockedIds(installed, order, removed), [installed, order, removed]);
  return useMemo(
    () => ({
      docked,
      move: (id, index) => {
        const next = moveId(docked, id, index);
        if (next !== docked) setOrder([...next]);
      },
      remove: (id) => {
        if (!docked.includes(id)) return;
        setRemoved([...removed.filter((each) => each !== id), id]);
        setOrder(docked.filter((each) => each !== id));
      },
      keep: (id) => {
        if (docked.includes(id)) return;
        setRemoved(removed.filter((each) => each !== id));
        setOrder([...docked, id]);
      },
    }),
    [docked, removed, setOrder, setRemoved],
  );
}

/** What makes the Dock keep an application let go on it from Launchpad. */
export function dockAppDropProps(keep: (id: string) => void) {
  return {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (event.dataTransfer.types.includes(LAUNCHPAD_APP_DRAG)) event.preventDefault();
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const id = event.dataTransfer.getData(LAUNCHPAD_APP_DRAG);
      if (!id) return;
      event.preventDefault();
      keep(id);
    },
  };
}

/**
 * The Dock's layout for its preferences: the style its element takes (the tile size, shrunk to fit
 * `tiles` tiles along its edge) and the space windows keep clear of at its edge (none while it
 * hides itself).
 */
export function dockLayout(
  preferences: DockPreferences,
  tiles: number,
  menuBar: number,
): { style: CSSProperties; insets: { bottom: number; left: number; right: number } } {
  const { tile, position, autohide } = preferences;
  // Tiles shrink from the chosen size so that the Dock fits the desktop: its length less the
  // shelf's ends (and the menu bar, on a side), over the number of tiles. They may go below
  // 16 pt, as a full Dock shrinks its icons past the chosen size to stay on the screen; they stop
  // at 12 pt.
  const length = position === "bottom" ? "100cqw - 24px" : `100cqh - ${menuBar + 24}px`;
  const style = {
    "--mac-dock-tile-size": `clamp(12px, calc((${length}) / ${tiles} - 4px), ${tile}px)`,
  } as CSSProperties;
  const thickness = autohide ? 0 : tile + 16;
  return {
    style,
    insets: {
      bottom: position === "bottom" ? thickness : 0,
      left: position === "left" ? thickness : 0,
      right: position === "right" ? thickness : 0,
    },
  };
}

/**
 * Auto-hide: the Dock slides off its edge unless something holds it out. Anything that uses the
 * Dock holds it, each under its own name, with `hold(name, true)` and lets go with
 * `hold(name, false)`: the pointer on the Dock or on the strip along its edge (`edge`), the
 * keyboard focus in it, an open tile menu, a tile being dragged. While any hold is on, the Dock is
 * out; a moment after the last one is let go, it hides. Returns the Dock's props, the strip to
 * render beside it, and `hold`.
 */
export function useDockAutoHide(enabled: boolean, position: DockPosition) {
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The holds that are on: the Dock is busy, and out, while there is any.
  const holds = useRef(new Set<string>());
  const hold = useCallback((name: string, on: boolean) => {
    if (on) holds.current.add(name);
    else holds.current.delete(name);
    clearTimeout(timer.current);
    if (holds.current.size > 0) setShown(true);
    else timer.current = setTimeout(() => setShown(false), HIDE_DELAY_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (enabled) return;
    clearTimeout(timer.current);
    holds.current.clear();
    setShown(false);
  }, [enabled]);
  if (!enabled) return { dockProps: {}, edge: null, hold };
  return {
    hold,
    dockProps: {
      "data-autohide": "",
      "data-shown": shown ? "" : undefined,
      onPointerEnter: () => hold("pointer", true),
      onPointerLeave: () => hold("pointer", false),
      onFocus: () => hold("focus", true),
      onBlur: (event: { currentTarget: HTMLElement; relatedTarget: EventTarget | null }) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          hold("focus", false);
        }
      },
    },
    edge: (
      <div
        className="mac-desktop-shell-dock-edge"
        data-position={position}
        aria-hidden="true"
        onPointerEnter={() => hold("edge", true)}
        onPointerLeave={() => hold("edge", false)}
      />
    ),
  };
}

interface Drag {
  id: string;
  pointer: number;
  x: number;
  y: number;
  moved: boolean;
  /** The index the tile goes to when let go, and whether it is taken out instead. */
  index: number;
  removing: boolean;
}

/**
 * What a drag measures once, when the press begins, on the Dock as it is shown then (a press is on
 * a tile of a Dock that is out): the Dock's box, the dragged tile's size and the middle of every
 * other tile along the Dock. A Dock that moves later (an auto-hide, a magnification) does not
 * change where the tile goes.
 */
interface DragGeometry {
  dock: DOMRect;
  size: number;
  middles: number[];
}

function measure(tile: HTMLElement, id: string, edge: DockPosition): DragGeometry | null {
  const dock = tile.closest(".mac-dock");
  if (!dock) return null;
  const middles = [...dock.querySelectorAll<HTMLElement>("[data-dock-app]")]
    .filter((element) => element.dataset.dockApp !== id)
    .map((element) => {
      const box = element.getBoundingClientRect();
      return edge === "bottom" ? box.left + box.width / 2 : box.top + box.height / 2;
    });
  return { dock: dock.getBoundingClientRect(), size: tile.offsetWidth || 64, middles };
}

/** Where a drag at (`x`, `y`) puts the tile: its index among `count` tiles, or out of the Dock. */
export function dropOf(
  geometry: DragGeometry,
  edge: DockPosition,
  x: number,
  y: number,
  count: number,
): { index: number; removing: boolean } {
  const along = edge === "bottom" ? x : y;
  const index = geometry.middles.filter((middle) => middle < along).length;
  const { dock } = geometry;
  const away = edge === "bottom" ? dock.top - y : edge === "left" ? x - dock.right : dock.left - x;
  return {
    index: Math.max(0, Math.min(index, count - 1)),
    removing: away > geometry.size * REMOVE_DISTANCE,
  };
}

/**
 * Dragging the Dock's app tiles: along the Dock to move one, away from it to take one out. Returns
 * the props of a tile, the drag under way (to draw the tile under the pointer), and whether a
 * press is a drag, which keeps a tile's menu from opening during one. `onDragChange` is told when
 * a drag starts and ends (auto-hide holds the Dock out meanwhile).
 */
export function useDockDrag(
  apps: DockApps,
  position: DockPosition,
  onDragChange?: (active: boolean) => void,
) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const current = useRef<Drag | null>(null);
  const geometry = useRef<DragGeometry | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  // A drag ends in a click on the tile it moved: that click opens nothing.
  const swallowClick = useRef(false);
  const latest = useRef({ apps, position, onDragChange });
  latest.current = { apps, position, onDragChange };
  // Cancels the drag under way, set while one is: a press that finds a drag still recorded (its
  // release never arrived) cancels it rather than being ignored.
  const cancel = useRef<(() => void) | null>(null);

  const active = drag !== null;
  useEffect(() => {
    if (!active) return;
    const move = (event: PointerEvent) => {
      const state = current.current;
      const measured = geometry.current;
      if (!state || !measured || event.pointerId !== state.pointer) return;
      const dx = event.clientX - state.x;
      const dy = event.clientY - state.y;
      if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      offset.current = { x: dx, y: dy };
      const { position: edge, apps: list } = latest.current;
      const drop = dropOf(measured, edge, event.clientX, event.clientY, list.docked.length);
      if (!state.moved) latest.current.onDragChange?.(true);
      current.current = { ...state, ...drop, moved: true };
      setDrag(current.current);
    };
    const end = (event: PointerEvent) => {
      const state = current.current;
      if (!state || event.pointerId !== state.pointer) return;
      finish(state, event.type === "pointercancel");
    };
    // Ends the drag: the tile goes to its place, or back where it was when `cancelled`.
    const finish = (state: Drag, cancelled: boolean) => {
      current.current = null;
      geometry.current = null;
      setDrag(null);
      offset.current = { x: 0, y: 0 };
      if (state.moved) latest.current.onDragChange?.(false);
      if (!state.moved || cancelled) return;
      swallowClick.current = true;
      setTimeout(() => {
        swallowClick.current = false;
      }, 0);
      const { apps: list } = latest.current;
      if (state.removing) list.remove(state.id);
      else list.move(state.id, state.index);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    // Let go outside the browser, the drag never sees its pointer up: losing the browser's focus
    // ends it as cancelled, so the tile goes back and the Dock's hold is let go. The tile captures
    // its pointer when pressed, so its release reaches it even outside the window; a capture lost
    // without a release (the tile went away) cancels the drag too.
    const lost = () => {
      const state = current.current;
      if (state) finish(state, true);
    };
    const released = (event: PointerEvent) => {
      if (current.current && event.pointerId === current.current.pointer) lost();
    };
    cancel.current = lost;
    window.addEventListener("blur", lost);
    window.addEventListener("lostpointercapture", released);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", lost);
      window.removeEventListener("lostpointercapture", released);
      if (cancel.current === lost) cancel.current = null;
    };
  }, [active]);

  const tileProps = (id: string) => ({
    "data-dock-app": id,
    "data-dragging": drag?.id === id && drag.moved ? "" : undefined,
    "data-removing": drag?.id === id && drag.removing ? "" : undefined,
    style:
      drag?.id === id && drag.moved
        ? ({
            transform: `translate(${offset.current.x}px, ${offset.current.y}px)`,
          } as CSSProperties)
        : undefined,
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || event.ctrlKey) return;
      if (current.current) {
        // A press while a drag is still recorded: its release never arrived (a mouse presses again
        // with the same pointer). That drag is cancelled, and this press starts afresh.
        if (cancel.current) cancel.current();
        else current.current = null;
      }
      // The release reaches the tile wherever it happens, so the drag always ends.
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        // A pointer that cannot be captured still ends the drag through the window's events.
      }
      geometry.current = measure(event.currentTarget, id, position);
      current.current = {
        id,
        pointer: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        index: apps.docked.indexOf(id),
        removing: false,
      };
      setDrag(current.current);
    },
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  });

  return { drag, tileProps, dragging: () => Boolean(current.current?.moved) };
}

/** The application whose Dock tile takes a folder: a shell opens there. */
const FOLDER_OPENER = "terminal";

/**
 * The Dock as a drop target: pass the answer as its `ref`. The Trash takes what its source lets go
 * to the Trash, and an application's tile opens the files that application opens. A tile says what
 * it is: `trash`, or the application's id. An application dragged from Finder's Applications is
 * kept, by `keepApplication`, wherever on the Dock it lands.
 */
export function useDockDrop(keepApplication: (name: string) => void) {
  const keep = useRef(keepApplication);
  keep.current = keepApplication;
  return useCallback((element: HTMLElement | null) => {
    if (!element) return undefined;
    return registerDropTarget({
      element,
      landing(hit, drag) {
        const tile = hit.closest("[data-dock-target]");
        const target = tile?.getAttribute("data-dock-target");
        const applications = drag.items.filter((item) => item.type === LAUNCHPAD_APP_DRAG);
        if (applications.length > 0) {
          return {
            element: tile ?? element,
            refusal:
              target === "trash" ? "An application can’t go to the Trash from here." : undefined,
            drop() {
              for (const application of applications) keep.current(application.name);
            },
          };
        }
        if (!tile || !target) return undefined;
        if (drag.items.some((item) => item.bytes)) {
          return {
            element: tile,
            refusal: "Save this to a folder first: it isn’t on your drive yet.",
            drop: () => {},
          };
        }
        if (target === "trash") {
          return {
            element: tile,
            refusal: drag.trash ? undefined : "These items can’t go to the Trash from here.",
            drop: () => drag.trash?.(),
          };
        }
        if (target === "keep") {
          return {
            element: tile,
            drop: () => keepInDock(drag.items.map((item) => item.id)),
          };
        }
        if (target.startsWith("folder:")) {
          const parent = target.slice("folder:".length);
          const copies = drag.copy || (drag.from !== "finder" && drag.from !== "desktop");
          return {
            element: tile,
            copies,
            drop() {
              void (
                copies
                  ? runUndoable(
                      "Copy",
                      drag.items.map((item) => ({
                        op: "copy" as const,
                        id: item.id,
                        parent,
                        existing: "rename" as const,
                      })),
                    )
                  : runUndoable(
                      "Move",
                      drag.items.map((item) => ({ op: "move" as const, id: item.id, parent })),
                    )
              ).catch((error) => {
                console.warn(error);
              });
            },
          };
        }
        const taken = drag.items.filter(
          (item) => item.kind === "file" && appsForFile(item).includes(target),
        );
        const folders =
          target === FOLDER_OPENER ? drag.items.filter((item) => item.kind !== "file") : [];
        return {
          element: tile,
          copies: true,
          refusal:
            taken.length + folders.length > 0
              ? undefined
              : `${tile.getAttribute("aria-label")} can’t open this.`,
          drop() {
            for (const item of taken) openFile(item, target);
            for (const { id, name } of folders) {
              requestOpenFile({ app: target, id, name, folder: "window" });
            }
            if (folders.length > 0) requestDesktopEffects([{ open: target }]);
          },
        };
      },
    });
  }, []);
}

export interface DockAppTileProps extends Omit<DockItemProps, "onClick"> {
  /** The app's id. */
  id: string;
  /** Whether the app is in the person's Dock (otherwise it shows there only while it runs). */
  docked: boolean;
  /** Open the app, or bring it to the front. */
  onOpen: () => void;
  /** Keep the app in the Dock, or take it out. */
  onKeepChange: (keep: boolean) => void;
  /** Whether a drag is under way: the tile's menu does not open then. */
  dragging: () => boolean;
  /** The side of the tile its menu opens on. */
  position: DockPosition;
  /** Told when the tile's menu opens or closes (auto-hide holds the Dock out meanwhile). */
  onMenuOpenChange?: (open: boolean) => void;
  /** Further props of the tile (the drag's). */
  tileProps?: Record<string, unknown>;
  /** What the tile's menu does to the running application. */
  runningApp?: DockTileRunning;
  /** Whether the application opens with the desktop, and changing it; absent on the docs desktop. */
  openAtLogin?: boolean;
  onOpenAtLoginChange?: (open: boolean) => void;
  /** Shows the application in Finder's Applications folder. */
  onShowInFinder?: () => void;
  /** Options > Assign To: which Space the application's windows open on. */
  assignTo?: {
    value: string;
    onChange: (choice: "all" | "this" | "none") => void;
  };
  children?: ReactNode;
}

/** The windows of a running application and the commands on them, for its Dock tile's menu. */
export interface DockTileRunning {
  windows: readonly { id: string; title: string; minimized?: boolean }[];
  /** Brings a window to the front, from the Dock if it is minimized there. */
  focus: (id: string) => void;
  hide: () => void;
  hideOthers: () => void;
  /** Absent for an application that cannot quit: Finder. */
  quit?: () => void;
  forceQuit?: () => void;
  /** App Exposé: every window of the application, apart. */
  showAll?: () => void;
}

/** Whether Option is held: a Dock menu's rows change with it, however early it was pressed. */
let optionHeld = false;
const optionListeners = new Set<() => void>();

function followOption(event: KeyboardEvent | globalThis.MouseEvent) {
  if (optionHeld === event.altKey) return;
  optionHeld = event.altKey;
  for (const listener of optionListeners) listener();
}

function dropOption() {
  if (!optionHeld) return;
  optionHeld = false;
  for (const listener of optionListeners) listener();
}

const OPTION_EVENTS = ["keydown", "keyup", "pointerdown", "contextmenu"] as const;

function subscribeOption(listener: () => void) {
  if (optionListeners.size === 0) {
    for (const name of OPTION_EVENTS) {
      window.addEventListener(name, followOption as EventListener, true);
    }
    window.addEventListener("blur", dropOption);
  }
  optionListeners.add(listener);
  return () => {
    optionListeners.delete(listener);
    if (optionListeners.size > 0) return;
    for (const name of OPTION_EVENTS) {
      window.removeEventListener(name, followOption as EventListener, true);
    }
    window.removeEventListener("blur", dropOption);
    optionHeld = false;
  };
}

export function useOptionKey() {
  return useSyncExternalStore(
    subscribeOption,
    () => optionHeld,
    () => false,
  );
}

/** The rows of a Dock menu for a running application: its windows first, then Hide and Quit. */
export function DockWindowRows({ running }: { running: DockTileRunning }) {
  if (running.windows.length === 0) return null;
  return (
    <>
      {running.windows.map((window) => (
        <MenuItem key={window.id} onClick={() => running.focus(window.id)}>
          {window.title}
        </MenuItem>
      ))}
      <MenuSeparator />
    </>
  );
}

export function DockHideRows({ running, option }: { running: DockTileRunning; option: boolean }) {
  const hidden = running.windows.every((window) => window.minimized);
  const windows = running.windows.length > 0;
  const force = option && running.forceQuit;
  return (
    <>
      {windows && running.showAll ? (
        <MenuItem onClick={running.showAll}>Show All Windows</MenuItem>
      ) : null}
      {!windows ? null : hidden ? (
        <MenuItem
          onClick={() => {
            for (const window of running.windows) running.focus(window.id);
          }}
        >
          Show
        </MenuItem>
      ) : (
        <MenuItem onClick={option ? running.hideOthers : running.hide}>
          {option ? "Hide Others" : "Hide"}
        </MenuItem>
      )}
      {running.quit ? (
        <MenuItem onClick={force ? running.forceQuit : running.quit}>
          {force ? "Force Quit" : "Quit"}
        </MenuItem>
      ) : null}
    </>
  );
}

/** System Preferences' Dock menu names its panes, band by band of its grid. */
function PaneRows({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      {[ACCOUNT_PANES, ...GRID_BANDS].map((band) => (
        <Fragment key={band[0]?.id}>
          {band.map((pane) => (
            <MenuItem
              key={pane.id}
              onClick={() => {
                requestPane(pane.id);
                onOpen();
              }}
            >
              {pane.name}
            </MenuItem>
          ))}
          <MenuSeparator />
        </Fragment>
      ))}
    </>
  );
}

/** The rows an application's last used window registered for its Dock menu (`desktop-app-menus.ts`). */
function DockOwnRows({ id }: { id: string }) {
  const own = useDesktopAppMenuItems(id, "Dock");
  return own ? (
    <>
      {own}
      <MenuSeparator />
    </>
  ) : null;
}

/**
 * One app of the Dock, with its menu (a secondary click, Control-click or a long press): its windows,
 * Open while it is not running, Options, and Hide and Quit while it is, which Option turns into Hide
 * Others and Force Quit.
 */
export function DockAppTile({
  id,
  docked,
  onOpen,
  onKeepChange,
  dragging,
  position,
  onMenuOpenChange,
  tileProps,
  label,
  runningApp,
  openAtLogin,
  onOpenAtLoginChange,
  onShowInFinder,
  assignTo,
  ...props
}: DockAppTileProps) {
  const [open, setOpen] = useState(false);
  const option = useOptionKey();
  const side = position === "bottom" ? "top" : position === "left" ? "right" : "left";
  // A tile that goes while its menu is open (its app quit or was uninstalled) lets go of the
  // Dock's hold, so an auto-hidden Dock can hide again.
  const release = useRef({ open, onMenuOpenChange });
  release.current = { open, onMenuOpenChange };
  useEffect(
    () => () => {
      if (release.current.open) release.current.onMenuOpenChange?.(false);
    },
    [],
  );
  return (
    <DockMenu
      open={open}
      modal={false}
      onOpenChange={(next) => {
        const shown = next && !dragging();
        setOpen(shown);
        onMenuOpenChange?.(shown);
      }}
    >
      <DockMenuTrigger
        render={<DockItem label={label} {...props} {...tileProps} onClick={onOpen} />}
      />
      <DockMenuPopup side={side} aria-label={label}>
        {runningApp ? <DockWindowRows running={runningApp} /> : null}
        {id === "system-preferences" ? <PaneRows onOpen={onOpen} /> : null}
        <DockOwnRows id={id} />
        {props.running ? null : (
          <>
            <MenuItem onClick={onOpen}>Open</MenuItem>
            <MenuSeparator />
          </>
        )}
        <Submenu>
          <SubmenuTrigger>Options</SubmenuTrigger>
          <SubmenuPopup>
            {docked ? (
              <MenuItem onClick={() => onKeepChange(false)}>Remove from Dock</MenuItem>
            ) : (
              <MenuItem onClick={() => onKeepChange(true)}>Keep in Dock</MenuItem>
            )}
            {onOpenAtLoginChange ? (
              <MenuCheckboxItem checked={openAtLogin} onCheckedChange={onOpenAtLoginChange}>
                Open at Login
              </MenuCheckboxItem>
            ) : null}
            {onShowInFinder ? (
              <>
                <MenuSeparator />
                <MenuItem onClick={onShowInFinder}>Show in Finder</MenuItem>
              </>
            ) : null}
            {assignTo ? (
              <>
                <MenuSeparator />
                <MenuItem disabled>Assign To</MenuItem>
                <MenuRadioGroup
                  value={assignTo.value}
                  onValueChange={(value) => assignTo.onChange(value as "all" | "this" | "none")}
                >
                  <MenuRadioItem value="all">All Desktops</MenuRadioItem>
                  <MenuRadioItem value="this">This Desktop</MenuRadioItem>
                  <MenuRadioItem value="none">None</MenuRadioItem>
                </MenuRadioGroup>
              </>
            ) : null}
          </SubmenuPopup>
        </Submenu>
        {runningApp && (runningApp.windows.length > 0 || runningApp.quit) ? (
          <>
            <MenuSeparator />
            <DockHideRows running={runningApp} option={option} />
          </>
        ) : null}
      </DockMenuPopup>
    </DockMenu>
  );
}
