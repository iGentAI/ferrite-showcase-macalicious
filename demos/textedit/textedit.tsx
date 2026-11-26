"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { Checkbox } from "macalicious/checkbox";
import { ColorPanel } from "macalicious/color-panel";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import {
  FONT_FAMILIES,
  keepTypingRuns,
  RICH_TEXT_KEY_EQUIVALENTS,
  type RichTextCommand,
  readRichTextFormat,
  richTextKeyCommand,
  richTextStartNode,
  setRichTextStyle,
} from "macalicious/lib/rich-text";
import { useManagedWindow } from "macalicious/managed-window";
import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import type { PrintPanelSettings } from "macalicious/print-panel";
import { PushButton } from "macalicious/push-button";
import { Ruler, type RulerMarker } from "macalicious/ruler";
import { Sheet, SheetActions, SheetDescription, SheetPopup, SheetTitle } from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import {
  mapTextOffset,
  RichTextView,
  readTextSelection,
  restoreTextSelection,
  type TextSelection,
  TextView,
} from "macalicious/text-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowBanner, WindowBannerAction } from "macalicious/window-banner";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  useWindowManager,
  useWindowManagerStore,
  type WindowManagerStore,
} from "macalicious/window-manager";
import {
  type CSSProperties,
  type MouseEvent,
  type Ref,
  use,
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
import { beginDesktopDrag, type DesktopDragItem, useDesktopDrop } from "../desktop/desktop-drag";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import {
  type DriveEntry,
  DriveError,
  entryOf,
  type KeptVersion,
  keepVersion,
  listVersions,
  previousSaveOf,
  readFile,
  readFileEntry,
  recentFiles,
  restoreVersion,
  runOps,
  useDrive,
} from "../desktop/desktop-files";
import { DesktopFontPanel } from "../desktop/desktop-font-panel";
import { openUrl } from "../desktop/desktop-open-url";
import {
  changeDesktopValue,
  desktopValues,
  readBoolean,
  readNumber,
  useDesktopSetting,
  useDesktopValue,
} from "../desktop/desktop-personal";
import {
  currentDesktopSession,
  onDesktopSessionChange,
  servedByDesktopApp,
  serverDocument,
  sessionFetch,
  useServerState,
} from "../desktop/desktop-server";
import { ServicesItems } from "../desktop/desktop-services";
import { DesktopVersionsSheet } from "../desktop/desktop-versions-sheet";
import { DesktopWindowHostContext, DesktopWindowName } from "../desktop/desktop-windows";
import { mergeDocuments } from "../desktop/document-merge";
import { loadWords, normalWord } from "../desktop/text-spelling";
import {
  pasteEdges,
  spaceAfterPaste,
  substituteTyped,
  useTextSubstitutions,
} from "../desktop/text-substitutions";
import {
  checkDocumentAfterMenu,
  checkDocumentNow,
  SpellingPanel,
  SubstitutionItems,
  SubstitutionsPanel,
  useCheckGrammar,
  useLearnedWords,
} from "../desktop/text-tools";
import { lookUp } from "../dictionary/dictionary-desktop";
import {
  DriveOpenPanel,
  DriveSavePanel,
  type DriveSaveTarget,
  saveToDrive,
} from "../finder/finder-file-dialogs";
import {
  appsForFile,
  onOpenFileRequest,
  openFile,
  showInFinder,
  takeOpenFileRequests,
} from "../finder/finder-open";
import {
  type EditMenuTarget,
  EditorEditItems,
  EditorMoreItems,
  selectedText,
} from "../notes/notes-edit-menu";
import { FindBar, type TextFind, useTextFind } from "../notes/notes-find";
import { whenMenusClosed } from "../notes/notes-menus";
import { ASK_TO_KEEP_KEY } from "../system-preferences/panes/general/document-settings";
import { DocumentIcon } from "./textedit-artwork";
import {
  caretPlace,
  completionKey,
  completionsOf,
  type TextEditCompleting,
  TextEditCompletions,
  wordBeforeCaret,
} from "./textedit-complete";
import { caretAfterSelection, correctTypedWord } from "./textedit-corrections";
import {
  defaultDocument as captureDocument,
  cleanProperties,
  defaultPlaces,
  FONTS,
  HIGHLIGHTS,
  propertiesKey,
  type TextEditDocument,
  type TextEditPlace,
  type TextEditRuler,
  withFile,
  withFolder,
} from "./textedit-data";
import { DetectedItems, detectedInView } from "./textedit-detectors";
import { useDisjointSelection } from "./textedit-disjoint";
import {
  type CopiedRuler,
  changeTableShape,
  copyRuler,
  dropCopiedListStart,
  LINE_HEIGHT,
  type ParagraphIndents,
  type ParagraphSpacing,
  PLAIN_PARAGRAPH,
  paragraphFormatOf,
  paragraphIndents,
  paragraphSpacingOf,
  paragraphsOf,
  pasteRuler,
  readLines,
  runCommand,
  setFontSize,
  setListStart,
  setParagraphFormat,
  setParagraphIndents,
  setParagraphSpacing,
  setParagraphTabs,
  setWritingDirection,
  stepRuler,
  titleOf,
  toHex,
} from "./textedit-document";
import {
  DEFAULT_PAGE_SETUP,
  type PageSetup,
  printDocument,
  TextEditAddLink,
  TextEditDriveSave,
  type TextEditFileCommands,
  TextEditFileMenuItems,
  type TextEditFileMenuState,
  TextEditRename,
  type TextEditVersionPage,
  TextEditVersionPageView,
} from "./textedit-drive";
import { PLAIN_ENCODINGS } from "./textedit-encodings";
import {
  currentFile,
  type DocumentBody,
  type DriveFileRef,
  documentBlob,
  documentFromText,
  documentOfFileBytes,
  fileFitsFormat,
  fileText,
  isMarkupName,
  isTextDocument,
  keepLastSaved,
  openDriveDocument,
  readDriveDocument,
  readLastSaved,
  readLastSavedVersion,
  STALE_FILE,
  UnsupportedEncodingError,
  useHasLastSaved,
  writeDriveDocument,
} from "./textedit-files";
import {
  type CopiedStyle,
  copyStyle,
  documentStyles,
  insertBreak,
  styleSelection,
  stylesOf,
  type TextEditBreak,
  type TextEditExtraCommand,
  TextEditFontExtraItems,
  TextEditInsertItems,
} from "./textedit-format";
import { type TextEditFormat, TextEditFormatBar } from "./textedit-format-bar";
import { type TextEditListChoice, TextEditLists } from "./textedit-lists";
import {
  TextEditOpenPanel,
  TextEditPrintPanel,
  TextEditSavePanel,
  type TextEditSaveValues,
} from "./textedit-panels";
import { writeDocumentPdf } from "./textedit-pdf";
import { attachedFile, attachmentHtml, pictureHtml } from "./textedit-picture";
import {
  codeDocument,
  newDocumentFrom,
  openedDocument,
  plainTextStyle,
  TEXTEDIT_SETTINGS,
  useTextEditPreferences,
} from "./textedit-preferences";
import {
  hideProperties,
  TextEditPropertiesPanel,
  toggleProperties,
  usePropertiesShown,
} from "./textedit-properties";
import { MOST_TABLE_DEPTH, paragraphsOfContent, paragraphsOfLines } from "./textedit-rtf";
import { isBundleName, saveBundle } from "./textedit-rtfd";
import {
  contentToHtml,
  documentToServer,
  draftFromServer,
  htmlToContent,
  TEXTEDIT_DRAFT_MAX_BYTES,
  TEXTEDIT_DRAFT_URL,
} from "./textedit-server";
import {
  folderChoices,
  readPageSetup,
  TextEditMove,
  TextEditPageSetup,
  TextEditSpacing,
  TextEditStyles,
  TextEditTitle,
} from "./textedit-sheets";
import {
  layoutTabs,
  leftStops,
  parseTabStops,
  type TabKind,
  type TabStop,
  withoutTabLayout,
} from "./textedit-tab-stops";
import {
  canMerge,
  cellsIn,
  childHoldingEnd,
  columnsOfCells,
  insertTable,
  KEEP_BACKGROUND,
  mergeCells,
  moveBetweenCells,
  nestTable,
  normalizeTables,
  reshapeTable,
  setColumnWidth,
  shapeLosesText,
  splitCell,
  TextEditTable,
  type TextEditTableChoice,
  tableAround,
  tableDepth,
  tableSize,
  unnestTable,
  widthOfColumns,
} from "./textedit-table";
import {
  answerTabKey,
  DocumentTabBar,
  DocumentTabOverview,
  type DocumentTabs,
  DocumentTabViewItems,
  DocumentTabWindowItems,
  useDocumentTabs,
} from "./textedit-tabs";
import { TextEditViewItems, useTextEditView } from "./textedit-view";
import {
  FIRST_WINDOW,
  frameOfFile,
  keepFrameOfFile,
  keepWindow,
  readKeptWindow,
  registerWindow,
  type TextEditFrame,
  type TextEditOpening,
  takeWindowsToReopen,
  windowClosed,
  windowWithFile,
} from "./textedit-windows";
import "./textedit.tokens.css";
import "./textedit.css";

/**
 * The dialogs of the app: the Open panel, and the Save and Print sheets of the document. Served
 * by the desktop's Ferrite application, Save As and Rename are sheets too.
 */
export type TextEditDialog = "open" | "save" | "print" | "save-as" | "rename";

/** What a menu bar needs to know of the document to title and enable its commands. */
/** A request body's size in bytes, as the gateway counts it. */
const bodyBytes = (body: object) => new TextEncoder().encode(JSON.stringify(body)).length;

/** A stored draft's text: everything but its name, its states and its file. */
function draftText(body: object | null): string | null {
  const draft = (body as { draft?: Record<string, unknown> } | null)?.draft;
  if (!draft || typeof draft !== "object") return null;
  const {
    name: _name,
    edited: _edited,
    unwritten: _unwritten,
    file: _file,
    readOnly: _readOnly,
    ...text
  } = draft;
  // Sorted: the server answers a ruler's fields in its own order, not the order the window sent.
  return JSON.stringify(text, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([one], [other]) => (one < other ? -1 : 1)))
      : value,
  );
}

/**
 * The draft as this window's change (`mine`, made on `was`) meets the copy another window stored
 * first (`theirs`). Where both changed the document's text, the version saved first stays and this
 * window's is handed to `onConflict`, for the window to offer back (Keep Mine), rather than one
 * overwriting the other without a word; anything else merges as every document does.
 */
function mergeDraft(
  was: object | null,
  mine: object,
  theirs: object,
  onConflict: (mine: object) => void,
): object {
  const before = draftText(was);
  const ours = draftText(mine);
  const stored = draftText(theirs);
  if (ours !== null && stored !== null && ours !== before && stored !== before && ours !== stored) {
    onConflict(mine);
    return { draft: (theirs as { draft: object }).draft };
  }
  return mergeDocuments(was, mine, theirs);
}

/** Starts the key of a conflicted draft's other version: `<prefix><session>\n<when>-<which>`. */
const DRAFT_CONFLICT = "macalicious-textedit-conflict:";

/** A version of the draft that lost to one saved first, until the person chooses. */
interface KeptDraft {
  key: string;
  session: string;
  body: object;
  /** Whether a reload finds it: false when the browser's storage refused it. */
  held: boolean;
  /**
   * Keep Mine put it back in the window: not offered again, and its record stays until the store
   * holds the window's text. `before` is the window's text when it was chosen.
   */
  restoring?: { before: string | null };
}

const draftSession = () => currentDesktopSession() ?? "";

function draftConflictPrefix(): string {
  return `${DRAFT_CONFLICT}${draftSession()}\n`;
}

/** This session's kept versions, oldest first. Another session's copies stay their own. */
function readDraftConflicts(): KeptDraft[] {
  const kept: KeptDraft[] = [];
  try {
    const prefix = draftConflictPrefix();
    const session = draftSession();
    const keys = Array.from({ length: localStorage.length }, (_, at) => localStorage.key(at));
    for (const key of keys.sort()) {
      if (!key?.startsWith(prefix)) continue;
      const body: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      if (typeof body === "object" && body) kept.push({ key, session, body, held: true });
    }
  } catch {
    // Unreadable storage holds nothing this window can offer.
  }
  return kept;
}

/** Keeps one version in a record of its own: a later conflict never replaces it. */
function keepDraftConflict(body: object): KeptDraft {
  const when = Date.now().toString(36).padStart(10, "0");
  const key = `${draftConflictPrefix()}${when}-${Math.random().toString(36).slice(2)}`;
  const session = draftSession();
  try {
    localStorage.setItem(key, JSON.stringify(body));
    return { key, session, body, held: true };
  } catch {
    return { key, session, body, held: false };
  }
}

function dropDraftConflict(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage that cannot be written holds nothing to remove.
  }
}

export interface TextEditStatus {
  /** The document's name. */
  name: string;
  /** Whether it is rich or plain text. */
  format: TextEditDocument["format"];
  /** Whether it has been changed since it was opened or saved. */
  edited: boolean;
  /** Whether Format > Prevent Editing holds it. */
  prevented?: boolean;
  /** Whether Format > Allow Hyphenation is on. */
  hyphenation?: boolean;
  /** Whether Format > Wrap to Page is on. */
  wrap?: boolean;
  /** Whether the ruler shows. */
  ruler?: boolean;
  /** Whether Copy Style has kept something for Paste Style. */
  canPasteStyle?: boolean;
  /** Whether Copy Ruler has kept something for Paste Ruler. */
  canPasteRuler?: boolean;
  /**
   * Served by the desktop's Ferrite application: what the File menu shows of the document's
   * file on the person's drive and its recent documents.
   */
  file?: TextEditFileMenuState;
}

/** The app's commands, for a menu bar or a desktop page that hosts the window. */
export interface TextEditActions {
  /** File > New: an empty rich text document replaces the one in the window. */
  newDocument: () => void;
  /** File > Open…, File > Save… and File > Print…: shows that dialog. */
  show: (dialog: TextEditDialog) => void;
  /** Format > Make Plain Text and Make Rich Text. */
  setFormat: (format: TextEditDocument["format"]) => void;
  /**
   * Format > Font and Format > Text: a style, Bigger or Smaller, an alignment, or Show Fonts
   * and Show Colors, which open the Fonts and Colors panels and close them again. A rich text
   * document's commands; a plain text document takes none.
   */
  format: (command: RichTextCommand) => void;
  /** Format > Font's rows beyond the browser's commands: see `textedit-format.tsx`. */
  extra: (command: TextEditExtraCommand) => void;
  /** The Edit menu's text: the document, or nothing while it is not there to act on. */
  editTarget: () => EditMenuTarget | null;
  /** The Edit menu's Find rows. */
  find: () => TextFind;
  /** Format > Prevent Editing and Allow Editing. */
  togglePrevented: () => void;
  /** Format > Allow Hyphenation and Disallow Hyphenation. */
  toggleHyphenation: () => void;
  /** Format > Wrap to Page and Wrap to Window. */
  toggleWrap: () => void;
  /** Format > Text > Show Ruler and Hide Ruler. */
  toggleRuler: () => void;
  /** Format > Table… and Format > Lists…: shows that sheet. */
  showTable: () => void;
  showLists: () => void;
  /** Edit > Spelling and Grammar's panel and Check Document Now, and Edit > Substitutions' panel. */
  showSpelling: () => void;
  checkSpelling: () => void;
  showSubstitutions: () => void;
  /** Served by the desktop's Ferrite application: the File menu's commands on the drive. */
  file?: TextEditFileCommands;
}

const RECENTS_CLEARED = "textedit.recentsClearedAt";
const PAGE_SETUP = "textedit.pageSetup";
/** How long after the last change a document that has a file is saved into it. */
const AUTOSAVE_MS = 1500;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The format a new rich text document starts with: Helvetica 12, black on white. */
const DEFAULT_FORMAT: TextEditFormat = {
  ...PLAIN_PARAGRAPH,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  family: "Helvetica",
  size: 12,
  color: "#000000",
  highlight: "none",
};

/** The tab stops of a new document, in points from the ruler's origin: those of the captures. */
const TAB_STOPS = [72, 144, 216, 288, 360];
/** The text container is the window less the text view's 5 pt padding at each side. */
const CONTAINER_INSET = 10;
/** A wrapped page's margins, in points: TextEdit's default page has inch margins. */
const PAGE_MARGIN = 72;

/** The character styles the browser toggles. */
const TOGGLES = [["bold"], ["italic"], ["underline"], ["strikethrough"]] as const;

const sameFormat = (a: TextEditFormat, b: TextEditFormat) =>
  (Object.keys(a) as (keyof TextEditFormat)[]).every((key) => a[key] === b[key]);

export interface TextEditProps extends Omit<WindowProps, "children" | "title"> {
  /**
   * The document the window opens with. Read once.
   * @default the "512 Pixels" document of the reference screenshots
   */
  defaultDocument?: TextEditDocument;
  /**
   * The places of the Open and Save panels with their files. Read once; saving adds to them.
   * @default the sidebar and the Documents folder of the reference screenshots
   */
  defaultPlaces?: readonly TextEditPlace[];
  /** The dialog that is shown, when controlled; `null` shows none. */
  dialog?: TextEditDialog | null;
  /**
   * The dialog shown at first, when uncontrolled.
   * @default null
   */
  defaultDialog?: TextEditDialog | null;
  /** Called when a dialog is shown or dismissed. */
  onDialogChange?: (dialog: TextEditDialog | null) => void;
  /** Where the app's commands are put, for a menu bar outside the window. */
  actionsRef?: Ref<TextEditActions>;
  /** Called when the document's name, format or edited state changes. */
  onStatusChange?: (status: TextEditStatus) => void;
  /**
   * Called with the document, the id of its place and the folders in it when it is saved. Served
   * by Ferrite, a save to the drive passes the id of the drive folder it was saved into, and no
   * folders.
   */
  onSave?: (document: TextEditDocument, place: string, folders: readonly string[]) => void;
  /** Called with the settings when the Print sheet's Print button is activated. */
  onPrint?: (settings: PrintPanelSettings) => void;
  /**
   * The element the Open panel is rendered into: it is a window of its own, centred on that
   * element's box when the element positions its content, and on the viewport otherwise.
   * @default the document's body
   */
  panelContainer?: HTMLElement | null;
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
  /** On the desktop, what this further window of TextEdit was asked to be (`textedit-windows.ts`). */
  opening?: TextEditOpening;
}

/**
 * TextEdit, as in macOS 10.15 Catalina: a document window with the format bar and the ruler
 * over a rich text view, or a bare plain text view, and the Open, Save and Print dialogs.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a page
 * or a window manager places it (`style`, `width`, `height`, `ref`) and tells it whether it is
 * key (`state`); the window controls' and the title bar's callbacks, the eight props a managed
 * window's `render` supplies beside the window's, are handed to those parts. The Save and
 * Print dialogs are sheets on the window; the Open panel is a window of its own. The commands
 * a menu bar would hold are key equivalents in the window (Command-O, Command-S, Command-P,
 * Shift-Command-T; Control off Apple platforms) and the functions of `actionsRef`.
 *
 * Served by the desktop's Ferrite application, documents are files of the person's drive, which
 * Finder shows: Open and Save use the drive's Open and Save dialogs, a document that has a file
 * is saved into it a moment after each change (autosave), Rename, Duplicate, Save As and Open
 * Recent work on those files, and Export
 * as PDF prints the document through the browser. The document in the window is also kept for
 * the person after every change and opened again after a reload.
 */
/** The sheet's Cell Background for these cells: their one colour, if it is one the sheet names. */
const backgroundOfCells = (cells: readonly HTMLTableCellElement[]) => {
  const colours = new Set(cells.map((cell) => cell.style.backgroundColor));
  const [only] = colours;
  if (colours.size === 0 || (colours.size === 1 && !only)) return "none";
  if (colours.size > 1) return KEEP_BACKGROUND;
  return HIGHLIGHTS.find((each) => each.color === toHex(only ?? ""))?.value ?? KEEP_BACKGROUND;
};

/** A ruler as compared: its indents and tab stops, none when absent. */
const rulerOf = (ruler: TextEditRuler | undefined) => ({
  first: ruler?.first ?? 0,
  head: ruler?.head ?? 0,
  tail: ruler?.tail ?? 0,
  tabStops: [...(ruler?.tabStops ?? TAB_STOPS)],
});

/**
 * On the desktop: names the window for the Window menu, the Dock and Mission Control, and lists it
 * among TextEdit's windows, so that a file already open brings its window to the front.
 */
