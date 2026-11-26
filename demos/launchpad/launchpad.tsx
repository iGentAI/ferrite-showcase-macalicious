"use client";

import { Desktop } from "macalicious/desktop";
import { Dock, DockItem, DockSeparator } from "macalicious/dock";
import { Launchpad, LaunchpadItem, type LaunchpadProps } from "macalicious/launchpad";
import { LaunchpadFolder } from "macalicious/launchpad-folder";
import {
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  applicationsOf,
  COLUMNS,
  defaultEntries,
  dockApps,
  finder,
  initialOf,
  isGroup,
  type LaunchpadApp,
  type LaunchpadEntry,
  pageCountOf,
  ROWS,
} from "./launchpad-data";
import "./launchpad.tokens.css";
import "./launchpad.css";

/** The two tiles after the Dock's separator: not applications, so nothing is launched. */
const DOWNLOADS = { name: "Downloads", category: "files" } as const;
const TRASH = { name: "Trash", category: "files" } as const;
/** Launchpad's own tile in the Dock. */
const LAUNCHPAD = { name: "Launchpad", category: "system" } as const;

/** The Dock's tiles follow the stage's width (launchpad.css). */
const DOCK_STYLE = { "--mac-dock-tile-size": "var(--mac-launchpad-demo-tile)" } as CSSProperties;

export interface LaunchpadIconProps {
  /** The application the placeholder stands for: its initial and its category's tint. */
  app: Pick<LaunchpadApp, "name" | "category">;
}

/**
 * The placeholder for an application's icon, which is Apple's artwork: a plain rounded square
 * in the tint of the application's category with its initial. It is not a drawing of the icon.
 * It fills the box it is put in and is hidden from assistive technology.
 */
export function LaunchpadIcon({ app }: LaunchpadIconProps) {
  return (
    <svg
      className="mac-launchpad-demo-icon"
      data-category={app.category}
      viewBox="0 0 112 112"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="mac-launchpad-demo-icon-plate" x="8" y="8" width="96" height="96" rx="21" />
      <text
        className="mac-launchpad-demo-icon-initial"
        x="56"
        y="56"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {initialOf(app.name)}
      </text>
    </svg>
  );
}

export interface CatalinaLaunchpadProps extends Omit<ComponentProps<"div">, "children"> {
  /**
   * What Launchpad holds, in order: applications and folders. A page is 35 of them.
   * @default defaultEntries
   */
  entries?: readonly LaunchpadEntry[];
  /** Whether Launchpad is shown (controlled). Use with `onOpenChange`. */
  open?: boolean;
  /**
   * Whether Launchpad is shown at first, when uncontrolled.
   * @default false
   */
  defaultOpen?: boolean;
  /** Called when Launchpad opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Index of the page shown at first, from 0.
   * @default 0
   */
  defaultPage?: number;
  /**
   * The text in the search field at first.
   * @default ""
   */
  defaultSearch?: string;
  /** The id of the folder that is open at first, while Launchpad is. */
  defaultFolder?: string;
  /**
   * Called with the application that was chosen: in the grid, in a folder or in the Dock. A
   * host launches the application here; the demo only says its name on the desktop.
   */
  onLaunch?: (app: LaunchpadApp) => void;
  /**
   * The desktop picture: any element, stretched over the stage behind everything.
   * @default an abstract gradient of the demo's own
   */
  picture?: ReactNode;
  /**
   * `className` and `style` for the library's Launchpad overlay. The visual comparisons use
   * it to take the overlay's scrim and blur off a backdrop that is painted as measured.
   */
  overlayProps?: Pick<LaunchpadProps, "className" | "style">;
}

/**
 * Launchpad of macOS 10.15 on a stage that stands for the screen: the library's `Desktop` with
 * an abstract picture, its `Dock` with placeholder tiles, and over them its `Launchpad` with
 * the 35 entries of the capture's first page, a second page, and the folder "Other" as a
 * `LaunchpadFolder`. The Dock's Launchpad tile shows and hides it.
 *
 * The root is the stage, a `div` that takes every prop not listed; it is as wide as it is
 * allowed and keeps the screen's 1680 by 1050 proportion down to 672 pt wide. Narrower, it
 * stays 420 pt tall, so that the grid and the Dock keep room to be used. Nothing is launched:
 * the chosen application is reported through `onLaunch` and named on the desktop.
 */
