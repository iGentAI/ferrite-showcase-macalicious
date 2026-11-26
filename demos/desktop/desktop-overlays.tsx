"use client";

import { Launchpad, LaunchpadItem } from "macalicious/launchpad";
import { LaunchpadFolder } from "macalicious/launchpad-folder";
import { Siri, SiriCard } from "macalicious/siri";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { REMOVABLE_CLASS, useLaunchpadRemoval } from "../app-store/app-store-launchpad";
import { SpotlightSearchPanel } from "../spotlight/spotlight-desktop";
import type { DesktopApp } from "./desktop-apps";
import { AppTile } from "./desktop-artwork";
import {
  folderNameFor,
  LAUNCHPAD_APP_DRAG,
  LAUNCHPAD_FOLDERS,
  launchpadEntries,
  NO_FOLDERS,
  readFolders,
  withAppInFolder,
  withAppOutOfFolder,
  withFolderNamed,
  withNewFolder,
} from "./desktop-launchpad-folders";
import { useCatalogue } from "./desktop-library";
import { DesktopNotificationCenter } from "./desktop-notifications";
import { useDesktopSetting } from "./desktop-personal";
import { servedByDesktopApp } from "./desktop-server";
import { DesktopSiri } from "./desktop-siri";

/** What the desktop shows over its windows, one at a time. */
export type DesktopOverlay =
  | "launchpad"
  | "spotlight"
  | "siri"
  | "notification-center"
  | "mission-control";

export interface DesktopOverlaysProps {
  /** The overlay that is showing. */
  overlay: DesktopOverlay | null;
  /** Called with the overlay to show, or `null` to close the one showing. */
  onOverlayChange: (overlay: DesktopOverlay | null) => void;
  /** The applications of the desktop: Spotlight searches them. */
  apps: readonly DesktopApp[];
  /**
   * The applications Launchpad lists, in its order.
   * @default apps
   */
  launchpadApps?: readonly DesktopApp[];
  /** Launchpad's page (controlled), with `onPageChange`. */
  page?: number;
  /** Called with the page Launchpad turns to. */
  onPageChange?: (page: number) => void;
  /**
   * Called when an application of Launchpad is dragged onto another, or moved with Option and
   * Left or Right Arrow: the application's id and the place in `launchpadApps` it moves to.
   * Without it the applications keep their places.
   */
  onMove?: (id: string, index: number) => void;
  /** Open an application, or bring it to the front. */
  launch: (id: string) => void;
  /** The desktop's element, which Launchpad covers and blurs. */
  container: HTMLElement | null;
}

/** How a folder being dragged is told from an application: it moves as its first application. */
const FOLDER_DRAG = "folder:";

/** The applications on one page of Launchpad at most: 7 columns by 5 rows. */
const MOST_COLUMNS = 7;
const MOST_ROWS = 5;
/** The smallest cell an application's icon and name still fit in, in points. */
const LEAST_CELL = { width: 110, height: 104 };
/** What the search field, the page dots and the Dock's room take from the height of the screen. */
const ROWS_CHROME = 156;

/**
 * Launchpad's grid on a desktop of this size: 7 by 5 down to where a cell would no longer hold an
 * application, then fewer, as a Mac's smaller screens have. Unmeasured, the most.
 */
export function launchpadGrid(width: number, height: number) {
  if (width <= 0 || height <= 0) return { columns: MOST_COLUMNS, rows: MOST_ROWS };
  return {
    columns: Math.min(MOST_COLUMNS, Math.max(1, Math.floor(width / LEAST_CELL.width))),
    rows: Math.min(MOST_ROWS, Math.max(1, Math.floor((height - ROWS_CHROME) / LEAST_CELL.height))),
  };
}

