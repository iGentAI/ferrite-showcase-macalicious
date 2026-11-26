"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { Checkbox } from "macalicious/checkbox";
import { ColorPanel } from "macalicious/color-panel";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { Form, FormRow } from "macalicious/form";
import { GradientButton } from "macalicious/gradient-button";
import { ImageButton } from "macalicious/image-button";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import {
  applyRichTextFormat,
  FONT_FAMILIES,
  keepRichTextSelection,
  keepTypingRuns,
  RICH_TEXT_KEY_EQUIVALENTS,
  type RichTextAlignment,
  type RichTextCommand,
  type RichTextFormat,
  type RichTextSelectionKeeper,
  readRichTextFormat,
  richTextFromHtml,
  richTextKeyCommand,
  runRichTextCommand,
} from "macalicious/lib/rich-text";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import { Ruler, type RulerMarker } from "macalicious/ruler";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { StatusBar } from "macalicious/status-bar";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TextField } from "macalicious/text-field";
import { RichTextView, TextView } from "macalicious/text-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowBanner } from "macalicious/window-banner";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type ComponentType,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { type DesktopDragItem, useDesktopDrop } from "../desktop/desktop-drag";
import { type KeptVersion, previousSaveOf, versionDate } from "../desktop/desktop-files";
import { DesktopFontPanel } from "../desktop/desktop-font-panel";
import { desktopValues, readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { DesktopVersionsSheet } from "../desktop/desktop-versions-sheet";
import { DesktopWindowHostContext, DesktopWindowName } from "../desktop/desktop-windows";
import {
  pasteEdges,
  spaceAfterPaste,
  substituteTyped,
  useTextSubstitutions,
} from "../desktop/text-substitutions";
import {
  checkDocumentAfterMenu,
  SpellingItems,
  SpellingPanel,
  SubstitutionItems,
  SubstitutionsPanel,
  useLearnedWords,
} from "../desktop/text-tools";
import { DriveOpenPanel } from "../finder/finder-file-dialogs";
import { onOpenFileRequest, takeOpenFileRequests } from "../finder/finder-open";
import { type EditMenuTarget, EditorEditItems, EditorMoreItems } from "../notes/notes-edit-menu";
import { directionAt, type NotesDirection, setLineDirection } from "../notes/notes-editor";
import { FindBar, type TextFind, useTextFind } from "../notes/notes-find";
import { whenMenusClosed } from "../notes/notes-menus";
import { printDocument } from "../textedit/textedit-drive";
import {
  type CopiedStyle,
  copyStyle,
  documentStyles,
  STYLE_PROPERTIES,
  styleSelection,
  stylesOf,
  type TextEditExtraCommand,
  TextEditFontExtraItems,
} from "../textedit/textedit-format";
import { TextEditStyles } from "../textedit/textedit-sheets";
import {
  answerTabKey,
  DocumentTabBar,
  DocumentTabOverview,
  type DocumentTabs,
  DocumentTabWindowItems,
  useDocumentTabs,
} from "../textedit/textedit-tabs";
import { tellsApplication, translateAppleScript } from "./script-editor-applescript";
import {
  compile,
  defaultSource,
  errorLine,
  handlersOf,
  LANGUAGES,
  type RunResult,
  run,
  type ScriptLanguage,
  styleScript,
} from "./script-editor-data";
import {
  type BundleFile,
  type BundleInfo,
  clearRecentScripts,
  draftKey,
  fileText,
  forgetDraft,
  forgetOlderScriptInfo,
  forgetRecentScript,
  keepDraft,
  noteRecentScript,
  type RecentScript,
  readFileText,
  readOlderScriptInfo,
  type ScriptInfo,
  useRecentScripts,
  useStoredDraft,
} from "./script-editor-draft";
import {
  BottomPaneGlyph,
  CompileGlyph,
  DescriptionGlyph,
  LibraryGlyph,
  LogGlyph,
  RecordGlyph,
  ResultGlyph,
  RunGlyph,
  SidePaneGlyph,
  StopGlyph,
} from "./script-editor-glyphs";
import { noteRun } from "./script-editor-history";
import {
  commandOfKey,
  FILE_COMMANDS,
  NO_APPLICATION,
  NO_RUN_ONLY,
  NO_STOP_REASON,
  type ScriptEditorCommand,
  ScriptEditorEditExtras,
  ScriptEditorFileItems,
  ScriptEditorHelpItems,
  ScriptEditorScriptItems,
  ScriptEditorViewItems,
  ScriptEditorWindowItems,
} from "./script-editor-menus";
import {
  DEFAULT_TAB_WIDTH,
  formattingStyle,
  readFormatting,
  readLanguage,
  readTabWidth,
  readWrapIndent,
  SCRIPT_EDITOR_SETTINGS,
  type ScriptFormatting,
} from "./script-editor-preferences";
import { DesktopRecorder, type RecordedAction, withRecorded } from "./script-editor-recorder";
import {
  desktopScriptEditorServer,
  drivePaths,
  isScriptFile,
  type LogTab,
  libraryText,
  logLinesOf,
  type SavedScript,
  SCRIPT_TEMPLATES,
  type ScriptDictionary,
  type ScriptEditorServer,
  type ScriptFile,
  type ScriptFolder,
  scriptName,
  servedSource,
} from "./script-editor-server";
import { completionsOf, fillSnippet, SNIPPETS, wordBefore } from "./script-editor-snippets";
import {
  NO_HIDDEN_TOOLS,
  readHiddenTools,
  ScriptEditorCustomizeToolbar,
  type ScriptEditorTool,
} from "./script-editor-toolbar";
import {
  appName,
  dictionaryApps,
  ScriptEditorAuxWindows,
  showDictionaryWindow,
  showHistoryWindow,
  showLibraryWindow,
} from "./script-editor-windows";
import "../textedit/textedit.css";
import "./script-editor.tokens.css";
import "./script-editor.css";

/**
 * The accessory views under the script, chosen in the bottom bar. The Library, the dictionary
 * of what a script can call, is there only when a server runs the scripts.
 */
export type ScriptEditorView = "description" | "result" | "log" | "library";

export interface ScriptEditorProps extends Omit<WindowProps, "children" | "title"> {
  /**
   * The window's title.
   * @default "Untitled (Untitled Mail Rule Action.scptd 2)"
   */
  title?: string;
  /**
   * The script the window opens with, a tab for every level of indentation. Read once.
   * @default defaultSource
   */
  defaultSource?: string;
  /**
   * The text of the Description view when the window opens. Read once.
   * @default ""
   */
  defaultDescription?: string;
  /**
   * The accessory view shown at first.
   * @default "description"
   */
  defaultView?: ScriptEditorView;
  /**
   * The language the window opens in.
   * @default "AppleScript"
   */
  defaultLanguage?: ScriptLanguage;
  /**
   * The server that runs JavaScript scripts and keeps saved ones. With one, Run sends a
   * JavaScript script to it, the navigation bar can open and save scripts, and the Library view
   * lists what a script can call. When the `macalicious-desktop` Ferrite application serves the
   * page it is that application's, unless one is given; elsewhere there is none.
   */
  server?: ScriptEditorServer;
  /** Called with the accessory view that is chosen in the bottom bar or shown by a command. */
  onViewChange?: (view: ScriptEditorView) => void;
  /** Called with the script after it has compiled, indented by its blocks. */
  onCompile?: (source: string) => void;
  /** Called with the result after the script has run; `""` when it has none. */
  onRun?: (result: string) => void;
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
  /**
   * Given by a desktop page: opens the Library, the Dictionaries and the Log History as windows of
   * the desktop. Without it their menu rows are dimmed.
   */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
}

const VIEWS: readonly { id: ScriptEditorView; title: string }[] = [
  { id: "description", title: "Description" },
  { id: "result", title: "Result" },
  { id: "log", title: "Log" },
  { id: "library", title: "Library" },
];

/** What the Result view adds to an AppleScript result when a server runs the scripts. */
export const APPLESCRIPT_NOTE =
  "(*This AppleScript was worked out on this page. Only what is inside a tell application block reaches your apps.*)";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The scripts of the Open Script menu, as last read. */
interface ScriptList {
  status: "idle" | "loading" | "ready" | "failed";
  list: readonly SavedScript[];
  error?: string;
}

/**
 * The sheet of a window with a server: asking for the name to save under, whether to replace the
 * script of that name, or, before another script is opened over unsaved changes, whether to keep
 * them (`pending` is the script to open); the new name of File > Rename; the folder of File >
 * Move To.
 */
interface SaveSheet {
  /** Numbers each sheet: a save updates only the sheet it was started from. */
  id: number;
  step:
    | "name"
    | "replace"
    | "discard"
    | "rename"
    | "move"
    | "export"
    | "styles"
    | "plain"
    | "dictionary";
  name: string;
  busy: boolean;
  error?: string;
  /** Export: the file's kind. */
  format?: "script" | "text" | "bundle";
  /** Styles: the styles of the text, and whether any of it is selected. */
  styles?: readonly CopiedStyle[];
  canApply?: boolean;
  /** Open Dictionary: the apps to choose from, once read. */
  apps?: readonly string[];
  /** Make Plain Text: the view to convert. */
  node?: HTMLElement;
  pending?: SavedScript;
  /** The window is closing (the close button's press) once the changes are saved or dropped. */
  close?: MouseEvent<HTMLElement>;
  /** Move To: the folders to choose from, once read, and the one chosen. */
  folders?: readonly ScriptFolder[];
  folder?: string;
}

/** The most recently chosen completions list at the insertion point. */
interface Completing {
  items: readonly string[];
  index: number;
  word: string;
  left: number;
  top: number;
}

/**
 * The range of the `count` characters before `node`'s `offset` in `root`, over the runs of text the
 * styles divide a line into.
 */
function rangeBack(root: HTMLElement, node: Node, offset: number, count: number): Range {
  const range = root.ownerDocument.createRange();
  range.setEnd(node, offset);
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  walker.currentNode = node;
  let at: Node | null = node;
  let room = offset;
  let left = count;
  while (at && left > room) {
    left -= room;
    at = walker.previousNode();
    room = at?.nodeValue?.length ?? 0;
  }
  if (at) range.setStart(at, room - left);
  return range;
}

/** The script view's text as printed: what each run looks like now, with no style sheet to read. */
function printedScript(root: HTMLElement): string {
  const copy = root.cloneNode(true) as HTMLElement;
  const view = root.ownerDocument.defaultView;
  const originals = root.querySelectorAll<HTMLElement>(".mac-script-editor-run");
  for (const [index, run] of copy
    .querySelectorAll<HTMLElement>(".mac-script-editor-run")
    .entries()) {
    const original = originals[index];
    const style = original && view?.getComputedStyle(original);
    run.removeAttribute("class");
    run.removeAttribute("data-style");
    if (style) {
      run.style.color = style.color;
      run.style.fontWeight = style.fontWeight;
      run.style.fontStyle = style.fontStyle;
    }
  }
  return `<div style='font:12px/15px Verdana,"DejaVu Sans",Geneva,sans-serif;white-space:pre-wrap;tab-size:29px'>${copy.innerHTML}</div>`;
}

/** Script Editor sets a script in Verdana 12 on a 15 pt line; DejaVu Sans has its widths. */
/** The bundle fields of a script no one has set them for. */
const DEFAULT_BUNDLE: BundleInfo = {
  name: "Untitled Mail Rule Action",
  identifier: "com.example.mail-rule-action",
  version: "1.0",
  copyright: "",
};

/** Edit > Find's key equivalents. */
const FIND_KEYS: readonly (readonly [string, (find: TextFind) => void])[] = [
  ["command+f", (find) => find.open()],
  ["option+command+f", (find) => find.open(true)],
  ["command+g", (find) => find.move(false)],
  ["shift+command+g", (find) => find.move(true)],
  ["command+e", (find) => find.fromSelection()],
  ["command+j", (find) => find.jump()],
];

const SCRIPT_FONT: CSSProperties = {
  font: '12px / 15px Verdana, "DejaVu Sans", Geneva, sans-serif',
};

const NO_FORMATTING: ScriptFormatting = {};

const BLOCK = /^(DIV|P|LI|H[1-6]|PRE)$/;

/** What the Description keeps across a reload beyond the library's formats. */
const DESCRIPTION_HTML = {
  elements: ["A"],
  attributes: { dir: /^(ltr|rtl)$/, href: /^https?:\/\//i },
  styles: STYLE_PROPERTIES,
};

/** Where the point is in the page's text, as the engine can say. */
function rangeAtPoint(document: Document, { x, y }: { x: number; y: number }): Range | null {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position) {
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }
  return document.caretRangeFromPoint?.(x, y) ?? null;
}

/* The library's hooks, set to this window's measured values (script-editor.tokens.css). */
const SPLIT_STYLE = {
  "--mac-split-view-divider-color": "var(--mac-script-editor-divider)",
} as CSSProperties;
const VIEW_STYLE = { "--mac-image-button-padding": "0" } as CSSProperties;

/** A place in the script view: a node and an offset in it, as a range takes them. */
type ViewPoint = [node: Node, offset: number];

/** A line of the script view: its text, and where it starts and ends in the view. */
interface ViewLine {
  text: string;
  start: ViewPoint;
  end: ViewPoint;
}

/**
 * The lines of the script view. The browser keeps a line in a block element, ends one with a
 * `<br>` or with a newline in its text, or leaves bare text, so a line is not always one child
 * of the view, and a text node may hold several lines.
 */
function viewLines(root: Node): ViewLine[] {
  const lines: ViewLine[] = [];
  let line: ViewLine | null = null;
  const flush = () => {
    if (line !== null) lines.push(line);
    line = null;
  };
  const walk = (node: Node) => {
    for (const [index, child] of Array.from(node.childNodes).entries()) {
      if (child.nodeType === 3) {
        // A newline in the text ends a line, and what follows it is the next one.
        let offset = 0;
        for (const [at, part] of (child.nodeValue ?? "").split("\n").entries()) {
          if (at > 0) flush();
          line ??= { text: "", start: [child, offset], end: [child, offset] };
          line.text += part;
          line.end = [child, offset + part.length];
          offset += part.length + 1;
        }
      } else if (child instanceof HTMLElement) {
        if (child.tagName === "BR") {
          line ??= { text: "", start: [node, index], end: [node, index] };
          line.end = [node, index + 1];
          flush();
        } else if (BLOCK.test(child.tagName)) {
          flush();
          const before = lines.length;
          walk(child);
          // A block that held no line of its own, not even a <br>, is an empty line.
          if (line === null && lines.length === before)
            line = { text: "", start: [child, 0], end: [child, 0] };
          flush();
        } else walk(child);
      }
    }
  };
  walk(root);
  flush();
  return lines;
}

/**
 * The text of the script view, line by line. The browser keeps a line in a block element,
 * ends one with a `<br>` or a newline, or leaves bare text; a non-breaking space it put in is
 * a space.
 */
export function readScript(root: Node): string {
  return viewLines(root)
    .map((line) => line.text.replace(/\u00A0/g, " "))
    .join("\n");
}

/**
 * Where the insertion point is in the script view: its line, and how far it is from the line's
 * end, which a compilation's new indentation leaves as it was.
 */
function caretPlace(root: HTMLElement): { line: number; fromEnd: number } | null {
  const selection = root.ownerDocument.getSelection();
  if (!selection?.rangeCount) return null;
  const at = selection.getRangeAt(0);
  if (!root.contains(at.endContainer)) return null;
  const before = root.ownerDocument.createRange();
  before.selectNodeContents(root);
  before.setEnd(at.endContainer, at.endOffset);
  const holder = root.ownerDocument.createElement("div");
  holder.append(before.cloneContents());
  const typed = viewLines(holder);
  const line = Math.max(typed.length - 1, 0);
  const whole = viewLines(root)[line]?.text.length ?? 0;
  return { line, fromEnd: Math.max(whole - (typed[line]?.text.length ?? 0), 0) };
}

/** Gives a freshly rendered script view the keyboard, the insertion point at `place`. */
function placeCaret(root: HTMLElement, place: { line: number; fromEnd: number }) {
  const block = root.children[place.line] ?? root.lastElementChild;
  if (!block) return;
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(block);
  range.collapse(false);
  let left = Math.max((block.textContent ?? "").length - place.fromEnd, 0);
  const walker = root.ownerDocument.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.nodeValue?.length ?? 0;
    if (left <= length) {
      range.setStart(node, left);
      range.collapse(true);
      break;
    }
    left -= length;
  }
  root.focus({ preventScroll: true });
  const selection = root.ownerDocument.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/**
 * The Script Editor window of macOS 10.15: Record, Stop, Run and Compile and the two pane
 * toggles in the toolbar, a navigation bar with the language and the script's handlers, the
 * script in AppleScript's formatting styles, and under it the Description, Result or Log view
 * that the bottom bar chooses. Compile checks the script's blocks and indents and colours
 * it; Run also works out the result of its simplest statements. Nothing is sent to another
 * application: a page has none to script.
 *
 * When the `macalicious-desktop` Ferrite application serves the page (`servedByDesktopApp()`),
 * or a `server` is given, the window is a real one: it opens on a JavaScript script, Run sends
 * a JavaScript script to the server, which runs it against the person's own desktop apps, and
 * shows its Result and Log, the navigation bar opens and saves scripts in the person's drive,
 * and the Library view lists what a script can call.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function ScriptEditor(props: ScriptEditorProps) {
  return use(DesktopWindowHostContext) ? (
    <ScriptEditorOnDesktop {...props} />
  ) : (
    <ScriptEditorServed {...props} />
  );
}

const SCRIPT_EDITOR_TABS = { app: "script-editor", setting: SCRIPT_EDITOR_SETTINGS.tabs };

/** A window of the desktop has tabs. */
function ScriptEditorOnDesktop(props: ScriptEditorProps) {
  const tabs = useDocumentTabs(SCRIPT_EDITOR_TABS);
  return <ScriptEditorServed {...props} {...tabs.rootProps} tabs={tabs} />;
}

function ScriptEditorServed(props: ScriptEditorProps & { tabs?: DocumentTabs }) {
  if (props.server === undefined && servedByDesktopApp()) {
    const language = readLanguage(desktopValues()[SCRIPT_EDITOR_SETTINGS.defaultLanguage]);
    return (
      <ScriptEditorWindow
        title="Untitled"
        defaultSource={language === "AppleScript" ? "" : servedSource}
        defaultLanguage={language ?? "JavaScript"}
        defaultView="result"
        {...props}
        server={desktopScriptEditorServer}
      />
    );
  }
  return <ScriptEditorWindow {...props} />;
}

function ScriptEditorWindow({
  title = "Untitled (Untitled Mail Rule Action.scptd 2)",
  defaultSource: initialSource = defaultSource,
  defaultDescription = "",
  defaultView = "description",
  defaultLanguage = "AppleScript",
  server,
  onViewChange,
  onCompile,
  onRun,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  DesktopWindow,
  tabs,
  width = 700,
  height = 705,
  ...windowProps
}: ScriptEditorProps & { tabs?: DocumentTabs }) {
  // The script as it was last compiled or opened. The browser edits the view in place; the
  // text is read back from it when a command needs it. `revision` renders the view again.
  const [source, setSource] = useState(initialSource);
  const [revision, setRevision] = useState(0);
  const [edited, setEdited] = useState(false);
  const [language, setLanguage] = useState<ScriptLanguage>(defaultLanguage);
  const [element, setElement] = useState<string | null>(null);
  const [view, setOwnView] = useState(defaultView);
  const [accessory, setAccessory] = useState(true);
  const [bundle, setBundle] = useState(false);
  const [recording, setRecording] = useState(false);
  const [result, setResult] = useState("");
  const [log, setLog] = useState<readonly string[]>([]);
  const [logTab, setLogTab] = useState<LogTab>("replies");
  const logView = useRef<HTMLTextAreaElement>(null);
  const logText = logLinesOf(log, logTab).join("\n");
  // The Description is rich text: its content as the browser last wrote it, kept while another
  // view is shown; null until it is first edited, when it is the given text.
  const descriptionHtml = useRef<string | null>(null);
  // The Bundle Contents pane is not rendered while it is hidden, so its values are kept here.
  const [bundleInfo, setBundleInfo] = useState(DEFAULT_BUNDLE);
  const bundleField = (key: "name" | "identifier" | "version" | "copyright") => ({
    value: bundleInfo[key],
    onChange: (event: { currentTarget: { value: string } }) => {
      const { value } = event.currentTarget;
      setBundleInfo((info) => ({ ...info, [key]: value }));
      markChanged();
    },
  });
  const script = useRef<HTMLDivElement>(null);
  const hasServer = server !== undefined;
  /** The Description or a bundle field changed: the document has something to save. */
  const markChanged = () => {
    docVersion.current += 1;
    setEdited(true);
    setUnsaved(true);
  };

  // Only with a server: a run in flight, the title of a script opened or saved, the scripts of
  // the Open Script menu, the Library's text and the Save Script sheet.
  const [running, setRunning] = useState(false);
  const runningNow = useRef(false);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  // The drive file the script is, once opened or saved: File > Save writes into it.
  const [file, setFile] = useState<ScriptFile | null>(null);
  // The file as the last write left it, ahead of the render that says so.
  const latestFile = useRef(file);
  latestFile.current = file;
  // File > Revert To > Browse All Versions…, and what Previous Save goes back to.
  const [browsing, setBrowsing] = useState(false);
  const [previousSave, setPreviousSave] = useState<KeptVersion | undefined>();
  // The Open panel, with the folder it shows first.
  const [openFrom, setOpenFrom] = useState<string | null>(null);
  const [scripts, setScripts] = useState<ScriptList>({ status: "idle", list: [] });
  const [library, setLibrary] = useState<string | null>(null);
  const libraryAsked = useRef(false);
  const [saving, setSaving] = useState<SaveSheet | null>(null);
  // The bundle list the Open panel adds a file to.
  const [addingTo, setAddingTo] = useState<"resources" | "scripts" | null>(null);
  const changeBundleFiles = (list: "resources" | "scripts", files: readonly BundleFile[]) => {
    setBundleInfo((info) => ({ ...info, [list]: files }));
    markChanged();
  };
  const sheetIds = useRef(0);
  // The sheet showing now, by id: a save's Open or close goes ahead only while its sheet is.
  const activeSheet = useRef<number | null>(null);
  useEffect(() => {
    activeSheet.current = saving?.id ?? null;
  }, [saving]);
  // A save in flight: one at a time, however often the sheet's form is submitted.
  const saveInFlight = useRef(false);
  const openSheet = (sheet: Omit<SaveSheet, "id">) => {
    sheetIds.current += 1;
    setSaving({ ...sheet, id: sheetIds.current });
  };
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const shownTitle = savedTitle ?? title;
  // Whether the script in the view changed since it was last opened or saved, and a count of
  // every change of the document (typing, opening): a reply that comes back after the person
  // went on changes nothing it does not belong to.
  const [unsaved, setUnsaved] = useState(false);
  const docVersion = useRef(0);
  // Numbers each Open: only the newest one's reply is put in the view.
  const openTicket = useRef(0);
  const recents = useRecentScripts();

  const [wrapLines] = useDesktopSetting(SCRIPT_EDITOR_SETTINGS.wrapLines, readBoolean, false);
  const [wrapIndent] = useDesktopSetting(SCRIPT_EDITOR_SETTINGS.wrapIndent, readWrapIndent, 0);
  const [formatting] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.formatting,
    readFormatting,
    NO_FORMATTING,
  );
  const [assistant] = useDesktopSetting(SCRIPT_EDITOR_SETTINGS.assistant, readBoolean, true);
  const [escapeCompletes] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.escapeCompletes,
    readBoolean,
    false,
  );
  const [ruler, setRuler] = useDesktopSetting(SCRIPT_EDITOR_SETTINGS.ruler, readBoolean, false);
  const [hiddenTools, setHiddenTools] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.hiddenTools,
    readHiddenTools,
    NO_HIDDEN_TOOLS,
  );
  const toolHidden = (tool: ScriptEditorTool) => hiddenTools.includes(tool);
  const [customizingToolbar, setCustomizingToolbar] = useState(false);
  const [tabWidth] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.tabWidth,
    readTabWidth,
    DEFAULT_TAB_WIDTH,
  );
  const scriptStyle = useMemo(
    () => ({
      ...SCRIPT_FONT,
      ...(tabWidth === DEFAULT_TAB_WIDTH ? undefined : { tabSize: `${tabWidth}px` }),
      ...(wrapLines && wrapIndent > 0
        ? ({ "--mac-script-editor-wrap-indent": `${wrapIndent}px` } as CSSProperties)
        : undefined),
      ...formattingStyle(formatting),
    }),
    [tabWidth, wrapLines, wrapIndent, formatting],
  );
  const rulerMarkers = useMemo<RulerMarker[]>(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        type: "left",
        position: (index + 1) * tabWidth,
      })),
    [tabWidth],
  );
  const lines = useMemo(() => styleScript(source, language), [source, language]);
  const compiledHandlers = useMemo(() => handlersOf(source, language), [source, language]);
  // The handlers of what is in the view since it was edited; null while it is as rendered.
  const [typedHandlers, setTypedHandlers] = useState<ReturnType<typeof handlersOf> | null>(null);
  const handlers = typedHandlers ?? compiledHandlers;

  // AppKit's Font menu, as Script Editor has it: Show Fonts, Bold, Italic, Underline, Bigger,
  // Smaller and Show Colors, from its key equivalents, the desktop's menu bar and the two
  // panels. They act on the text view last used, the Description or the script; a compilation
  // sets the script in AppleScript's formatting styles again, as Script Editor does.
  const [format, setFormat] = useState<RichTextFormat>();
  // Typing runs as Undo steps in every engine (Firefox otherwise joins them): src/lib/rich-text.ts.
  useEffect(() => keepTypingRuns(), []);
  const [fontsShown, setFontsShown] = useState(false);
  const [colorsShown, setColorsShown] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState<CopiedStyle | null>(null);
  const [direction, setDirection] = useState<NotesDirection>("natural");
  const styled = useRef<HTMLElement | null>(null);
  const keepers = useRef(new Map<HTMLElement, RichTextSelectionKeeper>());
  /** The view `node` takes styles: its selection is kept for the menus and the panels. */
  const styleable = useCallback((node: HTMLElement) => {
    keepers.current.set(node, keepRichTextSelection(node));
    return () => {
      keepers.current.get(node)?.dispose();
      keepers.current.delete(node);
      if (styled.current === node) styled.current = null;
    };
  }, []);
  // The two views' refs, stable so that a render does not take an element's selection away.
  const scriptRef = useCallback(
    (node: HTMLDivElement | null) => {
      script.current = node;
      if (!node) return;
      const release = styleable(node);
      return () => {
        release();
        script.current = null;
      };
    },
    [styleable],
  );
  const initialDescription = useRef(defaultDescription);
  const descriptionRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      // The text as it was left, or the given text a line at a time.
      const html = descriptionHtml.current;
      const text = initialDescription.current;
      if (html !== null) {
        node.replaceChildren(richTextFromHtml(html, node.ownerDocument, DESCRIPTION_HTML));
      } else if (text !== "") {
        node.replaceChildren(
          ...text.split("\n").map((line) => {
            const block = node.ownerDocument.createElement("div");
            block.append(line === "" ? node.ownerDocument.createElement("br") : line);
            return block;
          }),
        );
      }
      return styleable(node);
    },
    [styleable],
  );
  /** Read the format where the insertion point is, in whichever of the views holds it. */
  const follow = useCallback(() => {
    const selection = document.getSelection();
    if (!selection?.rangeCount) return;
    const at = selection.getRangeAt(0).commonAncestorContainer;
    for (const node of keepers.current.keys()) {
      if (!node.contains(at)) continue;
      styled.current = node;
      setFormat(readRichTextFormat(node));
      setDirection(directionAt(node, at));
      return;
    }
  }, []);
  useEffect(() => {
    document.addEventListener("selectionchange", follow);
    return () => document.removeEventListener("selectionchange", follow);
  }, [follow]);
  /** The view a command acts on, with the keyboard and its selection given back. */
  const target = () => {
    const node = styled.current;
    if (!node?.isConnected) return null;
    const selection = node.ownerDocument.getSelection();
    const inside =
      node.ownerDocument.activeElement === node &&
      !!selection?.rangeCount &&
      node.contains(selection.getRangeAt(0).commonAncestorContainer);
    if (!inside) keepers.current.get(node)?.restore();
    return node;
  };
  /** The browser changed the view's text: its owner hears it as after typing. */
  const changed = (node: HTMLElement) => {
    node.dispatchEvent(new Event("input", { bubbles: true }));
    follow();
  };
  const fontCommand = (command: RichTextCommand) => {
    if (command === "show-fonts") return setFontsShown((shown) => !shown);
    if (command === "show-colors") return setColorsShown((shown) => !shown);
    const node = target();
    if (!node) return;
    runRichTextCommand(node, command);
    changed(node);
  };
  const applyFormat = (change: Partial<RichTextFormat>) => {
    // Read before target(), which gives the view the keyboard back when a panel control has it.
    const back = styled.current?.ownerDocument.activeElement ?? null;
    const node = target();
    if (!node) return;
    applyRichTextFormat(node, change);
    // The browser selects what the change made: keep that selection now, before a Fonts or
    // Colors panel control takes the keyboard back, so that the control's next change (the next
    // digit typed in a value field, the slider moved again) acts on the same text.
    keepers.current.get(node)?.restore();
    changed(node);
    if (
      back instanceof HTMLElement &&
      back !== node &&
      back.closest(".mac-font-panel, .mac-color-panel")
    ) {
      back.focus({ preventScroll: true });
    }
  };
  // A Fonts or Colors panel that holds the keyboard (a control in it is given it back after each
  // change it makes) leaves the keyboard on the page when it closes, where Script Editor's key
  // equivalents never arrive. As a document does in macOS, the view takes it back, with its
  // selection.
  const panelsWere = useRef({ fonts: false, colors: false });
  useLayoutEffect(() => {
    const were = panelsWere.current;
    panelsWere.current = { fonts: fontsShown, colors: colorsShown };
    if (!((were.fonts && !fontsShown) || (were.colors && !colorsShown))) return;
    const node = styled.current;
    if (!node?.isConnected) return;
    const active = node.ownerDocument.activeElement;
    if (active && active !== node.ownerDocument.body && active.isConnected) return;
    keepers.current.get(node)?.restore();
  }, [fontsShown, colorsShown]);
  /** Font's rows past the browser's commands, on the characters of the selection. */
  const fontExtra = (command: TextEditExtraCommand) => {
    const node = target();
    if (!node) return;
    if (command === "copy-style") {
      setCopiedStyle(copyStyle(node));
      return;
    }
    if (command === "show-styles") {
      const selection = node.ownerDocument.getSelection();
      openSheet({
        step: "styles",
        name: "",
        busy: false,
        node,
        styles: documentStyles(node),
        canApply:
          !!selection?.rangeCount &&
          !selection.isCollapsed &&
          node.contains(selection.getRangeAt(0).commonAncestorContainer),
      });
      return;
    }
    const styles = command === "paste-style" ? copiedStyle : stylesOf(command, node);
    if (styles) styleSelection(node, styles);
    changed(node);
  };
  /** Format > Text > Writing Direction, on the lines of the selection. */
  const writingDirection = (next: NotesDirection) => {
    const node = target();
    const selection = node?.ownerDocument.getSelection();
    if (!node || !selection?.rangeCount) return;
    if (setLineDirection(node, next, selection.getRangeAt(0))) changed(node);
  };
  /** Format > Make Plain Text, once answered: the text of the view, with none of its styles. */
  const makePlain = (node: HTMLElement) => {
    const lines = readScript(node).split("\n");
    node.replaceChildren(
      ...lines.map((line) => {
        const block = node.ownerDocument.createElement("div");
        if (node === script.current) block.className = "mac-script-editor-line";
        block.append(line === "" ? node.ownerDocument.createElement("br") : line);
        return block;
      }),
    );
    changed(node);
  };
  const runFont = useRef(fontCommand);
  const runAskPlain = useRef(() => {});
  runAskPlain.current = () => {
    const node = target();
    if (node) openSheet({ step: "plain", name: "", busy: false, node });
  };
  runFont.current = fontCommand;
  const runExtra = useRef(fontExtra);
  runExtra.current = fontExtra;
  const runDirection = useRef(writingDirection);
  runDirection.current = writingDirection;
  const canPasteStyle = copiedStyle !== null;
  const fontItems = useMemo(
    () => (
      <ScriptEditorFontItems
        format={format}
        canPasteStyle={canPasteStyle}
        onCommand={(name) => runFont.current(name)}
        onExtra={(name) => runExtra.current(name)}
      />
    ),
    [format, canPasteStyle],
  );
  useDesktopAppMenu("script-editor", "Font", fontItems, titleBar);
  // AppKit's Format menu: the same Font submenu, and the Text submenu's four alignments.
  const desktopFormatMenu = useMemo(
    () => (
      <ScriptEditorFormatItems
        format={format}
        fontItems={fontItems}
        direction={direction}
        ruler={ruler}
        onToggleRuler={() => setRuler(!ruler)}
        onMakePlain={() => runAskPlain.current()}
        onCommand={(name) => runFont.current(name)}
        onDirection={(next) => runDirection.current(next)}
      />
    ),
    [format, fontItems, direction, ruler, setRuler],
  );
  useDesktopAppMenu("script-editor", "Format", desktopFormatMenu, titleBar);
  // The editors' Edit menu (`EditorEditItems`, as Notes, TextEdit, Stickies and Mail have it):
  // Undo, Redo, Cut, Copy, Paste and Select All on the text last in use, the script or the
  // Description, which takes the keyboard and its selection back. Paste keeps the clipboard's
  // formats in either; in the script they last until it next compiles, and nothing reads them to run it.
  const latestEdit = useRef<() => EditMenuTarget | null>(() => null);
  latestEdit.current = () => {
    const node = styled.current ?? script.current;
    return node
      ? {
          element: node,
          restore: () => {
            const keeper = keepers.current.get(node);
            if (keeper) keeper.restore();
            else node.focus({ preventScroll: true });
          },
          editable: true,
          rich: true,
        }
      : null;
  };
  // Edit > Spelling and Substitutions. Substitutions act in the Description only: a curly quote or
  // a long dash typed in the script would be a syntax error, and the script's text area says so to
  // Keyboard's text replacements too (`data-text-replacement`).
  const [spelling, setSpelling] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.spelling,
    readBoolean,
    false,
  );
  const [substitutions, setSubstitutions] = useTextSubstitutions("scriptEditor");
  const latestSubstitutions = useRef(substitutions);
  latestSubstitutions.current = substitutions;
  const [spellingShown, setSpellingShown] = useState(false);
  const [substitutionsShown, setSubstitutionsShown] = useState(false);
  const [ignoredWords] = useState(() => new Set<string>());
  const { learned: learnedWords } = useLearnedWords();
  const latestLearned = useRef(learnedWords);
  latestLearned.current = learnedWords;
  const pasted = useRef("");
  const pasteStart = useRef<ReturnType<typeof pasteEdges>>(undefined);
  const toolTarget = useCallback(() => latestEdit.current()?.element ?? null, []);
  const descriptionView = useCallback(
    () => [...keepers.current.keys()].find((node) => node !== script.current) ?? null,
    [],
  );
  const checkSpelling = useCallback(
    () => checkDocumentAfterMenu(toolTarget, () => [...latestLearned.current, ...ignoredWords]),
    [toolTarget, ignoredWords],
  );
  const editTools = useMemo(
    () => (
      <>
        <SpellingItems
          disabled={false}
          whileTyping={spelling}
          onToggleWhileTyping={() => setSpelling(!spelling)}
          onShow={() => setSpellingShown(true)}
          onCheckNow={checkSpelling}
        />
        <SubstitutionItems
          disabled={false}
          settings={substitutions}
          onChange={setSubstitutions}
          onShow={() => {
            setSubstitutionsShown(true);
            latestCommand.current("description");
          }}
        />
      </>
    ),
    [spelling, setSpelling, checkSpelling, substitutions, setSubstitutions],
  );
  const canComplete = assistant && saving === null && openFrom === null;
  // Edit > Paste Reply: the last run's result, at the insertion point in the script.
  const insertInScript = (text: string) => {
    const node = script.current;
    if (!node) return;
    styled.current = node;
    keepers.current.get(node)?.restore();
    node.ownerDocument.execCommand("insertText", false, text);
  };
  const latestPasteReply = useRef(() => {});
  latestPasteReply.current = () => insertInScript(result);
  const insertSnippet = (code: string) => {
    const node = script.current;
    if (!node) return;
    keepers.current.get(node)?.restore();
    const selection = node.ownerDocument.getSelection();
    const inside =
      !!selection?.rangeCount && node.contains(selection.getRangeAt(0).commonAncestorContainer);
    insertInScript(fillSnippet(code, inside ? selection.toString() : ""));
  };
  // Edit > Complete: the words that finish the one before the insertion point.
  const [completing, setCompleting] = useState<Completing | null>(null);
  const dictionaryRead = useRef<ScriptDictionary | null>(null);
  const insertCompletion = (word: string, item: string) => {
    const node = script.current;
    const selection = node?.ownerDocument.getSelection();
    setCompleting(null);
    if (!node || !selection?.rangeCount) return;
    const end = selection.getRangeAt(0);
    selection.removeAllRanges();
    selection.addRange(rangeBack(node, end.endContainer, end.endOffset, word.length));
    node.ownerDocument.execCommand("insertText", false, item);
  };
  const complete = async () => {
    const node = script.current;
    if (!node) return;
    if (!dictionaryRead.current && server) {
      dictionaryRead.current = await server.dictionary().catch(() => null);
    }
    if (!node.isConnected) return;
    if (node.ownerDocument.activeElement !== node) keepers.current.get(node)?.restore();
    const selection = node.ownerDocument.getSelection();
    if (!selection?.rangeCount) return;
    const caret = selection.getRangeAt(0);
    if (!node.contains(caret.endContainer)) return;
    const before = node.ownerDocument.createRange();
    before.selectNodeContents(node);
    before.setEnd(caret.endContainer, caret.endOffset);
    const holder = node.ownerDocument.createElement("div");
    holder.append(before.cloneContents());
    const word = wordBefore(viewLines(holder).at(-1)?.text ?? "");
    const items = completionsOf(word, language, readScript(node), dictionaryRead.current);
    const [first] = items;
    if (first === undefined) return;
    if (items.length === 1) {
      insertCompletion(word, first);
      return;
    }
    const box = caret.getBoundingClientRect?.();
    setCompleting({ items, index: 0, word, left: box?.left ?? 0, top: box?.bottom ?? 0 });
  };
  const desktopEditMenu = useMemo(
    () => (
      <>
        <EditorEditItems target={() => latestEdit.current()} />
        <ScriptEditorEditExtras
          canPasteReply={result !== ""}
          onPasteReply={() => latestPasteReply.current()}
          canComplete={canComplete}
          onComplete={() => latestCommand.current("complete")}
        />
        <EditorMoreItems
          target={() => latestEdit.current()}
          find={() => latestFind.current}
          replace
          beforeFind={editTools}
        />
      </>
    ),
    [editTools, result, canComplete],
  );
  useDesktopAppMenu("script-editor", "Edit", desktopEditMenu, titleBar);
  useDesktopAppMenu("script-editor", "Help", HELP_ITEMS, titleBar);
  const find = useTextFind(() => script.current, `${revision}\n${docVersion.current}`);
  const latestFind = useRef(find);
  latestFind.current = find;

  // The unsaved script of this window is kept among the person's desktop values, a moment after
  // each change, and taken back when the window opens again.
  const windowSlot = titleBar
    ?.closest("[data-window-id]")
    ?.getAttribute("data-window-id")
    ?.split(":")[1];
  const draftName = draftKey(windowSlot);
  const storedDraft = useStoredDraft(draftName);
  const [draftTooLong, setDraftTooLong] = useState(false);
  const draftHeld = useRef(false);
  const draftTaken = useRef(false);
  /** What the Description and the bundle fields hold, when it is more than they start with. */
  const scriptInfo = (): ScriptInfo => ({
    ...(descriptionHtml.current ? { description: descriptionHtml.current } : undefined),
    ...(bundleInfo !== DEFAULT_BUNDLE ? { bundle: bundleInfo } : undefined),
  });
  // Written at each change: the settings' store sends the latest when it can, and a page that
  // leaves first hands it on to the next one.
  const writeDraft = useRef(() => {});
  writeDraft.current = () => {
    if (!server) return;
    setDraftTooLong(
      !keepDraft(draftName, {
        code: script.current ? readScript(script.current) : source,
        language,
        title: savedTitle,
        file,
        ...scriptInfo(),
      }),
    );
  };
  const dropDraft = useCallback(() => {
    setDraftTooLong(false);
    if (draftHeld.current) forgetDraft(draftName);
    draftHeld.current = false;
  }, [draftName]);
  useEffect(() => {
    if (!server || !titleBar || !storedDraft || draftTaken.current || docVersion.current !== 0)
      return;
    draftTaken.current = true;
    openTicket.current += 1;
    docVersion.current += 1;
    setSource(storedDraft.code);
    setLanguage(storedDraft.language);
    setSavedTitle(storedDraft.title);
    setFile(storedDraft.file);
    if (storedDraft.description !== undefined) descriptionHtml.current = storedDraft.description;
    if (storedDraft.bundle) setBundleInfo(storedDraft.bundle);
    setRevision((count) => count + 1);
    setEdited(true);
    setUnsaved(true);
    setTypedHandlers(null);
    setElement(null);
  }, [server, titleBar, storedDraft]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: what the draft holds besides the typed text
  useEffect(() => {
    if (unsaved) {
      draftHeld.current = true;
      writeDraft.current();
    } else dropDraft();
  }, [unsaved, source, language, savedTitle, file, bundleInfo, dropDraft]);

  /** Reads the dictionary for the Library view, once; again after a read that failed. */
  const loadLibrary = () => {
    if (!server || libraryAsked.current) return;
    libraryAsked.current = true;
    setLibrary("Loading the dictionary…");
    server.dictionary().then(
      (dictionary) => setLibrary(libraryText(dictionary)),
      (error: unknown) => {
        libraryAsked.current = false;
        setLibrary(`Error: The dictionary could not be read. ${messageOf(error)}`);
      },
    );
  };

  // A compilation renders the view anew: a command from the keys or the menu leaves the keyboard
  // where it was in the script, and the script scrolled as it was.
  const pendingCaret = useRef<{ line: number; fromEnd: number; scrollTop: number } | null>(null);
  // The line a run refused, selected once the compilation before it is on the screen.
  const pendingLine = useRef<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after each new rendering of the view
  useLayoutEffect(() => {
    const pending = pendingCaret.current;
    pendingCaret.current = null;
    const node = script.current;
    if (pending && node) {
      placeCaret(node, pending);
      node.scrollTop = pending.scrollTop;
    }
    const line = pendingLine.current;
    pendingLine.current = null;
    if (line !== null) selectLine(line);
  }, [revision]);
  const keepingCaret = (compiles: () => void) => {
    const node = script.current;
    if (node && styled.current === node) {
      latestEdit.current()?.restore();
      const place = caretPlace(node);
      if (place) pendingCaret.current = { ...place, scrollTop: node.scrollTop };
    }
    compiles();
    if (pendingCaret.current) whenMenusClosed(document, () => latestEdit.current()?.restore());
  };

  const show = (next: ScriptEditorView) => {
    setOwnView(next);
    setAccessory(true);
    if (next === "library") loadLibrary();
    onViewChange?.(next);
  };

  /** Compiles what the view holds. Returns the compiled script, or null after an error. */
  const compileScript = (): string | null => {
    const written = script.current ? readScript(script.current) : source;
    const compiled = compile(written, language);
    if (!compiled.ok) {
      // The script stays as it was typed; the error is the result, and its line is selected.
      pendingCaret.current = null;
      setResult(compiled.error);
      show("result");
      selectLine(errorLine(written, language, compiled.error));
      return null;
    }
    setSource(compiled.source);
    setRevision((count) => count + 1);
    setEdited(false);
    // Compiling rewrote the script: what a file holds, or a save under way sends, is not this.
    if (compiled.source !== written) {
      docVersion.current += 1;
      setUnsaved(true);
    }
    setTypedHandlers(null);
    setElement(null);
    onCompile?.(compiled.source);
    return compiled.source;
  };

  // A script in another language shows nothing of its own when it compiles, so Compile says it passed.
  const compileButton = () => {
    if (compileScript() !== null && language !== "AppleScript") {
      setResult(`Compiled: this ${language} script has no syntax errors.`);
      show("result");
    }
  };

  const runScript = async () => {
    if (runningNow.current) return;
    const compiled = compileScript();
    if (compiled === null) return;
    // What the server runs. An AppleScript that tells an application is translated first, and one
    // it can't translate is not run at all.
    let remote = language === "AppleScript" ? null : compiled;
    if (server && language === "AppleScript" && tellsApplication(compiled)) {
      const translated = translateAppleScript(compiled);
      if (!translated.ok) {
        pendingLine.current = translated.line;
        const error = `Error: ${translated.error}`;
        setResult(error);
        noteRun({ script: shownTitle, language, result: error, failed: true, log: [] });
        show("result");
        return;
      }
      remote = translated.code;
    }
    // Only AppleScript is worked out here. A script in another language is not read as
    // AppleScript: the result says that it was not run, unless a server runs it.
    if (remote !== null) {
      if (!server) {
        setResult(`Error: A script in ${language} is not run on this page, only AppleScript.`);
        show("result");
        return;
      }
      runningNow.current = true;
      setRunning(true);
      // The script this run is for: another opened meanwhile is not given its answer.
      const ticket = openTicket.current;
      let outcome: RunResult;
      try {
        outcome = await server.run(remote);
      } catch (error) {
        outcome = { result: `Error: ${messageOf(error)}`, failed: true, log: [] };
      } finally {
        runningNow.current = false;
        setRunning(false);
      }
      if (ticket !== openTicket.current) {
        setLog((entries) => [
          ...entries,
          "(*A run of the script opened before finished after another script was opened.*)",
        ]);
        return;
      }
      setResult(outcome.result);
      setLog((entries) => [...entries, ...outcome.log]);
      noteRun({
        script: shownTitle,
        language,
        result: outcome.result,
        failed: outcome.failed,
        log: outcome.log,
      });
      show("result");
      if (!outcome.failed) onRun?.(outcome.result);
      return;
    }
    const outcome = run(compiled);
    setResult(
      server
        ? outcome.result === ""
          ? APPLESCRIPT_NOTE
          : `${outcome.result}\n${APPLESCRIPT_NOTE}`
        : outcome.result,
    );
    setLog((entries) => [...entries, ...outcome.log]);
    if (server) {
      noteRun({
        script: shownTitle,
        language,
        result: outcome.result,
        failed: outcome.failed,
        log: outcome.log,
      });
    }
    show("result");
    if (!outcome.failed) onRun?.(outcome.result);
  };

  /** The script as it is in the view now. */
  const currentScript = () => (script.current ? readScript(script.current) : source);

  const loadScripts = () => {
    if (!server) return;
    setScripts((now) => ({ ...now, status: "loading", error: undefined }));
    server.scripts().then(
      (list) => setScripts({ status: "ready", list }),
      (error: unknown) => setScripts({ status: "failed", list: [], error: messageOf(error) }),
    );
  };

  /**
   * Puts a saved script in the view, in JavaScript, with its name as the window's title. Over
   * unsaved changes it asks first (`discard` is the answer). A reply that a later Open has
   * overtaken, or that comes back after the person typed in the view, is not put in it.
   */
  const openScript = async (entry: Pick<SavedScript, "id" | "name">, discard = false) => {
    if (!server) return;
    if (unsaved && !discard) {
      openSheet({
        step: "discard",
        name: shownTitle,
        busy: false,
        pending: { path: "", size: 0, modified: null, ...entry },
      });
      return;
    }
    openTicket.current += 1;
    const ticket = openTicket.current;
    const at = docVersion.current;
    try {
      const text = await server.open(entry.id);
      // The version its next save is made from, only if it is the version of these bytes. Without
      // one the next save asks for a name.
      const found = await server.fileHolding(entry.id, text).catch(() => null);
      if (ticket !== openTicket.current) return;
      if (docVersion.current !== at) {
        setResult(
          `The script “${scriptName(entry.name)}” was not opened: the script in the window changed while it loaded.`,
        );
        show("result");
        return;
      }
      docVersion.current += 1;
      const { code, info: held } = readFileText(text);
      const info = held ?? readOlderScriptInfo(entry.id);
      descriptionHtml.current = info.description ?? "";
      setBundleInfo(info.bundle ?? DEFAULT_BUNDLE);
      setSource(code);
      setLanguage("JavaScript");
      setRevision((count) => count + 1);
      setEdited(false);
      setUnsaved(false);
      setTypedHandlers(null);
      setElement(null);
      setSavedTitle(scriptName(entry.name));
      setFile(found ?? { id: entry.id, name: entry.name });
      noteRecentScript({ id: entry.id, name: entry.name });
    } catch (error) {
      if (ticket !== openTicket.current) return;
      forgetRecentScript(entry.id);
      setResult(
        `Error: The script “${scriptName(entry.name)}” could not be opened. ${messageOf(error)}`,
      );
      show("result");
    }
  };

  /**
   * Saves the script under the sheet's name. A name in use is asked about first (the server
   * would otherwise save under the next free name); `replace` is the answer. The script saved is
   * the one in the view when Save was pressed; the window is marked saved, and takes the name,
   * only if it still shows that script when the save comes back.
   */
  const saveScript = async (replace: boolean) => {
    if (!server || !saving || saving.busy || saveInFlight.current) return;
    const name = scriptName(saving.name.trim());
    if (name === "") return;
    const sheet = saving.id;
    // What waits on the save: a script to open, or the window to close.
    const then = { pending: saving.pending, close: saving.close };
    // Changes only the sheet this save started from: one cancelled, or replaced by another,
    // is left alone.
    const update = (change: (now: SaveSheet) => SaveSheet | null) =>
      setSaving((now) => (now?.id === sheet ? change(now) : now));
    const at = docVersion.current;
    const ticket = openTicket.current;
    const text = fileText(currentScript(), scriptInfo());
    saveInFlight.current = true;
    setSaving({ ...saving, name, busy: true, error: undefined });
    try {
      if (!replace) {
        // When the list cannot be read the server still never overwrites a script: it picks a
        // free name.
        const list = await server.scripts().catch(() => []);
        if (list.some((entry) => scriptName(entry.name) === name)) {
          update(() => ({ id: sheet, step: "replace", name, busy: false, ...then }));
          return;
        }
      }
      const saved = await server.save(name, text, replace);
      // Inside the save, so that no other save can begin before this one's file is known.
      const found = await server.fileHolding(saved.id, text).catch(() => null);
      // Cancelled or replaced while the save was under way: the script is saved, but the Open
      // or close it was for is not carried out.
      const stillAsked = activeSheet.current === sheet;
      update(() => null);
      forgetOlderScriptInfo(saved.id);
      const unchanged = docVersion.current === at;
      if (ticket === openTicket.current) {
        // The same script, typed on or not: it is this file now, and what was typed stays unsaved.
        setSavedTitle(scriptName(saved.path));
        const fileName = saved.path.split("/").pop() ?? saved.path;
        setFile(found ?? { id: saved.id, name: fileName });
        noteRecentScript({ id: saved.id, name: fileName });
      }
      if (unchanged) {
        setEdited(false);
        setUnsaved(false);
        // Now, not by the effect on `unsaved`: closing the window below can take the effect with it.
        dropDraft();
      }
      setLog((entries) => [...entries, `(*Saved as ${saved.path}.*)`]);
      // The Open or close the save was for goes ahead, unless the script changed meanwhile.
      if (unchanged && stillAsked && then.pending) void openScript(then.pending, true);
      else if (unchanged && stillAsked && then.close) onClose?.(then.close);
    } catch (error) {
      update(() => ({
        id: sheet,
        step: "name",
        name,
        busy: false,
        error: messageOf(error),
        ...then,
      }));
    } finally {
      saveInFlight.current = false;
    }
  };

  /** The close button, served: over unsaved changes it asks first, as Open does. */
  const closeWindow = (event: MouseEvent<HTMLElement>) => {
    if (unsaved) openSheet({ step: "discard", name: shownTitle, busy: false, close: event });
    else onClose?.(event);
  };

  /**
   * File > Save: into the file the script is, asking for a name only when it has none, or when the
   * file cannot take it (saved over elsewhere, gone). Answers whether it was written.
   */
  /** File > Save: over the file the script already has. */
  const saveInPlace = async (): Promise<boolean> => {
    if (!server || saveInFlight.current) return false;
    if (!file) {
      openSheet({ step: "name", name: shownTitle, busy: false });
      return false;
    }
    const at = docVersion.current;
    const ticket = openTicket.current;
    saveInFlight.current = true;
    try {
      const written = await server.write(file, fileText(currentScript(), scriptInfo()));
      latestFile.current = written;
      if (written.version !== undefined) {
        // Only marks the version, so a quick next save does not thin it away: the save is done.
        void server.versions?.keep(written.id, written.version).catch(() => undefined);
      }
      forgetOlderScriptInfo(written.id);
      if (ticket === openTicket.current) setFile(written);
      if (docVersion.current === at) {
        setEdited(false);
        setUnsaved(false);
      }
      setLog((entries) => [...entries, `(*Saved ${written.name}.*)`]);
      return true;
    } catch (error) {
      if (ticket === openTicket.current) {
        openSheet({ step: "name", name: shownTitle, busy: false, error: messageOf(error) });
      }
      return false;
    } finally {
      saveInFlight.current = false;
    }
  };

  /**
   * File > Revert To > Previous Save, and Restore in Browse All Versions: the window's changes are
   * saved first, so they are what the restore keeps as a version, then the drive makes the version
   * the file's bytes and the window opens them. The drive keeps everything, so nothing is asked.
   */
  const restoreKept = async (version: number) => {
    setBrowsing(false);
    const versions = server?.versions;
    if (!versions) return;
    if (unsaved && !(await saveInPlace())) return;
    const target = latestFile.current;
    if (!target) return;
    try {
      await versions.restore(target.id, version, target.version);
      await openScript(target, true);
    } catch (error) {
      setResult(
        `Error: The version of “${scriptName(target.name)}” could not be restored. ${messageOf(error)}`,
      );
      show("result");
    }
  };

  useEffect(() => {
    setPreviousSave(undefined);
    const versions = server?.versions;
    if (!versions || !file) return;
    let live = true;
    versions.list(file.id).then(
      (kept) => {
        if (live) setPreviousSave(previousSaveOf(kept, file.version));
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [server, file]);

  /**
   * File > Duplicate: an unsaved copy of the script takes the window, as in TextEdit, once the
   * changes to the script it copies are in its file.
   */
  const duplicate = async () => {
    const ticket = openTicket.current;
    if (file && unsaved && !(await saveInPlace())) return;
    // Another script opened while the save was under way: that one is not the one to copy.
    if (ticket !== openTicket.current) return;
    openTicket.current += 1;
    docVersion.current += 1;
    setSource(currentScript());
    setRevision((count) => count + 1);
    setSavedTitle(`${shownTitle} copy`);
    setFile(null);
    setEdited(true);
    setUnsaved(true);
    setTypedHandlers(null);
    setElement(null);
  };

  /** File > New from Template: this window's script becomes an unsaved copy of the template. */
  const applyTemplate = (name: string) => {
    const template = SCRIPT_TEMPLATES.find((each) => each.name === name);
    if (!template || unsaved) return;
    openTicket.current += 1;
    docVersion.current += 1;
    descriptionHtml.current = "";
    setSource(template.code);
    setLanguage("JavaScript");
    setRevision((count) => count + 1);
    setSavedTitle("Untitled");
    setFile(null);
    setEdited(true);
    setUnsaved(true);
    setTypedHandlers(null);
    setElement(null);
  };

  /** File > Export…: a new file beside the saved scripts; the window keeps its own file. */
  const exportScript = async () => {
    if (!server || !saving || saving.busy) return;
    const name = scriptName(saving.name.trim());
    if (name === "") return;
    const sheet = saving.id;
    const extension = saving.format === "text" ? "txt" : "js";
    const code = currentScript();
    const asBundle = saving.format === "bundle";
    setSaving((now) => (now?.id === sheet ? { ...now, busy: true, error: undefined } : now));
    try {
      const made = asBundle
        ? await server.exportBundle(name, {
            code,
            description: descriptionHtml.current ?? "",
            info: bundleInfo,
          })
        : await server.exportCopy(
            `${name}.${extension}`,
            saving.format === "text" ? code : fileText(code, scriptInfo()),
          );
      setSaving((now) => (now?.id === sheet ? null : now));
      setLog((entries) => [...entries, `(*Exported ${made.name}.*)`]);
      show("log");
    } catch (error) {
      setSaving((now) =>
        now?.id === sheet ? { ...now, busy: false, error: messageOf(error) } : now,
      );
    }
  };

  /** Rename and Move To: the sheet's change to the file, whose name the window then shows. */
  const changeFile = async (change: (target: ScriptFile) => Promise<ScriptFile>) => {
    if (!file || !saving || saving.busy) return;
    const sheet = saving.id;
    const ticket = openTicket.current;
    setSaving({ ...saving, busy: true, error: undefined });
    try {
      const next = await change(file);
      setSaving((now) => (now?.id === sheet ? null : now));
      noteRecentScript({ id: next.id, name: next.name });
      if (ticket !== openTicket.current) return;
      // A name or a folder is no new version of the bytes: the window keeps the version it holds.
      setFile((now) => (now?.id === next.id ? { ...next, version: now.version } : now));
      setSavedTitle(scriptName(next.name));
    } catch (error) {
      const message = messageOf(error);
      setSaving((now) => (now?.id === sheet ? { ...now, busy: false, error: message } : now));
    }
  };

  const askMove = () => {
    if (!server) return;
    sheetIds.current += 1;
    const id = sheetIds.current;
    setSaving({ id, step: "move", name: shownTitle, busy: false });
    const update = (change: Partial<SaveSheet>) =>
      setSaving((now) => (now?.id === id ? { ...now, ...change } : now));
    server.folders().then(
      (folders) => update({ folders, folder: file?.parent ?? folders[0]?.id }),
      (error: unknown) => update({ folders: [], error: messageOf(error) }),
    );
  };

  const askOpen = () => {
    if (!server) return;
    server.scriptsFolder().then(setOpenFrom, () => setOpenFrom("documents"));
  };

  /** File > Open Dictionary…: asks which app, from what the server says a script can tell. */
  const askDictionary = () => {
    if (!server) return;
    sheetIds.current += 1;
    const id = sheetIds.current;
    setSaving({ id, step: "dictionary", name: "", busy: false });
    const update = (change: Partial<SaveSheet>) =>
      setSaving((now) => (now?.id === id ? { ...now, ...change } : now));
    server.dictionary().then(
      (dictionary) => {
        const apps = dictionaryApps(dictionary);
        update({ apps, name: apps[0] ?? "" });
      },
      (error: unknown) => update({ apps: [], error: messageOf(error) }),
    );
  };

  const recordedAny = useRef(false);
  const startRecording = () => {
    recordedAny.current = false;
    setRecording(true);
    setLog((entries) => [
      ...entries,
      DesktopWindow
        ? "(*Recording started. Bringing another application forward, showing a folder in Finder and setting the appearance to Light or Dark write lines here. What is done inside other applications is not reported to Script Editor.*)"
        : "(*Recording started. Nothing on this page can be recorded.*)",
    ]);
  };
  const recordAction = (action: RecordedAction) => {
    recordedAny.current = true;
    openTicket.current += 1;
    docVersion.current += 1;
    setSource(withRecorded(currentScript(), action, language));
    setRevision((count) => count + 1);
    setEdited(true);
    setUnsaved(true);
  };
  const stopRecording = () => {
    setRecording(false);
    setLog((entries) => [...entries, "(*Recording stopped.*)"]);
    if (recordedAny.current) compileScript();
  };

  const modal = saving !== null || openFrom !== null || addingTo !== null || browsing;
  const hasFile = file !== null;
  const hasVersions = server?.versions !== undefined;
  const hasPreviousSave = previousSave !== undefined;
  const hasWindows = DesktopWindow !== undefined;
  const enabled = useMemo<Record<ScriptEditorCommand, boolean>>(() => {
    const served = hasServer && !modal;
    return {
      "customize-toolbar": !modal,
      open: served,
      dictionary: served && hasWindows,
      save: served,
      duplicate: served,
      rename: served && hasFile,
      move: served && hasFile,
      revert: served && hasFile && unsaved,
      "previous-save": served && hasFile && hasPreviousSave,
      "browse-versions": served && hasFile && hasVersions,
      export: served,
      print: !modal,
      record: !modal && !recording && !running,
      stop: !modal && recording && !running,
      run: !modal && !recording && !running,
      compile: !modal && !recording,
      bundle: !modal,
      accessory: !modal,
      description: !modal,
      result: !modal,
      log: !modal,
      library: hasServer && hasWindows,
      history: hasServer && hasWindows,
      complete: !modal && assistant,
    };
  }, [
    hasServer,
    hasWindows,
    modal,
    hasFile,
    hasVersions,
    hasPreviousSave,
    unsaved,
    recording,
    running,
    assistant,
  ]);
  const perform = (command: ScriptEditorCommand) => {
    if (!enabled[command]) return;
    switch (command) {
      case "open":
        return askOpen();
      case "dictionary":
        return askDictionary();
      case "library":
        return showLibraryWindow();
      case "history":
        return showHistoryWindow();
      case "complete":
        return void complete();
      case "save":
        return void saveInPlace();
      case "duplicate":
        return void duplicate();
      case "rename":
        return openSheet({ step: "rename", name: file?.name ?? shownTitle, busy: false });
      case "move":
        return askMove();
      case "revert":
        return file ? void openScript(file, true) : undefined;
      case "previous-save":
        return previousSave ? void restoreKept(previousSave.version) : undefined;
      case "browse-versions":
        return setBrowsing(true);
      case "export":
        return openSheet({ step: "export", name: shownTitle, busy: false, format: "script" });
      case "print": {
        const node = script.current;
        return printDocument({
          name: shownTitle,
          lines: currentScript().split("\n"),
          plain: !node,
          html: node ? printedScript(node) : undefined,
        });
      }
      case "record":
        return startRecording();
      case "stop":
        return stopRecording();
      case "run":
        return keepingCaret(() => void runScript());
      case "compile":
        return keepingCaret(compileButton);
      case "bundle":
        return setBundle((shown) => !shown);
      case "customize-toolbar":
        setCustomizingToolbar(true);
        break;
      case "accessory":
        return setAccessory((shown) => !shown);
      default:
        return show(command);
    }
  };
  const latestCommand = useRef(perform);
  latestCommand.current = perform;
  const runCommand = useCallback(
    (command: ScriptEditorCommand) => latestCommand.current(command),
    [],
  );
  const latestOpen = useRef(openScript);
  latestOpen.current = openScript;
  // A script Finder or the Dock tile asks to open, or one dropped on the window, opens as File >
  // Open's does, one after the other, each answering for unsaved changes.
  const [wanted, setWanted] = useState<readonly Pick<SavedScript, "id" | "name">[]>([]);
  useEffect(() => {
    if (!hasServer) return;
    const asked = takeOpenFileRequests("script-editor");
    if (asked.length > 0) {
      setWanted((queue) => [...queue, ...asked.map(({ id, name }) => ({ id, name }))]);
    }
    return onOpenFileRequest("script-editor", ({ id, name }) =>
      setWanted((queue) => [...queue, { id, name }]),
    );
  }, [hasServer]);
  // After the effect that takes the window's draft, in the commit that knows the window: by the
  // render this sets off, a draft taken has made the window unsaved, and an open asks about it.
  const [windowKnown, setWindowKnown] = useState(false);
  useEffect(() => {
    if (titleBar) setWindowKnown(true);
  }, [titleBar]);
  useEffect(() => {
    const [next, ...rest] = wanted;
    if (!next || !windowKnown || modal) return;
    setWanted(rest);
    void latestOpen.current(next);
  }, [wanted, windowKnown, modal]);
  const openDrop = useDesktopDrop<Element>({
    enabled: hasServer,
    accepts: (item) => item.kind === "file" && !item.bytes && isScriptFile(item),
    onDrop: (items) =>
      setWanted((queue) => [...queue, ...items.map(({ id, name }) => ({ id, name }))]),
    refusal: () => "Script Editor opens JavaScript scripts (.js).",
  });
  useEffect(() => {
    const root = titleBar?.closest(".mac-window");
    return root ? openDrop(root) : undefined;
  }, [titleBar, openDrop]);
  /** A drop on the script: the path of each item goes in where it was let go. */
  const insertPaths = async (items: readonly DesktopDragItem[], at?: { x: number; y: number }) => {
    const node = script.current;
    if (!node) return;
    const place = at ? rangeAtPoint(node.ownerDocument, at) : null;
    const text = await drivePaths(items);
    if (!node.isConnected) return;
    node.focus({ preventScroll: true });
    if (place && node.contains(place.startContainer)) {
      const selection = node.ownerDocument.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(place);
    } else keepers.current.get(node)?.restore();
    node.ownerDocument.execCommand("insertText", false, text);
  };
  const pathDrop = useDesktopDrop<HTMLDivElement>({
    enabled: hasServer,
    accepts: (item) => !item.bytes,
    onDrop: (items, drag) => void insertPaths(items, drag.at),
    refusal: () => "Only what is on your drive has a path to put in the script.",
  });
  // File > Share: the text in the window, as a file of the script's name.
  const shareBytes = useRef(() => new Blob());
  shareBytes.current = () => new Blob([currentScript()], { type: "text/javascript" });
  const shareItems = useMemo<readonly DesktopDragItem[]>(
    () => [
      {
        id: `script-editor-share:${shownTitle}`,
        name: file?.name ?? `${shownTitle}.js`,
        kind: "file",
        type: "text/javascript",
        bytes: async () => shareBytes.current(),
      },
    ],
    [file?.name, shownTitle],
  );
  const latestTemplate = useRef(applyTemplate);
  latestTemplate.current = applyTemplate;
  const desktopFileMenu = useMemo(
    () =>
      hasServer ? (
        <ScriptEditorFileItems
          enabled={enabled}
          onCommand={runCommand}
          recents={recents}
          onOpenRecent={(entry: RecentScript) => void latestOpen.current(entry)}
          onClearRecents={clearRecentScripts}
          saved={hasFile}
          templates={SCRIPT_TEMPLATES}
          canUseTemplate={!modal && !unsaved}
          onTemplate={(name) => latestTemplate.current(name)}
          shareItems={shareItems}
          previousSave={previousSave ? versionDate(previousSave.modifiedMs) : undefined}
        />
      ) : null,
    [hasServer, enabled, runCommand, recents, hasFile, modal, unsaved, shareItems, previousSave],
  );
  useDesktopAppMenu("script-editor", "File", desktopFileMenu, titleBar);
  const desktopScriptMenu = useMemo(
    () => <ScriptEditorScriptItems enabled={enabled} onCommand={runCommand} running={running} />,
    [enabled, runCommand, running],
  );
  useDesktopAppMenu("script-editor", "Script", desktopScriptMenu, titleBar);
  const desktopViewMenu = useMemo(
    () => (
      <ScriptEditorViewItems
        tabs={tabs}
        enabled={enabled}
        onCommand={runCommand}
        bundle={bundle}
        accessory={accessory}
        view={view}
      />
    ),
    [enabled, runCommand, bundle, accessory, view, tabs],
  );
  useDesktopAppMenu("script-editor", "View", desktopViewMenu, titleBar);
  const desktopWindowMenu = useMemo(
    () =>
      hasWindows ? (
        <>
          <ScriptEditorWindowItems enabled={enabled} onCommand={runCommand} />
          {tabs ? <DocumentTabWindowItems tabs={tabs} /> : null}
        </>
      ) : null,
    [hasWindows, enabled, runCommand, tabs],
  );
  useDesktopAppMenu("script-editor", "Window", desktopWindowMenu, titleBar);

  // The key equivalents arrive in the window's onKeyDown while the keyboard is in the window. As in
  // macOS the key window answers them too with the keyboard on the page itself or in the menu bar
  // (a compilation or a closed sheet leaves it there). A command that is dimmed now still takes its
  // key: Command-R during a run must not reload the page.
  const answerKey = (event: KeyboardEvent) => {
    if (tabs && answerTabKey(tabs, event)) return true;
    const finding = FIND_KEYS.find(([keys]) => matchesMenuKeyEquivalent(event, keys))?.[1];
    if (finding) {
      finding(latestFind.current);
      return true;
    }
    if (matchesMenuKeyEquivalent(event, "shift+command+;")) {
      setSpellingShown(true);
      return true;
    }
    if (matchesMenuKeyEquivalent(event, "command+;")) {
      checkSpelling();
      return true;
    }
    if (matchesMenuKeyEquivalent(event, "option+command+c")) {
      fontExtra("copy-style");
      return true;
    }
    if (matchesMenuKeyEquivalent(event, "option+command+v")) {
      fontExtra("paste-style");
      return true;
    }
    const command = commandOfKey(event);
    if (!command || (FILE_COMMANDS.has(command) && !hasServer)) return false;
    perform(command);
    return true;
  };
  const latestKey = useRef(answerKey);
  latestKey.current = answerKey;
  const isKeyWindow = useRef(true);
  isKeyWindow.current = (windowProps.state ?? "key") === "key";
  useEffect(() => {
    const onPageKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !isKeyWindow.current) return;
      const { target } = event;
      const onPage = target === document.body || target === document.documentElement;
      if (!onPage && !(target instanceof Element && target.closest('[role="menubar"]'))) return;
      if (latestKey.current(event)) event.preventDefault();
    };
    document.addEventListener("keydown", onPageKeyDown);
    return () => document.removeEventListener("keydown", onPageKeyDown);
  }, []);

  /**
   * Selects the line of a handler in the script view and brings it into view. The line is
   * found as the script is read, so it is the handler's however the browser keeps the lines.
   */
  const reveal = (name: string | null) => {
    setElement(name);
    const handler = handlers.find((candidate) => candidate.name === name);
    if (handler) selectLine(handler.line);
  };
  function selectLine(index: number | null) {
    const view = script.current;
    const line = view && index !== null ? viewLines(view)[index] : undefined;
    if (!view || !line) return;
    const range = view.ownerDocument.createRange();
    range.setStart(...line.start);
    range.setEnd(...line.end);
    const selection = view.ownerDocument.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    // The view scrolls by the line's own rectangle, so that a line in bare text, which has no
    // element of its own, is brought into view as well. Only as far as it takes ("nearest").
    const box = range.getBoundingClientRect?.();
    if (!box || (box.width === 0 && box.height === 0)) return;
    const frame = view.getBoundingClientRect();
    const left = frame.left + view.clientLeft;
    const top = frame.top + view.clientTop;
    const nearest = (start: number, end: number, from: number, to: number) =>
      start < from ? start - from : end > to ? Math.min(start - from, end - to) : 0;
    view.scrollTop += nearest(box.top, box.bottom, top, top + view.clientHeight);
    view.scrollLeft += nearest(box.left, box.right, left, left + view.clientWidth);
  }

  const viewTitle = VIEWS.find((candidate) => candidate.id === view)?.title ?? "";

  return (
    <>
      <Window
        width={width}
        height={height}
        {...windowProps}
        onKeyDown={(event) => {
          windowProps.onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (answerKey(event.nativeEvent)) {
            event.preventDefault();
            return;
          }
          const command = richTextKeyCommand(event.nativeEvent);
          if (!command) return;
          const panel = command === "show-fonts" || command === "show-colors";
          const field = [...keepers.current.keys()].find((node) =>
            node.contains(event.target as Node),
          );
          if (!panel && !field) return;
          event.preventDefault();
          if (field) styled.current = field;
          fontCommand(command);
        }}
      >
        {DesktopWindow ? <DesktopWindowName title={shownTitle} /> : null}
        {DesktopWindow && recording ? <DesktopRecorder onAction={recordAction} /> : null}
        <TitleBar
          ref={setTitleBar}
          variant="unified"
          title={shownTitle}
          controls={
            <WindowControls
              edited={edited}
              onClose={onClose && server ? closeWindow : onClose}
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
          <Toolbar aria-label="Toolbar" className="mac-script-editor-toolbar">
            {toolHidden("record") ? null : (
              <ToolbarButton
                aria-label="Record"
                className="mac-script-editor-tool"
                disabled={recording || running}
                onClick={startRecording}
              >
                <RecordGlyph />
              </ToolbarButton>
            )}
            {toolHidden("stop") ? null : (
              <ToolbarButton
                aria-label="Stop"
                className="mac-script-editor-tool"
                disabled={!recording || running}
                title={running ? NO_STOP_REASON : undefined}
                onClick={stopRecording}
              >
                <StopGlyph />
              </ToolbarButton>
            )}
            {toolHidden("run") ? null : (
              <ToolbarButton
                aria-label="Run"
                className="mac-script-editor-tool"
                disabled={recording || running}
                onClick={() => void runScript()}
              >
                <RunGlyph />
              </ToolbarButton>
            )}
            {toolHidden("compile") ? null : (
              <ToolbarButton
                aria-label="Compile"
                className="mac-script-editor-tool"
                disabled={recording}
                onClick={compileButton}
              >
                <CompileGlyph />
              </ToolbarButton>
            )}
            {toolHidden("panes") ? null : (
              <ToolbarSegmentedControl
                tracking="momentary"
                aria-label="Panes"
                className="mac-script-editor-panes"
              >
                <ToolbarSegment
                  aria-label="Accessory view"
                  aria-pressed={accessory}
                  className="mac-script-editor-pane-toggle"
                  onClick={() => setAccessory((shown) => !shown)}
                >
                  <BottomPaneGlyph />
                </ToolbarSegment>
                <ToolbarSegment
                  aria-label="Bundle contents"
                  aria-pressed={bundle}
                  className="mac-script-editor-pane-toggle"
                  onClick={() => setBundle((shown) => !shown)}
                >
                  <SidePaneGlyph />
                </ToolbarSegment>
              </ToolbarSegmentedControl>
            )}
          </Toolbar>
        </TitleBar>
        {tabs ? <DocumentTabBar tabs={tabs} /> : null}
        {tabs ? <DocumentTabOverview tabs={tabs} /> : null}
        <ScriptEditorCustomizeToolbar
          open={customizingToolbar}
          anchor={titleBar}
          hidden={hiddenTools}
          onChange={setHiddenTools}
          onDone={() => setCustomizingToolbar(false)}
        />
        <WindowBody className="mac-script-editor-body">
          {draftTooLong ? (
            <WindowBanner role="status">
              This script is too long to keep across a reload. Save it to keep your changes.
            </WindowBanner>
          ) : null}
          <SplitView className="mac-script-editor-split" style={SPLIT_STYLE}>
            <SplitViewPane className="mac-script-editor-column" minSize={240}>
              <div className="mac-script-editor-bar mac-script-editor-navigation">
                <div className="mac-script-editor-navigation-item">
                  <PopUpButton
                    aria-label="Language"
                    size="small"
                    bordered={false}
                    value={language}
                    onValueChange={(value) => {
                      if (!value || value === language) return;
                      // The view is rendered again in the other language's styles, from what
                      // it holds now: what was typed since the last compilation is kept.
                      if (script.current) setSource(readScript(script.current));
                      setLanguage(value as ScriptLanguage);
                      docVersion.current += 1;
                      setEdited(true);
                      setUnsaved(true);
                      setTypedHandlers(null);
                      setRevision((count) => count + 1);
                    }}
                  >
                    {LANGUAGES.map((name) => (
                      <PopUpButtonItem key={name} value={name}>
                        {name}
                      </PopUpButtonItem>
                    ))}
                  </PopUpButton>
                </div>
                <div className="mac-script-editor-navigation-item">
                  <PopUpButton
                    aria-label="Element"
                    size="small"
                    bordered={false}
                    value={element}
                    placeholder="<No selected element>"
                    onValueChange={(value) => reveal(value)}
                  >
                    {handlers.length === 0 ? (
                      <PopUpButtonItem value={null} disabled>
                        No elements
                      </PopUpButtonItem>
                    ) : (
                      handlers.map((handler) => (
                        <PopUpButtonItem key={handler.line} value={handler.name}>
                          {handler.name}
                        </PopUpButtonItem>
                      ))
                    )}
                  </PopUpButton>
                </div>
                {server ? (
                  <>
                    <div className="mac-script-editor-navigation-item">
                      <PullDownButton
                        aria-label="Open Script"
                        title="Open"
                        size="small"
                        bordered={false}
                        onOpenChange={(open) => {
                          if (open) loadScripts();
                        }}
                      >
                        {scripts.status === "ready" && scripts.list.length > 0 ? (
                          scripts.list.map((entry) => (
                            <MenuItem key={entry.id} onClick={() => void openScript(entry)}>
                              {scriptName(entry.name)}
                            </MenuItem>
                          ))
                        ) : (
                          <MenuItem disabled>
                            {scripts.status === "failed"
                              ? `The scripts could not be read. ${scripts.error ?? ""}`
                              : scripts.status === "ready"
                                ? "No Saved Scripts"
                                : "Loading…"}
                          </MenuItem>
                        )}
                      </PullDownButton>
                    </div>
                    <div className="mac-script-editor-navigation-item">
                      <BorderlessButton
                        aria-label="Save Script"
                        onClick={() => openSheet({ step: "name", name: shownTitle, busy: false })}
                      >
                        Save…
                      </BorderlessButton>
                    </div>
                  </>
                ) : null}
              </div>
              <SplitView
                orientation="vertical"
                className="mac-script-editor-split"
                style={SPLIT_STYLE}
              >
                <SplitViewPane className="mac-script-editor-pane" minSize={60}>
                  <FindBar find={find} />
                  {ruler ? (
                    <Ruler
                      className="mac-script-editor-ruler"
                      origin={6.5}
                      markers={rulerMarkers}
                    />
                  ) : null}
                  <ContextualMenu>
                    <ContextualMenuTrigger className="mac-script-editor-menu-area">
                      <div
                        ref={pathDrop}
                        className="mac-script-editor-paper"
                        data-appearance="light"
                      >
                        <RichTextView
                          // Rendered again from the compiled script; between two compilations the
                          // browser owns what is inside.
                          key={revision}
                          ref={scriptRef}
                          aria-label="Script"
                          spellCheck={spelling}
                          data-text-replacement="off"
                          autoCapitalize="off"
                          className="mac-script-editor-script"
                          data-wrap={wrapLines ? "" : undefined}
                          style={scriptStyle}
                          onKeyDown={(event) => {
                            if (completing) {
                              const { key } = event;
                              const move = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
                              if (move !== 0) {
                                event.preventDefault();
                                setCompleting({
                                  ...completing,
                                  index:
                                    (completing.index + move + completing.items.length) %
                                    completing.items.length,
                                });
                                return;
                              }
                              if (key === "Enter" || key === "Tab") {
                                event.preventDefault();
                                insertCompletion(
                                  completing.word,
                                  completing.items[completing.index] ?? "",
                                );
                                return;
                              }
                              if (key === "Escape") {
                                event.preventDefault();
                                setCompleting(null);
                                return;
                              }
                            }
                            if (
                              event.key === "Escape" &&
                              escapeCompletes &&
                              enabled.complete &&
                              !event.altKey &&
                              !event.ctrlKey &&
                              !event.metaKey
                            ) {
                              event.preventDefault();
                              void complete();
                              return;
                            }
                            // A script is indented with tabs; Shift-Tab still leaves the view.
                            if (
                              event.key !== "Tab" ||
                              event.shiftKey ||
                              event.altKey ||
                              event.ctrlKey ||
                              event.metaKey
                            ) {
                              return;
                            }
                            event.preventDefault();
                            event.currentTarget.ownerDocument.execCommand(
                              "insertText",
                              false,
                              "\t",
                            );
                          }}
                          onBlur={() => setCompleting(null)}
                          onInput={(event) => {
                            setCompleting(null);
                            setEdited(true);
                            setUnsaved(true);
                            docVersion.current += 1;
                            writeDraft.current();
                            // The Element pop-up button lists the handlers of what is typed now.
                            setTypedHandlers(handlersOf(readScript(event.currentTarget), language));
                          }}
                        >
                          {lines.map((runs, index) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: the lines of one compilation never move
                            <div key={index} className="mac-script-editor-line">
                              {runs.length === 0 ? (
                                <br />
                              ) : (
                                runs.map((piece, at) =>
                                  piece.style === "plain" || piece.style === "literal" ? (
                                    piece.text
                                  ) : (
                                    <span
                                      // biome-ignore lint/suspicious/noArrayIndexKey: as above
                                      key={at}
                                      className="mac-script-editor-run"
                                      data-style={piece.style}
                                    >
                                      {piece.text}
                                    </span>
                                  ),
                                )
                              )}
                            </div>
                          ))}
                        </RichTextView>
                      </div>
                    </ContextualMenuTrigger>
                    <ContextualMenuPopup aria-label="Script commands">
                      <EditorEditItems target={() => latestEdit.current()} />
                      <EditorMoreItems
                        target={() => latestEdit.current()}
                        find={() => latestFind.current}
                        replace
                        beforeFind={editTools}
                      />
                      <MenuSeparator />
                      <Submenu>
                        <SubmenuTrigger>Font</SubmenuTrigger>
                        <SubmenuPopup aria-label="Font">{fontItems}</SubmenuPopup>
                      </Submenu>
                      <MenuSeparator />
                      {SNIPPETS[language].map((group) => (
                        <Submenu key={group.name}>
                          <SubmenuTrigger>{group.name}</SubmenuTrigger>
                          <SubmenuPopup aria-label={group.name}>
                            {group.snippets.map((snippet) => (
                              <MenuItem
                                key={snippet.name}
                                onClick={() => insertSnippet(snippet.code)}
                              >
                                {snippet.name}
                              </MenuItem>
                            ))}
                          </SubmenuPopup>
                        </Submenu>
                      ))}
                    </ContextualMenuPopup>
                  </ContextualMenu>
                </SplitViewPane>
                {accessory ? (
                  <>
                    <SplitViewDivider aria-label="Resize the accessory view" />
                    <SplitViewPane
                      className="mac-script-editor-pane"
                      defaultSize={187}
                      minSize={60}
                    >
                      <div className="mac-script-editor-bar mac-script-editor-header">
                        {viewTitle}
                        {view === "log" && server ? (
                          <SegmentedControl
                            aria-label="Log shows"
                            size="mini"
                            className="mac-script-editor-log-tabs"
                            value={[logTab]}
                            onValueChange={([tab]) => {
                              if (tab) setLogTab(tab as LogTab);
                            }}
                          >
                            <Segment value="messages">Messages</Segment>
                            <Segment value="events">Events</Segment>
                            <Segment value="replies">Replies</Segment>
                          </SegmentedControl>
                        ) : null}
                      </div>
                      <div className="mac-script-editor-paper" data-appearance="light">
                        {view === "description" ? (
                          <RichTextView
                            key={revision}
                            aria-label="Description"
                            className="mac-script-editor-accessory mac-script-editor-description"
                            ref={descriptionRef}
                            spellCheck={spelling}
                            data-text-replacement={substitutions.replacement ? "on" : "off"}
                            onPaste={(event) => {
                              pasteStart.current = pasteEdges(event.currentTarget);
                              pasted.current = event.clipboardData?.getData("text/plain") ?? "";
                            }}
                            onInput={(event) => {
                              const native = event.nativeEvent as InputEvent;
                              const settings = latestSubstitutions.current;
                              if (native.inputType === "insertText" && !native.isComposing) {
                                substituteTyped(event.currentTarget, native.data, settings, true);
                              }
                              if (native.inputType === "insertFromPaste" && settings.copyPaste) {
                                spaceAfterPaste(
                                  event.currentTarget,
                                  pasted.current,
                                  pasteStart.current,
                                );
                              }
                              descriptionHtml.current = event.currentTarget.innerHTML;
                              markChanged();
                              writeDraft.current();
                            }}
                          />
                        ) : view === "result" ? (
                          <TextView
                            aria-label="Result"
                            className="mac-script-editor-accessory"
                            readOnly
                            value={result}
                            style={SCRIPT_FONT}
                          />
                        ) : view === "library" && server ? (
                          <TextView
                            aria-label="Library"
                            className="mac-script-editor-accessory"
                            readOnly
                            value={library ?? ""}
                            style={SCRIPT_FONT}
                          />
                        ) : (
                          <ContextualMenu>
                            <ContextualMenuTrigger className="mac-script-editor-menu-area">
                              <TextView
                                ref={logView}
                                aria-label="Log"
                                className="mac-script-editor-accessory"
                                readOnly
                                value={logText}
                                style={SCRIPT_FONT}
                              />
                            </ContextualMenuTrigger>
                            <ContextualMenuPopup aria-label="Log commands">
                              <MenuItem
                                disabled={logText === ""}
                                onClick={() => {
                                  const area = logView.current;
                                  const chosen = area?.value.slice(
                                    area.selectionStart,
                                    area.selectionEnd,
                                  );
                                  void copyText(chosen || logText);
                                }}
                              >
                                Copy
                              </MenuItem>
                            </ContextualMenuPopup>
                          </ContextualMenu>
                        )}
                      </div>
                    </SplitViewPane>
                  </>
                ) : null}
              </SplitView>
            </SplitViewPane>
            {bundle ? (
              <>
                <SplitViewDivider aria-label="Resize the bundle contents" />
                <SplitViewPane
                  className="mac-script-editor-bundle"
                  defaultSize={220}
                  minSize={160}
                  maxSize={360}
                >
                  <div className="mac-script-editor-bar mac-script-editor-header">
                    Bundle Contents
                  </div>
                  <Form
                    size="small"
                    className="mac-script-editor-bundle-form"
                    onSubmit={(event) => event.preventDefault()}
                  >
                    <FormRow label="Name:">
                      <TextField size="small" {...bundleField("name")} />
                    </FormRow>
                    <FormRow label="Identifier:">
                      <TextField size="small" {...bundleField("identifier")} />
                    </FormRow>
                    <FormRow label="Version:">
                      <TextField size="small" {...bundleField("version")} />
                    </FormRow>
                    <FormRow label="Copyright:">
                      <TextField size="small" {...bundleField("copyright")} />
                    </FormRow>
                  </Form>
                  {server ? (
                    <>
                      <BundleList
                        title="Resources"
                        files={bundleInfo.resources ?? NO_BUNDLE_FILES}
                        onAsk={() => setAddingTo("resources")}
                        onChange={(files) => changeBundleFiles("resources", files)}
                      />
                      <BundleList
                        title="Scripts"
                        files={bundleInfo.scripts ?? NO_BUNDLE_FILES}
                        onAsk={() => setAddingTo("scripts")}
                        onChange={(files) => changeBundleFiles("scripts", files)}
                      />
                    </>
                  ) : null}
                </SplitViewPane>
              </>
            ) : null}
          </SplitView>
        </WindowBody>
        <StatusBar
          variant="flat"
          leading={
            // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset
            <div role="group" aria-label="Accessory views" className="mac-script-editor-views">
              <ImageButton
                aria-label="Description"
                aria-current={accessory && view === "description"}
                className="mac-script-editor-view"
                style={VIEW_STYLE}
                onClick={() => show("description")}
              >
                <DescriptionGlyph />
              </ImageButton>
              <ImageButton
                aria-label="Result"
                aria-current={accessory && view === "result"}
                className="mac-script-editor-view"
                style={VIEW_STYLE}
                onClick={() => show("result")}
              >
                <ResultGlyph />
              </ImageButton>
              <ImageButton
                aria-label="Log"
                aria-current={accessory && view === "log"}
                className="mac-script-editor-view"
                style={VIEW_STYLE}
                onClick={() => show("log")}
              >
                <LogGlyph />
              </ImageButton>
              {server ? (
                <ImageButton
                  aria-label="Library"
                  aria-current={accessory && view === "library"}
                  className="mac-script-editor-view"
                  style={VIEW_STYLE}
                  onClick={() => show("library")}
                >
                  <LibraryGlyph />
                </ImageButton>
              ) : null}
            </div>
          }
        />
        {browsing && file ? (
          <DesktopVersionsSheet
            file={file}
            current={currentScript()}
            anchor={titleBar}
            classPrefix="mac-script-editor"
            readPage={(bytes) => readFileText(new TextDecoder().decode(bytes)).code}
            renderPage={(text, label) => (
              <div className="mac-script-editor-version-page" role="document" aria-label={label}>
                {text}
              </div>
            )}
            onRestore={(version) => void restoreKept(version.version)}
            onDone={() => setBrowsing(false)}
          />
        ) : null}
        {server ? (
          <Sheet
            open={saving !== null}
            onOpenChange={(open) => {
              if (!open) setSaving(null);
            }}
          >
            <SheetPopup anchor={titleBar} width={420}>
              {saving?.step === "styles" ? (
                <TextEditStyles
                  styles={saving.styles ?? []}
                  canApply={saving.canApply === true}
                  onCancel={() => setSaving(null)}
                  onApply={(style) => {
                    const { node } = saving;
                    setSaving(null);
                    if (!node) return;
                    keepers.current.get(node)?.restore();
                    styleSelection(node, style);
                    changed(node);
                  }}
                />
              ) : saving?.step === "plain" ? (
                <>
                  <SheetTitle>Convert this text to plain text?</SheetTitle>
                  <SheetDescription>
                    Making it plain text removes all its formatting. A script gets its styles back
                    when it next compiles.
                  </SheetDescription>
                  <SheetActions>
                    <SheetClose>Cancel</SheetClose>
                    <DefaultButton
                      onClick={() => {
                        const { node } = saving;
                        setSaving(null);
                        if (node?.isConnected) makePlain(node);
                      }}
                    >
                      OK
                    </DefaultButton>
                  </SheetActions>
                </>
              ) : saving?.step === "dictionary" ? (
                <>
                  <SheetTitle>Open Dictionary</SheetTitle>
                  <SheetDescription>
                    {saving.error
                      ? `The dictionary could not be read. ${saving.error}`
                      : "Choose an application to see what a script can ask of it."}
                  </SheetDescription>
                  <Form size="small" onSubmit={(event) => event.preventDefault()}>
                    <FormRow label="Application:">
                      <PopUpButton
                        size="small"
                        aria-label="Application"
                        value={saving.name || null}
                        placeholder="Loading…"
                        onValueChange={(app) => {
                          if (app) setSaving((now) => (now ? { ...now, name: app } : now));
                        }}
                      >
                        {(saving.apps ?? []).map((app) => (
                          <PopUpButtonItem key={app} value={app}>
                            {appName(app)}
                          </PopUpButtonItem>
                        ))}
                      </PopUpButton>
                    </FormRow>
                  </Form>
                  <SheetActions>
                    <SheetClose>Cancel</SheetClose>
                    <DefaultButton
                      disabled={saving.name === ""}
                      onClick={() => {
                        const app = saving.name;
                        setSaving(null);
                        showDictionaryWindow(app);
                      }}
                    >
                      Choose
                    </DefaultButton>
                  </SheetActions>
                </>
              ) : saving?.step === "discard" ? (
                <>
                  <SheetTitle>
                    Do you want to keep the changes you made to “{saving.name}”?
                  </SheetTitle>
                  <SheetDescription>
                    {saving.close
                      ? "Closing the window discards them."
                      : `Opening “${scriptName(saving.pending?.name ?? "")}” replaces the script in the window.`}{" "}
                    Your changes are lost if you don’t save them.
                  </SheetDescription>
                  <SheetActions>
                    <SheetClose>Cancel</SheetClose>
                    <PushButton
                      onClick={() => {
                        const { pending, close } = saving;
                        setSaving(null);
                        if (pending) void openScript(pending, true);
                        else if (close) {
                          dropDraft();
                          onClose?.(close);
                        }
                      }}
                    >
                      Don’t Save
                    </PushButton>
                    <DefaultButton
                      onClick={() =>
                        openSheet({
                          step: "name",
                          name: shownTitle,
                          busy: false,
                          pending: saving.pending,
                          close: saving.close,
                        })
                      }
                    >
                      Save…
                    </DefaultButton>
                  </SheetActions>
                </>
              ) : saving?.step === "replace" ? (
                <>
                  <SheetTitle>
                    “{saving.name}” already exists. Do you want to replace it?
                  </SheetTitle>
                  <SheetDescription>
                    A script with the same name is in Documents/Scripts. Replacing it overwrites
                    what it holds now.
                  </SheetDescription>
                  <SheetActions>
                    <SheetClose>Cancel</SheetClose>
                    <DefaultButton disabled={saving.busy} onClick={() => void saveScript(true)}>
                      Replace
                    </DefaultButton>
                  </SheetActions>
                </>
              ) : saving?.step === "rename" ? (
                <>
                  <SheetTitle>Rename Script</SheetTitle>
                  <SheetDescription>
                    {saving.error
                      ? `The script could not be renamed. ${saving.error}`
                      : "The script keeps its place on your drive."}
                  </SheetDescription>
                  <Form
                    size="small"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const name = saving.name.trim();
                      if (name) void changeFile((target) => server.rename(target, name));
                    }}
                  >
                    <FormRow label="Name:">
                      <TextField
                        size="small"
                        value={saving.name}
                        disabled={saving.busy}
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setSaving((now) => (now && !now.busy ? { ...now, name: value } : now));
                        }}
                      />
                    </FormRow>
                  </Form>
                  <SheetActions>
                    <SheetClose>Cancel</SheetClose>
                    <DefaultButton
                      disabled={saving.busy || saving.name.trim() === ""}
                      onClick={() =>
                        void changeFile((target) => server.rename(target, saving.name.trim()))
                      }
                    >
                      Rename
                    </DefaultButton>
                  </SheetActions>
                </>
              ) : saving?.step === "move" ? (
                <>
                  <SheetTitle>Move “{saving.name}”</SheetTitle>
                  <SheetDescription>
                    {saving.error
                      ? `The script could not be moved. ${saving.error}`
                      : "Choose a folder of your drive."}
                  </SheetDescription>
                  <Form size="small" onSubmit={(event) => event.preventDefault()}>
                    <FormRow label="Where:">
                      <PopUpButton
                        size="small"
                        value={saving.folder ?? null}
                        placeholder="Loading…"
                        onValueChange={(folder) => {
                          if (!folder) return;
                          setSaving((now) => (now ? { ...now, folder } : now));
                        }}
                      >
                        {(saving.folders ?? []).map((folder) => (
                          <PopUpButtonItem key={folder.id} value={folder.id}>
                            {folder.path}
                          </PopUpButtonItem>
                        ))}
                      </PopUpButton>
                    </FormRow>
                  </Form>
                  <SheetActions>
                    <SheetClose>Cancel</SheetClose>
                    <DefaultButton
                      disabled={saving.busy || !saving.folder || saving.folder === file?.parent}
                      onClick={() => {
                        const { folder } = saving;
                        if (folder) void changeFile((target) => server.move(target, folder));
                      }}
                    >
                      Move
                    </DefaultButton>
                  </SheetActions>
                </>
              ) : saving?.step === "export" ? (
                <>
                  <SheetTitle>Export “{saving.name}”</SheetTitle>
                  <SheetDescription>
                    {saving.error
                      ? `The script could not be exported. ${saving.error}`
                      : "A new file in Documents/Scripts of your drive. This window keeps its own file."}
                  </SheetDescription>
                  <Form size="small" onSubmit={(event) => event.preventDefault()}>
                    <FormRow label="Export As:">
                      <TextField
                        size="small"
                        value={saving.name}
                        disabled={saving.busy}
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setSaving((now) => (now && !now.busy ? { ...now, name: value } : now));
                        }}
                      />
                    </FormRow>
                    <FormRow label="File Format:">
                      <PopUpButton
                        size="small"
                        aria-label="File Format"
                        value={saving.format ?? "script"}
                        onValueChange={(format) => {
                          if (format === "script" || format === "text" || format === "bundle") {
                            setSaving((now) => (now ? { ...now, format } : now));
                          }
                        }}
                      >
                        <PopUpButtonItem value="script">Script (.js)</PopUpButtonItem>
                        <PopUpButtonItem value="bundle">Script Bundle (.scptd)</PopUpButtonItem>
                        <PopUpButtonItem value="application" disabled title={NO_APPLICATION}>
                          Application
                        </PopUpButtonItem>
                        <PopUpButtonItem value="text">Text (.txt)</PopUpButtonItem>
                      </PopUpButton>
                    </FormRow>
                    <FormRow label="Options:">
                      <span title={NO_RUN_ONLY} data-reason={NO_RUN_ONLY}>
                        <Checkbox disabled>Run-only</Checkbox>
                      </span>
                    </FormRow>
                  </Form>
                  <SheetActions>
                    <SheetClose>Cancel</SheetClose>
                    <DefaultButton
                      disabled={saving.busy || saving.name.trim() === ""}
                      onClick={() => void exportScript()}
                    >
                      Export
                    </DefaultButton>
                  </SheetActions>
                </>
              ) : (
                <>
                  <SheetTitle>Save Script</SheetTitle>
                  <SheetDescription>
                    {saving?.error
                      ? `The script could not be saved. ${saving.error}`
                      : "The script is saved in Documents/Scripts of your drive."}
                  </SheetDescription>
                  <Form
                    size="small"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveScript(false);
                    }}
                  >
                    <FormRow label="Save As:">
                      <TextField
                        size="small"
                        value={saving?.name ?? ""}
                        disabled={saving?.busy}
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setSaving((now) => (now && !now.busy ? { ...now, name: value } : now));
                        }}
                      />
                    </FormRow>
                  </Form>
                  <SheetActions>
                    <SheetClose>Cancel</SheetClose>
                    <DefaultButton
                      disabled={!saving || saving.busy || saving.name.trim() === ""}
                      onClick={() => void saveScript(false)}
                    >
                      Save
                    </DefaultButton>
                  </SheetActions>
                </>
              )}
            </SheetPopup>
          </Sheet>
        ) : null}
        {server && openFrom !== null
          ? createPortal(
              <div className="mac-script-editor-panel-layer">
                <DriveOpenPanel
                  accept={(entry) => entry.kind === "file" && /\.js$/i.test(entry.name)}
                  defaultFolder={openFrom}
                  onCancel={() => setOpenFrom(null)}
                  onOpen={(entry) => {
                    setOpenFrom(null);
                    void openScript({ id: entry.id, name: entry.name });
                  }}
                />
              </div>,
              document.body,
            )
          : null}
        {server && addingTo !== null
          ? createPortal(
              <div className="mac-script-editor-panel-layer">
                <DriveOpenPanel
                  accept={(entry) => entry.kind === "file"}
                  defaultFolder="documents"
                  onCancel={() => setAddingTo(null)}
                  onOpen={(entry) => {
                    const list = addingTo;
                    setAddingTo(null);
                    changeBundleFiles(list, [
                      ...(bundleInfo[list] ?? NO_BUNDLE_FILES).filter(
                        (each) => each.id !== entry.id,
                      ),
                      { id: entry.id, name: entry.name },
                    ]);
                  }}
                />
              </div>,
              document.body,
            )
          : null}
        {completing
          ? createPortal(
              <div
                role="listbox"
                aria-label="Completions"
                className="mac-script-editor-completions"
                style={{ left: completing.left, top: completing.top }}
              >
                {completing.items.map((item, index) => (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: the keys are the script view's, which keeps the keyboard
                  <div
                    key={item}
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === completing.index}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertCompletion(completing.word, item)}
                  >
                    {item}
                  </div>
                ))}
              </div>,
              document.body,
            )
          : null}
        {/* The Fonts and Colors panels float over the page; rendered from inside the window,
          their keys still reach it (Command-T closes the Fonts panel from the panel too). */}
        {fontsShown || colorsShown || spellingShown || substitutionsShown
          ? createPortal(
              <div className="mac-script-editor-panels">
                {fontsShown ? (
                  <DesktopFontPanel
                    className="mac-script-editor-panel"
                    families={FONT_FAMILIES}
                    value={format}
                    onFontChange={applyFormat}
                    onClose={() => setFontsShown(false)}
                  />
                ) : null}
                {colorsShown ? (
                  <ColorPanel
                    className="mac-script-editor-panel"
                    value={format?.color ?? "#000000"}
                    onValueChange={(color) => applyFormat({ color })}
                    onClose={() => setColorsShown(false)}
                  />
                ) : null}
                {spellingShown ? (
                  <SpellingPanel
                    className="mac-script-editor-panel"
                    element={toolTarget}
                    editable
                    ignored={ignoredWords}
                    onClose={() => {
                      setSpellingShown(false);
                      latestEdit.current()?.restore();
                    }}
                  />
                ) : null}
                {substitutionsShown ? (
                  <SubstitutionsPanel
                    className="mac-script-editor-panel"
                    element={descriptionView}
                    editable={accessory && view === "description"}
                    settings={substitutions}
                    onChange={setSubstitutions}
                    onClose={() => {
                      setSubstitutionsShown(false);
                      latestEdit.current()?.restore();
                    }}
                  />
                ) : null}
              </div>,
              document.body,
            )
          : null}
      </Window>
      {DesktopWindow && server ? (
        <ScriptEditorAuxWindows server={server} DesktopWindow={DesktopWindow} />
      ) : null}
    </>
  );
}

