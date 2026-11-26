"use client";

import { AppSwitcher, AppSwitcherItem } from "macalicious/app-switcher";
import { BorderlessButton } from "macalicious/borderless-button";
import { observeResize } from "macalicious/lib/observe-resize";
import { MissionControl, MissionControlWindow } from "macalicious/mission-control";
import type { ManagedWindowInfo } from "macalicious/window-manager";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { appForFile, openFile } from "../finder/finder-open";
import type { DesktopApp } from "./desktop-apps";
import { AppTile } from "./desktop-artwork";
import { useDrive } from "./desktop-files";
import { readBoolean, readNumber, useDesktopValue } from "./desktop-personal";
import { RECENT_DOCUMENTS_CLEARED, shelfDocuments } from "./desktop-recent-documents";
import { servedByDesktopApp } from "./desktop-server";
import { fullScreenWindowOf, type SpacesApi } from "./desktop-spaces";
import { DesktopSpacesBar, followDrag, spaceAt } from "./desktop-spaces-bar";
import "./desktop-overview.css";

/**
 * Mission Control, App Exposé, Show Desktop and the application switcher on the desktop. The windows
 * shown are the live ones, scaled with `translate` and `scale` (a window places itself with
 * `transform`, which they leave alone), so nothing in them restarts or loses its state; the library's
 * Mission Control lays them out and holds the buttons over them.
 */

/** How long the windows take to go back, as `desktop-overview.css` says. */
const SETTLE_MS = 260;

/** System Preferences > Mission Control > Group windows by application. */
const GROUP_BY_APPLICATION = "mission-control.groupByApplication";

/** Where a window stands in the manager, from its own `transform`, and its size. */
function placeOf(shell: HTMLElement) {
  const { e: x, f: y } = new DOMMatrixReadOnly(getComputedStyle(shell).transform);
  return { x, y, width: shell.offsetWidth, height: shell.offsetHeight };
}

const shellsIn = (manager: Element) =>
  [...manager.querySelectorAll<HTMLElement>("[data-window-id]")].filter(
    (shell) => !shell.hasAttribute("data-minimized"),
  );

/** What takes the windows' marks off, waiting for them to arrive. Whatever moves them next stops it. */
const settling = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/** Marks a window to move: the marks it had are not to come off now. */
const keepMarks = (manager: Element) => clearTimeout(settling.get(manager));

/** Moves each window onto its button; a window with no button goes out of sight. */
function placeWindows(manager: Element) {
  keepMarks(manager);
  const room = manager.getBoundingClientRect();
  for (const shell of shellsIn(manager)) {
    const id = shell.dataset.windowId ?? "";
    const button = manager.querySelector(`[data-mission-window="${CSS.escape(id)}"]`);
    if (!button) {
      shell.dataset.missionControl = "away";
      continue;
    }
    const { x, y, width } = placeOf(shell);
    const slot = button.getBoundingClientRect();
    const scale = slot.width / width;
    shell.dataset.missionControl = "shown";
    shell.style.translate = `${slot.left - room.left - x * scale}px ${slot.top - room.top - y * scale}px`;
    shell.style.scale = String(scale);
  }
}

/** Puts the windows back, and takes off what held them once they have arrived. */
function release(manager: Element) {
  keepMarks(manager);
  for (const shell of manager.querySelectorAll<HTMLElement>("[data-window-id]")) {
    shell.style.translate = "";
    shell.style.scale = "";
  }
  settling.set(
    manager,
    setTimeout(() => {
      for (const shell of manager.querySelectorAll<HTMLElement>("[data-mission-control]")) {
        delete shell.dataset.missionControl;
      }
      if (manager instanceof HTMLElement) delete manager.dataset.missionControlOpen;
    }, SETTLE_MS),
  );
}

export interface DesktopMissionControlProps {
  open: boolean;
  /** Show only this application's windows: App Exposé. */
  app: string | null;
  windows: readonly ManagedWindowInfo[];
  apps: readonly DesktopApp[];
  frameOf: (id: string) => { x: number; y: number; width: number; height: number } | undefined;
  /** The desktop's manager, which Mission Control covers. */
  container: HTMLElement | null;
  onOpenChange: (open: boolean) => void;
  /** Brings a window forward. */
  onChoose: (id: string) => void;
  /** The Spaces, for the bar; App Exposé has no bar. */
  spaces: SpacesApi;
  /** The picture each Space shows in the bar: the one it was given, or this. */
  picture: string;
  pictureOf: (space: string) => string | undefined;
}

/** The windows' place in the document: where a thumbnail let go makes a Space. */
const onAddButton = (x: number, y: number) =>
  Boolean(document.elementFromPoint(x, y)?.closest(".mac-mission-control-add"));