function TextEditDesktopWindow({
  title,
  fileId,
  file,
  startFrame,
  tabbed,
}: {
  title: string;
  fileId: () => string | undefined;
  /** The drive file the document is kept in: the window opens where that file was last shown. */
  file: string | undefined;
  /** Where the window stood when TextEdit closed. */
  startFrame: TextEditFrame | undefined;
  /** A tab stands on its group's frame, not its file's. */
  tabbed: boolean;
}) {
  const { id } = useManagedWindow();
  const { focus } = useWindowManager();
  const store = useWindowManagerStore();
  const host = use(DesktopWindowHostContext);
  const latest = useRef({ focus, fileId });
  latest.current = { focus, fileId };
  useEffect(
    () =>
      registerWindow({
        fileId: () => latest.current.fileId(),
        focus: () => latest.current.focus(id),
      }),
    [id],
  );
  const stage = useRef(host?.stage);
  stage.current = host?.stage;
  // biome-ignore lint/correctness/useExhaustiveDependencies: where the window opens, once
  useEffect(() => {
    if (startFrame) store.patch(id, { frame: startFrame });
  }, []);
  useEffect(() => {
    if (!file || tabbed) return;
    const kept = frameOfFile(file);
    const room = stage.current?.();
    if (kept) {
      store.patch(id, {
        frame: room ? store.bound(kept, room.clientWidth, room.clientHeight) : kept,
      });
    }
    let frame = store.get(id)?.frame;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = store.subscribe(() => {
      const window = store.get(id);
      if (!window || window.frame === frame) return;
      frame = window.frame;
      if (window.zoomed || window.fullScreen) return;
      clearTimeout(timer);
      timer = setTimeout(() => keepFrameOfFile(file, window.frame), KEEP_WINDOW_MS);
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [file, tabbed, id, store]);
  return <DesktopWindowName title={title} />;
}

/** The folders the drive item `entry` is in, nearest first. */
function foldersAround(drive: Parameters<typeof entryOf>[0], entry: DriveEntry): DriveEntry[] {
  const folders: DriveEntry[] = [];
  for (let at = entry.parent; at && folders.length < 64; ) {
    const folder = entryOf(drive, at);
    if (!folder) break;
    folders.push(folder);
    at = folder.parent;
  }
  return folders;
}

/** A file to put in the text: a drive file's id and name, or bytes that are not on the drive. */
type FileToInsert = Pick<DesktopDragItem, "id" | "name" | "type" | "bytes">;

const isPictureFile = ({ name, type }: { name: string; type?: string }) =>
  /^image\/(png|jpeg)$/.test(type ?? "") || /\.(png|jpe?g)$/i.test(name);

/** How long after a change a further window's document is kept. */
const KEEP_WINDOW_MS = 1000;

const TEXTEDIT_TABS = {
  app: "textedit",
  setting: "textedit.tabs",
  opening: { kind: "new" } satisfies TextEditOpening,
};

/** A window of the desktop knows its id, by which it finds the document it had, and its tabs. */
function TextEditOnDesktop(props: TextEditProps) {
  const { id } = useManagedWindow();
  const tabs = useDocumentTabs(TEXTEDIT_TABS);
  const store = useWindowManagerStore();
  return (
    <TextEditWindow {...props} {...tabs.rootProps} windowId={id} tabs={tabs} windowStore={store} />
  );
}

export function TextEdit(props: TextEditProps) {
  return use(DesktopWindowHostContext) ? (
    <TextEditOnDesktop {...props} />
  ) : (
    <TextEditWindow {...props} />
  );
}

function TextEditWindow({
  defaultDocument = captureDocument,
  defaultPlaces: initialPlaces = defaultPlaces,
  dialog: controlledDialog,
  defaultDialog = null,
  onDialogChange,
  actionsRef,
  onStatusChange,
  onSave,
  onPrint,
  panelContainer,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  opening: asked,
  windowId,
  tabs,
  windowStore,
  state = "key",
  width = 624,
  height = 537,
  className,
  onKeyDown,
  ...props
}: TextEditProps & {
  windowId?: string;
  tabs?: DocumentTabs;
  windowStore?: WindowManagerStore;
}) {
  // The document as it was when the text view was last filled: opened, made new or converted.
  // From then on the browser holds the text; `lines` follows it on every edit.
  const preferences = useTextEditPreferences();
  const desktopHost = use(DesktopWindowHostContext);
  // A window other than the first, or the first opened anew while others stayed, keeps its own
  // document and finds it again after a reload. It starts empty, or with what it kept.
  const [keptDraft] = useState(() => {
    if (!windowId) return null;
    const kept = asked?.kind === "kept" ? asked.body : readKeptWindow(windowId);
    return draftFromServer(kept, globalThis.document) ?? null;
  });
  const ownDraft = windowId !== undefined && (windowId !== FIRST_WINDOW || !!asked || !!keptDraft);
  const [firstDocument] = useState(
    () =>
      keptDraft?.document ??
      (ownDraft ? newDocumentFrom(preferences, globalThis.document) : defaultDocument),
  );
  const [loaded, setLoaded] = useState(firstDocument);
  const [properties, setProperties] = useState(firstDocument.properties);
  const propertiesShown = usePropertiesShown();
  const [substitutions, setSubstitutions] = useTextSubstitutions("textedit");
  const [dataDetectors, setDataDetectors] = useDesktopSetting(
    TEXTEDIT_SETTINGS.dataDetectors,
    readBoolean,
    false,
  );
  const [spellingShown, setSpellingShown] = useState(false);
  const [substitutionsShown, setSubstitutionsShown] = useState(false);
  const ignoredWords = useRef(new Set<string>());
  const { learned: learnedWords } = useLearnedWords();
  const justCorrected = useRef(false);
  const latestLearned = useRef(learnedWords);
  latestLearned.current = learnedWords;
  const pasteStart = useRef<ReturnType<typeof pasteEdges>>(undefined);
  const pastedText = useRef("");
  const toolTarget = useCallback(
    () => (editor.current ?? plainEditor.current) as HTMLElement | null,
    [],
  );
  const checkNow = useCallback(() => {
    const view = toolTarget();
    if (view) void checkDocumentNow(view, [...latestLearned.current, ...ignoredWords.current]);
  }, [toolTarget]);
  // Once the menu has closed, so the keyboard stays in the text.
  const checkNowAfterMenu = useCallback(
    () =>
      checkDocumentAfterMenu(toolTarget, () => [...latestLearned.current, ...ignoredWords.current]),
    [toolTarget],
  );
  // Counts the times the view was filled, which is the view's key: a new one starts afresh.
  const [session, setSession] = useState(0);
  const droppedThen = useRef<(() => void) | null>(null);
  const askToKeep = useDesktopValue(ASK_TO_KEEP_KEY, readBoolean, false) && servedByDesktopApp();
  const [name, setName] = useState(firstDocument.name);
  const [edited, setEdited] = useState(keptDraft?.edited ?? false);
  const lines = useRef<readonly string[]>(firstDocument.lines);
  const [places, setPlaces] = useState(initialPlaces);
  // Served by the desktop's Ferrite application: documents are files of the person's drive.
  const served = servedByDesktopApp();
  const drive = useDrive(served);
  // The drive file the document is, once it has one.
  const [file, setFile] = useState<DriveFileRef | null>(keptDraft?.file ?? null);
  const fileRef = useRef(file);
  fileRef.current = file;
  // The document's file was saved over elsewhere since the document read or saved it (`version`):
  // its changes are not written until the person chose, and `asking` shows the choice. It ends
  // when the document has another file or another version of it.
  const [stale, setStale] = useState<{
    id: string;
    version: number | undefined;
    asking: boolean;
  } | null>(null);
  useEffect(() => {
    setStale((now) => (now && (now.id !== file?.id || now.version !== file?.version) ? null : now));
  }, [file?.id, file?.version]);
  // A failure to show: an open or a save that the drive refused or could not carry out.
  const [problem, setProblem] = useState<{ message: string; detail: string } | null>(null);
  // An untitled document with changes, about to be replaced: what to do once it is dealt with,
  // and why it is asked when its file could not be written.
  const [discard, setDiscard] = useState<{
    proceed: () => void;
    reason?: string;
    /** General's Ask to keep changes, for a document with a file: Save writes into it. */
    inFile?: boolean;
  } | null>(null);
  const [addingLink, setAddingLink] = useState(false);
  // Edit > Attach Files…'s panel, and what a panel, a drop or a paste gave to put in the text.
  const [attaching, setAttaching] = useState(false);
  const [filesToInsert, setFilesToInsert] = useState<readonly FileToInsert[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  // Whether a further window's document is too long to be kept for a reload.
  const [keptTooLarge, setKeptTooLarge] = useState(false);
  const [choosingList, setChoosingList] = useState<TextEditListChoice | null>(null);
  const [tableSheet, setTableSheet] = useState<{
    value: TextEditTableChoice;
    table: HTMLTableElement | null;
    cells: HTMLTableCellElement[];
  } | null>(null);
  const [linkToAdd, setLinkToAdd] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [revertAsked, setRevertAsked] = useState(false);
  const [browsingVersions, setBrowsingVersions] = useState(false);
  // Counts the times the file's versions have changed in a way that bears on Previous Save.
  const [versionsRead, setVersionsRead] = useState(0);
  const [settingUpPage, setSettingUpPage] = useState(false);
  const [pageSetup, setPageSetup] = useDesktopSetting<PageSetup>(
    PAGE_SETUP,
    readPageSetup,
    DEFAULT_PAGE_SETUP,
  );
  const [spacingSheet, setSpacingSheet] = useState<ParagraphSpacing | null>(null);
  const [stylesSheet, setStylesSheet] = useState<{
    styles: readonly CopiedStyle[];
    canApply: boolean;
  } | null>(null);
  const [styleToApply, setStyleToApply] = useState<CopiedStyle | null>(null);
  // The Open panel's Ignore rich text commands and Plain Text Encoding, for the file it opens now.
  const [ignoreRich, setIgnoreRich] = useState(false);
  const [openEncoding, setOpenEncoding] = useState<string | null>(null);
  const [completing, setCompleting] = useState<TextEditCompleting | null>(null);
  // What Copy Style took, for Paste Style in this window.
  const [copiedStyle, setCopiedStyle] = useState<CopiedStyle | null>(null);
  const [copiedRuler, setCopiedRuler] = useState<CopiedRuler | null>(null);
  // What runs once the Save sheet has saved, when it was opened to keep a document first.
  const afterSave = useRef<(() => void) | null>(null);
  // The files Finder asked TextEdit to open, oldest first, each opened in turn once the window has
  // loaded.
  const [wanted, setWanted] = useState<readonly (DriveFileRef & { asCode?: boolean })[]>([]);
  // An open of a drive file under way: the next file asked for waits for it.
  const [openBusy, setOpenBusy] = useState(false);
  // Counts the edits of the text, so that each is a change to save.
  const [changes, setChanges] = useState(0);
  // A Save, a Save As or a format conversion's write under way: the document is locked (not
  // editable, no autosave, no
  // command) until it ends.
  const [fileBusy, setFileBusy] = useState(false);
  const lockFile = (on: boolean) => {
    pending.current = on;
    setFileBusy(on);
  };
  const changesRef = useRef(changes);
  changesRef.current = changes;
  // The count of changes the document's file holds: autosave writes when there are more.
  const written = useRef(0);
  // The same count, for the draft, which says whether changes are still to be written.
  const [writtenCount, setWrittenCount] = useState(0);
  const markWritten = useCallback((count: number) => {
    written.current = count;
    setWrittenCount(count);
  }, []);
  const [ownDialog, setOwnDialog] = useState(defaultDialog);
  const dialog = controlledDialog === undefined ? ownDialog : controlledDialog;
  const [saveExpanded, setSaveExpanded] = useState(false);
  const [format, setFormat] = useState(DEFAULT_FORMAT);
  // The Fonts and Colors panels, opened with Show Fonts and Show Colors.
  const [fontsShown, setFontsShown] = useState(false);
  const [colorsShown, setColorsShown] = useState(false);
  // The ruler's indents, in points: first line and head from the origin, tail from the end.
  const [indents, setIndents] = useState({ first: 0, head: 0, tail: 0 });
  // What the paragraph at the insertion point says for itself, over the document's ruler.
  const [ownIndents, setOwnIndents] = useState<ParagraphIndents | null>(null);
  const [tabStops, setTabStops] = useState<readonly number[]>(TAB_STOPS);
  const [ownTabs, setOwnTabs] = useState<readonly TabStop[] | null>(null);
  const [container, setContainer] = useState(
    (typeof width === "number" ? width : 624) - CONTAINER_INSET,
  );
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  // The Open panel is rendered into the page's body, which exists once the app is mounted.
  const [mounted, setMounted] = useState(false);

  // Format > Prevent Editing: the document's own state, kept with its draft.
  const [prevented, setPrevented] = useState(keptDraft?.readOnly === true);
  // A key pressed in a locked file asks what to do about it.
  const [lockAsked, setLockAsked] = useState(false);
  // Format > Make Plain Text waits for the person's answer to its warning.
  const [plainAsked, setPlainAsked] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const plainEditor = useRef<HTMLTextAreaElement>(null);
  // Counts the documents the window has shown: a read or a save that finishes after another
  // document took the window applies nothing to that one.
  const documentGeneration = useRef(0);
  // Counts the opens asked for: only the last one asked takes the window.
  const opening = useRef(0);
  // The selection as last read inside the rich text view. A control of the format bar, and
  // its menu, take the focus before the command runs, and may take the selection with it.
  const selection = useRef<Range | null>(null);
  // The selection to put back in the view the next fill makes: another window's change replaced
  // the document while the person was typing in it.
  const keptSelection = useRef<TextSelection | null>(null);
  const plain = loaded.format === "plain";
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const view = useTextEditView();
  const viewRef = useRef(view);
  viewRef.current = view;
  const toggleRuler = useCallback(
    () => changeDesktopValue(TEXTEDIT_SETTINGS.ruler, !preferencesRef.current.ruler),
    [],
  );

  const setDialog = useCallback(
    (next: TextEditDialog | null) => {
      setOwnDialog(next);
      onDialogChange?.(next);
    },
    [onDialogChange],
  );

  /** Fill the view with a document: the text, the format bar and the ruler start afresh. */
  // The session the view holds: a render for a new one runs while the old view is still in the page.
  const filledSession = useRef(0);
  const load = useCallback(
    (document: TextEditDocument, isEdited: boolean, keepPrevented = false) => {
      documentGeneration.current += 1;
      if (!keepPrevented) setPrevented(false);
      lines.current = document.lines;
      selection.current = null;
      // What the document had is no change of the new one's to write.
      markWritten(changesRef.current);
      setLoaded(document);
      setProperties(document.properties);
      setName(document.name);
      setEdited(isEdited);
      setSession((count) => count + 1);
      setFormat((current) => ({ ...DEFAULT_FORMAT, color: current.color }));
      setIndents({
        first: document.ruler?.first ?? 0,
        head: document.ruler?.head ?? 0,
        tail: document.ruler?.tail ?? 0,
      });
      setTabStops(document.ruler?.tabStops ?? TAB_STOPS);
    },
    [markWritten],
  );

  // A saved rich text document is shown as the browser held it: a copy of its paragraphs,
  // formats included, takes the place of the plain lines. A selection kept from the view this
  // one replaces is put back, with the keyboard.
  // biome-ignore lint/correctness/useExhaustiveDependencies: filled once for each view (session)
  useLayoutEffect(() => {
    filledSession.current = session;
    const node = editor.current;
    if (node && loaded.content) node.replaceChildren(loaded.content.cloneNode(true));
    const kept = keptSelection.current;
    keptSelection.current = null;
    if (!kept) return;
    if (node) {
      restoreTextSelection(node, kept);
      return;
    }
    const area = plainEditor.current;
    if (!area) return;
    const start = mapTextOffset(kept.text, area.value, kept.start);
    const end = Math.max(start, mapTextOffset(kept.text, area.value, kept.end));
    area.focus({ preventScroll: true });
    area.setSelectionRange(start, end);
  }, [session]);

  /** The selection of the view while it has the keyboard, to keep across a fill; else `null`. */
  const selectionToKeep = (): TextSelection | null => {
    const rich = editor.current;
    const area = plainEditor.current;
    const active = (rich ?? area)?.ownerDocument.activeElement;
    if (rich && active === rich) return readTextSelection(rich);
    if (area && active === area) {
      return { start: area.selectionStart, end: area.selectionEnd, text: area.value };
    }
    return null;
  };

  /** What the format bar shows, read where the insertion point is. */
  const sync = useCallback(() => {
    const node = editor.current;
    if (!node) return;
    const document = node.ownerDocument;
    const current = document.getSelection();
    const inside =
      current && current.rangeCount > 0 && node.contains(current.anchorNode) ? current : null;
    if (inside) selection.current = inside.getRangeAt(0).cloneRange();
    // While a control of the bar has the selection, the bar keeps showing the format of
    // the place in the document that it will act on: its first character, or the caret.
    const range = inside ? inside.getRangeAt(0) : selection.current;
    const anchor = (range && richTextStartNode(node, range)) ?? node;
    const element = anchor instanceof Element ? anchor : (anchor.parentElement ?? node);
    let paragraph: Element | null = element;
    while (paragraph && paragraph !== node && paragraph.parentElement !== node) {
      paragraph = paragraph.parentElement;
    }
    // The first character's styles, or at the insertion point the styles of what is typed next.
    const read = readRichTextFormat(node, range);
    const own =
      paragraph instanceof HTMLElement && paragraph !== node
        ? paragraphIndents(paragraph)
        : undefined;
    setOwnIndents((before) =>
      JSON.stringify(before) === JSON.stringify(own ?? null) ? before : (own ?? null),
    );
    const tabsOfParagraph =
      paragraph instanceof HTMLElement && paragraph !== node
        ? (parseTabStops(paragraph.dataset.tabs) ?? null)
        : null;
    setOwnTabs((before) =>
      JSON.stringify(before) === JSON.stringify(tabsOfParagraph) ? before : tabsOfParagraph,
    );
    setFormat((before) => {
      const next: TextEditFormat = {
        ...before,
        ...paragraphFormatOf(
          paragraph instanceof HTMLElement && paragraph !== node ? paragraph : undefined,
        ),
        bold: read.bold,
        italic: read.italic,
        underline: read.underline,
        strikethrough: read.strikethrough,
        family: FONTS.find((font) => font.value === read.family)?.value ?? before.family,
        size: read.size > 0 ? Math.round(read.size) : before.size,
        color: toHex(read.color) ?? before.color,
      };
      return sameFormat(before, next) ? before : next;
    });
  }, []);

  // The format bar follows the insertion point, and the selection is remembered for it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new view (session, plain) is a new element to read
  useEffect(() => {
    const node = editor.current;
    if (!node) return;
    const document = node.ownerDocument;
    sync();
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, [sync, session, plain]);

  // The tail indent's marker stands at the end of the text container, which follows the window, or
  // at the page's right margin.
  const inset = view.wrap ? 2 * PAGE_MARGIN : CONTAINER_INSET;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new view (session, plain) is a new element to measure
  useEffect(() => {
    const node = editor.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth > inset) setContainer(node.clientWidth - inset);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [session, plain, inset]);

  useEffect(() => setMounted(true), []);

  // A dismissed dialog gives the keyboard back to the document.
  const hadDialog = useRef(dialog !== null);
  useEffect(() => {
    if (hadDialog.current && dialog === null) {
      (editor.current ?? plainEditor.current)?.focus({ preventScroll: true });
    }
    hadDialog.current = dialog !== null;
  }, [dialog]);

  // Converting swaps the text view for another element, which drops the focus to the body; the
  // new view takes the keyboard back once it is in place.
  const refocus = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the format (the view) changes
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    (editor.current ?? plainEditor.current)?.focus({ preventScroll: true });
  }, [plain]);

  const convert = useCallback(
    (next: TextEditDocument["format"]) => {
      if (next === loaded.format) return;
      refocus.current = true;
      load({ name, format: next, lines: lines.current }, true);
      // A file of the other format is not saved over with this one: the next Save asks where. A
      // file that the format is still written in keeps it, and the conversion is a change still
      // to write into it (autosave writes it; New and Open ask first).
      const bound = fileRef.current;
      if (bound && !fileFitsFormat(bound.name, next)) setFile(null);
      else if (bound) markWritten(changesRef.current - 1);
    },
    [load, loaded.format, name, markWritten],
  );
  // Making a rich text document plain loses its formats: the person is asked first, as on a Mac.
  const convertRef = useRef(convert);
  convertRef.current = (next) => {
    if (next === "plain" && !plain) setPlainAsked(true);
    else convert(next);
  };
  const newDocument = useCallback(() => {
    load(newDocumentFrom(preferencesRef.current, globalThis.document), false);
    setDialog(null);
  }, [load, setDialog]);

  // While the server's reads are pending, the app's commands do nothing (see `loading` below).
  const pending = useRef(false);
  // The File menu's commands on the drive, as the render they run after has them.
  const fileCommandsRef = useRef<TextEditFileCommands | null>(null);
  // The question asked before the document is replaced, as the render it runs after has it.
  const guardRef = useRef<(next: () => void) => void>((next) => next());
  const fileActions = useMemo<TextEditFileCommands | undefined>(() => {
    if (!served) return undefined;
    const run = (act: (commands: TextEditFileCommands) => void) => () => {
      const commands = fileCommandsRef.current;
      if (!pending.current && commands) act(commands);
    };
    return {
      newDocument: run((commands) => commands.newDocument()),
      open: run((commands) => commands.open()),
      openRecent: (id: string) => run((commands) => commands.openRecent(id))(),
      clearRecents: run((commands) => commands.clearRecents()),
      save: run((commands) => commands.save()),
      duplicate: run((commands) => commands.duplicate()),
      rename: run((commands) => commands.rename()),
      moveTo: run((commands) => commands.moveTo()),
      revert: run((commands) => commands.revert()),
      revertToPrevious: run((commands) => commands.revertToPrevious()),
      browseVersions: run((commands) => commands.browseVersions()),
      saveAs: run((commands) => commands.saveAs()),
      exportPdf: run((commands) => commands.exportPdf()),
      pageSetup: run((commands) => commands.pageSetup()),
      print: run((commands) => commands.print()),
      showProperties: run((commands) => commands.showProperties()),
    };
  }, [served]);
  /** Format > Table… and Format > Lists…, for the menus, which are made once per state. */
  const sheets = useRef({ showTable: () => {}, showLists: () => {} });
  /** Where the last secondary click on the text landed. */
  const menuPoint = useRef<{ x: number; y: number } | null>(null);
  useImperativeHandle(
    actionsRef,
    () => ({
      newDocument: () => {
        if (pending.current) return;
        if (fileCommandsRef.current) fileCommandsRef.current.newDocument();
        else guardRef.current(newDocument);
      },
      show: (next: TextEditDialog) => {
        if (!pending.current) setDialog(next);
      },
      setFormat: (next: TextEditDocument["format"]) => {
        if (!pending.current) convertRef.current(next);
      },
      format: (command: RichTextCommand) => {
        if (!pending.current) formatRef.current(command);
      },
      extra: (command: TextEditExtraCommand) => {
        if (!pending.current) extraRef.current(command);
      },
      editTarget: () => latestEdit.current(),
      find: () => latestFind.current,
      togglePrevented: () => {
        if (!pending.current) setPrevented((now) => !now);
      },
      toggleHyphenation: () => {
        if (!pending.current) viewRef.current.toggleHyphenation();
      },
      toggleWrap: () => {
        if (!pending.current) viewRef.current.toggleWrap();
      },
      toggleRuler: () => {
        if (!pending.current) toggleRuler();
      },
      showTable: () => {
        if (!pending.current) sheets.current.showTable();
      },
      showLists: () => {
        if (!pending.current) sheets.current.showLists();
      },
      showSpelling: () => {
        if (!pending.current) setSpellingShown(true);
      },
      showSubstitutions: () => {
        if (!pending.current) setSubstitutionsShown(true);
      },
      checkSpelling: () => {
        if (!pending.current) checkNowAfterMenu();
      },
      ...(fileActions ? { file: fileActions } : undefined),
    }),
    [newDocument, setDialog, fileActions, toggleRuler, checkNowAfterMenu],
  );

  /** The view takes the keyboard and its selection back; returns the range a command acts on. */
  const reselect = (node: HTMLElement): Range => {
    const document = node.ownerDocument;
    // The selection in the view as it is now, when there is one (a command typed at once after a
    // selection is made, before the view has heard of it); else the one remembered for it.
    const live = document.getSelection();
    const inside =
      live && live.rangeCount > 0 && node.contains(live.anchorNode)
        ? live.getRangeAt(0).cloneRange()
        : null;
    node.focus({ preventScroll: true });
    let range = inside ?? selection.current;
    if (!range || !node.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(true);
    }
    const current = document.getSelection();
    current?.removeAllRanges();
    current?.addRange(range);
    return range;
  };

  const edit = () => {
    const node = editor.current;
    if (node) lines.current = readLines(node);
    setEdited(true);
    if (served) setChanges((count) => count + 1);
  };

  /** Apply what a control of the format bar changed to the selection or its paragraphs. */
  // A Fonts or Colors panel that holds the keyboard (a control in it is given it back after each
  // change it makes) leaves the keyboard on the page when it closes, where TextEdit's key
  // equivalents never arrive. As a document does in macOS, the view takes it back, with its
  // selection.
  const panelsWere = useRef({ fonts: false, colors: false });
  const disjoint = useDisjointSelection(editor, selection, `${session}-${plain}`);
  // Typing runs as Undo steps in every engine (Firefox otherwise joins them): src/lib/rich-text.ts.
  useEffect(() => keepTypingRuns(), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when a panel opens or closes; reselect reads the view's refs
  useLayoutEffect(() => {
    const were = panelsWere.current;
    panelsWere.current = { fonts: fontsShown, colors: colorsShown };
    if (!((were.fonts && !fontsShown) || (were.colors && !colorsShown))) return;
    const node = editor.current;
    if (!node?.isConnected) return;
    const active = node.ownerDocument.activeElement;
    if (active && active !== node.ownerDocument.body && active.isConnected) return;
    reselect(node);
  }, [fontsShown, colorsShown]);
  // TextEdit's key equivalents arrive in its window's onKeyDown, so only while the keyboard is in the window. A sheet
  // that closes gives the focus back to nothing, and the keyboard is then on the page. In macOS the key window gets its
  // menus' key equivalents whatever has the focus: while TextEdit is the key window, a key pressed with the keyboard on
  // the page itself or in the menu bar (never in another window or control) is answered as in the window. Both are
  // assigned below, where the commands and the window's state are.
  const answerKeyRef = useRef<(key: KeyboardEvent) => boolean>(() => false);
  const keyWindowRef = useRef(false);
  useEffect(() => {
    const page = globalThis.document;
    const onPageKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !keyWindowRef.current) return;
      // On the page itself, or in the menu bar (which shows the key window's menus); never in another window or control.
      const target = event.target;
      const onPage = target === page.body || target === page.documentElement;
      if (!onPage && !(target instanceof Element && target.closest('[role="menubar"]'))) return;
      if (answerKeyRef.current(event)) event.preventDefault();
    };
    page.addEventListener("keydown", onPageKeyDown);
    return () => page.removeEventListener("keydown", onPageKeyDown);
  }, []);
  const applyFormat = (change: Partial<TextEditFormat>) => {
    disjoint.each(() => applyFormatHere(change));
  };
  const applyFormatHere = (change: Partial<TextEditFormat>) => {
    const node = editor.current;
    if (!node || prevented) return;
    const document = node.ownerDocument;
    // Read before reselect(), which gives the view the keyboard back.
    const back = document.activeElement;
    const range = reselect(node);
    for (const [toggle] of TOGGLES) {
      // Set or cleared on the whole selection, as AppKit does, whatever its first character has.
      const wanted = change[toggle];
      if (wanted !== undefined) setRichTextStyle(node, toggle, wanted);
    }
    if (change.family !== undefined) {
      const font = FONTS.find((candidate) => candidate.value === change.family);
      runCommand(document, "fontName", font?.family ?? change.family);
    }
    if (change.size !== undefined) setFontSize(node, change.size);
    if (change.color !== undefined) runCommand(document, "foreColor", change.color);
    if (change.highlight !== undefined) {
      const color = HIGHLIGHTS.find((entry) => entry.value === change.highlight)?.color;
      runCommand(document, "hiliteColor", color ?? "transparent");
    }
    if (change.align !== undefined || change.spacing !== undefined || change.list !== undefined) {
      setParagraphFormat(node, range, {
        align: change.align,
        spacing: change.spacing,
        list: change.list,
      });
    }
    // The browser selects what the change made: keep that selection now, before a Fonts or
    // Colors panel control takes the keyboard back, so that the control's next change (the next
    // digit typed in a value field, the slider moved again) acts on the same text.
    const made = document.getSelection();
    if (made && made.rangeCount > 0 && node.contains(made.anchorNode)) {
      selection.current = made.getRangeAt(0).cloneRange();
    }
    // Shown at once; `sync` then corrects it from the browser where the browser can tell.
    setFormat((before) => ({ ...before, ...change }));
    edit();
    sync();
    if (
      back instanceof HTMLElement &&
      back !== node &&
      back.closest(".mac-font-panel, .mac-color-panel")
    ) {
      back.focus({ preventScroll: true });
    }
  };

  const clearFormat = () => {
    const node = editor.current;
    if (!node) return;
    disjoint.each(() => {
      const range = reselect(node);
      runCommand(node.ownerDocument, "removeFormat");
      setParagraphFormat(node, range, PLAIN_PARAGRAPH);
    });
    setFormat((before) => ({ ...DEFAULT_FORMAT, color: before.color }));
    edit();
    sync();
  };

  /** A Format row beyond the browser's commands: see `textedit-format.tsx`. */
  const formatExtra = (command: TextEditExtraCommand) => {
    if (command.startsWith("show-") || command.startsWith("copy-")) formatExtraHere(command);
    else disjoint.each(() => formatExtraHere(command));
  };
  const formatExtraHere = (command: TextEditExtraCommand) => {
    const node = editor.current;
    if (!node || plain || prevented) return;
    const range = reselect(node);
    if (command === "show-styles") {
      setStylesSheet({ styles: documentStyles(node), canApply: !range.collapsed });
      return;
    }
    if (command === "show-spacing") {
      setSpacingSheet(paragraphSpacingOf(paragraphsOf(node, range)[0]));
      return;
    }
    if (command === "copy-ruler") {
      setCopiedRuler(copyRuler(node, range));
      return;
    }
    if (command === "paste-ruler" || command.startsWith("direction-")) {
      if (command === "paste-ruler") {
        if (copiedRuler) pasteRuler(node, range, copiedRuler);
      } else {
        setWritingDirection(
          node,
          range,
          command === "direction-natural" ? "auto" : command === "direction-ltr" ? "ltr" : "rtl",
        );
      }
      edit();
      sync();
      return;
    }
    if (command === "copy-style") {
      setCopiedStyle(copyStyle(node));
      return;
    }
    if (command === "paste-style") {
      if (copiedStyle) styleSelection(node, copiedStyle);
    } else {
      const styles = stylesOf(command, node);
      if (styles) styleSelection(node, styles);
    }
    edit();
    sync();
  };
  const extraRef = useRef(formatExtra);
  extraRef.current = formatExtra;

  /** The Add Link sheet's address: on the selected text, or as its own text at an insertion point. */
  const addLink = (address: string) => {
    setAddingLink(false);
    setLinkToAdd(address);
  };
  // Once the sheet has let the window go: the view takes no selection while it is inert.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs for the address the sheet gave
  useEffect(() => {
    if (linkToAdd === null || addingLink) return;
    setLinkToAdd(null);
    const node = editor.current;
    if (!node) return;
    disjoint.each(() => {
      const range = reselect(node);
      if (range.collapsed) {
        const link = node.ownerDocument.createElement("a");
        link.href = linkToAdd;
        link.textContent = linkToAdd;
        node.ownerDocument.execCommand("insertHTML", false, link.outerHTML);
      } else node.ownerDocument.execCommand("createLink", false, linkToAdd);
    });
    edit();
    sync();
  }, [linkToAdd, addingLink]);

  // Once the Styles sheet has let the window go, as for a link.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs for the style the sheet gave
  useEffect(() => {
    if (styleToApply === null || stylesSheet !== null) return;
    setStyleToApply(null);
    const node = editor.current;
    if (!node) return;
    disjoint.each(() => {
      reselect(node);
      styleSelection(node, styleToApply);
    });
    edit();
    sync();
  }, [styleToApply, stylesSheet]);

  // The Lists, Table, Spacing and Styles sheets give the document the keyboard and its selection back as they go.
  const formatSheetOpen =
    tableSheet !== null || choosingList !== null || spacingSheet !== null || stylesSheet !== null;
  const formatSheetWasOpen = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when a sheet closes, and `reselect` reads only refs.
  useEffect(() => {
    if (formatSheetWasOpen.current && !formatSheetOpen && editor.current) {
      const node = editor.current;
      whenMenusClosed(node.ownerDocument, () => {
        if (editor.current) reselect(editor.current);
      });
    }
    formatSheetWasOpen.current = formatSheetOpen;
  }, [formatSheetOpen]);

  /** A command of Format > Font or Format > Text, from the menu bar or its key equivalent. */
  const formatCommand = (command: RichTextCommand) => {
    if (plain || prevented) return;
    switch (command) {
      case "show-fonts":
        setFontsShown((shown) => !shown);
        return;
      case "show-colors":
        setColorsShown((shown) => !shown);
        return;
      case "bold":
      case "italic":
      case "underline":
      case "strikethrough": {
        // Toggled from the text as it is now, not from what the format bar last read.
        const node = editor.current;
        const live = node?.ownerDocument.getSelection();
        const range =
          live && live.rangeCount > 0 && node?.contains(live.anchorNode)
            ? live.getRangeAt(0)
            : selection.current;
        const now = node ? readRichTextFormat(node, range)[command] : format[command];
        applyFormat({ [command]: !now } as Partial<TextEditFormat>);
        return;
      }
      case "bigger":
        applyFormat({ size: Math.min(format.size + 1, 999) });
        return;
      case "smaller":
        applyFormat({ size: Math.max(format.size - 1, 1) });
        return;
      default:
        applyFormat({ align: command.slice("align-".length) as TextEditFormat["align"] });
    }
  };
  // The menu bar's actions call the command of the render they run after.
  const formatRef = useRef(formatCommand);
  formatRef.current = formatCommand;

  const save = ({ name: typed, place, folders, format: saveFormat }: TextEditSaveValues) => {
    const propertiesPart = properties ? { properties } : undefined;
    const node = editor.current;
    // Rich text keeps its formats: a copy of the view's paragraphs, and the ruler.
    let content: DocumentFragment | undefined;
    if (saveFormat === "rich" && node) {
      content = node.ownerDocument.createDocumentFragment();
      content.append(...[...node.childNodes].map((child) => child.cloneNode(true)));
    }
    const document: TextEditDocument = {
      name: typed,
      format: saveFormat,
      lines: lines.current,
      ...(content ? { content, ruler: { ...indents, tabStops }, ...propertiesPart } : undefined),
    };
    const file = {
      id: `saved-${[place, ...folders, typed].join("/")}`,
      name: typed,
      kind: "document" as const,
      detail: saveFormat === "plain" ? "Plain Text Document" : "Rich Text Document",
      document,
    };
    setPlaces((all) => withFile(all, place, folders, file));
    // Saving rich text as plain text makes the document plain text, as in TextEdit.
    if (saveFormat !== loaded.format) load(document, false);
    setName(typed);
    setEdited(false);
    setDialog(null);
    onSave?.(document, place, folders);
    const then = afterSave.current;
    afterSave.current = null;
    then?.();
  };

  const newFolder = (place: string, folders: readonly string[]) => {
    setPlaces(withFolder(places, place, folders));
  };

  // ---------------------------------------------------------------------------------------
  // The person's drive, served by the desktop's Ferrite application.

  /** The document as it is now, written in `format`: its lines, formats and ruler. */
  const bodyOf = (format: TextEditDocument["format"] = loaded.format): DocumentBody => ({
    format,
    lines: lines.current,
    content: format === "rich" && !plain ? editor.current : null,
    ...(format === "rich"
      ? {
          ruler: { ...indents, tabStops: [...tabStops] },
          ...(properties ? { properties } : undefined),
        }
      : undefined),
  });

  /** A copy of the rich text view's paragraphs with their formats. */
  const contentCopy = (): DocumentFragment | undefined => {
    const node = editor.current;
    if (!node || plain) return undefined;
    const copy = node.ownerDocument.createDocumentFragment();
    copy.append(...[...node.childNodes].map((child) => child.cloneNode(true)));
    return copy;
  };

  /**
   * Shows what went wrong. A file that is gone, in the Trash or no longer a file (404, 409) is
   * no longer the document's: the next Save asks where to save.
   */
  const fail = (message: string, error: unknown, unbind?: string) => {
    setProblem({ message, detail: messageOf(error) });
    const status = error instanceof DriveError ? error.status : 0;
    if (unbind && (status === 404 || status === 409) && fileRef.current?.id === unbind) {
      setFile(null);
    }
  };

  // Writes into the document's file go one after the other.
  const writing = useRef<Promise<unknown>>(Promise.resolve());
  // Keeps the window's record the moment a write moves its file on: a reload before the record's
  // usual delay would otherwise bring the window back with a version the file has left.
  const keepBoundFile = useRef<(bound: DriveFileRef) => void>(() => {});
  /**
   * Writes `text` into the document's file in place, made from the file's version the document was
   * read from or last saved as; `force` (Save Anyway) writes over whatever the file holds. Resolves
   * with whether it was written. A failure is shown in an alert, or handed to `onError` instead
   * when it is given. A file saved over elsewhere meanwhile, or one whose version the document
   * does not know (a draft kept before versions were), is never written without `force`: the
   * window asks whether to save anyway, and keeps its changes until then (`stale`).
   */
  const writeText = (
    text: string,
    format: TextEditDocument["format"],
    onError?: (error: unknown) => void,
    force = false,
  ): Promise<boolean> => {
    const target = fileRef.current;
    if (!target) return Promise.resolve(false);
    const at = changesRef.current;
    // The document this text is of: a write queued or under way when another document took the
    // window (a reload of the draft, even of the same file) writes nothing, and counts nothing as
    // written in that other one.
    const generation = documentGeneration.current;
    const current = () => documentGeneration.current === generation;
    const task = async () => {
      if (!current()) return false;
      const entry = await currentFile(target.id);
      if (!entry?.parent) {
        throw new DriveError(404, `“${target.name}” is no longer on your drive.`);
      }
      if (!current()) return false;
      // The version the document holds now: an earlier write of this queue moved it on.
      const bound = fileRef.current?.id === target.id ? fileRef.current : target;
      const version = force ? undefined : bound.version;
      if (!force && version === undefined) {
        throw new DriveError(
          STALE_FILE,
          `“${entry.name}” may have been changed elsewhere since this document last saved it.`,
        );
      }
      const made = {
        id: entry.id,
        name: entry.name,
        ...(bound.encoding ? { encoding: bound.encoding } : undefined),
      };
      const saved = await writeDriveDocument(
        version !== undefined ? { ...made, version } : made,
        entry.parent,
        text,
        format,
      ).catch(async (error: unknown) => {
        // The drive has a newer version, but one holding this very text is this document's own
        // write whose reply went with a reload: there is nothing to ask about.
        if (!(error instanceof DriveError) || error.status !== STALE_FILE) throw error;
        const read = await readFileEntry(entry.id).catch(() => null);
        if (read && (await read.blob.text()) === text) return read.entry;
        throw error;
      });
      // Writes go one after the other, so a later one holds every change an earlier one did. Counted
      // only while the file is still the document's.
      if (fileRef.current?.id !== saved.id) return false;
      if (!current()) {
        // Another text of this file took the window from the version this write replaced (Revert
        // To, say): that text's next write is made from the version this one made.
        if (version !== undefined && fileRef.current.version === version) {
          const moved = { ...fileRef.current, version: saved.version ?? 0 };
          fileRef.current = moved;
          setFile(moved);
          keepBoundFile.current(moved);
        }
        return false;
      }
      markWritten(at);
      // The document is now the file's new version; renamed in Finder meanwhile, the window takes
      // the file's name. The ref moves at once, for the next write of the queue.
      const renamed = fileRef.current.name !== saved.name;
      const next = {
        id: saved.id,
        name: saved.name,
        version: saved.version ?? 0,
        ...(bound.encoding ? { encoding: bound.encoding } : undefined),
      };
      fileRef.current = next;
      setFile(next);
      keepBoundFile.current(next);
      if (renamed) setName(saved.name);
      return true;
    };
    const run = writing.current.then(task, task);
    writing.current = run.catch(() => undefined);
    return run.catch((error) => {
      // Another document took the window meanwhile: the failure is not that one's to show, nor
      // its file to let go of.
      if (!current()) return false;
      const status = error instanceof DriveError ? error.status : 0;
      // Saved over elsewhere since this document read or saved it: nothing is written over that
      // change unasked. The window asks whether to save anyway, whatever the write was for (a New
      // or an Open that wrote first stops there), autosave stops for the file, and the window
      // keeps its changes.
      if (status === STALE_FILE && fileRef.current?.id === target.id) {
        setStale({ id: target.id, version: fileRef.current.version, asking: true });
        return false;
      }
      if (onError) {
        if ((status === 404 || status === 409) && fileRef.current?.id === target.id) {
          setFile(null);
        }
        onError(error);
      } else {
        fail(`The document “${titleOf(target.name)}” could not be saved.`, error, target.id);
      }
      return false;
    });
  };
  const writeNow = (onError?: (error: unknown) => void, force = false) =>
    writeText(fileText(bodyOf(), fileRef.current?.name ?? ""), loaded.format, onError, force);

  /**
   * Runs `next`, which replaces the document: a document with a file has its changes written
   * first, and is replaced only once they are; an untitled one with changes asks whether to save
   * them. When the file cannot be written, the window keeps the document and asks the same: Save…
   * keeps it in a new file, Don’t Save lets it go. When the file was saved over elsewhere, the
   * window asks whether to save anyway instead, and `next` does not run.
   */
  const guard = (next: () => void) => {
    if (!fileRef.current) {
      if (edited) setDiscard({ proceed: next });
      else next();
      return;
    }
    if (changesRef.current <= written.current) {
      next();
      return;
    }
    if (askToKeep) {
      setDiscard({ proceed: next, inFile: true });
      return;
    }
    const generation = documentGeneration.current;
    void writeNow((error) => {
      if (documentGeneration.current === generation) {
        setDiscard({ proceed: next, reason: messageOf(error) });
      }
    }).then((ok) => {
      // Written: replace it, unless another document took the window meanwhile; changes typed
      // while it was written are dealt with the same way first. An open that gave way to that
      // other document no longer holds the next file asked for.
      if (ok && documentGeneration.current === generation) guardRef.current(next);
      else if (documentGeneration.current !== generation) setOpenBusy(false);
    });
  };
  guardRef.current = guard;

  /**
   * Don't Save, for a document with a file while General asks to keep changes: the document goes
   * back to what its file holds, so the draft kept for the person holds no change to write either,
   * and `next` runs.
   */
  const dropChanges = (next: () => void) => {
    const target = fileRef.current;
    if (!target) {
      next();
      return;
    }
    const generation = documentGeneration.current;
    lockFile(true);
    void readDriveDocument(target, globalThis.document)
      .then(
        ({ document, text, version }) => {
          if (documentGeneration.current !== generation) return;
          load(openedDocument(document, text, preferencesRef.current), false);
          setFile({ ...target, version });
          droppedThen.current = next;
        },
        (error) => {
          if (documentGeneration.current === generation) {
            fail(`The document “${target.name}” could not be opened.`, error);
          }
        },
      )
      .finally(() => lockFile(false));
  };

  /**
   * Opens the drive file in the window: it becomes the document, with its file. `asCode` is the
   * Open panel's Ignore rich text commands.
   */
  const openEntry = (entry: DriveFileRef, asCode = false) => {
    setOpenBusy(true);
    // Asked for now: a draft's refresh read under way gives way to it (see `syncDraft`), even
    // while the document it replaces is still being written.
    opening.current += 1;
    guard(() => {
      // Run now, or once the person answered the save sheet (Don't Save, or Save… and its Save):
      // the next file asked for waits on this one again.
      setOpenBusy(true);
      setDialog(null);
      if (fileRef.current?.id === entry.id) {
        setOpenBusy(false);
        return;
      }
      const request = ++opening.current;
      const generation = documentGeneration.current;
      const at = changesRef.current;
      void openDriveDocument(entry, globalThis.document)
        .then(
          ({ document, text, version, encoding }) => {
            // A later open, or another document, took the window while this one was read.
            if (opening.current !== request || documentGeneration.current !== generation) return;
            // The document was changed while the file was read: those changes are dealt with
            // first. This read is over: the retry is the open under way now, and the next file
            // asked for waits on it (`openBusy` is the retry's to clear).
            if (changesRef.current !== at) {
              opening.current += 1;
              openEntryRef.current(entry, asCode);
              return;
            }
            load(
              openedDocument(
                document,
                text,
                asCode
                  ? { ...preferencesRef.current, htmlAsCode: true, rtfAsCode: true }
                  : preferencesRef.current,
              ),
              false,
            );
            setFile({
              id: entry.id,
              name: entry.name,
              version,
              ...(encoding ? { encoding } : undefined),
            });
            keepLastSaved(entry.id, text, version);
          },
          (error) => {
            // Said only while this open is the one asked for last and its document is still
            // the window's (a New Document or a draft reload meanwhile replaced it).
            if (opening.current === request && documentGeneration.current === generation) {
              fail(`The document “${entry.name}” could not be opened.`, error);
            }
          },
        )
        .finally(() => {
          if (opening.current === request) setOpenBusy(false);
        });
    });
  };
  /** Asks the desktop for another window of TextEdit. */
  const openNewWindow = (
    what: { kind: "new" } | { kind: "file"; file: DriveFileRef; asCode?: boolean },
  ) =>
    requestDesktopEffects([
      {
        newWindow: "textedit",
        opening: what satisfies TextEditOpening,
      },
    ]);

  /**
   * A file to open, as on a Mac: the window that has it comes to the front, a window that holds nothing
   * yet takes it, and otherwise it gets a window of its own. Off the desktop a window is all there is.
   */
  const routeOpen = (entry: DriveFileRef & { asCode?: boolean }) => {
    const { asCode = false, ...file } = entry;
    if (!desktopHost) {
      openEntry(file, asCode);
      return;
    }
    const there = windowWithFile(entry.id);
    if (there) {
      setDialog(null);
      there.focus();
      return;
    }
    if (!fileRef.current && !edited) {
      openEntry(file, asCode);
      return;
    }
    setDialog(null);
    openNewWindow({ kind: "file", file, ...(asCode ? { asCode } : undefined) });
  };

  // A document to replace that asks whether to save it, or whether to save over a file changed
  // elsewhere: the open waits on that answer, and the next file asked for waits on the sheet.
  useEffect(() => {
    if (discard !== null || stale?.asking) setOpenBusy(false);
  }, [discard, stale?.asking]);

  /**
   * File > Save: into the document's file, or through the Save sheet when it has none. The
   * document is locked while the file is written, as for Save As, so they never overlap. `force`
   * is Save Anyway: over a version of the file saved elsewhere since this document read it.
   */
  const saveDocument = (force = false) => {
    const target = fileRef.current;
    if (!target) {
      setDialog("save");
      return;
    }
    const at = changesRef.current;
    const generation = documentGeneration.current;
    lockFile(true);
    void writeNow(undefined, force)
      .then((ok) => {
        // Saved as it is still shown: the same document, in the same file, with no change since.
        if (
          ok &&
          documentGeneration.current === generation &&
          fileRef.current?.id === target.id &&
          changesRef.current === at
        ) {
          setEdited(false);
          const version = fileRef.current?.version;
          keepLastSaved(target.id, fileText(bodyOf(), target.name), version);
          if (version !== undefined && !isBundleName(target.name)) {
            // Only marks a version the autosave after it leaves standing: the save itself is done.
            void keepVersion(target.id, version)
              .catch(() => undefined)
              .then(() => setVersionsRead((count) => count + 1));
          }
        }
      })
      .finally(() => lockFile(false));
  };

  /**
   * The Save sheet's Save on the drive: a new file, which becomes the document's. The document is
   * locked meanwhile (no editing, no autosave, no command), so the new file holds exactly what the
   * window shows and the old file never gets a change the new one lacks.
   */
  const saveNew = (
    target: DriveSaveTarget,
    format: TextEditDocument["format"],
    encoding = "utf-8",
  ) => {
    setDialog(null);
    lockFile(true);
    let generation = documentGeneration.current;
    void (async () => {
      // Save As: the file the document had keeps its changes, written first. Should that fail,
      // the Save As stops there and the window stays on that file, with the alert saying why. A
      // Save chosen to keep a document whose file could not be written (the "save the changes"
      // sheet's Save…, `afterSave`) is the way out: it saves the new file without that write.
      const recovering = afterSave.current !== null;
      if (
        !recovering &&
        fileRef.current &&
        changesRef.current > written.current &&
        !(await writeNow())
      ) {
        afterSave.current = null;
        return;
      }
      // Another document took the window while the original file was written (a reload of the
      // draft): the Save As is not that one's to make.
      if (documentGeneration.current !== generation) {
        afterSave.current = null;
        return;
      }
      const text = fileText(bodyOf(format), target.name);
      const at = changesRef.current;
      const kept = { lines: lines.current, content: format === "rich" ? contentCopy() : undefined };
      const ruler = { ...indents, tabStops: [...tabStops] };
      const propertiesPart = properties ? { properties } : undefined;
      const encoded = format === "plain" && encoding !== "utf-8" ? encoding : undefined;
      let entry: DriveEntry;
      try {
        entry = isBundleName(target.name)
          ? await saveBundle(target, text)
          : await saveToDrive(target, documentBlob(text, format, target.name, encoded));
      } catch (error) {
        afterSave.current = null;
        // Said only on the document it was saving.
        if (documentGeneration.current !== generation) return;
        fail(`The document “${titleOf(target.name)}” could not be saved.`, error);
        return;
      }
      const then = afterSave.current;
      afterSave.current = null;
      // Another document took the window meanwhile (a reload): the file is not that one's.
      if (documentGeneration.current !== generation) return;
      // Saved in the other format: the window shows the document in that format.
      if (format !== loaded.format) {
        load(
          {
            name: entry.name,
            format,
            lines: kept.lines,
            ...(kept.content ? { content: kept.content, ruler, ...propertiesPart } : undefined),
          },
          false,
        );
        // The window shows this Save's document again, in its new format: still this Save's.
        generation = documentGeneration.current;
      }
      markWritten(at);
      const savedFile = {
        id: entry.id,
        name: entry.name,
        version: entry.version ?? 0,
        ...(encoded ? { encoding: encoded } : undefined),
      };
      setFile(savedFile);
      keepBoundFile.current(savedFile);
      keepLastSaved(entry.id, text, entry.version ?? 0);
      setName(entry.name);
      setEdited(false);
      // The host hears of the save: the document as saved, and the drive folder it is in.
      onSave?.(
        {
          name: entry.name,
          format,
          lines: kept.lines,
          // The view holds the saved document now (the document was locked meanwhile).
          ...(format === "rich" ? { content: contentCopy(), ruler, ...propertiesPart } : undefined),
        },
        entry.parent ?? "",
        [],
      );
      then?.();
    })().finally(() => lockFile(false));
  };

  /** File > Rename: the file takes the name, with its extension when none is typed. */
  const renameFile = (wantedName: string) => {
    const target = fileRef.current;
    setDialog(null);
    if (!target) return;
    const extension = /\.[^.]+$/.exec(target.name)?.[0] ?? "";
    const next = /\.[^.\s]+$/.test(wantedName) ? wantedName : `${wantedName}${extension}`;
    const generation = documentGeneration.current;
    void runOps([{ op: "rename", id: target.id, name: next }]).then(
      () => {
        // Applied only to the document it renamed.
        if (documentGeneration.current !== generation || fileRef.current?.id !== target.id) {
          return;
        }
        setFile({ ...fileRef.current, name: next });
        setName(next);
      },
      (error) => {
        // Said only on the document it was renaming.
        if (documentGeneration.current !== generation || fileRef.current?.id !== target.id) {
          return;
        }
        fail(`The document “${titleOf(target.name)}” could not be renamed.`, error);
      },
    );
  };

  /** File > Move To…, and the title's Where: the file goes to the folder, and stays the document's. */
  const moveFile = (folder: string) => {
    const target = fileRef.current;
    setMoving(false);
    if (!target) return;
    void runOps([{ op: "move", id: target.id, parent: folder }]).catch((error) =>
      fail(`The document “${titleOf(target.name)}” could not be moved.`, error),
    );
  };

  /** The title's Locked: the drive keeps it, and refuses a change to the file until it is off. */
  const lockedFile = (locked: boolean) => {
    const target = fileRef.current;
    if (!target) return;
    void runOps([{ op: "info", id: target.id, locked }]).catch((error) =>
      fail(`“${titleOf(target.name)}” could not be ${locked ? "locked" : "unlocked"}.`, error),
    );
  };

  /** The title's Tags. */
  const tagFile = (tags: string[]) => {
    const target = fileRef.current;
    if (!target) return;
    void runOps([{ op: "tag", id: target.id, tags }]).catch((error) =>
      fail(`The tags of “${titleOf(target.name)}” could not be changed.`, error),
    );
  };

  /**
   * File > Revert To > Last Saved: the text kept from the last open or File > Save takes the window,
   * and is written into the file, which autosave has changed since.
   */
  const revertToSaved = () => {
    const target = fileRef.current;
    setRevertAsked(false);
    const kept = target ? readLastSaved(target.id) : undefined;
    if (!target || kept === undefined) return;
    const saved = documentFromText(target.name, kept, globalThis.document);
    load(plain && saved.format === "rich" ? codeDocument(saved, kept) : saved, false);
    markWritten(changesRef.current - 1);
  };

  /**
   * File > Revert To > Previous Save, and Restore in Browse All Versions: the window's changes are
   * written first, so they are what the restore keeps as a version, then the drive makes the version
   * the file's bytes and the window shows them. The drive keeps everything, so nothing is asked.
   */
  const restoreKeptVersion = (version: number) => {
    const target = fileRef.current;
    setBrowsingVersions(false);
    if (!target) return;
    lockFile(true);
    void (async () => {
      if (changesRef.current > written.current && !(await writeNow())) return;
      const generation = documentGeneration.current;
      await restoreVersion(target.id, version, fileRef.current?.version);
      const restored = await readDriveDocument(target, globalThis.document);
      if (documentGeneration.current !== generation || fileRef.current?.id !== target.id) return;
      load(openedDocument(restored.document, restored.text, preferencesRef.current), false);
      const next = { ...target, version: restored.version };
      fileRef.current = next;
      setFile(next);
      keepBoundFile.current(next);
      keepLastSaved(target.id, restored.text, restored.version);
      setVersionsRead((count) => count + 1);
    })()
      .catch((error) =>
        fail(`The version of “${titleOf(target.name)}” could not be restored.`, error, target.id),
      )
      .finally(() => lockFile(false));
  };
  /** File > Duplicate: an untitled copy of the document takes the window. */
  const duplicate = () => {
    // The document's changes are written into its file first, and it gives way only once they
    // are: should the write fail, it stays, with the alert saying why.
    if (fileRef.current && changesRef.current > written.current) {
      const generation = documentGeneration.current;
      void writeNow().then((ok) => {
        if (ok && documentGeneration.current === generation) duplicateRef.current();
      });
      return;
    }
    const stem = titleOf(name).replace(/\.txt$/i, "");
    load(
      {
        name: `${stem} copy`,
        format: loaded.format,
        lines: lines.current,
        ...(plain
          ? undefined
          : {
              content: contentCopy(),
              ruler: { ...indents, tabStops },
              ...(properties ? { properties } : undefined),
            }),
      },
      true,
    );
    setFile(null);
    setDialog(null);
  };
  const duplicateRef = useRef(duplicate);
  duplicateRef.current = duplicate;

  /** What is printed: the document as it is now. */
  const printable = () => ({
    name: titleOf(name),
    html: plain ? undefined : editor.current?.innerHTML,
    lines: lines.current,
    plain,
    page: pageSetup,
    ...(plain ? undefined : { ruler: { ...indents, tab: tabStops[0] ?? 72 } }),
  });

  const [recentsCleared, setRecentsCleared] = useDesktopSetting<number>(
    RECENTS_CLEARED,
    readNumber,
    0,
  );
  const recents = useMemo(
    () =>
      drive
        ? recentFiles(drive, 200)
            .filter(
              (entry) =>
                isTextDocument(entry) &&
                Math.max(entry.opened_ms ?? 0, entry.modified_ms) > recentsCleared,
            )
            .slice(0, 10)
            .map(({ id, name: recent }) => ({ id, name: recent }))
        : [],
    [drive, recentsCleared],
  );
  const hasLastSaved = useHasLastSaved(file?.id);
  const fileEntry = drive && file ? entryOf(drive, file.id) : undefined;
  const fileLocked = fileEntry?.locked === true;
  const readOnly = prevented || fileLocked;
  // A read-only view takes no focus: a key pressed anywhere in the front window asks about the lock.
  useEffect(() => {
    if (!fileLocked || state === "inactive") return;
    const press = (event: globalThis.KeyboardEvent) => {
      if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.target as Element).closest?.("input, select, [role='dialog']")) return;
      setLockAsked(true);
    };
    window.addEventListener("keydown", press, true);
    return () => window.removeEventListener("keydown", press, true);
  }, [fileLocked, state]);
  const [previousSave, setPreviousSave] = useState<KeptVersion | undefined>();
  const versionsFile = served && fileEntry?.kind === "file" ? fileEntry.id : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `versionsRead` asks again after a File > Save or a restore
  useEffect(() => {
    setPreviousSave(undefined);
    if (!versionsFile) return;
    let live = true;
    listVersions(versionsFile).then(
      ({ versions }) => {
        if (live) setPreviousSave(previousSaveOf(versions, readLastSavedVersion(versionsFile)));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [versionsFile, versionsRead]);
  const folders = useMemo(() => folderChoices(drive), [drive]);
  const canShowProperties = !plain && !prevented && !isMarkupName(name);
  const fileState = useMemo<TextEditFileMenuState | undefined>(
    () =>
      served
        ? {
            saved: file !== null,
            recents,
            canShowProperties,
            propertiesShown,
            hasLastSaved,
            ...(previousSave ? { previousSave: previousSave.modifiedMs } : undefined),
            shared: fileEntry
              ? [
                  {
                    id: fileEntry.id,
                    name: fileEntry.name,
                    kind: fileEntry.kind,
                    type: fileEntry.type,
                    size: fileEntry.size,
                  },
                ]
              : [],
          }
        : undefined,
    [
      served,
      file,
      recents,
      canShowProperties,
      propertiesShown,
      hasLastSaved,
      previousSave,
      fileEntry,
    ],
  );
  /** The panel goes, and the document has the keyboard and its selection back. */
  const closeProperties = () => {
    hideProperties();
    const node = editor.current;
    if (!node) return;
    whenMenusClosed(node.ownerDocument, () => {
      if (editor.current) reselect(editor.current);
    });
  };
  const fileCommands: TextEditFileCommands = {
    newDocument: () => {
      if (desktopHost) {
        openNewWindow({ kind: "new" });
        return;
      }
      guard(() => {
        setFile(null);
        newDocument();
      });
    },
    open: () => setDialog("open"),
    openRecent: (id) => {
      const recent = recents.find((each) => each.id === id);
      if (recent) routeOpen(recent);
    },
    clearRecents: () => setRecentsCleared(Date.now()),
    save: () => saveDocument(),
    duplicate,
    rename: () => {
      if (fileRef.current) setDialog("rename");
    },
    saveAs: () => setDialog("save-as"),
    moveTo: () => {
      if (fileRef.current) setMoving(true);
    },
    revert: () => {
      if (fileRef.current && readLastSaved(fileRef.current.id) !== undefined) setRevertAsked(true);
    },
    revertToPrevious: () => {
      if (fileRef.current && previousSave) restoreKeptVersion(previousSave.version);
    },
    browseVersions: () => {
      if (fileRef.current) setBrowsingVersions(true);
    },
    exportPdf: () => setExportingPdf(true),
    pageSetup: () => setSettingUpPage(true),
    print: () => setDialog("print"),
    showProperties: () => {
      if (propertiesShown) closeProperties();
      else {
        // The field that takes the keyboard moves the selection before the view hears where it was.
        sync();
        toggleProperties();
      }
    },
  };
  fileCommandsRef.current = served ? fileCommands : null;

  // A document that has a file is saved into it a moment after its last change.
  const writeNowRef = useRef(writeNow);
  writeNowRef.current = writeNow;
  const fileId = file?.id;
  const fileVersion = file?.version;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `fileVersion` moves when a write ends under another text of the file (Revert To), which is then still to write
  useEffect(() => {
    // `writtenCount` too: a change counted as unwritten without an edit (a format conversion that
    // keeps its file) is saved the same way. A file saved over elsewhere is not written again
    // until the person chose (`stale`). General's Ask to keep changes leaves it to File > Save and
    // the question on closing.
    if (
      !served ||
      !fileId ||
      fileBusy ||
      askToKeep ||
      changes <= writtenCount ||
      stale?.id === fileId
    ) {
      return;
    }
    const timer = setTimeout(() => void writeNowRef.current(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [served, fileId, fileVersion, fileBusy, askToKeep, changes, writtenCount, stale]);

  useEffect(() => {
    onStatusChange?.({
      name,
      format: loaded.format,
      edited,
      prevented,
      hyphenation: view.hyphenation,
      wrap: view.wrap,
      ruler: preferences.ruler,
      canPasteStyle: copiedStyle !== null,
      canPasteRuler: copiedRuler !== null,
      ...(fileState ? { file: fileState } : undefined),
    });
  }, [
    copiedStyle,
    copiedRuler,
    onStatusChange,
    name,
    loaded.format,
    edited,
    fileState,
    prevented,
    view.hyphenation,
    view.wrap,
    preferences.ruler,
  ]);

  // After a reload: a draft with changes that has a file writes them into it, and one without
  // changes is read again from its file, which may have changed elsewhere since.
  const syncDraft = useRef<"write" | DriveFileRef | null>(null);
  // Counts the drafts loaded with such a step to take, so that it runs whichever comes first: the
  // draft's load or the end of the reads.
  const [syncTick, setSyncTick] = useState(0);

  // Served by the desktop's Ferrite application: the person's document opens in the window and
  // is saved after every change. Until the load settles the window's content is inert, so no
  // change is made that the load would replace.
  const next = useMemo(
    () => ({
      session,
      changes,
      name,
      format: loaded.format,
      indents,
      tabStops,
      properties,
      edited,
      file,
      prevented,
      unwritten: file !== null && changes > writtenCount,
    }),
    [
      session,
      changes,
      name,
      loaded.format,
      indents,
      tabStops,
      properties,
      edited,
      file,
      writtenCount,
      prevented,
    ],
  );
  /** The request body a draft is saved with: the document's text and formats as the window shows them. */
  const draftBody = (value: typeof next) => {
    const rich = value.format === "rich";
    return {
      draft: {
        ...documentToServer(
          {
            name: value.name,
            format: value.format,
            lines: lines.current,
            ...(rich
              ? {
                  ruler: { ...value.indents, tabStops: value.tabStops },
                  ...(value.properties ? { properties: value.properties } : undefined),
                }
              : undefined),
          },
          !rich
            ? undefined
            : value.session === filledSession.current
              ? (editor.current?.innerHTML ?? undefined)
              : loaded.content
                ? contentToHtml(loaded.content)
                : undefined,
        ),
        edited: value.edited,
        unwritten: value.unwritten,
        ...(value.prevented ? { readOnly: true } : undefined),
        ...(value.file ? { file: value.file } : undefined),
      },
    };
  };
  // A draft larger than the server keeps is not sent (sent, it was refused with HTTP 400 and nothing on screen): the
  // window says so, and the draft stored last stays until the document fits again, when autosave resumes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the body reads the view, which changes with `next`
  const sized = useMemo(() => {
    const body = draftBody(next);
    return { body, fits: bodyBytes(body) <= TEXTEDIT_DRAFT_MAX_BYTES };
  }, [next]);
  const fitting = useRef<{ value: typeof next; body: object } | null>(null);
  if (sized.fits) fitting.current = { value: next, body: sized.body };
  const tooLarge = !sized.fits;
  const draft = sized.fits ? next : (fitting.current?.value ?? next);
  // Whether a load of the draft has been read: the first that finds none keeps the window's own
  // document, and a later one (the draft was forgotten elsewhere) opens that document again.
  const draftLoaded = useRef(false);
  // Versions of the draft that lost to one another window saved at the same time: the window shows
  // the version saved first, and offers these back, one at a time, until the person chooses.
  const [draftConflicts, setDraftConflicts] = useState<KeptDraft[]>(() =>
    served && !ownDraft ? readDraftConflicts() : [],
  );
  // One version is put back at a time: the next is offered once this one is stored, so that no
  // choice replaces a version the store has not held yet.
  const draftConflict = draftConflicts.some((each) => each.restoring)
    ? null
    : (draftConflicts.find((each) => each.session === draftSession()) ?? null);
  const settleDraftConflict = (key: string) => {
    dropDraftConflict(key);
    setDraftConflicts((list) => list.filter((each) => each.key !== key));
  };
  useEffect(() => {
    if (!served || ownDraft) return;
    // After the render that named the session. The banner shows only that session's own copies;
    // a copy only this window holds waits here for its session to come back.
    const stopSession = onDesktopSessionChange(() =>
      queueMicrotask(() =>
        setDraftConflicts((list) => [
          ...readDraftConflicts(),
          ...list.filter((each) => !each.held).map((each) => ({ ...each, restoring: undefined })),
        ]),
      ),
    );
    // A version chosen in another tab is settled here too.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && !event.key.startsWith(DRAFT_CONFLICT)) return;
      setDraftConflicts((list) =>
        list.filter((each) => !each.held || localStorage.getItem(each.key) !== null),
      );
    };
    addEventListener("storage", onStorage);
    return () => {
      stopSession();
      removeEventListener("storage", onStorage);
    };
  }, [served, ownDraft]);
  const noteDraftConflict = useRef<(mine: object) => void>(() => {});
  noteDraftConflict.current = (mine) => {
    // The same change can meet the newer copy more than once (a read, then its save refused): one
    // record holds it, and one Keep Mine was putting back is offered again.
    const text = draftText(mine);
    const known = [...readDraftConflicts(), ...draftConflicts].find(
      (each) => each.session === draftSession() && draftText(each.body) === text,
    );
    const kept = known ?? keepDraftConflict(mine);
    setDraftConflicts((list) =>
      list.some((each) => each.key === kept.key)
        ? list.map((each) => (each.key === kept.key ? { ...each, restoring: undefined } : each))
        : [...list, kept],
    );
  };
  const keepMyDraft = () => {
    if (!draftConflict) return;
    const kept = draftFromServer(draftConflict.body, globalThis.document);
    if (!kept) {
      settleDraftConflict(draftConflict.key);
      return;
    }
    const restoring = { before: draftText(draftBody(draft)) };
    setDraftConflicts((list) =>
      list.map((each) => (each.key === draftConflict.key ? { ...each, restoring } : each)),
    );
    load(kept.document, true);
    setFile(kept.file ?? null);
    // Not what the file holds: a change still to write, on the version it read (`stale` asks then).
    if (kept.file) markWritten(changesRef.current - 1);
  };
  const loadingDraft = useServerState({
    merge: (was, mine, theirs) =>
      mergeDraft(was, mine, theirs, (kept) => noteDraftConflict.current(kept)),
    url: TEXTEDIT_DRAFT_URL,
    // Off while the document is too large and no draft of this window has fitted yet: nothing to send.
    // A further window keeps its own document (`textedit-windows.ts`), not the account's one draft.
    enabled: served && !ownDraft && (sized.fits || fitting.current !== null),
    value: draft,
    onLoad: (stored) => {
      const found = draftFromServer(stored, globalThis.document);
      if (found === undefined) return false;
      const first = !draftLoaded.current;
      draftLoaded.current = true;
      // The window holds more than the store can: whatever the store says now is shorter and older.
      if (!first && tooLarge) return;
      if (found) {
        setPrevented(found.readOnly === true);
        // The page's own document read back (the live stream reloads documents after writes):
        // nothing to take, and taking it would rebuild the view and lose the caret and focus.
        const node = editor.current;
        const same =
          !first &&
          found.document.name === name &&
          found.document.format === loaded.format &&
          (found.file?.id ?? null) === (fileRef.current?.id ?? null) &&
          found.document.lines.join("\n") === lines.current.join("\n") &&
          (found.document.format === "plain" ||
            (JSON.stringify(rulerOf(found.document.ruler)) ===
              JSON.stringify(rulerOf({ ...indents, tabStops })) &&
              propertiesKey(found.document.properties) === propertiesKey(properties) &&
              node !== null &&
              found.document.content !== undefined &&
              withoutTabLayout(contentToHtml(found.document.content)) ===
                withoutTabLayout(
                  contentToHtml(htmlToContent(node.innerHTML, node.ownerDocument)),
                )));
        if (same) return;
        // Another window's or browser's text takes the window: a version Keep Mine was putting back
        // is no longer what the window holds, so it is offered again rather than settled on this.
        if (!first) {
          setDraftConflicts((list) =>
            list.map((each) => (each.restoring ? { ...each, restoring: undefined } : each)),
          );
        }
        // Another window's or browser's change, while the person may be typing here: the
        // selection is put back in the view the load makes, moved by what changed before it.
        if (!first) keptSelection.current = selectionToKeep();
        load(found.document, found.edited, true);
        setFile(found.file ?? null);
        // A draft with changes not yet written into its file writes them, unless General asks to
        // keep changes, when they wait for the person; any other is read again from its file, which
        // may have changed elsewhere since. (`edited` says only that it was not saved with File >
        // Save since it opened: autosave may have written it.)
        const unwritten = found.unwritten ?? found.edited;
        syncDraft.current = found.file
          ? unwritten
            ? desktopValues()[ASK_TO_KEEP_KEY] === true
              ? null
              : "write"
            : found.file
          : null;
        // Changes still to write count as such until the write succeeds: New and Open ask first,
        // and autosave tries again.
        if (found.file && unwritten) markWritten(changesRef.current - 1);
        if (syncDraft.current) setSyncTick((count) => count + 1);
      } else if (
        !first &&
        // The draft was forgotten elsewhere: the window goes back to its starting document. Not
        // when it holds nothing to give up (no file, nothing typed, its starting document):
        // loading that again would change nothing but would end a file's open under way, whose
        // read gives way to any document loaded meanwhile. And not while a file Finder asked for
        // is waiting or being read: that open is the person's, newer than the read that found no
        // draft; it opens, and its draft is saved again.
        (file !== null || edited || loaded !== defaultDocument) &&
        wanted.length === 0 &&
        !openBusy
      ) {
        load(defaultDocument, false);
        setFile(null);
        setDraftConflicts((list) =>
          list.map((each) => (each.restoring ? { ...each, restoring: undefined } : each)),
        );
      }
    },
    toBody: (value) => {
      // Never a body the server would refuse: while the document is too large, the draft that fitted last (saving is
      // off while there is none, so `body` is returned only when it fits).
      const body = draftBody(value);
      if (bodyBytes(body) <= TEXTEDIT_DRAFT_MAX_BYTES || !fitting.current) return body;
      return fitting.current.body;
    },
  });
  const loading = loadingDraft;
  // A window's own document, kept a moment after each change: of a document whose file holds
  // everything, only which file it is. A reload runs no cleanup, so the window finds it when the
  // desktop brings it back.
  const keptAs = ownDraft ? windowId : undefined;
  const keptBody = (value: typeof next) =>
    value.file && !value.unwritten
      ? {
          draft: {
            name: value.name,
            format: value.format,
            lines: [""],
            edited: value.edited,
            file: value.file,
          },
        }
      : draftBody(value);
  keepBoundFile.current = (bound) => {
    if (!keptAs || !served) return;
    const unwritten = changesRef.current > written.current;
    setKeptTooLarge(!keepWindow(keptAs, keptBody({ ...next, file: bound, unwritten })));
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: the body reads the view, which changes with `next`
  useEffect(() => {
    if (!keptAs || !served) return;
    const timer = setTimeout(() => {
      setKeptTooLarge(!keepWindow(keptAs, keptBody(next)));
    }, KEEP_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [keptAs, served, next]);
  // The person answered the window's own close: what they chose stands.
  const closeAnswered = useRef(false);
  const closing = useRef<() => void>(() => {});
  closing.current = () => {
    if (!keptAs) return;
    windowClosed(keptAs, {
      body: keptBody(next),
      unsaved: next.edited && (!next.file || next.unwritten),
      asked: closeAnswered.current,
      anyLeft: () =>
        windowStore?.list().some(({ id }) => id === FIRST_WINDOW || /^textedit:\d+$/.test(id)) ??
        false,
    });
  };
  // In a layout effect's cleanup, which still finds the text view that the body reads.
  useLayoutEffect(() => () => closing.current(), []);
  // Don't Save's next step waits for the render of the file's text, whose draft the effect above has
  // then handed to the page's channel, which outlives this window.
  // biome-ignore lint/correctness/useExhaustiveDependencies: each view of a document is one `session`
  useEffect(() => {
    const next = droppedThen.current;
    droppedThen.current = null;
    next?.();
  }, [session]);
  // A version Keep Mine put back loses its record once the store holds the window's text: a failed
  // save, or a reload before it, leaves the record to be offered again.
  const restoringDraft = draftConflicts.find((each) => each.restoring);
  const restoringKey = restoringDraft?.key;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `draft` is every change of the window, and the body read from the view after it is the text it saves
  useEffect(() => {
    if (!restoringDraft || !restoringKey) return;
    const text = draftText(draftBody(draft));
    // The render that chose it, before the view holds the version put back.
    if (text === restoringDraft.restoring?.before && text !== draftText(restoringDraft.body)) {
      return;
    }
    let live = true;
    const holdsText = async () => {
      const answer = await sessionFetch(TEXTEDIT_DRAFT_URL);
      const stored: unknown = answer.ok ? await answer.json() : null;
      return draftText(stored as object | null) === text;
    };
    void (async () => {
      const channel = serverDocument(TEXTEDIT_DRAFT_URL);
      await channel.idle();
      let held = await holdsText();
      if (!held && live) {
        // A body the channel already sent is not sent again by choosing it again: a load takes up
        // the page's unsaved body and saves it.
        await channel.load();
        await channel.idle();
        held = await holdsText();
      }
      if (live && held) settleDraftConflict(restoringKey);
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [restoringKey, draft]);
  pending.current = loading || fileBusy;
  // Counts the checks of a restored draft's file: only the latest unlocks the document.
  const syncCheck = useRef(0);

  // After a reload a window with its own document takes the same step for its kept file, and one asked
  // for a file opens it, first noting which file so that a reload meanwhile opens it too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, for what the window opened as
  useEffect(() => {
    if (desktopHost) {
      for (const opening of takeWindowsToReopen()) {
        requestDesktopEffects([{ newWindow: "textedit", opening }]);
      }
    }
    if (asked?.kind === "kept" && keptAs) keepWindow(keptAs, asked.body);
    if (asked?.kind === "file") {
      if (keptAs) {
        keepWindow(keptAs, {
          draft: {
            name: asked.file.name,
            format: "rich",
            lines: [""],
            edited: false,
            file: asked.file,
          },
        });
      }
      setWanted([{ ...asked.file, ...(asked.asCode ? { asCode: true } : undefined) }]);
      return;
    }
    const kept = keptDraft?.file;
    if (!kept) return;
    // A window's record says so itself: one of a file that holds everything has no text to write.
    const unwritten = keptDraft.unwritten === true;
    syncDraft.current = unwritten
      ? desktopValues()[ASK_TO_KEEP_KEY] === true
        ? null
        : "write"
      : kept;
    if (unwritten) markWritten(changesRef.current - 1);
    if (syncDraft.current) setSyncTick((count) => count + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once the draft has loaded
  useEffect(() => {
    if (loading) return;
    const sync = syncDraft.current;
    syncDraft.current = null;
    if (sync === "write") {
      // Changes not yet written go into the file, once it is known to be a file TextEdit opens:
      // one replaced elsewhere by a file in another encoding is let go of, never written over.
      // The document is locked meanwhile, so autosave does not write first.
      const target = fileRef.current;
      if (!target) return;
      const generation = documentGeneration.current;
      const still = () =>
        fileRef.current?.id === target.id && documentGeneration.current === generation;
      // The lock is this check's while it is the latest: a later draft's check keeps it.
      const check = ++syncCheck.current;
      lockFile(true);
      void readDriveDocument(target, globalThis.document)
        .then(
          (read) => read,
          (error) => {
            if (!still()) return null;
            const status = error instanceof DriveError ? error.status : 0;
            if (error instanceof UnsupportedEncodingError) {
              setFile(null);
              fail(`The document “${target.name}” could not be opened.`, error);
              return null;
            }
            if (status === 404) {
              setFile(null);
              return null;
            }
            // Not read (the network, the server): its encoding is unknown, so nothing is written
            // into it. The document keeps its text and lets go of the file; Save As keeps it.
            setFile(null);
            fail(`The document “${target.name}” could not be opened.`, error);
            return null;
          },
        )
        .then((read) => {
          if (syncCheck.current === check) lockFile(false);
          if (!read || !still()) return;
          if (target.version === undefined || read.version === target.version) {
            void writeNowRef.current();
          } else if (read.text === fileText(bodyOf(), target.name)) {
            // The drive already holds this text: this window's own write, whose reply went with
            // the reload. The document is that version, with nothing left to write.
            const current = { ...target, version: read.version };
            fileRef.current = current;
            setFile(current);
            markWritten(changesRef.current);
            keepBoundFile.current(current);
          } else {
            setStale({ id: target.id, version: target.version, asking: true });
          }
        });
    } else if (sync) {
      // The file's text replaces the document only if it is still the same document and no file
      // Finder asked for has started to open meanwhile (that open replaces it). The document is
      // locked while the file is read, so nothing is typed or autosaved into a file whose
      // encoding is not yet checked.
      const generation = documentGeneration.current;
      const openedAt = opening.current;
      const keepEdited = edited;
      const check = ++syncCheck.current;
      lockFile(true);
      void readDriveDocument(sync, globalThis.document)
        .then(
          ({ document, text, version }) => {
            if (
              fileRef.current?.id === sync.id &&
              documentGeneration.current === generation &&
              opening.current === openedAt
            ) {
              // A rich text file opened as its code stays its code across a reload.
              load(
                plain && document.format === "rich" ? codeDocument(document, text) : document,
                keepEdited,
                true,
              );
              setFile({ ...sync, version });
            }
          },
          (error) => {
            // Only for the document this refresh was of.
            if (fileRef.current?.id !== sync.id || documentGeneration.current !== generation) {
              return;
            }
            // Gone, in an encoding TextEdit does not open (replaced elsewhere), or not read at
            // all: the document keeps its own text but lets go of the file, so nothing is ever
            // written over a file that was not read, and the alert says why when it was there.
            setFile(null);
            const status = error instanceof DriveError ? error.status : 0;
            if (status !== 404) fail(`The document “${sync.name}” could not be opened.`, error);
          },
        )
        .finally(() => {
          if (syncCheck.current === check) lockFile(false);
        });
    }
  }, [loading, syncTick]);

  // A file Finder asks TextEdit to open: the one asked before this window opened, and those asked
  // while it is open, each opened once the draft has loaded.
  useEffect(() => {
    if (!served) return;
    const asked = takeOpenFileRequests("textedit");
    if (asked.length > 0) {
      setWanted((queue) => [...queue, ...asked.map(({ id, name }) => ({ id, name }))]);
    }
    return onOpenFileRequest("textedit", (request) =>
      setWanted((queue) => [...queue, { id: request.id, name: request.name }]),
    );
  }, [served]);
  // A text file dropped from Finder or the desktop opens here, as one asked for by Finder does; in
  // rich text a picture goes into the text and any other drive file is attached.
  const canAttach = (item: DesktopDragItem) =>
    !plain && !prevented && (isPictureFile(item) || !item.bytes);
  const dropRef = useDesktopDrop<HTMLDivElement>({
    enabled: served,
    accepts: (item) =>
      item.kind === "file" && (appsForFile(item).includes("textedit") || canAttach(item)),
    onDrop: (items) => {
      const opens = (item: DesktopDragItem) => appsForFile(item).includes("textedit");
      const toOpen = items.filter(opens);
      const toAttach = items.filter((item) => !opens(item));
      if (toOpen.length > 0) {
        setWanted((queue) => [...queue, ...toOpen.map(({ id, name }) => ({ id, name }))]);
      }
      if (toAttach.length > 0) setFilesToInsert(toAttach);
    },
    refusal: () => "TextEdit opens text documents.",
  });
  const openEntryRef = useRef(openEntry);
  openEntryRef.current = openEntry;
  const routeOpenRef = useRef(routeOpen);
  routeOpenRef.current = routeOpen;
  // Once a panel has let the window go: the view takes no selection while it is inert.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs for the files given; the rest reads the window as it is then
  useEffect(() => {
    if (filesToInsert.length === 0 || attaching) return;
    const items = filesToInsert;
    setFilesToInsert([]);
    void (async () => {
      let html = "";
      for (const item of items) {
        let made: string | null = null;
        if (isPictureFile(item)) {
          const blob = item.bytes ? await item.bytes() : await readFile(item.id);
          made = pictureHtml(new Uint8Array(await blob.arrayBuffer()));
        }
        html += made ?? (item.bytes ? "" : attachmentHtml(item.id, item.name));
      }
      const node = editor.current;
      if (!node || !html) return;
      reselect(node);
      node.ownerDocument.execCommand("insertHTML", false, html);
      edit();
      sync();
    })().catch((error) => fail("The file could not be attached.", error));
  }, [filesToInsert, attaching]);
  // The Save sheet is open to keep the document a file's open replaces (the save sheet's Save…):
  // the open runs once that Save has finished, and is dropped if it is cancelled.
  const savingFirst = dialog !== null && afterSave.current !== null;
  useEffect(() => {
    const [next, ...rest] = wanted;
    // One at a time: the next file opens once the last has (or the person answered whether to
    // save the document it replaces, and the Save that answer chose has finished or was
    // cancelled).
    if (!next || loading || fileBusy || openBusy || discard !== null || savingFirst) return;
    setWanted(rest);
    routeOpenRef.current(next);
  }, [wanted, loading, fileBusy, openBusy, discard, savingFirst]);
  // A dialog asked for while the reads are pending (`defaultDialog`, `dialog`) waits for them:
  // a document opened or saved before then would be replaced by what the reads bring.
  const shown = loading ? null : dialog;

  const shownIndents = ownIndents ?? indents;
  const documentTabs = useMemo(() => leftStops(tabStops), [tabStops]);
  const shownTabs = ownTabs ?? documentTabs;
  const markers: RulerMarker[] = [
    { type: "first-line-indent", position: shownIndents.first },
    { type: "head-indent", position: shownIndents.head },
    ...shownTabs.map(({ at, kind }): RulerMarker => ({ type: kind, position: at })),
    { type: "tail-indent", position: Math.max(container - shownIndents.tail, 0) },
  ];
  const relayOutTabs = (only?: Node | null) => {
    if (editor.current) layoutTabs(editor.current, documentTabs, view.zoom, only);
  };
  const relayOutTabsNow = useRef(relayOutTabs);
  relayOutTabsNow.current = relayOutTabs;
  // After the content is in the view, and again once its fonts have loaded, which changes its widths.
  // biome-ignore lint/correctness/useExhaustiveDependencies: each of these moves what the ref's latest closure measures
  useLayoutEffect(() => {
    relayOutTabsNow.current();
    const fonts = editor.current?.ownerDocument.fonts;
    let live = true;
    void fonts?.ready.then(() => {
      if (live) relayOutTabsNow.current();
    });
    return () => {
      live = false;
    };
  }, [session, loaded, documentTabs, indents, ownIndents, ownTabs, view.zoom, view.wrap]);
  /** The ruler's tab stops changed: the selection's paragraphs, or with no selection the document's. */
  const changeTabs = (stops: readonly TabStop[]) => {
    const node = editor.current;
    const range = selection.current;
    if (node && range && node.contains(range.startContainer)) {
      setParagraphTabs(node, range, stops);
      setOwnTabs(stops);
    } else {
      setTabStops(stops.map(({ at }) => at));
    }
    setEdited(true);
    if (served) setChanges((count) => count + 1);
  };
  const moveMarkers = (next: RulerMarker[]) => {
    const last = next.length - 1;
    const moved = {
      first: next[0]?.position ?? 0,
      head: next[1]?.position ?? 0,
      tail: Math.max(container - (next[last]?.position ?? container), 0),
    };
    // The paragraphs of the selection, as on a Mac; with no insertion point in the text yet, the document's ruler.
    const node = editor.current;
    const range = selection.current;
    const changesIndents =
      moved.first !== shownIndents.first ||
      moved.head !== shownIndents.head ||
      moved.tail !== shownIndents.tail;
    if (changesIndents && node && range && node.contains(range.startContainer)) {
      setParagraphIndents(node, range, moved);
      setOwnIndents(moved);
      setEdited(true);
      if (served) setChanges((count) => count + 1);
    } else if (changesIndents) {
      setIndents(moved);
      setEdited(true);
      if (served) setChanges((count) => count + 1);
    }
    const stops = next
      .slice(2, last)
      .map(({ position, type }): TabStop => ({ at: position, kind: type as TabKind }));
    if (JSON.stringify(stops) !== JSON.stringify(shownTabs)) changeTabs(stops);
  };
  /** Where on the ruler a pointer is, on its nine-point ticks, as a dragged marker goes. */
  const rulerPlace = (event: { clientX: number; currentTarget: HTMLElement }) => {
    const left = event.currentTarget.getBoundingClientRect().left;
    const origin = view.wrap ? PAGE_MARGIN : 5;
    return Math.max(Math.round(((event.clientX - left) / view.zoom - origin) / 9) * 9, 0);
  };
  const tabIndexOf = (target: EventTarget) => {
    const index = Number((target as HTMLElement).dataset?.index);
    return Number.isInteger(index) && index >= 2 && index < markers.length - 1 ? index - 2 : null;
  };
  const rulerMenuAt = useRef<{ at: number; stop: number | null }>({ at: 0, stop: null });
  const keyboardToTextAfterMenu = () => {
    const node = editor.current;
    if (node) whenMenusClosed(node.ownerDocument, () => node.focus());
  };
  const addTab = (at: number, kind: TabKind) => {
    if (shownTabs.some((stop) => stop.at === at)) return;
    changeTabs([...shownTabs, { at, kind }].sort((one, two) => one.at - two.at));
  };
  /** The ruler's menu: a kind changes the stop under the pointer, or adds one there. */
  const chooseTabKind = (kind: TabKind) => {
    const { at, stop } = rulerMenuAt.current;
    if (stop === null) addTab(at, kind);
    else changeTabs(shownTabs.map((each, index) => (index === stop ? { ...each, kind } : each)));
    keyboardToTextAfterMenu();
  };

  const busy =
    shown !== null ||
    discard !== null ||
    fileBusy ||
    addingLink ||
    attaching ||
    exportingPdf ||
    moving ||
    revertAsked ||
    browsingVersions ||
    settingUpPage ||
    spacingSheet !== null ||
    stylesSheet !== null ||
    choosingList !== null ||
    tableSheet !== null;
  // On the desktop, the File menu of the menu bar holds TextEdit's commands on the drive.
  const desktopFileMenu = useMemo(
    () =>
      fileState && fileActions ? (
        <TextEditFileMenuItems
          state={fileState}
          commands={fileActions}
          disabled={busy || loading}
        />
      ) : null,
    [fileState, fileActions, busy, loading],
  );
  useDesktopAppMenu("textedit", "File", desktopFileMenu, titleBar);
  // ... and its Format menu the Font and Text commands and Make Plain Text (or Make Rich Text),
  // on this window's document, through the render they run after. The document takes the
  // keyboard and its selection back once the menu has closed (the desktop's menu gives it to its
  // title).
  const keyboardBack = useRef(() => {});
  keyboardBack.current = () => {
    const node = editor.current;
    if (node) reselect(node);
    else plainEditor.current?.focus({ preventScroll: true });
  };
  const desktopViewMenu = useMemo(() => {
    const then = (act: () => void) => () => {
      act();
      whenMenusClosed(document, () => keyboardBack.current());
    };
    return (
      <>
        <TextEditViewItems
          zoom={view.zoom}
          disabled={busy || loading}
          onActualSize={then(() => viewRef.current.actualSize())}
          onZoomIn={then(() => viewRef.current.zoomIn())}
          onZoomOut={then(() => viewRef.current.zoomOut())}
        />
        {tabs ? <DocumentTabViewItems tabs={tabs} /> : null}
      </>
    );
  }, [view.zoom, busy, loading, tabs]);
  useDesktopAppMenu("textedit", "View", desktopViewMenu, titleBar);
  const desktopWindowMenu = useMemo(
    () => (tabs ? <DocumentTabWindowItems tabs={tabs} /> : null),
    [tabs],
  );
  useDesktopAppMenu("textedit", "Window", desktopWindowMenu, titleBar);
  sheets.current.showTable = () => {
    const node = editor.current;
    if (!node) return;
    const range = selection.current;
    const table = tableAround(node, range?.commonAncestorContainer ?? null);
    const size = table ? tableSize(table) : { rows: 2, columns: 2 };
    const cells = table ? cellsIn(table, range) : [];
    setTableSheet({
      value: {
        ...size,
        border: table ? Number(table.dataset.border ?? 1) : 1,
        background: backgroundOfCells(cells),
        width: table ? widthOfColumns(table, columnsOfCells(cells)) : "",
      },
      table,
      cells,
    });
  };
  sheets.current.showLists = () => {
    const node = editor.current;
    if (!node) return;
    const first = paragraphsOf(node, selection.current)[0];
    setChoosingList({
      style: paragraphFormatOf(first).list,
      start: Number(first?.dataset.listStart ?? 1),
    });
  };
  const desktopFormatMenu = useMemo(
    () => (
      <TextEditFormatItems
        plain={plain}
        disabled={busy || loading}
        prevented={prevented}
        onTogglePrevented={() => {
          setPrevented((now) => !now);
          whenMenusClosed(document, () => keyboardBack.current());
        }}
        hyphenation={view.hyphenation}
        onToggleHyphenation={() => {
          viewRef.current.toggleHyphenation();
          whenMenusClosed(document, () => keyboardBack.current());
        }}
        ruler={preferences.ruler}
        wrap={view.wrap}
        onToggleRuler={() => {
          toggleRuler();
          whenMenusClosed(document, () => keyboardBack.current());
        }}
        onToggleWrap={() => {
          viewRef.current.toggleWrap();
          whenMenusClosed(document, () => keyboardBack.current());
        }}
        onShowTable={() => sheets.current.showTable()}
        onShowLists={() => sheets.current.showLists()}
        onCommand={(command) => {
          if (pending.current) return;
          formatRef.current(command);
          whenMenusClosed(document, () => keyboardBack.current());
        }}
        canPasteStyle={copiedStyle !== null}
        canPasteRuler={copiedRuler !== null}
        onExtra={(command) => {
          if (pending.current) return;
          extraRef.current(command);
          whenMenusClosed(document, () => keyboardBack.current());
        }}
        onSetFormat={(next) => {
          if (pending.current) return;
          convertRef.current(next);
          whenMenusClosed(document, () => keyboardBack.current());
        }}
      />
    ),
    [
      plain,
      busy,
      loading,
      preferences.ruler,
      view.wrap,
      toggleRuler,
      prevented,
      view.hyphenation,
      copiedStyle,
      copiedRuler,
    ],
  );
  useDesktopAppMenu("textedit", "Format", desktopFormatMenu, titleBar);
  /** Edit > Complete: the words that finish the one before the insertion point, in a list there. */
  const complete = () => {
    const view = editor.current ?? plainEditor.current;
    if (!view || prevented) return;
    const prefix = wordBeforeCaret(view);
    if (!prefix) return;
    const place = caretPlace(view);
    const text = view instanceof HTMLTextAreaElement ? view.value : (view.textContent ?? "");
    void loadWords()
      .catch((): ReadonlySet<string> => new Set())
      .then((words) => {
        // The person may have typed on, or the document gone, while the list was read.
        if (!view.isConnected || wordBeforeCaret(view) !== prefix) return;
        const items = completionsOf(prefix, text, words);
        if (items.length > 0) setCompleting({ prefix, items, at: 0, place });
      });
  };
  const completeRef = useRef(complete);
  completeRef.current = complete;
  const chooseCompletion = (word: string) => {
    const view = editor.current ?? plainEditor.current;
    const prefix = completing?.prefix ?? "";
    setCompleting(null);
    if (!view) return;
    view.focus({ preventScroll: true });
    view.ownerDocument.execCommand("insertText", false, word.slice(prefix.length));
  };
  // A press anywhere but on the list ends it.
  const isCompleting = completing !== null;
  useEffect(() => {
    if (!isCompleting) return;
    const end = (event: PointerEvent) => {
      if (!(event.target instanceof Element && event.target.closest('[role="listbox"]'))) {
        setCompleting(null);
      }
    };
    globalThis.document.addEventListener("pointerdown", end, true);
    return () => globalThis.document.removeEventListener("pointerdown", end, true);
  }, [isCompleting]);
  // Its Edit menu acts on the document, rich or plain, which takes the keyboard and its selection
  // back; nothing is changed while a document is read or a sheet is up.
  const latestEdit = useRef<() => EditMenuTarget | null>(() => null);
  latestEdit.current = () => {
    const node = editor.current ?? plainEditor.current;
    return node
      ? {
          element: node,
          restore: () => keyboardBack.current(),
          editable: !(busy || loading || readOnly),
          rich: !plain,
          document: session,
          ...(plain
            ? undefined
            : {
                history: (way: "undo" | "redo") => disjoint.step(way) || stepRuler(node, way),
              }),
        }
      : null;
  };
  const desktopEditMenu = useMemo(
    () => (
      <>
        <EditorEditItems target={() => latestEdit.current()} />
        <EditorMoreItems
          target={() => latestEdit.current()}
          find={() => latestFind.current}
          replace
          beforeFind={
            <>
              <TextEditInsertItems
                editable={() => latestEdit.current()?.editable ?? false}
                rich={() => latestEdit.current()?.rich ?? false}
                onInsert={(kind: TextEditBreak) => {
                  const target = latestEdit.current()?.element;
                  if (!target) return;
                  keyboardBack.current();
                  insertBreak(target, kind);
                  whenMenusClosed(document, () => keyboardBack.current());
                }}
                onAddLink={() => setAddingLink(true)}
                onAttach={() => setAttaching(true)}
                onComplete={() => {
                  let done = false;
                  whenMenusClosed(document, () => {
                    keyboardBack.current();
                    if (done) return;
                    done = true;
                    completeRef.current();
                  });
                }}
              />
              <TextEditToolItems
                onShowSpelling={() => setSpellingShown(true)}
                onCheckNow={checkNowAfterMenu}
                onShowSubstitutions={() => setSubstitutionsShown(true)}
              />
            </>
          }
        />
      </>
    ),
    [checkNowAfterMenu],
  );
  useDesktopAppMenu("textedit", "Edit", desktopEditMenu, titleBar);
  const find = useTextFind(
    () => editor.current ?? plainEditor.current,
    `${session}\n${changes}\n${edited}`,
  );
  const latestFind = useRef(find);
  latestFind.current = find;
  // While a sheet or the Open panel has the keyboard, the document's window is main.
  const windowState = busy && state === "key" ? "main" : state;
  const textStyle = {
    font: `12px / ${LINE_HEIGHT} Helvetica, Arial, sans-serif`,
    "--mac-textedit-first-indent": `${indents.first - indents.head}px`,
    "--mac-textedit-head-indent": `${indents.head}px`,
    "--mac-textedit-tail-indent": `${indents.tail}px`,
    tabSize: `${tabStops[0] ?? 72}px`,
    zoom: view.zoom,
    hyphens: view.hyphenation ? "auto" : undefined,
  } as CSSProperties;

  const openLink = (event: MouseEvent<HTMLElement>) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute("href");
    const attached = href ? attachedFile(href) : undefined;
    if (attached) {
      // An attachment opens on a double click too, as a file's icon does.
      if (!(prevented || event.metaKey || event.ctrlKey || event.detail === 2)) return;
      const entry = drive ? entryOf(drive, attached) : undefined;
      if (!entry || !openFile(entry)) {
        setProblem({
          message: `The attachment “${link.textContent ?? ""}” could not be opened.`,
          detail: entry
            ? "No application here opens this kind of file."
            : "The file is no longer on your drive.",
        });
      }
      return;
    }
    // As on a Mac a click opens a link, unless it is a drag that selects text in it.
    const selection = link.ownerDocument.getSelection();
    if (href && (selection?.isCollapsed ?? true)) openUrl(href, "textedit");
  };

  // Command-click on the title: the folders the document is in, as Finder's title has it.
  const pathAnchor = useRef<HTMLDivElement>(null);
  const openPathMenu = (bar: HTMLElement) => {
    if (!fileEntry) return;
    const title = bar.querySelector(".mac-title-bar-title")?.getBoundingClientRect();
    pathAnchor.current?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: title?.left ?? 0,
        clientY: title?.bottom ?? 0,
      }),
    );
  };
  const windowTitle = edited
    ? `${titleOf(name)} — Edited`
    : fileLocked
      ? `${titleOf(name)} — Locked`
      : titleOf(name);

  /** Correct Spelling Automatically, on a character typed or on Return. */
  const correctTyped = (element: HTMLElement, typed: string | null) => {
    if (!preferences.correctAutomatically || typed === null) return;
    if (
      correctTypedWord(
        element,
        typed,
        new Set([...latestLearned.current, ...ignoredWords.current].map(normalWord)),
        substitutions.quotes,
      )
    ) {
      justCorrected.current = true;
    }
  };
  const settleAfterCorrection = (element: HTMLElement, inputType: string) => {
    if (justCorrected.current && inputType === "historyUndo") caretAfterSelection(element);
    justCorrected.current = false;
  };

  const host = mounted
    ? panelContainer === undefined
      ? titleBar?.ownerDocument.body
      : panelContainer
    : null;

  // On a wrapped page the ruler is part of the page: it scrolls with the text, its origin the margin.
  const rulerInert = busy || loading || prevented;
  const ruler = (
    <ContextualMenu disabled={rulerInert}>
      <ContextualMenuTrigger className="mac-textedit-ruler-area">
        <Ruler
          className="mac-textedit-ruler"
          markers={markers}
          onMarkersChange={moveMarkers}
          origin={view.wrap ? PAGE_MARGIN : undefined}
          zoom={view.zoom}
          aria-label="Ruler"
          inert={rulerInert}
          onMouseDown={(event) => {
            // A click on the ruler leaves the keyboard and the selection in the text.
            if (tabIndexOf(event.target) === null) event.preventDefault();
          }}
          onClick={(event) => {
            if ((event.target as HTMLElement).dataset.index === undefined) {
              addTab(rulerPlace(event), "left");
              editor.current?.focus();
            }
          }}
          onPointerUp={(event) => {
            const stop = tabIndexOf(event.target);
            const { top, bottom } = event.currentTarget.getBoundingClientRect();
            // A tab stop dragged off the ruler goes.
            if (stop !== null && (event.clientY > bottom + 12 || event.clientY < top - 12)) {
              changeTabs(shownTabs.filter((_, index) => index !== stop));
              editor.current?.focus();
            }
          }}
          onContextMenu={(event) => {
            rulerMenuAt.current = { at: rulerPlace(event), stop: tabIndexOf(event.target) };
          }}
        />
      </ContextualMenuTrigger>
      <ContextualMenuPopup aria-label="Ruler">
        <MenuItem disabled={rulerInert} onClick={() => chooseTabKind("left")}>
          Left Tab Stop
        </MenuItem>
        <MenuItem disabled={rulerInert} onClick={() => chooseTabKind("center")}>
          Center Tab
        </MenuItem>
        <MenuItem disabled={rulerInert} onClick={() => chooseTabKind("right")}>
          Right Tab
        </MenuItem>
        <MenuItem disabled={rulerInert} onClick={() => chooseTabKind("decimal")}>
          Decimal Tab
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled={rulerInert}
          onClick={() => {
            const { stop } = rulerMenuAt.current;
            if (stop !== null) changeTabs(shownTabs.filter((_, index) => index !== stop));
            keyboardToTextAfterMenu();
          }}
        >
          Remove Tab Stop
        </MenuItem>
      </ContextualMenuPopup>
    </ContextualMenu>
  );

  /** Format > Font and Format > Text in rich text, and the menus' key equivalents: true when `key` ran a command. */
  const answerKey = (key: KeyboardEvent) => {
    if (busy || loading) return false;
    if (tabs && answerTabKey(tabs, key)) return true;
    if (matchesMenuKeyEquivalent(key, "option+escape")) {
      complete();
      return true;
    }
    const style = plain || prevented ? undefined : richTextKeyCommand(key);
    if (style) {
      formatCommand(style);
      return true;
    }
    if (!plain && !prevented) {
      const way = matchesMenuKeyEquivalent(key, "command+z")
        ? "undo"
        : matchesMenuKeyEquivalent(key, "shift+command+z")
          ? "redo"
          : null;
      if (way) {
        return disjoint.step(way) || (editor.current ? stepRuler(editor.current, way) : false);
      }
      const extra = EXTRA_KEYS.find(([keys]) => matchesMenuKeyEquivalent(key, keys))?.[1];
      if (extra) {
        formatExtra(extra);
        return true;
      }
      if (matchesMenuKeyEquivalent(key, "command+k")) {
        setAddingLink(true);
        return true;
      }
      if (served && matchesMenuKeyEquivalent(key, "shift+command+a")) {
        setAttaching(true);
        return true;
      }
    }
    const command = matchesMenuKeyEquivalent(key, "command+f")
      ? () => find.open()
      : matchesMenuKeyEquivalent(key, "option+command+f")
        ? () => find.open(true)
        : matchesMenuKeyEquivalent(key, "command+g")
          ? () => find.move(false)
          : matchesMenuKeyEquivalent(key, "shift+command+g")
            ? () => find.move(true)
            : matchesMenuKeyEquivalent(key, "command+e")
              ? find.fromSelection
              : matchesMenuKeyEquivalent(key, "command+j")
                ? find.jump
                : matchesMenuKeyEquivalent(key, "command+o")
                  ? () => setDialog("open")
                  : served && matchesMenuKeyEquivalent(key, "option+shift+command+s")
                    ? fileCommands.saveAs
                    : served && matchesMenuKeyEquivalent(key, "shift+command+s")
                      ? fileCommands.duplicate
                      : matchesMenuKeyEquivalent(key, "command+s")
                        ? served
                          ? fileCommands.save
                          : () => setDialog("save")
                        : served && matchesMenuKeyEquivalent(key, "command+n")
                          ? fileCommands.newDocument
                          : matchesMenuKeyEquivalent(key, "shift+command+;")
                            ? () => setSpellingShown(true)
                            : matchesMenuKeyEquivalent(key, "command+;")
                              ? checkNow
                              : served && matchesMenuKeyEquivalent(key, "option+command+p")
                                ? () => {
                                    if (fileState?.canShowProperties) fileCommands.showProperties();
                                  }
                                : served && matchesMenuKeyEquivalent(key, "shift+command+p")
                                  ? fileCommands.pageSetup
                                  : matchesMenuKeyEquivalent(key, "command+p")
                                    ? () => setDialog("print")
                                    : matchesMenuKeyEquivalent(key, "shift+command+t")
                                      ? () => {
                                          if (!prevented)
                                            convertRef.current(plain ? "rich" : "plain");
                                        }
                                      : matchesMenuKeyEquivalent(key, "command+0")
                                        ? view.actualSize
                                        : matchesMenuKeyEquivalent(key, "shift+command+.")
                                          ? view.zoomIn
                                          : matchesMenuKeyEquivalent(key, "shift+command+,")
                                            ? view.zoomOut
                                            : matchesMenuKeyEquivalent(key, "shift+command+w")
                                              ? view.toggleWrap
                                              : !plain && matchesMenuKeyEquivalent(key, "command+r")
                                                ? toggleRuler
                                                : undefined;
    if (!command) return false;
    command();
    return true;
  };
  answerKeyRef.current = answerKey;
  keyWindowRef.current = windowState === "key";

  return (
    <>
      <Window
        {...props}
        state={windowState}
        width={width}
        height={height}
        className={className ? `mac-textedit ${className}` : "mac-textedit"}
        onFocus={(event) => {
          props.onFocus?.(event);
          // A window made key by command is given the focus on its root: the keyboard belongs in the text.
          if (event.target === event.currentTarget && !busy && !loading) keyboardBack.current();
        }}
        onKeyDownCapture={(event) => {
          props.onKeyDownCapture?.(event);
          if (completing && !["Shift", "Alt", "Control", "Meta"].includes(event.key)) {
            const did = completionKey(event.key, completing);
            if (did === "close") setCompleting(null);
            else if (did === "choose") {
              chooseCompletion(completing.items[completing.at] ?? "");
            } else setCompleting({ ...completing, at: did.at });
            if (did !== "close" || event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
            }
            return;
          }
          // Before the text view, which would type a tab character into the cell.
          if (
            event.key === "Tab" &&
            !event.defaultPrevented &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            editor.current?.contains(event.target as Node) &&
            !prevented &&
            !busy
          ) {
            const moved = moveBetweenCells(editor.current, event.shiftKey);
            if (moved) {
              event.preventDefault();
              event.stopPropagation();
              if (moved === "added") edit();
            }
          }
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.altKey &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.nativeEvent.isComposing &&
            event.target instanceof HTMLElement &&
            (event.target === editor.current || event.target === plainEditor.current)
          ) {
            correctTyped(event.target, "");
          }
          if (!event.defaultPrevented && answerKey(event.nativeEvent)) event.preventDefault();
        }}
      >
        {desktopHost ? (
          <TextEditDesktopWindow
            title={windowTitle}
            fileId={() => fileRef.current?.id}
            file={file?.id}
            startFrame={asked?.kind === "kept" ? asked.frame : undefined}
            tabbed={(tabs?.tabs.length ?? 0) > 1}
          />
        ) : null}
        {fileEntry && drive ? (
          <ContextualMenu>
            <ContextualMenuTrigger ref={pathAnchor} className="mac-textedit-path-anchor" />
            <ContextualMenuPopup aria-label="Path">
              <MenuItem onClick={() => showInFinder({ id: fileEntry.id })}>
                {fileEntry.name}
              </MenuItem>
              {foldersAround(drive, fileEntry).map((folder) => (
                <MenuItem key={folder.id} onClick={() => showInFinder({ id: folder.id })}>
                  {folder.name}
                </MenuItem>
              ))}
            </ContextualMenuPopup>
          </ContextualMenu>
        ) : null}
        <TitleBar
          ref={setTitleBar}
          variant={plain ? "standard" : "unified"}
          onContextMenu={(event) => {
            if (!(event.target as Element).closest(".mac-title-bar-title")) return;
            event.preventDefault();
            openPathMenu(event.currentTarget);
          }}
          onPointerDown={(event) => {
            const hit = event.target as Element;
            if (event.button !== 0 || !fileEntry || !hit.closest(".mac-title-bar-title")) return;
            if (event.metaKey || event.ctrlKey) {
              event.preventDefault();
              openPathMenu(event.currentTarget);
              return;
            }
            // The icon in the title is the file: it drags out as the file does in Finder.
            const proxy = hit.closest(".mac-title-bar-icon");
            if (!proxy) return;
            event.preventDefault();
            beginDesktopDrag(event.nativeEvent, {
              from: "textedit",
              icon: proxy,
              items: () => fileState?.shared ?? [],
            });
          }}
          title={
            file && fileEntry ? (
              <TextEditTitle
                title={windowTitle}
                name={file.name}
                tags={fileEntry.tags ?? []}
                folders={folders}
                parent={fileEntry.parent ?? ""}
                locked={fileLocked}
                onRename={renameFile}
                onTags={tagFile}
                onMove={moveFile}
                onLocked={lockedFile}
              />
            ) : (
              windowTitle
            )
          }
          icon={<DocumentIcon />}
          controls={
            <WindowControls
              onClose={
                onClose
                  ? (event) =>
                      guard(() => {
                        closeAnswered.current = true;
                        onClose(event);
                      })
                  : undefined
              }
              onMinimize={onMinimize}
              onZoom={onZoom}
              zoomRole={zoomRole}
              closeDisabled={busy}
              minimizeDisabled={minimizeDisabled}
              zoomDisabled={zoomDisabled}
              edited={edited}
            />
          }
          onDragRegionPointerDown={onDragRegionPointerDown}
          onDragRegionDoubleClick={onDragRegionDoubleClick}
        >
          {plain ? null : (
            <TextEditFormatBar
              format={format}
              onFormatChange={applyFormat}
              onClearFormat={clearFormat}
              onShowStyles={() => extraRef.current("show-styles")}
              inert={busy || loading || prevented}
            />
          )}
        </TitleBar>
        {tabs ? <DocumentTabBar tabs={tabs} /> : null}
        {tabs ? <DocumentTabOverview tabs={tabs} /> : null}
        {plain || !preferences.ruler || view.wrap ? null : ruler}
        <WindowBody
          ref={dropRef}
          background="content"
          className="mac-textedit-body"
          data-wrap={view.wrap ? "" : undefined}
          style={
            view.wrap
              ? ({ "--mac-textedit-page-margin": `${PAGE_MARGIN}px` } as CSSProperties)
              : undefined
          }
          inert={busy || loading}
          aria-busy={loading || undefined}
        >
          {draftConflict ? (
            <WindowBanner
              className="mac-textedit-conflict"
              trailing={
                <>
                  <WindowBannerAction onClick={keepMyDraft}>Keep Mine</WindowBannerAction>
                  <WindowBannerAction onClick={() => settleDraftConflict(draftConflict.key)}>
                    OK
                  </WindowBannerAction>
                </>
              }
            >
              {draftConflict.held
                ? "Changed in another window. Yours is kept until you choose."
                : "Changed in another window. Yours is lost on reload: choose now."}
            </WindowBanner>
          ) : null}
          {served && tooLarge ? (
            <WindowBanner className="mac-textedit-too-large">
              This document is too large to be kept when the page reloads: TextEdit keeps at most
              256 KB of text. Changes made to it now are not kept after a reload.
            </WindowBanner>
          ) : null}
          {served && keptTooLarge && !tooLarge ? (
            <WindowBanner className="mac-textedit-too-large">
              This window can’t be kept when the page reloads: a second window of TextEdit keeps at
              most 32 KB, and eight windows. Save the document to keep it.
            </WindowBanner>
          ) : null}
          <FindBar find={find} />
          {!plain && preferences.ruler && view.wrap ? ruler : null}
          <ContextualMenu>
            <ContextualMenuTrigger
              className="mac-textedit-menu-area"
              onContextMenuCapture={(event) => {
                menuPoint.current = { x: event.clientX, y: event.clientY };
              }}
            >
              {plain ? (
                <TextView
                  key={session}
                  ref={plainEditor}
                  aria-label="Document"
                  className="mac-textedit-view"
                  monospace
                  insertsTab
                  readOnly={readOnly}
                  spellCheck={preferences.spelling}
                  data-text-replacement={substitutions.replacement ? "on" : "off"}
                  style={{
                    ...plainTextStyle(preferences),
                    zoom: view.zoom,
                    hyphens: view.hyphenation ? "auto" : undefined,
                  }}
                  lang={view.hyphenation ? "en" : undefined}
                  defaultValue={loaded.lines.join("\n")}
                  onPaste={(event) => {
                    pasteStart.current = pasteEdges(event.currentTarget);
                    pastedText.current = event.clipboardData.getData("text/plain");
                  }}
                  onInput={(event) => {
                    const native = event.nativeEvent as InputEvent;
                    settleAfterCorrection(event.currentTarget, native.inputType);
                    if (native.inputType === "insertText" && !native.isComposing) {
                      correctTyped(event.currentTarget, native.data);
                      substituteTyped(event.currentTarget, native.data, substitutions, false);
                    }
                    if (native.inputType === "insertFromPaste" && substitutions.copyPaste) {
                      spaceAfterPaste(event.currentTarget, pastedText.current, pasteStart.current);
                    }
                  }}
                  onValueChange={(value) => {
                    lines.current = value.split("\n");
                    setEdited(true);
                    if (served) setChanges((count) => count + 1);
                  }}
                />
              ) : (
                <RichTextView
                  key={session}
                  ref={editor}
                  aria-label="Document"
                  className="mac-textedit-text mac-textedit-view"
                  readOnly={readOnly}
                  spellCheck={preferences.spelling}
                  data-text-replacement={substitutions.replacement ? "on" : "off"}
                  style={textStyle}
                  lang={view.hyphenation ? "en" : undefined}
                  onClick={openLink}
                  onPaste={(event) => {
                    const picture = [...event.clipboardData.files].find((each) =>
                      /^image\/(png|jpeg)$/.test(each.type),
                    );
                    if (picture && served) {
                      event.preventDefault();
                      setFilesToInsert([
                        {
                          id: "",
                          name: picture.name,
                          type: picture.type,
                          bytes: async () => picture,
                        },
                      ]);
                      return;
                    }
                    pasteStart.current = pasteEdges(event.currentTarget);
                    pastedText.current = event.clipboardData.getData("text/plain");
                  }}
                  onInput={(event) => {
                    const native = event.nativeEvent as InputEvent;
                    const { inputType } = native;
                    settleAfterCorrection(event.currentTarget, inputType);
                    if (inputType === "insertParagraph") {
                      dropCopiedListStart(event.currentTarget);
                    }
                    if (inputType === "insertFromPaste" || inputType === "insertFromDrop") {
                      normalizeTables(event.currentTarget);
                      if (inputType === "insertFromPaste" && substitutions.copyPaste) {
                        spaceAfterPaste(
                          event.currentTarget,
                          pastedText.current,
                          pasteStart.current,
                        );
                      }
                    }
                    if (inputType === "insertText" && !native.isComposing) {
                      correctTyped(event.currentTarget, native.data);
                      substituteTyped(event.currentTarget, native.data, substitutions, true);
                    }
                    // Typing changes the paragraph it is in; anything else may change any.
                    relayOutTabs(
                      /^(insertText|insertCompositionText|deleteContent)/.test(inputType)
                        ? event.currentTarget.ownerDocument.getSelection()?.anchorNode
                        : null,
                    );
                    edit();
                  }}
                >
                  {loaded.content
                    ? null
                    : loaded.lines.map((line, index) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity, and the list is rendered once
                        <div key={index}>{line === "" ? <br /> : line}</div>
                      ))}
                </RichTextView>
              )}
            </ContextualMenuTrigger>
            <ContextualMenuPopup aria-label="Text commands">
              <TextEditContextItems
                target={() => latestEdit.current()}
                point={() => menuPoint.current}
                plain={plain}
                disabled={busy || loading}
                onCommand={(command) => {
                  if (pending.current) return;
                  formatRef.current(command);
                  whenMenusClosed(document, () => keyboardBack.current());
                }}
                onShowSpelling={() => setSpellingShown(true)}
                onCheckNow={checkNowAfterMenu}
                onShowSubstitutions={() => setSubstitutionsShown(true)}
              />
            </ContextualMenuPopup>
          </ContextualMenu>
          {disjoint.carets.map((caret) => (
            <span
              key={`${caret.left}-${caret.top}`}
              className="mac-textedit-disjoint-caret"
              style={{ left: caret.left, top: caret.top, height: caret.height }}
            />
          ))}
        </WindowBody>
      </Window>

      {served ? (
        <Sheet
          open={shown === "save" || shown === "save-as"}
          onOpenChange={(open) => {
            if (open) return;
            afterSave.current = null;
            setDialog(null);
          }}
        >
          <SheetPopup anchor={titleBar} width={640} aria-label="Save">
            <TextEditDriveSave
              name={file?.name ?? name}
              format={loaded.format}
              encoding={
                file?.encoding ??
                (preferences.saveEncoding === "automatic" ? undefined : preferences.saveEncoding)
              }
              onSave={saveNew}
              onCancel={() => {
                afterSave.current = null;
                setDialog(null);
              }}
            />
          </SheetPopup>
        </Sheet>
      ) : (
        <Sheet
          open={shown === "save"}
          onOpenChange={(open) => {
            if (open) return;
            afterSave.current = null;
            setDialog(null);
          }}
        >
          <SheetPopup anchor={titleBar} width={saveExpanded ? 640 : 440} aria-label="Save">
            <TextEditSavePanel
              places={places}
              document={{ name, format: loaded.format, lines: lines.current }}
              expanded={saveExpanded}
              onExpandedChange={setSaveExpanded}
              onSave={save}
              onCancel={() => {
                afterSave.current = null;
                setDialog(null);
              }}
              onNewFolder={newFolder}
            />
          </SheetPopup>
        </Sheet>
      )}

      {served ? (
        <Sheet open={shown === "rename"} onOpenChange={(open) => open || setDialog(null)}>
          <SheetPopup anchor={titleBar} width={420} aria-label="Rename">
            {file ? (
              <TextEditRename
                name={file.name}
                onRename={renameFile}
                onCancel={() => setDialog(null)}
              />
            ) : null}
          </SheetPopup>
        </Sheet>
      ) : null}

      {windowId && desktopHost && propertiesShown && canShowProperties && state !== "inactive" ? (
        <TextEditPropertiesPanel
          documentWindow={windowId}
          document={String(session)}
          value={properties}
          disabled={busy || loading}
          onChange={(chosen) => {
            const clean = cleanProperties(chosen);
            if (propertiesKey(clean) === propertiesKey(properties)) return;
            setProperties(clean);
            setEdited(true);
            if (served) setChanges((count) => count + 1);
          }}
          onHide={closeProperties}
        />
      ) : null}

      <Sheet open={choosingList !== null} onOpenChange={(open) => open || setChoosingList(null)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="List">
          {choosingList ? (
            <TextEditLists
              value={choosingList}
              onChoose={(choice) => {
                setChoosingList(null);
                applyFormat({ list: choice.style });
                const node = editor.current;
                if (node) {
                  setListStart(
                    node,
                    selection.current,
                    choice.style === "none" ? null : choice.start,
                  );
                }
                edit();
              }}
              onCancel={() => setChoosingList(null)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>

      <Sheet open={tableSheet !== null} onOpenChange={(open) => open || setTableSheet(null)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Table">
          {tableSheet ? (
            <TextEditTable
              value={tableSheet.value}
              inTable={tableSheet.table !== null}
              canMergeCells={canMerge(tableSheet.cells)}
              losesText={(rows, columns) =>
                tableSheet.table ? shapeLosesText(tableSheet.table, rows, columns) : false
              }
              canSplitCell={
                tableSheet.cells.length === 1 &&
                ((tableSheet.cells[0]?.colSpan ?? 1) > 1 || (tableSheet.cells[0]?.rowSpan ?? 1) > 1)
              }
              canNest={
                tableSheet.cells.length === 1 &&
                tableSheet.table !== null &&
                tableDepth(tableSheet.table) + 1 < MOST_TABLE_DEPTH
              }
              canUnnest={tableSheet.table !== null && tableDepth(tableSheet.table) > 0}
              onNest={() => {
                const { table, cells } = tableSheet;
                const [cell] = cells;
                const node = editor.current;
                setTableSheet(null);
                if (!cell || !node || prevented) return;
                let nested: HTMLTableElement | null = null;
                changeTableShape(node, table, () => {
                  nested = nestTable(cell);
                });
                edit();
                const first = (nested as HTMLTableElement | null)?.querySelector("td");
                const selected = node.ownerDocument.getSelection();
                if (first && selected) {
                  selected.selectAllChildren(first);
                  selected.collapseToStart();
                  selection.current = selected.getRangeAt(0).cloneRange();
                }
              }}
              onUnnest={() => {
                const { table } = tableSheet;
                const node = editor.current;
                setTableSheet(null);
                const outer = table?.parentElement?.closest("table");
                if (!table || !outer || !node || prevented) return;
                changeTableShape(node, outer, () => unnestTable(table));
                edit();
              }}
              onChoose={(choice) => {
                const node = editor.current;
                const { table, cells } = tableSheet;
                setTableSheet(null);
                if (!node || prevented) return;
                let inserted: HTMLTableElement | null = null;
                changeTableShape(node, table, () => {
                  inserted = table
                    ? table
                    : insertTable(
                        node,
                        childHoldingEnd(node, selection.current),
                        choice.rows,
                        choice.columns,
                      );
                  const made = inserted;
                  // The same size is no change: a file's uneven rows stay as they are.
                  const before = table ? tableSize(table) : null;
                  if (before?.rows !== choice.rows || before.columns !== choice.columns) {
                    reshapeTable(made, choice.rows, choice.columns);
                  }
                  made.dataset.border = String(choice.border);
                  const color = HIGHLIGHTS.find((each) => each.value === choice.background)?.color;
                  const shaded =
                    choice.background === KEEP_BACKGROUND
                      ? []
                      : table
                        ? cells.filter((each) => each.isConnected)
                        : [...made.querySelectorAll("td")];
                  for (const cell of shaded) {
                    cell.style.backgroundColor = color ?? "";
                    if (!color && cell.getAttribute("style") === "") cell.removeAttribute("style");
                  }
                  if (choice.width !== tableSheet.value.width) {
                    setColumnWidth(
                      made,
                      table
                        ? columnsOfCells(cells.filter((each) => each.isConnected))
                        : Array.from({ length: choice.columns }, (_, at) => at),
                      choice.width === "" ? null : Number(choice.width),
                    );
                  }
                });
                edit();
                if (!table) {
                  const first = (inserted as HTMLTableElement | null)?.querySelector("td");
                  const selected = node.ownerDocument.getSelection();
                  if (first && selected) {
                    selected.selectAllChildren(first);
                    selected.collapseToStart();
                    selection.current = selected.getRangeAt(0).cloneRange();
                  }
                }
              }}
              onMerge={() => {
                const { table, cells } = tableSheet;
                const node = editor.current;
                if (node) changeTableShape(node, table, () => mergeCells(cells));
                setTableSheet(null);
                edit();
              }}
              onSplit={() => {
                const { table, cells } = tableSheet;
                const [cell] = cells;
                const node = editor.current;
                if (cell && node) changeTableShape(node, table, () => splitCell(cell));
                setTableSheet(null);
                edit();
              }}
              onCancel={() => setTableSheet(null)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>

      <Sheet open={moving} onOpenChange={(open) => open || setMoving(false)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Move To">
          {moving && fileEntry ? (
            <TextEditMove
              folders={folders}
              current={fileEntry.parent ?? ""}
              onMove={moveFile}
              onCancel={() => setMoving(false)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>

      <Sheet open={revertAsked} onOpenChange={(open) => open || setRevertAsked(false)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Revert">
          <SheetTitle>Do you want to go back to the version saved last?</SheetTitle>
          <SheetDescription>Your changes since then will be lost.</SheetDescription>
          <SheetActions>
            <PushButton onClick={() => setRevertAsked(false)}>Cancel</PushButton>
            <DefaultButton onClick={revertToSaved}>Revert</DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>

      {browsingVersions && file ? (
        <DesktopVersionsSheet<TextEditVersionPage>
          file={file}
          current={{ lines: lines.current, content: contentCopy() }}
          anchor={titleBar}
          classPrefix="mac-textedit"
          readPage={async (bytes) =>
            (await documentOfFileBytes(file, bytes, globalThis.document)).document
          }
          renderPage={(page, label) => <TextEditVersionPageView page={page} label={label} />}
          onRestore={(version) => restoreKeptVersion(version.version)}
          onDone={() => setBrowsingVersions(false)}
        />
      ) : null}

      <Sheet open={settingUpPage} onOpenChange={(open) => open || setSettingUpPage(false)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Page Setup">
          {settingUpPage ? (
            <TextEditPageSetup
              value={pageSetup}
              onChoose={(chosen) => {
                setSettingUpPage(false);
                setPageSetup(chosen);
              }}
              onCancel={() => setSettingUpPage(false)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>

      <Sheet open={spacingSheet !== null} onOpenChange={(open) => open || setSpacingSheet(null)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Spacing">
          {spacingSheet ? (
            <TextEditSpacing
              value={spacingSheet}
              onChoose={(chosen) => {
                setSpacingSheet(null);
                const node = editor.current;
                if (!node) return;
                disjoint.each(() => setParagraphSpacing(node, selection.current, chosen));
                edit();
                sync();
              }}
              onCancel={() => setSpacingSheet(null)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>

      <Sheet open={stylesSheet !== null} onOpenChange={(open) => open || setStylesSheet(null)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Styles">
          {stylesSheet ? (
            <TextEditStyles
              styles={stylesSheet.styles}
              canApply={stylesSheet.canApply}
              onApply={(style) => {
                setStylesSheet(null);
                setStyleToApply(style);
              }}
              onCancel={() => setStylesSheet(null)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>

      <Sheet open={addingLink} onOpenChange={(open) => open || setAddingLink(false)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Add Link">
          {addingLink ? (
            <TextEditAddLink onLink={addLink} onCancel={() => setAddingLink(false)} />
          ) : null}
        </SheetPopup>
      </Sheet>

      <Sheet open={discard !== null} onOpenChange={(open) => open || setDiscard(null)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Save changes">
          <SheetTitle>
            Do you want to save the changes made to the document “{titleOf(name)}”?
          </SheetTitle>
          <SheetDescription>
            {discard?.reason
              ? `It could not be saved to its file: ${discard.reason} Your changes will be lost if you don’t save them.`
              : "Your changes will be lost if you don’t save them."}
          </SheetDescription>
          <SheetActions
            leading={
              <PushButton
                onClick={() => {
                  const answered = discard;
                  setDiscard(null);
                  if (answered?.inFile) dropChanges(answered.proceed);
                  else answered?.proceed();
                }}
              >
                Don’t Save
              </PushButton>
            }
          >
            <PushButton onClick={() => setDiscard(null)}>Cancel</PushButton>
            <DefaultButton
              onClick={() => {
                const answered = discard;
                setDiscard(null);
                if (answered?.inFile) {
                  void writeNow((error) =>
                    setDiscard({
                      proceed: answered.proceed,
                      reason: messageOf(error),
                      inFile: true,
                    }),
                  ).then((ok) => {
                    if (ok) answered.proceed();
                  });
                  return;
                }
                afterSave.current = answered?.proceed ?? null;
                setDialog("save");
              }}
            >
              {discard?.inFile ? "Save" : "Save…"}
            </DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>

      <Sheet open={lockAsked} onOpenChange={setLockAsked}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Locked file">
          <SheetTitle>The file “{titleOf(name)}” is locked.</SheetTitle>
          <SheetDescription>
            If you want to make changes to this document, click Unlock. To keep this file as it is
            and work on a copy, click Duplicate.
          </SheetDescription>
          <SheetActions>
            <PushButton onClick={() => setLockAsked(false)}>Cancel</PushButton>
            <PushButton
              onClick={() => {
                setLockAsked(false);
                duplicate();
              }}
            >
              Duplicate
            </PushButton>
            <DefaultButton
              onClick={() => {
                setLockAsked(false);
                lockedFile(false);
              }}
            >
              Unlock
            </DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>

      <Sheet
        open={stale?.asking === true}
        onOpenChange={(open) => open || setStale((now) => now && { ...now, asking: false })}
      >
        <SheetPopup anchor={titleBar} width={420} aria-label="File changed">
          <SheetTitle>
            This document’s file has been changed by another application since you opened or saved
            it.
          </SheetTitle>
          <SheetDescription>
            The changes made by the other application will be lost if you save. Save anyway?
          </SheetDescription>
          <SheetActions>
            <PushButton
              onClick={() => {
                setStale((now) => now && { ...now, asking: false });
                saveDocument(true);
              }}
            >
              Save Anyway
            </PushButton>
            <DefaultButton onClick={() => setStale((now) => now && { ...now, asking: false })}>
              Cancel
            </DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>

      <Alert
        open={plainAsked}
        onOpenChange={(open) => {
          if (!open) setPlainAsked(false);
        }}
      >
        <AlertPopup>
          <AlertMessage>Convert this document to plain text?</AlertMessage>
          <AlertInformativeText>
            Making a rich text document plain will lose all text styles (such as fonts and colors),
            images, attachments, and document properties.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<PushButton />}>Cancel</AlertClose>
            <AlertClose render={<DefaultButton onClick={() => convert("plain")} />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>

      <Alert
        open={problem !== null}
        onOpenChange={(open) => {
          if (!open) setProblem(null);
        }}
      >
        <AlertPopup>
          <AlertMessage>{problem?.message}</AlertMessage>
          <AlertInformativeText>{problem?.detail}</AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>

      <Sheet open={exportingPdf} onOpenChange={(open) => open || setExportingPdf(false)}>
        <SheetPopup anchor={titleBar} width={640} aria-label="Export as PDF">
          {exportingPdf ? (
            <DriveSavePanel
              defaultName={`${titleOf(name).replace(/\.[^.]+$/, "")}.pdf`}
              nameToSave={(typed) => (/\.pdf$/i.test(typed) ? typed : `${typed}.pdf`)}
              onCancel={() => setExportingPdf(false)}
              onSave={(target) => {
                setExportingPdf(false);
                const node = editor.current;
                const paragraphs = node
                  ? paragraphsOfContent(node)
                  : paragraphsOfLines(lines.current).map((paragraph) => ({
                      ...paragraph,
                      runs: paragraph.runs.map((run) => ({
                        ...run,
                        style: { ...run.style, family: "Menlo", size: 11 },
                      })),
                    }));
                void writeDocumentPdf(paragraphs, pageSetup, titleOf(name), documentTabs)
                  .then((bytes) =>
                    saveToDrive(target, new Blob([bytes as BlobPart], { type: "application/pdf" })),
                  )
                  .catch((error) =>
                    fail(`The document “${titleOf(name)}” could not be exported.`, error),
                  );
              }}
            />
          ) : null}
        </SheetPopup>
      </Sheet>

      {host && attaching
        ? createPortal(
            <div
              className="mac-textedit-panel-layer"
              data-contained={host === host.ownerDocument.body ? undefined : ""}
            >
              <DriveOpenPanel
                state={state === "inactive" ? "inactive" : "key"}
                onCancel={() => setAttaching(false)}
                onOpen={(entry) => {
                  setAttaching(false);
                  setFilesToInsert([{ id: entry.id, name: entry.name, type: entry.type }]);
                }}
              />
            </div>,
            host,
          )
        : null}

      <Sheet open={shown === "print"} onOpenChange={(open) => open || setDialog(null)}>
        <SheetPopup anchor={titleBar} width={756} aria-label="Print">
          <TextEditPrintPanel
            name={name}
            lines={lines.current}
            plain={plain}
            setup={pageSetup}
            onCancel={() => setDialog(null)}
            onPrint={(settings) => {
              setDialog(null);
              // On the desktop the browser prints the document.
              if (served) {
                printDocument({
                  ...printable(),
                  page: {
                    paper: settings.paperSize === "a4" ? "a4" : "letter",
                    orientation: settings.orientation,
                    scale: pageSetup.scale,
                    copies: settings.copies,
                    twoSided: settings.twoSided,
                    ...(settings.pages === "range"
                      ? { range: { from: settings.from, to: settings.to } }
                      : undefined),
                  },
                });
              }
              onPrint?.(settings);
            }}
            onSaveAsPdf={() => {
              if (!served) {
                setDialog("save");
                return;
              }
              setDialog(null);
              printDocument(printable());
            }}
          />
        </SheetPopup>
      </Sheet>

      {host && shown === "open"
        ? createPortal(
            <div
              className="mac-textedit-panel-layer"
              data-contained={host === host.ownerDocument.body ? undefined : ""}
            >
              {served ? (
                <DriveOpenPanel
                  multiple
                  accept={isTextDocument}
                  state={state === "inactive" ? "inactive" : "key"}
                  onCancel={() => setDialog(null)}
                  onOpen={(entries) => {
                    const encoding =
                      openEncoding ??
                      (preferences.openEncoding === "automatic"
                        ? undefined
                        : preferences.openEncoding);
                    const options = {
                      ...(encoding ? { encoding } : undefined),
                      ...(ignoreRich ? { asCode: true } : undefined),
                    };
                    // This window takes one file at most; each of the others gets a window.
                    const [first, ...rest] = entries;
                    if (first) routeOpen({ id: first.id, name: first.name, ...options });
                    for (const entry of rest) {
                      const there = windowWithFile(entry.id);
                      if (there) there.focus();
                      else {
                        openNewWindow({
                          kind: "file",
                          file: {
                            id: entry.id,
                            name: entry.name,
                            ...(encoding ? { encoding } : {}),
                          },
                          ...(ignoreRich ? { asCode: true } : {}),
                        });
                      }
                    }
                    setIgnoreRich(false);
                    setOpenEncoding(null);
                  }}
                  leading={
                    <>
                      <PushButton onClick={fileCommands.newDocument}>New Document</PushButton>
                      <Checkbox checked={ignoreRich} onCheckedChange={setIgnoreRich}>
                        Ignore rich text commands
                      </Checkbox>
                      <PopUpButton
                        aria-label="Plain Text Encoding"
                        size="small"
                        value={openEncoding ?? preferences.openEncoding}
                        onValueChange={(next) => setOpenEncoding(next)}
                      >
                        <PopUpButtonItem value="automatic">Automatic</PopUpButtonItem>
                        {PLAIN_ENCODINGS.map((entry) => (
                          <PopUpButtonItem key={entry.value} value={entry.value}>
                            {entry.label}
                          </PopUpButtonItem>
                        ))}
                      </PopUpButton>
                    </>
                  }
                />
              ) : (
                <TextEditOpenPanel
                  places={places}
                  state={state === "inactive" ? "inactive" : "key"}
                  onCancel={() => setDialog(null)}
                  onNewDocument={() => guard(newDocument)}
                  onNewFolder={newFolder}
                  onOpen={(document) =>
                    guard(() => {
                      load(document, false);
                      setDialog(null);
                    })
                  }
                />
              )}
            </div>,
            host,
          )
        : null}

      {completing && host ? (
        <TextEditCompletions
          completing={completing}
          host={host.ownerDocument.body}
          onChoose={chooseCompletion}
        />
      ) : null}

      {host && (spellingShown || substitutionsShown)
        ? createPortal(
            <div
              className="mac-textedit-floating-layer"
              data-contained={host === host.ownerDocument.body ? undefined : ""}
              inert={busy || loading}
            >
              {spellingShown ? (
                <SpellingPanel
                  className="mac-textedit-floating-panel"
                  state={state === "inactive" ? "inactive" : "main"}
                  element={toolTarget}
                  editable={!readOnly}
                  ignored={ignoredWords.current}
                  onClose={() => setSpellingShown(false)}
                />
              ) : null}
              {substitutionsShown ? (
                <SubstitutionsPanel
                  className="mac-textedit-floating-panel"
                  state={state === "inactive" ? "inactive" : "main"}
                  element={toolTarget}
                  editable={!readOnly}
                  settings={substitutions}
                  detectors={{ checked: dataDetectors, onChange: setDataDetectors }}
                  onChange={setSubstitutions}
                  onClose={() => setSubstitutionsShown(false)}
                />
              ) : null}
            </div>,
            host,
          )
        : null}

      {host && !plain && (fontsShown || colorsShown)
        ? createPortal(
            <div
              className="mac-textedit-floating-layer"
              data-contained={host === host.ownerDocument.body ? undefined : ""}
              inert={busy || loading || prevented}
            >
              {fontsShown ? (
                <DesktopFontPanel
                  className="mac-textedit-floating-panel"
                  families={FONT_FAMILIES}
                  state={state === "inactive" ? "inactive" : "main"}
                  value={format}
                  onFontChange={applyFormat}
                  onClose={() => setFontsShown(false)}
                />
              ) : null}
              {colorsShown ? (
                <ColorPanel
                  className="mac-textedit-floating-panel"
                  state={state === "inactive" ? "inactive" : "main"}
                  value={format.color}
                  onValueChange={(color) => applyFormat({ color })}
                  onClose={() => setColorsShown(false)}
                />
              ) : null}
            </div>,
            host,
          )
        : null}
    </>
  );
}

/** Edit > Spelling and Grammar and Edit > Substitutions, reading the settings where they are kept. */
function TextEditToolItems({
  onShowSpelling,
  onCheckNow,
  onShowSubstitutions,
}: {
  onShowSpelling: () => void;
  onCheckNow: () => void;
  onShowSubstitutions: () => void;
}) {
  const { spelling, correctAutomatically } = useTextEditPreferences();
  const [settings, setSettings] = useTextSubstitutions("textedit");
  const [checkGrammar, setCheckGrammar] = useCheckGrammar();
  const [detectors, setDetectors] = useDesktopSetting(
    TEXTEDIT_SETTINGS.dataDetectors,
    readBoolean,
    false,
  );
  return (
    <>
      <Submenu>
        <SubmenuTrigger>Spelling and Grammar</SubmenuTrigger>
        <SubmenuPopup aria-label="Spelling and Grammar">
          <MenuItem keyEquivalent="shift+command+;" onClick={onShowSpelling}>
            Show Spelling and Grammar
          </MenuItem>
          <MenuItem keyEquivalent="command+;" onClick={onCheckNow}>
            Check Document Now
          </MenuItem>
          <MenuSeparator />
          <MenuCheckboxItem
            checked={spelling}
            onCheckedChange={() => changeDesktopValue(TEXTEDIT_SETTINGS.spelling, !spelling)}
          >
            Check Spelling While Typing
          </MenuCheckboxItem>
          <MenuCheckboxItem
            checked={checkGrammar}
            onCheckedChange={() => setCheckGrammar(!checkGrammar)}
          >
            Check Grammar With Spelling
          </MenuCheckboxItem>
          <MenuCheckboxItem
            checked={correctAutomatically}
            onCheckedChange={() =>
              changeDesktopValue(TEXTEDIT_SETTINGS.correctAutomatically, !correctAutomatically)
            }
          >
            Correct Spelling Automatically
          </MenuCheckboxItem>
        </SubmenuPopup>
      </Submenu>
      <SubstitutionItems
        disabled={false}
        settings={settings}
        onChange={setSettings}
        detectors={{ checked: detectors, onChange: setDetectors }}
        onShow={onShowSubstitutions}
      />
    </>
  );
}

export interface TextEditMenuBarProps {
  /** The app's commands: what `TextEdit` puts in its `actionsRef`. */
  actions: { readonly current: TextEditActions | null };
  /** The document's state, from `TextEdit`'s `onStatusChange`; titles the Format command. */
  status?: TextEditStatus;
  /** Disables the commands, while a dialog is shown. */
  disabled?: boolean;
}

/**
 * Format > Font, as TextEdit has it: the styles, the sizes and the two panels. Strikethrough is
 * not in Catalina's menu; it is set from the Fonts panel.
 */
const FONT_MENU: readonly (readonly [RichTextCommand, string] | null)[] = [
  ["show-fonts", "Show Fonts"],
  ["bold", "Bold"],
  ["italic", "Italic"],
  ["underline", "Underline"],
  null,
  ["bigger", "Bigger"],
  ["smaller", "Smaller"],
  null,
  ["show-colors", "Show Colors"],
];

/** The key equivalents of Copy Style, Paste Style, Copy Ruler and Paste Ruler. */
const EXTRA_KEYS: readonly (readonly [string, TextEditExtraCommand])[] = [
  ["option+command+c", "copy-style"],
  ["option+command+v", "paste-style"],
  ["control+command+c", "copy-ruler"],
  ["control+command+v", "paste-ruler"],
];

/** Format > Text: the four alignments. */
const TEXT_MENU: readonly (readonly [RichTextCommand, string])[] = [
  ["align-left", "Align Left"],
  ["align-center", "Center"],
  ["align-justify", "Justify"],
  ["align-right", "Align Right"],
];

/** Format > Font: its commands, dimmed for plain text and while the document is held. */
function TextEditFontSubmenu({
  disabled,
  onCommand,
  canPasteStyle = false,
  onExtra,
}: {
  disabled: boolean;
  onCommand: (command: RichTextCommand) => void;
  canPasteStyle?: boolean;
  onExtra?: (command: TextEditExtraCommand) => void;
}) {
  return (
    <Submenu disabled={disabled}>
      <SubmenuTrigger>Font</SubmenuTrigger>
      <SubmenuPopup>
        {FONT_MENU.map((entry, index) =>
          entry ? (
            <MenuItem
              key={entry[0]}
              keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[entry[0]]}
              onClick={() => onCommand(entry[0])}
            >
              {entry[1]}
            </MenuItem>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: the separators of a fixed list
            <MenuSeparator key={index} />
          ),
        )}
        {onExtra ? (
          <>
            <MenuSeparator />
            <TextEditFontExtraItems canPasteStyle={canPasteStyle} onExtra={onExtra} />
          </>
        ) : null}
      </SubmenuPopup>
    </Submenu>
  );
}

/** The text selected in `element`, as the secondary click that opened a menu left it. */
/** The longest selection a Look Up row names in full. */
const LOOK_UP_NAME = 24;

/**
 * The menu of a secondary click on the text: what Data Detectors found there, Look Up and Search with
 * Google on the selection, the Edit commands, Font and Speech. Google's results open in a new tab of
 * Safari.
 */
function TextEditContextItems({
  target,
  point,
  plain,
  disabled,
  onCommand,
  onShowSpelling,
  onCheckNow,
  onShowSubstitutions,
}: {
  target: () => EditMenuTarget | null;
  point: () => { x: number; y: number } | null;
  plain: boolean;
  disabled: boolean;
  onCommand: (command: RichTextCommand) => void;
  onShowSpelling: () => void;
  onCheckNow: () => void;
  onShowSubstitutions: () => void;
}) {
  const detecting = useDesktopValue(TEXTEDIT_SETTINGS.dataDetectors, readBoolean, false);
  // The popup is made anew for each click, before it takes the focus from the text.
  const [found] = useState(() => {
    const element = target()?.element;
    return element && detecting ? detectedInView(element, point()) : null;
  });
  const [selected] = useState(() => {
    const element = target()?.element;
    return element ? selectedText(element).trim() : "";
  });
  const named = selected.length > LOOK_UP_NAME ? `${selected.slice(0, LOOK_UP_NAME)}…` : selected;
  const speech = typeof speechSynthesis !== "undefined";
  return (
    <>
      <DetectedItems found={found} />
      <MenuItem disabled={selected === ""} onClick={() => lookUp(selected)}>
        {selected === "" ? "Look Up" : `Look Up “${named}”`}
      </MenuItem>
      <MenuItem
        disabled={selected === ""}
        onClick={() =>
          openUrl(`https://www.google.com/search?q=${encodeURIComponent(selected)}`, "textedit")
        }
      >
        Search with Google
      </MenuItem>
      <MenuSeparator />
      <EditorEditItems target={target} />
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Services</SubmenuTrigger>
        <SubmenuPopup>
          <ServicesItems from="textedit" none={<MenuItem disabled>No Services Apply</MenuItem>} />
        </SubmenuPopup>
      </Submenu>
      <TextEditFontSubmenu disabled={disabled || plain} onCommand={onCommand} />
      <TextEditToolItems
        onShowSpelling={onShowSpelling}
        onCheckNow={onCheckNow}
        onShowSubstitutions={onShowSubstitutions}
      />
      <Submenu>
        <SubmenuTrigger>Speech</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem
            disabled={!speech}
            onClick={() => {
              const element = target()?.element;
              const whole =
                element instanceof HTMLTextAreaElement
                  ? element.value
                  : (element?.innerText ?? element?.textContent);
              speechSynthesis.cancel();
              speechSynthesis.speak(new SpeechSynthesisUtterance(selected || (whole ?? "")));
            }}
          >
            Start Speaking
          </MenuItem>
          <MenuItem disabled={!speech} onClick={() => speechSynthesis.cancel()}>
            Stop Speaking
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
    </>
  );
}

export interface TextEditFormatItemsProps {
  /** Opens the Lists sheet; without it the row is left out. */
  onShowLists?: () => void;
  /** Opens the Table sheet; without it the row is left out. */
  onShowTable?: () => void;
  /** Whether the document is plain text, which takes none of the Font and Text commands. */
  plain: boolean;
  /**
   * Dims every item, while a sheet, a write or a read holds the document.
   * @default false
   */
  disabled?: boolean;
  /** Called with the Font or Text command chosen. */
  onCommand: (command: RichTextCommand) => void;
  /** Called with the format Make Plain Text or Make Rich Text converts the document to. */
  onSetFormat: (format: TextEditDocument["format"]) => void;
  /** Whether the document is held from editing, for its row, and dims the rows that edit it. */
  prevented?: boolean;
  /** Holds the document from editing or lets it go; without it the row is left out. */
  onTogglePrevented?: () => void;
  /** Whether words may break at line ends, for its row. */
  hyphenation?: boolean;
  /** Allows or disallows hyphenation; without it the row is left out. */
  onToggleHyphenation?: () => void;
  /** Whether the ruler shows, for Format > Text's row. */
  ruler?: boolean;
  /** Whether the text wraps to a page, for Wrap to Page's row. */
  wrap?: boolean;
  /** Shows or hides the ruler; without it the row is left out. */
  onToggleRuler?: () => void;
  /** Wraps the text to a page or to the window; without it the row is left out. */
  onToggleWrap?: () => void;
  /** Whether Copy Style has something for Paste Style. */
  canPasteStyle?: boolean;
  /** Whether Copy Ruler has something for Paste Ruler. */
  canPasteRuler?: boolean;
  /** Runs the rows of `textedit-format.tsx`; without it they are left out. */
  onExtra?: (command: TextEditExtraCommand) => void;
}

/**
 * The items of TextEdit's Format menu: the Font and Text submenus with their key equivalents,
 * Make Plain Text or Make Rich Text, Prevent Editing, Wrap to Page and Allow Hyphenation. The demo's
 * own menu bar and the desktop's both show them; the rows of what only a window holds only where a
 * window gives their state.
 */
export function TextEditFormatItems({
  plain,
  disabled = false,
  prevented = false,
  hyphenation,
  ruler,
  wrap,
  onTogglePrevented,
  onToggleHyphenation,
  onToggleRuler,
  onToggleWrap,
  onShowLists,
  onShowTable,
  onCommand,
  onSetFormat,
  canPasteStyle,
  canPasteRuler = false,
  onExtra,
}: TextEditFormatItemsProps) {
  const held = disabled || prevented;
  return (
    <>
      <TextEditFontSubmenu
        disabled={held || plain}
        onCommand={onCommand}
        canPasteStyle={canPasteStyle}
        onExtra={onExtra}
      />
      <Submenu disabled={held || plain}>
        <SubmenuTrigger>Text</SubmenuTrigger>
        <SubmenuPopup>
          {TEXT_MENU.map(([command, title]) => (
            <MenuItem
              key={command}
              keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[command]}
              onClick={() => onCommand(command)}
            >
              {title}
            </MenuItem>
          ))}
          {onExtra ? (
            <>
              <MenuSeparator />
              <Submenu>
                <SubmenuTrigger>Writing Direction</SubmenuTrigger>
                <SubmenuPopup>
                  <MenuItem onClick={() => onExtra("direction-natural")}>Natural</MenuItem>
                  <MenuItem onClick={() => onExtra("direction-ltr")}>Left to Right</MenuItem>
                  <MenuItem onClick={() => onExtra("direction-rtl")}>Right to Left</MenuItem>
                </SubmenuPopup>
              </Submenu>
              <MenuItem onClick={() => onExtra("show-spacing")}>Spacing…</MenuItem>
            </>
          ) : null}
          {onToggleRuler ? (
            <>
              <MenuSeparator />
              <MenuItem keyEquivalent="command+r" onClick={onToggleRuler}>
                {ruler ? "Hide Ruler" : "Show Ruler"}
              </MenuItem>
            </>
          ) : null}
          {onExtra ? (
            <>
              <MenuItem keyEquivalent="control+command+c" onClick={() => onExtra("copy-ruler")}>
                Copy Ruler
              </MenuItem>
              <MenuItem
                keyEquivalent="control+command+v"
                disabled={!canPasteRuler}
                onClick={() => onExtra("paste-ruler")}
              >
                Paste Ruler
              </MenuItem>
            </>
          ) : null}
        </SubmenuPopup>
      </Submenu>
      {onShowLists ? (
        <MenuItem disabled={held || plain} onClick={onShowLists}>
          Lists…
        </MenuItem>
      ) : null}
      {onShowTable ? (
        <MenuItem disabled={held || plain} onClick={onShowTable}>
          Table…
        </MenuItem>
      ) : null}
      <MenuSeparator />
      <MenuItem
        disabled={held}
        keyEquivalent="shift+command+t"
        onClick={() => onSetFormat(plain ? "rich" : "plain")}
      >
        {plain ? "Make Rich Text" : "Make Plain Text"}
      </MenuItem>
      {onTogglePrevented ? (
        <MenuItem disabled={disabled} onClick={onTogglePrevented}>
          {prevented ? "Allow Editing" : "Prevent Editing"}
        </MenuItem>
      ) : null}
      {onToggleWrap ? (
        <MenuItem disabled={disabled} keyEquivalent="shift+command+w" onClick={onToggleWrap}>
          {wrap ? "Wrap to Window" : "Wrap to Page"}
        </MenuItem>
      ) : null}
      {onToggleHyphenation ? (
        <MenuItem disabled={disabled} onClick={onToggleHyphenation}>
          {hyphenation ? "Disallow Hyphenation" : "Allow Hyphenation"}
        </MenuItem>
      ) : null}
    </>
  );
}

/**
 * TextEdit's menu bar, for a page that shows the window on a desktop: the library's `MenuBar`
 * with the File and Format commands the demo has. The other menus list their commands dimmed.
 */
export function TextEditMenuBar({ actions, status, disabled = false }: TextEditMenuBarProps) {
  const plain = status?.format === "plain";
  const onDrive = status?.file;
  // The drive's File commands, read from the window when one is chosen.
  const fileCommand = (act: (commands: TextEditFileCommands) => void) => () => {
    const commands = actions.current?.file;
    if (commands) act(commands);
  };
  return (
    <MenuBar modal={false} aria-label="TextEdit menus">
      <MenuBarMenu title="TextEdit" application>
        <MenuItem disabled>About TextEdit</MenuItem>
        <MenuSeparator />
        <MenuItem disabled>Quit TextEdit</MenuItem>
      </MenuBarMenu>
      {onDrive ? (
        <MenuBarMenu title="File">
          <TextEditFileMenuItems
            state={onDrive}
            disabled={disabled}
            commands={{
              newDocument: fileCommand((commands) => commands.newDocument()),
              open: fileCommand((commands) => commands.open()),
              openRecent: (id) => actions.current?.file?.openRecent(id),
              clearRecents: fileCommand((commands) => commands.clearRecents()),
              save: fileCommand((commands) => commands.save()),
              duplicate: fileCommand((commands) => commands.duplicate()),
              rename: fileCommand((commands) => commands.rename()),
              moveTo: fileCommand((commands) => commands.moveTo()),
              revert: fileCommand((commands) => commands.revert()),
              revertToPrevious: fileCommand((commands) => commands.revertToPrevious()),
              browseVersions: fileCommand((commands) => commands.browseVersions()),
              saveAs: fileCommand((commands) => commands.saveAs()),
              exportPdf: fileCommand((commands) => commands.exportPdf()),
              pageSetup: fileCommand((commands) => commands.pageSetup()),
              print: fileCommand((commands) => commands.print()),
              showProperties: fileCommand((commands) => commands.showProperties()),
            }}
          />
        </MenuBarMenu>
      ) : (
        <MenuBarMenu title="File">
          <MenuItem disabled={disabled} onClick={() => actions.current?.newDocument()}>
            New
          </MenuItem>
          <MenuItem
            disabled={disabled}
            keyEquivalent="command+o"
            onClick={() => actions.current?.show("open")}
          >
            Open…
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            disabled={disabled}
            keyEquivalent="command+s"
            onClick={() => actions.current?.show("save")}
          >
            Save…
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            disabled={disabled}
            keyEquivalent="command+p"
            onClick={() => actions.current?.show("print")}
          >
            Print…
          </MenuItem>
        </MenuBarMenu>
      )}
      <MenuBarMenu title="Edit">
        <EditorEditItems target={() => actions.current?.editTarget() ?? null} />
        {actions.current ? (
          <EditorMoreItems
            target={() => actions.current?.editTarget() ?? null}
            find={() => (actions.current as TextEditActions).find()}
            replace
            beforeFind={
              <TextEditToolItems
                onShowSpelling={() => actions.current?.showSpelling()}
                onCheckNow={() => actions.current?.checkSpelling()}
                onShowSubstitutions={() => actions.current?.showSubstitutions()}
              />
            }
          />
        ) : null}
      </MenuBarMenu>
      <MenuBarMenu title="Format">
        <TextEditFormatItems
          plain={plain}
          disabled={disabled}
          prevented={status?.prevented}
          hyphenation={status?.hyphenation}
          wrap={status?.wrap}
          ruler={status?.ruler}
          onTogglePrevented={() => actions.current?.togglePrevented()}
          onToggleHyphenation={() => actions.current?.toggleHyphenation()}
          onToggleWrap={() => actions.current?.toggleWrap()}
          onToggleRuler={() => actions.current?.toggleRuler()}
          onShowTable={() => actions.current?.showTable()}
          onShowLists={() => actions.current?.showLists()}
          onCommand={(command) => actions.current?.format(command)}
          canPasteStyle={status?.canPasteStyle}
          canPasteRuler={status?.canPasteRuler}
          onExtra={(command) => actions.current?.extra(command)}
          onSetFormat={(format) => actions.current?.setFormat(format)}
        />
      </MenuBarMenu>
      <MenuBarMenu title="View">
        <MenuItem disabled>Actual Size</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Window">
        <MenuItem disabled>Minimize</MenuItem>
        <MenuItem disabled>Zoom</MenuItem>
      </MenuBarMenu>
      <MenuBarMenu title="Help">
        <MenuItem disabled>TextEdit Help</MenuItem>
      </MenuBarMenu>
    </MenuBar>
  );
}
