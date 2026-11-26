"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { IconView } from "macalicious/icon-view";
import { ListView, ListViewRowLeading, ListViewRowTitle } from "macalicious/list-view";
import {
  OpenPanel,
  type OpenPanelBrowserProps,
  type OpenPanelLocation,
  type OpenPanelView,
} from "macalicious/open-panel";
import { SavePanel } from "macalicious/save-panel";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import type { WindowState } from "macalicious/window";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import {
  childrenOf,
  type Drive,
  type DriveEntry,
  entryOf,
  homeFolders,
  inTrash,
  pathOf,
  recentFiles,
  runOps,
  uploadFile,
  useDrive,
} from "../desktop/desktop-files";
import { currentDesktopSession } from "../desktop/desktop-server";
import { ItemIcon } from "./finder-artwork";
import { kindOf } from "./finder-drive";

/**
 * The Open and Save dialogs every app of the desktop uses for the person's drive
 * (`demos/desktop/desktop-files.ts`), as on a Mac, where the open and save panels browse what
 * Finder browses: the library's `OpenPanel` and `SavePanel` with the drive's folders in their file
 * browser. The sidebar lists Recents and the six home folders; the browser shows a folder as a
 * list or as icons (the column and gallery buttons show the list and the icons), searches the
 * whole drive by name, goes Back and Forward, opens a folder with a double click or Return, and
 * makes a New Folder on the drive. Only the desktop that Ferrite serves has a drive; elsewhere
 * the dialogs show no folders.
 */

const FILL: CSSProperties = { height: "100%" };

/** The place shown: a folder of the drive by id, or Recents. */
export const RECENTS_PLACE = "recents";

const byName = (a: DriveEntry, b: DriveEntry) =>
  a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" });

/** What the browser lists for `place`, or for a search of the whole drive. */
export function listedIn(drive: Drive | null, place: string, search = ""): DriveEntry[] {
  if (!drive) return [];
  const needle = search.trim().toLowerCase();
  if (needle) {
    return drive.entries
      .filter(
        (entry) =>
          entry.parent !== undefined &&
          entry.name.toLowerCase().includes(needle) &&
          !inTrash(drive, entry.id),
      )
      .sort(byName);
  }
  if (place === RECENTS_PLACE) return recentFiles(drive);
  // A folder in the Trash, or gone, shows nothing: what is in it can be neither opened nor
  // saved beside.
  if (!folderOf(drive, place)) return [];
  return childrenOf(drive, place).sort(byName);
}

const iconOf = (entry: DriveEntry, size: number) => (
  <ItemIcon node={{ name: entry.name, kind: kindOf(entry) }} size={size} />
);

/** The folder of the drive the browser saves into or opens from: a live folder, not one in the
 * Trash or gone. */
const folderOf = (drive: Drive | null, place: string) =>
  place !== RECENTS_PLACE &&
  drive &&
  entryOf(drive, place)?.kind === "folder" &&
  !inTrash(drive, place)
    ? place
    : undefined;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * The file browser both dialogs share: the place shown, its history, the view, the search, the
 * selection, and the props of the library's `OpenPanelBrowser` that show them. `onAction` is
 * called with a file opened by a double click or Return.
 */