function useLaunchpadGrid(container: HTMLElement | null) {
  const [grid, setGrid] = useState(() => launchpadGrid(0, 0));
  useEffect(() => {
    if (!container || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const next = launchpadGrid(container.clientWidth, container.clientHeight);
      setGrid((was) => (was.columns === next.columns && was.rows === next.rows ? was : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [container]);
  return grid;
}

/** How far a delete badge reaches into its tile (`app-store-launchpad.css`), with a little to spare. */
const DELETE_BADGE = 28;
/** How long a press on an application lasts before Launchpad starts to jiggle, as a Mac's does. */
const LONG_PRESS_MS = 1_000;
/** How far the pointer may wander during that press: further, it is a drag. */
const LONG_PRESS_SLOP = 6;
/** How far a wheel moves before it turns the page, in its pixels. */
const WHEEL_TO_TURN = 60;
/** What one line of a line-mode wheel counts as: a notch, of about three lines, turns a page. */
const LINE_PIXELS = 20;
/** How long a wheel stays still before it can turn the page again, so that one swipe turns one. */
const WHEEL_REST_MS = 500;
/** The strip along each side of the screen where a held application turns the page. */
const EDGE_WIDTH = 60;
const EDGE_HOLD_MS = 500;
/** How much of a tile, either side of its middle, makes a drop a folder rather than a move. */
const FOLDER_SHARE = 0.3;

/** Whether a click on a tile is on its delete badge, or from the keyboard, which has no place. */
const onDeleteBadge = (event: {
  detail: number;
  clientX: number;
  clientY: number;
  currentTarget: Element;
}) => {
  if (event.detail === 0) return true;
  const { left, top, width } = event.currentTarget.getBoundingClientRect();
  const badge = left + Math.max(2, width / 2 - 54);
  return (
    event.clientX >= badge &&
    event.clientX <= badge + DELETE_BADGE &&
    event.clientY >= top &&
    event.clientY <= top + DELETE_BADGE
  );
};

/** Whether a drop at this point of a tile is on its middle: a folder, not a move. */
const onMiddle = (event: { clientX: number; currentTarget: Element }) => {
  const { left, width } = event.currentTarget.getBoundingClientRect();
  return Math.abs(event.clientX - left - width / 2) < width * FOLDER_SHARE;
};

/** A wheel's movement along its main direction in pixels, whatever unit its device reports. */
function wheelPixels(
  { deltaMode, deltaX, deltaY }: Pick<WheelEvent, "deltaMode" | "deltaX" | "deltaY">,
  pageHeight: number,
) {
  const unit = deltaMode === 1 ? LINE_PIXELS : deltaMode === 2 ? pageHeight : 1;
  return (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY) * unit;
}

/**
 * Launchpad, Spotlight, Siri and Notification Center on the desktop, drawn with the library's
 * components. Launchpad is filled from the desktop's applications and opens the one chosen;
 * Spotlight (`../spotlight/spotlight-desktop.tsx`) searches them, works out sums and conversions,
 * and, when the desktop's Ferrite application serves the page, the person's own things too. Siri
 * answers nothing and shows what a request would look like, unless the desktop's Ferrite
 * application serves the page, when it answers and acts (`desktop-siri.tsx`); Notification
 * Center shows the session's notifications when the desktop is served
 * (`desktop-notifications.tsx`). An application of Launchpad moves when it is dragged onto
 * the side of another (it takes that one's place), or with Option and an arrow key; let go on the
 * middle of another it makes a folder of the two (`desktop-launchpad-folders.ts`). Let go on the Dock
 * it stays in the Dock. Option held, or a long press on an application, starts the jiggling, in which
 * an app the person got from the App Store can be deleted (`../app-store/app-store-launchpad.tsx`).
 */
export function DesktopOverlays({
  overlay,
  onOverlayChange,
  apps,
  launchpadApps = apps,
  page,
  onPageChange,
  onMove,
  launch,
  container,
}: DesktopOverlaysProps) {
  const close = () => onOverlayChange(null);
  const dragged = useRef<string | null>(null);
  const { columns, rows } = useLaunchpadGrid(container);
  const perPage = columns * rows;
  const keptSpotlightQuery = useRef({ query: "", at: 0 });
  // The application moved from the keyboard: it keeps the focus, on whichever page it lands.
  const [moved, setMoved] = useState<string | null>(null);
  useEffect(() => {
    if (!moved || !container) return;
    setMoved(null);
    container
      .querySelector<HTMLElement>(`.mac-launchpad-item[data-app="${CSS.escape(moved)}"]`)
      ?.focus();
  });
  const [search, setSearch] = useState("");
  const [folders, setFolders] = useDesktopSetting(LAUNCHPAD_FOLDERS, readFolders, NO_FOLDERS);
  const { catalogue } = useCatalogue(servedByDesktopApp());
  const categoryOf = (id: string) => catalogue?.find((app) => app.id === id)?.category;
  // A search looks through folders: what it finds shows by itself.
  const entries = useMemo(
    () => launchpadEntries(launchpadApps, search.trim() === "" ? folders : NO_FOLDERS),
    [launchpadApps, folders, search],
  );
  const pages = Math.max(1, Math.ceil(entries.length / perPage));
  const removal = useLaunchpadRemoval(overlay === "launchpad");
  // Held down on an application, Launchpad stays in its editing state until Escape or a click.
  const [heldEditing, setHeldEditing] = useState(false);
  const editing = removal.editing || heldEditing;
  const longPress = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(
    null,
  );
  const pressWasLong = useRef(false);
  const endLongPress = useCallback(() => {
    if (longPress.current) clearTimeout(longPress.current.timer);
    longPress.current = null;
  }, []);
  const placeOf = (entry: (typeof entries)[number] | undefined) => {
    const anchor = entry?.kind === "app" ? entry.app : entry?.apps[0];
    return anchor ? launchpadApps.indexOf(anchor) : -1;
  };
  const anchorOf = (entry: (typeof entries)[number]) =>
    entry.kind === "app" ? entry.app.id : (entry.apps[0]?.id ?? "");
  const latestFolders = useRef(folders);
  latestFolders.current = folders;
  const stopFollowing = useRef<(() => void) | null>(null);
  useEffect(() => () => stopFollowing.current?.(), []);
  /**
   * An open folder covers the grid, so an application dragged out of it can land only outside its
   * panel. The drop there takes it out; a drag cancelled with Escape ends without one.
   */
  const followOut = (app: string) => {
    const outside = (event: DragEvent) =>
      !(event.target as Element | null)?.closest?.(".mac-launchpad-folder-panel");
    const over = (event: DragEvent) => {
      if (outside(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!outside(event)) return;
      event.preventDefault();
      end();
      setFolders(withAppOutOfFolder(latestFolders.current, app));
    };
    // Taking it out removes the element dragged, so no dragend can be counted on after a drop.
    const end = () => {
      document.removeEventListener("dragover", over, true);
      document.removeEventListener("drop", drop, true);
      document.removeEventListener("dragend", end, true);
      stopFollowing.current = null;
    };
    stopFollowing.current?.();
    stopFollowing.current = end;
    document.addEventListener("dragover", over, true);
    document.addEventListener("drop", drop, true);
    document.addEventListener("dragend", end, true);
  };
  const appItem = (
    app: DesktopApp,
    { entry, at, folder }: { entry?: (typeof entries)[number]; at?: number; folder?: string },
  ) => {
    // While Launchpad is being edited, an app got from the App Store asks to be deleted instead.
    const deletable = editing && removal.removable(app.id);
    return (
      <LaunchpadItem
        key={app.id}
        label={app.name}
        data-app={app.id}
        className={
          deletable ? REMOVABLE_CLASS : editing ? "mac-desktop-shell-launchpad-jiggle" : undefined
        }
        aria-label={deletable ? `Delete ${app.name}` : undefined}
        onPointerDown={(event) => {
          pressWasLong.current = false;
          if (event.button !== 0 || heldEditing) return;
          endLongPress();
          longPress.current = {
            x: event.clientX,
            y: event.clientY,
            timer: setTimeout(() => {
              longPress.current = null;
              pressWasLong.current = true;
              setHeldEditing(true);
            }, LONG_PRESS_MS),
          };
        }}
        onPointerMove={(event) => {
          const press = longPress.current;
          if (
            press &&
            Math.hypot(event.clientX - press.x, event.clientY - press.y) > LONG_PRESS_SLOP
          ) {
            endLongPress();
          }
        }}
        onPointerLeave={endLongPress}
        onClick={(event) => {
          // The release of the press that started the jiggling opens nothing.
          if (pressWasLong.current) {
            pressWasLong.current = false;
            event.preventDefault();
            return;
          }
          // A click on an application ends the jiggling, as on a Mac; the delete badge still asks.
          if (heldEditing && !(deletable && onDeleteBadge(event))) {
            setHeldEditing(false);
            event.preventDefault();
            return;
          }
          if (!deletable) {
            launch(app.id);
            return;
          }
          // Launchpad stays open behind the question, as on macOS.
          event.preventDefault();
          removal.ask(app);
        }}
        draggable={onMove ? true : undefined}
        onDragStart={(event) => {
          // An open folder's applications render inside its element: the drag is the application's.
          event.stopPropagation();
          endLongPress();
          dragged.current = app.id;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", app.id);
          event.dataTransfer.setData(LAUNCHPAD_APP_DRAG, app.id);
          if (folder) followOut(app.id);
        }}
        onDragOver={(event) => {
          if (dragged.current && dragged.current !== app.id) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const id = dragged.current;
          dragged.current = null;
          if (!id || id === app.id || folder) return;
          if (onMiddle(event) && !id.startsWith(FOLDER_DRAG)) {
            const name = folderNameFor(categoryOf(id), categoryOf(app.id));
            setFolders(withNewFolder(folders, id, app.id, name));
          } else {
            const moving = id.startsWith(FOLDER_DRAG) ? id.slice(FOLDER_DRAG.length) : id;
            onMove?.(moving, placeOf(entry));
          }
        }}
        onDragEnd={() => {
          dragged.current = null;
          leaveEdge();
        }}
        onKeyDown={(event) => {
          const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
          if (
            !onMove ||
            step === 0 ||
            !event.altKey ||
            event.metaKey ||
            event.ctrlKey ||
            at === undefined
          )
            return;
          event.preventDefault();
          const to = at + step;
          if (to < 0 || to >= entries.length) return;
          onMove(app.id, placeOf(entries[to]));
          setMoved(app.id);
          // An application moved past the end of its page turns the page with it.
          const target = Math.floor(to / perPage);
          if (target !== Math.floor(at / perPage)) changePage(target);
        }}
      >
        <AppTile id={app.id} name={app.name} />
      </LaunchpadItem>
    );
  };
  const padOpen = overlay === "launchpad";
  // Launchpad stays mounted between openings; each one starts with an empty field.
  useEffect(() => {
    if (padOpen) setSearch("");
    else setHeldEditing(false);
    if (!padOpen) return;
    // A press ends wherever it is let go, and with Launchpad.
    window.addEventListener("pointerup", endLongPress, true);
    window.addEventListener("pointercancel", endLongPress, true);
    return () => {
      window.removeEventListener("pointerup", endLongPress, true);
      window.removeEventListener("pointercancel", endLongPress, true);
      endLongPress();
    };
  }, [padOpen, endLongPress]);
  // The page is the desktop's when it keeps one, and this overlay's otherwise.
  const [ownPage, setOwnPage] = useState(0);
  const current = Math.min(page ?? ownPage, pages - 1);
  const changePage = (next: number) => {
    setOwnPage(next);
    onPageChange?.(next);
  };
  const turn = (step: number) => {
    const next = Math.min(Math.max(current + step, 0), pages - 1);
    if (next === current) return false;
    changePage(next);
    return true;
  };
  // A wheel's or a trackpad's stream of small movements turns one page, then rests.
  const wheel = useRef({ moved: 0, restsUntil: 0 });
  // An application held at the edge of the screen turns the page after a moment.
  const edge = useRef<{ step: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const leaveEdge = () => {
    if (edge.current) clearTimeout(edge.current.timer);
    edge.current = null;
  };
  const turnAtEdge = useRef(turn);
  turnAtEdge.current = turn;
  return (
    <>
      <Launchpad
        open={padOpen}
        columns={columns}
        rows={rows}
        onOpenChange={(open) => {
          // A press on the delete question is outside Launchpad, which stays open behind it.
          if (!open && removal.asking) return;
          // Escape or a click on the background ends the jiggling first.
          if (!open && heldEditing) {
            setHeldEditing(false);
            return;
          }
          onOverlayChange(open ? "launchpad" : null);
        }}
        container={container}
        page={current}
        onPageChange={changePage}
        search={search}
        onSearchChange={setSearch}
        onKeyDown={(event) => {
          // Left and Right Arrow turn the page where no application takes them: on the overlay, and
          // at the last or first application of a page. The field keeps them for its insertion point.
          const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
          const target = event.target as HTMLElement;
          if (
            step === 0 ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.defaultPrevented ||
            search.trim() !== "" ||
            !event.currentTarget.contains(target) ||
            target.closest("input")
          ) {
            return;
          }
          if (!turn(step)) return;
          event.preventDefault();
          // The application that had the focus is on the page that goes: the overlay takes it.
          event.currentTarget.focus();
        }}
        onWheel={(event) => {
          if (search.trim() !== "") return;
          // A swipe and its momentum are one movement: the rest lasts until the events stop.
          if (event.timeStamp < wheel.current.restsUntil) {
            wheel.current.restsUntil = event.timeStamp + WHEEL_REST_MS;
            return;
          }
          wheel.current.moved += wheelPixels(event, event.currentTarget.clientHeight);
          if (Math.abs(wheel.current.moved) < WHEEL_TO_TURN) return;
          turn(Math.sign(wheel.current.moved));
          wheel.current = { moved: 0, restsUntil: event.timeStamp + WHEEL_REST_MS };
        }}
        onDragOver={(event) => {
          if (!dragged.current) return;
          const { left, right } = event.currentTarget.getBoundingClientRect();
          const step =
            event.clientX < left + EDGE_WIDTH ? -1 : event.clientX > right - EDGE_WIDTH ? 1 : 0;
          if (step === edge.current?.step) return;
          leaveEdge();
          if (step === 0) return;
          edge.current = {
            step,
            timer: setTimeout(() => {
              leaveEdge();
              turnAtEdge.current(step);
            }, EDGE_HOLD_MS),
          };
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) leaveEdge();
        }}
        onDrop={leaveEdge}
      >
        {entries.map((entry, at) =>
          entry.kind === "app" ? (
            appItem(entry.app, { entry, at })
          ) : (
            <LaunchpadFolder
              key={entry.folder.id}
              label={entry.folder.name}
              data-folder={entry.folder.id}
              container={container}
              heading={
                <input
                  className="mac-desktop-shell-launchpad-folder-name"
                  aria-label="Folder name"
                  defaultValue={entry.folder.name}
                  onBlur={(event) => {
                    const name = event.currentTarget.value.trim();
                    if (name && name !== entry.folder.name) {
                      setFolders(withFolderNamed(folders, entry.folder.id, name));
                    }
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              }
              draggable={onMove ? true : undefined}
              onDragStart={(event) => {
                dragged.current = `${FOLDER_DRAG}${anchorOf(entry)}`;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", entry.folder.name);
              }}
              onDragOver={(event) => {
                if (dragged.current) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = dragged.current;
                dragged.current = null;
                if (!id) return;
                if (id.startsWith(FOLDER_DRAG)) {
                  onMove?.(id.slice(FOLDER_DRAG.length), placeOf(entry));
                } else if (onMiddle(event)) {
                  setFolders(withAppInFolder(folders, id, entry.folder.id));
                } else {
                  onMove?.(id, placeOf(entry));
                }
              }}
              onDragEnd={() => {
                dragged.current = null;
                leaveEdge();
              }}
            >
              {entry.apps.map((app) => appItem(app, { folder: entry.folder.id }))}
            </LaunchpadFolder>
          ),
        )}
      </Launchpad>
      {removal.alert}
      {overlay === "spotlight" ? (
        <SpotlightSearchPanel
          apps={apps}
          launch={launch}
          onClose={close}
          keptQuery={keptSpotlightQuery}
        />
      ) : null}
      {overlay === "notification-center" ? (
        <DesktopNotificationCenter apps={apps} launch={launch} onClose={close} />
      ) : null}
      {overlay === "siri" && servedByDesktopApp() ? (
        <DesktopSiri onClose={close} launch={launch} />
      ) : overlay === "siri" ? (
        <div className="mac-desktop-shell-siri">
          <Siri prompt="What can I help you with?" onClose={close} style={{ height: 360 }}>
            <SiriCard title="Some things you can ask">
              <ul className="mac-desktop-shell-siri-list">
                <li>“Open Calculator”</li>
                <li>“What’s on my calendar today?”</li>
                <li>“Show my notes”</li>
              </ul>
            </SiriCard>
          </Siri>
        </div>
      ) : null}
    </>
  );
}
