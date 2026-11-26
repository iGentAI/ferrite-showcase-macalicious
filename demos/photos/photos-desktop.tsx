"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { BorderlessButton } from "macalicious/borderless-button";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { EmptyState } from "macalicious/empty-state";
import { IconView } from "macalicious/icon-view";
import { ImageView } from "macalicious/image-view";
import { Label } from "macalicious/label";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "macalicious/popover";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { ShareMenu } from "macalicious/share-menu";
import { Sheet, SheetPopup } from "macalicious/sheet";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { Slider } from "macalicious/slider";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { TextField } from "macalicious/text-field";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import {
  type CSSProperties,
  type DragEvent,
  Fragment,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { copiedDriveItems, copyDriveItems } from "../desktop/desktop-clipboard";
import {
  beginDesktopDrag,
  type DesktopDrag,
  type DesktopDragItem,
  fileItemsOfDrag,
  filesOfDrag,
  registerDropTarget,
} from "../desktop/desktop-drag";
import { currentDrive, ensureFolder, SPECIAL_FOLDER_IDS } from "../desktop/desktop-files";
import { SERVER_CHANGE_EVENT } from "../desktop/desktop-live";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import {
  changeDesktopValue,
  takePictureTicket,
  useDesktopValue,
} from "../desktop/desktop-personal";
import { currentDesktopSession, servedByDesktopApp, sessionFetch } from "../desktop/desktop-server";
import { FileShareItems, onSharedFiles, takeSharedFiles } from "../desktop/desktop-share-link";
import { DriveSavePanel, type DriveSaveTarget, saveToDrive } from "../finder/finder-file-dialogs";
import {
  type OpenFileRequest,
  onOpenFileRequest,
  openFile,
  showInFinder,
  takeOpenFileRequests,
} from "../finder/finder-open";
import { libraryFromServer, MUSIC_LIBRARY_URL } from "../music/music-server";
import { Photos, type PhotosProps } from "./photos";
import { FavoriteBadge, HeartGlyph, RotateGlyph, SourceGlyph, ZoomGlyph } from "./photos-artwork";
import { cellSize, ZOOM } from "./photos-data";
import { picturesFolder, uploadToDrive } from "./photos-drive";
import {
  autoAdjust,
  type Drawable,
  type Edit,
  encodeJpeg,
  isIdentity,
  MAX_EDIT_SPOTS,
  MAX_EDIT_STROKES,
  NO_ADJUST,
  NO_EDIT,
  renderEdit,
  turnedSize,
  turnLeft,
  withoutFile,
} from "./photos-edit";
import { copyForPreview } from "./photos-edit-return";
import {
  type AspectId,
  aspectRatio,
  EDIT_TABS,
  EditPanel,
  EditStage,
  type EditTab,
  MAX_EDIT_ZOOM,
  pinchedScale,
  type SpotTool,
} from "./photos-editor";
import { readExif } from "./photos-exif";
import { notLookedAt, unnamedFaces } from "./photos-faces";
import { useFaceScan } from "./photos-faces-scan";
import {
  type AlbumSort,
  announceChange,
  announcedBy,
  changeAlbum,
  changeFolder,
  changeMemory,
  changePhoto,
  checkPicture,
  createAlbum,
  createAlbumIn,
  createFolder,
  decodePicture,
  deleteAlbum,
  deleteFolder,
  deletePhoto,
  deleteProject,
  deleteSmartAlbum,
  importPicture,
  keepPictureHashes,
  keepPictureScenes,
  LIBRARY_CHANGED_EVENT,
  type LibraryAlbum,
  type LibraryFolder,
  type LibraryPhoto,
  loadLibrary,
  MAX_THUMB_BYTES,
  type ManagedKeyword,
  type MemoryMarks,
  NO_MEMORY_MARKS,
  nameOf,
  type Organised,
  type PhotoChange,
  type PhotoLocation,
  putKeywords,
  putProject,
  putSettings,
  putSmartAlbum,
  readOriginal,
  readThumbs,
  readUnedited,
  type SlideshowProject,
  type SmartAlbum,
  setDesktopPicture,
  settingsConflict,
  thumbnailOf,
} from "./photos-library";
import { albumMemoriesOf, MemoryTiles, PeopleTiles, peopleNote } from "./photos-memories";
import {
  DEFAULT_MEMORY_MOOD,
  MEMORY_MOODS,
  MEMORY_MOODS_KEY,
  type MemoryMood,
  memoryMovieOf,
  readMemoryMoods,
  songOfMood,
  withMemoryMood,
} from "./photos-mood";
import { hashOfThumb } from "./photos-near-duplicates";
import {
  AdjustDateSheet,
  type ExportChoice,
  ExportSheet,
  ImportReviewSheet,
  InfoWindow,
  KeywordManager,
  NameSheet,
  PreferencesPanel,
  SmartAlbumSheet,
} from "./photos-panels";
import { PlacesMap } from "./photos-places";
import { printPictures } from "./photos-print";
import { notLookedAtForScenes, scenesOfThumb } from "./photos-scenes";
import { clearPhotosSelection, publishPhotosSelection } from "./photos-selection";
import {
  ALBUM_SORTS,
  albumOf,
  allKeywords,
  curatedDay,
  daysLeft,
  filterPasses,
  fittedBox,
  groupPhotos,
  importBatches,
  importNotice,
  isMediaType,
  isVideo,
  LIBRARY_SOURCES,
  LIBRARY_VIEWS,
  type LibraryView,
  MEDIA_SOURCES,
  type Memory,
  memoriesOf,
  type PhotoGroup,
  peopleOf,
  photoCount,
  photosOfSource,
  rangeIds,
  SERVED_FILTERS,
  type SearchSuggestion,
  type ServedFilter,
  type ServedSource,
  SHARED_ROWS,
  searchMatches,
  searchSuggestions,
  shownSize,
  spanText,
  thumbKey,
  titleOf,
} from "./photos-served-data";
import { recordSlideshow, slideshowMovieExtension, slideshowMovieType } from "./photos-slideshow";
import { PhotoStage, SLIDESHOW_THEMES } from "./photos-stage";
import {
  CustomizeToolsSheet,
  DEFAULT_TOOLS,
  EnhanceGlyph,
  type PhotosTool,
  PlayGlyph,
  readTools,
} from "./photos-toolbar";
import "./photos.tokens.css";
import "./photos.css";

/** The longer side a photo is drawn at in the viewer, in pixels. */
const VIEWER_SIDE = 2560;
/** The longer side of the copy of the original the editor works on, in pixels. */
const EDIT_SIDE = 1600;
/** How many photos a Months or Years group shows. */
const MOSAIC = { month: 8, year: 12 } as const;
/** The furthest an open photo zooms in. */
const MAX_VIEWER_SCALE = 8;
/** The unit each grouped view of the Photos row groups by. */
const UNIT_OF = { years: "year", months: "month", days: "day" } as const;
/**
 * Elements whose keys are their own: a field, a slider, a menu, a popover, the sidebar's list. A
 * key pressed in one does not act on the selected photos.
 */
const OWN_KEYS = [
  "input",
  "video",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='slider']",
  "[role='menu']",
  "[role='menuitem']",
  "[role='menuitemradio']",
  "[role='menuitemcheckbox']",
  "[role='dialog']",
  "[role='tree']",
  "[role='combobox']",
].join(", ");

/** The photos on the clipboard of this page: Copy and Cut name them, Paste takes them. */
let copiedPhotos: {
  ids: string[];
  cut: { album: string } | null;
  /** The same photos on the desktop's clipboard, for other applications to paste. */
  files?: readonly unknown[];
} = { ids: [], cut: null };
/** The album a drag of photos began in, whichever Photos window it began in. */
let draggedFromAlbum: string | null = null;
/** Told to every Photos window of the page when the clipboard above changes: Paste may wake. */
const COPIED_EVENT = "macalicious:photos-copied";

/** Whether a dragged drive item is something Photos may import, by its type or name. */
const isMediaItem = (item: DesktopDragItem) =>
  item.kind !== "file" ||
  /^(image|video)\//.test(item.type ?? "") ||
  /\.(jpe?g|png|gif|webp|heic|heif|avif|mp4|m4v|mov|webm)$/i.test(item.name);

/** What Undo and Redo take back and bring back. */
interface UndoStep {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

/** The keys of a change Undo can restore, from a photo as it was. */
function restoring(before: LibraryPhoto, after: LibraryPhoto): PhotoChange {
  const change: PhotoChange = {};
  if (before.favorite !== after.favorite) change.favorite = before.favorite;
  if (before.hidden !== after.hidden) change.hidden = before.hidden;
  if ((before.deleted_ms === null) !== (after.deleted_ms === null)) {
    change.deleted = before.deleted_ms !== null;
  }
  if (before.title !== after.title) change.title = before.title ?? "";
  if (before.caption !== after.caption) change.caption = before.caption ?? "";
  if (before.keywords.join("\n") !== after.keywords.join("\n")) change.keywords = before.keywords;
  if (before.taken_ms !== after.taken_ms) change.taken_ms = before.taken_ms;
  if (JSON.stringify(before.location) !== JSON.stringify(after.location)) {
    change.location = before.location;
  }
  const added = after.people.filter((name) => !before.people.includes(name));
  const removed = before.people.filter((name) => !after.people.includes(name));
  if (added.length > 0 || removed.length > 0) {
    change.add_people = removed;
    change.remove_people = added;
  }
  // The one face a change moved. A name Info took off several faces comes back on the photo only.
  const moved = before.faces?.find((was) => {
    const now = after.faces?.find((face) => face.id === was.id);
    return (
      now && ((now.name ?? null) !== (was.name ?? null) || !now.not_a_face !== !was.not_a_face)
    );
  });
  if (moved) {
    change.face = { id: moved.id, name: moved.name ?? null, not_a_face: moved.not_a_face === true };
  }
  // An edit is undone only back to the original: an earlier edit's thumbnail is no longer kept.
  if (before.edit === null && after.edit !== null) change.edit = null;
  return change;
}

/* The toolbar's own gap and the divider's colour, as the demo sets them (photos.tsx). */
const TOOLBAR = { "--mac-toolbar-gap": "10px" } as CSSProperties;
const SPLIT = { "--mac-split-view-divider-color": "var(--mac-photos-divider)" } as CSSProperties;
const GRID = {
  "--mac-icon-view-background": "var(--mac-photos-background)",
  "--mac-icon-view-plate": "transparent",
  fontSize: 0,
  lineHeight: 0,
} as CSSProperties;
/** The grid with View > Metadata > Titles on: the icon view's label line, which `GRID` closes. */
const GRID_TITLED = {
  "--mac-icon-view-background": "var(--mac-photos-background)",
  "--mac-icon-view-plate": "transparent",
} as CSSProperties;

/** Why the printed projects of File > Create are dimmed. */
const PRINT_PROJECT_REASON =
  "Books, cards, calendars and prints are made by Apple’s print services, which this desktop can’t reach. File > Print prints from the browser.";

/**
 * Photos on the desktop served by the `macalicious-desktop` Ferrite application: a real library
 * of the person's photos, kept on Ferrite (`ferrite-apps/desktop/src/apps/photos`, originals on
 * the person's drive). Import pictures from this computer, browse them by year, month and day,
 * favourite them, put them in albums, open one full size with Previous and Next, edit it
 * without changing the original, export it, and delete and
 * recover it from Recently Deleted. Elsewhere it is the demo, with its placeholder library.
 */
export function DesktopPhotos({
  preferencesOpen,
  onPreferencesOpenChange,
  ...props
}: PhotosProps & {
  /** Given by a desktop: the application renders its own Preferences (`preferences: "own"`). */
  preferencesOpen?: boolean;
  onPreferencesOpenChange?: (open: boolean) => void;
}) {
  return servedByDesktopApp() ? (
    <ServedPhotos
      {...props}
      preferencesOpen={preferencesOpen}
      onPreferencesOpenChange={onPreferencesOpenChange}
    />
  ) : (
    <Photos
      {...props}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key === ",") {
          event.preventDefault();
          onPreferencesOpenChange?.(true);
        }
      }}
      panel={
        preferencesOpen ? (
          <PreferencesPanel
            location="This demo shows placeholder pictures and keeps nothing."
            onClose={() => onPreferencesOpenChange?.(false)}
          />
        ) : null
      }
    />
  );
}

/** The library's thumbnails as object URLs, by `thumbKey`, read once each. */
function useThumbs(photos: readonly LibraryPhoto[], enabled: boolean) {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map());
  const asked = useRef(new Set<string>());
  const made = useRef(new Map<string, string>());
  const blobs = useRef(new Map<string, Blob>());
  const live = useRef(true);
  // The keys the library has now, for reads that answer later.
  const current = useRef(new Set<string>());
  useEffect(() => {
    live.current = true;
    const owned = made.current;
    return () => {
      live.current = false;
      for (const url of owned.values()) URL.revokeObjectURL(url);
      owned.clear();
    };
  }, []);
  // A thumbnail no photo shows any more (an older edit revision, a photo deleted for good) gives
  // back its object URL and bytes.
  useEffect(() => {
    const keys = new Set(photos.map(thumbKey));
    current.current = keys;
    const gone = [...made.current.keys()].filter((key) => !keys.has(key));
    for (const key of gone) {
      URL.revokeObjectURL(made.current.get(key) as string);
      made.current.delete(key);
      blobs.current.delete(key);
    }
    for (const key of asked.current) if (!keys.has(key)) asked.current.delete(key);
    if (gone.length > 0) {
      setUrls((old) => new Map([...old].filter(([key]) => keys.has(key))));
    }
  }, [photos]);
  useEffect(() => {
    if (!enabled) return;
    const wanted = photos.filter((photo) => !asked.current.has(thumbKey(photo)));
    if (wanted.length === 0) return;
    const keys = new Map(wanted.map((photo) => [photo.id, thumbKey(photo)]));
    for (const key of keys.values()) asked.current.add(key);
    readThumbs([...keys.keys()]).then(
      (found) => {
        if (!live.current) return;
        const next = new Map<string, string>();
        for (const [id, blob] of found) {
          const key = keys.get(id);
          // A thumbnail this page made itself meanwhile is newer than the one read, and one of a
          // revision no photo shows any more is not kept.
          if (!key || made.current.has(key) || !current.current.has(key)) continue;
          const url = URL.createObjectURL(blob);
          made.current.set(key, url);
          blobs.current.set(key, blob);
          next.set(key, url);
        }
        setUrls((old) => new Map([...old, ...next]));
      },
      (error) => {
        // Asked again the next time the library changes.
        for (const key of keys.values()) asked.current.delete(key);
        console.warn(`Photos could not read thumbnails (${error})`);
      },
    );
  }, [photos, enabled]);
  /** Show a thumbnail this page made itself (an edit, a rotation) without reading it back. The
   * address it replaces, if any, is revoked. */
  const put = useCallback((key: string, blob: Blob) => {
    // An edit that finishes after the window closed makes no address nobody would revoke.
    if (!live.current) return;
    const url = URL.createObjectURL(blob);
    const old = made.current.get(key);
    if (old) URL.revokeObjectURL(old);
    made.current.set(key, url);
    blobs.current.set(key, blob);
    asked.current.add(key);
    setUrls((all) => new Map(all).set(key, url));
  }, []);
  /** The bytes of a thumbnail as of now, also before the next render. */
  const blobOf = useCallback((key: string) => blobs.current.get(key), []);
  return { urls, put, blobOf };
}

/** The open photo drawn full size, edited: an object URL, or why it could not be shown (its
 * original unreadable, or its edit not drawn). */