function useDriveBrowser(
  defaultFolder: string,
  onAction?: (entry: DriveEntry) => void,
  multiple = false,
) {
  const drive = useDrive();
  const [place, setPlace] = useState(defaultFolder);
  const [back, setBack] = useState<string[]>([]);
  const [forward, setForward] = useState<string[]>([]);
  const [view, setView] = useState<OpenPanelView>("list");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  const shown = listedIn(drive, place, search);
  const selectedEntries = shown.filter((entry) => selected.includes(entry.id));
  // The folder shown went to the Trash or away (another window): show the first folder of its
  // path that is still live, or the folder the dialog opened on.
  useEffect(() => {
    if (!drive || place === RECENTS_PLACE || folderOf(drive, place)) return;
    const live = pathOf(drive, place)
      .reverse()
      .find((entry) => folderOf(drive, entry.id));
    setPlace(live?.id ?? (folderOf(drive, defaultFolder) ? defaultFolder : "documents"));
    setSelected([]);
  }, [drive, place, defaultFolder]);

  const show = (next: string) => {
    setPlace(next);
    setSelected([]);
    setSearch("");
  };
  const go = (next: string) => {
    if (next === place && search === "") return;
    setBack((visits) => [...visits, place]);
    setForward([]);
    show(next);
  };
  const act = (entry: DriveEntry | undefined) => {
    if (!entry) return;
    if (entry.kind === "folder") go(entry.id);
    else onAction?.(entry);
  };
  const folder = folderOf(drive, place);
  const [session] = useState(currentDesktopSession);
  const newFolder = async () => {
    if (!folder) return;
    try {
      const next = await runOps(
        [{ op: "mkdir", parent: folder, name: "untitled folder", existing: "rename" }],
        undefined,
        session,
      );
      const made = next.created?.[0];
      if (made) go(made);
    } catch (error) {
      setFailure(messageOf(error));
    }
  };

  const idOf = (index: number) => shown[index]?.id ?? index;
  const labelOf = (index: number) => shown[index]?.name ?? "";
  const value = selectedEntries.map((entry) => entry.id);
  const select = (ids: (string | number)[]) =>
    setSelected((multiple ? ids : ids.slice(-1)).map(String));
  const selectionMode = multiple ? "multiple" : "single";
  const name =
    search.trim() !== ""
      ? "Search results"
      : place === RECENTS_PLACE
        ? "Recents"
        : (drive && entryOf(drive, place)?.name) || "Files";

  const children =
    view === "icon" || view === "gallery" ? (
      <IconView
        aria-label={name}
        count={shown.length}
        getItemId={idOf}
        getItemLabel={labelOf}
        renderIcon={(index) => {
          const entry = shown[index];
          return entry ? iconOf(entry, 64) : null;
        }}
        selectionMode={selectionMode}
        value={value}
        onValueChange={select}
        onItemAction={(index) => act(shown[index])}
        style={FILL}
      />
    ) : (
      <ListView
        aria-label={name}
        count={shown.length}
        rowHeight={20}
        getRowId={idOf}
        getRowLabel={labelOf}
        renderRow={(index) => {
          const entry = shown[index];
          return entry ? (
            <>
              <ListViewRowLeading>{iconOf(entry, 16)}</ListViewRowLeading>
              <ListViewRowTitle>{entry.name}</ListViewRowTitle>
            </>
          ) : null;
        }}
        selectionMode={selectionMode}
        value={value}
        onValueChange={select}
        onRowAction={(index) => act(shown[index])}
        style={FILL}
      />
    );

  const places = drive ? homeFolders(drive) : [];
  const sidebar = (
    <Sidebar
      aria-label="Places"
      material="opaque"
      value={place}
      onValueChange={(next) => go(next)}
      style={FILL}
    >
      <SidebarSection title="Favorites">
        <SidebarItem value={RECENTS_PLACE} label="Recents" />
        {places.map((entry) => (
          <SidebarItem
            key={entry.id}
            value={entry.id}
            label={entry.name}
            icon={iconOf(entry, 16)}
          />
        ))}
      </SidebarSection>
    </Sidebar>
  );

  /** The folder shown and the folders it is in, for the location button. */
  const locations: OpenPanelLocation[] = (
    drive && place !== RECENTS_PLACE ? pathOf(drive, place).reverse() : []
  ).map((entry) => ({ value: entry.id, label: entry.name, icon: iconOf(entry, 16) }));

  const browser = {
    view,
    onViewChange: setView,
    canGoBack: back.length > 0,
    canGoForward: forward.length > 0,
    onBack: () => {
      const last = back.at(-1);
      if (last === undefined) return;
      setBack(back.slice(0, -1));
      setForward([...forward, place]);
      show(last);
    },
    onForward: () => {
      const next = forward.at(-1);
      if (next === undefined) return;
      setForward(forward.slice(0, -1));
      setBack([...back, place]);
      show(next);
    },
    search,
    onSearchChange: setSearch,
    onNewFolder: folder ? () => void newFolder() : undefined,
    sidebar,
    children,
  } satisfies OpenPanelBrowserProps;

  return {
    drive,
    browser,
    place,
    folder,
    locations,
    go,
    selectedEntries,
    act,
    failure,
    clearFailure: () => setFailure(null),
  };
}