/** Space on a control of the bar is that control's. */
const inSpacesBar = (target: EventTarget) =>
  target instanceof Element && Boolean(target.closest(".mac-mission-control-bar"));

/** The thumbnails stay where the live windows are laid over them, and draw nothing of their own. */
const THUMBNAILS_STAND_STILL = {
  "--mac-mission-control-window-shadow": "none",
  "--mac-mission-control-opening-scale": "1",
} as CSSProperties;

/** How far a thumbnail's frame is set from the next while grouped: further than any window is wide. */
const GROUP_SPREAD = 100_000;

/** The shelf under App Exposé: what the application opened lately, from the person's drive. */
function RecentDocumentsShelf({
  app,
  name,
  onOpen,
}: {
  app: string;
  name: string;
  onOpen: () => void;
}) {
  const drive = useDrive(servedByDesktopApp());
  const clearedAt = useDesktopValue(RECENT_DOCUMENTS_CLEARED, readNumber, 0);
  const documents = shelfDocuments(drive, clearedAt, (entry) => appForFile(entry) === app);
  return (
    <div className="mac-desktop-shell-recent-shelf" data-appearance="dark">
      {documents.map((entry) => (
        <BorderlessButton
          key={entry.id}
          onClick={() => {
            openFile(entry, app);
            onOpen();
          }}
        >
          <span className="mac-desktop-shell-recent-icon">
            <AppTile id={app} name={name} />
          </span>
          <span>{entry.name}</span>
        </BorderlessButton>
      ))}
    </div>
  );
}

