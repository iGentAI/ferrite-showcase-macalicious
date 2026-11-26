"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { ColorPanel } from "macalicious/color-panel";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { IconView } from "macalicious/icon-view";
import { ImageView } from "macalicious/image-view";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import {
  applyRichTextFormat,
  FONT_FAMILIES,
  type FontFamily,
  keepTypingRuns,
  type RichTextCommand,
  type RichTextFormat,
  type RichTextSelectionKeeper,
  readRichTextFormat,
  richTextKeyCommand,
  runRichTextCommand,
} from "macalicious/lib/rich-text";
import {
  ListView,
  ListViewRowDetail,
  ListViewRowTitle,
  ListViewRowTrailing,
} from "macalicious/list-view";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Popover, PopoverPopup, PopoverTrigger } from "macalicious/popover";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { QuickLookPanel } from "macalicious/quick-look-panel";
import { ScrollView } from "macalicious/scroll-view";
import { Sheet, SheetPopup } from "macalicious/sheet";
import { Sidebar, SidebarFooter, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { SidebarBadge } from "macalicious/sidebar-badge";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { readTextSelection, restoreTextSelection, type TextSelection } from "macalicious/text-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowBanner, WindowBannerAction } from "macalicious/window-banner";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import {
  type ChangeEvent,
  type ComponentType,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { clipboardPictures, copiedDriveItems } from "../desktop/desktop-clipboard";
import { type DesktopDragItem, filesOfDrag, useDesktopDrop } from "../desktop/desktop-drag";
import { DesktopFontPanel } from "../desktop/desktop-font-panel";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { linkAddress } from "../desktop/desktop-open-url";
import { reportFailure, sessionFetch } from "../desktop/desktop-server";
import { onSharedText, ServicesItems, takeSharedText } from "../desktop/desktop-services";
import {
  copyText,
  FileShareItems,
  onSharedFiles,
  onSharedLink,
  type SharedLink,
  shareFiles,
  shareLink,
  takeSharedFiles,
  takeSharedLinks,
} from "../desktop/desktop-share-link";
import { useTextSubstitutions } from "../desktop/text-substitutions";
import {
  checkDocumentAfterMenu,
  SpellingItems,
  SpellingPanel,
  SubstitutionItems,
  SubstitutionsPanel,
  useLearnedWords,
} from "../desktop/text-tools";
import { lookUp } from "../dictionary/dictionary-desktop";
import {
  type OpenFileRequest,
  onOpenFileRequest,
  takeOpenFileRequests,
} from "../finder/finder-open";
import { downloadBlob } from "../mail/mail-attachments";
import { shareTextWithReminders } from "../reminders/reminders-shared-text";
import { printDocument, TextEditAddLink } from "../textedit/textedit-drive";
import { PHOTO, PHOTO_THUMBNAIL, SCREENSHOT, SCREENSHOT_THUMBNAIL } from "./notes-artwork";
import { NotesAttachmentsBrowser } from "./notes-attachments-browser";
import {
  CHECKLIST_CLASS,
  type ChecklistCommand,
  DASHED_CLASS,
  moveListItem,
  runChecklist,
  tableToText,
} from "./notes-checklist";
import {
  DEFAULT_FOLDER,
  deletedExpired,
  folderWithChildren,
  defaultFolders as initialFolders,
  defaultNotes as initialNotes,
  KEEP_DELETED_DAYS,
  matches,
  type NoteFile,
  type NotesFolder,
  type NotesNote,
  ON_MY_MAC_FOLDER,
  RECENTLY_DELETED,
  SHARED_FOLDER,
  sortNotes,
  stamp,
  summarize,
} from "./notes-data";
import {
  type EditMenuTarget,
  EditorEditItems,
  EditorMoreItems,
  SpeechItems,
} from "./notes-edit-menu";
import {
  directionAt,
  lineStyleAt,
  type NotesDirection,
  NotesEditor,
  type NotesParagraphStyle,
  nodeAt,
  noteContent,
  noteEditState,
  placeCaretAtEnd,
  readLines,
  setLineDirection,
  setLineStyle,
} from "./notes-editor";
import {
  fileBlock,
  fileOfBlock,
  isPictureFile,
  isTextFile,
  keepNoteFile,
  MAX_NOTE_FILE,
  MAX_TEXT_FILE,
  NoteFileIcon,
  NoteFilePreview,
  pictureSources,
  readNoteFile,
  showFiles,
} from "./notes-files";
import { FindBar, useTextFind } from "./notes-find";
import {
  AttachmentsGlyph,
  BackGlyph,
  ChecklistGlyph,
  ComposeGlyph,
  GalleryGlyph,
  LockGlyph,
  MediaGlyph,
  OpenLockGlyph,
  PeopleGlyph,
  PinGlyph,
  TableGlyph,
  TrashGlyph,
} from "./notes-glyphs";
import { listKindHistory } from "./notes-list-history";
import {
  isClosed,
  LOCK_CHANGED_BANNER,
  LOCK_CHANGED_ELSEWHERE,
  lockAvailable,
  notesLock,
  revealNote,
  useNotesLock,
} from "./notes-lock";
import { type LockAsk, LockedNotePane, NotesLockSheet } from "./notes-lock-views";
import {
  DELETED_NOT_LOCKED,
  FILES_NOT_LOCKED,
  InsertFromIPhoneSubmenu,
  LOCK_UNAVAILABLE,
  LOCKED_NOT_SHARED,
  NoteLockItem,
  NoteLockItems,
  type NoteShare,
  NoteShareItems,
  NoteShareSubmenu,
  type NotesActions,
  NotesApplicationItems,
  NotesFileItems,
  NotesFormatItems,
  type NotesListKind,
  type NotesStatus,
  type NotesTextCommand,
  NotesViewItems,
  type NotesWindowMenu,
  SELECT_ONE_TO_LOCK,
  SELECT_ONE_TO_SHARE,
  SHARED_NOT_LOCKED,
  useNoteFocus,
  whenMenusClosed,
} from "./notes-menus";
import { NotePeople } from "./notes-people";
import { NotesPhotos } from "./notes-photos";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  NOTES_SETTINGS,
  readAttachmentView,
  readBoolean,
  readNewNoteStart,
  readNumber,
  readSort,
  readText,
  readView,
  useNotesSetting,
} from "./notes-settings";
import {
  leaveNote,
  noteOfOpenItem,
  type SharedState,
  saveAllNotes,
  shareNote,
  stopSharing,
  useSharedAdoptionKey,
  useSharedNotes,
} from "./notes-shared";
import {
  dismissNotesConflict,
  isSavedPicture,
  keepConflictCopy,
  type NotesConflict,
  recordIdTag,
  type SavedNotes,
  syncEnabled,
  useNotesAdoptionKey,
  useNotesConflicts,
  useShownNotes,
  useUnsaved,
} from "./notes-sync";
import {
  changeTableUndoably,
  type NotesTableCommand,
  nextCell,
  placeTableCaret,
  TABLE_KEY_COMMANDS,
  tableCellAt,
  tableCellAtSelection,
} from "./notes-table";
import { NoteWindow } from "./notes-window";
import "./notes.tokens.css";
import "./notes.css";

/** Width of every toolbar button: the measured 38 pt bezel. */
const BUTTON: CSSProperties = { width: 38, padding: 0 };
const NO_SHARED: SharedState = { notes: [], canShare: false, seq: 0, origin: null, unsaved: false };

/** The line over a shared note: who shares it, and who last changed it. */
function sharedByline(shared: SharedState, id: string) {
  const entry = shared.notes.find((each) => each.id === id);
  if (!entry) return "";
  const count = entry.members.length;
  const whom = entry.owned
    ? `Shared with ${count === 1 ? entry.members[0]?.fullName : `${count} people`}`
    : `Shared by ${entry.owner.fullName}`;
  return entry.editedBy ? `${whom} · Last edited by ${entry.editedBy}` : whom;
}
/** Width of the segments of the view switcher: the control is 69 pt with its border. */
const LIST_SEGMENT: CSSProperties = { width: 35, padding: 0 };
const GALLERY_SEGMENT: CSSProperties = { width: 34, padding: 0 };
/** Where the view switcher ends, and what four buttons and their gaps take, in points. */
const SWITCHER_END = 147;
const GROUP = 4 * 38 + 3 * 8;
/** The toolbar's gap: a fixed space has one on each side. */
const GAP = 8;
/**
 * The spaces that hold the groups over their panes give way when the panes are dragged wider
 * than the window has room for the toolbar, so the last items stay in view.
 */
const SHRINK: CSSProperties = { flex: "0 1 auto" };

/** The hooks of the library controls that Notes sets: its paper, selection and dividers. */
const LIST_STYLE = {
  height: "100%",
  background: "var(--mac-notes-list-background)",
  "--mac-list-view-selected-background": "var(--mac-notes-selection)",
} as CSSProperties;
const SPLIT_STYLE = {
  height: "100%",
  "--mac-split-view-divider-color": "var(--mac-notes-divider)",
} as CSSProperties;
const BROWSER_STYLE = {
  height: "100%",
  "--mac-split-view-divider-color": "var(--mac-notes-editor-divider)",
} as CSSProperties;
const EDITOR_STYLE = {
  height: "100%",
  flex: "1 1 0",
  minHeight: 0,
  background: "var(--mac-notes-editor-background)",
  "--mac-text-view-background": "transparent",
} as CSSProperties;
/** The note's pane: any conflict notices, then the note. */
const EDITOR_PANE: CSSProperties = { display: "flex", flexDirection: "column", height: "100%" };
const FILL: CSSProperties = { height: "100%" };

/**
 * The family of the note's own text in the Fonts panel: the system font, San Francisco, which
 * Catalina's Notes sets its text in. It is not one of the families the panel lists otherwise.
 */
const SYSTEM_FONT: FontFamily = {
  name: "System Font",
  css: "system-ui",
  typefaces: [
    { name: "Regular", bold: false, italic: false },
    { name: "Italic", bold: false, italic: true },
    { name: "Bold", bold: true, italic: false },
    { name: "Bold Italic", bold: true, italic: true },
  ],
  collections: [],
};
const PANEL_FAMILIES = [SYSTEM_FONT, ...FONT_FAMILIES];
/** The first names of the system font's CSS, and none at all: the text is in the system font. */
const SYSTEM_NAMES =
  /^(|-apple-system|system-ui|BlinkMacSystemFont|SF Pro Text|Mac System Fallback)$/i;

const sameFormat = (a: RichTextFormat, b: RichTextFormat) =>
  (Object.keys(a) as (keyof RichTextFormat)[]).every((key) => a[key] === b[key]);
const sameLines = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((line, index) => line === b[index]);

