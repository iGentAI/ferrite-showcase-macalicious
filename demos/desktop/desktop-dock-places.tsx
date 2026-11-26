"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DockItem, DockSeparator } from "macalicious/dock";
import { DockMenu, DockMenuPopup, DockMenuTrigger } from "macalicious/dock-menu";
import { DockStack, DockStackItem, DockStackMore } from "macalicious/dock-stack";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useEffect, useMemo, useRef, useState } from "react";
import { ItemIcon } from "../finder/finder-artwork";
import {
  type FinderEntry,
  HOME,
  isContainer,
  listing,
  resolve,
  sortDirection,
  TRASH,
} from "../finder/finder-data";
import { FinderDriveAlert, FinderEmptyTrash } from "../finder/finder-dialogs";
import { driveTree, isInTrash, pathOfEntry } from "../finder/finder-drive";
import { openFile, showInFinder } from "../finder/finder-open";
import {
  FINDER_RECENT_FOLDERS,
  FINDER_WARN_EMPTY,
  NO_NAMES,
  readNames,
} from "../finder/finder-saved";
import { requestPane } from "../system-preferences/pane-request";
import { FinderTile, FolderTile, TrashTile } from "./desktop-artwork";
import { DockHideRows, type DockTileRunning, DockWindowRows, useOptionKey } from "./desktop-dock";
import { requestDesktopEffects } from "./desktop-effects";
import { loadDrive, runOps, trashOf, useDrive } from "./desktop-files";
import { quickLookAlone } from "./desktop-hidden";
import {
  changeDesktopValue,
  DOCK_KEPT,
  DOCK_MAGNIFY,
  DOCK_POSITION,
  DOCK_SIZE,
  DOCK_SIZE_DEFAULT,
  DOCK_TILE_MAX,
  DOCK_TILE_MIN,
  desktopValues,
  readBoolean,
  readDockKept,
  readNumber,
  toggleDockHiding,
  useDesktopSetting,
  useDesktopValue,
  useDockPreferences,
} from "./desktop-personal";
import { followDrag } from "./desktop-spaces-bar";

/**
 * The Dock's end on a served desktop: the Trash and the Downloads stack, which are the person's. The
 * docs desktop has no drive and draws stand-ins.
 */

const DOWNLOADS = `${HOME}/Downloads`;
/** The most items a stack shows before it says how many more there are in Finder. */
const MOST_IN_STACK = 9;

const VIEW = "dock.downloadsView";
const SORT = "dock.downloadsSort";

const VIEWS = ["fan", "grid", "list", "automatic"] as const;
type StackView = (typeof VIEWS)[number];
const VIEW_LABELS: Readonly<Record<StackView, string>> = {
  fan: "Fan",
  grid: "Grid",
  list: "List",
  automatic: "Automatic",
};

/** Automatic: a fan while the items fit one along the bottom of the screen, otherwise a grid. */
export const stackViewOf = (view: StackView, items: number, onBottom: boolean) =>
  view !== "automatic" ? view : onBottom && items <= MOST_IN_STACK ? "fan" : "grid";

const readView = (stored: unknown): StackView | undefined =>
  VIEWS.includes(stored as StackView) ? (stored as StackView) : undefined;

const SORTS = [
  { column: "name", label: "Name" },
  { column: "kind", label: "Kind" },
  { column: "modified", label: "Date Modified" },
  { column: "created", label: "Date Created" },
] as const;
const readSort = (stored: unknown): string | undefined =>
  SORTS.some(({ column }) => column === stored) ? (stored as string) : undefined;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The Dock pane's Minimize windows using, which System Preferences writes. */
const MINIMIZE_EFFECT = "dock.minimizeEffect";

/** How far the Size slider's place moves for a point dragged on the divider: its 100 places are 112 pt. */
const DOCK_SIZE_PER_POINT = 100 / (DOCK_TILE_MAX - DOCK_TILE_MIN);

/** The last part of a folder's path, as a menu names it. */
const folderName = (path: string) => path.slice(path.lastIndexOf("/") + 1) || path;

/**
 * Finder's tile: a click brings Finder forward, and its menu lists its windows and what opens one.
 */