/** Mission Control over the windows, or App Exposé with one application's. */
export function DesktopMissionControl({
  open,
  app,
  windows,
  apps,
  frameOf,
  container,
  onOpenChange,
  onChoose,
  spaces,
  picture,
  pictureOf,
}: DesktopMissionControlProps) {
  const shown = windows.filter(
    (window) =>
      !window.minimized &&
      !window.away &&
      !window.fullScreen &&
      (app === null || window.app === app),
  );
  const grouped = useDesktopValue(GROUP_BY_APPLICATION, readBoolean, false) && app === null;
  // The library lays thumbnails out by their frames: in one line, one application's side by side.
  const appsInOrder = [...new Set(shown.map((window) => window.app))];
  const inOrder = grouped
    ? appsInOrder.flatMap((each) => shown.filter((window) => window.app === each))
    : shown;
  // Space: the window under the pointer or the focus at full size, until Space again.
  const [peek, setPeek] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setPeek(null);
    if (!open || !peek || !container) return;
    const shell = container.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(peek)}"]`);
    if (!shell) return;
    const { x, y, width, height } = placeOf(shell);
    const room = container.getBoundingClientRect();
    const area =
      container.querySelector(".mac-mission-control-area")?.getBoundingClientRect() ?? room;
    const scale = Math.min(1, area.width / width, area.height / height);
    shell.dataset.missionControl = "peek";
    const stacked = shell.style.zIndex;
    shell.style.zIndex = "calc(var(--mac-window-manager-layer-chrome) - 50)";
    shell.style.scale = String(scale);
    shell.style.translate = `${area.left - room.left + (area.width - width * scale) / 2 - x * scale}px ${
      area.top - room.top + (area.height - height * scale) / 2 - y * scale
    }px`;
    return () => {
      shell.style.zIndex = stacked;
      placeWindows(container);
    };
  }, [open, peek, container]);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [dropOnAdd, setDropOnAdd] = useState(false);
  const dragged = useRef(false);
  // A thumbnail dragged onto a Space goes there; its live window follows the pointer on the way.
  const dragWindow = (
    id: string,
    down: { clientX: number; clientY: number; button: number; pointerId: number },
  ) => {
    dragged.current = false;
    if (down.button !== 0) return;
    const shell = container?.querySelector<HTMLElement>(`[data-window-id="${CSS.escape(id)}"]`);
    if (!shell) return;
    const [fromX = "0px", fromY = "0px"] = shell.style.translate.split(" ");
    const offset = (by: number, from: string) => `${Number.parseFloat(from) + by}px`;
    followDrag(
      down,
      (move) => {
        dragged.current = true;
        shell.style.translate = `${offset(move.clientX - down.clientX, fromX)} ${offset(
          move.clientY - down.clientY,
          fromY,
        )}`;
        setDropOn(spaceAt(move.clientX, move.clientY));
        setDropOnAdd(onAddButton(move.clientX, move.clientY));
      },
      (up, started) => {
        setDropOn(null);
        setDropOnAdd(false);
        if (!started) return;
        shell.style.translate = `${fromX} ${fromY}`;
        if (!up) return;
        const space = spaceAt(up.clientX, up.clientY);
        const full = space === null ? undefined : fullScreenWindowOf(space);
        if (space && full !== undefined) {
          // On the left half of its thumbnail the window goes on the left of the Split View.
          const box = document
            .elementFromPoint(up.clientX, up.clientY)
            ?.closest("[data-desktop-space]")
            ?.getBoundingClientRect();
          const onLeft = box !== undefined && up.clientX < box.left + box.width / 2;
          spaces.tileOnFullScreen(id, space, onLeft ? "left" : "right");
        } else if (space) spaces.assign(id, space);
        else if (onAddButton(up.clientX, up.clientY)) spaces.assignToNew(id);
      },
    );
  };
  const ids = shown.map((window) => window.id).join(" ");
  useEffect(() => {
    if (!open || !container) return;
    keepMarks(container);
    container.dataset.missionControlOpen = "";
    let frame = 0;
    let waited = 0;
    let unwatch: (() => void) | undefined;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // The window at full size under Space goes back to its button when Space lets it go.
        if (!container.querySelector('[data-mission-control="peek"]')) placeWindows(container);
      });
    };
    // Whatever moves a button moves its window: App Exposé's shelf taking the bar's place or filling in,
    // grouping, a frame that changed, a desktop embedded in a page that was resized.
    const watch = () => {
      const popup = container.querySelector(".mac-desktop-shell-mission-control");
      const area = popup?.querySelector(".mac-mission-control-area");
      const changes = new MutationObserver(refit);
      if (popup) {
        changes.observe(popup, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["style", "data-app-expose", "data-group-name"],
        });
      }
      const sizes = [container, ...(area ? [area] : [])].map((each) => observeResize(each, refit));
      unwatch = () => {
        changes.disconnect();
        for (const stop of sizes) stop();
      };
    };
    // The popup renders after this effect, in its portal.
    const place = () => {
      const wanted = ids.split(" ").filter(Boolean);
      const ready = wanted.every((id) =>
        container.querySelector(`[data-mission-window="${CSS.escape(id)}"]`),
      );
      if (ready || waited > 30) {
        placeWindows(container);
        watch();
      } else {
        waited += 1;
        frame = requestAnimationFrame(place);
      }
    };
    frame = requestAnimationFrame(place);
    return () => {
      cancelAnimationFrame(frame);
      unwatch?.();
      release(container);
    };
  }, [open, container, ids]);
  const named = (id: string) => apps.find((each) => each.id === id);
  return (
    <MissionControl
      className="mac-desktop-shell-mission-control"
      data-drop-on-add={dropOnAdd ? "" : undefined}
      data-peeking={peek ? "" : undefined}
      data-app-expose={app === null ? undefined : ""}
      style={THUMBNAILS_STAND_STILL}
      open={open}
      onOpenChange={onOpenChange}
      container={container}
      windowsLabel={app === null ? "Windows" : `Windows of ${named(app)?.name ?? app}`}
      spacesLabel={app === null ? undefined : "Recent Documents"}
      spaces={
        app === null ? (
          <DesktopSpacesBar
            spaces={spaces}
            picture={picture}
            pictureOf={pictureOf}
            titleOf={(id) => windows.find((each) => each.id === id)?.title}
            dropOn={dropOn}
          />
        ) : open ? (
          <RecentDocumentsShelf
            app={app}
            name={named(app)?.name ?? app}
            onOpen={() => onOpenChange(false)}
          />
        ) : undefined
      }
      onAddSpace={app === null ? spaces.add : undefined}
      onKeyDown={(event) => {
        if (event.key !== " " || inSpacesBar(event.target)) return;
        event.preventDefault();
        if (event.repeat) return;
        const over = event.currentTarget.querySelector<HTMLElement>(
          "[data-mission-window]:hover, [data-mission-window]:focus-visible",
        );
        setPeek((now) => (now ? null : (over?.dataset.missionWindow ?? null)));
      }}
      onKeyUp={(event) => {
        if (event.key === " " && !inSpacesBar(event.target)) event.preventDefault();
      }}
    >
      {inOrder.map((window, at) => {
        const frame = frameOf(window.id);
        return frame ? (
          <MissionControlWindow
            key={window.id}
            data-mission-window={window.id}
            data-group-name={
              grouped && inOrder[at - 1]?.app !== window.app
                ? (named(window.app)?.name ?? window.app)
                : undefined
            }
            title={window.title}
            frame={grouped ? { ...frame, x: at * GROUP_SPREAD, y: -frame.height / 2 } : frame}
            icon={<AppTile id={window.app} name={named(window.app)?.name ?? window.app} />}
            onPointerDown={(event) => dragWindow(window.id, event)}
            onClick={(event) => {
              // A click from the keyboard has no click count, and is no end of a drag.
              if (dragged.current && event.detail > 0) event.preventDefault();
              else onChoose(window.id);
              dragged.current = false;
            }}
          />
        ) : null;
      })}
    </MissionControl>
  );
}