/** The file a note takes: anything up to what the server keeps. */
const takesFile = (file: { size?: number }) => (file.size ?? 0) <= MAX_NOTE_FILE;
/** Why a file was refused. */
const FILE_LIMIT = "A file in a note can be up to 10 MB.";
/** The first web address in a note's lines, as a link may go to it. */
const firstAddress = (lines: readonly string[]) => {
  for (const line of lines) {
    for (const [written] of line.matchAll(/https?:\/\/[^\s<>"]+/gi)) {
      const address = linkAddress(written);
      if (address) return address;
    }
  }
  return null;
};
const NO_FILE_SHARE = "This browser can’t hand a picture to another app.";

/** The height of a row of the note list, and of the Pinned and Notes headings above their first. */
const ROW_HEIGHT = 56;
const SECTION_HEIGHT = 22;
/** The height of a row of cards in the gallery: its icon and its name. */
const CARD_ROW_HEIGHT = 136;
/** What a drag of notes, or of a folder, carries. */
const NOTES_DRAG = "application/x-macalicious-notes";
const FOLDER_DRAG = "application/x-macalicious-notes-folder";

/** The kind of the nearest list holding `at` inside `editor`, or `null` outside a list. */
function listAt(editor: HTMLElement, at: Node | null): NotesListKind | null {
  for (let node = at; node && node !== editor; node = node.parentNode) {
    if (node.nodeName === "OL") return "numbered";
    if (node.nodeName === "UL") {
      const list = node as Element;
      if (list.classList.contains(CHECKLIST_CLASS)) return "checklist";
      return list.classList.contains(DASHED_CLASS) ? "dashed" : "bulleted";
    }
  }
  return null;
}

/**
 * What a Notes window keeps when it is built again from a document it adopts (another window's
 * or browser's change, read from the server): the folder and note it showed and how it showed
 * them, and where the person was typing, so that the change arrives without moving them.
 */
/** Content to add to a note, as `insert` takes it. */
interface PendingInsert {
  where: "text" | "end";
  build: (document: Document) => { blocks: HTMLElement[]; caret: Node };
  id: string;
}

/** Files on their way to becoming notes: those waiting, and those waiting for their note's editor. */
interface NotesImports {
  queue: File[][];
  importing: File[] | null;
}

const INSERTED_CARET = "data-notes-inserted-caret";

/**
 * Add `blocks` to `editor` before `before` (or at its end) as one step of the browser's undo
 * history, through its own `insertHTML`, so that Edit > Undo and Command-Z take them out again and
 * Redo puts them back. Answers where the insertion point goes, or `null` when it could not be done
 * that way (no editing commands in a test's document, or an editor not shown, which cannot take
 * the keyboard): the caller then adds them in place, without an undo step.
 */
function insertUndoably(
  editor: HTMLElement,
  blocks: readonly HTMLElement[],
  caret: Node,
  before: Element | null,
): Node | null {
  const document = editor.ownerDocument;
  if (typeof document.execCommand !== "function" || document.activeElement !== editor) return null;
  const selection = document.getSelection();
  if (!selection) return null;
  const mark = caret instanceof Element ? caret : caret.parentElement;
  mark?.setAttribute(INSERTED_CARET, "");
  const range = document.createRange();
  if (before) range.setStartBefore(before);
  else {
    range.selectNodeContents(editor);
    range.collapse(false);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  const html = blocks.map((block) => block.outerHTML).join("");
  mark?.removeAttribute(INSERTED_CARET);
  const done = document.execCommand("insertHTML", false, html);
  const inserted = editor.querySelector(`[${INSERTED_CARET}]`);
  inserted?.removeAttribute(INSERTED_CARET);
  return done ? inserted : null;
}

interface NotesMemory {
  /**
   * Content read for a note by a window since built again from an adopted document (a file takes
   * time to read), and files still to become notes: the window standing now adds them.
   */
  inserts?: PendingInsert[];
  /** Has the window standing now add what is in `inserts`. */
  addInserts?: () => void;
  imports?: NotesImports;
  ui?: {
    query: string;
    browsing: boolean;
    noteWindows: readonly string[];
  };
  /** The selection last read in the note shown, by note. */
  caret?: { noteId: string; selection: TextSelection };
  /** Whether the note shown has the keyboard, from the focus events of the window's document. */
  focused: boolean;
}

export interface NotesContentProps {
  /**
   * Props for the window's title bar: a window manager passes its drag-region callbacks here
   * (`onDragRegionPointerDown` to move the window, `onDragRegionDoubleClick` to zoom it).
   */
  titleBarProps?: Omit<TitleBarProps, "variant" | "controls" | "children" | "title">;
  /**
   * Props for the close, minimize and zoom buttons: a window manager passes `onClose`,
   * `onMinimize`, `onZoom` and the zoom button's role here.
   */
  controlsProps?: WindowControlsProps;
  /**
   * The folders the app starts with. The first one should be the folder named by
   * `DEFAULT_FOLDER`, which cannot be deleted.
   * @default the single "Notes" folder of the reference screenshots
   */
  defaultFolders?: NotesFolder[];
  /**
   * The notes the app starts with, newest first. They are kept for the page session only.
   * @default the five notes of the reference screenshots
   */
  defaultNotes?: NotesNote[];
  /**
   * Shows the account as syncing, as the Aqua reference capture does: a spinner beside the
   * account's name, and the lock, table, checklist and format buttons dimmed until it has
   * finished.
   * @default false
   */
  syncing?: boolean;
  /**
   * Where the app's commands are put, for a menu bar outside the window (`NotesMenuBar`): New
   * Note, the paragraph styles, and the Font and Text commands with the two panels.
   */
  actionsRef?: Ref<NotesActions>;
  /**
   * Called when what a menu bar shows changes: whether the note can be formatted, and the
   * format and the paragraph style where the insertion point is.
   */
  onStatusChange?: (status: NotesStatus) => void;
  /**
   * The element the Fonts and Colors panels are rendered into, side by side where that element
   * puts them. In the document's body they float at the top right of the page.
   * @default the document's body
   */
  panelContainer?: HTMLElement | null;
  /** On the desktop: renders a note's own window as a window of the desktop. */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
}

/**
 * Everything inside the Notes window: the toolbar in a title-hidden title bar, and the three
 * panes. Render it inside a window of your own (a window manager's managed window, say); the
 * `Notes` component is this in the library's `Window`.
 *
 * Served by the macalicious-desktop Ferrite application, it starts from the folders and notes
 * the browser session saved there and saves them as they change, so they survive a reload.
 * Anywhere else the notes last as long as the component is mounted.
 */
export function NotesContent(props: NotesContentProps) {
  const shown = useShownNotes();
  const unsaved = useUnsaved();
  const shared = useSharedNotes();
  // This window, as the origin of the changes it saves: it already shows them.
  const [origin] = useState(() => ({}));
  const save = useCallback((data: SavedNotes) => saveAllNotes(data, origin), [origin]);
  const adoption = useNotesAdoptionKey(shown, origin);
  const sharedAdoption = useSharedAdoptionKey(shared, origin);
  // Outlives the window's builds: what it showed and where the caret was.
  const [memory] = useState<NotesMemory>(() => ({ focused: false }));
  // Held here because a request can come before the shared notes do, and the view is built again
  // when they come.
  const [askedNote, setAskedNote] = useState<string | null>(null);
  useOpenItemRequests("notes", ({ id }) => setAskedNote(noteOfOpenItem(id)));
  const asked = { askedNote, onAskNote: setAskedNote };
  useEffect(() => notesLock.windowOpened(), []);
  useEffect(() => {
    if (shown?.data) notesLock.follow(shown.data.notes);
  }, [shown]);
  if (!syncEnabled()) return <NotesContentView {...props} {...asked} />;
  // The window stays empty for the moment the session's notes are read.
  if (shown === undefined) return null;
  const saved = shown.data;
  return (
    <NotesContentView
      {...props}
      {...asked}
      // Built again from each document the window adopts (the stored notes read again, or
      // another window's change, or a shared note someone changed): nothing of the window's own
      // state outlives it.
      key={`${adoption}|${sharedAdoption}`}
      // The close button shows the dot of a document with unsaved changes while the notes the
      // window shows are not the stored ones.
      controlsProps={{
        ...props.controlsProps,
        edited: unsaved || shared.unsaved || props.controlsProps?.edited,
      }}
      defaultFolders={saved?.folders ?? props.defaultFolders}
      defaultNotes={[
        ...shared.notes.map((entry) => entry.note),
        ...(saved?.notes ?? props.defaultNotes ?? initialNotes),
      ]}
      onDataChange={save}
      memory={memory}
      shared={shared}
    />
  );
}

interface NotesContentViewProps extends NotesContentProps {
  /** Called with the folders and the notes after every change to either. */
  onDataChange?: (data: SavedNotes) => void;
  /** What the window keeps across its builds (`NotesMemory`). */
  memory?: NotesMemory;
  /** The notes shared with other accounts; without them the window cannot share. */
  shared?: SharedState;
  /** The note asked for from Spotlight or a notification, until it is shown. */
  askedNote?: string | null;
  onAskNote?: (id: string | null) => void;
}

function NotesContentView({
  askedNote = null,
  onAskNote,
  titleBarProps,
  controlsProps,
  defaultFolders = initialFolders,
  defaultNotes = initialNotes,
  syncing = false,
  actionsRef,
  onStatusChange,
  panelContainer,
  DesktopWindow,
  onDataChange,
  memory,
  shared = NO_SHARED,
}: NotesContentViewProps) {
  // Built again from an adopted document, the window shows what it showed before.
  const kept = memory?.ui;
  const [folders, setFolders] = useState(defaultFolders);
  const [notes, setNotes] = useState(defaultNotes);
  // Every change goes to `onDataChange`, but not the state the window opened with, which it was
  // given (React may run this effect twice on mount): saving it would change nothing, or, when
  // nothing is stored, send the starting notes in place of an edit.
  const sent = useRef({ folders, notes });
  useEffect(() => {
    if (folders === sent.current.folders && notes === sent.current.notes) return;
    sent.current = { folders, notes };
    onDataChange?.({ folders, notes });
  }, [folders, notes, onDataChange]);
  const [storedFolder, setFolderId] = useNotesSetting(
    NOTES_SETTINGS.folder,
    readText,
    defaultFolders[0]?.id ?? DEFAULT_FOLDER,
  );
  const [noteId, setNoteId] = useNotesSetting<string | null>(NOTES_SETTINGS.note, readText, null);
  const [query, setQuery] = useState(kept?.query ?? "");
  const [view, setView] = useNotesSetting(NOTES_SETTINGS.view, readView, "list");
  const [foldersShown, setFoldersShown] = useNotesSetting(
    NOTES_SETTINGS.foldersShown,
    readBoolean,
    true,
  );
  const [browsing, setBrowsing] = useState(kept?.browsing ?? false);
  // The notes in windows of their own. An edit in one window shows in the other as it is built again.
  const [noteWindows, setNoteWindows] = useState<readonly string[]>(kept?.noteWindows ?? []);
  const [windowAsked, setWindowAsked] = useState<{ id: string; serial: number } | null>(null);
  const [windowRevisions, setWindowRevisions] = useState<Readonly<Record<string, number>>>({});
  const [editorRevisions, setEditorRevisions] = useState<Readonly<Record<string, number>>>({});
  const latestWindows = useRef(noteWindows);
  latestWindows.current = noteWindows;
  const [sidebarWidth, setSidebarWidth] = useNotesSetting(
    NOTES_SETTINGS.sidebarWidth,
    readNumber,
    190,
  );
  const [listWidth, setListWidth] = useNotesSetting(NOTES_SETTINGS.listWidth, readNumber, 248);
  const [sort, setSort] = useNotesSetting(NOTES_SETTINGS.sort, readSort, "edited");
  const [noteCount, setNoteCount] = useNotesSetting(NOTES_SETTINGS.noteCount, readBoolean, true);
  const [zoom, setZoom] = useNotesSetting(NOTES_SETTINGS.zoom, readNumber, 1);
  const [newNoteStart] = useNotesSetting(NOTES_SETTINGS.newNoteStart, readNewNoteStart, "title");
  const [spelling, setSpelling] = useNotesSetting(NOTES_SETTINGS.spelling, readBoolean, true);
  const [attachmentView, setAttachmentView] = useNotesSetting(
    NOTES_SETTINGS.attachmentView,
    readAttachmentView,
    "large",
  );
  const [substitutions, setSubstitutions] = useTextSubstitutions("notes");
  const latestSubstitutions = useRef(substitutions);
  latestSubstitutions.current = substitutions;
  const [spellingShown, setSpellingShown] = useState(false);
  const [substitutionsShown, setSubstitutionsShown] = useState(false);
  const [ignoredWords] = useState(() => new Set<string>());
  const { learned: learnedWords } = useLearnedWords();
  const latestLearned = useRef(learnedWords);
  latestLearned.current = learnedWords;
  const [addingLink, setAddingLink] = useState(false);
  const [linkToAdd, setLinkToAdd] = useState<string | null>(null);
  // Whether the list was opened from the gallery, which the toolbar's Back returns to.
  const [galleryBack, setGalleryBack] = useState(false);
  useEffect(() => {
    if (view === "gallery") setGalleryBack(false);
  }, [view]);
  // The attachment a secondary click was on, and the picture Quick Look shows.
  const [menuAttachment, setMenuAttachment] = useState<HTMLElement | null>(null);
  const [quickLook, setQuickLook] = useState<{
    src?: string;
    name: string;
    file?: NoteFile;
  } | null>(null);
  const [refusedFiles, setRefusedFiles] = useState<string[]>([]);
  const [fileFailure, setFileFailure] = useState<{ name: string; reason: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const hasDeleted = notes.some((note) => note.deleted !== undefined);
  const hasShared = notes.some((note) => note.folder === SHARED_FOLDER);
  // The folder the window shows: the one kept, while it still exists.
  const folderId =
    storedFolder === RECENTLY_DELETED
      ? hasDeleted
        ? storedFolder
        : (folders[0]?.id ?? DEFAULT_FOLDER)
      : storedFolder === SHARED_FOLDER && hasShared
        ? storedFolder
        : folders.some((folder) => folder.id === storedFolder)
          ? storedFolder
          : (folders[0]?.id ?? DEFAULT_FOLDER);
  const showsDeleted = folderId === RECENTLY_DELETED;
  // A new note goes in the folder shown, unless that is a row that holds no notes of its own.
  const showsFolder = !showsDeleted && folderId !== SHARED_FOLDER;
  const newNoteFolder = showsFolder ? folderId : DEFAULT_FOLDER;
  // While a search shows live notes from any folder, the commands are those of live notes.
  const inDeleted = showsDeleted && query.trim() === "";
  // More than one note selected in the list or the gallery: the commands act on them all, and the
  // note's pane says how many. One note selected is `noteId` alone.
  const [several, setSeveral] = useState<string[] | null>(null);
  // A deleted note goes for good once it has stayed its time: as notes arrive, and while the window
  // stays open past that.
  useEffect(() => {
    const sweep = () => {
      const now = Date.now();
      setNotes((all) =>
        all.some((note) => deletedExpired(note, now))
          ? all.filter((note) => !deletedExpired(note, now))
          : all,
      );
    };
    sweep();
    const timer = setInterval(sweep, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [erasing, setErasing] = useState<string[] | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; where: string } | null>(null);
  // The folder row a secondary click was on.
  const [menuFolder, setMenuFolder] = useState<string | null>(null);
  const copiedStyle = useRef<Partial<RichTextFormat> | null>(null);
  // The pane the Delete command acts on: the one last given the focus. A toolbar button takes
  // the focus when it is pressed, so the focus itself cannot say.
  const [pane, setPane] = useState<"folders" | "notes">("notes");
  // Whether the folder list has the focus now: its selection is then accent-coloured.
  const [foldersFocused, setFoldersFocused] = useState(false);
  // The notes whose editor is mounted. An editor stays mounted, hidden, once its note has
  // been shown, so what was typed, tables and checklists included, is kept as the browser
  // has it.
  const [opened, setOpened] = useState<string[]>([]);
  const [editors] = useState(() => new Map<string, HTMLDivElement>());
  // Each mounted editor's selection, as it last was inside it: the menus and the panels take
  // the focus, and may take the selection, before their command runs.
  const [keepers] = useState(() => new Map<string, RichTextSelectionKeeper>());
  const created = useRef(0);
  const focusEditor = useRef(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [onMyMac] = useNotesSetting(NOTES_SETTINGS.onMyMac, readBoolean, false);
  // Turning On My Mac on makes its first folder; turned off, its folders stay and are not listed.
  useEffect(() => {
    if (onMyMac && !folders.some((folder) => folder.local)) {
      setFolders((all) => [...all, ON_MY_MAC_FOLDER]);
    }
    if (!onMyMac && folders.some((folder) => folder.local && folder.id === folderId)) {
      setFolderId(DEFAULT_FOLDER);
    }
  }, [onMyMac, folders, folderId, setFolderId]);
  // The format and the paragraph style where the insertion point is in the note shown, or last
  // was: what the Format menus check and the Fonts panel shows.
  const [format, setFormat] = useState<RichTextFormat | null>(null);
  // Typing runs as Undo steps in every engine (Firefox otherwise joins them): src/lib/rich-text.ts.
  useEffect(() => keepTypingRuns(), []);
  const [paragraph, setParagraph] = useState<NotesParagraphStyle | null>(null);
  // The kind of list the insertion point is in: what Bulleted List and Numbered List check.
  const [listKind, setListKind] = useState<NotesListKind | null>(null);
  // Whether the insertion point is in a table's cell: what enables Format > Table.
  const [inTable, setInTable] = useState(false);
  const [direction, setDirection] = useState<NotesDirection>("natural");
  const [fontsShown, setFontsShown] = useState(false);
  const [colorsShown, setColorsShown] = useState(false);
  // The panels are rendered into the page's body, which exists once the app is mounted.
  const [mounted, setMounted] = useState(false);
  const panelLayer = useRef<HTMLDivElement>(null);
  // The note whose editor is shown, for the selection's listener.
  const shownNote = useRef<string | undefined>(undefined);
  // Whether this build of the window is still the one shown. A build that replaces it (an adopted
  // document) gives its note the keyboard in its layout effect, before this one's listeners are
  // removed: they must not take that focus for the person leaving the note.
  const alive = useRef(true);
  useLayoutEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const formatFocus = useNoteFocus(() => formatTarget()?.keeper.restore());
  // The title bar, for the desktop's menu bar: a press or the focus in this window makes its
  // Format commands the ones the menu bar shows.
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  // The notes as they are now, for work that ends after the render that started it: a picture
  // read from a file must not land in a note that was locked or deleted while it loaded.
  // Set in the commit, so no later task sees the notes of an earlier render.
  const live = useRef(notes);
  useLayoutEffect(() => {
    live.current = notes;
  }, [notes]);
  const lockView = useNotesLock();
  const reveal = useCallback((note: NotesNote) => revealNote(lockView, note), [lockView]);
  const [lockAsk, setLockAsk] = useState<LockAsk | null>(null);
  const [lockFailure, setLockFailure] = useState<string | null>(null);
  // A note's own window shows its text: it closes with the lock.
  useEffect(() => {
    setNoteWindows((open) => {
      const left = open.filter((id) => {
        const note = notes.find((each) => each.id === id);
        return !note || !isClosed(lockView, note);
      });
      return left.length === open.length ? open : left;
    });
  }, [lockView, notes]);

  useEffect(() => setMounted(true), []);

  /** Read the format and the paragraph style where the insertion point is in `editor`. */
  const follow = useCallback((editor: HTMLElement) => {
    const selection = editor.ownerDocument.getSelection();
    const at = selection && selection.rangeCount > 0 ? nodeAt(selection.getRangeAt(0)) : null;
    const next = readRichTextFormat(editor);
    setFormat((before) => (before && sameFormat(before, next) ? before : next));
    setParagraph(at && editor.contains(at) ? lineStyleAt(editor, at) : null);
    setListKind(at && editor.contains(at) ? listAt(editor, at) : null);
    setInTable(Boolean(at && editor.contains(at) && tableCellAt(editor, at)));
    setDirection(at && editor.contains(at) ? directionAt(editor, at) : "natural");
  }, []);

  // The menus and the Fonts panel follow the insertion point in the note shown. Once it leaves
  // the note (for a menu or a panel), they keep showing the place a command will act on. The
  // window's memory keeps the selection, for a build of the window that adopts a document, and
  // whether the note shown has the keyboard: from the focus itself, since a selection can stay
  // in the note while a button, a menu or a panel has the keyboard.
  useEffect(() => {
    const shownEditor = () => {
      const id = shownNote.current;
      return id === undefined ? undefined : editors.get(id);
    };
    const changed = () => {
      if (!alive.current) return;
      const id = shownNote.current;
      const editor = shownEditor();
      const anchor = document.getSelection()?.anchorNode;
      const inside = Boolean(editor && anchor && editor.contains(anchor));
      if (memory && editor && inside && id !== undefined && document.activeElement === editor) {
        const selection = readTextSelection(editor);
        if (selection) memory.caret = { noteId: id, selection };
      }
      if (editor && inside) follow(editor);
    };
    const focusIn = (event: FocusEvent) => {
      if (memory && alive.current) {
        memory.focused = Boolean(shownEditor()?.contains(event.target as Node));
      }
    };
    // Read once the focus has moved; a note removed with the window (a build that adopts a
    // document) leaves what was kept as it was.
    const focusOut = () =>
      queueMicrotask(() => {
        const editor = shownEditor();
        if (memory && alive.current && editor?.isConnected) {
          memory.focused = document.activeElement === editor;
        }
      });
    document.addEventListener("selectionchange", changed);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    return () => {
      document.removeEventListener("selectionchange", changed);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
    };
  }, [editors, follow, memory]);

  const searching = query.trim() !== "";
  const visible = useMemo(
    () =>
      sortNotes(
        notes.filter((note) =>
          searching
            ? note.deleted === undefined && matches(note, query)
            : inDeleted
              ? note.deleted !== undefined
              : note.deleted === undefined && note.folder === folderId,
        ),
        sort,
      ),
    [notes, folderId, inDeleted, query, searching, sort],
  );
  const current = visible.find((note) => note.id === noteId) ?? visible[0] ?? null;
  const shownCurrent = current ? reveal(current) : null;
  const currentId = current?.id;
  const selectedIds = useMemo(() => {
    const listed = several?.filter((id) => visible.some((note) => note.id === id)) ?? [];
    return listed.length > 1 ? listed : current ? [current.id] : [];
  }, [several, visible, current]);
  const severalShown = selectedIds.length > 1;
  const selectedNotes = visible.filter((note) => selectedIds.includes(note.id));
  useEffect(() => {
    if (several && (noteId === null || !several.includes(noteId))) setSeveral(null);
  }, [several, noteId]);
  // Whether the note shown can be formatted: the editor is shown and the note is not locked.
  const editable =
    view === "list" &&
    !browsing &&
    current !== null &&
    !shownCurrent?.locked &&
    current.deleted === undefined &&
    !severalShown;
  const shownId = view === "list" && !browsing ? currentId : undefined;
  useLayoutEffect(() => {
    shownNote.current = shownId;
  }, [shownId]);
  // Built again from an adopted document while the person was typing in the note it shows: the
  // note takes the keyboard back, the selection where it was (moved by the change, when the
  // change came before it). Once, when the window is built; the note's content is in place by
  // then (its editor fills it before this runs).
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, when the window is built
  useLayoutEffect(() => {
    const caret = memory?.caret;
    if (!memory?.focused || !caret || caret.noteId !== shownNote.current) return;
    const editor = editors.get(caret.noteId);
    if (editor?.isConnected) restoreTextSelection(editor, caret.selection);
  }, []);
  // The window's memory follows what it shows.
  useEffect(() => {
    if (!memory) return;
    memory.ui = { query, browsing, noteWindows };
  });

  // Another note shown: the menus and the panel show its format. A note shown for the first
  // time has its editor once `opened` holds it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again when the editor is mounted (opened)
  useEffect(() => {
    const editor = shownId === undefined ? undefined : editors.get(shownId);
    if (editor) follow(editor);
    else {
      setFormat(null);
      setParagraph(null);
      setListKind(null);
      setInTable(false);
      setDirection("natural");
    }
  }, [shownId, opened, editors, follow]);

  useEffect(() => {
    if (currentId !== undefined) {
      setOpened((ids) => (ids.includes(currentId) ? ids : [...ids, currentId]));
    }
  }, [currentId]);

  // A new note takes the insertion point once its editor is in the page.
  useEffect(() => {
    if (!focusEditor.current || currentId === undefined) return;
    const editor = editors.get(currentId);
    if (!editor) return;
    focusEditor.current = false;
    editor.focus();
  });

  const applyEdit = useCallback(
    (
      id: string,
      lines: string[],
      attachment: boolean,
      picture?: string,
      html?: string,
      files?: NoteFile[],
    ) => {
      if (notesLock.edit(id, lines, attachment, picture, html)) return;
      setNotes((all) => {
        const note = all.find((candidate) => candidate.id === id);
        if (!note) return all;
        // The stand-in picture stays until it is deleted in the text.
        const kept = attachment ? note.attachment : undefined;
        const named = files && files.length > 0 ? files : undefined;
        // A command that changed nothing (a style for the next character typed) is no edit.
        if (
          sameLines(note.lines, lines) &&
          note.html === html &&
          note.picture === picture &&
          note.attachment === kept &&
          sameLines(
            (note.files ?? []).map((file) => file.id),
            (named ?? []).map((file) => file.id),
          )
        ) {
          return all;
        }
        const { files: _files, ...rest } = note;
        const edited = {
          ...rest,
          ...(named ? { files: named } : undefined),
          lines,
          attachment: kept,
          picture,
          html,
          ...stamp(new Date()),
        };
        // An edited note moves to the top of its list, as in Notes.
        return [edited, ...all.filter((candidate) => candidate !== note)];
      });
    },
    [],
  );
  /** An edit in the main window: a window of the same note shows it anew. */
  const edit = useCallback<typeof applyEdit>(
    (id, ...change) => {
      applyEdit(id, ...change);
      if (latestWindows.current.includes(id)) {
        setWindowRevisions((all) => ({ ...all, [id]: (all[id] ?? 0) + 1 }));
      }
    },
    [applyEdit],
  );
  /** An edit in a note's own window: the main window's editor of it shows it anew. */
  const editInWindow = useCallback<typeof applyEdit>(
    (id, ...change) => {
      applyEdit(id, ...change);
      setEditorRevisions((all) => ({ ...all, [id]: (all[id] ?? 0) + 1 }));
    },
    [applyEdit],
  );
  /** Tell the list what an editor holds after a command changed its content. */
  const read = (id: string, editor: HTMLElement) => {
    const state = noteEditState(editor);
    edit(id, state.lines, state.attachment, state.picture, state.html, state.files);
  };

  /** An id no note or folder has yet, whatever ids the notes and folders given at first have. */
  const newId = (prefix: string) => {
    let id: string;
    do {
      created.current += 1;
      id = `${prefix}-${recordIdTag()}${created.current}`;
    } while (notes.some((note) => note.id === id) || folders.some((folder) => folder.id === id));
    return id;
  };

  const addNote = () => {
    const id = newId("new-note");
    const made = new Date();
    // Preferences > New notes start with: the first line of an empty note is the title otherwise.
    const start =
      newNoteStart === "heading"
        ? { html: "<h2><br></h2>" }
        : newNoteStart === "body"
          ? { html: '<div data-paragraph="body"><br></div>' }
          : undefined;
    const folder = newNoteFolder;
    setNotes((all) => [
      { id, folder, lines: [""], ...start, created: made.toISOString(), ...stamp(made) },
      ...all,
    ]);
    if (!showsFolder) setFolderId(DEFAULT_FOLDER);
    setNoteId(id);
    setSeveral(null);
    setQuery("");
    setBrowsing(false);
    setView("list");
    setPane("notes");
    focusEditor.current = true;
  };

  /**
   * A note of a link shared with Notes (Share > Notes in Safari, News and Stocks:
   * `desktop-share-link.tsx`): its title, then its address, in the folder shown, and selected.
   * It is saved like any other note.
   */
  const addSharedNote = (link: SharedLink) => {
    const id = newId("shared-note");
    // A title is one line: a feed's headline may carry line breaks, which would split it.
    const title = link.title.replace(/\s+/g, " ").trim();
    const lines = title && title !== link.url ? [title, link.url] : [link.url];
    const made = new Date();
    const folder = newNoteFolder;
    setNotes((all) => [{ id, folder, lines, created: made.toISOString(), ...stamp(made) }, ...all]);
    if (!showsFolder) setFolderId(DEFAULT_FOLDER);
    setNoteId(id);
    setQuery("");
    setBrowsing(false);
    setView("list");
    setPane("notes");
  };
  // The links kept while Notes was closed, then each one shared while it is open: this window
  // takes them once it shows the person's notes (it is built only once they have been read).
  const sharedNote = useRef(addSharedNote);
  sharedNote.current = addSharedNote;
  useEffect(() => {
    for (const link of takeSharedLinks("notes")) sharedNote.current(link);
    return onSharedLink("notes", (link) => sharedNote.current(link));
  }, []);

  /** Services > New Note With Selection: a note of the text, in the folder shown, and selected. */
  const addTextNote = (text: string) => {
    const id = newId("shared-note");
    const made = new Date();
    const folder = newNoteFolder;
    const lines = text.split(/\r?\n/);
    setNotes((all) => [{ id, folder, lines, created: made.toISOString(), ...stamp(made) }, ...all]);
    if (!showsFolder) setFolderId(DEFAULT_FOLDER);
    setNoteId(id);
    setQuery("");
    setBrowsing(false);
    setView("list");
    setPane("notes");
  };
  const textNote = useRef(addTextNote);
  textNote.current = addTextNote;
  useEffect(() => {
    for (const shared of takeSharedText("notes")) textNote.current(shared.text);
    return onSharedText("notes", (shared) => textNote.current(shared.text));
  }, []);

  const addFolder = () => {
    const names = new Set(folders.map((folder) => folder.name));
    let name = "New Folder";
    for (let count = 2; names.has(name); count++) name = `New Folder ${count}`;
    const id = newId("new-folder");
    const local = folders.find((folder) => folder.id === folderId)?.local === true;
    setFolders((all) => [...all, local ? { id, name, local } : { id, name }]);
    setFolderId(id);
    setNoteId(null);
    setQuery("");
    setRenaming(id);
  };

  const renameFolder = (id: string, name: string) => {
    const trimmed = name.trim();
    setRenaming(null);
    if (trimmed === "") return;
    setFolders((all) =>
      all.map((folder) =>
        folder.id === id && folder.name !== trimmed ? { ...folder, name: trimmed } : folder,
      ),
    );
  };

  /** Put `ids` in Recently Deleted: they keep their folder, which Recover returns them to. */
  const deleteNotes = (ids: readonly string[]) => {
    const gone = new Set(ids);
    const left = visible.filter((note) => !gone.has(note.id));
    const at = visible.findIndex((note) => gone.has(note.id));
    // The selection moves to the note that takes the deleted ones' place.
    setNoteId((left[at] ?? left[at - 1] ?? left.at(-1))?.id ?? null);
    setSeveral(null);
    const when = new Date().toISOString();
    // A shared note is not this person's to keep in Recently Deleted unless they own it: its owner
    // stops sharing it, and it goes there; anyone else leaves it.
    for (const entry of shared.notes) {
      if (!gone.has(entry.id)) continue;
      void (entry.owned ? stopSharing(entry.id, when) : leaveNote(entry.id)).then((failure) => {
        if (failure) reportFailure({ url: "/api/notes/shared", reason: failure });
      });
    }
    setNotes((all) =>
      all.map((note) => {
        if (!gone.has(note.id) || note.folder === SHARED_FOLDER) return note;
        const { pinned: _pinned, ...rest } = note;
        return { ...rest, deleted: note.deleted ?? when };
      }),
    );
    setOpened((opens) => opens.filter((other) => !gone.has(other)));
  };

  /** Recently Deleted's Recover: the notes go back to their folders, which may be gone by now. */
  const recoverNotes = (ids: readonly string[]) => {
    const back = new Set(ids);
    const known = new Set(folders.map((folder) => folder.id));
    const first = notes.find((note) => back.has(note.id));
    setSeveral(null);
    setNotes((all) =>
      all.map((note) => {
        if (!back.has(note.id)) return note;
        const { deleted: _deleted, ...rest } = note;
        return { ...rest, folder: known.has(note.folder) ? note.folder : DEFAULT_FOLDER };
      }),
    );
    setOpened((opens) => opens.filter((other) => !back.has(other)));
    if (first) {
      setFolderId(known.has(first.folder) ? first.folder : DEFAULT_FOLDER);
      setNoteId(first.id);
    }
  };

  /** Delete Immediately and Delete All: gone for good, once the alert has been answered. */
  const eraseNotes = (ids: readonly string[]) => {
    const gone = new Set(
      notes
        .filter((note) => note.deleted !== undefined && ids.includes(note.id))
        .map((note) => note.id),
    );
    setNotes((all) => all.filter((note) => !gone.has(note.id)));
    setOpened((opens) => opens.filter((other) => !gone.has(other)));
    setSeveral(null);
    setNoteId(null);
  };

  /**
   * Delete, by each note's own state and never by the folder shown: a live note goes to Recently
   * Deleted, and only a note already there asks to go for good.
   */
  const removeNotes = (ids: readonly string[]) => {
    const chosen = notes.filter((note) => ids.includes(note.id));
    const live = chosen.filter((note) => note.deleted === undefined).map((note) => note.id);
    const thrown = chosen.filter((note) => note.deleted !== undefined).map((note) => note.id);
    if (live.length > 0) deleteNotes(live);
    if (thrown.length > 0) setErasing(thrown);
  };

  /** Move To and a drop on a folder: the notes go there, from Recently Deleted too. */
  const moveNotes = (ids: readonly string[], folder: string) => {
    if (folder === SHARED_FOLDER) return;
    const moving = new Set(ids);
    setNotes((all) =>
      all.map((note) => {
        if (!moving.has(note.id) || note.folder === SHARED_FOLDER) return note;
        const { deleted: _deleted, ...rest } = note;
        return { ...rest, folder };
      }),
    );
    setOpened((opens) => opens.filter((other) => !moving.has(other)));
    setSeveral(null);
  };

  const togglePin = () => {
    const pin = !selectedNotes.every((note) => note.pinned === true);
    const chosen = new Set(selectedIds);
    setNotes((all) =>
      all.map((note) => {
        if (!chosen.has(note.id)) return note;
        const { pinned: _pinned, ...rest } = note;
        return pin ? { ...rest, pinned: true } : rest;
      }),
    );
  };

  /** A folder moved in the sidebar: into another, or before or after it among its siblings. */
  const moveFolder = (id: string, target: string, where: "into" | "before" | "after") => {
    if (id === DEFAULT_FOLDER || folderWithChildren(folders, id).has(target)) return;
    setFolders((all) => {
      const moved = all.find((folder) => folder.id === id);
      const beside = all.find((folder) => folder.id === target);
      if (!moved || !beside) return all;
      const { parent: _parent, ...plain } = moved;
      const parent = where === "into" ? target : beside.parent;
      const placed = parent === undefined ? plain : { ...plain, parent };
      // A folder dropped in the other account goes there with what it holds.
      const going = folderWithChildren(all, id);
      const withAccount = (folder: NotesFolder): NotesFolder => {
        if (!going.has(folder.id)) return folder;
        const { local: _local, ...rest } = folder;
        return beside.local ? { ...rest, local: true } : rest;
      };
      const rest = all.filter((folder) => folder.id !== id).map(withAccount);
      const moving = withAccount(placed);
      if (where === "into") return [...rest, moving];
      const at = rest.findIndex((folder) => folder.id === beside.id) + (where === "after" ? 1 : 0);
      return [...rest.slice(0, at), moving, ...rest.slice(at)];
    });
  };

  const startNotesDrag = (event: DragEvent<HTMLElement>) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-index]");
    const id = visible[Number(row?.dataset.index ?? -1)]?.id;
    if (!id) return;
    const ids = selectedIds.includes(id) ? selectedIds : [id];
    event.dataTransfer.setData(NOTES_DRAG, JSON.stringify(ids));
    event.dataTransfer.setData(
      "text/plain",
      notes
        .filter((note) => ids.includes(note.id))
        .map((note) => note.lines.join("\n"))
        .join("\n\n"),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  /** What a folder's row does with a drag over it: notes go in, a folder goes in or beside it. */
  const folderDropProps = (id: string) => {
    const placeOf = (event: DragEvent<HTMLElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      const y = (event.clientY - box.top) / Math.max(box.height, 1);
      if (y < 0.25) return "before" as const;
      if (y > 0.75 || id === DEFAULT_FOLDER) return "after" as const;
      return "into" as const;
    };
    return {
      "data-drop-target": dropTarget?.id === id ? dropTarget.where : undefined,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        const types = event.dataTransfer.types;
        const isNotes = types.includes(NOTES_DRAG);
        if (!isNotes && (!types.includes(FOLDER_DRAG) || id === RECENTLY_DELETED)) return;
        event.preventDefault();
        event.stopPropagation();
        const where = isNotes ? "into" : placeOf(event);
        if (dropTarget?.id !== id || dropTarget.where !== where) setDropTarget({ id, where });
      },
      onDragLeave: () => setDropTarget(null),
      onDrop: (event: DragEvent<HTMLElement>) => {
        setDropTarget(null);
        const dragged = event.dataTransfer.getData(NOTES_DRAG);
        const folder = event.dataTransfer.getData(FOLDER_DRAG);
        if (!dragged && !folder) return;
        event.preventDefault();
        event.stopPropagation();
        if (folder) {
          if (id !== RECENTLY_DELETED) moveFolder(folder, id, placeOf(event));
          return;
        }
        const ids = (JSON.parse(dragged) as unknown[]).filter(
          (each): each is string => typeof each === "string",
        );
        if (id === RECENTLY_DELETED) deleteNotes(ids);
        else moveNotes(ids, id);
      },
    };
  };

  // Delete acts on the pane last used: a folder goes, and its notes go to Recently Deleted; the
  // folder every account has stays. In Recently Deleted a note goes for good, once confirmed.
  const deletesFolder = pane === "folders" && !searching && showsFolder;
  const canDelete = deletesFolder ? folderId !== DEFAULT_FOLDER : current !== null && !browsing;
  const deleteFolder = (id: string) => {
    if (id === DEFAULT_FOLDER || !folders.some((folder) => folder.id === id)) return;
    const removed = folderWithChildren(folders, id);
    const when = new Date().toISOString();
    setNotes((all) =>
      all.map((note) => {
        if (!removed.has(note.folder)) return note;
        const { pinned: _pinned, ...rest } = note;
        return { ...rest, folder: DEFAULT_FOLDER, deleted: note.deleted ?? when };
      }),
    );
    setFolders((all) => all.filter((folder) => !removed.has(folder.id)));
    if (removed.has(folderId)) {
      setFolderId(folders.find((folder) => !removed.has(folder.id))?.id ?? DEFAULT_FOLDER);
    }
    setNoteId(null);
    setOpened([]);
  };
  const remove = () => {
    if (!canDelete) return;
    if (deletesFolder) deleteFolder(folderId);
    else removeNotes(selectedIds);
  };

  /** Lock Note: asks for a password unless one is at hand. */
  const lockCurrent = () => {
    if (!current) return;
    const noteId = current.id;
    if (notesLock.keyHeld()) {
      void notesLock.lock(noteId).then((result) => {
        if (!result.ok) setLockFailure(result.reason);
      });
      return;
    }
    setLockAsk(
      notes.some((note) => note.sealed)
        ? { kind: "enter", noteId, next: "lock" }
        : { kind: "create", noteId },
    );
  };

  /** Remove Lock: an open note needs nothing more, and a closed one its password. */
  const removeLock = () => {
    if (!current) return;
    const noteId = current.id;
    if (lockView.open.has(noteId)) {
      void notesLock.removeLock(noteId).then((result) => {
        if (!result.ok) setLockFailure(result.reason);
      });
    } else {
      setLockAsk({ kind: "enter", noteId, next: "remove" });
    }
  };

  /**
   * Add content to a note, the one shown unless `id` names another, and edit there: a line or
   * a table goes at the end of the text, before the note's first picture, and a picture goes
   * at the end of the note. Nothing is added to a note that is locked, deleted, or gone, by now.
   */
  const insert = (
    where: "text" | "end",
    build: (document: Document) => { blocks: HTMLElement[]; caret: Node },
    id = current?.id,
  ) => {
    // A window built again meanwhile: its editors are gone, and the one standing now adds this.
    if (!alive.current && memory) {
      if (id !== undefined) memory.inserts = [...(memory.inserts ?? []), { where, build, id }];
      memory.addInserts?.();
      return;
    }
    const note = live.current.find((candidate) => candidate.id === id);
    const editor = note ? editors.get(note.id) : undefined;
    if (!note || !editor || note.deleted !== undefined) return;
    if (revealNote(notesLock.view(), note).locked) return;
    const { blocks, caret } = build(editor.ownerDocument);
    // The picture's block, or the block of the text that holds it, as the editor's own child.
    let before = where === "text" ? editor.querySelector("[data-attachment]") : null;
    while (before && before.parentNode !== editor) before = before.parentElement;
    // Firefox's insertion point cannot stand after a table that ends the editor: Control-End and every
    // click below it land in its last cell, so the note could never go on after the table.
    if (!before && blocks.at(-1)?.tagName === "TABLE") {
      const next = editor.ownerDocument.createElement("div");
      next.append(editor.ownerDocument.createElement("br"));
      blocks.push(next);
    }
    editor.focus();
    const placed = insertUndoably(editor, blocks, caret, before);
    if (!placed) for (const block of blocks) editor.insertBefore(block, before);
    placeCaretAtEnd(placed ?? caret);
    showFiles(editor);
    read(note.id, editor);
  };
  const latestInsert = useRef(insert);
  latestInsert.current = insert;
  const addInserts = () => {
    if (!memory?.inserts?.length) return;
    memory.inserts = memory.inserts.filter(({ where, build, id }) => {
      if (!live.current.some((note) => note.id === id)) return false;
      if (!editors.has(id)) return true;
      latestInsert.current(where, build, id);
      return false;
    });
  };
  const latestAddInserts = useRef(addInserts);
  latestAddInserts.current = addInserts;
  useEffect(() => {
    if (!memory) return;
    memory.addInserts = () => latestAddInserts.current();
  }, [memory]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: each time another note's editor stands
  useEffect(() => latestAddInserts.current(), [currentId, view]);

  const addChecklist = () => listCommand("checklist");

  const addTable = () =>
    insert("text", (document) => {
      const block = document.createElement("table");
      block.className = "mac-notes-table";
      for (let row = 0; row < 2; row++) {
        const cells = block.insertRow();
        for (let column = 0; column < 2; column++) {
          cells.insertCell().append(document.createElement("br"));
        }
      }
      return { blocks: [block], caret: block.rows[0]?.cells[0] ?? block };
    });

  // A picture or any other file is kept first (uploaded, on the desktop), and stands in the note
  // once it is: it goes to the note it was chosen for, unless that note was locked or deleted
  // meanwhile. A short text file becomes the note's own lines.
  const addPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    const id = current?.id;
    if (!file || id === undefined) return;
    if (!takesFile(file)) {
      setRefusedFiles([file.name]);
      return;
    }
    attachFile(file, id);
  };

  const attachFile = (file: File, id: string) => {
    if (live.current.find((note) => note.id === id)?.sealed) {
      setFileFailure({ name: file.name, reason: FILES_NOT_LOCKED });
      return;
    }
    if (isTextFile(file) && !isPictureFile(file) && file.size <= MAX_TEXT_FILE) {
      void file.text().then((text) =>
        insert(
          "end",
          (document) => {
            const blocks = text.split(/\r?\n/).map((each) => {
              const block = document.createElement("div");
              if (each === "") block.append(document.createElement("br"));
              else block.textContent = each;
              return block;
            });
            return { blocks, caret: blocks.at(-1) as HTMLElement };
          },
          id,
        ),
      );
      return;
    }
    const kept = Promise.all([
      keepNoteFile(file),
      isPictureFile(file) ? pictureSources(file) : undefined,
    ]);
    kept.then(
      ([record, picture]) =>
        insert(
          "end",
          (document) => {
            const block = fileBlock(document, record, picture);
            const line = document.createElement("div");
            line.append(document.createElement("br"));
            // The file and the line under it are the editor's own children, like its text.
            return { blocks: [block, line], caret: line };
          },
          id,
        ),
      (error: unknown) =>
        setFileFailure({
          name: file.name,
          reason: error instanceof Error ? error.message : "It could not be read.",
        }),
    );
  };

  // Files from Finder, the desktop or a Share menu. The note shown takes a drop; anything else, a
  // share among them, makes a new note. One import at a time: the next new note waits until this
  // one's editor stands and has its files.
  const localImports = useRef<NotesImports>({ queue: [], importing: null });
  if (memory && !memory.imports) memory.imports = localImports.current;
  const imports = memory?.imports ?? localImports.current;
  const nextImport = () => {
    if (!alive.current || imports.importing) return;
    const files = imports.queue.shift();
    if (!files) return;
    imports.importing = files;
    addNote();
  };
  const latestNext = useRef(nextImport);
  latestNext.current = nextImport;
  const takeFiles = async (items: readonly DesktopDragItem[], intoShown: boolean) => {
    const given = await filesOfDrag(items);
    const files = given.filter(takesFile);
    if (files.length < given.length)
      setRefusedFiles(given.filter((file) => !files.includes(file)).map((file) => file.name));
    if (files.length === 0) return;
    if (intoShown && editable && current) {
      for (const file of files) attachFile(file, current.id);
      return;
    }
    imports.queue.push(files);
    latestNext.current();
  };
  const latestTake = useRef(takeFiles);
  latestTake.current = takeFiles;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the files wait for the new note's editor
  useEffect(() => {
    const files = imports.importing;
    if (files && currentId && editors.has(currentId)) {
      imports.importing = null;
      for (const file of files) attachFile(file, currentId);
    }
    latestNext.current();
  }, [currentId, view]);
  useEffect(() => {
    for (const shared of takeSharedFiles("notes")) void latestTake.current(shared.items, false);
    return onSharedFiles("notes", (shared) => void latestTake.current(shared.items, false));
  }, []);
  // Finder's Open With and a drop on the Dock tile: the file becomes a new note.
  useEffect(() => {
    const open = ({ id, name }: OpenFileRequest) =>
      void latestTake.current([{ id, name, kind: "file" }], false);
    for (const request of takeOpenFileRequests("notes")) open(request);
    return onOpenFileRequest("notes", open);
  }, []);
  const dropRef = useDesktopDrop<HTMLDivElement>({
    accepts: (item) => item.kind !== "file" || takesFile(item),
    onDrop: (items) => void takeFiles(items, true),
    refusal: () => FILE_LIMIT,
  });

  /** Edit > Attach File… and Media > Other…: what the note can take goes in; the rest is named. */
  const attachChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = "";
    const id = current?.id;
    setRefusedFiles(files.filter((file) => !takesFile(file)).map((file) => file.name));
    if (id === undefined) return;
    for (const file of files.filter(takesFile)) attachFile(file, id);
  };

  /** File > Import to Notes…: each file a note can take becomes a note of its own. */
  const importChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.currentTarget.files ?? [])];
    event.currentTarget.value = "";
    setRefusedFiles(files.filter((file) => !takesFile(file)).map((file) => file.name));
    for (const file of files.filter(takesFile)) imports.queue.push([file]);
    latestNext.current();
  };

  /**
   * The note the Format commands act on, its editor and its selection keeper: the note shown,
   * unless it is locked or the gallery is shown.
   */
  const formatTarget = () => {
    const editor = editable && current ? editors.get(current.id) : undefined;
    const keeper = editable && current ? keepers.get(current.id) : undefined;
    return current && editor && keeper ? { id: current.id, editor, keeper } : null;
  };

  /**
   * The Format menu's lists: the lines with the selection become a list of that kind (a list of
   * the other kind changes kind), or plain lines again when they already are one, as the browser's
   * list commands do. Return then continues the list, and on an empty item ends it. A checklist and
   * a dashed list are bulleted lists with a class of their own.
   */
  const listCommand = (kind: NotesListKind) => {
    const target = formatTarget();
    if (!target) return;
    const range = target.keeper.restore();
    const document = target.editor.ownerDocument;
    const before = listAt(target.editor, nodeAt(range));
    const caret = range.collapsed ? range.startContainer : null;
    const caretText = caret?.nodeType === 3 ? caret.nodeValue : null;
    const caretOffset = range.startOffset;
    const unordered = kind !== "numbered";
    const kinds = listKindHistory(target.editor);
    kinds.note();
    const kindsBefore = kinds.kinds();
    // Between the kinds of a bulleted list only its class changes; else the browser's command.
    const kindOnly = unordered && before !== null && before !== "numbered" && before !== kind;
    if (!kindOnly) {
      document.execCommand(unordered ? "insertUnorderedList" : "insertOrderedList");
    }
    const selection = document.getSelection();
    // Chromium's list commands move the line's text to a new node, and the insertion point to its start.
    if (caretText !== null && selection?.anchorNode?.nodeValue === caretText) {
      selection.collapse(selection.anchorNode, caretOffset);
    }
    const at = selection && selection.rangeCount > 0 ? nodeAt(selection.getRangeAt(0)) : null;
    if (before !== kind) {
      for (let node = at; node && node !== target.editor; node = node.parentNode) {
        if (node.nodeName !== "UL") continue;
        // On the list itself: `listKindHistory` keeps it for Undo and Redo, since Chromium's
        // insertHTML over a list keeps the old element and drops a class.
        const list = node as HTMLElement;
        list.classList.remove(CHECKLIST_CLASS, DASHED_CLASS);
        if (kind === "checklist") list.classList.add(CHECKLIST_CLASS);
        if (kind === "dashed") list.classList.add(DASHED_CLASS);
        if (list.classList.length === 0) list.removeAttribute("class");
        break;
      }
    }
    if (kindOnly) kinds.changed(kindsBefore);
    else kinds.note();
    read(target.id, target.editor);
    follow(target.editor);
  };

  /** The Format commands that act on the text around the insertion point. */
  const textMenuCommand = (command: NotesTextCommand) => {
    if (command === "add-table") {
      addTable();
      return;
    }
    const target = formatTarget();
    if (!target) return;
    const range = target.keeper.restore();
    const at = nodeAt(range);
    const document = target.editor.ownerDocument;
    switch (command) {
      case "item-up":
      case "item-down":
        moveListItem(target.editor, at, command === "item-up");
        break;
      case "table-to-text": {
        const line = tableToText(target.editor, at, readLines);
        if (line) placeCaretAtEnd(line);
        break;
      }
      case "indent":
      case "outdent":
        document.execCommand(command);
        break;
      case "copy-style":
        copiedStyle.current = readRichTextFormat(target.editor);
        return;
      case "paste-style":
        if (copiedStyle.current) applyRichTextFormat(target.editor, copiedStyle.current);
        break;
      case "direction-natural":
      case "direction-ltr":
      case "direction-rtl":
        setLineDirection(
          target.editor,
          command.slice("direction-".length) as NotesDirection,
          target.editor.ownerDocument.getSelection()?.getRangeAt(0) ?? range,
        );
        break;
      default:
        runChecklist(target.editor, at, command as ChecklistCommand);
    }
    read(target.id, target.editor);
    follow(target.editor);
  };

  /** Tab and Shift-Tab in a list item: the item one level in, or one out (out of the list). */
  const indentList = (outward: boolean) => {
    const target = formatTarget();
    if (!target) return;
    target.editor.ownerDocument.execCommand(outward ? "outdent" : "indent");
    read(target.id, target.editor);
    follow(target.editor);
  };

  /**
   * Format > Table and its key equivalents: add a row above or below, or a column before or
   * after, the cell with the insertion point, or delete its row or column, and put the insertion
   * point where the change says. The note is read afterwards, so the table is saved with it.
   */
  const tableCommand = (command: NotesTableCommand) => {
    const target = formatTarget();
    if (!target) return;
    target.keeper.restore();
    const cell = tableCellAtSelection(target.editor);
    if (!cell) return;
    // One step of the browser's undo history: Edit > Undo and Command-Z put the table back.
    const caret = changeTableUndoably(target.editor, cell, command);
    if (caret) placeTableCaret(caret);
    read(target.id, target.editor);
    follow(target.editor);
  };

  /** Tab and Shift-Tab in a table: the next or previous cell, and a new row after the last. */
  const tableTab = (backwards: boolean) => {
    const target = formatTarget();
    if (!target) return;
    const cell = tableCellAtSelection(target.editor);
    const to = cell ? nextCell(cell, backwards, target.editor) : null;
    if (!to) return;
    placeTableCaret(to);
    read(target.id, target.editor);
    follow(target.editor);
  };

  /** Format > Title and the other paragraph styles: the line with the insertion point takes it. */
  const paragraphStyle = (style: NotesParagraphStyle) => {
    const target = formatTarget();
    if (!target) return;
    const range = target.keeper.restore();
    if (setLineStyle(target.editor, style, nodeAt(range))) read(target.id, target.editor);
    follow(target.editor);
  };

  /**
   * Format > Font and Format > Text, from a menu or a key equivalent: a style, a size or an
   * alignment for the selection, or one of the two panels. The note keeps the keyboard.
   */
  const textCommand = (command: RichTextCommand) => {
    if (command === "show-fonts" || command === "show-colors") {
      (command === "show-fonts" ? setFontsShown : setColorsShown)(true);
      formatTarget()?.keeper.restore();
      return;
    }
    const target = formatTarget();
    if (!target) return;
    target.keeper.restore();
    runRichTextCommand(target.editor, command);
    read(target.id, target.editor);
    follow(target.editor);
  };

  /**
   * What a control of the Fonts or the Colors panel changed, for the selection in the note. The
   * control keeps the keyboard, so that the person can go on choosing in the panel.
   */
  const changeFont = (change: Partial<RichTextFormat>) => {
    const target = formatTarget();
    if (!target) return;
    const document = target.editor.ownerDocument;
    const back = document.activeElement;
    target.keeper.restore();
    // The system font is the note's own family, as the browser resolves it.
    const family =
      change.family === SYSTEM_FONT.name
        ? document.defaultView?.getComputedStyle(target.editor).fontFamily || SYSTEM_FONT.css
        : change.family;
    applyRichTextFormat(target.editor, family === undefined ? change : { ...change, family });
    // The browser now selects what the command made. Keep that selection before a panel's field
    // takes the keyboard back below: the keeper's "selectionchange" arrives only once the field
    // has the focus and the document's selection with it, and the range it kept before the
    // command may have collapsed with the nodes the command moved. Without this, the next change
    // from the panel (the next digit typed in a value field, a slider moved again) would act on
    // an empty selection and the panel would snap back to the colour at the caret.
    target.keeper.restore();
    read(target.id, target.editor);
    follow(target.editor);
    if (
      back instanceof HTMLElement &&
      back !== target.editor &&
      panelLayer.current?.contains(back)
    ) {
      back.focus({ preventScroll: true });
    }
  };

  /** A panel closed: the note takes the keyboard back. */
  const closePanel = (hide: (shown: boolean) => void) => {
    hide(false);
    formatTarget()?.keeper.restore();
  };

  // The key equivalents of the Font and Text commands, while the note being edited has the
  // keyboard. They are the browser's own editing keys too (Command-B), which are replaced. In a
  // list, Tab and Shift-Tab indent and outdent the item; Shift-Command-7 and -9 make the lines a
  // bulleted or a numbered list. In a table, Tab and Shift-Tab go to the next and previous cell,
  // and Option-Command (Control-Option off Apple platforms) with an arrow adds a row or a column.
  const editorKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    const editor = current ? editors.get(current.id) : undefined;
    if (!editor?.contains(event.target as Node)) return;
    const cell = editable ? tableCellAtSelection(editor) : null;
    if (cell && event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      tableTab(event.shiftKey);
      return;
    }
    const tableKey =
      cell && event.altKey && !event.shiftKey && (event.metaKey || event.ctrlKey)
        ? TABLE_KEY_COMMANDS[event.key]
        : undefined;
    if (tableKey) {
      event.preventDefault();
      tableCommand(tableKey);
      return;
    }
    if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const selection = editor.ownerDocument.getSelection();
      const at = selection && selection.rangeCount > 0 ? nodeAt(selection.getRangeAt(0)) : null;
      if (listAt(editor, at) && editable) {
        event.preventDefault();
        indentList(event.shiftKey);
      }
      return;
    }
    const list =
      event.shiftKey && !event.altKey && (event.metaKey || event.ctrlKey)
        ? event.code === "Digit7"
          ? "bulleted"
          : event.code === "Digit9"
            ? "numbered"
            : null
        : null;
    if (list) {
      event.preventDefault();
      listCommand(list);
      return;
    }
    const command = richTextKeyCommand(event.nativeEvent);
    if (!command) return;
    event.preventDefault();
    textCommand(command);
  };

  const status = useMemo<NotesStatus>(
    () => ({ editable, format, paragraph, list: listKind, table: inTable, direction }),
    [editable, format, paragraph, listKind, inTable, direction],
  );
  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);
  useImperativeHandle(actionsRef, () => ({
    newNote: addNote,
    setParagraphStyle: paragraphStyle,
    runTextCommand: textCommand,
    setList: listCommand,
    runTableCommand: tableCommand,
    focusNote: () => void formatTarget()?.keeper.restore(),
  }));

  // On the desktop, the menu bar's Format menu holds the commands of the toolbar's format
  // button, for the note this window shows, checked where its insertion point is. They act
  // through the render they run after, and the note takes the keyboard back once the menu has
  // closed (the desktop's menu gives it to its title).
  const latestFormat = useRef({
    paragraphStyle,
    textCommand,
    list: listCommand,
    table: tableCommand,
    text: textMenuCommand,
    focus: () => void formatTarget()?.keeper.restore(),
  });
  latestFormat.current = {
    paragraphStyle,
    textCommand,
    list: listCommand,
    table: tableCommand,
    text: textMenuCommand,
    focus: () => void formatTarget()?.keeper.restore(),
  };
  const desktopFormatMenu = useMemo(
    () => (
      <NotesFormatItems
        status={status}
        onChoose={() => whenMenusClosed(document, () => latestFormat.current.focus())}
        onParagraphStyle={(style) => latestFormat.current.paragraphStyle(style)}
        onTextCommand={(command) => latestFormat.current.textCommand(command)}
        onList={(kind) => latestFormat.current.list(kind)}
        onTable={(command) => latestFormat.current.table(command)}
        onCommand={(command) => latestFormat.current.text(command)}
      />
    ),
    [status],
  );
  useDesktopAppMenu("notes", "Format", desktopFormatMenu, titleBar);

  /** Add Link's address: on the selected text, or as its own text at an insertion point. */
  const addLink = (address: string) => {
    setAddingLink(false);
    setLinkToAdd(address);
  };
  // Once the sheet has let the window go: the note takes no selection while it is inert.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs for the address the sheet gave
  useEffect(() => {
    if (linkToAdd === null || addingLink) return;
    setLinkToAdd(null);
    const target = formatTarget();
    if (!target) return;
    const range = target.keeper.restore();
    const document = target.editor.ownerDocument;
    if (range.collapsed) {
      const link = document.createElement("a");
      link.href = linkToAdd;
      link.textContent = linkToAdd;
      document.execCommand("insertHTML", false, link.outerHTML);
    } else document.execCommand("createLink", false, linkToAdd);
    read(target.id, target.editor);
    follow(target.editor);
  }, [linkToAdd, addingLink]);

  const changeZoom = (change: "in" | "out" | "actual") =>
    setZoom(
      change === "actual"
        ? 1
        : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + (change === "in" ? 0.25 : -0.25))),
    );
  const printNote = () => {
    const current = shownCurrent;
    if (!current || current.locked) return;
    const editor = editors.get(current.id);
    let html = editor?.innerHTML;
    if (html === undefined) {
      // A note selected in the gallery that was never opened has no editor yet.
      const holder = document.createElement("div");
      holder.append(noteContent(current, document));
      if (isSavedPicture(current.picture) || current.attachment) {
        const picture = document.createElement("img");
        picture.src = isSavedPicture(current.picture)
          ? current.picture
          : current.attachment === "screenshot"
            ? SCREENSHOT
            : PHOTO;
        picture.style.maxWidth = "100%";
        holder.append(picture);
      }
      html = holder.innerHTML;
    }
    printDocument({
      name: summarize(current).title,
      html,
      lines: current.lines,
      plain: false,
    });
  };
  const shareAddress =
    selectedIds.length === 1 && current && !current.locked ? firstAddress(current.lines) : null;
  const shareTitle = current ? summarize(current).title : "";
  const noteText = () => current?.lines.join("\n").trim() ?? "";
  const noteShare: NoteShare = {
    address: shareAddress,
    reason:
      selectedIds.length !== 1 || !current
        ? SELECT_ONE_TO_SHARE
        : current.locked
          ? LOCKED_NOT_SHARED
          : null,
    // Mail and Messages take files: the note's text as one, with what is attached to it.
    toApp: (app) => {
      if (!current) return;
      const text = noteText();
      const items: DesktopDragItem[] = [
        {
          id: `note-text-${current.id}`,
          name: `${shareTitle.replace(/[/\\:]/g, "-").slice(0, 80) || "Note"}.txt`,
          kind: "file",
          type: "text/plain",
          size: new Blob([text]).size,
          bytes: async () => new Blob([text], { type: "text/plain" }),
        },
        ...(current.files ?? []).map((file) => ({
          id: `note-file-${file.id}`,
          name: file.name,
          kind: "file" as const,
          type: file.type,
          size: file.size,
          bytes: () => readNoteFile(file),
        })),
      ];
      if (!shareFiles(app, items, "notes") && shareAddress) {
        shareLink(app, shareAddress, shareTitle, "notes");
      }
    },
    link: (app) => {
      if (shareAddress) shareLink(app, shareAddress, shareTitle, "notes");
    },
    hasText: noteText() !== "",
    reminder: () => void shareTextWithReminders(noteText()),
    copy: () => void copyText(noteText()),
  };
  const chooseView = (next: "list" | "gallery") => {
    setBrowsing(false);
    setView(next);
  };
  const windowMenu: NotesWindowMenu = {
    selected: selectedIds.length,
    pinned: selectedNotes.length > 0 && selectedNotes.every((note) => note.pinned === true),
    lock: {
      state: !current?.sealed ? "plain" : lockView.open.has(current.id) ? "open" : "closed",
      lockReason: !lockAvailable()
        ? LOCK_UNAVAILABLE
        : selectedIds.length !== 1 || !current
          ? SELECT_ONE_TO_LOCK
          : current.deleted !== undefined
            ? DELETED_NOT_LOCKED
            : current.folder === SHARED_FOLDER
              ? SHARED_NOT_LOCKED
              : (current.files?.length ?? 0) > 0
                ? FILES_NOT_LOCKED
                : null,
      anyOpen: lockView.open.size > 0,
      hasPassword: notes.some((note) => note.sealed),
      lock: lockCurrent,
      removeLock,
      closeAll: () => notesLock.closeAll(),
      changePassword: () => setLockAsk({ kind: "change" }),
    },
    inDeleted:
      selectedNotes.length > 0 && selectedNotes.every((note) => note.deleted !== undefined),
    view,
    sort,
    foldersShown,
    noteCount,
    attachmentsBrowser: browsing,
    attachmentView,
    share: noteShare,
    newNote: addNote,
    newFolder: addFolder,
    importFiles: () => importInput.current?.click(),
    togglePin,
    recover: () => recoverNotes(selectedIds),
    print: printNote,
    setView: chooseView,
    setSort,
    toggleFolders: () => setFoldersShown(!foldersShown),
    toggleNoteCount: () => setNoteCount(!noteCount),
    toggleAttachments: () => setBrowsing(!browsing),
    setAttachmentView,
    zoom: changeZoom,
  };
  const latestMenu = useRef(windowMenu);
  latestMenu.current = windowMenu;
  // The menu bar holds these items while another render may be current: what they show is rendered
  // anew when it changes, and what they do goes through the render they run after.
  const menuState = [
    selectedIds.length,
    windowMenu.pinned,
    windowMenu.lock.state,
    windowMenu.lock.lockReason,
    windowMenu.lock.anyOpen,
    windowMenu.lock.hasPassword,
    windowMenu.inDeleted,
    view,
    sort,
    foldersShown,
    noteCount,
    browsing,
    attachmentView,
    noteShare.address,
    noteShare.reason,
    noteShare.hasText,
  ].join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the items change with what they show
  const desktopMenus = useMemo(() => {
    const menu: NotesWindowMenu = {
      ...latestMenu.current,
      share: {
        ...latestMenu.current.share,
        toApp: (app) => latestMenu.current.share.toApp(app),
        link: (app) => latestMenu.current.share.link(app),
        reminder: () => latestMenu.current.share.reminder(),
        copy: () => latestMenu.current.share.copy(),
      },
      newNote: () => latestMenu.current.newNote(),
      newFolder: () => latestMenu.current.newFolder(),
      importFiles: () => latestMenu.current.importFiles(),
      togglePin: () => latestMenu.current.togglePin(),
      lock: {
        ...latestMenu.current.lock,
        lock: () => latestMenu.current.lock.lock(),
        removeLock: () => latestMenu.current.lock.removeLock(),
        changePassword: () => latestMenu.current.lock.changePassword(),
      },
      recover: () => latestMenu.current.recover(),
      print: () => latestMenu.current.print(),
      setView: (next) => latestMenu.current.setView(next),
      setSort: (next) => latestMenu.current.setSort(next),
      toggleFolders: () => latestMenu.current.toggleFolders(),
      toggleNoteCount: () => latestMenu.current.toggleNoteCount(),
      toggleAttachments: () => latestMenu.current.toggleAttachments(),
      setAttachmentView: (next) => latestMenu.current.setAttachmentView(next),
      zoom: (change) => latestMenu.current.zoom(change),
    };
    return { file: <NotesFileItems menu={menu} />, view: <NotesViewItems menu={menu} /> };
  }, [menuState]);
  useDesktopAppMenu("notes", "File", desktopMenus.file, titleBar);
  useDesktopAppMenu("notes", "View", desktopMenus.view, titleBar);
  const anyLockOpen = lockView.open.size > 0;
  const applicationMenu = useMemo(
    () => <NotesApplicationItems anyOpen={anyLockOpen} onCloseAll={() => notesLock.closeAll()} />,
    [anyLockOpen],
  );
  useDesktopAppMenu("notes", "Notes", applicationMenu, titleBar);

  const find = useTextFind(
    () => (current ? editors.get(current.id) : null),
    `${current?.id}\n${shownCurrent?.lines.join("\n")}`,
  );
  const latestFind = useRef(find);
  latestFind.current = find;

  // The window's key equivalents, wherever in the window the keyboard is. The key window alone
  // answers them, after anything inside it that took the key (`editorKeys`).
  const toolTarget = useCallback(() => latestEdit.current()?.element ?? null, []);
  const checkSpelling = useCallback(
    () => checkDocumentAfterMenu(toolTarget, () => [...latestLearned.current, ...ignoredWords]),
    [toolTarget, ignoredWords],
  );
  const latestKeys = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  latestKeys.current = (event) => {
    if (event.defaultPrevented || !titleBar?.isConnected) return;
    const state = titleBar.closest("[data-window-state]")?.getAttribute("data-window-state");
    if (state !== undefined && state !== null && state !== "key") return;
    const anywhere: [string, () => void][] = [
      ["command+n", addNote],
      ["shift+command+n", addFolder],
      ["command+1", () => chooseView("list")],
      ["command+2", () => chooseView("gallery")],
      ["command+3", () => setBrowsing(!browsing)],
      ["option+command+s", () => setFoldersShown(!foldersShown)],
      ["command+p", printNote],
      ["shift+command+>", () => changeZoom("in")],
      ["shift+command+<", () => changeZoom("out")],
      ["shift+command+0", () => changeZoom("actual")],
      ["command+f", find.open],
      ["command+g", () => find.move(false)],
      ["shift+command+g", () => find.move(true)],
      ["command+e", find.fromSelection],
      ["command+j", find.jump],
      ["option+command+f", () => titleBar.querySelector<HTMLInputElement>("input")?.focus()],
      ["shift+command+;", () => setSpellingShown(true)],
      ["command+;", checkSpelling],
    ];
    const inNote: [string, () => void][] = [
      ["shift+command+t", () => paragraphStyle("title")],
      ["shift+command+h", () => paragraphStyle("heading")],
      ["shift+command+j", () => paragraphStyle("subheading")],
      ["shift+command+b", () => paragraphStyle("body")],
      ["shift+command+m", () => paragraphStyle("monospaced")],
      ["shift+command+8", () => listCommand("dashed")],
      ["shift+command+l", () => listCommand("checklist")],
      ["shift+command+u", () => textMenuCommand("mark-checked")],
      ["control+command+up", () => textMenuCommand("item-up")],
      ["control+command+down", () => textMenuCommand("item-down")],
      ["option+command+t", () => textMenuCommand("add-table")],
      ["command+]", () => textMenuCommand("indent")],
      ["command+[", () => textMenuCommand("outdent")],
      ["option+command+c", () => textMenuCommand("copy-style")],
      ["option+command+v", () => textMenuCommand("paste-style")],
      ["command+k", () => setAddingLink(true)],
      ["shift+command+a", () => fileInput.current?.click()],
    ];
    for (const [equivalent, run] of editable ? [...inNote, ...anywhere] : anywhere) {
      if (!matchesMenuKeyEquivalent(event, equivalent)) continue;
      event.preventDefault();
      run();
      return;
    }
  };
  useEffect(() => {
    const listen = (event: globalThis.KeyboardEvent) => latestKeys.current(event);
    document.addEventListener("keydown", listen);
    return () => document.removeEventListener("keydown", listen);
  }, []);

  // Its Edit menu acts on the note shown, a locked one too (Copy and Select All), and gives it the
  // keyboard and its selection back.
  const latestEdit = useRef<() => EditMenuTarget | null>(() => null);
  latestEdit.current = () => {
    const editor =
      view === "list" && !browsing && current && !severalShown
        ? editors.get(current.id)
        : undefined;
    if (!current || !editor) return null;
    const keeper = keepers.get(current.id);
    return {
      element: editor,
      restore: () => (keeper ? keeper.restore() : editor.focus({ preventScroll: true })),
      editable: !shownCurrent?.locked && current.deleted === undefined,
      rich: true,
      document: current.id,
      history: (way) => listKindHistory(editor).take(way),
    };
  };
  const desktopEditMenu = useMemo(
    () => (
      <>
        <EditorEditItems target={() => latestEdit.current()} />
        <EditorMoreItems
          target={() => latestEdit.current()}
          find={() => latestFind.current}
          retainStyle
          beforeFind={
            <>
              <MenuItem keyEquivalent="shift+command+a" onClick={() => fileInput.current?.click()}>
                Attach File…
              </MenuItem>
              <MenuItem
                disabled={!editable}
                keyEquivalent="command+k"
                onClick={() => setAddingLink(true)}
              >
                Add Link…
              </MenuItem>
              <InsertFromIPhoneSubmenu />
              <MenuSeparator />
              <SpellingItems
                disabled={!editable}
                whileTyping={spelling}
                onToggleWhileTyping={() => setSpelling(!spelling)}
                onShow={() => setSpellingShown(true)}
                onCheckNow={checkSpelling}
              />
              <SubstitutionItems
                disabled={!editable}
                settings={substitutions}
                onChange={setSubstitutions}
                onShow={() => setSubstitutionsShown(true)}
              />
            </>
          }
        />
      </>
    ),
    [editable, spelling, setSpelling, substitutions, setSubstitutions, checkSpelling],
  );
  useDesktopAppMenu("notes", "Edit", desktopEditMenu, titleBar);

  /** Open in New Window and a double click in the note list: the note in a window of its own. */
  const openNoteWindow = (id: string) => {
    setNoteWindows((open) => (open.includes(id) ? open : [...open, id]));
    setWindowAsked((asked) => ({ id, serial: (asked?.serial ?? 0) + 1 }));
  };

  // A note this page and another window changed at the same time (`NotesConflict`): the version
  // saved first stays in the note and this window's is a copy beside it. The window says so above
  // the note until the person has read it, and offers this window's version back.
  const allConflicts = useNotesConflicts();
  const conflicts = allConflicts.filter(
    (conflict) =>
      notes.some((note) => note.id === conflict.noteId) &&
      notes.some((note) => note.id === conflict.copyId),
  );
  const showMyVersion = (conflict: NotesConflict) => {
    const copy = notes.find((note) => note.id === conflict.copyId);
    if (!copy) return;
    setQuery("");
    setBrowsing(false);
    setView("list");
    setFolderId(copy.folder);
    setNoteId(copy.id);
  };
  const keepMyVersion = (conflict: NotesConflict) => {
    dismissNotesConflict(conflict.copyId);
    // The note takes this window's version and the copy the other's; saved as a document every
    // window adopts, so that each editor is built again with its note's new text.
    saveAllNotes({ folders, notes: keepConflictCopy(notes, conflict) }, {});
  };

  const counts = useMemo(() => {
    const byFolder = new Map<string, number>();
    let deleted = 0;
    for (const note of notes) {
      if (note.deleted !== undefined) deleted += 1;
      else byFolder.set(note.folder, (byFolder.get(note.folder) ?? 0) + 1);
    }
    byFolder.set(RECENTLY_DELETED, deleted);
    return byFolder;
  }, [notes]);

  // The Pinned and Notes headings, over the first row of each, while a note of the folder is pinned.
  const pinnedCount = useMemo(
    () => (inDeleted ? 0 : visible.filter((note) => note.pinned === true).length),
    [visible, inDeleted],
  );
  const headingAt = useCallback(
    (index: number) =>
      pinnedCount === 0 ? null : index === 0 ? "Pinned" : index === pinnedCount ? "Notes" : null,
    [pinnedCount],
  );
  const rowHeight = useMemo(
    () =>
      pinnedCount === 0
        ? ROW_HEIGHT
        : (index: number) => ROW_HEIGHT + (headingAt(index) ? SECTION_HEIGHT : 0),
    [pinnedCount, headingAt],
  );

  const renderRow = useCallback(
    (index: number) => {
      const listed = visible[index];
      if (!listed) return null;
      const note = reveal(listed);
      const { title, snippet } = summarize(note);
      const heading = headingAt(index);
      const thumbnail =
        note.picture ??
        (note.attachment
          ? note.attachment === "photo"
            ? PHOTO_THUMBNAIL
            : SCREENSHOT_THUMBNAIL
          : undefined);
      const firstFile = note.files?.[0];
      return (
        <>
          {heading ? <span className="mac-notes-section">{heading}</span> : null}
          <ListViewRowTitle>
            {note.pinned ? (
              <span className="mac-notes-row-mark">
                <PinGlyph />
              </span>
            ) : null}
            {listed.sealed ? (
              <span
                className="mac-notes-row-mark"
                role="img"
                aria-label={note.sealed ? "Locked" : "Unlocked"}
              >
                {note.sealed ? <LockGlyph /> : <OpenLockGlyph />}
              </span>
            ) : null}
            {note.folder === SHARED_FOLDER ? (
              <span className="mac-notes-row-mark" role="img" aria-label="Shared">
                <PeopleGlyph />
              </span>
            ) : null}
            {title}
          </ListViewRowTitle>
          <ListViewRowDetail lead={note.date}>{snippet}</ListViewRowDetail>
          {thumbnail ? (
            <ListViewRowTrailing>
              <span className="mac-notes-thumbnail">
                <ImageView src={thumbnail} width={41} height={40} />
              </span>
            </ListViewRowTrailing>
          ) : firstFile ? (
            <ListViewRowTrailing>
              <NoteFileIcon name={firstFile.name} />
            </ListViewRowTrailing>
          ) : null}
        </>
      );
    },
    [visible, headingAt, reveal],
  );
  const rowId = useCallback((index: number) => visible[index]?.id ?? index, [visible]);
  const rowLabel = useCallback(
    (index: number) => {
      const note = visible[index];
      return note ? summarize(reveal(note)).title : "";
    },
    [visible, reveal],
  );
  const renderCard = useCallback(
    (index: number) => {
      const listed = visible[index];
      const note = listed && reveal(listed);
      return (
        <span className="mac-notes-card">
          {note?.sealed ? (
            <span className="mac-notes-card-line" role="img" aria-label="Locked">
              <LockGlyph />
            </span>
          ) : (
            note?.lines.slice(0, 4).map((line, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity of their own
              <span key={at} className="mac-notes-card-line">
                {line}
              </span>
            ))
          )}
        </span>
      );
    },
    [visible, reveal],
  );

  // The toolbar's groups follow the panes under them: the first starts 3 pt after the
  // sidebar's divider, the second 4 pt after the note list's.
  const sidebar = foldersShown ? sidebarWidth + 1 : 0;
  const firstGroup = Math.max(SWITCHER_END + 2 * GAP + 32, sidebar + 3);
  const editorEdge = sidebar + (view === "list" && !browsing ? listWidth + 1 : 0);
  const secondGroup = Math.max(firstGroup + GROUP + 2 * GAP + 8, editorEdge + 4);
  const selection = selectedIds;
  // A note Spotlight found: in its folder, or in Recently Deleted, with no search hiding it. A
  // window opened by the request may not have its notes yet, so the request waits for them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the callback changes on each build; only the request or the notes ask this again.
  useEffect(() => {
    const note = notes.find((each) => each.id === askedNote);
    if (!note) return;
    onAskNote?.(null);
    setQuery("");
    setBrowsing(false);
    setFolderId(note.deleted === undefined ? note.folder : RECENTLY_DELETED);
    setSeveral(null);
    setNoteId(note.id);
    setPane("notes");
  }, [askedNote, notes, setFolderId, setNoteId]);
  const select = (ids: (string | number)[]) => {
    const chosen = ids.filter((id): id is string => typeof id === "string");
    setSeveral(chosen.length > 1 ? chosen : null);
    const lead = chosen.at(-1);
    if (lead !== undefined) setNoteId(lead);
  };
  const host = mounted
    ? panelContainer === undefined
      ? globalThis.document.body
      : panelContainer
    : null;

  // One grid of cards, or with a note pinned the Pinned and Notes groups, each a grid of its own: a
  // selection stays inside one group.
  const galleryGrid = (label: string, from: number, count: number, height: number | string) => (
    <IconView
      aria-label={label}
      count={count}
      renderIcon={(index) => renderCard(from + index)}
      getItemLabel={(index) => rowLabel(from + index)}
      getItemId={(index) => rowId(from + index)}
      iconSize={84}
      cellWidth={136}
      selectionMode="multiple"
      value={selection}
      onValueChange={select}
      onItemAction={() => {
        setGalleryBack(true);
        setView("list");
      }}
      onFocus={() => setPane("notes")}
      style={{ ...LIST_STYLE, height }}
    />
  );

  return (
    <>
      <TitleBar
        {...titleBarProps}
        ref={setTitleBar}
        variant="title-hidden"
        controls={<WindowControls {...controlsProps} />}
      >
        <Toolbar aria-label="Notes toolbar">
          <ToolbarSegmentedControl
            aria-label="View"
            value={[view]}
            onValueChange={(next) => chooseView(next[0] === "gallery" ? "gallery" : "list")}
          >
            <ToolbarSegment value="list" aria-label="List View" style={LIST_SEGMENT}>
              <SystemImage name="list-view" />
            </ToolbarSegment>
            <ToolbarSegment value="gallery" aria-label="Gallery View" style={GALLERY_SEGMENT}>
              <GalleryGlyph />
            </ToolbarSegment>
          </ToolbarSegmentedControl>
          {galleryBack && view === "list" ? (
            <ToolbarButton
              aria-label="Back to Gallery"
              onClick={() => setView("gallery")}
              style={BUTTON}
            >
              <BackGlyph />
            </ToolbarButton>
          ) : null}
          <ToolbarSpace width={firstGroup - SWITCHER_END - 2 * GAP} style={SHRINK} />
          <ToolbarButton
            aria-label={foldersShown ? "Hide Folders" : "Show Folders"}
            onClick={() => setFoldersShown(!foldersShown)}
            style={BUTTON}
          >
            <SystemImage name="sidebar" />
          </ToolbarButton>
          <ToolbarButton
            aria-label="Attachments Browser"
            pressed={browsing}
            onPressedChange={setBrowsing}
            style={BUTTON}
          >
            <AttachmentsGlyph />
          </ToolbarButton>
          <ToolbarButton aria-label="Delete" disabled={!canDelete} onClick={remove} style={BUTTON}>
            <TrashGlyph />
          </ToolbarButton>
          <ToolbarButton aria-label="New Note" onClick={addNote} style={BUTTON}>
            <ComposeGlyph />
          </ToolbarButton>
          <ToolbarSpace width={secondGroup - firstGroup - GROUP - 2 * GAP} style={SHRINK} />
          <Menu>
            <MenuTrigger
              disabled={syncing || !current}
              render={
                <ToolbarButton aria-label="Lock" disabled={syncing || !current} style={BUTTON}>
                  <LockGlyph />
                  <SystemImage name="chevron-down" />
                </ToolbarButton>
              }
            />
            <MenuPopup sideOffset={4}>
              <NoteLockItems lock={windowMenu.lock} />
            </MenuPopup>
          </Menu>
          <ToolbarButton
            aria-label="Add Table"
            disabled={syncing || !editable}
            onClick={addTable}
            style={BUTTON}
          >
            <TableGlyph />
          </ToolbarButton>
          <ToolbarButton
            aria-label="Make a Checklist"
            disabled={syncing || !editable}
            onClick={addChecklist}
            style={BUTTON}
          >
            <ChecklistGlyph />
          </ToolbarButton>
          {/* Not modal: a command gives the keyboard back to the note while the menu closes,
              which a page made inert by a modal menu would refuse. */}
          <Menu modal={false}>
            <MenuTrigger
              disabled={
                syncing || !current || shownCurrent?.locked || current.deleted !== undefined
              }
              render={
                <ToolbarButton
                  aria-label="Format"
                  disabled={
                    syncing || !current || shownCurrent?.locked || current.deleted !== undefined
                  }
                  style={BUTTON}
                >
                  <span className="mac-notes-format-glyph" aria-hidden="true">
                    Aa
                  </span>
                </ToolbarButton>
              }
            />
            <MenuPopup sideOffset={4} finalFocus={formatFocus.finalFocus}>
              <NotesFormatItems
                status={status}
                onChoose={formatFocus.chosen}
                onParagraphStyle={paragraphStyle}
                onTextCommand={textCommand}
                onList={listCommand}
                onTable={tableCommand}
                onCommand={textMenuCommand}
              />
            </MenuPopup>
          </Menu>
          <ToolbarSpace />
          <Menu>
            <MenuTrigger
              disabled={!current || current.locked || browsing}
              render={
                <ToolbarButton
                  aria-label="Media"
                  disabled={!current || current.locked || browsing}
                  style={BUTTON}
                >
                  <MediaGlyph />
                  <SystemImage name="chevron-down" />
                </ToolbarButton>
              }
            />
            <MenuPopup sideOffset={4}>
              <MenuItem onClick={() => setPhotosOpen(true)}>Photos…</MenuItem>
              <MenuItem onClick={() => fileInput.current?.click()}>Other…</MenuItem>
              <MenuSeparator />
              <InsertFromIPhoneSubmenu />
            </MenuPopup>
          </Menu>
          <Popover>
            <PopoverTrigger
              disabled={!current}
              render={
                <ToolbarButton aria-label="Add People" disabled={!current} style={BUTTON}>
                  <PeopleGlyph />
                </ToolbarButton>
              }
            />
            <PopoverPopup style={{ width: 280 }}>
              <NotePeople
                note={current}
                shared={shared}
                onShare={(name) =>
                  current
                    ? shareNote(current.id, name, { folders, notes }, (id) => {
                        setFolderId(SHARED_FOLDER);
                        setNoteId(id);
                      })
                    : Promise.resolve(null)
                }
              />
            </PopoverPopup>
          </Popover>
          <Menu>
            <MenuTrigger
              disabled={!current}
              render={
                <ToolbarButton aria-label="Share" disabled={!current} style={BUTTON}>
                  <SystemImage name="share" />
                </ToolbarButton>
              }
            />
            <MenuPopup sideOffset={4}>
              <NoteShareItems share={noteShare} />
            </MenuPopup>
          </Menu>
          <ToolbarSearchField
            value={query}
            onValueChange={setQuery}
            style={{ width: 208, flex: "none" }}
          />
        </Toolbar>
      </TitleBar>
      <WindowBody
        ref={dropRef}
        background="content"
        onPasteCapture={(event) => {
          const inNote = (event.target as Element).closest?.('[aria-label="Note"]');
          const pictures = inNote ? clipboardPictures(event.clipboardData) : [];
          const copied = copiedDriveItems();
          const taken = copied.length > 0 ? copied : pictures;
          if (taken.length === 0 || !inNote) return;
          event.preventDefault();
          event.stopPropagation();
          void takeFiles(taken, true);
        }}
      >
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          aria-label="Choose a photo"
          hidden
          onChange={addPhoto}
        />
        {photosOpen ? (
          <NotesPhotos
            anchor={titleBar}
            onChoose={(file) => void takeFiles([file], true)}
            onFromComputer={() => {
              setPhotosOpen(false);
              photoInput.current?.click();
            }}
            onClose={() => setPhotosOpen(false)}
          />
        ) : null}
        <input
          ref={fileInput}
          type="file"
          multiple
          aria-label="Choose a file"
          hidden
          onChange={attachChosen}
        />
        <input
          ref={importInput}
          type="file"
          multiple
          aria-label="Choose files to import"
          hidden
          onChange={importChosen}
        />
        <SplitView style={SPLIT_STYLE}>
          {foldersShown ? (
            <>
              <SplitViewPane
                size={sidebarWidth}
                onSizeChange={setSidebarWidth}
                minSize={150}
                maxSize={320}
              >
                <ContextualMenu>
                  <ContextualMenuTrigger
                    className="mac-notes-menu-area"
                    onContextMenu={(event) => {
                      const target = event.target instanceof Element ? event.target : null;
                      if (target?.closest("input")) {
                        event.preventBaseUIHandler();
                        return;
                      }
                      const row = target?.closest<HTMLElement>("[data-notes-folder]");
                      setMenuFolder(row?.dataset.notesFolder ?? null);
                    }}
                  >
                    <Sidebar
                      aria-label="Folders"
                      material="opaque"
                      value={folderId}
                      onValueChange={(next) => {
                        setFolderId(next);
                        setNoteId(null);
                        setSeveral(null);
                      }}
                      onFocus={() => {
                        setPane("folders");
                        setFoldersFocused(true);
                      }}
                      onBlur={() => setFoldersFocused(false)}
                      footer={<SidebarFooter onClick={addFolder}>New Folder</SidebarFooter>}
                      style={FILL}
                    >
                      {[false, ...(onMyMac ? [true] : [])].map((local) => (
                        <SidebarSection
                          key={local ? "on-my-mac" : "icloud"}
                          title={
                            local ? (
                              "On My Mac"
                            ) : (
                              <span className="mac-notes-account">
                                iCloud
                                {/* A tree may hold only its rows, so the spinner is not a progress bar
                            to assistive technology: the section's name says it instead. */}
                                {syncing ? (
                                  <>
                                    <ProgressSpinner size="small" aria-hidden="true" />
                                    <span className="mac-notes-status">, syncing</span>
                                  </>
                                ) : null}
                              </span>
                            )
                          }
                        >
                          {(function rows(parent?: string): ReactNode {
                            return folders
                              .filter(
                                (folder) =>
                                  folder.parent === parent && (folder.local === true) === local,
                              )
                              .map((folder) => {
                                const inside = folders.some((each) => each.parent === folder.id);
                                return (
                                  <SidebarItem
                                    key={folder.id}
                                    value={folder.id}
                                    data-notes-folder={folder.id}
                                    draggable={
                                      folder.id !== DEFAULT_FOLDER && renaming !== folder.id
                                    }
                                    onDragStart={(event) => {
                                      event.stopPropagation();
                                      event.dataTransfer.setData(FOLDER_DRAG, folder.id);
                                      event.dataTransfer.effectAllowed = "move";
                                    }}
                                    {...folderDropProps(folder.id)}
                                    onDoubleClick={() => {
                                      if (folder.id !== DEFAULT_FOLDER) setRenaming(folder.id);
                                    }}
                                    defaultExpanded={inside ? true : undefined}
                                    label={
                                      renaming === folder.id ? (
                                        <input
                                          className="mac-notes-rename"
                                          aria-label="Folder name"
                                          defaultValue={folder.name}
                                          maxLength={100}
                                          // biome-ignore lint/a11y/noAutofocus: editing a name starts with its text selected, as in a Mac's outline
                                          autoFocus
                                          onFocus={(event) => event.currentTarget.select()}
                                          onPointerDown={(event) => event.stopPropagation()}
                                          onClick={(event) => event.stopPropagation()}
                                          onKeyDown={(event) => {
                                            event.stopPropagation();
                                            if (event.key === "Enter") {
                                              renameFolder(folder.id, event.currentTarget.value);
                                            } else if (event.key === "Escape") {
                                              setRenaming(null);
                                            }
                                          }}
                                          onBlur={(event) =>
                                            renameFolder(folder.id, event.currentTarget.value)
                                          }
                                        />
                                      ) : (
                                        folder.name
                                      )
                                    }
                                    accessory={
                                      noteCount ? (
                                        <SidebarBadge
                                          variant="plain"
                                          selected={folder.id === folderId}
                                          emphasized={foldersFocused}
                                        >
                                          {counts.get(folder.id) ?? 0}
                                        </SidebarBadge>
                                      ) : undefined
                                    }
                                  >
                                    {inside ? rows(folder.id) : undefined}
                                  </SidebarItem>
                                );
                              });
                          })()}
                          {hasShared && !local ? (
                            <SidebarItem
                              value={SHARED_FOLDER}
                              data-notes-folder={SHARED_FOLDER}
                              label="Shared"
                              accessory={
                                noteCount ? (
                                  <SidebarBadge
                                    variant="plain"
                                    selected={folderId === SHARED_FOLDER}
                                    emphasized={foldersFocused}
                                  >
                                    {counts.get(SHARED_FOLDER) ?? 0}
                                  </SidebarBadge>
                                ) : undefined
                              }
                            />
                          ) : null}
                          {hasDeleted && !local ? (
                            <SidebarItem
                              value={RECENTLY_DELETED}
                              data-notes-folder={RECENTLY_DELETED}
                              {...folderDropProps(RECENTLY_DELETED)}
                              label="Recently Deleted"
                              accessory={
                                noteCount ? (
                                  <SidebarBadge
                                    variant="plain"
                                    selected={folderId === RECENTLY_DELETED}
                                    emphasized={foldersFocused}
                                  >
                                    {counts.get(RECENTLY_DELETED) ?? 0}
                                  </SidebarBadge>
                                ) : undefined
                              }
                            />
                          ) : null}
                        </SidebarSection>
                      ))}
                    </Sidebar>
                  </ContextualMenuTrigger>
                  <ContextualMenuPopup aria-label="Folder commands">
                    {menuFolder === RECENTLY_DELETED ? (
                      <MenuItem
                        onClick={() =>
                          setErasing(
                            notes
                              .filter((note) => note.deleted !== undefined)
                              .map((note) => note.id),
                          )
                        }
                      >
                        Delete All
                      </MenuItem>
                    ) : (
                      <>
                        <MenuItem onClick={addFolder}>New Folder</MenuItem>
                        <MenuItem
                          disabled={
                            !menuFolder ||
                            menuFolder === DEFAULT_FOLDER ||
                            menuFolder === SHARED_FOLDER
                          }
                          onClick={() => setRenaming(menuFolder)}
                        >
                          Rename Folder
                        </MenuItem>
                        <MenuItem
                          disabled={
                            !menuFolder ||
                            menuFolder === DEFAULT_FOLDER ||
                            menuFolder === SHARED_FOLDER
                          }
                          onClick={() => menuFolder && deleteFolder(menuFolder)}
                        >
                          Delete Folder
                        </MenuItem>
                        <MenuItem
                          disabled
                          title="Share a folder’s notes one by one, with Add People in the toolbar."
                          data-reason="Share a folder’s notes one by one, with Add People in the toolbar."
                        >
                          Add People…
                        </MenuItem>
                      </>
                    )}
                  </ContextualMenuPopup>
                </ContextualMenu>
              </SplitViewPane>
              <SplitViewDivider aria-label="Resize the folder list" />
            </>
          ) : null}
          {/* The note list and the note stay in the page, hidden, while the gallery is shown:
              the editors keep what was typed in them, pictures and tables included. */}
          <SplitViewPane minSize={501}>
            {browsing ? (
              <NotesAttachmentsBrowser
                notes={notes}
                onShow={(id) => {
                  setView("list");
                  onAskNote?.(id);
                }}
                onQuickLook={(file) => setQuickLook({ name: file.name, file })}
              />
            ) : view === "gallery" ? (
              pinnedCount === 0 ? (
                galleryGrid("Notes", 0, visible.length, "100%")
              ) : (
                <div className="mac-notes-gallery">
                  <span className="mac-notes-section">Pinned</span>
                  {galleryGrid(
                    "Pinned",
                    0,
                    pinnedCount,
                    (pinnedCount > 3 ? 2 : 1) * CARD_ROW_HEIGHT,
                  )}
                  <span className="mac-notes-section">Notes</span>
                  <div className="mac-notes-gallery-rest">
                    {galleryGrid("Notes", pinnedCount, visible.length - pinnedCount, "100%")}
                  </div>
                </div>
              )
            ) : null}
            <div className="mac-notes-browser" hidden={view === "gallery" || browsing}>
              <SplitView style={BROWSER_STYLE}>
                <SplitViewPane
                  size={listWidth}
                  onSizeChange={setListWidth}
                  minSize={200}
                  maxSize={420}
                >
                  {visible.length === 0 && searching ? (
                    <EmptyState role="status" style={LIST_STYLE}>
                      No Results
                    </EmptyState>
                  ) : (
                    <ContextualMenu>
                      <ContextualMenuTrigger
                        className="mac-notes-menu-area"
                        onDragStart={startNotesDrag}
                        onContextMenu={(event) => {
                          const target = event.target instanceof Element ? event.target : null;
                          const row = target?.closest<HTMLElement>("[data-index]");
                          const note = visible[Number(row?.dataset.index ?? -1)];
                          if (!note) {
                            event.preventBaseUIHandler();
                            return;
                          }
                          if (!selectedIds.includes(note.id)) select([note.id]);
                        }}
                      >
                        <ListView
                          aria-label="Notes"
                          count={visible.length}
                          rowHeight={rowHeight}
                          separator="inset"
                          selectionMode="multiple"
                          rowDraggable
                          renderRow={renderRow}
                          getRowId={rowId}
                          getRowLabel={rowLabel}
                          value={selection}
                          onValueChange={select}
                          onRowAction={(index) => {
                            const id = visible[index]?.id;
                            if (DesktopWindow && id !== undefined) openNoteWindow(id);
                          }}
                          onFocus={() => setPane("notes")}
                          onKeyDown={(event) => {
                            if ((event.key === "Backspace" || event.key === "Delete") && current) {
                              event.preventDefault();
                              removeNotes(selectedIds);
                            }
                          }}
                          style={LIST_STYLE}
                        />
                      </ContextualMenuTrigger>
                      <ContextualMenuPopup aria-label="Note commands">
                        {selectedNotes.length > 0 &&
                        selectedNotes.every((note) => note.deleted !== undefined) ? (
                          <>
                            <MenuItem onClick={() => recoverNotes(selectedIds)}>Recover</MenuItem>
                            <MenuItem onClick={() => setErasing(selectedIds)}>
                              Delete Immediately
                            </MenuItem>
                          </>
                        ) : (
                          <>
                            <MenuItem onClick={togglePin}>
                              {windowMenu.pinned ? "Unpin Note" : "Pin Note"}
                            </MenuItem>
                            <NoteLockItem
                              lock={windowMenu.lock}
                              disabled={selectedIds.length !== 1}
                            />
                            <MenuItem onClick={() => deleteNotes(selectedIds)}>Delete</MenuItem>
                            <Submenu>
                              <SubmenuTrigger>Move to</SubmenuTrigger>
                              <SubmenuPopup>
                                {folders
                                  .filter((folder) => onMyMac || folder.local !== true)
                                  .map((folder) => (
                                    <MenuItem
                                      key={folder.id}
                                      disabled={selectedNotes.every(
                                        (note) => note.folder === folder.id,
                                      )}
                                      onClick={() => moveNotes(selectedIds, folder.id)}
                                    >
                                      {folder.local ? `On My Mac: ${folder.name}` : folder.name}
                                    </MenuItem>
                                  ))}
                              </SubmenuPopup>
                            </Submenu>
                            <MenuSeparator />
                            <MenuItem
                              disabled={!DesktopWindow}
                              title={
                                DesktopWindow
                                  ? undefined
                                  : "A note opens in its own window on the desktop."
                              }
                              onClick={() => {
                                for (const id of selectedIds) openNoteWindow(id);
                              }}
                            >
                              Open in New Window
                            </MenuItem>
                            <NoteShareSubmenu share={noteShare} />
                          </>
                        )}
                      </ContextualMenuPopup>
                    </ContextualMenu>
                  )}
                </SplitViewPane>
                <SplitViewDivider aria-label="Resize the note list" />
                {/* Delete acts on the note once the note is being edited. */}
                <SplitViewPane
                  minSize={300}
                  onFocus={() => setPane("notes")}
                  onKeyDown={editorKeys}
                >
                  <div className="mac-notes-editor-pane" style={EDITOR_PANE}>
                    {current?.sealed && lockView.open.get(current.id)?.refused ? (
                      <WindowBanner
                        className="mac-notes-conflict"
                        role="alert"
                        title={LOCK_CHANGED_ELSEWHERE}
                        trailing={
                          <>
                            <WindowBannerAction onClick={() => notesLock.showLatest(current.id)}>
                              Show Latest
                            </WindowBannerAction>
                            <WindowBannerAction
                              onClick={() =>
                                void notesLock.keepCopy(current, newId("note")).then((result) => {
                                  if (!result.ok) setLockFailure(result.reason);
                                })
                              }
                            >
                              Keep as Copy
                            </WindowBannerAction>
                          </>
                        }
                      >
                        {LOCK_CHANGED_BANNER}
                      </WindowBanner>
                    ) : null}
                    {conflicts.map((conflict) => (
                      <WindowBanner
                        key={conflict.copyId}
                        className="mac-notes-conflict"
                        trailing={
                          <>
                            <WindowBannerAction onClick={() => showMyVersion(conflict)}>
                              Show My Version
                            </WindowBannerAction>
                            <WindowBannerAction onClick={() => keepMyVersion(conflict)}>
                              Keep My Version
                            </WindowBannerAction>
                            <WindowBannerAction
                              onClick={() => dismissNotesConflict(conflict.copyId)}
                            >
                              OK
                            </WindowBannerAction>
                          </>
                        }
                      >
                        “{conflict.title}” was changed in another window. Your version is a copy.
                      </WindowBanner>
                    ))}
                    <FindBar find={find} />
                    {current?.deleted !== undefined && !severalShown ? (
                      <WindowBanner
                        trailing={
                          <WindowBannerAction onClick={() => recoverNotes(selectedIds)}>
                            Recover
                          </WindowBannerAction>
                        }
                      >
                        Deleted notes can’t be edited. They go for good after {KEEP_DELETED_DAYS}{" "}
                        days.
                      </WindowBanner>
                    ) : null}
                    <ContextualMenu>
                      <ContextualMenuTrigger
                        className="mac-notes-menu-area"
                        onContextMenu={(event) => {
                          if (severalShown || !current) {
                            event.preventBaseUIHandler();
                            return;
                          }
                          const target = event.target instanceof Element ? event.target : null;
                          setMenuAttachment(
                            target?.closest<HTMLElement>("[data-attachment]") ?? null,
                          );
                          // A secondary click in a cell acts on that cell.
                          const editor = editors.get(current.id);
                          const cell = editor && target ? tableCellAt(editor, target) : null;
                          if (editor && cell && tableCellAtSelection(editor) !== cell) {
                            placeTableCaret({ node: cell, atEnd: true });
                            follow(editor);
                          }
                        }}
                      >
                        {severalShown ? (
                          <div className="mac-notes-selected-count" role="status">
                            {selectedIds.length} Notes Selected
                          </div>
                        ) : null}
                        <ScrollView
                          style={severalShown ? { ...EDITOR_STYLE, display: "none" } : EDITOR_STYLE}
                          viewportProps={{
                            className: "mac-notes-paper",
                            style: { "--mac-notes-zoom": zoom } as CSSProperties,
                            ...{ "data-attachment-view": attachmentView },
                          }}
                        >
                          {(current && !opened.includes(current.id)
                            ? [...opened, current.id]
                            : opened
                          )
                            .map((id) => notes.find((note) => note.id === id))
                            .map((note) =>
                              !note ? null : isClosed(lockView, note) ? (
                                note === current ? (
                                  <div key={note.id} className="mac-notes-page">
                                    <LockedNotePane noteId={note.id} />
                                  </div>
                                ) : null
                              ) : (
                                <div
                                  key={`${note.id}:${editorRevisions[note.id] ?? 0}:${lockView.open.get(note.id)?.generation ?? ""}`}
                                  className="mac-notes-page"
                                  hidden={note !== current}
                                >
                                  <div className="mac-notes-date">{reveal(note).edited}</div>
                                  {note.folder === SHARED_FOLDER ? (
                                    <div className="mac-notes-date">
                                      {sharedByline(shared, note.id)}
                                    </div>
                                  ) : null}
                                  <NotesEditor
                                    note={reveal(note)}
                                    onEdit={edit}
                                    onQuickLook={(file) => setQuickLook({ name: file.name, file })}
                                    registry={editors}
                                    keepers={keepers}
                                    spellCheck={spelling}
                                    textReplacement={substitutions.replacement}
                                    substitutions={latestSubstitutions}
                                  />
                                </div>
                              ),
                            )}
                        </ScrollView>
                      </ContextualMenuTrigger>
                      <ContextualMenuPopup aria-label="Text commands">
                        {menuAttachment ? (
                          <AttachmentItems
                            attachment={menuAttachment}
                            view={attachmentView}
                            onView={setAttachmentView}
                            onQuickLook={setQuickLook}
                          />
                        ) : (
                          <>
                            {inTable && editable ? (
                              <>
                                <MenuItem onClick={() => tableCommand("row-below")}>
                                  Add Row
                                </MenuItem>
                                <MenuItem onClick={() => tableCommand("column-after")}>
                                  Add Column
                                </MenuItem>
                                <MenuItem onClick={() => tableCommand("delete-row")}>
                                  Delete Row
                                </MenuItem>
                                <MenuItem onClick={() => tableCommand("delete-column")}>
                                  Delete Column
                                </MenuItem>
                                <MenuSeparator />
                              </>
                            ) : null}
                            <EditorEditItems target={() => latestEdit.current()} />
                            <MenuSeparator />
                            <MenuItem
                              onClick={() => {
                                const word = document.getSelection()?.toString().trim();
                                if (word) lookUp(word);
                              }}
                            >
                              Look Up
                            </MenuItem>
                            <Submenu>
                              <SubmenuTrigger>Services</SubmenuTrigger>
                              <SubmenuPopup>
                                <ServicesItems
                                  from="notes"
                                  none={<MenuItem disabled>No Services Apply</MenuItem>}
                                />
                              </SubmenuPopup>
                            </Submenu>
                            <MenuSeparator />
                            <SpellingItems
                              disabled={!editable}
                              whileTyping={spelling}
                              onToggleWhileTyping={() => setSpelling(!spelling)}
                              onShow={() => setSpellingShown(true)}
                              onCheckNow={checkSpelling}
                            />
                            <SpeechItems target={() => latestEdit.current()} />
                            <MenuSeparator />
                            <NotesFormatItems
                              status={status}
                              onChoose={() =>
                                whenMenusClosed(document, () => latestFormat.current.focus())
                              }
                              onParagraphStyle={paragraphStyle}
                              onTextCommand={textCommand}
                              onList={listCommand}
                              onTable={tableCommand}
                              onCommand={textMenuCommand}
                            />
                          </>
                        )}
                      </ContextualMenuPopup>
                    </ContextualMenu>
                  </div>
                </SplitViewPane>
              </SplitView>
            </div>
          </SplitViewPane>
        </SplitView>
      </WindowBody>
      <Alert open={erasing !== null} onOpenChange={(open) => !open && setErasing(null)}>
        <AlertPopup>
          <AlertMessage>
            {erasing?.length === 1
              ? "Delete this note immediately?"
              : `Delete these ${erasing?.length ?? 0} notes immediately?`}
          </AlertMessage>
          <AlertInformativeText>You can’t undo this action.</AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              onClick={() => {
                if (erasing) eraseNotes(erasing);
              }}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert
        open={refusedFiles.length > 0}
        onOpenChange={(open) => {
          if (!open) setRefusedFiles([]);
        }}
      >
        <AlertPopup>
          <AlertMessage>Notes can’t take {refusedFiles.join(", ")}.</AlertMessage>
          <AlertInformativeText>{FILE_LIMIT}</AlertInformativeText>
          <AlertButtons>
            <AlertClose>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert
        open={fileFailure !== null}
        onOpenChange={(open) => {
          if (!open) setFileFailure(null);
        }}
      >
        <AlertPopup>
          <AlertMessage>“{fileFailure?.name}” couldn’t be attached.</AlertMessage>
          <AlertInformativeText>{fileFailure?.reason}</AlertInformativeText>
          <AlertButtons>
            <AlertClose>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert
        open={lockFailure !== null}
        onOpenChange={(open) => {
          if (!open) setLockFailure(null);
        }}
      >
        <AlertPopup>
          <AlertMessage>The note’s lock wasn’t changed.</AlertMessage>
          <AlertInformativeText>{lockFailure}</AlertInformativeText>
          <AlertButtons>
            <AlertClose>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <NotesLockSheet
        ask={lockAsk}
        anchor={titleBar}
        onAsk={setLockAsk}
        onClose={() => setLockAsk(null)}
      />
      <Sheet open={addingLink} onOpenChange={(open) => open || setAddingLink(false)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Add Link">
          {addingLink ? (
            <TextEditAddLink onLink={addLink} onCancel={() => setAddingLink(false)} />
          ) : null}
        </SheetPopup>
      </Sheet>
      {host &&
      (fontsShown || colorsShown || spellingShown || substitutionsShown || quickLook !== null)
        ? createPortal(
            <div
              ref={panelLayer}
              className="mac-notes-panel-layer"
              data-contained={host === host.ownerDocument.body ? undefined : ""}
            >
              {fontsShown ? (
                <DesktopFontPanel
                  role="dialog"
                  className="mac-notes-panel"
                  families={PANEL_FAMILIES}
                  value={
                    format
                      ? {
                          ...format,
                          family: SYSTEM_NAMES.test(format.family)
                            ? SYSTEM_FONT.name
                            : format.family,
                        }
                      : undefined
                  }
                  onFontChange={changeFont}
                  onClose={() => closePanel(setFontsShown)}
                />
              ) : null}
              {colorsShown ? (
                <ColorPanel
                  role="dialog"
                  className="mac-notes-panel"
                  value={format?.color ?? "#000000"}
                  onValueChange={(color) => changeFont({ color })}
                  onClose={() => closePanel(setColorsShown)}
                />
              ) : null}
              {spellingShown ? (
                <SpellingPanel
                  className="mac-notes-panel"
                  element={toolTarget}
                  editable={editable}
                  ignored={ignoredWords}
                  onClose={() => closePanel(setSpellingShown)}
                />
              ) : null}
              {substitutionsShown ? (
                <SubstitutionsPanel
                  className="mac-notes-panel"
                  element={toolTarget}
                  editable={editable}
                  settings={substitutions}
                  onChange={setSubstitutions}
                  onClose={() => closePanel(setSubstitutionsShown)}
                />
              ) : null}
              {quickLook ? (
                <QuickLookPanel
                  className="mac-notes-panel"
                  title={quickLook.name}
                  width={480}
                  height={360}
                  onClose={() => setQuickLook(null)}
                >
                  <div className="mac-notes-quick-look-body">
                    {quickLook.file ? (
                      <NoteFilePreview file={quickLook.file} />
                    ) : (
                      <img
                        className="mac-notes-quick-look"
                        src={quickLook.src}
                        alt={quickLook.name}
                      />
                    )}
                  </div>
                </QuickLookPanel>
              ) : null}
            </div>,
            host,
          )
        : null}
      {DesktopWindow
        ? noteWindows.flatMap((id) => {
            const listed = notes.find((each) => each.id === id);
            if (!listed || isClosed(lockView, listed)) return [];
            const note = reveal(listed);
            return [
              <DesktopWindow
                key={id}
                id={`note-${id}`}
                title={summarize(note).title}
                defaultSize={{ width: 560, height: 480 }}
                minSize={{ width: 360, height: 240 }}
                onClose={() => setNoteWindows((open) => open.filter((each) => each !== id))}
                render={({
                  onClose: close,
                  onMinimize,
                  onZoom,
                  zoomRole,
                  minimizeDisabled,
                  zoomDisabled,
                  onDragRegionPointerDown,
                  onDragRegionDoubleClick,
                  ...windowProps
                }) => (
                  <NoteWindow
                    {...windowProps}
                    note={note}
                    revision={`${windowRevisions[id] ?? 0}:${lockView.open.get(id)?.generation ?? ""}`}
                    onEdit={editInWindow}
                    onQuickLook={(file) => setQuickLook({ name: file.name, file })}
                    spellCheck={spelling}
                    textReplacement={substitutions.replacement}
                    substitutions={latestSubstitutions}
                    controlsProps={{
                      onClose: close,
                      onMinimize,
                      onZoom,
                      zoomRole,
                      minimizeDisabled,
                      zoomDisabled,
                    }}
                    onDragRegionPointerDown={onDragRegionPointerDown}
                    onDragRegionDoubleClick={onDragRegionDoubleClick}
                  />
                )}
              />,
            ];
          })
        : null}
      {DesktopWindow && windowAsked ? (
        <BringForward key={windowAsked.serial} windowId={`notes:note-${windowAsked.id}`} />
      ) : null}
    </>
  );
}