export function DockFinder({
  menuSide,
  running,
  onOpen,
  onNewWindow,
  onMenuOpenChange,
}: {
  menuSide: "top" | "left" | "right";
  running: DockTileRunning;
  onOpen: () => void;
  onNewWindow: () => void;
  onMenuOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const option = useOptionKey();
  const recent = useDesktopValue(FINDER_RECENT_FOLDERS, readNames, NO_NAMES);
  const release = useRef(onMenuOpenChange);
  release.current = onMenuOpenChange;
  useEffect(() => () => release.current?.(false), []);
  return (
    <DockMenu
      open={open}
      modal={false}
      onOpenChange={(next) => {
        setOpen(next);
        onMenuOpenChange?.(next);
      }}
    >
      <DockMenuTrigger
        render={<DockItem label="Finder" icon={<FinderTile />} running onClick={onOpen} />}
      />
      <DockMenuPopup side={menuSide} aria-label="Finder">
        <DockWindowRows running={running} />
        <MenuItem onClick={onNewWindow}>New Finder Window</MenuItem>
        <MenuItem onClick={() => showInFinder({ show: "smart-folder" })}>New Smart Folder</MenuItem>
        <MenuItem onClick={() => showInFinder({ show: "find" })}>Find</MenuItem>
        <MenuItem onClick={() => showInFinder({ show: "go-to-folder" })}>Go to Folder…</MenuItem>
        <Submenu>
          <SubmenuTrigger disabled={recent.length === 0}>Recent Folders</SubmenuTrigger>
          <SubmenuPopup>
            {recent.map((path) => (
              <MenuItem key={path} onClick={() => showInFinder({ place: path })}>
                {folderName(path)}
              </MenuItem>
            ))}
          </SubmenuPopup>
        </Submenu>
        {running.windows.length > 0 ? <MenuSeparator /> : null}
        <DockHideRows running={running} option={option} />
      </DockMenuPopup>
    </DockMenu>
  );
}

/** The Trash's tile: a click opens it, and its menu opens or empties it. */
export function DockTrash({ menuSide }: { menuSide: "top" | "left" | "right" }) {
  const drive = useDrive(true);
  const full = drive ? trashOf(drive).length > 0 : false;
  const warn = useDesktopValue(FINDER_WARN_EMPTY, readBoolean, true);
  const [asking, setAsking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const empty = () => {
    void runOps([{ op: "empty-trash" }]).catch((error) => setFailure(messageOf(error)));
  };
  return (
    <>
      <DockMenu modal={false}>
        <DockMenuTrigger
          render={
            <DockItem
              label="Trash"
              icon={<TrashTile full={full} />}
              data-dock-target="trash"
              data-full={full ? "" : undefined}
              onClick={() => showInFinder({ place: TRASH })}
            />
          }
        />
        <DockMenuPopup side={menuSide} aria-label="Trash">
          <MenuItem onClick={() => showInFinder({ place: TRASH })}>Open</MenuItem>
          <MenuSeparator />
          <MenuItem
            disabled={!full}
            onClick={() => {
              if (warn) setAsking(true);
              else empty();
            }}
          >
            Empty Trash
          </MenuItem>
        </DockMenuPopup>
      </DockMenu>
      <FinderEmptyTrash open={asking} onOpenChange={setAsking} onEmpty={empty} />
      <FinderDriveAlert message={failure} onClose={() => setFailure(null)} />
    </>
  );
}

/** Opens an item of a stack or the Dock: a file in its application, a folder in Finder. */
function openEntry({ path, node }: FinderEntry) {
  if (isContainer(node)) showInFinder({ place: path });
  else if (node.id && !openFile({ id: node.id, name: node.name, type: node.type })) {
    quickLookAlone(node.id);
  }
}

/** The Downloads stack: the folder's items, newest first, with a menu of how to show them. */
export function DockDownloads() {
  return (
    <DockFolderStack
      label="Downloads"
      path={DOWNLOADS}
      target="folder:downloads"
      viewSetting={VIEW}
      sortSetting={SORT}
    />
  );
}

/** A folder as a stack: its items, with a menu of how to show them. */
function DockFolderStack({
  label,
  path,
  target,
  viewSetting,
  sortSetting,
  onRemove,
}: {
  label: string;
  path: string;
  target: string;
  viewSetting: string;
  sortSetting: string;
  onRemove?: () => void;
}) {
  const drive = useDrive(true);
  const [viewChosen, setView] = useDesktopSetting<StackView>(viewSetting, readView, "automatic");
  const { position } = useDockPreferences();
  const [sortColumn, setSortColumn] = useDesktopSetting(sortSetting, readSort, "modified");
  useEffect(() => {
    void loadDrive().catch(() => undefined);
  }, []);
  const entries = useMemo(
    () =>
      listing(driveTree(drive, {}), path, {
        column: sortColumn,
        direction: sortDirection(sortColumn),
      }),
    [drive, path, sortColumn],
  );
  const view = stackViewOf(viewChosen, entries.length, position === "bottom");
  const shown = entries.slice(0, MOST_IN_STACK);
  const more = entries.length - shown.length;
  const size = view === "list" ? 16 : 64;
  const toFolder = (
    <DockStackMore onClick={() => showInFinder({ place: path })}>
      {more > 0 ? `${more} More in Finder` : "Open in Finder"}
    </DockStackMore>
  );
  // In a fan the last child sits nearest the Dock, and the way to the folder is at the far end.
  const items = (view === "fan" ? [...shown].reverse() : shown).map((entry) => (
    <DockStackItem
      key={entry.path}
      icon={<ItemIcon node={entry.node} size={size} />}
      onClick={() => openEntry(entry)}
    >
      {entry.node.name}
    </DockStackItem>
  ));
  return (
    <ContextualMenu>
      <ContextualMenuTrigger
        render={
          <DockStack label={label} icon={<FolderTile />} view={view} data-dock-target={target}>
            {view === "fan" ? toFolder : null}
            {items}
            {view === "fan" ? null : toFolder}
          </DockStack>
        }
      />
      <ContextualMenuPopup>
        <Submenu>
          <SubmenuTrigger>Sort by</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup
              value={sortColumn}
              onValueChange={(column) => setSortColumn(String(column))}
            >
              {SORTS.map(({ column, label }) => (
                <MenuRadioItem key={column} value={column}>
                  {label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
        <Submenu>
          <SubmenuTrigger>View content as</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup value={viewChosen} onValueChange={(next) => setView(next as StackView)}>
              {VIEWS.map((each) => (
                <MenuRadioItem key={each} value={each}>
                  {VIEW_LABELS[each]}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem onClick={() => showInFinder({ place: path })}>Open in Finder</MenuItem>
        {onRemove ? (
          <>
            <MenuSeparator />
            <MenuItem onClick={onRemove}>Remove from Dock</MenuItem>
          </>
        ) : null}
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}

/** The folders and files kept in the Dock that are still on the drive and out of the Trash. */
export function useDockKept(enabled: boolean): readonly FinderEntry[] {
  const drive = useDrive(enabled);
  const ids = useDesktopValue(DOCK_KEPT, readDockKept, NO_NAMES);
  return useMemo(() => {
    if (!enabled || ids.length === 0) return [];
    const root = driveTree(drive, {});
    return ids.flatMap((id) => {
      const path = pathOfEntry(root, id);
      const node = path === undefined || isInTrash(path) ? undefined : resolve(root, path);
      return path !== undefined && node ? [{ path, node }] : [];
    });
  }, [enabled, drive, ids]);
}

/** The item's icon at the Dock's tile size, which only the stylesheet knows. */
function KeptIcon({ entry }: { entry: FinderEntry }) {
  return (
    <svg viewBox="0 0 64 64" style={{ width: "100%", height: "100%" }} aria-hidden="true">
      <foreignObject width="64" height="64">
        <ItemIcon node={entry.node} size={64} />
      </foreignObject>
    </svg>
  );
}

/** The tiles of what is kept in the Dock: a folder is a stack, a file opens. */
export function DockKept({ entries }: { entries: readonly FinderEntry[] }) {
  const remove = (id: string | undefined) => {
    const kept = readDockKept(desktopValues()[DOCK_KEPT]) ?? [];
    changeDesktopValue(
      DOCK_KEPT,
      kept.filter((each) => each !== id),
    );
  };
  return entries.map((entry) =>
    isContainer(entry.node) ? (
      <DockFolderStack
        key={entry.path}
        label={entry.node.name}
        path={entry.path}
        target={`folder:${entry.node.id}`}
        viewSetting={`dock.kept.${entry.node.id}.view`}
        sortSetting={`dock.kept.${entry.node.id}.sort`}
        onRemove={() => remove(entry.node.id)}
      />
    ) : (
      <ContextualMenu key={entry.path}>
        <ContextualMenuTrigger
          render={
            <DockItem
              label={entry.node.name}
              icon={<KeptIcon entry={entry} />}
              data-dock-target="keep"
              onClick={() => openEntry(entry)}
            />
          }
        />
        <ContextualMenuPopup>
          <MenuItem onClick={() => openEntry(entry)}>Open</MenuItem>
          <MenuItem onClick={() => showInFinder({ id: entry.node.id })}>Show in Finder</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => remove(entry.node.id)}>Remove from Dock</MenuItem>
        </ContextualMenuPopup>
      </ContextualMenu>
    ),
  );
}

/** The Dock's divider: what a drop keeps in the Dock lands on it, and its menu sets the Dock up. */
export function DockDivider({ onMenuOpenChange }: { onMenuOpenChange?: (open: boolean) => void }) {
  const { autohide, position, magnification } = useDockPreferences();
  const minimizeEffect = useDesktopValue(
    MINIMIZE_EFFECT,
    (stored) => (stored === "Scale effect" ? stored : undefined),
    "Genie effect",
  );
  return (
    <ContextualMenu onOpenChange={onMenuOpenChange}>
      <ContextualMenuTrigger
        render={
          <DockSeparator
            data-dock-target="keep"
            className="mac-desktop-shell-dock-divider"
            onPointerDown={(down) => {
              if (down.button !== 0) return;
              down.preventDefault();
              const from = readNumber(desktopValues()[DOCK_SIZE]) ?? DOCK_SIZE_DEFAULT;
              const toward = (x: number, y: number) =>
                position === "left"
                  ? x - down.clientX
                  : position === "right"
                    ? down.clientX - x
                    : down.clientY - y;
              followDrag(
                down,
                (move) => {
                  const place = from + toward(move.clientX, move.clientY) * DOCK_SIZE_PER_POINT;
                  changeDesktopValue(DOCK_SIZE, Math.min(100, Math.max(0, place)));
                },
                (up) => {
                  if (!up) changeDesktopValue(DOCK_SIZE, from);
                },
              );
            }}
          />
        }
      />
      <ContextualMenuPopup>
        <MenuItem onClick={toggleDockHiding}>Turn Hiding {autohide ? "Off" : "On"}</MenuItem>
        <MenuItem onClick={() => changeDesktopValue(DOCK_MAGNIFY, magnification === undefined)}>
          Turn Magnification {magnification === undefined ? "On" : "Off"}
        </MenuItem>
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Position on Screen</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup
              value={position}
              onValueChange={(next) => changeDesktopValue(DOCK_POSITION, next)}
            >
              <MenuRadioItem value="left">Left</MenuRadioItem>
              <MenuRadioItem value="bottom">Bottom</MenuRadioItem>
              <MenuRadioItem value="right">Right</MenuRadioItem>
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
        <Submenu>
          <SubmenuTrigger>Minimize Using</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup
              value={minimizeEffect}
              onValueChange={(next) => changeDesktopValue(MINIMIZE_EFFECT, next)}
            >
              <MenuRadioItem value="Genie effect">Genie Effect</MenuRadioItem>
              <MenuRadioItem value="Scale effect">Scale Effect</MenuRadioItem>
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem
          onClick={() => {
            requestPane("dock");
            requestDesktopEffects([{ open: "system-preferences" }]);
          }}
        >
          Dock Preferences…
        </MenuItem>
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}