export function CatalinaLaunchpad({
  entries = defaultEntries,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  defaultPage = 0,
  defaultSearch = "",
  defaultFolder,
  onLaunch,
  picture,
  overlayProps,
  className,
  ref,
  ...props
}: CatalinaLaunchpadProps) {
  // Launchpad is rendered into the stage, so the stage is state: it exists after mounting.
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  useImperativeHandle(ref, () => stage as HTMLDivElement, [stage]);

  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const open = openProp ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (next === open) return;
    if (openProp === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };

  const [page, setPage] = useState(defaultPage);
  const [search, setSearch] = useState(defaultSearch);
  const [folder, setFolder] = useState<string | null>(defaultFolder ?? null);
  const [launched, setLaunched] = useState<LaunchpadApp>();

  // Each time Launchpad is shown it starts without a search and with its folders closed,
  // however it was closed; the page it was left on stays.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSearch("");
      setFolder(null);
    }
  }

  const pages = pageCountOf(entries, COLUMNS * ROWS);
  const current = Math.min(Math.max(page, 0), pages - 1);
  const searching = search.trim() !== "";
  // A search looks into the folders too: it is given every application, and the library's
  // Launchpad keeps the ones whose name matches, on one page.
  const shown = searching ? applicationsOf(entries) : entries;
  // A folder is open only while it is one of the entries, a folder, on the page shown: the
  // library renders that page alone. An id that names nothing there (one that is no folder's,
  // or a folder on another page) is let go, so that the stage does not take the Dock away for
  // a panel that is not there, and the folder does not spring open when its page comes.
  const perPage = COLUMNS * ROWS;
  const folderOnPage =
    folder !== null &&
    entries
      .slice(current * perPage, (current + 1) * perPage)
      .some((entry) => isGroup(entry) && entry.id === folder);
  if (open && !searching && folder !== null && !folderOnPage) setFolder(null);
  const folderOpen = open && !searching && folderOnPage;

  const launch = (app: LaunchpadApp) => {
    setLaunched(app);
    onLaunch?.(app);
  };

  // The Dock's Launchpad tile hides Launchpad when it shows, and a press on the tile is a
  // press outside the overlay, which closes it too: the click that follows must not show it
  // again. Which comes first differs. In a browser the overlay closes on the press before the
  // tile hears of it, so the press is recognised by the event the overlay reports when it
  // closes (closedByTilePress); where the tile hears of the press first, it notes that
  // Launchpad was showing (pressedWhileOpen). A press of the tile that did not close it, and
  // a key on the tile, forget both, so that a click from the keyboard, or one after a press
  // that ended away from the tile, is decided by what shows now.
  const pressedWhileOpen = useRef(false);
  const closedByTilePress = useRef<Event | null>(null);
  const launchpadTile = useRef<HTMLElement>(null);
  const onOverlayOpenChange: NonNullable<LaunchpadProps["onOpenChange"]> = (next, details) => {
    const target = details?.event?.target;
    if (!next && target instanceof Node && launchpadTile.current?.contains(target)) {
      closedByTilePress.current = details.event;
    }
    setOpen(next);
  };

  // Left and Right Arrow turn the page where no application takes them: on the overlay
  // itself, and at the last or first application of a page. The search field keeps them for
  // its insertion point, the page dots handle their own, and a folder's keys are its own. An
  // arrow with a modifier is not a page turn: the browser and assistive technology keep those.
  const turnPage = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const target = event.target as HTMLElement;
    if (
      step === 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.defaultPrevented ||
      searching ||
      !event.currentTarget.contains(target) ||
      target.closest("input")
    ) {
      return;
    }
    const next = Math.min(Math.max(current + step, 0), pages - 1);
    if (next === current) return;
    event.preventDefault();
    setPage(next);
    // The application that had the focus is on the page that goes: the overlay takes it.
    event.currentTarget.focus();
  };

  const item = (app: LaunchpadApp) => (
    <LaunchpadItem key={app.id} label={app.name} onClick={() => launch(app)}>
      <LaunchpadIcon app={app} />
    </LaunchpadItem>
  );

  return (
    <div
      ref={setStage}
      className={className ? `mac-launchpad-demo ${className}` : "mac-launchpad-demo"}
      data-folder-open={folderOpen ? "" : undefined}
      {...props}
    >
      <Desktop
        className="mac-launchpad-demo-desktop"
        picture={picture ?? <span className="mac-launchpad-demo-picture" />}
      >
        <p className="mac-launchpad-demo-status" role="status">
          {launched ? `Opened ${launched.name}` : "Click Launchpad in the Dock"}
        </p>
      </Desktop>
      <Dock className="mac-launchpad-demo-dock" style={DOCK_STYLE} inert={folderOpen}>
        <DockItem
          label={finder.name}
          icon={<LaunchpadIcon app={finder} />}
          running
          onClick={() => {
            launch(finder);
            setOpen(false);
          }}
        />
        <DockItem
          label={LAUNCHPAD.name}
          icon={<LaunchpadIcon app={LAUNCHPAD} />}
          ref={launchpadTile}
          onPointerDown={(event) => {
            pressedWhileOpen.current = open;
            if (closedByTilePress.current !== event.nativeEvent) closedByTilePress.current = null;
          }}
          onKeyDown={() => {
            pressedWhileOpen.current = false;
            closedByTilePress.current = null;
          }}
          onClick={() => {
            const hide = pressedWhileOpen.current || closedByTilePress.current !== null;
            pressedWhileOpen.current = false;
            closedByTilePress.current = null;
            setOpen(hide ? false : !open);
          }}
        />
        {dockApps.map((app) => (
          <DockItem
            key={app.id}
            label={app.name}
            icon={<LaunchpadIcon app={app} />}
            onClick={() => {
              launch(app);
              setOpen(false);
            }}
          />
        ))}
        <DockSeparator />
        <DockItem
          label={DOWNLOADS.name}
          icon={<LaunchpadIcon app={DOWNLOADS} />}
          onClick={() => setOpen(false)}
        />
        <DockItem
          label={TRASH.name}
          icon={<LaunchpadIcon app={TRASH} />}
          onClick={() => setOpen(false)}
        />
      </Dock>
      <Launchpad
        {...overlayProps}
        open={open}
        onOpenChange={onOverlayOpenChange}
        container={stage}
        columns={COLUMNS}
        rows={ROWS}
        page={current}
        onPageChange={setPage}
        search={search}
        onSearchChange={setSearch}
        onKeyDown={turnPage}
      >
        {shown.map((entry) =>
          isGroup(entry) ? (
            <LaunchpadFolder
              key={entry.id}
              label={entry.name}
              open={folderOpen && folder === entry.id}
              onOpenChange={(next) => setFolder(next ? entry.id : null)}
            >
              {entry.apps.map(item)}
            </LaunchpadFolder>
          ) : (
            item(entry)
          ),
        )}
      </Launchpad>
    </div>
  );
}