function useFullImage(photo: LibraryPhoto | undefined) {
  const key = photo ? `${thumbKey(photo)}:${photo.file}` : "";
  const latest = useRef(photo);
  latest.current = photo;
  const [shown, setShown] = useState<{
    key: string;
    url?: string;
    failed?: "read" | "render";
  }>({ key: "" });
  useEffect(() => {
    const target = latest.current;
    // Nothing of an earlier image (its address is revoked below) is shown for this one.
    setShown({ key: "" });
    if (!key || !target) return;
    let live = true;
    let made: string | undefined;
    let failed: "read" | "render" = "read";
    (async () => {
      const original = await readOriginal(target);
      let image: Blob = original;
      if (target.edit) {
        failed = "render";
        const decoded = await decodePicture(original);
        try {
          const rendered = await encodeJpeg(
            renderEdit(decoded, target.edit, VIEWER_SIDE),
            Number.MAX_SAFE_INTEGER,
            [0.92],
          );
          // Never the unedited original in its place: the edited thumbnail stays, with a note.
          if (!rendered) throw new Error("this browser could not draw the edited photo");
          image = rendered;
        } finally {
          decoded.close();
        }
      }
      if (!live) return;
      made = URL.createObjectURL(image);
      setShown({ key, url: made });
    })().catch((error) => {
      if (!live) return;
      console.warn(`Photos could not show a photo full size (${error})`);
      setShown({ key, failed });
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [key]);
  return shown.key === key ? shown : { key };
}

/** Save a blob as a download of this browser. */
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A thumbnail turned a quarter to the left: Rotate's new thumbnail, made from the shown one's
 * bytes, so nothing is requested again. */
async function turnedThumb(blob: Blob, turns = 1): Promise<Blob | null> {
  const decoded = await decodePicture(blob);
  try {
    let edit = NO_EDIT;
    for (let n = 0; n < turns; n += 1) edit = turnLeft(edit);
    return await encodeJpeg(renderEdit(decoded, edit, 1024), MAX_THUMB_BYTES);
  } finally {
    decoded.close();
  }
}

/** The glyph of a library row, drawn for this demo: a trash can for Recently Deleted. */
function TrashGlyph() {
  return (
    <svg viewBox="0 0 14 16" width="14" height="16" aria-hidden="true" focusable="false">
      <path
        d="M1 3.5h12M5 3.5V2h4v1.5M2.5 3.5l.8 11h7.4l.8-11M5.5 6v6M8.5 6v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

const SOURCE_ICON: Record<string, ReactNode> = {
  library: <SourceGlyph name="photos" />,
  memories: <SourceGlyph name="memories" />,
  people: <SourceGlyph name="people" />,
  favorites: <HeartGlyph />,
  recents: <SourceGlyph name="recents" />,
  imports: <SourceGlyph name="imports" />,
  "photo-booth": <SourceGlyph name="memories" />,
  deleted: <TrashGlyph />,
};

/** How many hashes one request keeps. */
const HASHES_PER_REQUEST = 48;
/** How long a memory's movie shows each picture. */
const NO_MEMORY_MOODS: Readonly<Record<string, MemoryMood>> = {};

/** One photo of the Days, Months or Years view: its thumbnail, as a button. */
function PhotoTile({
  photo,
  url,
  size,
  selected,
  showTitle,
  showKeywords,
  onSelect,
  onOpen,
}: {
  photo: LibraryPhoto;
  url: string | undefined;
  size: number;
  selected: boolean;
  showTitle: boolean;
  showKeywords: boolean;
  onSelect: (id: string, event: MouseEvent) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <span className="mac-photos-cell-wrap" style={{ width: size }}>
      <button
        type="button"
        className="mac-photos-cell"
        data-photo-id={photo.id}
        data-selected={selected ? "" : undefined}
        aria-label={photo.name}
        aria-pressed={selected}
        style={{ width: size, height: size }}
        onClick={(event) => onSelect(photo.id, event)}
        onDoubleClick={() => onOpen(photo.id)}
      >
        {url ? <img src={url} alt="" draggable={false} /> : null}
        {photo.favorite ? <FavoriteBadge /> : null}
        {photo.duration_ms !== null ? (
          <span className="mac-photos-duration">{durationText(photo.duration_ms)}</span>
        ) : null}
      </button>
      {showTitle ? <span className="mac-photos-cell-title">{titleOf(photo)}</span> : null}
      {showKeywords && photo.keywords.length > 0 ? (
        <span className="mac-photos-cell-keywords">{photo.keywords.join(", ")}</span>
      ) : null}
    </span>
  );
}

/** "1:05": a movie's length. */
const durationText = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

interface GroupsProps {
  groups: readonly PhotoGroup[];
  unit: "day" | "month" | "year";
  urls: ReadonlyMap<string, string>;
  size: number;
  selected: ReadonlySet<string>;
  showTitle: boolean;
  showKeywords: boolean;
  onSelect: (id: string, event: MouseEvent) => void;
  onOpen: (id: string) => void;
  /** A group's heading: show that group in the next finer view, or All Photos from a day. */
  onZoomIn: (group: PhotoGroup) => void;
  /** A day's near-duplicates: shows them, or leaves them out again. */
  onShowAll: (group: PhotoGroup) => void;
  /** The days showing their near-duplicates. */
  allOfDays: ReadonlySet<string>;
  idPrefix: string;
}

/** The Days, Months or Years view: a heading per group over its photos. */
function Groups({
  groups,
  unit,
  urls,
  size,
  selected,
  showTitle,
  showKeywords,
  onSelect,
  onOpen,
  onZoomIn,
  onShowAll,
  allOfDays,
  idPrefix,
}: GroupsProps) {
  const limit = unit === "day" ? Number.POSITIVE_INFINITY : MOSAIC[unit];
  return (
    <ScrollView className="mac-photos-groups">
      {groups.map((group) => (
        <section
          key={group.key}
          id={`${idPrefix}-${group.key}`}
          className="mac-photos-group"
          data-unit={unit}
          aria-label={group.title}
        >
          <div className="mac-photos-group-heading">
            <h2 className="mac-photos-group-title">
              <BorderlessButton className="mac-photos-group-link" onClick={() => onZoomIn(group)}>
                {group.title}
              </BorderlessButton>
            </h2>
            <Label textStyle="small" color="secondary">
              {group.detail}
            </Label>
            {group.leftOut ? (
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                onClick={() => onShowAll(group)}
              >
                {allOfDays.has(group.key)
                  ? "Show Fewer Photos"
                  : `Show All ${group.photos.length + group.leftOut} Photos`}
              </BorderlessButton>
            ) : null}
          </div>
          <div
            className="mac-photos-group-grid"
            style={{ "--mac-photos-cell": `${size}px` } as CSSProperties}
          >
            {group.photos.slice(0, limit).map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                url={urls.get(thumbKey(photo))}
                size={size}
                selected={selected.has(photo.id)}
                showTitle={showTitle}
                showKeywords={showKeywords}
                onSelect={onSelect}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ))}
    </ScrollView>
  );
}

/** A name asked for in a popover: a new album's, or an album's new name. */
/** The Music menu's row for no song, not a drive file's id. */
const NO_SONG = "none";
/** The width of the toolbar's Space item, as Finder's. */
const TOOL_SPACE = 16;
/** How long a press on the selected row's name waits for a second press before the name can be changed. */
const RENAME_DELAY_MS = 500;

/** A sidebar row's name while it is being changed in place: Return or leaving it keeps the text, Escape does not. */
function RowName({ name, onDone }: { name: string; onDone: (next: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const finish = (next: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(next);
  };
  return (
    <input
      ref={input}
      aria-label="Name"
      defaultValue={name}
      spellCheck={false}
      className="mac-photos-row-name"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(event.currentTarget.value.trim() || null);
        else if (event.key === "Escape") finish(null);
      }}
      onBlur={(event) => finish(event.currentTarget.value.trim() || null)}
    />
  );
}

function NamePopover({
  trigger,
  title,
  action,
  initial = "",
  onSubmit,
  open: openProp,
  onOpenChange,
}: {
  trigger: ReactElement<Record<string, unknown>>;
  title: string;
  action: string;
  initial?: string;
  onSubmit: (name: string) => void;
  /** Opened from elsewhere too (the File menu's New Album); uncontrolled without it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const [name, setName] = useState(initial);
  // Every opening starts from the initial name, however it was opened.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setName(initial);
  }
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };
  const submit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={trigger} />
      <PopoverPopup className="mac-photos-name">
        <PopoverTitle>{title}</PopoverTitle>
        <form
          className="mac-photos-name-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <TextField
            aria-label="Name"
            value={name}
            onValueChange={(value) => setName(String(value))}
            autoFocus
          />
          <PushButton type="submit" variant="primary" disabled={!name.trim()}>
            {action}
          </PushButton>
        </form>
      </PopoverPopup>
    </Popover>
  );
}

type Status = "loading" | "ready" | "unreadable";

function ServedPhotos({
  photos: _demoPhotos,
  defaultSource: _demoSource,
  onShare: _demoShare,
  defaultZoom = ZOOM.default,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  onKeyDown: onWindowKeyDown,
  width = 1200,
  height = 720,
  preferencesOpen = false,
  onPreferencesOpenChange,
  ...windowProps
}: PhotosProps & {
  preferencesOpen?: boolean;
  onPreferencesOpenChange?: (open: boolean) => void;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [photos, setPhotos] = useState<readonly LibraryPhoto[]>([]);
  const [albums, setAlbumsShown] = useState<readonly LibraryAlbum[]>([]);
  // The albums as the last change left them, also before React renders it: a queued change
  // computes what it changes from this, not from the render that queued it.
  const albumsRef = useRef<readonly LibraryAlbum[]>([]);
  const setAlbums = (
    next: readonly LibraryAlbum[] | ((all: readonly LibraryAlbum[]) => readonly LibraryAlbum[]),
  ) => {
    albumsRef.current = typeof next === "function" ? next(albumsRef.current) : next;
    setAlbumsShown(albumsRef.current);
  };
  const [folders, setFolders] = useState<readonly LibraryFolder[]>([]);
  const [smartAlbums, setSmartAlbums] = useState<readonly SmartAlbum[]>([]);
  const [managedKeywords, setManagedKeywords] = useState<readonly ManagedKeyword[]>([]);
  const [projects, setProjects] = useState<readonly SlideshowProject[]>([]);
  const [memoryMarks, setMemoryMarks] = useState<MemoryMarks>(NO_MEMORY_MARKS);
  const applyOrganised = (organised: Organised) => {
    setAlbums(organised.albums);
    setFolders(organised.folders);
    setSmartAlbums(organised.smart_albums);
    setManagedKeywords(organised.keywords);
    setProjects(organised.projects);
    setMemoryMarks(organised.memories);
  };
  // View > Show Hidden Photo Album, the text under thumbnails, square thumbnails, the sidebar.
  const [showHidden, setShowHidden] = useState(false);
  const [tools, setTools] = useState<readonly PhotosTool[]>(DEFAULT_TOOLS);
  const [showTitles, setShowTitles] = useState(false);
  const [showKeywords, setShowKeywords] = useState(false);
  const [square, setSquare] = useState(false);
  const [sidebarShown, setSidebarShown] = useState(true);
  const [expanded, setExpanded] = useState<Readonly<Record<string, boolean>>>({ albums: true });
  // The floating Info and Keyword Manager windows, the sheet shown, the question asked.
  const [keywordsOpen, setKeywordsOpen] = useState(false);
  const [sheet, setSheet] = useState<
    | { kind: "smart"; album: SmartAlbum | null }
    | { kind: "toolbar" }
    | { kind: "slideshow-save"; project: SlideshowProject }
    | { kind: "date"; ids: string[] }
    | { kind: "import"; files: readonly File[] }
    | { kind: "export"; ids: string[]; choice: ExportChoice["kind"] }
    | { kind: "export-save"; ids: string[]; choice: ExportChoice }
    | {
        kind: "name";
        title: string;
        action: string;
        initial: string;
        done: (name: string) => void;
      }
    | null
  >(null);
  const [question, setQuestion] = useState<{
    message: string;
    informative?: string;
    action: string;
    run: () => void;
  } | null>(null);
  // The full-screen viewer or the slideshow.
  const [stage, setStage] = useState<{
    ids: string[];
    start?: string;
    slideshow: boolean;
    theme?: string;
    seconds?: number;
    musicFile?: string;
  } | null>(null);
  // The open photo's zoom and where it is dragged to; the strip of thumbnails under it.
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerPan, setViewerPan] = useState({ x: 0, y: 0 });
  const [strip, setStrip] = useState(false);
  // The rubber band being dragged over the pictures, in the page's coordinates.
  const [band, setBand] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  // What Undo and Redo hold: the newest last.
  const undoSteps = useRef<UndoStep[]>([]);
  const redoSteps = useRef<UndoStep[]>([]);
  const [, noteUndo] = useState(0);
  // The draft's earlier states while editing; the original shown while M is held.
  const draftHistory = useRef<{ past: Edit[]; future: Edit[]; at: number }>({
    past: [],
    future: [],
    at: 0,
  });
  const [comparing, setComparing] = useState<"adjustments" | "everything" | null>(null);
  // Z in the editor: the picture twice its fitted size.
  const [editZoom, setEditZoom] = useState(1);
  const [keepDays, setKeepDays] = useState(30);
  const [now, setNow] = useState(() => Date.now());
  const [source, setSource] = useState<ServedSource>("library");
  const [view, setView] = useState<LibraryView>("days");
  const [placesLayout, setPlacesLayout] = useState<"map" | "grid">("map");
  const [spotTool, setSpotTool] = useState<SpotTool | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const [memoryUnder, setMemoryUnder] = useState<string | null>(null);
  // The photos of the pin that was chosen; `null` lists every located photo.
  const [placeIds, setPlaceIds] = useState<ReadonlySet<string> | null>(null);
  const [zoom, setZoom] = useState(defaultZoom);
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionAt, setSuggestionAt] = useState(-1);
  const [renaming, setRenaming] = useState<string | null>(null);
  const pressedRow = useRef<string | null>(null);
  const renameTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // A search looks through the whole library: the row it was begun in comes back when it is emptied.
  const searchFrom = useRef<ServedSource | null>(null);
  const [filter, setFilter] = useState<ServedFilter>("all");
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [opened, setOpened] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  // The New Album popover (also opened from the File menu).
  const [newAlbumOpen, setNewAlbumOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  // An element of this window, for the menu bar to know when the window is in front.
  const [inside, setInside] = useState<HTMLElement | null>(null);
  // The most photos the library keeps, Recently Deleted included, as the module says.
  const photoLimit = useRef(5000);
  // The editor: the draft, its pane and crop shape, and the copy of the original it works on.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Edit>(NO_EDIT);
  const [editTab, setEditTab] = useState<EditTab>("adjust");
  const [aspect, setAspect] = useState<AspectId>("free");
  const [editSource, setEditSource] = useState<Drawable | null>(null);
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);
  const live = useRef(true);
  // This window, named in what it announces so it does not read its own changes again.
  const [origin] = useState(() => `photos:${crypto.randomUUID()}`);
  // The photos as the last change left them, also before React renders it: a queued change
  // computes from this, not from the render that queued it.
  const photosRef = useRef<readonly LibraryPhoto[]>([]);
  const setLatest = (next: readonly LibraryPhoto[]) => {
    photosRef.current = next;
    setPhotos(next);
  };
  const latest = (id: string) => photosRef.current.find((photo) => photo.id === id);
  // Changes to the library run one at a time, in the order asked for.
  const chain = useRef<Promise<void>>(Promise.resolve());
  // The editor's session, and the photo it edits.
  const editSession = useRef(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const stopEdit = () => {
    editSession.current += 1;
    setEditing(false);
    setEditingId(null);
    setEditSource(null);
    setSpotTool(null);
  };
  const fileInput = useRef<HTMLInputElement>(null);
  const reviewInput = useRef<HTMLInputElement>(null);
  const backButton = useRef<HTMLElement>(null);
  const viewer = useRef<HTMLElement>(null);
  const idPrefix = useId().replace(/:/g, "");

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // How the window was left comes back with the library. A view it no longer has is left alone.
  function restoreSettings(settings: Record<string, unknown>, held: readonly LibraryPhoto[]) {
    const left = held.find((photo) => photo.id === settings.opened && photo.deleted_ms === null);
    if (left) {
      setOpened(left.id);
      setSelection([left.id]);
    }
    if (typeof settings.source === "string") setSource(settings.source as ServedSource);
    if (LIBRARY_VIEWS.some((each) => each.id === settings.view)) {
      setView(settings.view as LibraryView);
    }
    if (typeof settings.zoom === "number") setZoom(settings.zoom);
    if (settings.placesLayout === "grid") setPlacesLayout("grid");
    setAutoplay(settings.autoplay === true);
    setShowHidden(settings.showHidden === true);
    setTools(readTools(settings.tools) ?? DEFAULT_TOOLS);
    setShowTitles(settings.showTitles === true);
    setShowKeywords(settings.showKeywords === true);
    setSquare(settings.square === true);
    setSidebarShown(settings.sidebarShown !== false);
    setStrip(settings.strip === true);
    if (typeof settings.expanded === "object" && settings.expanded !== null) {
      setExpanded(settings.expanded as Record<string, boolean>);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: the library loads once when the window opens; both helpers only set state
  useEffect(() => {
    loadLibrary().then(
      (library) => {
        if (!live.current) return;
        photosRef.current = library.photos;
        photoLimit.current = library.limits.photos;
        setPhotos(library.photos);
        applyOrganised(library);
        restoreSettings(library.settings, library.photos);
        settingsRev.current = library.settings_rev ?? 0;
        setKeepDays(library.limits.recently_deleted_days);
        setNow(Date.now());
        setStatus("ready");
      },
      (error) => {
        if (!live.current) return;
        console.error(`Photos could not read its library (${error})`);
        setStatus("unreadable");
      },
    );
  }, []);

  const ready = status === "ready";
  // Keep how the window is left, a moment after the last change, and not what the load restored.
  const savedSettings = useRef<string | null>(null);
  const latestSettings = useRef<string | null>(null);
  const answeredSettings = useRef<string | null>(null);
  // The server owns the revision: a save names the one it was based on, so one held on its way can
  // never land over a newer. One goes at a time, and a refused one is sent again on the new revision.
  const settingsRev = useRef(0);
  const savingSettings = useRef(false);
  const sendSettings = useCallback(function send() {
    const sending = latestSettings.current;
    if (savingSettings.current || sending === null || sending === answeredSettings.current) return;
    savingSettings.current = true;
    savedSettings.current = sending;
    let again = true;
    putSettings(JSON.parse(sending), { base: settingsRev.current })
      .then(
        (rev) => {
          if (rev !== null) settingsRev.current = rev;
          answeredSettings.current = sending;
        },
        (error) => {
          const stored = settingsConflict(error);
          if (stored !== null) {
            settingsRev.current = stored;
            return;
          }
          again = false;
          console.warn(`Photos could not keep how the window was left (${error})`);
        },
      )
      .finally(() => {
        savingSettings.current = false;
        if (again) send();
      });
  }, []);
  // Leaving ends the page, so what no answer has confirmed goes once more, outliving it and naming
  // no revision: it always stores, and any save held from before it is then refused.
  useEffect(() => {
    const leave = () => {
      const latest = latestSettings.current;
      if (latest === null || latest === answeredSettings.current) return;
      answeredSettings.current = latest;
      void putSettings(JSON.parse(latest), { leaving: true }).catch(() => {});
    };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const settings = JSON.stringify({
      source,
      view,
      zoom,
      placesLayout,
      autoplay,
      showHidden,
      tools,
      showTitles,
      showKeywords,
      square,
      sidebarShown,
      strip,
      expanded,
      opened,
    });
    latestSettings.current = settings;
    if (savedSettings.current === null) {
      savedSettings.current = settings;
      answeredSettings.current = settings;
      return;
    }
    if (savedSettings.current === settings) return;
    const timer = setTimeout(sendSettings, 800);
    return () => clearTimeout(timer);
  }, [
    sendSettings,
    ready,
    source,
    view,
    zoom,
    placesLayout,
    autoplay,
    showHidden,
    tools,
    showTitles,
    showKeywords,
    square,
    sidebarShown,
    strip,
    expanded,
    opened,
  ]);
  const { urls, put: putThumb, blobOf } = useThumbs(photos, ready);
  const { looking: lookingForFaces, unavailable: facesUnavailable } = useFaceScan(
    ready,
    photos,
    blobOf,
    urls,
    (id, editedMs, faces) =>
      setLatest(
        photosRef.current.map((photo) =>
          photo.id === id && photo.edited_ms === editedMs ? { ...photo, faces } : photo,
        ),
      ),
  );
  // Each picture's hash comes from its thumbnail once that is here, a batch at a time, and stays
  // with the photo. A new edit clears it on the server, and its thumbnail has a new key.
  const hashing = useRef(new Set<string>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: `urls` changes as thumbnails arrive
  useEffect(() => {
    if (!ready || typeof createImageBitmap === "undefined") return;
    const wanted = photos
      .filter(
        (photo) =>
          !photo.phash &&
          photo.deleted_ms === null &&
          !isVideo(photo) &&
          !hashing.current.has(thumbKey(photo)) &&
          blobOf(thumbKey(photo)),
      )
      .slice(0, HASHES_PER_REQUEST);
    if (wanted.length === 0) return;
    for (const photo of wanted) hashing.current.add(thumbKey(photo));
    void (async () => {
      const made = await Promise.all(
        wanted.map((photo) =>
          hashOfThumb(blobOf(thumbKey(photo)) as Blob).then(
            (hash) => ({ id: photo.id, edited_ms: photo.edited_ms, hash }),
            () => null,
          ),
        ),
      );
      const hashes = made.filter((each) => each !== null);
      if (hashes.length === 0 || !live.current) return;
      const kept = new Set(await keepPictureHashes(hashes));
      const byId = new Map(hashes.map((each) => [each.id, each]));
      setLatest(
        photosRef.current.map((photo) => {
          const made = byId.get(photo.id);
          return made && kept.has(photo.id) && made.edited_ms === photo.edited_ms
            ? { ...photo, phash: made.hash }
            : photo;
        }),
      );
    })().catch((error) => console.warn(`Photos could not keep picture hashes (${error})`));
  }, [ready, photos, urls, blobOf]);
  // What each picture shows, one at a time from its thumbnail, kept with the photo. A picture read
  // takes the model about a second, in its worker. A model that cannot load is not asked again
  // until the page opens again, and search and Memories go on without scenes.
  const lookingForScenes = useRef(false);
  const scenesUnavailable = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `urls` changes as thumbnails arrive
  useEffect(() => {
    if (
      !ready ||
      lookingForScenes.current ||
      scenesUnavailable.current ||
      typeof Worker === "undefined" ||
      typeof createImageBitmap === "undefined"
    ) {
      return;
    }
    const photo = notLookedAtForScenes(photos).find((each) => blobOf(thumbKey(each)));
    if (!photo) return;
    lookingForScenes.current = true;
    void (async () => {
      const scenes = await scenesOfThumb(blobOf(thumbKey(photo)) as Blob);
      if (!live.current) return;
      const kept = await keepPictureScenes([{ id: photo.id, scenes }]);
      lookingForScenes.current = false;
      setLatest(
        photosRef.current.map((each) =>
          each.id === photo.id ? { ...each, scenes: kept.includes(each.id) ? scenes : [] } : each,
        ),
      );
    })().catch((error) => {
      scenesUnavailable.current = true;
      lookingForScenes.current = false;
      console.warn(`Photos could not read what its pictures show (${error})`);
    });
  }, [ready, photos, urls, blobOf]);
  const album = albumOf(source, albums);
  const smartAlbum = source.startsWith("smart:")
    ? smartAlbums.find((each) => `smart:${each.id}` === source)
    : undefined;
  const project = source.startsWith("project:")
    ? projects.find((each) => `project:${each.id}` === source)
    : undefined;
  const memories = useMemo(
    () =>
      [...albumMemoriesOf(memoryMarks.albums, photos, albums, now), ...memoriesOf(photos)].filter(
        (each) => !memoryMarks.deleted.includes(each.id),
      ),
    [memoryMarks, photos, albums, now],
  );
  // The pane of My Albums: a tile per album and smart album, its key photo first. Tiles are built
  // only when that pane is shown, since each album is listed in full.
  const albumTiles = useMemo(() => {
    if (source !== "my-albums") return [];
    const tile = (id: ServedSource, title: string, first?: string | null) => {
      const held = photosOfSource(id, photos, albums, now, smartAlbums, projects);
      const key = held.find((photo) => photo.id === first);
      return {
        id,
        title,
        detail: photoCount(held.length),
        photos: key ? [key, ...held.filter((photo) => photo !== key)] : held,
      };
    };
    return [
      ...albums.map((each) => tile(`album:${each.id}`, each.name, each.key_photo)),
      ...smartAlbums.map((each) => tile(`smart:${each.id}`, each.name)),
    ];
  }, [source, photos, albums, smartAlbums, projects, now]);
  const people = useMemo(() => peopleOf(photos), [photos]);
  const facesToNameNow = useMemo(() => unnamedFaces(photos), [photos]);
  const person = source.startsWith("person:")
    ? people.find((each) => `person:${each.name}`.toLowerCase() === source.toLowerCase())
    : undefined;
  const memory = source.startsWith("memory:")
    ? memories.find((each) => `memory:${each.id}` === source)
    : undefined;
  const sourceName =
    album?.name ??
    smartAlbum?.name ??
    project?.name ??
    memory?.title ??
    person?.name ??
    (source === "my-albums" ? "My Albums" : null) ??
    LIBRARY_SOURCES.find((each) => each.id === source)?.name ??
    MEDIA_SOURCES.find((each) => each.id === source)?.name ??
    (source === "places" ? "Places" : "Photos");
  const inDeleted = source === "deleted";
  const collection = useMemo(
    () =>
      source === "memories"
        ? [...new Set(memories.flatMap((each) => each.photos))]
        : source === "my-albums"
          ? [...new Set(albumTiles.flatMap((each) => each.photos))]
          : (memory?.photos ?? photosOfSource(source, photos, albums, now, smartAlbums, projects)),
    [memories, albumTiles, memory, source, photos, albums, now, smartAlbums, projects],
  );
  const listed = useMemo(
    () =>
      collection.filter(
        (photo) =>
          searchMatches(photo, query, albums) &&
          (inDeleted || filterPasses(photo, filter)) &&
          (source !== "places" || placeIds === null || placeIds.has(photo.id)),
      ),
    [collection, query, albums, filter, inDeleted, source, placeIds],
  );
  const picture = opened === null ? undefined : photos.find((photo) => photo.id === opened);
  const viewing = picture !== undefined;
  const openIndex = picture ? listed.findIndex((photo) => photo.id === picture.id) : -1;
  const selected = useMemo(() => new Set(selection), [selection]);
  const current = picture ? [picture] : listed.filter((photo) => selected.has(photo.id));
  const [selectionOwner] = useState(() => ({}));
  const currentFiles = current.map((photo) => photo.file).join("\n");
  useEffect(() => {
    publishPhotosSelection(selectionOwner, currentFiles ? currentFiles.split("\n") : []);
  }, [currentFiles, selectionOwner]);
  useEffect(() => () => clearPhotosSelection(selectionOwner), [selectionOwner]);
  const allFavorite = current.length > 0 && current.every((photo) => photo.favorite);
  const full = useFullImage(editing ? undefined : picture);
  const size = cellSize(zoom);
  // The Photos row shows its Years, Months and Days views, Imports its batches; every other row is one grid.
  const inImports = source === "imports";
  const grouped = (inImports || (source === "library" && view !== "all")) && !query.trim();
  const suggestions = useMemo(
    () => (suggestionsOpen ? searchSuggestions(collection, query, albums) : []),
    [suggestionsOpen, collection, query, albums],
  );
  const unit = inImports || view === "all" ? "day" : UNIT_OF[view];
  const [allOfDays, setAllOfDays] = useState<ReadonlySet<string>>(() => new Set());
  const groups = useMemo(() => {
    if (!grouped) return [];
    if (inImports) return importBatches(listed);
    const made = groupPhotos(listed, unit);
    return view === "days"
      ? made.map((group) => curatedDay(group, allOfDays.has(group.key)))
      : made;
  }, [grouped, inImports, listed, unit, view, allOfDays]);
  // The photos as shown, in order: what Select All and a Shift-click range take. A Months or
  // Years group shows only its first few, and only those are taken.
  const shownIds = useMemo(() => {
    // A map or the tiles of Memories or People show no photo to select.
    if (
      source === "memories" ||
      source === "my-albums" ||
      source === "people" ||
      (source === "places" && placesLayout === "map")
    ) {
      return [];
    }
    if (!grouped) return listed.map((photo) => photo.id);
    const limit = unit === "day" ? Number.POSITIVE_INFINITY : MOSAIC[unit];
    return groups.flatMap((group) => group.photos.slice(0, limit).map((photo) => photo.id));
  }, [grouped, listed, unit, groups, source, placesLayout]);
  // The last photo clicked without Shift: where a Shift-click range starts.
  const anchor = useRef<string | null>(null);

  // A photo that leaves the library (deleted for good) or the list it was opened from (moved to
  // Recently Deleted, unfavorited in Favorites) is closed, unless it is being edited.
  useEffect(() => {
    if (opened === null || editing) return;
    if (!listed.some((photo) => photo.id === opened)) setOpened(null);
  }, [opened, listed, editing]);

  // The photo being edited deleted for good in another window: the editor ends, and says why.
  useEffect(() => {
    if (!editing || editingId === null) return;
    if (photos.some((photo) => photo.id === editingId)) return;
    // As stopEdit does, written out so that the effect depends on nothing that changes per render.
    editSession.current += 1;
    setEditing(false);
    setEditingId(null);
    setEditSource(null);
    setOpened(null);
    setNotice("The photo you were editing was deleted in another window.");
  }, [editing, editingId, photos]);

  // The album shown deleted (in another window, or by a refresh): the window shows the library.
  useEffect(() => {
    if (status !== "ready") return;
    const named =
      (source.startsWith("album:") && !albumOf(source, albums)) ||
      (source.startsWith("smart:") && !smartAlbums.some((a) => `smart:${a.id}` === source)) ||
      (source.startsWith("project:") && !projects.some((p) => `project:${p.id}` === source));
    if (source.startsWith("memory:") && !memory) {
      setSource("memories");
      setSelection([]);
      return;
    }
    if (
      source.startsWith("person:") &&
      !peopleOf(photos).some((p) => `person:${p.name}`.toLowerCase() === source.toLowerCase())
    ) {
      setSource("people");
      setSelection([]);
      return;
    }
    if (!named) return;
    setSource("library");
    setSelection([]);
  }, [status, source, memory, albums, smartAlbums, projects, photos]);

  useEffect(() => {
    if (!pendingScroll) return;
    document.getElementById(`${idPrefix}-${pendingScroll}`)?.scrollIntoView({ block: "start" });
    setPendingScroll(null);
  }, [pendingScroll, idPrefix]);

  const replace = (photo: LibraryPhoto) =>
    setLatest(photosRef.current.map((each) => (each.id === photo.id ? photo : each)));

  /**
   * Run a change to the library after the ones before it, saying when it fails. A change (not a
   * read or an export) is announced to the other open windows afterwards, also when it failed
   * part of the way, since what did change should show there.
   */
  const act = (
    what: string,
    action: () => Promise<void>,
    { changes = true }: { changes?: boolean } = {},
  ): Promise<void> => {
    const run = async () => {
      try {
        await action();
        // A change that worked clears the last failure's notice; a read or an export leaves it,
        // so what a read itself found to say (an edited photo deleted elsewhere) stays.
        if (live.current && changes) setNotice(null);
      } catch (error) {
        console.warn(`Photos: ${what} failed (${error})`);
        if (live.current)
          setNotice(`${what} did not work: ${error instanceof Error ? error.message : error}.`);
      } finally {
        if (changes) announceChange(origin);
      }
    };
    const next = chain.current.then(run);
    chain.current = next;
    return next;
  };

  /** Apply a change already made on the server after the changes and reads queued before it, so
   * a read of the library that began earlier cannot replace it. */
  const applyInOrder = (change: () => void): Promise<void> => {
    const next = chain.current.then(() => {
      if (live.current) change();
    });
    chain.current = next;
    return next;
  };

  // Another window changed the library (Photo Booth saved a shot, another Photos window edited a
  // photo): read it again, after the changes this window has queued. Its own announcements are
  // not read again.
  const refresh = useRef<(event: Event) => void>(() => {});
  // A change announced while the library was still loading, read once it has loaded.
  const missed = useRef(false);
  // A read queued and not yet started takes in every change announced before it starts.
  const reading = useRef(false);
  refresh.current = (event) => {
    if (announcedBy(event) === origin) return;
    if (status !== "ready") {
      missed.current = true;
      return;
    }
    if (reading.current) return;
    reading.current = true;
    void act(
      "Reading the library",
      async () => {
        reading.current = false;
        const library = await loadLibrary();
        if (!live.current) return;
        setLatest(library.photos);
        applyOrganised(library);
        setNow(Date.now());
      },
      { changes: false },
    );
  };
  useEffect(() => {
    const changed = (event: Event) => refresh.current(event);
    // Another browser or tab of this person changed the library: the router counts every write to
    // the module, and the person's live stream tells this page which application it was.
    const changedElsewhere = (event: Event) => {
      const detail = (event as CustomEvent<{ app?: unknown } | null>).detail;
      if (detail?.app === "photos") refresh.current(event);
    };
    window.addEventListener(LIBRARY_CHANGED_EVENT, changed);
    window.addEventListener(SERVER_CHANGE_EVENT, changedElsewhere);
    return () => {
      window.removeEventListener(LIBRARY_CHANGED_EVENT, changed);
      window.removeEventListener(SERVER_CHANGE_EVENT, changedElsewhere);
    };
  }, []);
  useEffect(() => {
    if (status !== "ready" || !missed.current) return;
    missed.current = false;
    refresh.current(new Event(LIBRARY_CHANGED_EVENT));
  }, [status]);

  // The songs of the person's Music library with a file of their own, for a slideshow's menu and
  // a memory's soundtrack; null until the library has answered.
  const memoryMoods = useDesktopValue(MEMORY_MOODS_KEY, readMemoryMoods, NO_MEMORY_MOODS);
  const [readSongs, setSongs] = useState<readonly { file: string; title: string }[] | null>(null);
  const songs = readSongs ?? [];
  useEffect(() => {
    if (!source.startsWith("project:") && !source.startsWith("memory:")) return;
    void sessionFetch(MUSIC_LIBRARY_URL)
      .then((reply) => (reply.ok ? reply.json() : null))
      .then((reply) => {
        const library = libraryFromServer(reply);
        if (!library) return;
        setSongs(
          library.songs.flatMap((song) =>
            song.source.kind === "file" ? [{ file: song.source.file, title: song.title }] : [],
          ),
        );
      })
      .catch((error) => console.warn(`Photos could not list the Music library (${error})`));
  }, [source]);
  const choose = (next: ServedSource) => {
    clearTimeout(renameTimer.current);
    searchFrom.current = null;
    leftAt.current = 0;
    setSource(next);
    setPlaceIds(null);
    setSelection([]);
    setOpened(null);
    stopEdit();
    setFilter("all");
  };

  const search = (next: string) => {
    const searching = next.trim() !== "";
    if (searching && !query.trim() && source !== "library") {
      // The chosen pin (`placeIds`) narrows only the Places row (`listed`), so it stays set here
      // and the same pin is back when the search is emptied.
      searchFrom.current = source;
      setSource("library");
      setSelection([]);
      setOpened(null);
    } else if (!searching && searchFrom.current) {
      setSource(searchFrom.current);
      setSelection([]);
      searchFrom.current = null;
    }
    setQuery(next);
  };
  const pickSuggestion = (chosen: SearchSuggestion) => {
    search(chosen.text);
    setSuggestionsOpen(false);
    setSuggestionAt(-1);
    setSelection([]);
  };

  /** Years, Months, Days or All Photos: within the library the selection stays. */
  const showView = (next: LibraryView) => {
    if (source !== "library" || viewing || editing) choose("library");
    setView(next);
  };

  // Where the pane was scrolled when a photo opened, and that it has to go back there.
  const leftAt = useRef(0);
  const wasOpen = useRef(false);
  const revealSelected = useRef(false);
  const paneScroller = () =>
    frame?.querySelector<HTMLElement>(
      ".mac-photos-grid [role='listbox'], .mac-photos-groups .mac-scroll-view-viewport",
    ) ?? null;

  const open = (id: string) => {
    if (!viewing && !editing) leftAt.current = paneScroller()?.scrollTop ?? 0;
    setOpened(id);
    setSelection([id]);
    setViewerScale(1);
    setViewerPan({ x: 0, y: 0 });
  };
  const close = () => {
    setOpened(null);
    stopEdit();
  };
  useOpenItemRequests("photos", ({ id }) => open(id));
  const step = (by: number) => {
    const next = listed[openIndex + by];
    if (next) open(next.id);
  };
  useEffect(() => {
    // The keyboard goes to the open photo, so the arrow keys step through the list.
    if (viewing) viewer.current?.focus();
  }, [viewing]);

  // Back from a photo: the pane where it was, with the photo last shown in view. A listbox with the
  // focus draws and shows its selected item, once it has measured itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when a photo opens or closes, or the view changes
  useLayoutEffect(() => {
    if (viewing || editing) {
      wasOpen.current = true;
      return;
    }
    const back = wasOpen.current;
    wasOpen.current = false;
    const scroller = paneScroller();
    if (!scroller) return;
    if (back) scroller.scrollTop = leftAt.current;
    if (!back && !revealSelected.current) return;
    revealSelected.current = false;
    const shown = selection[0];
    if (scroller.matches("[role='listbox']")) scroller.focus({ preventScroll: true });
    else if (shown) {
      scroller
        .querySelector(`[data-photo-id="${CSS.escape(shown)}"]`)
        ?.scrollIntoView?.({ block: "nearest" });
    }
  }, [viewing, editing, view]);

  // A pinch: a Mac browser reports it as a wheel with the Control key, Safari as gesture events.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the viewer's element comes and goes with the open photo
  useEffect(() => {
    const pane = viewer.current;
    if (!pane) return;
    const scaleTo = (change: (old: number) => number) =>
      setViewerScale((old) => {
        const next = change(old);
        if (next === 1) setViewerPan({ x: 0, y: 0 });
        return next;
      });
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      scaleTo((old) => pinchedScale(old, event.deltaY, MAX_VIEWER_SCALE));
    };
    let gestureFrom = 1;
    const gestureStart = (event: Event) => {
      event.preventDefault();
      setViewerScale((old) => {
        gestureFrom = old;
        return old;
      });
    };
    const gestureChange = (event: Event) => {
      event.preventDefault();
      const { scale } = event as Event & { scale: number };
      scaleTo(() => Math.min(MAX_VIEWER_SCALE, Math.max(1, gestureFrom * scale)));
    };
    pane.addEventListener("wheel", wheel, { passive: false });
    pane.addEventListener("gesturestart", gestureStart);
    pane.addEventListener("gesturechange", gestureChange);
    return () => {
      pane.removeEventListener("wheel", wheel);
      pane.removeEventListener("gesturestart", gestureStart);
      pane.removeEventListener("gesturechange", gestureChange);
    };
  }, [viewing, editing]);

  const selectTile = (id: string, event: MouseEvent) => {
    const adding = event.metaKey || event.ctrlKey;
    if (event.shiftKey) {
      // Shift selects from the anchor to this photo; with Command, onto what was selected.
      const range = rangeIds(shownIds, anchor.current, id);
      setSelection((old) => (adding ? [...new Set([...old, ...range])] : range));
      if (anchor.current === null || !shownIds.includes(anchor.current)) anchor.current = id;
      return;
    }
    anchor.current = id;
    if (adding) {
      setSelection((old) => (old.includes(id) ? old.filter((each) => each !== id) : [...old, id]));
    } else {
      setSelection([id]);
    }
  };
  /** Select every photo shown (not while one is open). */
  const selectAll = () => {
    if (viewing || editing) return;
    setSelection(shownIds);
  };

  // Imports run one after another: files dropped during an import wait their turn.
  const importing = useRef<Promise<void>>(Promise.resolve());
  const importFiles = (files: readonly File[], into?: LibraryAlbum) => {
    // One import that fails never stops the next: runImport says what it could, and this logs the
    // rest.
    const next = importing.current
      .then(() => runImport(files, into))
      .catch((error) => console.warn(`Photos: an import stopped (${error})`));
    importing.current = next;
    return next;
  };
  /**
   * Import files. Each is checked by its bytes before anything is uploaded (a picture type the
   * library keeps, not too large, room left in the library), then decoded, uploaded and added.
   * Every file not imported is named in the notice, with why.
   */
  const runImport = async (files: readonly File[], into?: LibraryAlbum) => {
    const refused: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      let checked: Awaited<ReturnType<typeof checkPicture>>;
      try {
        checked = await checkPicture(file, file.name);
      } catch (error) {
        // A dropped file the browser can no longer read (moved, or its permission gone).
        refused.push(
          `“${file.name}” could not be read: ${error instanceof Error ? error.message : String(error)}`,
        );
        continue;
      }
      if ("refused" in checked) refused.push(checked.refused);
      else accepted.push(file);
    }
    // Room left, counted against the library as it is now (Recently Deleted counts).
    const room = Math.max(0, photoLimit.current - photosRef.current.length);
    for (const file of accepted.splice(room)) {
      refused.push(
        `“${file.name}” did not fit: the library keeps at most ${photoLimit.current} photos, Recently Deleted included`,
      );
    }
    let added = 0;
    const addedIds: string[] = [];
    for (const [index, file] of accepted.entries()) {
      if (live.current) setBusy(`Importing ${index + 1} of ${accepted.length}…`);
      try {
        const photo = await importPicture(file, { name: file.name });
        added += 1;
        addedIds.push(photo.id);
        if (!live.current) break;
        await applyInOrder(() =>
          setLatest([...photosRef.current.filter((each) => each.id !== photo.id), photo]),
        );
      } catch (error) {
        console.warn(`Photos could not import ${file.name} (${error})`);
        const message = error instanceof Error ? error.message : String(error);
        refused.push(message.includes(file.name) ? message : `“${file.name}”: ${message}`);
      }
    }
    // Dropped on an album's row: they join it as well.
    if (into && addedIds.length > 0) {
      try {
        const next = await changeAlbum(into.id, { add: addedIds });
        if (live.current) setAlbums(next);
      } catch (error) {
        refused.push(`They could not join “${into.name}”: ${error}`);
      }
    }
    // Other open windows show the new photos, also when this one closed meanwhile.
    if (added > 0) announceChange(origin);
    if (!live.current) return;
    setBusy(null);
    setNow(Date.now());
    setNotice(importNotice(files.length, refused));
  };

  /** Files dragged from Finder or the desktop, onto the pane or an album's row. */
  const importDragged = (items: Parameters<typeof filesOfDrag>[0], into?: LibraryAlbum) => {
    setBusy("Reading the files…");
    void filesOfDrag(items).then(
      (files) => importFiles(files, into),
      (error) => {
        setBusy(null);
        setNotice(`The files could not be read: ${error}.`);
      },
    );
  };

  /** Keep what `step` undoes, for Edit > Undo. A new change ends what Redo held. */
  const remember = (step: UndoStep) => {
    undoSteps.current.push(step);
    if (undoSteps.current.length > 50) undoSteps.current.shift();
    redoSteps.current = [];
    noteUndo((n) => n + 1);
  };
  // A step moves to the other stack only once it has worked: after a failure the same Undo or
  // Redo is still there to try again, and each of its writes says the state it wants, so what
  // already went through is not done twice.
  const undo = () =>
    void act("Undo", async () => {
      const step = undoSteps.current.at(-1);
      if (!step) return;
      await step.undo();
      undoSteps.current.pop();
      redoSteps.current.push(step);
      noteUndo((n) => n + 1);
    });
  const redo = () =>
    void act("Redo", async () => {
      const step = redoSteps.current.at(-1);
      if (!step) return;
      await step.redo();
      redoSteps.current.pop();
      undoSteps.current.push(step);
      noteUndo((n) => n + 1);
    });

  /**
   * Change photos, one at a time and each from how the last change left it, and keep what Undo
   * needs to put them back.
   */
  const changeMany = (
    label: string,
    ids: readonly string[],
    changeOf: (photo: LibraryPhoto) => PhotoChange | null,
  ) =>
    act(label, async () => {
      const steps: { id: string; back: PhotoChange; forward: PhotoChange }[] = [];
      const apply = async (key: "back" | "forward") => {
        for (const step of steps) replace(await changePhoto(step.id, step[key]));
      };
      try {
        for (const id of ids) {
          const before = latest(id);
          const change = before ? changeOf(before) : null;
          if (!before || !change) continue;
          const after = await changePhoto(id, change);
          replace(after);
          steps.push({ id, back: restoring(before, after), forward: change });
        }
      } finally {
        // Also when a later photo failed: Undo puts back those that did change.
        if (steps.length > 0) {
          remember({ label, undo: () => apply("back"), redo: () => apply("forward") });
        }
      }
    });

  const toggleFavorite = () => {
    const ids = current.map((photo) => photo.id);
    // Decided when the change runs, from the photos as the change before it left them, so two
    // quick clicks favorite and then unfavorite.
    let favorite: boolean | undefined;
    void changeMany("Favorite", ids, () => {
      if (favorite === undefined) {
        const now = ids.map(latest).filter((photo) => photo !== undefined);
        favorite = !(now.length > 0 && now.every((photo) => photo.favorite));
      }
      return { favorite };
    });
  };

  /** Image > Hide, and Unhide in the Hidden row. */
  const toggleHidden = () => {
    const ids = current.map((photo) => photo.id);
    // Decided when the change runs, as Favorite is: two quick presses hide and show again.
    let hidden: boolean | undefined;
    const label = current.length > 0 && current.every((photo) => photo.hidden) ? "Unhide" : "Hide";
    void changeMany(label, ids, () => {
      if (hidden === undefined) {
        const now = ids.map(latest).filter((photo) => photo !== undefined);
        hidden = !(now.length > 0 && now.every((photo) => photo.hidden));
      }
      return { hidden };
    }).then(() => {
      if (live.current) setSelection([]);
    });
  };

  // Each turn is computed from the photo as the last change left it, so two quick Rotates are
  // two quarter turns. A clockwise turn is three to the left.
  const rotate = (turns = 1) => {
    const ids = current.filter((photo) => !isVideo(photo)).map((photo) => photo.id);
    return act("Rotate", async () => {
      for (const id of ids) {
        const photo = latest(id);
        if (!photo) continue;
        const shown = blobOf(thumbKey(photo));
        let edit = photo.edit ?? NO_EDIT;
        for (let n = 0; n < turns; n += 1) edit = turnLeft(edit);
        if (isIdentity(edit)) {
          replace(await changePhoto(id, { edit: null }));
          continue;
        }
        const thumb = shown ? await turnedThumb(shown, turns) : null;
        if (!thumb) throw new Error("its thumbnail is not loaded yet");
        const updated = await changePhoto(id, { edit, thumb });
        putThumb(thumbKey(updated), thumb);
        replace(updated);
      }
    });
  };

  /** Image > Enhance: Auto Enhance, as the editor's button sets it, on each chosen photo. */
  const enhance = (targets: readonly LibraryPhoto[]) =>
    act("Enhance", async () => {
      for (const { id } of targets) {
        const photo = latest(id);
        if (!photo || isVideo(photo)) continue;
        const decoded = await decodePicture(await readOriginal(photo));
        try {
          const sample = renderEdit(decoded, NO_EDIT, 256);
          const pixels = sample.getContext("2d")?.getImageData(0, 0, sample.width, sample.height);
          if (!pixels) continue;
          const edit: Edit = { ...(photo.edit ?? NO_EDIT), adjust: autoAdjust(pixels) };
          const thumb = await thumbnailOf(decoded, edit);
          const updated = await changePhoto(id, { edit, thumb });
          putThumb(thumbKey(updated), thumb);
          replace(updated);
        } finally {
          decoded.close();
        }
      }
    });

  const moveToDeleted = (targets: readonly LibraryPhoto[]) => {
    const ids = targets.map((photo) => photo.id);
    return changeMany("Delete", ids, () => ({ deleted: true })).then(() => {
      if (live.current) setSelection([]);
    });
  };
  /** Delete from a key or a menu: it asks first, and says where the photos go. */
  const askDelete = (targets: readonly LibraryPhoto[]) => {
    if (targets.length === 0) return;
    const single = targets.length === 1;
    setQuestion({
      message: single
        ? "Are you sure you want to delete this photo?"
        : `Are you sure you want to delete these ${targets.length} photos?`,
      informative: `${single ? "It stays" : "They stay"} in Recently Deleted for ${keepDays} days.`,
      action: "Delete",
      run: () => void moveToDeleted(targets),
    });
  };
  const recover = (targets: readonly LibraryPhoto[]) => {
    const ids = targets.map((photo) => photo.id);
    return changeMany("Recover", ids, () => ({ deleted: false })).then(() => {
      if (live.current) setSelection([]);
    });
  };
  const deleteNow = (targets: readonly LibraryPhoto[]) => {
    const ids = targets.map((photo) => photo.id);
    setQuestion({
      message:
        ids.length === 1
          ? "Are you sure you want to delete this photo?"
          : `Are you sure you want to delete these ${ids.length} photos?`,
      informative: "This action cannot be undone.",
      action: "Delete",
      run: () =>
        void act("Delete Immediately", async () => {
          for (const id of ids) {
            await deletePhoto(id);
            setLatest(photosRef.current.filter((each) => each.id !== id));
            setAlbums((all) =>
              all.map((each) => ({ ...each, photos: each.photos.filter((other) => other !== id) })),
            );
          }
          setSelection([]);
          close();
        }),
    });
  };

  const photosIn = (album: LibraryAlbum) =>
    albumsRef.current.find((each) => each.id === album.id)?.photos ?? album.photos;
  /** What puts back `photos` as the order of an album kept in its own order. */
  const orderOf = (album: LibraryAlbum, photos: readonly string[]) =>
    album.sort === "custom" ? { order: [...photos] } : {};
  const addToAlbum = (target: LibraryAlbum, ids: readonly string[]) =>
    act(`Add to “${target.name}”`, async () => {
      const held = photosIn(target);
      const fresh = ids.filter((id) => !held.includes(id));
      setAlbums(await changeAlbum(target.id, { add: [...ids] }));
      remember({
        label: "Add to Album",
        undo: async () => setAlbums(await changeAlbum(target.id, { remove: fresh })),
        redo: async () => setAlbums(await changeAlbum(target.id, { add: fresh })),
      });
    });
  const removeFromAlbum = (target: LibraryAlbum, ids: readonly string[]) =>
    act("Remove from Album", async () => {
      const held = photosIn(target);
      const taken = ids.filter((id) => held.includes(id));
      setAlbums(await changeAlbum(target.id, { remove: [...ids] }));
      setSelection([]);
      remember({
        label: "Remove from Album",
        undo: async () =>
          setAlbums(await changeAlbum(target.id, { add: taken, ...orderOf(target, held) })),
        redo: async () => setAlbums(await changeAlbum(target.id, { remove: taken })),
      });
    });
  // One write: the photos leave `from` as they join `to`. Undo takes back only what the move
  // changed: a photo that was in both albums stays in `to`.
  const moveToAlbum = (
    from: LibraryAlbum,
    to: LibraryAlbum,
    ids: readonly string[],
    moved?: () => void,
  ) =>
    act(`Move to “${to.name}”`, async () => {
      const held = photosIn(from);
      const left = ids.filter((id) => held.includes(id));
      const already = photosIn(to);
      const joined = ids.filter((id) => !already.includes(id));
      setAlbums(await changeAlbum(to.id, { add: [...ids], from: from.id }));
      moved?.();
      setSelection([]);
      remember({
        label: "Move to Album",
        undo: async () => {
          setAlbums(await changeAlbum(from.id, { add: left, ...orderOf(from, held) }));
          setAlbums(await changeAlbum(to.id, { remove: joined }));
        },
        redo: async () => setAlbums(await changeAlbum(to.id, { add: [...ids], from: from.id })),
      });
    });
  const sortAlbum = (target: LibraryAlbum, sort: AlbumSort) =>
    act("Sort", async () => {
      setAlbums(await changeAlbum(target.id, { sort }));
    });
  /** Revert to Original outside the editor (the Image menu): every chosen photo with an edit. */
  const revertChosen = (targets: readonly LibraryPhoto[]) => {
    const ids = targets.filter((photo) => photo.edit !== null).map((photo) => photo.id);
    return act("Revert to Original", async () => {
      for (const id of ids) replace(await changePhoto(id, { edit: null }));
    });
  };
  const newAlbum = (name: string) =>
    act("New Album", async () => {
      const id = crypto.randomUUID();
      let next = await createAlbum(name, id);
      // Shown at once: were adding the photos to fail, the album made is still listed.
      setAlbums(next);
      const ids = current.filter((photo) => photo.deleted_ms === null).map((photo) => photo.id);
      if (ids.length > 0) next = await changeAlbum(id, { add: ids });
      setAlbums(next);
      choose(`album:${id}`);
    });

  const extensionOf = (photo: LibraryPhoto) =>
    (photo.mime.split("/")[1] ?? "jpg").replace("jpeg", "jpg").replace("quicktime", "mov");
  const exportedAsItIs = (photo: LibraryPhoto, choice: ExportChoice) =>
    choice.kind === "original" ||
    isVideo(photo) ||
    (!photo.edit && choice.side === 0 && photo.mime === `image/${choice.format}`);
  const exportExtension = (photo: LibraryPhoto, choice: ExportChoice) =>
    exportedAsItIs(photo, choice) ? extensionOf(photo) : choice.format === "png" ? "png" : "jpg";
  /**
   * Export what the sheet chose: each photo read when the export runs, after the changes queued
   * before it (a Rotate clicked just before Export is in the exported picture), drawn with its
   * edit unless the original was asked for, and handed to the computer or saved to the drive. With
   * `place`, from the Save dialog: one photo goes there under that name, several into a folder of
   * that name there.
   */
  const runExport = (ids: readonly string[], choice: ExportChoice, place?: DriveSaveTarget) =>
    act(
      "Export",
      async () => {
        const session = currentDesktopSession();
        const into =
          place && ids.length > 1
            ? (await ensureFolder(place.folder, place.name, session)).id
            : null;
        for (const id of ids) {
          const photo = latest(id);
          if (!photo) continue;
          const base = choice.useTitle ? titleOf(photo) : photo.name;
          const original =
            choice.kind === "original" ? await readUnedited(photo) : await readOriginal(photo);
          let blob = original;
          const name = `${base}.${exportExtension(photo, choice)}`;
          if (!exportedAsItIs(photo, choice)) {
            const decoded = await decodePicture(original);
            try {
              const side = choice.side || Math.max(decoded.width, decoded.height);
              const canvas = renderEdit(decoded, photo.edit ?? NO_EDIT, side);
              const made =
                choice.format === "png"
                  ? await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"))
                  : await encodeJpeg(canvas, Number.MAX_SAFE_INTEGER, [0.92]);
              if (!made) throw new Error("this browser could not encode the picture");
              blob = made;
            } finally {
              decoded.close();
            }
          }
          if (into) await uploadToDrive(into, name, blob, session);
          else if (place) await saveToDrive(place, blob);
          else if (choice.to === "download") download(blob, name);
          else {
            const folder = SPECIAL_FOLDER_IDS[choice.to as keyof typeof SPECIAL_FOLDER_IDS];
            await uploadToDrive(folder, name, blob, session);
          }
        }
      },
      { changes: false },
    );
  const printChosen = (targets: readonly LibraryPhoto[]) =>
    act(
      "Print",
      async () => {
        const made: string[] = [];
        for (const { id } of targets) {
          const photo = latest(id);
          if (!photo || isVideo(photo)) continue;
          const decoded = await decodePicture(await readOriginal(photo));
          try {
            const side = Math.max(decoded.width, decoded.height);
            const blob = await encodeJpeg(
              renderEdit(decoded, photo.edit ?? NO_EDIT, side),
              Number.MAX_SAFE_INTEGER,
              [0.92],
            );
            if (blob) made.push(URL.createObjectURL(blob));
          } finally {
            decoded.close();
          }
        }
        if (made.length === 0) return;
        printPictures(made, "Photos", () => {
          for (const url of made) URL.revokeObjectURL(url);
        });
      },
      { changes: false },
    );
  /** Edit > Duplicate: a copy with its own original, carrying what the person gave the photo. */
  const duplicate = (ids: readonly string[]) =>
    act("Duplicate", async () => {
      for (const id of ids) {
        const photo = latest(id);
        if (!photo) continue;
        const original = await readOriginal(photo);
        const copy = await importPicture(original, {
          name: `${photo.name} copy.${extensionOf(photo)}`,
          takenMs: photo.taken_ms,
          title: photo.title,
          caption: photo.caption,
          keywords: photo.keywords,
          people: photo.people,
          location: photo.location,
        });
        let added = copy;
        // What Preview saved is already the copy's own original: its edit names no other file.
        const recipe = photo.edit && withoutFile(photo.edit);
        if (recipe && !isIdentity(recipe)) {
          const decoded = await decodePicture(original);
          try {
            const thumb = await thumbnailOf(decoded, recipe);
            added = await changePhoto(copy.id, { edit: recipe, thumb });
            putThumb(thumbKey(added), thumb);
          } finally {
            decoded.close();
          }
        }
        setLatest([...photosRef.current, added]);
      }
    });
  /** Edit > Copy and Cut: the photos are named for Paste. Cut takes them out of their album only
   * when they are pasted into another. */
  const copyChosen = (cut: boolean) => {
    const ids = live_.map((photo) => photo.id);
    if (ids.length === 0) return;
    copyDriveItems(dragItems(ids));
    copiedPhotos = {
      ids,
      cut: cut && album ? { album: album.id } : null,
      files: copiedDriveItems(),
    };
    window.dispatchEvent(new Event(COPIED_EVENT));
  };
  useEffect(() => {
    const wake = () => noteUndo((n) => n + 1);
    window.addEventListener(COPIED_EVENT, wake);
    return () => window.removeEventListener(COPIED_EVENT, wake);
  }, []);
  /** Edit > Paste: into the album shown; elsewhere, as duplicates. */
  const paste = () => {
    const ids = copiedPhotos.ids.filter((id) => latest(id));
    if (ids.length === 0) return;
    const cutFrom = albumsRef.current.find((each) => each.id === copiedPhotos.cut?.album);
    if (album && cutFrom && cutFrom.id !== album.id) {
      // The Cut is spent once the move has worked, unless something else was copied meanwhile.
      const cut = copiedPhotos;
      void moveToAlbum(cutFrom, album, ids, () => {
        if (copiedPhotos !== cut) return;
        copiedPhotos = { ids: [], cut: null };
        window.dispatchEvent(new Event(COPIED_EVENT));
      });
    } else if (album) void addToAlbum(album, ids);
    else void duplicate(ids);
  };
  // The desktop's ticket is taken now, when the person chooses; the photo is drawn after the
  // changes queued before it (a Rotate still saving is in the picture).
  const makeDesktopPicture = (asked: LibraryPhoto) => {
    const ticket = takePictureTicket();
    return act(
      "Set Desktop Picture",
      async () => {
        setBusy("Setting the desktop picture…");
        try {
          await setDesktopPicture(latest(asked.id) ?? asked, ticket);
        } finally {
          if (live.current) setBusy(null);
        }
      },
      { changes: false },
    );
  };

  const startEdit = () => {
    if (!picture || isVideo(picture)) return;
    draftHistory.current = { past: [], future: [], at: 0 };
    setEditZoom(1);
    setComparing(null);
    // Each editor is one session: a read of an original that finishes after its session ended
    // (Cancel, Done, another photo) changes nothing, whether it succeeded or failed.
    editSession.current += 1;
    const session = editSession.current;
    setEditing(true);
    setDraft(picture.edit ?? NO_EDIT);
    setEditTab("adjust");
    setAspect("free");
    setEditSource(null);
    setEditingId(picture.id);
    const target = picture;
    // The changes queued before Edit was clicked (a Rotate still saving) finish first, and the
    // editor starts from the photo as they left it; its panes show only once the original is
    // read, so nothing is changed on an older recipe meanwhile.
    const queued = chain.current;
    (async () => {
      await queued.catch(() => {});
      if (!live.current || editSession.current !== session) return;
      const current = latest(target.id) ?? target;
      setDraft(current.edit ?? NO_EDIT);
      const decoded = await decodePicture(await readOriginal(current));
      try {
        const copy = renderEdit(decoded, NO_EDIT, EDIT_SIDE);
        if (live.current && editSession.current === session) {
          setEditSource({ image: copy, width: copy.width, height: copy.height });
        }
      } finally {
        decoded.close();
      }
    })().catch((error) => {
      console.warn(`Photos could not open the original for editing (${error})`);
      if (!live.current || editSession.current !== session) return;
      stopEdit();
      setNotice("The original of this photo could not be read, so it cannot be edited.");
    });
  };
  /** Done, then `next` once the edit is kept. */
  const finishEdit = (next?: () => void) => {
    if (!picture || !editSource || editingId !== picture.id) return;
    const target = picture.id;
    const copy = editSource;
    const recipe = draft;
    const session = editSession.current;
    void act("Saving the edit", async () => {
      setBusy("Saving…");
      try {
        if (isIdentity(recipe)) {
          replace(await changePhoto(target, { edit: null }));
        } else {
          const thumb = await thumbnailOf({ ...copy, close: () => {} }, recipe);
          const updated = await changePhoto(target, { edit: recipe, thumb });
          putThumb(thumbKey(updated), thumb);
          replace(updated);
        }
        if (editSession.current === session) {
          stopEdit();
          next?.();
        }
      } finally {
        if (live.current) setBusy(null);
      }
    });
  };
  const revert = () => {
    if (!picture) return;
    const target = picture.id;
    const session = editSession.current;
    void act("Revert to Original", async () => {
      replace(await changePhoto(target, { edit: null }));
      if (editSession.current === session) {
        setDraft(NO_EDIT);
        stopEdit();
      }
    });
  };

  /** A change to the draft, kept for Undo in the editor; a slider's run of changes is one step. */
  const changeDraft = (next: Edit | ((old: Edit) => Edit)) => {
    const history = draftHistory.current;
    const moment = Date.now();
    if (moment - history.at > 500) history.past.push(draft);
    history.at = moment;
    history.future = [];
    setDraft(next);
  };
  const stepDraft = (from: "past" | "future") => {
    const history = draftHistory.current;
    const to = from === "past" ? history.future : history.past;
    const earlier = history[from].pop();
    if (!earlier) return;
    to.push(draft);
    history.at = 0;
    setDraft(earlier);
  };
  /** The keys of the editor; Command-R and the rest act on the draft, not the saved photo. */
  const onEditorKey = (event: KeyboardEvent<HTMLElement>) => {
    const inControl = (event.target as HTMLElement).closest("input, textarea, [role='slider']");
    const typing = (event.target as HTMLElement).closest("input:not([type='range']), textarea");
    const command = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    // A slider just moved keeps the focus, so Undo, Redo and Cancel still work from it; a field
    // keeps its own text undo, and every other key is the control's.
    if (inControl) {
      if (event.key === "Escape") {
        stopEdit();
        return true;
      }
      if (typing || !command || key !== "z") return false;
    }
    const tabs: Record<string, EditTab> = { a: "adjust", f: "filters", c: "crop" };
    const byNumber: Record<string, EditTab> = { "1": "adjust", "2": "filters", "3": "crop" };
    const tab = tabs[key];
    const numbered = byNumber[key];
    if (!command && key === "z") setEditZoom((now) => (now > 1 ? 1 : 2));
    else if (!command && tab) setEditTab(tab);
    else if (command && numbered) setEditTab(numbered);
    else if (key === "m" && event.ctrlKey && !event.metaKey) setComparing("everything");
    else if (key === "m" && !command) setComparing("adjustments");
    else if (command && !event.shiftKey && key === "z") stepDraft("past");
    else if (command && event.shiftKey && key === "z") stepDraft("future");
    else if (command && event.altKey && event.code === "KeyR") {
      changeDraft(turnLeft(turnLeft(turnLeft(draft))));
    } else if (command && key === "r") {
      changeDraft(turnLeft(draft));
    } else if (command && key === "e" && editSource) {
      const sample = renderEdit(editSource, NO_EDIT, 256);
      const pixels = sample.getContext("2d")?.getImageData(0, 0, sample.width, sample.height);
      if (pixels) changeDraft({ ...draft, adjust: autoAdjust(pixels) });
    } else if (event.key === "Enter") {
      // Return on a button is the button's.
      if ((event.target as HTMLElement).closest("button, a, [role='button'], [role='menuitem']")) {
        return false;
      }
      finishEdit();
    } else if (event.key === "Escape") stopEdit();
    else return false;
    return true;
  };

  /**
   * The window's keys, wherever the focus is in it (the grid, the open photo, a toolbar button
   * just clicked), except in an element whose keys are its own (`OWN_KEYS`); popovers and menus
   * rendered elsewhere reach here through React too, and are left alone the same way. The arrow
   * keys step through the photos only from the content pane, so they never fight the toolbar's.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (editing) {
      if (onEditorKey(event)) event.preventDefault();
      return;
    }
    const target = event.target as HTMLElement;
    const own = target.closest(OWN_KEYS);
    // The keys the menu bar shows for Photos' items (it only labels them): Command or Control.
    const command = event.metaKey || event.ctrlKey;
    // An element holding the whole window (the desktop's frame) does not count, and the sidebar's
    // list only keeps its plain keys.
    if (own && !own.contains(event.currentTarget) && !(command && own.matches("[role='tree']"))) {
      return;
    }
    const inPane = target.closest(".mac-photos-pane") !== null;
    const key = event.key.toLowerCase();
    // Control-1 to 7, as Apple's table has them.
    const sources: readonly ServedSource[] = [
      "library",
      "memories",
      "favorites",
      "people",
      "places",
      "recents",
      "imports",
    ];
    const views: readonly LibraryView[] = ["years", "months", "days", "all"];
    const button = target.closest("button") !== null && !target.closest("[data-photo-id]");
    if (event.ctrlKey && !event.metaKey && /^[1-7]$/.test(event.key)) {
      const row = sources[Number(event.key) - 1];
      if (row) choose(row);
    } else if (event.metaKey && !event.shiftKey && !event.altKey && /^[1-4]$/.test(event.key)) {
      const next = views[Number(event.key) - 1];
      if (next) showView(next);
    } else if (viewing && inPane && event.key === "ArrowLeft") step(-1);
    else if (viewing && inPane && event.key === "ArrowRight") step(1);
    else if (viewing && event.key === "Escape") close();
    else if (viewing && command && event.key === "ArrowUp") close();
    else if (viewing && !button && event.key === " " && !command) close();
    else if (!viewing && !button && event.key === " " && !command && current.length > 0) {
      const first = current[0];
      if (first) open(first.id);
    } else if (viewing && !command && key === "z") {
      setViewerPan({ x: 0, y: 0 });
      setViewerScale((old) => (old === 1 ? actualScale() : 1));
    } else if (event.key === "Enter" && !command && !button) showEditTools();
    else if (viewing && !command && !event.altKey && key === "f") {
      showStage(false);
    } else if (event.altKey && !command && event.code === "KeyS") setStrip((old) => !old);
    else if (!viewing && event.key === "Escape" && selection.length > 0) setSelection([]);
    else if ((event.key === "Delete" || event.key === "Backspace") && current.length > 0) {
      if (inDeleted) return;
      if (album && !command) {
        void removeFromAlbum(
          album,
          current.map((photo) => photo.id),
        );
        if (viewing) close();
      } else askDelete(current);
    } else if (command && !event.shiftKey && key === "a" && !viewing) selectAll();
    else if (command && event.shiftKey && key === "a" && !viewing) setSelection([]);
    else if (command && !event.shiftKey && !event.altKey && key === "r" && rotatable) void rotate();
    else if (command && event.altKey && event.code === "KeyR" && rotatable) void rotate(3);
    else if (command && !event.shiftKey && key === "e" && live_.length > 0) void enhance(live_);
    else if (command && !event.shiftKey && key === ",") onPreferencesOpenChange?.(true);
    else if (command && !event.shiftKey && key === "i") setInfoOpen((open) => !open);
    else if (command && event.shiftKey && key === "i" && ready && busy === null)
      reviewInput.current?.click();
    else if (command && !event.shiftKey && key === "l" && current.length > 0) toggleHidden();
    else if (command && !event.shiftKey && key === "k") setKeywordsOpen((open) => !open);
    else if (command && event.shiftKey && key === "k" && album && one) {
      void setKeyPhoto(album, one.id);
    } else if (command && !event.shiftKey && !event.altKey && key === "n") setNewAlbumOpen(true);
    else if (command && event.altKey && !event.shiftKey && event.code === "KeyN") {
      setSheet({ kind: "smart", album: null });
    } else if (command && event.shiftKey && key === "n") askNewFolder();
    else if (command && event.shiftKey && key === "t") setShowTitles((old) => !old);
    else if (command && event.shiftKey && key === "e" && live_.length > 0) askExport("edited");
    else if (command && !event.shiftKey && key === "p" && live_.length > 0) void printChosen(live_);
    else if (command && !event.shiftKey && key === "d" && live_.length > 0) {
      void duplicate(live_.map((photo) => photo.id));
    } else if (command && !event.shiftKey && key === "f") {
      event.currentTarget.querySelector<HTMLElement>(".mac-photos-search input")?.focus();
    } else if (command && !event.shiftKey && key === "z") undo();
    else if (command && event.shiftKey && key === "z") redo();
    else if (command && !event.shiftKey && key === "c") copyChosen(false);
    else if (command && !event.shiftKey && key === "x") copyChosen(true);
    else if (command && !event.shiftKey && key === "v") {
      // With none of its own photos copied, or files copied since in Finder, the key stays the
      // browser's: its paste event brings them, or a picture copied elsewhere (`onPaste`).
      const others = copiedDriveItems();
      if (
        (others.length > 0 && others !== copiedPhotos.files) ||
        !copiedPhotos.ids.some((id) => latest(id))
      ) {
        return;
      }
      paste();
    } else if (command && (event.key === "=" || event.key === "+")) zoomBy(1);
    else if (command && event.key === "-") zoomBy(-1);
    else if (command && event.altKey && event.code === "KeyS") setSidebarShown((old) => !old);
    else if (!command && !event.altKey && event.key === "." && live_.length > 0) toggleFavorite();
    else if (
      keywordsOpen &&
      !command &&
      !event.altKey &&
      live_.length > 0 &&
      managedKeywords.some((each) => each.key === key)
    ) {
      const word = managedKeywords.find((each) => each.key === key);
      if (word) toggleKeyword(word.name);
    } else return;
    event.preventDefault();
  };

  /** The scale at which the open photo's pixels are the screen's: Z's 100 percent. */
  const actualScale = () => {
    const image = viewer.current?.querySelector<HTMLImageElement>("img");
    if (!image || image.clientWidth === 0) return 2;
    return Math.max(1.25, image.naturalWidth / image.clientWidth);
  };
  /** Command-plus and Command-minus: the open photo, else the thumbnails. */
  const zoomBy = (direction: 1 | -1) => {
    if (viewing) {
      setViewerPan({ x: 0, y: 0 });
      setViewerScale((old) =>
        Math.min(MAX_VIEWER_SCALE, Math.max(1, old * (direction > 0 ? 1.25 : 0.8))),
      );
    } else {
      setZoom((old) => Math.min(ZOOM.max, Math.max(ZOOM.min, old + direction * ZOOM.step * 2)));
    }
  };
  /** The open photo dragged while it is zoomed in. */
  const panViewer = (event: ReactPointerEvent<HTMLElement>) => {
    if (viewerScale <= 1 || event.button !== 0) return;
    const [x0, y0] = [event.clientX, event.clientY];
    const start = viewerPan;
    const move = (next: PointerEvent) =>
      setViewerPan({ x: start.x + next.clientX - x0, y: start.y + next.clientY - y0 });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /**
   * A memory's movie: its pictures at its Mood's pace, under the song its Mood names of the
   * person's Music library, as a slideshow not saved as a project.
   */
  const memoryMovie = (of: Memory): SlideshowProject => {
    const mood = memoryMoods[of.id] ?? DEFAULT_MEMORY_MOOD;
    return {
      id: of.id,
      name: of.title,
      photos: of.photos.map((photo) => photo.id),
      ...memoryMovieOf(mood),
      music: songOfMood(mood, songs),
    };
  };

  const showStage = (slideshow: boolean, from?: SlideshowProject) => {
    const list = from ? collection : current.length > 1 ? current : listed;
    const ids = list.filter((photo) => photo.deleted_ms === null).map((photo) => photo.id);
    if (ids.length === 0) return;
    setStage({
      ids,
      start: from
        ? undefined
        : (picture?.id ?? (current.length === 1 ? current[0]?.id : undefined)),
      slideshow,
      theme: from?.theme,
      seconds: from?.seconds,
      musicFile: from?.music?.file,
    });
  };

  /** A saved slideshow as a movie on the drive: recording takes as long as the show runs. */
  const exportSlideshow = (chosen: SlideshowProject, target: DriveSaveTarget) =>
    act(
      "Exporting Slideshow",
      async () => {
        const type = slideshowMovieType();
        if (!type) return;
        const movie = await recordSlideshow(collection, {
          theme: chosen.theme || "dissolve",
          seconds: chosen.seconds || 3,
          musicFile: chosen.music?.file,
          type,
        });
        await saveToDrive(target, movie);
      },
      { changes: false },
    );
  const askExport = (choice: ExportChoice["kind"]) => {
    const ids = live_.map((photo) => photo.id);
    if (ids.length > 0) setSheet({ kind: "export", ids, choice });
  };
  /** The Save dialog's name: one photo's file, whose extension follows the kind chosen, or a folder. */
  const exportPanelNames = (ids: readonly string[], choice: ExportChoice) => {
    const photo = ids.length === 1 && ids[0] ? latest(ids[0]) : undefined;
    if (!photo) return { defaultName: "Exported Photos" };
    const extension = exportExtension(photo, choice);
    const base = choice.useTitle ? titleOf(photo) : photo.name;
    return {
      defaultName: `${base}.${extension}`,
      nameToSave: (typed: string) => `${typed.replace(/\.[^.]+$/, "")}.${extension}`,
    };
  };
  const askNewFolder = () =>
    setSheet({
      kind: "name",
      title: "New Folder",
      action: "Create",
      initial: "Untitled Folder",
      done: (name) =>
        void act("New Folder", async () => {
          applyOrganised(await createFolder(name, null));
        }),
    });
  const askNewSlideshow = () => {
    const ids = (current.length > 0 ? current : listed).map((photo) => photo.id).slice(0, 500);
    setSheet({
      kind: "name",
      title: "Create Slideshow",
      action: "OK",
      initial: "Untitled Slideshow",
      done: (name) =>
        void act("Create Slideshow", async () => {
          const id = crypto.randomUUID();
          applyOrganised(
            await putProject({ id, name, photos: ids, theme: "dissolve", seconds: 3 }),
          );
          choose(`project:${id}`);
        }),
    });
  };
  const toggleKeyword = (word: string) => {
    const ids = live_.map((photo) => photo.id);
    // Decided when the change runs, from the photos as the change before it left them.
    let has: boolean | undefined;
    void changeMany("Keyword", ids, () => {
      if (has === undefined) {
        const now = ids.map(latest).filter((photo) => photo !== undefined);
        has = now.every((photo) =>
          photo.keywords.some((each) => each.toLowerCase() === word.toLowerCase()),
        );
      }
      return has ? { remove_keywords: [word] } : { add_keywords: [word] };
    });
  };
  const setKeyPhoto = (target: LibraryAlbum, id: string) =>
    act("Make Key Photo", async () => {
      setAlbums(await changeAlbum(target.id, { key_photo: id }));
    });
  /** A copy of the photo, opened in Preview: what Preview saves of it comes back as the photo's edit. */
  const editWithPreview = (photo: LibraryPhoto) =>
    act(
      "Edit With",
      async () => {
        const copy = await copyForPreview(photo, `${titleOf(photo)}.${extensionOf(photo)}`);
        openFile({ id: copy.id, name: copy.name, type: copy.type ?? photo.mime }, "preview");
      },
      { changes: false },
    );
  /** A new album with the same photos, order and folder. */
  const duplicateAlbum = (original: LibraryAlbum) =>
    act("Duplicate Album", async () => {
      const id = crypto.randomUUID();
      await createAlbum(`${original.name} copy`, id);
      setAlbums(
        await changeAlbum(id, {
          add: [...original.photos],
          sort: original.sort,
          ...(original.sort === "custom" ? { order: [...original.photos] } : {}),
          ...(original.folder ? { folder: original.folder } : {}),
          ...(original.key_photo ? { key_photo: original.key_photo } : {}),
        }),
      );
    });
  /** Adjust Date and Time: the first photo gets the date, the others move by as much. */
  const adjustDate = (ids: readonly string[], when: number) => {
    // Worked out when the change runs, from the date the change before it left.
    let by: number | undefined;
    void changeMany("Adjust Date and Time", ids, (photo) => {
      if (by === undefined) {
        const first = ids[0] ? latest(ids[0]) : undefined;
        by = when - (first ?? photo).taken_ms;
      }
      return { taken_ms: photo.taken_ms + by };
    });
  };
  /** Location copied by Image > Location > Copy Location, in this window. */
  const copiedLocation = useRef<PhotoLocation | null>(null);
  /** Image > Location > Revert: each photo goes back to where its own file says it was taken, or to no place. */
  const revertLocation = async (ids: readonly string[]) => {
    const places = new Map<string, PhotoLocation | null>();
    try {
      for (const id of ids) {
        const photo = latest(id);
        if (!photo) continue;
        const facts =
          photo.mime === "image/jpeg"
            ? readExif(new Uint8Array(await (await readUnedited(photo)).arrayBuffer()))
            : {};
        places.set(id, facts.location ?? null);
      }
    } catch (error) {
      setNotice(
        `The original could not be read (${error instanceof Error ? error.message : error}).`,
      );
      return;
    }
    await changeMany("Revert Location", ids, (photo) => ({
      location: places.get(photo.id) ?? null,
    }));
  };
  const pressedSelected = useRef<string | null>(null);

  // A right click acts on the photo under the pointer: select it first unless it is selected.
  const photoUnder = (event: MouseEvent<HTMLElement>) => {
    const element = event.target as HTMLElement;
    const tile = element.closest<HTMLElement>("[data-photo-id]");
    const item = element.closest<HTMLElement>(".mac-photos-grid [data-index]");
    return tile?.dataset.photoId ?? listed[Number(item?.dataset.index ?? -1)]?.id;
  };
  const onContextMenuCapture = (event: MouseEvent<HTMLElement>) => {
    setMemoryUnder(
      (event.target as HTMLElement).closest<HTMLElement>("[data-memory]")?.dataset.memory ?? null,
    );
    const id = photoUnder(event);
    if (id && !selected.has(id) && !viewing) setSelection([id]);
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDropping(false);
    if (ready) void importFiles([...event.dataTransfer.files]);
  };

  // The latest of what a press started long ago must see: a drag asks for its items once moved.
  const dragState = useRef({ selected, current, album, collection, editing });
  dragState.current = { selected, current, album, collection, editing };
  /** The items of a drag of photos, as the desktop's drag knows files of the drive. */
  const dragItems = (ids: readonly string[]): DesktopDragItem[] =>
    ids.flatMap((id) => {
      const photo = latest(id);
      if (!photo || photo.deleted_ms !== null) return [];
      return [
        {
          id: photo.file,
          name: `${titleOf(photo)}.${extensionOf(photo)}`,
          kind: "file" as const,
          type: photo.mime,
          size: photo.bytes,
        },
      ];
    });
  // The rendered copies made or being made for sharing this session, by photo and edit: sharing
  // twice makes one, and a failed one can be tried again.
  const renderedCopies = useRef(new Map<string, Promise<DesktopDragItem>>());
  const renderCopy = async (photo: LibraryPhoto, edit: Edit): Promise<DesktopDragItem> => {
    const decoded = await decodePicture(await readOriginal(photo));
    try {
      const canvas = renderEdit(decoded, edit, Math.max(decoded.width, decoded.height));
      const blob = await encodeJpeg(canvas, Number.MAX_SAFE_INTEGER, [0.92]);
      if (!blob) throw new Error("this browser could not encode the picture");
      const name = `${titleOf(photo)}.jpg`;
      const session = currentDesktopSession();
      const folder = await picturesFolder("Shared from Photos", session);
      const file = await uploadToDrive(folder, name, blob, session);
      return { id: file, name, kind: "file", type: "image/jpeg", size: blob.size };
    } finally {
      decoded.close();
    }
  };
  /**
   * What a Share row hands over: an unedited photo's original, and for an edited picture a rendered
   * JPEG in Pictures/Shared from Photos, as the original stays as it was taken.
   */
  const itemsToShare = async (ids: readonly string[]): Promise<readonly DesktopDragItem[]> => {
    try {
      setBusy("Preparing to share…");
      const made: DesktopDragItem[] = [];
      for (const id of ids) {
        const photo = latest(id);
        if (!photo || photo.deleted_ms !== null) continue;
        if (!photo.edit || isVideo(photo)) {
          made.push(...dragItems([id]));
          continue;
        }
        const key = `${id}:${photo.edited_ms ?? 0}`;
        let copy = renderedCopies.current.get(key);
        if (!copy) {
          copy = renderCopy(photo, photo.edit);
          renderedCopies.current.set(key, copy);
          copy.catch(() => renderedCopies.current.delete(key));
        }
        made.push(await copy);
      }
      return made;
    } catch (error) {
      setNotice(`The edited photo could not be prepared for sharing: ${error}.`);
      return [];
    } finally {
      setBusy(null);
    }
  };
  const photosOfDrag = (drag: DesktopDrag) =>
    drag.items.flatMap((item) => photosRef.current.find((photo) => photo.file === item.id) ?? []);

  /**
   * A press in the pane: on a photo it may become a drag of it (with the selection, when it is
   * selected), to an album's row, Finder, the desktop, the Dock's Trash or another application; on
   * the background it may become a rubber band that selects what it touches, and otherwise
   * deselects.
   */
  const onPanePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || editing || viewing || event.ctrlKey) return;
    const element = event.target as HTMLElement;
    const tile = element.closest<HTMLElement>("[data-photo-id]");
    const id = tile?.dataset.photoId;
    if (id) {
      if (inDeleted) return;
      beginDesktopDrag(event.nativeEvent, {
        from: "photos",
        icon: tile?.querySelector("img"),
        items: () => {
          const state = dragState.current;
          draggedFromAlbum = state.album?.id ?? null;
          return dragItems(state.selected.has(id) ? state.current.map((each) => each.id) : [id]);
        },
        trash: (files) => {
          const targets = photosRef.current.filter((photo) => files.includes(photo.file));
          void moveToDeleted(targets);
        },
      });
      return;
    }
    if (!element.closest(".mac-photos-grid, .mac-photos-groups")) return;
    if (element.closest("button, [data-index], [role='scrollbar']")) return;
    const [x0, y0] = [event.clientX, event.clientY];
    const pane = event.currentTarget;
    const adding = event.metaKey || event.shiftKey ? [...selection] : [];
    let moved = false;
    const move = (next: PointerEvent) => {
      if (!moved && Math.hypot(next.clientX - x0, next.clientY - y0) < 4) return;
      moved = true;
      const box = {
        x: Math.min(x0, next.clientX),
        y: Math.min(y0, next.clientY),
        width: Math.abs(next.clientX - x0),
        height: Math.abs(next.clientY - y0),
      };
      setBand(box);
      const touched: string[] = [];
      for (const each of pane.querySelectorAll<HTMLElement>("[data-photo-id]")) {
        const rect = each.getBoundingClientRect();
        if (
          rect.left < box.x + box.width &&
          rect.right > box.x &&
          rect.top < box.y + box.height &&
          rect.bottom > box.y
        ) {
          touched.push(each.dataset.photoId as string);
        }
      }
      setSelection([...new Set([...adding, ...touched])]);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setBand(null);
      if (!moved) {
        setSelection(adding);
        return;
      }
      // The click that ends the band lands on the background, which would deselect.
      window.addEventListener("click", (click) => click.stopPropagation(), {
        capture: true,
        once: true,
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  /** Where a drag from the desktop or from these pictures lands in the window. */
  const landing = (hit: Element, drag: DesktopDrag) => {
    const state = dragState.current;
    if (state.editing) return undefined;
    const fromPhotos = drag.from === "photos";
    const row = hit.closest<HTMLElement>("[data-row]");
    const value = row?.dataset.row;
    if (row && value) {
      const target = value.startsWith("album:")
        ? albumOf(value as ServedSource, albums)
        : undefined;
      if (target && fromPhotos) {
        const ids = photosOfDrag(drag).map((photo) => photo.id);
        // Between albums a drag moves; with Option, and from anywhere else, it adds. The album it
        // left is the one it began in, which may be another Photos window's.
        const source = albumsRef.current.find((each) => each.id === draggedFromAlbum);
        const from = source && source.id !== target.id && !drag.copy ? source : null;
        return {
          element: row,
          copies: from === null,
          drop: () => {
            if (from) void moveToAlbum(from, target, ids);
            else void addToAlbum(target, ids);
          },
        };
      }
      if (target) {
        return {
          element: row,
          copies: true,
          drop: () => importDragged(fileItemsOfDrag(drag.items).filter(isMediaItem), target),
        };
      }
      if (fromPhotos && value === "favorites") {
        return {
          element: row,
          copies: true,
          drop: () =>
            void changeMany(
              "Favorite",
              photosOfDrag(drag).map((photo) => photo.id),
              () => ({ favorite: true }),
            ),
        };
      }
      if (fromPhotos && value === "deleted") {
        return { element: row, drop: () => void moveToDeleted(photosOfDrag(drag)) };
      }
      if (fromPhotos) {
        return {
          element: row,
          refusal: "Photos can only be dragged onto an album.",
          sayRefusal: setNotice,
          drop: () => {},
        };
      }
    }
    if (fromPhotos) {
      // Dragging within an album listed in its own order places the photos before the one under
      // the pointer.
      const pane = hit.closest<HTMLElement>(".mac-photos-pane");
      const tile = hit.closest<HTMLElement>("[data-photo-id]");
      const before = tile?.dataset.photoId;
      // Only photos dragged within the album shown: one dragged in from elsewhere is dropped on
      // the album's row.
      if (
        pane &&
        tile &&
        state.album?.sort === "custom" &&
        before &&
        fromPhotos &&
        draggedFromAlbum === state.album.id
      ) {
        const target = state.album;
        const moving = photosOfDrag(drag).map((photo) => photo.id);
        if (moving.includes(before)) return undefined;
        return {
          element: tile,
          drop: () => {
            void act("Reorder", async () => {
              const held = albumsRef.current.find((each) => each.id === target.id)?.photos;
              const rest = (held ?? target.photos).filter((id) => !moving.includes(id));
              const at = rest.indexOf(before);
              const order =
                at < 0
                  ? [...rest, ...moving]
                  : [...rest.slice(0, at), ...moving, ...rest.slice(at)];
              setAlbums(await changeAlbum(target.id, { order }));
            });
          },
        };
      }
      return undefined;
    }
    const pane = hit.closest<HTMLElement>(".mac-photos-body");
    if (!pane) return undefined;
    const taken = fileItemsOfDrag(drag.items).filter(isMediaItem);
    return {
      element: hit.closest(".mac-photos-pane") ?? pane,
      copies: true,
      refusal:
        taken.length > 0
          ? undefined
          : "Photos imports pictures and movies: JPEG, PNG, GIF, WebP, MP4, MOV and WebM.",
      sayRefusal: setNotice,
      drop: () => importDragged(taken),
    };
  };
  const latestLanding = useRef(landing);
  latestLanding.current = landing;
  // Files shared with Photos (a Share menu's Add to Photos) wait for the library, then import.
  const importShared = useRef<(items: readonly DesktopDragItem[]) => void>(() => {});
  importShared.current = (items) => {
    const taken = fileItemsOfDrag(items).filter(isMediaItem);
    if (taken.length > 0) importDragged(taken);
    else setNotice("Photos imports pictures and movies: JPEG, PNG, GIF, WebP, MP4, MOV and WebM.");
  };
  useEffect(() => {
    if (!ready) return;
    const opened = (request: OpenFileRequest) => {
      const entry = currentDrive()?.entries.find((each) => each.id === request.id);
      importShared.current([
        {
          id: request.id,
          name: request.name,
          kind: "file",
          type: entry?.type,
          size: entry?.size,
        },
      ]);
    };
    for (const request of takeOpenFileRequests("photos")) opened(request);
    const stopOpen = onOpenFileRequest("photos", opened);
    for (const shared of takeSharedFiles("photos")) importShared.current(shared.items);
    const stopShared = onSharedFiles("photos", (shared) => importShared.current(shared.items));
    return () => {
      stopOpen();
      stopShared();
    };
  }, [ready]);
  const [frame, setFrame] = useState<HTMLElement | null>(null);
  // The full-screen viewer held the keyboard and is gone: it goes back to what the keys act on.
  const staged = stage !== null;
  const wasStaged = useRef(false);
  useEffect(() => {
    if (wasStaged.current && !staged) (viewer.current ?? frame)?.focus({ preventScroll: true });
    wasStaged.current = staged;
  }, [staged, frame]);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!frame) return;
    return registerDropTarget({
      element: frame,
      landing: (hit, drag) => latestLanding.current(hit, drag),
    });
  }, [frame]);

  // Removing the focused picture leaves focus on the page, where no window hears a key.
  useEffect(() => {
    if (!frame || document.activeElement !== document.body) return;
    const state = frame.dataset.windowState;
    if (!state || state === "key") frame.focus({ preventScroll: true });
  });

  /** A sidebar row dragged onto a folder, into My Albums, or before another row. */
  const onRowPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const element = (event.target as HTMLElement).closest<HTMLElement>("[data-row]");
    const value = element?.dataset.row;
    if (!value || !/^(album|folder|smart):/.test(value)) return;
    const [x0, y0] = [event.clientX, event.clientY];
    let moved = false;
    let marked: Element | null = null;
    const mark = (next: Element | null) => {
      marked?.removeAttribute("data-drop-target");
      next?.setAttribute("data-drop-target", "");
      marked = next;
    };
    const under = (next: PointerEvent) =>
      document.elementFromPoint(next.clientX, next.clientY)?.closest<HTMLElement>("[data-row]");
    const move = (next: PointerEvent) => {
      if (!moved && Math.hypot(next.clientX - x0, next.clientY - y0) < 6) return;
      moved = true;
      const row = under(next);
      mark(
        row && row !== element && /^(album|folder|albums)/.test(row.dataset.row ?? "") ? row : null,
      );
    };
    const up = (next: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      mark(null);
      if (!moved) return;
      const onto = under(next)?.dataset.row;
      if (!onto || onto === value) return;
      const id = value.slice(value.indexOf(":") + 1);
      const kind = value.slice(0, value.indexOf(":"));
      const moveTo = (folder: string | null) =>
        void act("Move to Folder", async () => {
          if (kind === "album") setAlbums(await changeAlbum(id, { folder }));
          else if (kind === "folder") applyOrganised(await changeFolder(id, { parent: folder }));
          else {
            const smart = smartAlbums.find((each) => each.id === id);
            if (smart) applyOrganised(await putSmartAlbum({ ...smart, folder }));
          }
        });
      if (onto.startsWith("folder:")) moveTo(onto.slice("folder:".length));
      else if (onto === "albums") moveTo(null);
      else if (onto.startsWith("album:") && kind === "album") {
        const before = onto.slice("album:".length);
        const folder = albums.find((each) => each.id === before)?.folder ?? null;
        void act("Move Album", async () => {
          setAlbums(await changeAlbum(id, { before, folder }));
        });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // The row a right click in the sidebar is on: what its menu acts on.
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  // Edit asked for from the selection: the editor opens once the photo has.
  const [pendingEdit, setPendingEdit] = useState(false);
  /** Image > Show Edit Tools and Return: the editor on the open photo, or on the one selected. */
  function showEditTools() {
    const target = viewing ? picture : one;
    if (!target || inDeleted || target.deleted_ms !== null || isVideo(target)) return;
    if (viewing) startEdit();
    else {
      open(target.id);
      setPendingEdit(true);
    }
  }
  const latestStart = useRef(startEdit);
  latestStart.current = startEdit;
  useEffect(() => {
    if (!pendingEdit || !viewing) return;
    setPendingEdit(false);
    latestStart.current();
  }, [pendingEdit, viewing]);
  const keywordList = useMemo(
    () => allKeywords(photos, managedKeywords),
    [photos, managedKeywords],
  );
  const filterChoices = useMemo<readonly { id: ServedFilter; title: string; empty: string }[]>(
    () => [
      ...SERVED_FILTERS,
      ...keywordList.map((word) => ({
        id: `keyword:${word}` as const,
        title: word,
        empty: `No Photos with the keyword “${word}”`,
      })),
    ],
    [keywordList],
  );

  const renderThumbnail = useCallback(
    (index: number) => {
      const photo = listed[index];
      if (!photo) return null;
      const box = square ? { width: size, height: size } : fittedBox(photo, size);
      const url = urls.get(thumbKey(photo));
      return (
        <span
          className="mac-photos-thumbnail"
          data-photo-id={photo.id}
          data-selected={selected.has(photo.id) ? "" : undefined}
          data-square={square ? "" : undefined}
          style={box}
        >
          {url ? (
            <img src={url} alt="" width={box.width} height={box.height} draggable={false} />
          ) : null}
          {photo.favorite ? <FavoriteBadge /> : null}
          {photo.duration_ms !== null ? (
            <span className="mac-photos-duration">{durationText(photo.duration_ms)}</span>
          ) : null}
          {inDeleted ? (
            <span className="mac-photos-days-left">{`${daysLeft(photo, now, keepDays)} days`}</span>
          ) : null}
          {showKeywords && photo.keywords.length > 0 ? (
            <span className="mac-photos-grid-keywords">{photo.keywords.join(", ")}</span>
          ) : null}
        </span>
      );
    },
    [listed, size, urls, selected, inDeleted, now, keepDays, square, showKeywords],
  );

  const one = current.length === 1 ? current[0] : undefined;
  // A movie has no picture to put on the desktop.
  const stillOne = one && !isVideo(one) ? one : undefined;
  const live_ = current.filter((photo) => photo.deleted_ms === null);
  // A movie plays as it was made: an edit is for pictures.
  const rotatable = live_.some((photo) => !isVideo(photo));
  const fav = allFavorite ? "Unfavorite" : "Favorite";
  const memoryFavorites = memoryMarks.favorites;
  const markMemory = (
    what: string,
    id: string,
    change: Parameters<typeof changeMemory>[1],
    after?: () => void,
  ) =>
    void act(what, async () => {
      applyOrganised(await changeMemory(id, change));
      after?.();
    });
  const toggleMemoryFavorite = (id: string) => {
    const favorite = !memoryFavorites.includes(id);
    markMemory(favorite ? "Add to Favorite Memories" : "Remove from Favorite Memories", id, {
      favorite,
    });
  };
  const askDeleteMemory = (id: string) =>
    setQuestion({
      message: "Are you sure you want to delete this memory?",
      informative: "The photos in it stay in your library.",
      action: "Delete",
      run: () => markMemory("Delete Memory", id, { deleted: true }),
    });
  const memoryMenu = (id: string) => (
    <ContextualMenuPopup>
      <MenuItem onClick={() => toggleMemoryFavorite(id)}>
        {memoryFavorites.includes(id)
          ? "Remove from Favorite Memories"
          : "Add to Favorite Memories"}
      </MenuItem>
      <MenuItem onClick={() => askDeleteMemory(id)}>Delete Memory</MenuItem>
    </ContextualMenuPopup>
  );
  const allHidden = current.length > 0 && current.every((photo) => photo.hidden);
  const hideLabel = `${allHidden ? "Unhide" : "Hide"} ${photoCount(Math.max(current.length, 1))}`;
  const menu = (
    <ContextualMenuPopup>
      {viewing ? null : (
        <MenuItem disabled={current.length !== 1} onClick={() => one && open(one.id)}>
          Open
        </MenuItem>
      )}
      {inDeleted ? (
        <>
          <MenuItem disabled={current.length === 0} onClick={() => void recover(current)}>
            Recover
          </MenuItem>
          <MenuItem disabled={current.length === 0} onClick={() => void deleteNow(current)}>
            Delete Immediately
          </MenuItem>
        </>
      ) : (
        <>
          <MenuItem disabled={live_.length === 0} onClick={() => setInfoOpen(true)}>
            Get Info
          </MenuItem>
          <MenuItem disabled={live_.length === 0} onClick={toggleFavorite}>
            {fav}
          </MenuItem>
          <MenuItem disabled={!rotatable} onClick={() => void rotate()}>
            Rotate Left
          </MenuItem>
          <MenuItem disabled={!rotatable} onClick={() => void rotate(3)}>
            Rotate Right
          </MenuItem>
          <MenuItem
            disabled={!one || isVideo(one)}
            onClick={() => {
              if (!one) return;
              open(one.id);
              setPendingEdit(true);
            }}
          >
            Edit
          </MenuItem>
          <MenuItem
            disabled={!current.some((photo) => photo.edit !== null)}
            onClick={() => void revertChosen(current)}
          >
            Revert to Original
          </MenuItem>
          <MenuSeparator />
          <MenuItem disabled={live_.length === 0} onClick={() => copyChosen(false)}>
            Copy
          </MenuItem>
          <MenuItem
            disabled={live_.length === 0}
            onClick={() => void duplicate(live_.map((photo) => photo.id))}
          >
            Duplicate
          </MenuItem>
          <MenuItem disabled={current.length === 0} onClick={toggleHidden}>
            {hideLabel}
          </MenuItem>
          <MenuSeparator />
          <MenuItem disabled={live_.length === 0} onClick={() => askExport("edited")}>
            Export…
          </MenuItem>
          <MenuItem disabled={live_.length === 0} onClick={() => askExport("original")}>
            Export Unmodified Original…
          </MenuItem>
          <MenuItem
            disabled={!stillOne}
            onClick={() => stillOne && void makeDesktopPicture(stillOne)}
          >
            Set Desktop Picture
          </MenuItem>
          <MenuItem
            disabled={live_.length === 0}
            onClick={() =>
              setSheet({
                kind: "date",
                ids: live_.map((photo) => photo.id),
              })
            }
          >
            Adjust Date and Time…
          </MenuItem>
          <MenuItem disabled={live_.length === 0} onClick={() => setInfoOpen(true)}>
            Assign a Location…
          </MenuItem>
          <Submenu>
            <SubmenuTrigger disabled={!stillOne}>Edit With</SubmenuTrigger>
            <SubmenuPopup>
              <MenuItem onClick={() => stillOne && editWithPreview(stillOne)}>Preview</MenuItem>
            </SubmenuPopup>
          </Submenu>
          <Submenu>
            <SubmenuTrigger disabled={live_.length === 0}>Share</SubmenuTrigger>
            <SubmenuPopup>
              <FileShareItems
                items={dragItems(live_.map((photo) => photo.id))}
                from="photos"
                prepare={() => itemsToShare(live_.map((photo) => photo.id))}
              />
            </SubmenuPopup>
          </Submenu>
          {albums.length > (album ? 1 : 0) || live_.length > 0 ? <MenuSeparator /> : null}
          <Submenu>
            <SubmenuTrigger disabled={live_.length === 0}>Add to</SubmenuTrigger>
            <SubmenuPopup>
              <MenuItem onClick={() => setNewAlbumOpen(true)}>New Album</MenuItem>
              {albums.some((each) => each.id !== album?.id) ? <MenuSeparator /> : null}
              {albums
                .filter((each) => each.id !== album?.id)
                .map((each) => (
                  <MenuItem
                    key={each.id}
                    onClick={() =>
                      void addToAlbum(
                        each,
                        live_.map((photo) => photo.id),
                      )
                    }
                  >
                    {each.name}
                  </MenuItem>
                ))}
            </SubmenuPopup>
          </Submenu>
          {album && albums.length > 1 ? (
            <Submenu>
              <SubmenuTrigger disabled={live_.length === 0}>Move to</SubmenuTrigger>
              <SubmenuPopup>
                {albums
                  .filter((each) => each.id !== album.id)
                  .map((each) => (
                    <MenuItem
                      key={each.id}
                      onClick={() =>
                        void moveToAlbum(
                          album,
                          each,
                          live_.map((photo) => photo.id),
                        )
                      }
                    >
                      {each.name}
                    </MenuItem>
                  ))}
              </SubmenuPopup>
            </Submenu>
          ) : null}
          {album ? (
            <MenuItem
              disabled={current.length === 0}
              onClick={() =>
                void removeFromAlbum(
                  album,
                  current.map((photo) => photo.id),
                )
              }
            >
              Remove from Album
            </MenuItem>
          ) : null}
          {album ? (
            <MenuItem disabled={!one} onClick={() => one && void setKeyPhoto(album, one.id)}>
              Make Key Photo
            </MenuItem>
          ) : null}
          <MenuSeparator />
          <MenuItem disabled={live_.length === 0} onClick={() => void askDelete(live_)}>
            {live_.length > 1 ? `Delete ${photoCount(live_.length)}` : "Delete Photo"}
          </MenuItem>
        </>
      )}
    </ContextualMenuPopup>
  );

  // The menu bar's File, Edit, Image and View menus while this window is in front, above the
  // desktop's own rows. A key shown here is handled by the window (onKeyDown): the menu bar only
  // labels it.
  const deleteLabel = live_.length > 1 ? `Delete ${photoCount(live_.length)}` : "Delete Photo";
  const noneChosen = live_.length === 0 || editing;
  const liveIds = live_.map((photo) => photo.id);
  useDesktopAppMenu(
    "photos",
    "File",
    <>
      <MenuItem
        keyEquivalent="shift+command+i"
        disabled={!ready || busy !== null || editing}
        onClick={() => reviewInput.current?.click()}
      >
        Import…
      </MenuItem>
      <MenuItem
        keyEquivalent="command+n"
        disabled={!ready || editing}
        onClick={() => setNewAlbumOpen(true)}
      >
        {live_.length > 0 ? "New Album with Selection" : "New Album"}
      </MenuItem>
      <MenuItem
        keyEquivalent="option+command+n"
        disabled={!ready || editing}
        onClick={() => setSheet({ kind: "smart", album: null })}
      >
        New Smart Album…
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+n" disabled={!ready || editing} onClick={askNewFolder}>
        New Folder
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={!ready || editing}>Create</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem disabled={listed.length === 0} onClick={askNewSlideshow}>
            Slideshow…
          </MenuItem>
          {["Book", "Card", "Calendar", "Prints"].map((project) => (
            <MenuItem
              key={project}
              disabled
              title={PRINT_PROJECT_REASON}
              data-reason={PRINT_PROJECT_REASON}
            >
              {project}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="shift+command+e"
        disabled={noneChosen}
        onClick={() => askExport("edited")}
      >
        Export…
      </MenuItem>
      <MenuItem disabled={noneChosen} onClick={() => askExport("original")}>
        Export Unmodified Original…
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={noneChosen}>Share</SubmenuTrigger>
        <SubmenuPopup>
          <FileShareItems
            items={dragItems(liveIds)}
            from="photos"
            prepare={() => itemsToShare(liveIds)}
          />
        </SubmenuPopup>
      </Submenu>
      <MenuItem
        keyEquivalent="command+p"
        disabled={noneChosen}
        onClick={() => void printChosen(live_)}
      >
        Print…
      </MenuItem>
    </>,
    inside,
  );
  useDesktopAppMenu(
    "photos",
    "Edit",
    <>
      <MenuItem
        keyEquivalent="command+z"
        disabled={editing ? draftHistory.current.past.length === 0 : undoSteps.current.length === 0}
        onClick={() => (editing ? stepDraft("past") : undo())}
      >
        {!editing && undoSteps.current.at(-1) ? `Undo ${undoSteps.current.at(-1)?.label}` : "Undo"}
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+z"
        disabled={
          editing ? draftHistory.current.future.length === 0 : redoSteps.current.length === 0
        }
        onClick={() => (editing ? stepDraft("future") : redo())}
      >
        {!editing && redoSteps.current.at(-1) ? `Redo ${redoSteps.current.at(-1)?.label}` : "Redo"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+x"
        disabled={!album || noneChosen}
        onClick={() => copyChosen(true)}
      >
        Cut
      </MenuItem>
      <MenuItem keyEquivalent="command+c" disabled={noneChosen} onClick={() => copyChosen(false)}>
        Copy
      </MenuItem>
      <MenuItem
        keyEquivalent="command+v"
        disabled={copiedPhotos.ids.length === 0 || editing}
        onClick={paste}
      >
        Paste
      </MenuItem>
      <MenuItem
        keyEquivalent="command+d"
        disabled={noneChosen}
        onClick={() => void duplicate(liveIds)}
      >
        {`Duplicate ${photoCount(Math.max(live_.length, 1))}`}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+a"
        disabled={viewing || editing || shownIds.length === 0}
        onClick={selectAll}
      >
        Select All
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+a"
        disabled={viewing || editing || selection.length === 0}
        onClick={() => setSelection([])}
      >
        Deselect All
      </MenuItem>
      <MenuItem
        keyEquivalent="command+f"
        disabled={editing}
        onClick={() => frame?.querySelector<HTMLElement>(".mac-photos-search input")?.focus()}
      >
        Find
      </MenuItem>
      <MenuSeparator />
      {inDeleted ? (
        <>
          <MenuItem
            disabled={current.length === 0 || editing}
            onClick={() => void recover(current)}
          >
            Recover
          </MenuItem>
          <MenuItem
            disabled={current.length === 0 || editing}
            onClick={() => void deleteNow(current)}
          >
            Delete Immediately
          </MenuItem>
        </>
      ) : (
        <MenuItem
          keyEquivalent="command+delete"
          disabled={noneChosen}
          onClick={() => void askDelete(live_)}
        >
          {deleteLabel}
        </MenuItem>
      )}
    </>,
    inside,
  );
  const editable = picture ?? one;
  useDesktopAppMenu(
    "photos",
    "Image",
    <>
      <MenuItem
        keyEquivalent="return"
        disabled={editing || inDeleted || !editable || isVideo(editable)}
        onClick={showEditTools}
      >
        Show Edit Tools
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+r"
        disabled={!rotatable || editing}
        onClick={() => void rotate()}
      >
        Rotate Left
      </MenuItem>
      <MenuItem
        keyEquivalent="option+command+r"
        disabled={!rotatable || editing}
        onClick={() => void rotate(3)}
      >
        Rotate Right
      </MenuItem>
      <MenuItem keyEquivalent="command+e" disabled={noneChosen} onClick={() => void enhance(live_)}>
        Enhance
      </MenuItem>
      <MenuItem keyEquivalent="." disabled={noneChosen} onClick={toggleFavorite}>
        {fav}
      </MenuItem>
      <MenuItem
        disabled={
          editing ? !picture?.edit : inDeleted || !current.some((photo) => photo.edit !== null)
        }
        onClick={() => (editing ? revert() : void revertChosen(current))}
      >
        Revert to Original
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+l"
        disabled={current.length === 0 || editing}
        onClick={toggleHidden}
      >
        {hideLabel}
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+k"
        disabled={!album || !one || editing}
        onClick={() => album && one && void setKeyPhoto(album, one.id)}
      >
        Make Key Photo
      </MenuItem>
      <MenuItem disabled={noneChosen} onClick={() => setSheet({ kind: "date", ids: liveIds })}>
        Adjust Date and Time…
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={!stillOne}>Edit With</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem onClick={() => stillOne && editWithPreview(stillOne)}>Preview</MenuItem>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={noneChosen}>Location</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem onClick={() => setInfoOpen(true)}>Assign a Location…</MenuItem>
          <MenuItem
            disabled={!live_.some((photo) => photo.location)}
            onClick={() => void changeMany("Remove Location", liveIds, () => ({ location: null }))}
          >
            Remove Location
          </MenuItem>
          <MenuItem
            disabled={!one?.location}
            onClick={() => {
              copiedLocation.current = one?.location ?? null;
            }}
          >
            Copy Location
          </MenuItem>
          <MenuItem
            onClick={() => {
              const place = copiedLocation.current;
              if (place) void changeMany("Paste Location", liveIds, () => ({ location: place }));
            }}
          >
            Paste Location
          </MenuItem>
          <MenuItem onClick={() => void revertLocation(liveIds)}>
            Revert to Original Location
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuItem
        disabled={!stillOne || inDeleted}
        onClick={() => stillOne && void makeDesktopPicture(stillOne)}
      >
        Set Desktop Picture
      </MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+i" disabled={editing} onClick={() => setInfoOpen(true)}>
        Get Info
      </MenuItem>
    </>,
    inside,
  );
  useDesktopAppMenu(
    "photos",
    "View",
    <>
      {LIBRARY_VIEWS.map((each, at) => (
        <MenuItem
          key={each.id}
          keyEquivalent={`command+${at + 1}`}
          disabled={editing}
          onClick={() => showView(each.id)}
        >
          {each.name}
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem
        keyEquivalent="option+command+s"
        disabled={editing}
        onClick={() => setSidebarShown((old) => !old)}
      >
        {sidebarShown ? "Hide Sidebar" : "Show Sidebar"}
      </MenuItem>
      <MenuItem onClick={() => setSquare((old) => !old)} disabled={editing}>
        {square ? "Aspect Thumbnails" : "Square Thumbnails"}
      </MenuItem>
      <Submenu>
        <SubmenuTrigger>Metadata</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem keyEquivalent="shift+command+t" onClick={() => setShowTitles((old) => !old)}>
            {showTitles ? "Hide Titles" : "Show Titles"}
          </MenuItem>
          <MenuItem onClick={() => setShowKeywords((old) => !old)}>
            {showKeywords ? "Hide Keywords" : "Show Keywords"}
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={inDeleted || editing}>Filter</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup
            value={filter}
            onValueChange={(value) => setFilter(value as ServedFilter)}
          >
            {filterChoices.map((each) => (
              <MenuRadioItem key={each.id} value={each.id}>
                {each.title}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger disabled={!album || editing}>Sort</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup
            value={album?.sort ?? "custom"}
            onValueChange={(value) => album && void sortAlbum(album, value as AlbumSort)}
          >
            {ALBUM_SORTS.map((each) => (
              <MenuRadioItem key={each.id} value={each.id}>
                {each.id === "custom" ? each.title : `Keep Sorted By ${each.title}`}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem disabled={editing || !ready} onClick={() => setSheet({ kind: "toolbar" })}>
        Customize Toolbar…
      </MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => setShowHidden((old) => !old)} disabled={editing}>
        {showHidden ? "Hide Hidden Photo Album" : "Show Hidden Photo Album"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+="
        disabled={editing || (!viewing && zoom >= ZOOM.max)}
        onClick={() => zoomBy(1)}
      >
        Zoom In
      </MenuItem>
      <MenuItem
        keyEquivalent="command+-"
        disabled={editing || (!viewing && zoom <= ZOOM.min)}
        onClick={() => zoomBy(-1)}
      >
        Zoom Out
      </MenuItem>
      <MenuItem
        keyEquivalent="option+s"
        disabled={!viewing}
        onClick={() => setStrip((old) => !old)}
      >
        {strip ? "Hide Thumbnails" : "Show Thumbnails"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="f"
        disabled={editing || listed.length === 0}
        onClick={() => showStage(false)}
      >
        Full Screen Viewer
      </MenuItem>
      <MenuItem disabled={editing || listed.length === 0} onClick={() => showStage(true)}>
        Play Slideshow
      </MenuItem>
    </>,
    inside,
  );
  useDesktopAppMenu(
    "photos",
    "Window",
    <>
      <MenuItem keyEquivalent="command+i" onClick={() => setInfoOpen((old) => !old)}>
        {infoOpen ? "Hide Info" : "Show Info"}
      </MenuItem>
      <MenuItem keyEquivalent="command+k" onClick={() => setKeywordsOpen((old) => !old)}>
        {keywordsOpen ? "Hide Keyword Manager" : "Keyword Manager"}
      </MenuItem>
      <MenuSeparator />
    </>,
    inside,
  );
  /** Next or Previous in the editor: this photo's edit is kept, and the other one opens to edit. */
  const stepEdit = (by: number) =>
    finishEdit(() => {
      step(by);
      setPendingEdit(true);
    });
  const toolNodes: Record<PhotosTool, ReactNode> = {
    flexible: <ToolbarSpace />,
    space: <ToolbarSpace width={TOOL_SPACE} />,
    import: (
      <ToolbarButton
        aria-label="Import"
        className="mac-photos-tool"
        disabled={!ready || busy !== null}
        onClick={() => fileInput.current?.click()}
      >
        <SystemImage name="add" />
      </ToolbarButton>
    ),
    info: (
      <ToolbarButton
        aria-label="Info"
        aria-pressed={infoOpen}
        className="mac-photos-tool"
        onClick={() => setInfoOpen((old) => !old)}
      >
        <SystemImage name="info-outline" />
      </ToolbarButton>
    ),
    share: (
      <ShareMenu className="mac-photos-tool" disabled={live_.length === 0}>
        <FileShareItems
          items={dragItems(liveIds)}
          from="photos"
          prepare={() => itemsToShare(liveIds)}
        />
        <MenuSeparator />
        <MenuItem onClick={() => askExport("edited")}>Export…</MenuItem>
        <MenuItem onClick={() => askExport("original")}>Export Unmodified Original…</MenuItem>
        <MenuItem
          disabled={!stillOne}
          onClick={() => stillOne && void makeDesktopPicture(stillOne)}
        >
          Set Desktop Picture
        </MenuItem>
      </ShareMenu>
    ),
    favorite: (
      <ToolbarButton
        aria-label="Favorite"
        aria-pressed={allFavorite}
        className="mac-photos-tool"
        disabled={live_.length === 0}
        onClick={toggleFavorite}
      >
        <HeartGlyph filled={allFavorite} />
      </ToolbarButton>
    ),
    rotate: (
      <ToolbarButton
        aria-label="Rotate"
        className="mac-photos-tool"
        disabled={!rotatable}
        onClick={(event) => void rotate(event.altKey ? 3 : 1)}
      >
        <RotateGlyph />
      </ToolbarButton>
    ),
    enhance: (
      <ToolbarButton
        aria-label="Enhance"
        className="mac-photos-tool"
        disabled={noneChosen}
        onClick={() => void enhance(live_)}
      >
        <EnhanceGlyph />
      </ToolbarButton>
    ),
    slideshow: (
      <ToolbarButton
        aria-label="Slideshow"
        className="mac-photos-tool"
        disabled={listed.length === 0}
        onClick={() => showStage(true)}
      >
        <PlayGlyph />
      </ToolbarButton>
    ),
    delete: (
      <ToolbarButton
        aria-label={deleteLabel}
        className="mac-photos-tool"
        disabled={noneChosen}
        onClick={() => void askDelete(live_)}
      >
        <TrashGlyph />
      </ToolbarButton>
    ),
  };
  const toolbar = editing ? (
    <Toolbar aria-label="Toolbar" style={TOOLBAR}>
      <ToolbarSegmentedControl variant="navigation" tracking="momentary" aria-label="Browse">
        <ToolbarSegment
          aria-label="Previous"
          disabled={openIndex <= 0 || !editSource || busy !== null}
          onClick={() => stepEdit(-1)}
        >
          <SystemImage name="go-back" />
        </ToolbarSegment>
        <ToolbarSegment
          aria-label="Next"
          disabled={openIndex < 0 || openIndex >= listed.length - 1 || !editSource || busy !== null}
          onClick={() => stepEdit(1)}
        >
          <SystemImage name="go-forward" />
        </ToolbarSegment>
      </ToolbarSegmentedControl>
      <div className="mac-photos-zoom">
        <ZoomGlyph />
        <Slider
          aria-label="Zoom"
          size="small"
          className="mac-photos-zoom-slider"
          min={1}
          max={MAX_EDIT_ZOOM}
          step={0.1}
          value={editZoom}
          onValueChange={(value) => setEditZoom(value as number)}
        />
        <ZoomGlyph large />
      </div>
      <PushButton
        size="small"
        className="mac-photos-revert"
        disabled={!picture?.edit}
        onClick={revert}
      >
        Revert to Original
      </PushButton>
      <ToolbarSpace />
      <ToolbarSegmentedControl
        aria-label="Edit"
        value={[editTab]}
        onValueChange={(value) => {
          const next = value[0] as EditTab | undefined;
          if (next) setEditTab(next);
        }}
      >
        {EDIT_TABS.map((tab) => (
          <ToolbarSegment key={tab.id} value={tab.id} className="mac-photos-edit-tab">
            {tab.name}
          </ToolbarSegment>
        ))}
      </ToolbarSegmentedControl>
      <ToolbarSpace />
      <PushButton size="small" onClick={stopEdit}>
        Cancel
      </PushButton>
      <DefaultButton
        size="small"
        disabled={!editSource || busy !== null}
        onClick={() => finishEdit()}
      >
        Done
      </DefaultButton>
    </Toolbar>
  ) : (
    <Toolbar aria-label="Toolbar" style={TOOLBAR}>
      <ToolbarButton
        ref={backButton}
        aria-label="Back"
        className="mac-photos-back"
        disabled={!viewing && !memory && !person}
        onClick={() => {
          if (viewing) close();
          else if (memory) choose("memories");
          else if (person) choose("people");
        }}
      >
        <SystemImage name="go-back" />
      </ToolbarButton>
      {viewing ? (
        <ToolbarSegmentedControl variant="navigation" tracking="momentary" aria-label="Browse">
          <ToolbarSegment aria-label="Previous" disabled={openIndex <= 0} onClick={() => step(-1)}>
            <SystemImage name="go-back" />
          </ToolbarSegment>
          <ToolbarSegment
            aria-label="Next"
            disabled={openIndex < 0 || openIndex >= listed.length - 1}
            onClick={() => step(1)}
          >
            <SystemImage name="go-forward" />
          </ToolbarSegment>
        </ToolbarSegmentedControl>
      ) : (
        <div className="mac-photos-zoom">
          <ZoomGlyph />
          <Slider
            aria-label="Zoom"
            disabled={source === "places" && placesLayout === "map"}
            size="small"
            className="mac-photos-zoom-slider"
            min={ZOOM.min}
            max={ZOOM.max}
            step={ZOOM.step}
            value={zoom}
            onValueChange={(value) => setZoom(value as number)}
          />
          <ZoomGlyph large />
        </div>
      )}
      {source === "library" && !viewing ? (
        <ToolbarSegmentedControl
          aria-label="View"
          className="mac-photos-views"
          value={[view]}
          onValueChange={(value) => {
            const next = value[0] as LibraryView | undefined;
            if (next) setView(next);
          }}
        >
          {LIBRARY_VIEWS.map((each) => (
            <ToolbarSegment key={each.id} value={each.id}>
              {each.name}
            </ToolbarSegment>
          ))}
        </ToolbarSegmentedControl>
      ) : null}
      {source === "places" && !viewing ? (
        <ToolbarSegmentedControl
          aria-label="Places layout"
          className="mac-photos-views"
          value={[placesLayout]}
          onValueChange={(value) => {
            const next = value[0] as "map" | "grid" | undefined;
            if (!next) return;
            setPlacesLayout(next);
            setPlaceIds(null);
            setSelection([]);
          }}
        >
          <ToolbarSegment value="map">Map</ToolbarSegment>
          <ToolbarSegment value="grid">Grid</ToolbarSegment>
        </ToolbarSegmentedControl>
      ) : null}
      {tools.map((tool, at) => (
        // The spaces repeat: each is known by which of them it is.
        <Fragment key={`${tool}:${tools.slice(0, at).filter((each) => each === tool).length}`}>
          {toolNodes[tool]}
        </Fragment>
      ))}
      {!inDeleted && editable && !isVideo(editable) ? (
        <PushButton
          size="small"
          className="mac-photos-edit-button"
          onClick={() => {
            if (viewing) startEdit();
            else if (one) {
              open(one.id);
              setPendingEdit(true);
            }
          }}
        >
          Edit
        </PushButton>
      ) : null}
      <ToolbarSearchField
        value={query}
        onValueChange={(next: string) => {
          search(next);
          setSuggestionsOpen(true);
          setSuggestionAt(-1);
        }}
        onFocus={() => setSuggestionsOpen(true)}
        onBlur={() => setSuggestionsOpen(false)}
        onKeyDown={(event) => {
          if (suggestions.length === 0) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const by = event.key === "ArrowDown" ? 1 : -1;
            setSuggestionAt((old) => (old + by + suggestions.length) % suggestions.length);
          } else if (event.key === "Enter") {
            const chosen = suggestions[suggestionAt];
            if (chosen) pickSuggestion(chosen);
            else setSuggestionsOpen(false);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setSuggestionsOpen(false);
          }
        }}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="mac-photos-search"
      />
    </Toolbar>
  );

  const empty =
    status === "unreadable"
      ? "The library could not be read. Close Photos and open it again to retry."
      : query.trim()
        ? "No Results"
        : filter !== "all" && !inDeleted
          ? (filterChoices.find((each) => each.id === filter)?.empty ?? "No Photos")
          : (LIBRARY_SOURCES.find((each) => each.id === source)?.empty ?? "No Photos");

  const content = editing ? (
    editSource && picture && editingId === picture.id ? (
      <div className="mac-photos-edit">
        <EditStage
          zoom={editZoom}
          onZoomChange={setEditZoom}
          onStroke={(stroke) =>
            changeDraft((old) =>
              (old.marks?.length ?? 0) >= MAX_EDIT_STROKES
                ? old
                : { ...old, marks: [...(old.marks ?? []), stroke] },
            )
          }
          source={editSource}
          draft={
            comparing === "everything"
              ? NO_EDIT
              : comparing === "adjustments"
                ? {
                    ...draft,
                    adjust: NO_ADJUST,
                    filter: "none",
                    levels: null,
                    curve: [],
                    channels: {},
                    selective: {},
                    spots: [],
                    marks: undefined,
                  }
                : draft
          }
          tab={editTab}
          ratio={aspectRatio(aspect, turnedSize(editSource.width, editSource.height, draft))}
          onCropChange={(crop) => changeDraft((old) => ({ ...old, crop }))}
          tool={spotTool}
          onSpot={(spot) =>
            changeDraft((old) =>
              old.spots.length >= MAX_EDIT_SPOTS ? old : { ...old, spots: [...old.spots, spot] },
            )
          }
        />
        <EditPanel
          tab={editTab}
          source={editSource}
          draft={draft}
          onDraftChange={changeDraft}
          aspect={aspect}
          onAspectChange={setAspect}
          tool={spotTool}
          onToolChange={setSpotTool}
        />
        {notice ? (
          // A save or a revert that failed: the draft stays, and the editor says why.
          <Label role="alert" textStyle="callout" className="mac-photos-viewer-note">
            {notice}
          </Label>
        ) : null}
      </div>
    ) : (
      <EmptyState role="status" className="mac-photos-empty">
        <ProgressSpinner aria-label="Opening the original" />
      </EmptyState>
    )
  ) : picture ? (
    <section
      ref={viewer}
      className="mac-photos-viewer"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the open photo takes the arrow keys that step through the list
      tabIndex={0}
      aria-label={`${picture.name}, ${openIndex + 1} of ${listed.length}`}
      onDoubleClick={(event) => {
        // A movie's double click is its own.
        if (!(event.target instanceof HTMLVideoElement)) close();
      }}
      onPointerDown={panViewer}
      data-zoomed={viewerScale > 1 ? "" : undefined}
    >
      {isVideo(picture) ? (
        // biome-ignore lint/a11y/useMediaCaption: the person's own movie has no captions
        <video
          key={picture.id}
          className="mac-photos-picture"
          src={full.url}
          controls
          autoPlay={autoplay}
          data-full={full.url ? "" : undefined}
        />
      ) : (
        <ImageView
          src={full.url ?? urls.get(thumbKey(picture))}
          alt={picture.name}
          scaling="proportionally-up-or-down"
          className="mac-photos-picture"
          data-full={full.url ? "" : undefined}
          style={
            {
              "--mac-photos-aspect": shownSize(picture).width / shownSize(picture).height,
              transform:
                viewerScale === 1
                  ? undefined
                  : `translate(${viewerPan.x}px, ${viewerPan.y}px) scale(${viewerScale})`,
            } as CSSProperties
          }
        />
      )}
      {strip ? (
        // biome-ignore lint/a11y/useSemanticElements: a strip of thumbnail buttons, not a form field set
        <div className="mac-photos-strip" role="group" aria-label="Thumbnails">
          {listed.slice(Math.max(0, openIndex - 20), openIndex + 21).map((photo) => (
            <button
              key={photo.id}
              type="button"
              aria-current={photo.id === picture.id ? "true" : undefined}
              aria-label={titleOf(photo)}
              className="mac-photos-strip-item"
              onDoubleClick={(event) => event.stopPropagation()}
              onClick={() => open(photo.id)}
            >
              <img src={urls.get(thumbKey(photo))} alt="" draggable={false} />
            </button>
          ))}
        </div>
      ) : null}
      {full.failed ? (
        <Label color="secondary" className="mac-photos-viewer-note">
          {full.failed === "render"
            ? "The edited photo could not be drawn full size; this is its thumbnail."
            : "The original could not be read; this is its thumbnail."}
        </Label>
      ) : null}
      {notice ? (
        <Label role="alert" textStyle="callout" className="mac-photos-viewer-note">
          {notice}
        </Label>
      ) : null}
    </section>
  ) : (
    <>
      <div className="mac-photos-header">
        <h1 className="mac-photos-title">{sourceName}</h1>
        <div className="mac-photos-meta">
          <Label color="secondary" truncate className="mac-photos-range">
            {inDeleted
              ? `Photos are deleted for good after ${keepDays} days.`
              : spanText(collection)}
          </Label>
          <Label textStyle="callout" color="secondary" className="mac-photos-count">
            {selected.size > 0
              ? `${photoCount(selected.size)} Selected`
              : photoCount(listed.length)}
          </Label>
          {busy ? (
            <span className="mac-photos-busy" role="status">
              <ProgressSpinner size="small" aria-hidden />
              <Label textStyle="callout" color="secondary">
                {busy}
              </Label>
            </span>
          ) : null}
          {album ? (
            <>
              <NamePopover
                trigger={
                  <BorderlessButton color="link" className="mac-photos-link">
                    Rename…
                  </BorderlessButton>
                }
                title="Rename Album"
                action="Rename"
                initial={album.name}
                onSubmit={(name) =>
                  void act("Rename", async () => setAlbums(await changeAlbum(album.id, { name })))
                }
              />
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                onClick={() =>
                  setQuestion({
                    message: `Are you sure you want to delete the album “${album.name}”?`,
                    informative: "The photos in it stay in your library.",
                    action: "Delete",
                    run: () =>
                      void act("Delete Album", async () => {
                        setAlbums(await deleteAlbum(album.id));
                        choose("library");
                      }),
                  })
                }
              >
                Delete Album
              </BorderlessButton>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                disabled={listed.length === 0}
                onClick={() =>
                  markMemory("Show as Memory", `album-${album.id}`, { album: true }, () =>
                    choose(`memory:album-${album.id}`),
                  )
                }
              >
                Show as Memory
              </BorderlessButton>
            </>
          ) : null}
          {memory ? (
            <>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                disabled={collection.every(isVideo)}
                onClick={() => showStage(true, memoryMovie(memory))}
              >
                Play Memory Movie
              </BorderlessButton>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                disabled={collection.length === 0 || slideshowMovieType() === null || busy !== null}
                title={
                  slideshowMovieType() === null ? "This browser cannot record a movie." : undefined
                }
                onClick={() => setSheet({ kind: "slideshow-save", project: memoryMovie(memory) })}
              >
                Export Memory Movie…
              </BorderlessButton>
              <PopUpButton<MemoryMood>
                aria-label="Mood"
                size="small"
                value={memoryMoods[memory.id] ?? DEFAULT_MEMORY_MOOD}
                onValueChange={(value) => {
                  if (value) {
                    changeDesktopValue(
                      MEMORY_MOODS_KEY,
                      withMemoryMood(memoryMoods, memory.id, value),
                    );
                  }
                }}
              >
                {MEMORY_MOODS.map((each) => (
                  <PopUpButtonItem key={each} value={each}>
                    {each}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
              {readSongs ? (
                <Label textStyle="callout" color="secondary">
                  Soundtrack:{" "}
                  {songOfMood(memoryMoods[memory.id] ?? DEFAULT_MEMORY_MOOD, readSongs)?.title ??
                    "None"}
                </Label>
              ) : null}
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                onClick={() => toggleMemoryFavorite(memory.id)}
              >
                {memoryFavorites.includes(memory.id)
                  ? "Remove from Favorite Memories"
                  : "Add to Favorite Memories"}
              </BorderlessButton>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                onClick={() => askDeleteMemory(memory.id)}
              >
                Delete Memory
              </BorderlessButton>
            </>
          ) : null}
          {smartAlbum ? (
            <>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                onClick={() => setSheet({ kind: "smart", album: smartAlbum })}
              >
                Edit Smart Album…
              </BorderlessButton>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                onClick={() =>
                  void act("Delete Smart Album", async () => {
                    applyOrganised(await deleteSmartAlbum(smartAlbum.id));
                    choose("library");
                  })
                }
              >
                Delete Smart Album
              </BorderlessButton>
            </>
          ) : null}
          {project ? (
            <>
              <PopUpButton<string>
                aria-label="Theme"
                size="small"
                value={project.theme || "dissolve"}
                onValueChange={(value) => {
                  if (value) {
                    void act("Theme", async () => {
                      applyOrganised(await putProject({ ...project, theme: value }));
                    });
                  }
                }}
              >
                {SLIDESHOW_THEMES.map((each) => (
                  <PopUpButtonItem key={each.id} value={each.id}>
                    {each.name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
              <PopUpButton<string>
                aria-label="Music"
                size="small"
                value={project.music?.file ?? NO_SONG}
                onValueChange={(value) => {
                  const chosen = songs.find((each) => each.file === value);
                  void act("Music", async () => {
                    applyOrganised(
                      await putProject({
                        ...project,
                        music: chosen ? { file: chosen.file, title: chosen.title } : null,
                      }),
                    );
                  });
                }}
              >
                <PopUpButtonItem value={NO_SONG}>No Music</PopUpButtonItem>
                {songs.map((each) => (
                  <PopUpButtonItem key={each.file} value={each.file}>
                    {each.title}
                  </PopUpButtonItem>
                ))}
                {project.music && !songs.some((each) => each.file === project.music?.file) ? (
                  <PopUpButtonItem value={project.music.file}>
                    {project.music.title}
                  </PopUpButtonItem>
                ) : null}
              </PopUpButton>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                disabled={collection.length === 0 || slideshowMovieType() === null || busy !== null}
                title={
                  slideshowMovieType() === null ? "This browser cannot record a movie." : undefined
                }
                onClick={() => setSheet({ kind: "slideshow-save", project })}
              >
                Export…
              </BorderlessButton>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                disabled={collection.length === 0}
                onClick={() => showStage(true, project)}
              >
                Play
              </BorderlessButton>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                onClick={() =>
                  void act("Delete Slideshow", async () => {
                    applyOrganised(await deleteProject(project.id));
                    choose("library");
                  })
                }
              >
                Delete Slideshow
              </BorderlessButton>
            </>
          ) : null}
          {!project && !inDeleted && listed.length > 0 ? (
            <BorderlessButton
              color="link"
              className="mac-photos-link"
              onClick={() => showStage(true)}
            >
              Slideshow
            </BorderlessButton>
          ) : null}
          {inDeleted ? (
            <>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                disabled={current.length === 0}
                onClick={() => void recover(current)}
              >
                Recover
              </BorderlessButton>
              <BorderlessButton
                color="link"
                className="mac-photos-link"
                disabled={listed.length === 0}
                onClick={() => void deleteNow(current.length > 0 ? current : listed)}
              >
                {current.length > 0 ? "Delete Immediately" : "Delete All"}
              </BorderlessButton>
            </>
          ) : (
            <span className="mac-photos-showing">
              <Label id={`${idPrefix}-showing`}>Showing:</Label>
              <PullDownButton
                id={`${idPrefix}-filter`}
                aria-labelledby={`${idPrefix}-showing ${idPrefix}-filter`}
                bordered={false}
                className="mac-photos-filter"
                title={filterChoices.find((each) => each.id === filter)?.title}
              >
                <MenuRadioGroup
                  value={filter}
                  onValueChange={(value) => setFilter(value as ServedFilter)}
                >
                  {filterChoices.map((each) => (
                    <MenuRadioItem key={each.id} value={each.id}>
                      {each.title}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </PullDownButton>
            </span>
          )}
        </div>
        {notice ? (
          <Label role="alert" textStyle="callout" className="mac-photos-notice">
            {notice}
          </Label>
        ) : null}
      </div>
      {listed.length === 0 && !(source === "my-albums" && albumTiles.length > 0) ? (
        <EmptyState role="status" className="mac-photos-empty">
          {status === "loading" ? <ProgressSpinner aria-label="Loading the library" /> : empty}
        </EmptyState>
      ) : grouped ? (
        <Groups
          groups={groups}
          unit={unit}
          urls={urls}
          size={inImports || view === "days" ? size : Math.round(size * 0.75)}
          selected={selected}
          showTitle={showTitles}
          showKeywords={showKeywords}
          onSelect={selectTile}
          onOpen={open}
          onShowAll={(group) =>
            setAllOfDays((now) => {
              const next = new Set(now);
              if (!next.delete(group.key)) next.add(group.key);
              return next;
            })
          }
          allOfDays={allOfDays}
          onZoomIn={(group) => {
            if (inImports) {
              setSelection(group.photos.map((photo) => photo.id));
              return;
            }
            if (view === "days") {
              // The grid draws only the rows in view: the listbox brings its selected photo in.
              const first = group.photos[0];
              if (first) {
                setSelection([first.id]);
                revealSelected.current = true;
              }
              setView("all");
              return;
            }
            setView(view === "years" ? "months" : "days");
            const first = group.photos[0];
            if (first) {
              const date = new Date(first.taken_ms);
              const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
              setPendingScroll(
                view === "years" ? month : `${month}-${String(date.getDate()).padStart(2, "0")}`,
              );
            }
          }}
          idPrefix={idPrefix}
        />
      ) : source === "memories" ? (
        <MemoryTiles
          memories={memories}
          favorites={memoryFavorites}
          urls={urls}
          onChoose={(chosen) => choose(`memory:${chosen.id}`)}
        />
      ) : source === "my-albums" ? (
        <MemoryTiles
          memories={albumTiles}
          favorites={[]}
          urls={urls}
          onChoose={(chosen) => choose(chosen.id as ServedSource)}
        />
      ) : source === "people" ? (
        <PeopleTiles
          people={people}
          urls={urls}
          unnamed={facesToNameNow}
          note={peopleNote(lookingForFaces, facesUnavailable, notLookedAt(photos).length)}
          onChoose={(chosen) => choose(`person:${chosen.name}`)}
          onOpenFace={(photo) => open(photo.id)}
          onNameFace={(photo, face, name) =>
            void changeMany("Name Face", [photo.id], () => ({ face: { id: face.id, name } }))
          }
          onNotAFace={(photo, face) =>
            void changeMany("Not a Face", [photo.id], () => ({
              face: { id: face.id, not_a_face: true },
            }))
          }
        />
      ) : source === "places" && placesLayout === "map" ? (
        <PlacesMap
          photos={listed}
          urls={urls}
          onChoose={(chosen) => {
            const first = chosen[0];
            if (chosen.length === 1 && first) {
              open(first.id);
              return;
            }
            setPlaceIds(new Set(chosen.map((photo) => photo.id)));
            setPlacesLayout("grid");
          }}
        />
      ) : (
        <IconView
          aria-label={sourceName}
          className="mac-photos-grid"
          style={showTitles ? GRID_TITLED : GRID}
          count={listed.length}
          renderIcon={renderThumbnail}
          getItemLabel={(index) => {
            const photo = listed[index];
            return photo ? (showTitles ? titleOf(photo) : photo.name) : "";
          }}
          getItemId={(index) => listed[index]?.id ?? index}
          iconSize={size}
          cellWidth={size + 8.25}
          rowHeight={size + (showTitles ? 32 : 16)}
          value={[...selection]}
          onValueChange={(value) => setSelection(value.map(String))}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            showEditTools();
          }}
          onMouseDown={(event) => {
            // A press on a selected photo may start dragging them all: the selection narrows to it
            // only if the press ends as a click.
            pressedSelected.current = null;
            const id = photoUnder(event);
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey) return;
            if (id && selected.has(id) && selected.size > 1) {
              pressedSelected.current = id;
              event.preventDefault();
            }
          }}
          onClick={(event) => {
            const id = pressedSelected.current;
            pressedSelected.current = null;
            if (id && photoUnder(event) === id) setSelection([id]);
          }}
          onItemAction={(index) => {
            const photo = listed[index];
            if (photo) open(photo.id);
          }}
        />
      )}
    </>
  );

  const rowIcon = (ids: readonly (string | null | undefined)[]) => {
    // Hidden and deleted photos do not show here: the first photo of `ids` that may.
    const photo = ids
      .map((id) => photos.find((each) => each.id === id))
      .find((each) => each && !each.hidden && each.deleted_ms === null);
    const url = photo ? urls.get(thumbKey(photo)) : undefined;
    return url ? (
      <img src={url} alt="" className="mac-photos-row-photo" draggable={false} />
    ) : (
      <SourceGlyph name="stack" />
    );
  };
  const countOf = (ids: readonly string[]) =>
    ids.filter((id) => photos.some((photo) => photo.id === id && photo.deleted_ms === null)).length;
  /** The rows of My Albums inside a folder, or at its top: folders, albums, smart albums. */
  const saveRowName = (row: string, name: string) => {
    const kind = row.slice(0, row.indexOf(":"));
    const id = row.slice(row.indexOf(":") + 1);
    return act("Rename", async () => {
      if (kind === "album") {
        setAlbums(await changeAlbum(id, { name }));
      } else if (kind === "folder") {
        applyOrganised(await changeFolder(id, { name }));
      } else if (kind === "smart") {
        const each = smartAlbums.find((other) => other.id === id);
        if (each) applyOrganised(await putSmartAlbum({ ...each, name }));
      } else {
        const each = projects.find((other) => other.id === id);
        if (each) applyOrganised(await putProject({ ...each, name }));
      }
    });
  };
  const rowName = (row: string, name: string) =>
    renaming === row ? (
      <RowName
        name={name}
        onDone={(next) => {
          setRenaming(null);
          if (next && next !== name) void saveRowName(row, next);
        }}
      />
    ) : (
      name
    );
  const albumRows = (parent: string | null): ReactNode => (
    <>
      {folders
        .filter((folder) => folder.parent === parent)
        .map((folder) => (
          <SidebarItem
            key={folder.id}
            value={`folder:${folder.id}`}
            data-row={`folder:${folder.id}`}
            label={rowName(`folder:${folder.id}`, folder.name)}
            icon={<SourceGlyph name="stack" />}
            expanded={expanded[folder.id] === true}
            onExpandedChange={(next) => setExpanded((old) => ({ ...old, [folder.id]: next }))}
          >
            {albumRows(folder.id)}
          </SidebarItem>
        ))}
      {albums
        .filter((each) => each.folder === parent)
        .map((each) => (
          <SidebarItem
            key={each.id}
            value={`album:${each.id}`}
            data-row={`album:${each.id}`}
            label={rowName(`album:${each.id}`, each.name)}
            icon={rowIcon([each.key_photo, ...each.photos])}
            accessory={
              <Label textStyle="small" color="secondary">
                {countOf(each.photos)}
              </Label>
            }
          />
        ))}
      {smartAlbums
        .filter((each) => each.folder === parent)
        .map((each) => (
          <SidebarItem
            key={each.id}
            value={`smart:${each.id}`}
            data-row={`smart:${each.id}`}
            label={rowName(`smart:${each.id}`, each.name)}
            icon={<SourceGlyph name="gear" />}
          />
        ))}
    </>
  );
  const rowKind = rowMenu?.slice(0, rowMenu.indexOf(":"));
  const rowId = rowMenu?.slice(rowMenu.indexOf(":") + 1) ?? "";
  /** Rename the right-clicked row in place, once the closing menu has given back the keyboard. */
  const renameRow = () => {
    const row = rowMenu;
    setTimeout(() => setRenaming(row), 0);
  };
  /** Delete what the right-clicked row names, once asked. */
  const deleteRow = () =>
    setQuestion({
      message:
        rowKind === "folder"
          ? "Are you sure you want to delete this folder and the albums in it?"
          : "Are you sure you want to delete this?",
      informative: "The photos stay in your library.",
      action: "Delete",
      run: () =>
        void act("Delete", async () => {
          if (rowKind === "album") setAlbums(await deleteAlbum(rowId));
          else if (rowKind === "folder") applyOrganised(await deleteFolder(rowId));
          else if (rowKind === "smart") applyOrganised(await deleteSmartAlbum(rowId));
          else applyOrganised(await deleteProject(rowId));
        }),
    });
  const mediaRows = MEDIA_SOURCES.filter((each) =>
    photos.some(
      (photo) => photo.deleted_ms === null && !photo.hidden && isMediaType(photo, each.id),
    ),
  );

  return (
    <Window
      width={width}
      height={height}
      aria-busy={status === "loading" || undefined}
      {...windowProps}
      ref={setFrame}
      tabIndex={-1}
      data-photos-window=""
      onKeyDown={(event) => {
        onWindowKeyDown?.(event);
        onKeyDown(event);
      }}
      onKeyUp={(event) => {
        if (event.key.toLowerCase() === "m") setComparing(null);
      }}
      onPaste={(event) => {
        const files = [...event.clipboardData.files];
        if (!ready || editing) return;
        // A field's paste is the field's.
        if ((event.target as Element).closest?.("input, textarea, [contenteditable='true']")) {
          return;
        }
        const copied = copiedDriveItems();
        // A copy on the desktop leaves the computer's clipboard as it was: the drive items are the
        // later of the two.
        if (copied.length > 0 && copied !== copiedPhotos.files) importShared.current(copied);
        else if (files.length > 0) void importFiles(files);
      }}
    >
      <TitleBar
        ref={setTitleBar}
        variant="title-hidden"
        title={editing ? "Edit" : viewing ? (picture?.name ?? sourceName) : sourceName}
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        {editing ? (
          toolbar
        ) : (
          <ContextualMenu>
            <ContextualMenuTrigger className="mac-photos-toolbar-frame">
              {toolbar}
            </ContextualMenuTrigger>
            <ContextualMenuPopup>
              <MenuItem disabled={!ready} onClick={() => setSheet({ kind: "toolbar" })}>
                Customize Toolbar…
              </MenuItem>
            </ContextualMenuPopup>
          </ContextualMenu>
        )}
      </TitleBar>
      {suggestions.length > 0 ? (
        <div className="mac-photos-suggest-area">
          <div role="listbox" aria-label="Search Suggestions" className="mac-photos-suggest">
            {suggestions.map((each, index) => (
              <Fragment key={`${each.kind}:${each.text}`}>
                {each.kind !== suggestions[index - 1]?.kind ? (
                  <div role="presentation" className="mac-photos-suggest-kind">
                    {each.kind}
                  </div>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === suggestionAt}
                  className="mac-photos-suggest-row"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pickSuggestion(each)}
                >
                  <span className="mac-photos-suggest-text">{each.text}</span>
                  <span className="mac-photos-suggest-count">{each.count}</span>
                </button>
              </Fragment>
            ))}
          </div>
        </div>
      ) : null}
      <WindowBody
        background="content"
        className="mac-photos-body"
        inert={status === "loading" || undefined}
      >
        <input
          ref={fileInput}
          type="file"
          // Every picture and movie, so that one Photos cannot keep (HEIC) is chosen and refused by name.
          accept="image/*,video/*,.heic,.heif,.avif,.mov,.m4v"
          multiple
          hidden
          aria-label="Import pictures"
          onChange={(event) => {
            const files = [...(event.currentTarget.files ?? [])];
            event.currentTarget.value = "";
            if (files.length > 0) void importFiles(files);
          }}
        />
        <input
          ref={reviewInput}
          type="file"
          accept="image/*,video/*,.heic,.heif,.avif,.mov,.m4v"
          multiple
          hidden
          aria-label="Choose pictures to review"
          onChange={(event) => {
            const files = [...(event.currentTarget.files ?? [])];
            event.currentTarget.value = "";
            if (files.length > 0) setSheet({ kind: "import", files });
          }}
        />
        <SplitView
          className="mac-photos-split"
          style={SPLIT}
          data-sidebar={sidebarShown ? undefined : "hidden"}
        >
          <SplitViewPane
            defaultSize={179}
            minSize={140}
            maxSize={320}
            className="mac-photos-sidebar-pane"
          >
            <ContextualMenu>
              <ContextualMenuTrigger
                className="mac-photos-sidebar-frame"
                onPointerDownCapture={onRowPointerDown}
                onContextMenuCapture={(event: MouseEvent<HTMLElement>) => {
                  setRowMenu(
                    (event.target as HTMLElement).closest<HTMLElement>("[data-row]")?.dataset.row ??
                      null,
                  );
                }}
              >
                <Sidebar
                  aria-label="Library"
                  material="opaque"
                  className="mac-photos-sidebar"
                  onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
                    // A press on the name of the row already selected begins changing it, unless a second press follows.
                    clearTimeout(renameTimer.current);
                    const target = event.target as HTMLElement;
                    const row = target.closest<HTMLElement>("[data-row]");
                    pressedRow.current =
                      row?.getAttribute("aria-selected") === "true" &&
                      target.closest(".mac-sidebar-label") &&
                      /^(album|smart|project):/.test(row.dataset.row ?? "")
                        ? (row.dataset.row ?? null)
                        : null;
                  }}
                  onClick={(event: MouseEvent<HTMLDivElement>) => {
                    const clicked = (event.target as HTMLElement).closest<HTMLElement>("[data-row]")
                      ?.dataset.row;
                    // The row already selected fires no change: inside it, a click goes back to its top.
                    if ((clicked === "people" && person) || (clicked === "memories" && memory)) {
                      choose(clicked);
                      return;
                    }
                    const row = pressedRow.current;
                    if (!row || event.detail !== 1) return;
                    renameTimer.current = setTimeout(() => setRenaming(row), RENAME_DELAY_MS);
                    // Any other press in that time, a menu's among them, is what the person meant.
                    window.addEventListener(
                      "pointerdown",
                      () => clearTimeout(renameTimer.current),
                      { capture: true, once: true },
                    );
                  }}
                  onDoubleClick={() => clearTimeout(renameTimer.current)}
                  value={
                    source.startsWith("memory:")
                      ? "memories"
                      : source.startsWith("person:")
                        ? "people"
                        : source
                  }
                  onValueChange={(value) => {
                    if (!String(value).startsWith("folder:")) choose(value as ServedSource);
                  }}
                  footer={
                    <div ref={setInside} className="mac-photos-sidebar-footer">
                      <NamePopover
                        open={newAlbumOpen}
                        onOpenChange={setNewAlbumOpen}
                        trigger={
                          <BorderlessButton disabled={!ready} className="mac-photos-new-album">
                            <SystemImage name="add" /> New Album
                          </BorderlessButton>
                        }
                        title={live_.length > 0 ? "New Album with Selection" : "New Album"}
                        action="Create"
                        initial="Untitled Album"
                        onSubmit={(name) => void newAlbum(name)}
                      />
                    </div>
                  }
                >
                  <SidebarSection title="Library">
                    {LIBRARY_SOURCES.filter((each) => each.id !== "hidden" || showHidden).map(
                      (each) => (
                        <SidebarItem
                          key={each.id}
                          value={each.id}
                          data-row={each.id}
                          label={each.name}
                          icon={SOURCE_ICON[each.id] ?? <SourceGlyph name="stack" />}
                        />
                      ),
                    )}
                    {photos.some((photo) => photo.location && !photo.hidden) ? (
                      <SidebarItem
                        value="places"
                        data-row="places"
                        label="Places"
                        icon={<SourceGlyph name="places" />}
                      />
                    ) : null}
                  </SidebarSection>
                  <SidebarSection title="Shared">
                    {SHARED_ROWS.map((each) => (
                      <SidebarItem
                        key={each.name}
                        value={`shared:${each.name}`}
                        label={each.name}
                        title={each.reason}
                        disabled
                        icon={<SourceGlyph name="stack" />}
                      />
                    ))}
                  </SidebarSection>
                  {mediaRows.length > 0 ? (
                    <SidebarSection title="Media Types">
                      {mediaRows.map((each) => (
                        <SidebarItem
                          key={each.id}
                          value={each.id}
                          data-row={each.id}
                          label={each.name}
                          icon={<SourceGlyph name="stack" />}
                        />
                      ))}
                    </SidebarSection>
                  ) : null}
                  <SidebarSection
                    title={
                      <span className="mac-photos-section-title">
                        <button
                          type="button"
                          className="mac-photos-section-link"
                          onClick={() => choose("my-albums")}
                        >
                          My Albums
                        </button>
                        <PullDownButton
                          aria-label="Add"
                          bordered={false}
                          disabled={!ready}
                          className="mac-photos-section-add"
                          title="+"
                        >
                          <MenuItem onClick={() => setNewAlbumOpen(true)}>Album</MenuItem>
                          <MenuItem onClick={() => setSheet({ kind: "smart", album: null })}>
                            Smart Album
                          </MenuItem>
                          <MenuItem onClick={askNewFolder}>Folder</MenuItem>
                        </PullDownButton>
                      </span>
                    }
                    data-row="albums"
                  >
                    {albumRows(null)}
                  </SidebarSection>
                  {projects.length > 0 ? (
                    <SidebarSection title="My Projects">
                      {projects.map((each) => (
                        <SidebarItem
                          key={each.id}
                          value={`project:${each.id}`}
                          data-row={`project:${each.id}`}
                          label={rowName(`project:${each.id}`, each.name)}
                          icon={rowIcon(each.photos)}
                        />
                      ))}
                    </SidebarSection>
                  ) : null}
                </Sidebar>
              </ContextualMenuTrigger>
              <ContextualMenuPopup>
                <MenuItem onClick={() => setNewAlbumOpen(true)}>New Album</MenuItem>
                <MenuItem onClick={() => setSheet({ kind: "smart", album: null })}>
                  New Smart Album…
                </MenuItem>
                <MenuItem onClick={askNewFolder}>New Folder</MenuItem>
                {rowKind === "folder" ? (
                  <MenuItem
                    onClick={() =>
                      setSheet({
                        kind: "name",
                        title: "New Album",
                        action: "Create",
                        initial: "Untitled Album",
                        done: (name) =>
                          void act("New Album", async () => {
                            applyOrganised(await createAlbumIn(name, rowId));
                            setExpanded((old) => ({ ...old, [rowId]: true }));
                          }),
                      })
                    }
                  >
                    New Album in Folder
                  </MenuItem>
                ) : null}
                {rowKind === "album" ||
                rowKind === "folder" ||
                rowKind === "smart" ||
                rowKind === "project" ? (
                  <>
                    <MenuSeparator />
                    {rowKind === "smart" ? (
                      <MenuItem
                        onClick={() => {
                          const smart = smartAlbums.find((each) => each.id === rowId);
                          if (smart) setSheet({ kind: "smart", album: smart });
                        }}
                      >
                        Edit Smart Album…
                      </MenuItem>
                    ) : null}
                    <MenuItem onClick={renameRow}>Rename…</MenuItem>
                    {rowKind === "album" ? (
                      <MenuItem
                        onClick={() => {
                          const each = albums.find((other) => other.id === rowId);
                          if (each) void duplicateAlbum(each);
                        }}
                      >
                        Duplicate Album
                      </MenuItem>
                    ) : null}
                    <MenuItem onClick={deleteRow}>Delete…</MenuItem>
                  </>
                ) : null}
              </ContextualMenuPopup>
            </ContextualMenu>
          </SplitViewPane>
          <SplitViewDivider aria-label="Resize the sidebar" />
          <SplitViewPane minSize={420} className="mac-photos-content">
            <ContextualMenu>
              <ContextualMenuTrigger
                className="mac-photos-pane"
                data-dropping={dropping ? "" : undefined}
                onContextMenuCapture={onContextMenuCapture}
                onPointerDownCapture={onPanePointerDown}
                onDragOver={(event: DragEvent<HTMLElement>) => {
                  if (!event.dataTransfer.types.includes("Files") || editing) return;
                  event.preventDefault();
                  setDropping(true);
                }}
                onDragLeave={() => setDropping(false)}
                onDrop={onDrop}
              >
                {content}
              </ContextualMenuTrigger>
              {editing
                ? null
                : source === "memories" && memoryUnder
                  ? memoryMenu(memoryUnder)
                  : menu}
            </ContextualMenu>
          </SplitViewPane>
        </SplitView>
        {band ? (
          <div
            className="mac-photos-band"
            style={{ left: band.x, top: band.y, width: band.width, height: band.height }}
          />
        ) : null}
        {preferencesOpen ? (
          <PreferencesPanel
            autoplay={autoplay}
            onAutoplayChange={setAutoplay}
            onShowLibrary={
              photos[0] ? () => photos[0] && showInFinder({ id: photos[0].file }) : undefined
            }
            onClose={() => onPreferencesOpenChange?.(false)}
          />
        ) : null}
        {infoOpen ? (
          <InfoWindow
            photos={current}
            sourceName={sourceName}
            listed={listed}
            albums={albums}
            keywords={keywordList}
            people={people.map((each) => each.name)}
            urls={urls}
            onAdjustDate={() => setSheet({ kind: "date", ids: current.map((photo) => photo.id) })}
            onChange={(change) =>
              void changeMany(
                "Change Info",
                current.map((photo) => photo.id),
                () => change,
              )
            }
            onClose={() => setInfoOpen(false)}
          />
        ) : null}
        {keywordsOpen ? (
          <KeywordManager
            managed={managedKeywords}
            all={keywordList}
            canApply={live_.length > 0}
            onApply={toggleKeyword}
            onChange={(next) =>
              void act("Keywords", async () => {
                applyOrganised(await putKeywords(next));
              })
            }
            onClose={() => setKeywordsOpen(false)}
          />
        ) : null}
      </WindowBody>
      <Sheet open={sheet !== null} onOpenChange={(next) => next || setSheet(null)}>
        <SheetPopup
          anchor={titleBar}
          width={
            sheet?.kind === "smart" || sheet?.kind === "import" || sheet?.kind === "toolbar"
              ? 660
              : 380
          }
        >
          {sheet?.kind === "import" ? (
            <ImportReviewSheet
              files={sheet.files}
              held={(file) =>
                photos.some(
                  (photo) =>
                    photo.deleted_ms === null &&
                    photo.bytes === file.size &&
                    photo.name === nameOf(file.name),
                )
              }
              onDone={(files) => {
                setSheet(null);
                void importFiles(files);
              }}
            />
          ) : sheet?.kind === "smart" ? (
            <SmartAlbumSheet
              album={sheet.album}
              albumNames={albums.map((each) => each.name)}
              keywords={keywordList}
              onDone={(done) => {
                const edited = sheet.album;
                setSheet(null);
                void act("Smart Album", async () => {
                  const id = edited?.id ?? crypto.randomUUID();
                  applyOrganised(
                    await putSmartAlbum({ id, folder: edited?.folder ?? null, ...done }),
                  );
                  if (!edited) choose(`smart:${id}`);
                });
              }}
            />
          ) : sheet?.kind === "date" && sheet.ids[0] && latest(sheet.ids[0]) ? (
            <AdjustDateSheet
              photo={latest(sheet.ids[0]) as LibraryPhoto}
              count={sheet.ids.length}
              onDone={(when) => {
                const { ids } = sheet;
                setSheet(null);
                adjustDate(ids, when);
              }}
            />
          ) : sheet?.kind === "export" ? (
            <ExportSheet
              count={sheet.ids.length}
              kind={sheet.choice}
              onDone={(choice) => {
                const { ids } = sheet;
                if (choice.to === "other") {
                  setSheet({ kind: "export-save", ids, choice });
                  return;
                }
                setSheet(null);
                void runExport(ids, choice);
              }}
            />
          ) : sheet?.kind === "slideshow-save" ? (
            <DriveSavePanel
              defaultName={`${sheet.project.name}.${slideshowMovieExtension(slideshowMovieType() ?? "")}`}
              defaultFolder="movies"
              defaultExpanded
              onSave={(target) => {
                const { project: chosen } = sheet;
                setSheet(null);
                void exportSlideshow(chosen, target);
              }}
              onCancel={() => setSheet(null)}
            />
          ) : sheet?.kind === "export-save" ? (
            <DriveSavePanel
              {...exportPanelNames(sheet.ids, sheet.choice)}
              defaultFolder="pictures"
              defaultExpanded
              onSave={(target) => {
                const { ids, choice } = sheet;
                setSheet(null);
                void runExport(ids, choice, target);
              }}
              onCancel={() => setSheet(null)}
            />
          ) : sheet?.kind === "toolbar" ? (
            <CustomizeToolsSheet tools={tools} onChange={setTools} onDone={() => setSheet(null)} />
          ) : sheet?.kind === "name" ? (
            <NameSheet
              title={sheet.title}
              action={sheet.action}
              initial={sheet.initial}
              onDone={(name) => {
                const { done } = sheet;
                setSheet(null);
                done(name);
              }}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Alert open={question !== null} onOpenChange={(next) => next || setQuestion(null)}>
        <AlertPopup>
          <AlertMessage>{question?.message}</AlertMessage>
          {question?.informative ? (
            <AlertInformativeText>{question.informative}</AlertInformativeText>
          ) : null}
          <AlertButtons>
            <AlertClose render={<PushButton />}>Cancel</AlertClose>
            <DefaultButton
              onClick={() => {
                const run = question?.run;
                setQuestion(null);
                run?.();
              }}
            >
              {question?.action}
            </DefaultButton>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      {stage ? (
        <PhotoStage
          photos={stage.ids.flatMap((id) => latest(id) ?? [])}
          startId={stage.start}
          slideshow={stage.slideshow}
          theme={stage.theme}
          seconds={stage.seconds}
          musicFile={stage.musicFile}
          onClose={(id) => {
            setStage(null);
            if (id && viewing) open(id);
          }}
        />
      ) : null}
    </Window>
  );
}