const NO_BUNDLE_FILES: readonly BundleFile[] = [];

/** The Bundle Contents pane's Resources or Scripts: files of the drive, dropped or added. */
function BundleList({
  title,
  files,
  onAsk,
  onChange,
}: {
  title: string;
  files: readonly BundleFile[];
  onAsk: () => void;
  onChange: (files: readonly BundleFile[]) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const drop = useDesktopDrop<HTMLDivElement>({
    enabled: true,
    accepts: (item) => item.kind === "file" && !item.bytes,
    onDrop: (items) =>
      onChange([
        ...files.filter((file) => !items.some((item) => item.id === file.id)),
        ...items.map(({ id, name }) => ({ id, name })),
      ]),
    refusal: () => "A bundle holds files of your drive.",
  });
  return (
    <div ref={drop} className="mac-script-editor-bundle-list">
      <div className="mac-script-editor-bar mac-script-editor-header">{title}</div>
      <div role="listbox" aria-label={title} className="mac-script-editor-bundle-files">
        {files.map((file) => (
          <div
            key={file.id}
            role="option"
            tabIndex={0}
            aria-selected={file.id === chosen}
            onClick={() => setChosen(file.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setChosen(file.id);
            }}
          >
            {file.name}
          </div>
        ))}
      </div>
      <div className="mac-script-editor-bundle-buttons">
        <GradientButton glyph="add" aria-label={`Add to ${title}`} onClick={onAsk} />
        <GradientButton
          glyph="remove"
          aria-label={`Remove from ${title}`}
          disabled={!files.some((file) => file.id === chosen)}
          onClick={() => onChange(files.filter((file) => file.id !== chosen))}
        />
      </div>
    </div>
  );
}

const HELP_ITEMS = <ScriptEditorHelpItems />;

/** The commands of Script Editor's Font menu, AppKit's standard one, in its order. */
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

/** Format > Text: AppKit's four alignments, in its order. */
const ALIGNMENTS: readonly (readonly [RichTextAlignment, string])[] = [
  ["left", "Align Left"],
  ["center", "Center"],
  ["justify", "Justify"],
  ["right", "Align Right"],
];

/** Format > Text > Writing Direction, in its order. */
const DIRECTIONS: readonly (readonly [NotesDirection, string])[] = [
  ["natural", "Natural"],
  ["ltr", "Left to Right"],
  ["rtl", "Right to Left"],
];

/**
 * Script Editor's Format menu for the desktop's menu bar, AppKit's standard one: the Font
 * submenu, and the Text submenu whose alignment and writing direction at the insertion point are
 * checked. Each item runs its command on the view last used.
 */
function ScriptEditorFormatItems({
  format,
  fontItems,
  direction,
  ruler,
  onToggleRuler,
  onMakePlain,
  onCommand,
  onDirection,
}: {
  format?: RichTextFormat;
  fontItems: ReactNode;
  direction: NotesDirection;
  ruler: boolean;
  onToggleRuler: () => void;
  onMakePlain: () => void;
  onCommand: (command: RichTextCommand) => void;
  onDirection: (direction: NotesDirection) => void;
}) {
  return (
    <>
      <Submenu>
        <SubmenuTrigger>Font</SubmenuTrigger>
        <SubmenuPopup>{fontItems}</SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger>Text</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup
            value={format?.align ?? "left"}
            onValueChange={(align) => onCommand(`align-${align as RichTextAlignment}`)}
          >
            {ALIGNMENTS.map(([value, label]) => (
              <MenuRadioItem
                key={value}
                value={value}
                keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[`align-${value}`]}
              >
                {label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger>Writing Direction</SubmenuTrigger>
            <SubmenuPopup aria-label="Writing Direction">
              <MenuRadioGroup
                value={direction}
                onValueChange={(next) => onDirection(next as NotesDirection)}
              >
                {DIRECTIONS.map(([value, label]) => (
                  <MenuRadioItem key={value} value={value}>
                    {label}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </SubmenuPopup>
          </Submenu>
          <MenuSeparator />
          <MenuItem onClick={onToggleRuler}>{ruler ? "Hide Ruler" : "Show Ruler"}</MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem onClick={onMakePlain}>Make Plain Text</MenuItem>
    </>
  );
}

/**
 * Script Editor's Font menu for the desktop's menu bar: each item runs its command of
 * `macalicious/lib/rich-text` on the view last used, the styles where the insertion point is
 * checked; below them the rows that act on the characters of the selection.
 */
function ScriptEditorFontItems({
  format,
  canPasteStyle,
  onCommand,
  onExtra,
}: {
  format?: RichTextFormat;
  canPasteStyle: boolean;
  onCommand: (command: RichTextCommand) => void;
  onExtra: (command: TextEditExtraCommand) => void;
}) {
  return (
    <>
      {FONT_MENU.map((entry, index) => {
        if (!entry) {
          // biome-ignore lint/suspicious/noArrayIndexKey: the separators of a fixed list
          return <MenuSeparator key={index} />;
        }
        const [command, label] = entry;
        return command === "bold" || command === "italic" || command === "underline" ? (
          <MenuCheckboxItem
            key={command}
            keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[command]}
            checked={format?.[command] ?? false}
            onCheckedChange={() => onCommand(command)}
          >
            {label}
          </MenuCheckboxItem>
        ) : (
          <MenuItem
            key={command}
            keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[command]}
            onClick={() => onCommand(command)}
          >
            {label}
          </MenuItem>
        );
      })}
      <MenuSeparator />
      <TextEditFontExtraItems canPasteStyle={canPasteStyle} onExtra={onExtra} />
    </>
  );
}