/** Brings a window the desktop hosts forward once, when it is rendered. */
function BringForward({ windowId }: { windowId: string }) {
  const store = useWindowManagerStore();
  useEffect(() => store.commands.focus(windowId), [store, windowId]);
  return null;
}

/**
 * What a secondary click on a file in a note offers: its size, Quick Look, saving a copy, and the
 * apps to share it with. A stand-in picture holds no file: the browser's share sheet, where it has
 * one for files.
 */
function AttachmentItems({
  attachment,
  view,
  onView,
  onQuickLook,
}: {
  attachment: HTMLElement;
  view: "large" | "small";
  onView: (view: "large" | "small") => void;
  onQuickLook: (picture: { src?: string; name: string; file?: NoteFile }) => void;
}) {
  const file = fileOfBlock(attachment);
  const image = attachment.querySelector("img");
  const src = image?.getAttribute("src") ?? "";
  const name = file?.name || image?.getAttribute("alt") || "Attachment";
  const canShare = typeof navigator.canShare === "function";
  return (
    <>
      <MenuItem disabled={view === "small"} onClick={() => onView("small")}>
        View as Small
      </MenuItem>
      <MenuItem disabled={view === "large"} onClick={() => onView("large")}>
        View as Large
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={!file && !src}
        onClick={() => onQuickLook(file ? { name, file } : { src, name })}
      >
        Quick Look
      </MenuItem>
      <MenuItem
        disabled={!file && !src}
        onClick={() => {
          if (file) {
            void readNoteFile(file).then((blob) => downloadBlob(blob, file.name));
            return;
          }
          const link = document.createElement("a");
          link.href = src;
          link.download = name;
          link.click();
        }}
      >
        Save Attachment…
      </MenuItem>
      {file ? (
        <Submenu>
          <SubmenuTrigger>Share</SubmenuTrigger>
          <SubmenuPopup>
            <FileShareItems
              from="notes"
              items={[
                {
                  id: `note-file-${file.id}`,
                  name: file.name,
                  kind: "file",
                  type: file.type,
                  size: file.size,
                  bytes: () => readNoteFile(file),
                },
              ]}
            />
          </SubmenuPopup>
        </Submenu>
      ) : (
        <MenuItem
          disabled={!src || !canShare}
          title={canShare ? undefined : NO_FILE_SHARE}
          onClick={() => {
            void sessionFetch(src)
              .then((response) => response.blob())
              .then((blob) =>
                navigator.share({ files: [new File([blob], name, { type: blob.type })] }),
              )
              // Dismissing the sheet is not an error to report.
              .catch(() => undefined);
          }}
        >
          Share
        </MenuItem>
      )}
    </>
  );
}