/** The alert a dialog shows when the drive refused a change or could not be reached. */
function DriveFailure({ message, onClose }: { message: string | null; onClose: () => void }) {
  return (
    <Alert
      open={message !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertPopup>
        <AlertMessage>The operation can’t be completed.</AlertMessage>
        <AlertInformativeText>{message}</AlertInformativeText>
        <AlertButtons>
          <AlertClose render={<DefaultButton />}>OK</AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

export type DriveOpenPanelProps = DriveOpenPanelCommon &
  (
    | {
        /** One item is chosen. */
        multiple?: false;
        /** Called with the item chosen: Open, a double click or Return. */
        onOpen: (entry: DriveEntry) => void;
      }
    | {
        /** Command-click and Shift-click choose several. */
        multiple: true;
        /** Called with the items chosen, in the order they are listed. */
        onOpen: (entries: DriveEntry[]) => void;
      }
  );

interface DriveOpenPanelCommon {
  /** Which files the app can open; others are listed but cannot be opened. Every file by default. */
  accept?: (entry: DriveEntry) => boolean;
  /**
   * Whether Open chooses a folder, the one selected or else the one shown, rather than going into it;
   * a double click still goes in. Off by default.
   */
  chooseFolders?: boolean;
  /** The id of the folder shown at first, or `"recents"`. Documents by default. */
  defaultFolder?: string;
  /** Called by Cancel and Escape. */
  onCancel: () => void;
  /** Buttons before Cancel and Open, as TextEdit puts New Document there. */
  leading?: ReactNode;
  /** Whether the dialog is the key window; it is by default. */
  state?: WindowState;
  /** The dialog's width in points; 760 by default. */
  width?: number;
  /** The dialog's height in points; 448 by default. */
  height?: number;
}

/** The Open dialog on the person's drive. */
export function DriveOpenPanel(props: DriveOpenPanelProps) {
  const {
    accept = () => true,
    chooseFolders = false,
    defaultFolder = "documents",
    onCancel,
    leading,
    state = "key",
    width = 760,
    height = 448,
  } = props;
  const finish = (entries: DriveEntry[]) => {
    if (props.multiple) props.onOpen(entries);
    else if (entries[0]) props.onOpen(entries[0]);
  };
  const open = (entry: DriveEntry) => {
    if (accept(entry)) finish([entry]);
  };
  const {
    drive,
    browser,
    place,
    folder,
    locations,
    go,
    selectedEntries,
    act,
    failure,
    clearFailure,
  } = useDriveBrowser(defaultFolder, open, props.multiple);
  const folderShown = chooseFolders && drive && folder ? entryOf(drive, folder) : undefined;
  const takes = (entry: DriveEntry) => (entry.kind === "folder" ? chooseFolders : accept(entry));
  const only = selectedEntries.length === 1 ? selectedEntries[0] : undefined;
  const goesIn = only?.kind === "folder" && !chooseFolders;
  const canOpen =
    goesIn ||
    (selectedEntries.length > 0 ? selectedEntries.every(takes) : folderShown !== undefined);
  const openChosen = () => {
    if (goesIn) act(only);
    else if (selectedEntries.length > 0) finish(selectedEntries);
    else if (folderShown) finish([folderShown]);
  };
  return (
    <>
      <OpenPanel
        {...browser}
        state={state}
        width={width}
        height={height}
        locations={locations}
        location={locations.length > 0 ? place : null}
        onLocationChange={go}
        openDisabled={!canOpen}
        onOpen={openChosen}
        onCancel={onCancel}
        leading={leading}
      />
      <DriveFailure message={failure} onClose={clearFailure} />
    </>
  );
}

/** Where the Save dialog puts a file: the folder, the name, and the file it replaces. */
export interface DriveSaveTarget {
  folder: string;
  name: string;
  /** The file of the folder that has the name, which the person chose to replace. */
  replaces?: DriveEntry;
  /**
   * The desktop session the dialog opened in (`UploadOptions.session`), for whoever is signed in by
   * the time the file is written. Absent on a page that names none.
   */
  session?: string;
}

export interface DriveSavePanelProps {
  /** The name in the field at first. */
  defaultName: string;
  /** The id of the folder it saves into at first; Documents by default. */
  defaultFolder?: string;
  /** Whether the file browser is shown at first; it is not by default. */
  defaultExpanded?: boolean;
  /** A row under the name, as TextEdit's File Format. */
  accessory?: ReactNode;
  /**
   * The name a typed name is saved under, when it is not that name (TextEdit gives it the chosen
   * format's extension). The dialog asks about replacing a file of that name, not of the name
   * typed.
   */
  nameToSave?: (typed: string) => string;
  /**
   * Called by Save with where to save. A name the folder already has is asked about first:
   * Replace calls it with the file it replaces.
   */
  onSave: (target: DriveSaveTarget) => void;
  /** Called by Cancel and Escape. */
  onCancel: () => void;
}

/** The Save dialog on the person's drive: the content of a sheet, as the library's `SavePanel`. */
export function DriveSavePanel({
  defaultName,
  defaultFolder = "documents",
  defaultExpanded = false,
  accessory,
  nameToSave,
  onSave,
  onCancel,
}: DriveSavePanelProps) {
  const { drive, browser, folder, go, failure, clearFailure } = useDriveBrowser(defaultFolder);
  const [asking, setAsking] = useState<DriveSaveTarget | null>(null);
  const [session] = useState(currentDesktopSession);
  const opened = session ? { session } : {};
  // A folder of the name: a file never replaces a folder, so the person picks another name.
  const [folderNamed, setFolderNamed] = useState<string | null>(null);
  const where: OpenPanelLocation[] = (drive ? homeFolders(drive) : []).map((entry) => ({
    value: entry.id,
    label: entry.name,
    icon: iconOf(entry, 16),
  }));
  // Only a live folder is ever saved into: the one shown, else the one the dialog opened on,
  // else Documents. A folder in the Trash or gone is never handed to `onSave`, even before the
  // browser has moved off it.
  const target =
    folder ?? folderOf(drive, defaultFolder) ?? folderOf(drive, "documents") ?? defaultFolder;
  const live = (id: string) => folderOf(drive, id) !== undefined;
  const save = (name: string) => {
    const typed = name.trim();
    const trimmed = typed && nameToSave ? nameToSave(typed).trim() : typed;
    if (!trimmed || !live(target)) return;
    const taken = drive
      ? childrenOf(drive, target).find(
          (entry) => entry.name.toLowerCase() === trimmed.toLowerCase(),
        )
      : undefined;
    if (taken?.kind === "folder") setFolderNamed(taken.name);
    else if (taken) setAsking({ folder: target, name: trimmed, replaces: taken, ...opened });
    else onSave({ folder: target, name: trimmed, ...opened });
  };
  const folderName = (drive && asking && entryOf(drive, asking.folder)?.name) || "the folder";
  return (
    <>
      <SavePanel
        defaultName={defaultName}
        locations={where}
        location={target}
        onLocationChange={go}
        defaultExpanded={defaultExpanded}
        browser={{ ...browser, sidebarWidth: 140 }}
        accessory={accessory}
        saveDisabled={!drive || !live(target)}
        onSave={({ name }) => save(name)}
        onCancel={onCancel}
      />
      <Alert
        open={asking !== null}
        onOpenChange={(open) => {
          if (!open) setAsking(null);
        }}
      >
        <AlertPopup>
          <AlertMessage>“{asking?.name}” already exists. Do you want to replace it?</AlertMessage>
          <AlertInformativeText>
            A file with the same name already exists in “{folderName}”. Replacing it moves that file
            to the Trash.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                // The folder may have gone to the Trash while the question was open: then
                // nothing is saved, and the dialog shows a live folder to save into instead.
                if (asking && live(asking.folder)) onSave(asking);
              }}
            >
              Replace
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert
        open={folderNamed !== null}
        onOpenChange={(open) => {
          if (!open) setFolderNamed(null);
        }}
      >
        <AlertPopup>
          <AlertMessage>A folder named “{folderNamed}” already exists.</AlertMessage>
          <AlertInformativeText>
            A file cannot replace a folder. Choose another name.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <DriveFailure message={failure} onClose={clearFailure} />
    </>
  );
}

/**
 * Saves `data` where the Save dialog chose: a new file, or in place of the file it replaces,
 * which goes to the Trash so that it can still be put back. The server replaces only that very
 * file: if another window renamed, replaced or removed it meanwhile, the save is refused with a
 * 409 and nothing is replaced. Resolves with the new file.
 */
export function saveToDrive(
  target: DriveSaveTarget,
  data: Blob,
  onProgress?: (sent: number, total: number) => void,
): Promise<DriveEntry> {
  return uploadFile(data, target.folder, {
    name: target.name,
    existing: target.replaces ? "replace" : "fail",
    replaces: target.replaces?.id,
    session: target.session,
    onProgress,
  });
}