/** Show Desktop: every window slides off to its nearest edge, until `on` goes. */
export function useShowDesktop(on: boolean, container: HTMLElement | null) {
  useEffect(() => {
    if (!on || !container) return;
    keepMarks(container);
    delete container.dataset.missionControlOpen;
    const { clientWidth, clientHeight } = container;
    const shells = shellsIn(container);
    for (const shell of shells) {
      const { x, y, width, height } = placeOf(shell);
      const toLeft = x + width / 2 < clientWidth / 2;
      const toTop = y + height / 2 < clientHeight / 2;
      shell.dataset.missionControl = "away";
      shell.style.translate = `${toLeft ? -(x + width) : clientWidth - x}px ${
        toTop ? -(y + height) : clientHeight - y
      }px`;
    }
    return () => {
      release(container);
    };
  }, [on, container]);
}

/** The applications running, the one used last first and Finder always among them. */
export function appsByRecentUse(
  windows: readonly ManagedWindowInfo[],
  apps: readonly DesktopApp[],
): readonly DesktopApp[] {
  const order: string[] = [];
  for (const { app } of [...windows].reverse()) if (!order.includes(app)) order.push(app);
  if (!order.includes("finder")) order.push("finder");
  return order.flatMap((id) => apps.find((app) => app.id === id) ?? []);
}

export interface DesktopAppSwitcherProps {
  /** The applications, newest first, while the switcher shows; `null` while it does not. */
  apps: readonly DesktopApp[] | null;
  /** It was opened with Shift held: it starts at the last application, not the next. */
  backwards?: boolean;
  onClose: () => void;
  /** Brings an application forward. */
  onChoose: (id: string) => void;
  /** Hides or quits an application from the switcher. */
  onHide: (id: string) => void;
  onQuit: (id: string) => void;
  /** Shows an application's windows. */
  onExpose: (id: string) => void;
}

/**
 * The application switcher: Option-Tab steps through the applications while Option is held, and
 * letting go chooses. A page cannot have Command-Tab, which the operating system takes; where a browser
 * passes it on it does the same. Q quits, H hides and the Down Arrow shows that application's windows.
 */
export function DesktopAppSwitcher({
  apps,
  backwards = false,
  onClose,
  onChoose,
  onHide,
  onQuit,
  onExpose,
}: DesktopAppSwitcherProps) {
  const [value, setValue] = useState<string>();
  // The application just hidden: letting go does not bring it straight back.
  const justHidden = useRef<string | null>(null);
  const choose = (next: string | undefined) => {
    justHidden.current = null;
    setValue(next);
  };
  // Those quit from the switcher while it shows: they go from its list.
  const [quit, setQuit] = useState<readonly string[]>([]);
  const open = apps !== null;
  const others = (apps ?? []).filter((each) => !quit.includes(each.id));
  const opening = (backwards ? others.at(-1) : others[1]) ?? others[0];
  const selected = others.some((each) => each.id === value) ? value : opening?.id;
  const latest = useRef({ selected, onChoose, onClose });
  latest.current = { selected, onChoose, onClose };
  useEffect(() => {
    if (!open) {
      setValue(undefined);
      setQuit([]);
      justHidden.current = null;
      return;
    }
    const up = (event: KeyboardEvent) => {
      if (event.key !== "Alt" && event.key !== "Meta") return;
      const { selected: chosen, onChoose: pick, onClose: close } = latest.current;
      close();
      if (chosen && chosen !== justHidden.current) pick(chosen);
    };
    window.addEventListener("keyup", up, true);
    return () => window.removeEventListener("keyup", up, true);
  }, [open]);
  return (
    <AppSwitcher
      className="mac-desktop-shell-app-switcher"
      open={open}
      value={selected}
      onValueChange={choose}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      onChoose={onChoose}
      onKeyDown={(event) => {
        const key = event.key.toLowerCase();
        if (event.code === "Backquote") {
          event.preventDefault();
          const at = others.findIndex((each) => each.id === selected);
          const step = event.shiftKey ? -1 : 1;
          const next = others[(at + step + others.length) % others.length];
          if (next) choose(next.id);
          return;
        }
        if (!selected) return;
        if (key === "q" || event.code === "KeyQ") {
          event.preventDefault();
          if (selected === "finder") return;
          onQuit(selected);
          setQuit((gone) => [...gone, selected]);
        } else if (key === "h" || event.code === "KeyH") {
          event.preventDefault();
          justHidden.current = selected;
          onHide(selected);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          onClose();
          onExpose(selected);
        }
      }}
    >
      {others.map((app) => (
        <AppSwitcherItem key={app.id} value={app.id} icon={<AppTile id={app.id} name={app.name} />}>
          {app.name}
        </AppSwitcherItem>
      ))}
    </AppSwitcher>
  );
}