export interface NotesProps
  extends Omit<WindowProps, "children">,
    Omit<NotesContentProps, "titleBarProps" | "controlsProps"> {
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/**
 * Notes, as in macOS 10.15 Catalina: a folder sidebar, a note list and an editable note under
 * a unified toolbar.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a page
 * or a window manager places it (`style`, `width`, `height`, `ref`) and tells it whether it is
 * key (`state`); the window controls' and the title bar's callbacks, the eight props a managed
 * window's `render` supplies beside the window's, are handed to those parts. The app keeps its
 * own notes for as long as it is mounted.
 *
 * The note's text takes the styles of Notes' Format menu: Title, Heading and Body for a line,
 * and the Font and Text commands for the selection, from the toolbar's format button, from a
 * menu bar (`NotesMenuBar`, through `actionsRef`), from their key equivalents while the note
 * has the keyboard (Command-B, Command-I, Command-U, Command-T for the Fonts panel and so on;
 * Control off Apple platforms), and from the Fonts and Colors panels, which follow the
 * insertion point.
 */
export function Notes({
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  defaultFolders,
  defaultNotes,
  syncing,
  actionsRef,
  onStatusChange,
  panelContainer,
  DesktopWindow,
  width = 1000,
  height = 666,
  className,
  ...props
}: NotesProps) {
  return (
    <Window
      aria-label="Notes"
      width={width}
      height={height}
      className={className ? `mac-notes ${className}` : "mac-notes"}
      {...props}
    >
      <NotesContent
        titleBarProps={{ onDragRegionPointerDown, onDragRegionDoubleClick }}
        controlsProps={{
          onClose,
          onMinimize,
          onZoom,
          zoomRole,
          minimizeDisabled,
          zoomDisabled,
        }}
        defaultFolders={defaultFolders}
        defaultNotes={defaultNotes}
        syncing={syncing}
        actionsRef={actionsRef}
        onStatusChange={onStatusChange}
        panelContainer={panelContainer}
        DesktopWindow={DesktopWindow}
      />
    </Window>
  );
}
