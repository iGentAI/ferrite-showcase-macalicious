"use client";

import { ComboBox, ComboBoxItem } from "macalicious/combo-box";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuRadioGroup, MenuRadioItem } from "macalicious/menu-item";
import { OutlineView, type OutlineViewItem } from "macalicious/outline-view";
import { ScrollView } from "macalicious/scroll-view";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { Slider } from "macalicious/slider";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { SystemImage } from "macalicious/system-image";
import { RichTextView, TextView } from "macalicious/text-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField, ToolbarSearchFieldMenuButton } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type ChangeEvent,
  type CSSProperties,
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { filesOfDrag, useDesktopDrop } from "../desktop/desktop-drag";
import {
  readShown,
  readSize,
  readString,
  useKeptText,
  useKeptValue,
} from "../desktop/desktop-kept-value";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp, useServerState } from "../desktop/desktop-server";
import {
  type OpenFileRequest,
  onOpenFileRequest,
  showInFinder,
  takeOpenFileRequests,
} from "../finder/finder-open";
import { EditorEditItems } from "../notes/notes-edit-menu";
import { whenMenusClosed } from "../notes/notes-menus";
import {
  CollectionContextItems,
  CollectionNameField,
  DeleteCollectionAlert,
  FontContextItems,
  FontNoticeAlert,
  RemoveFontsAlert,
  RestoreFontsAlert,
} from "./font-book-collections";
import {
  allFonts,
  biggerSize,
  CUSTOM_TEXT,
  DEFAULT_SIZE,
  defaultCollections,
  type FontCollection,
  type FontFamily,
  type FontStyle,
  families,
  familiesIn,
  findFont,
  fitSize,
  fontFamily,
  keptListReader,
  languageCollections,
  MAX_SIZE,
  MIN_SIZE,
  postScriptName,
  REMOVED_FOLDER,
  REPERTOIRE_SHOWN,
  repertoireOf,
  SEARCH_SCOPES,
  type SearchScope,
  SIZES,
  sampleOf,
  searchFamilies,
  smallerSize,
  smartCollections,
  windowTitle,
} from "./font-book-data";
import { useFontDrag } from "./font-book-drag";
import {
  driveAvailable,
  exportFontFiles,
  familyNameOf,
  keepFont,
  keptFonts,
  moveKeptFontsAside,
  readKeptFont,
  trashKeptFont,
} from "./font-book-drive";
import {
  FontDuplicatesSheet,
  FontExportSheet,
  FontInstallCheckSheet,
  FontInstallSheet,
  type FontToInstall,
  type FontValidation,
  FontValidationSheet,
  type OpenedFont,
} from "./font-book-file-sheets";
import {
  CollectionGlyph,
  EnableGlyph,
  InsertionPointGlyph,
  LibraryGlyph,
  PrintGlyph,
  RepertoireGlyph,
  SampleGlyph,
  SmartGlyph,
  ValidateGlyph,
} from "./font-book-icons";
import { type FontBookView, useFontBookMenus } from "./font-book-menus";
import { holdFontsOff } from "./font-book-panel-fonts";
import { FONT_BOOK_VALIDATE, readFlag } from "./font-book-preferences";
import { FontPrintSheet, type FontReport, readReport } from "./font-book-print";
import {
  FONT_BOOK_LIBRARY_URL,
  type FontBookLibrary,
  libraryFromServer,
  libraryReadable,
  libraryToServer,
} from "./font-book-server";
import {
  NO_SMART_COLLECTIONS,
  newSmartCollection,
  readSmartCollections,
  type SmartCollection,
  SmartCollectionSheet,
  smartCollectionOf,
} from "./font-book-smart";
import { type FontTables, familyOfFile, isFontFile, readFontTables } from "./font-book-tables";
import {
  DEFAULT_FONT_TOOLS,
  type FontTool,
  FontToolsSheet,
  readFontTools,
} from "./font-book-toolbar";
import {
  type DuplicateFonts,
  duplicateFontFiles,
  validateFontFile,
  validationVerdict,
} from "./font-book-validate";
import "./font-book.tokens.css";
import "./font-book.css";

const VIEWS: readonly {
  value: FontBookView;
  label: string;
  glyph: ReactNode;
  style: CSSProperties;
}[] = [
  // Measured: the control is 135 pt wide, with its dividers 35, 68 and 101 pt from its start.
  { value: "sample", label: "Sample", glyph: <SampleGlyph />, style: { flex: "none", width: 35 } },
  {
    value: "repertoire",
    label: "Repertoire",
    glyph: <RepertoireGlyph />,
    style: { flex: "none", width: 33 },
  },
  {
    value: "custom",
    label: "Custom",
    glyph: (
      <span className="mac-font-book-custom-glyph" aria-hidden="true">
        Aa
        <InsertionPointGlyph />
      </span>
    ),
    style: { flex: "none", width: 33, padding: 0 },
  },
  {
    value: "info",
    label: "Info",
    glyph: <SystemImage name="info" scale={14 / 15} />,
    style: { flex: "none", width: 34 },
  },
];

/** Measured: the two buttons are 50 pt wide and the search field 421 pt. */
const BUTTON: CSSProperties = { width: 50 };
const SEARCH: CSSProperties = { width: 421 };
/**
 * The first button starts 62 pt after the segmented control in the Aqua capture and 17 pt after
 * it in the Dark Aqua one: two 8 pt gaps and this space, whose width is the app's token.
 */
const BUTTON_SPACE: CSSProperties = { width: "var(--mac-font-book-button-space)" };

/** Measured: 18 pt rows, a style 15.5 pt further in than its family. */
const ROW_HEIGHT = 18;
const INDENTATION = 15.5;

/** The split view's hook for the colour of its line, set to the one measured beside the sidebar. */
const SIDEBAR_DIVIDER = {
  "--mac-split-view-divider-color": "var(--mac-font-book-sidebar-divider)",
} as CSSProperties;

/**
 * The sidebar's hooks, set to Font Book's source list: 16 pt glyphs centred 29.5 pt from the
 * edge with the labels at 45 pt, and headers whose baseline is 8.5 pt above their first row,
 * 13 pt under the row before.
 */
const SIDEBAR = {
  "--mac-sidebar-icon-size": "23px",
  "--mac-sidebar-section-gap": "13px",
  "--mac-sidebar-header-inset": "0.5px",
} as CSSProperties;

const ICONS: Record<FontCollection["icon"], ReactNode> = {
  library: <LibraryGlyph />,
  smart: <SmartGlyph />,
  collection: <CollectionGlyph />,
};

/** The font files the Add Fonts button accepts. */
const FONT_FILES = ".ttf,.otf,.woff,.woff2";

/** The family expanded and the style selected in the reference screenshots. */
const SHOWN_FAMILY = "zapf-dingbats";
const SHOWN_STYLE = "zapf-dingbats/regular";
/**
 * The item the font list opens on: the library's last family, which is the last row of the
 * list, because the reference screenshots show the list scrolled to its end.
 */
const SHOWN_LAST = families.at(-1)?.id;

/** The most fonts the Sample view sets one under another. */
const SEVERAL_SHOWN = 24;

const NO_IDS: readonly string[] = [];
const readIds = keptListReader<string>((stored) =>
  stored.filter((id): id is string => typeof id === "string"),
);

const NO_FILE = "Not known: this desktop has no file for this font";
const COMPRESSED = "Not readable: this file's tables are compressed";
const NO_LOCATION = "None: this desktop only names this font";

/** The font of a row of the list, from an element in that row. */
const fontAt = (target: EventTarget) =>
  (target as Element).closest("[data-row]")?.querySelector<HTMLElement>("[data-font-id]")?.dataset
    .fontId;

/** The families of a family's row and its style's rows, each once. */
const uniqueFamilies = (fonts: readonly { family: FontFamily }[]) => [
  ...new Set(fonts.map(({ family }) => family)),
];

/** A row of the font list: a family, or one of its styles. */
interface FontItem extends OutlineViewItem {
  name: string;
  /** A family the user disabled: its row says so. */
  off?: boolean;
}

/** A size of the list as a number, if it is within the slider's range. */
function parseSize(text: string): number | undefined {
  const size = Number(text);
  return text.trim() !== "" && size >= MIN_SIZE && size <= MAX_SIZE ? size : undefined;
}

/**
 * Loads a font file and registers it with the page under the family's name, so the family's
 * stack finds it. Resolves to the registered face, or to nothing when the browser cannot read
 * the file as a font.
 */
async function installFont(name: string, file: Blob): Promise<FontFace | undefined> {
  if (typeof FontFace !== "function") return undefined;
  try {
    const face = await new FontFace(name, await file.arrayBuffer()).load();
    document.fonts.add(face);
    return face;
  } catch {
    return undefined;
  }
}

/**
 * View > Fit: the size at which `lines` of a family's text fill the text view that shows them, or
 * nothing where the browser cannot measure text.
 */
function fittedSize(element: HTMLElement, lines: readonly string[], leading: number) {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) return undefined;
  const css = getComputedStyle(element);
  measure.font = `${css.fontStyle} ${css.fontWeight} 100px ${css.fontFamily}`;
  const widest = Math.max(...lines.map((line) => measure.measureText(line).width));
  return fitSize(
    widest,
    lines.length,
    leading,
    element.clientWidth - Number.parseFloat(css.paddingLeft) - Number.parseFloat(css.paddingRight),
    element.clientHeight - Number.parseFloat(css.paddingTop) - Number.parseFloat(css.paddingBottom),
  );
}

/**
 * The CSS of a font at a size: the family's stack and the style's weight, slant and width.
 * The text view's hook for its fill lets the pane's own background show.
 */
function fontCss(family: FontFamily, style: FontStyle, size: number): CSSProperties {
  return {
    "--mac-text-view-background": "transparent",
    fontFamily: family.stack,
    fontWeight: style.weight,
    fontStyle: style.italic ? "italic" : "normal",
    fontStretch: style.stretch,
    fontSize: size,
    lineHeight: family.leading ?? 1.2,
  } as CSSProperties;
}

export interface FontBookProps extends Omit<WindowProps, "children"> {
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
  /**
   * For the title bar, which with its toolbar is this window's drag region: called when the
   * primary pointer button goes down on the bar itself, not on a control in it. A window
   * manager starts moving the window here.
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: called when the bar itself is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

const readView = (stored: unknown) => VIEWS.find(({ value }) => value === stored)?.value;

/**
 * Font Book, as in macOS 10.15 Catalina: the collections in a sidebar, the fonts of the chosen
 * collection in an outline, and a preview of the chosen font in one of four views, at the size
 * a combo box and a slider share.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a page
 * or a window manager places it (`style`, `width`, `height`, `ref`) and tells it whether it is
 * key (`state`); the window controls' and the title bar's callbacks, the eight props a managed
 * window's `render` supplies beside the window's, are handed to those parts.
 *
 * No font is included: a family is previewed in a stack of fonts the browser may have. The
 * collections, the fonts that were added or disabled and the size live in the component's
 * state for as long as it is mounted. Served by the desktop's Ferrite application, the
 * collections and the disabled fonts are kept for the browser's session on the server, and the
 * fonts that were added are kept as files on the person's drive.
 */
export function FontBook({
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1017,
  height = 603,
  className,
  state = "key",
  ...windowProps
}: FontBookProps) {
  const [view, setView] = useKeptValue<FontBookView>("fontBook.view", readView, "sample");
  const [collectionId, setCollectionId] = useKeptValue(
    "fontBook.collection",
    readString,
    allFonts.id,
  );
  const [userCollections, setUserCollections] = useState<readonly FontCollection[]>([]);
  const [userFamilies, setUserFamilies] = useState<readonly FontFamily[]>([]);
  const [disabled, setDisabled] = useState<readonly string[]>([]);
  const [expanded, setExpanded] = useState<readonly (string | number)[]>([SHOWN_FAMILY]);
  const [selected, setSelected] = useState<readonly (string | number)[]>([SHOWN_STYLE]);
  const [renaming, setRenaming] = useState<string | null>(null);
  // The name being edited when a command runs: a command chosen from a menu runs after a wait.
  const renamingNow = useRef(renaming);
  renamingNow.current = renaming;
  const [deleting, setDeleting] = useState<FontCollection | null>(null);
  // The ids on the drive of the added fonts it holds, by family.
  const [kept, setKept] = useState<Readonly<Record<string, string>>>({});
  const [removing, setRemoving] = useState<readonly FontFamily[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The sidebar row under the last secondary click, for its context menu.
  const [menuCollection, setMenuCollection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // What the search looks in, chosen from the menu of the field's magnifier.
  const [scope, setScope] = useState<SearchScope>("all");
  const [size, setSize] = useKeptValue<number>("fontBook.size", readSize, DEFAULT_SIZE);
  // A font Spotlight found: the library, with it selected and in view.
  const [revealed, setRevealed] = useState<string | number | undefined>(SHOWN_LAST);
  useOpenItemRequests("font-book", ({ id }) => {
    setCollectionId(allFonts.id);
    setQuery("");
    setSelected([id]);
    // The outline scrolls when the id changes: asked again for the same one, it must see a change.
    setRevealed(undefined);
    requestAnimationFrame(() => setRevealed(id));
  });
  // The text of the size field while it is being typed; null when it shows the size.
  const [draft, setDraft] = useState<string | null>(null);
  const [custom, setCustom, customTooLong] = useKeptText("fontBook.custom", CUSTOM_TEXT);
  useEffect(() => {
    if (customTooLong) {
      setNotice("This text is too long to keep across a reload; what was last kept stays.");
    }
  }, [customTooLong]);
  const [collectionsShown, setCollectionsShown] = useKeptValue(
    "fontBook.collectionsShown",
    readShown,
    true,
  );
  const [fontsShown, setFontsShown] = useKeptValue("fontBook.fontsShown", readShown, true);
  const [toolbarShown, setToolbarShown] = useKeptValue("fontBook.toolbarShown", readShown, true);
  const [report, setReport] = useKeptValue<FontReport>("fontBook.report", readReport, "catalog");
  const [printing, setPrinting] = useState(false);
  const [ownSmart, setOwnSmart] = useKeptValue<readonly SmartCollection[]>(
    "fontBook.smartCollections",
    readSmartCollections,
    NO_SMART_COLLECTIONS,
  );
  const [editingSmart, setEditingSmart] = useState<SmartCollection | null>(null);
  const [validateFirst] = useDesktopSetting(FONT_BOOK_VALIDATE, readFlag, true);
  const [tools, setTools] = useKeptValue<readonly FontTool[]>(
    "fontBook.toolbarItems",
    readFontTools,
    DEFAULT_FONT_TOOLS,
  );
  const [customizing, setCustomizing] = useState(false);
  // Which of the person's collections are libraries, as File > New Library made them.
  const [libraryIds, setLibraryIds] = useKeptValue("fontBook.libraries", readIds, NO_IDS);
  const [restoring, setRestoring] = useState(false);
  const [toInstall, setToInstall] = useState<readonly FontToInstall[] | null>(null);
  const [opened, setOpened] = useState<OpenedFont | null>(null);
  const openedFace = useRef<FontFace | undefined>(undefined);
  // What each added font's file says of itself, by family.
  const tablesOf = useRef(new Map<string, FontTables | null>());
  const [validation, setValidation] = useState<readonly FontValidation[] | null>(null);
  const [duplicates, setDuplicates] = useState<readonly DuplicateFonts[] | null>(null);
  // The files File > Export Fonts takes, while its sheet is open.
  const [exporting, setExporting] = useState<readonly File[] | null>(null);
  const validateInput = useRef<HTMLInputElement>(null);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const sizeLabel = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const customText = useRef<HTMLTextAreaElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const sidebar = useRef<HTMLDivElement>(null);
  // The view that View > Hide Font Info goes back to.
  const viewBeforeInfo = useRef<FontBookView>("sample");
  // The fonts this window added to the page, by family: the face once it is loaded, and until
  // then a reservation, so that a file chosen again while it loads is not added twice.
  const owned = useRef(new Map<string, FontFace | undefined>());
  const mounted = useRef(true);

  // The files of the fonts added to the page, which a printed report brings along.
  const fontFiles = useRef(new Map<string, File>());
  // The page's fonts outlive the component: a window that closes takes its own with it.
  useEffect(() => {
    const faces = owned.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const face of faces.values()) if (face) document.fonts.delete(face);
      faces.clear();
      if (openedFace.current) document.fonts.delete(openedFace.current);
    };
  }, []);

  // The fonts on the drive come back when the window opens; the window is usable meanwhile.
  useEffect(() => {
    if (!driveAvailable()) return;
    let live = true;
    // Given up with this effect, so the next one is free to load those fonts.
    const reserved = new Set<string>();
    const faces = owned.current;
    const load = async () => {
      for (const { id: file, name: fileName } of await keptFonts()) {
        if (!live) return;
        const { id, name: familyName } = fontFamily(familyNameOf(fileName), "Regular", "sans");
        if (id === "" || faces.has(id) || families.some((existing) => existing.id === id)) continue;
        faces.set(id, undefined);
        reserved.add(id);
        let face: FontFace | undefined;
        let tables: FontTables | null = null;
        try {
          const blob = await readKeptFont(file);
          face = await installFont(familyName, blob);
          tables = await readFontTables(blob);
          fontFiles.current.set(id, new File([blob], fileName, { type: blob.type }));
        } catch {
          // One unreadable file does not keep the others from the window.
          faces.delete(id);
          reserved.delete(id);
          if (live) setNotice(`“${familyName}” on your drive could not be read.`);
          continue;
        }
        if (!live) {
          if (face) document.fonts.delete(face);
          return;
        }
        reserved.delete(id);
        if (!face) {
          faces.delete(id);
          continue;
        }
        faces.set(id, face);
        tablesOf.current.set(id, tables);
        setUserFamilies((current) => [...current, familyOfFile(familyName, tables)]);
        setKept((current) => ({ ...current, [id]: file }));
      }
    };
    load().catch(() => {
      for (const id of reserved) faces.delete(id);
      reserved.clear();
      if (live) setNotice("The fonts on your drive could not be read.");
    });
    return () => {
      live = false;
      for (const id of reserved) faces.delete(id);
      reserved.clear();
    };
  }, []);

  const everyFamily = useMemo(
    () =>
      userFamilies.length === 0
        ? families
        : [...families, ...userFamilies].sort((a, b) => a.name.localeCompare(b.name, "en")),
    [userFamilies],
  );
  const libraries = useMemo<readonly FontCollection[]>(
    () =>
      userCollections
        .filter(({ id }) => libraryIds.includes(id))
        .map((each) => ({ ...each, icon: "library" })),
    [userCollections, libraryIds],
  );
  const collections = [
    ...defaultCollections,
    ...userCollections.filter(({ id }) => !libraryIds.includes(id)),
  ];
  // User and Computer tell apart what was added from what came with the desktop, so they show only
  // once there is something to tell apart; the captures, with no font added, have neither.
  const libraryRows = useMemo<readonly FontCollection[]>(() => {
    if (userFamilies.length === 0 && libraries.length === 0) return [];
    const added = (family: FontFamily) => userFamilies.some(({ id }) => id === family.id);
    return [
      {
        id: "library-computer",
        name: "Computer",
        icon: "library",
        matches: (family) => !added(family),
      },
      { id: "library-user", name: "User", icon: "library", matches: added },
      ...libraries,
    ];
  }, [userFamilies, libraries]);
  const everySmart = useMemo(
    () => [
      ...smartCollections,
      ...languageCollections(typeof navigator === "undefined" ? [] : navigator.languages),
      ...ownSmart.map(smartCollectionOf),
    ],
    [ownSmart],
  );
  const collection =
    [allFonts, ...libraryRows, ...everySmart, ...collections].find(
      ({ id }) => id === collectionId,
    ) ?? allFonts;
  const inCollection = familiesIn(collection, everyFamily);
  const visible = searchFamilies(inCollection, query, scope);
  // The selected fonts the list shows, and else its first family.
  const [firstFamily] = visible;
  const [firstStyle] = firstFamily?.styles ?? [];
  const found = selected.flatMap((id) => {
    const font = findFont(id, visible);
    return font ? [{ id, ...font }] : [];
  });
  const shown =
    found.at(-1) ??
    (firstFamily && firstStyle ? { family: firstFamily, style: firstStyle } : undefined);
  // The very list the outline gave, while it all shows: the outline tells a range's start by it.
  const selection =
    found.length === selected.length
      ? selected
      : found.length > 0
        ? found.map(({ id }) => id)
        : firstFamily
          ? [firstFamily.id]
          : [];
  const severalFonts = found.length > 1;
  // A selection emptied by Command-click acts on nothing; the preview still shows the first font.
  const selectedFamilies = uniqueFamilies(
    found.length > 0 ? found : selected.length > 0 && shown ? [shown] : [],
  );
  const name = shown ? `${shown.family.name} ${shown.style.name}` : "";
  // A font the system needs stays enabled, and one that is not downloaded stays off.
  const toggleable = selectedFamilies.filter((family) => !family.required && family.available);
  const allOff = toggleable.length > 0 && toggleable.every(({ id }) => disabled.includes(id));
  const canToggle = toggleable.length > 0;
  const verb = allOff ? "Enable" : "Disable";
  const familyWord =
    selectedFamilies.length > 1
      ? `${selectedFamilies.length} Families`
      : `“${shown?.family.name ?? ""}”`;
  const enableTitle = !shown
    ? "Disable Family"
    : selectedFamilies.length > 1
      ? `${verb} ${familyWord}`
      : `${verb} ${familyWord} Family`;
  const ownCollection = (id: string | null) =>
    userCollections.find((candidate) => candidate.id === id);
  const smartOwn = (id: string | null) => ownSmart.find((candidate) => candidate.id === id);
  const inOwnSmart = smartOwn(collection.id);
  const inOwn = ownCollection(collection.id);
  // Only a font the person added can go, once its file is on the drive where there is one.
  const removable = (family: FontFamily) =>
    userFamilies.some(({ id }) => id === family.id) &&
    (!driveAvailable() || kept[family.id] !== undefined);
  const canRemove =
    selectedFamilies.length > 0 && (inOwn !== undefined || selectedFamilies.every(removable));
  const removeTitle = inOwn
    ? `Remove ${familyWord} from “${inOwn.name}”`
    : selectedFamilies.length > 1
      ? `Remove ${familyWord}`
      : `Remove ${familyWord} Family`;

  const items = useMemo<FontItem[]>(
    () =>
      visible.map((family) => {
        const dimmed = !family.available || disabled.includes(family.id);
        return {
          id: family.id,
          name: family.name,
          dimmed,
          off: disabled.includes(family.id),
          children: family.styles.map((style) => ({ id: style.id, name: style.name, dimmed })),
        };
      }),
    [visible, disabled],
  );

  /** Start editing a collection's name, keeping what was typed for the one being edited. */
  const beginRename = (id: string) => {
    const editing = renamingNow.current;
    if (editing !== null && editing !== id && nameInput.current) {
      renameCollection(editing, nameInput.current.value);
    }
    setRenaming(id);
  };

  /**
   * Edit a name once a menu that chose it has given the keyboard back: `whenMenusClosed` calls again
   * after the frame in which that happens, and a field shown before it would lose the keyboard.
   */
  const renameAfterMenus = (id: string) => {
    let calls = 0;
    whenMenusClosed(document, () => {
      calls += 1;
      if (calls === 2) beginRename(id);
    });
  };

  const renameCollection = (id: string, title: string) => {
    setRenaming((current) => (current === id ? null : current));
    const trimmed = title.trim();
    if (trimmed === "") return;
    setUserCollections((all) =>
      all.map((each) =>
        each.id === id && each.name !== trimmed ? { ...each, name: trimmed } : each,
      ),
    );
  };

  const addFamiliesTo = (id: string, added: readonly FontFamily[]) => {
    setUserCollections((all) =>
      all.map((each) =>
        each.id === id
          ? {
              ...each,
              families: [...new Set([...(each.families ?? []), ...added.map((one) => one.id)])],
            }
          : each,
      ),
    );
  };

  const removeSelected = () => {
    if (!canRemove) return;
    if (!inOwn) {
      setRemoving(selectedFamilies);
      return;
    }
    const ids = selectedFamilies.map((family) => family.id);
    setUserCollections((all) =>
      all.map((each) =>
        each.id === inOwn.id
          ? { ...each, families: (each.families ?? []).filter((one) => !ids.includes(one)) }
          : each,
      ),
    );
  };

  const addCollection = (added: readonly FontFamily[] = [], named = "New Collection") => {
    const taken = new Set(userCollections.map((existing) => existing.name));
    let title = named;
    for (let number = 2; taken.has(title); number++) title = `${named} ${number}`;
    // An id no collection has, one loaded from the session included.
    const ids = new Set(userCollections.map((existing) => existing.id));
    let count = userCollections.length + 1;
    while (ids.has(`collection-${count}`)) count += 1;
    const id = `collection-${count}`;
    setUserCollections((all) => [
      ...all,
      { id, name: title, icon: "collection", families: added.map((one) => one.id) },
    ]);
    setCollectionId(id);
    return id;
  };

  /** A new collection's name is edited in place, once a menu that chose it has let go of the keyboard. */
  const newCollection = (added?: readonly FontFamily[]) => {
    const id = addCollection(added);
    renameAfterMenus(id);
  };

  const newLibrary = () => {
    const id = addCollection([], "New Library");
    setLibraryIds([...libraryIds, id]);
    renameAfterMenus(id);
  };

  const fontDrag = useFontDrag({
    families: (id) => {
      const pressed = findFont(id, visible);
      if (selection.includes(id)) return selectedFamilies;
      return pressed ? [pressed.family] : [];
    },
    accepts: (id) => ownCollection(id) !== undefined,
    onDrop: addFamiliesTo,
    // A press on one of several selected fonts keeps them for a drag; let go, it is selected alone.
    onRelease: (id) => {
      if (selection.length > 1 && selection.includes(id)) setSelected([id]);
    },
    files: (list) =>
      list.flatMap((family) => {
        const file = fontFiles.current.get(family.id);
        return file
          ? [
              {
                id: `font-book:${family.id}`,
                name: file.name,
                kind: "file" as const,
                type: file.type,
                size: file.size,
                bytes: async () => file,
              },
            ]
          : [];
      }),
  });

  /** Whether Font Book has this file's family: the library's, or one added or still loading. */
  const knownFile = (file: { name: string }) => {
    const { id } = fontFamily(familyNameOf(file.name), "Regular", "sans");
    return id === "" || owned.current.has(id) || families.some((existing) => existing.id === id);
  };

  const installFiles = async (files: readonly File[]) => {
    const added: FontFamily[] = [];
    const toKeep: { family: FontFamily; file: File }[] = [];
    for (const file of files) {
      // A window that has closed loads nothing more.
      if (!mounted.current) return;
      const { id, name: familyName } = fontFamily(familyNameOf(file.name), "Regular", "sans");
      if (knownFile(file)) continue;
      owned.current.set(id, undefined);
      const face = await installFont(familyName, file);
      if (!mounted.current) {
        // The window closed while the file loaded: its font does not stay on the page, and
        // the files after it are left alone.
        if (face) document.fonts.delete(face);
        return;
      }
      if (face) {
        const tables = await readFontTables(file);
        tablesOf.current.set(id, tables);
        const family = familyOfFile(familyName, tables);
        owned.current.set(id, face);
        fontFiles.current.set(id, file);
        added.push(family);
        toKeep.push({ family, file });
      } else {
        owned.current.delete(id);
      }
    }
    const [first] = added;
    if (!first) return;
    setUserFamilies((current) => [
      ...current,
      ...added.filter((family) => !current.some((existing) => existing.id === family.id)),
    ]);
    // Font Book shows what was added: the library selected, if it is one the person made, and else
    // all the fonts, with the first of the new ones.
    if (libraryIds.includes(collection.id)) addFamiliesTo(collection.id, added);
    else setCollectionId(allFonts.id);
    setQuery("");
    setSelected([first.id]);
    if (!driveAvailable()) return;
    for (const { family, file } of toKeep) {
      try {
        const id = await keepFont(file);
        if (mounted.current) setKept((current) => ({ ...current, [family.id]: id }));
      } catch {
        if (mounted.current) {
          setNotice(
            `“${family.name}” could not be kept on your drive. It stays until this window closes.`,
          );
        }
      }
    }
  };

  /** Add Fonts, a drop and Install Font: with the preference on, a file that does not pass asks first. */
  const takeFontFiles = async (files: readonly File[]) => {
    if (!validateFirst) {
      await installFiles(files);
      return;
    }
    const fonts: FontToInstall[] = [];
    for (const file of files) {
      if (!knownFile(file)) fonts.push({ file, checks: await validateFontFile(file) });
    }
    if (!mounted.current) return;
    if (fonts.every(({ checks }) => validationVerdict(checks) === "passed")) {
      await installFiles(fonts.map(({ file }) => file));
    } else {
      setToInstall(fonts);
    }
  };

  const addFonts = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    // The same file can be chosen again.
    input.value = "";
    void takeFontFiles(files);
  };

  const dropRef = useDesktopDrop<HTMLDivElement>({
    accepts: (item) => item.kind === "file" && isFontFile(item.name),
    onDrop: (items) => {
      filesOfDrag(items).then(takeFontFiles, () =>
        setNotice("The dropped fonts could not be read."),
      );
    },
    refusal: () => "Font Book takes font files: .ttf, .otf, .woff and .woff2.",
    sayRefusal: setNotice,
  });

  const closeOpened = () => {
    setOpened(null);
    if (openedFace.current) document.fonts.delete(openedFace.current);
    openedFace.current = undefined;
  };

  /** A font file opened from Finder: one Font Book has shows; another is offered for installing. */
  const openFontRequest = async ({ id: fileId, name: fileName }: OpenFileRequest) => {
    const { id, name: familyName } = fontFamily(familyNameOf(fileName), "Regular", "sans");
    try {
      const inFolder = driveAvailable() && (await keptFonts()).some((kept) => kept.id === fileId);
      if (!mounted.current) return;
      if (inFolder || knownFile({ name: fileName })) {
        setCollectionId(allFonts.id);
        setQuery("");
        setSelected([id]);
        return;
      }
      const blob = await readKeptFont(fileId);
      const file = new File([blob], fileName, { type: blob.type });
      const face = await installFont(`Font Book opened ${id}`, file);
      if (!mounted.current) {
        if (face) document.fonts.delete(face);
        return;
      }
      if (!face) {
        setNotice(`“${fileName}” is not a font the browser can read.`);
        return;
      }
      const tables = await readFontTables(file);
      if (openedFace.current) document.fonts.delete(openedFace.current);
      openedFace.current = face;
      setOpened({
        file,
        tables,
        stack: `"Font Book opened ${id}", sans-serif`,
        sample: sampleOf(familyOfFile(familyName, tables)),
      });
    } catch {
      if (mounted.current) setNotice(`“${fileName}” could not be read.`);
    }
  };
  const openFontRequestNow = useRef(openFontRequest);
  openFontRequestNow.current = openFontRequest;
  useEffect(() => {
    for (const request of takeOpenFileRequests("font-book")) {
      void openFontRequestNow.current(request);
    }
    return onOpenFileRequest("font-book", (request) => void openFontRequestNow.current(request));
  }, []);

  /** Off the page and out of the window's lists, with their state: their files are gone or moved. */
  const forgetFonts = (ids: readonly string[]) => {
    for (const id of ids) {
      const face = owned.current.get(id);
      if (face) document.fonts.delete(face);
      owned.current.delete(id);
      fontFiles.current.delete(id);
      tablesOf.current.delete(id);
    }
    setUserFamilies((current) => current.filter(({ id }) => !ids.includes(id)));
    setDisabled((current) => current.filter((id) => !ids.includes(id)));
    setUserCollections((all) =>
      all.map((each) => ({
        ...each,
        families: (each.families ?? []).filter((id) => !ids.includes(id)),
      })),
    );
    setKept((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))),
    );
  };

  const removeFonts = async (fonts: readonly FontFamily[]) => {
    // The file first: a font whose file stays keeps its collections and its state.
    const ids: string[] = [];
    for (const { id } of fonts) {
      try {
        const file = kept[id];
        if (file) await trashKeptFont(file);
        ids.push(id);
      } catch {
        setNotice("A font's file could not go to the Trash, so that font stays in Font Book.");
      }
    }
    forgetFonts(ids);
  };

  /** File > Restore Standard Fonts: the added fonts' files move aside and every font turns on. */
  const restoreStandardFonts = async () => {
    setRestoring(false);
    let moved = 0;
    try {
      if (driveAvailable()) moved = await moveKeptFontsAside();
    } catch {
      if (mounted.current) setNotice("The fonts you added could not be moved, so they stay.");
      return;
    }
    if (!mounted.current) return;
    forgetFonts(userFamilies.map(({ id }) => id));
    setDisabled([]);
    setNotice(
      moved === 0
        ? "The standard fonts are on."
        : `${moved === 1 ? "1 font" : `${moved} fonts`} moved to “${REMOVED_FOLDER}” in Documents.`,
    );
  };

  const toggleEnabled = () => {
    if (!canToggle) return;
    const ids = toggleable.map(({ id }) => id);
    setDisabled(
      allOff
        ? disabled.filter((other) => !ids.includes(other))
        : [...new Set([...disabled, ...ids])],
    );
  };

  /** The files of those of `list` the person added: the library's fonts have none here. */
  const filesOf = (list: readonly FontFamily[]) =>
    list.flatMap(({ id }) => {
      const file = fontFiles.current.get(id);
      return file ? [file] : [];
    });
  const hasFile = ({ id }: FontFamily) => fontFiles.current.has(id);
  const canExport = driveAvailable() && selectedFamilies.some(hasFile);
  const [onlyFamily] = selectedFamilies.length === 1 ? selectedFamilies : [];
  const revealFile = onlyFamily ? kept[onlyFamily.id] : undefined;

  const validateFamilies = async (list: readonly FontFamily[]) => {
    const results: FontValidation[] = [];
    for (const family of list) {
      const file = fontFiles.current.get(family.id);
      results.push({ name: family.name, checks: file ? await validateFontFile(file) : [] });
    }
    if (mounted.current) setValidation(results);
  };

  const validateChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    input.value = "";
    const results: FontValidation[] = [];
    for (const file of files) {
      results.push({ name: file.name, checks: await validateFontFile(file) });
    }
    if (mounted.current && results.length > 0) setValidation(results);
  };

  const exportTo = async (files: readonly File[], folder: string, name: string) => {
    setExporting(null);
    try {
      await exportFontFiles(files, folder, name);
    } catch {
      if (mounted.current) setNotice(`The fonts could not be saved in \u201c${name}\u201d.`);
    }
  };

  /** The family a kept file shows as. */
  const familyIdOf = (fileName: string) => fontFamily(familyNameOf(fileName), "Regular", "sans").id;

  /**
   * Moves the extra files to the Trash. A font that shows because of one goes with it, unless the file
   * that stays is the same family's: that family stays, held by that file.
   */
  const resolveGroups = async (groups: readonly DuplicateFonts[]) => {
    setDuplicates(null);
    let moved = 0;
    for (const { keep, extra } of groups) {
      for (const file of extra) {
        const family = userFamilies.find(({ id }) => kept[id] === file.id);
        try {
          if (family && family.id !== familyIdOf(keep.name)) await removeFonts([family]);
          else {
            await trashKeptFont(file.id);
            if (family) setKept((current) => ({ ...current, [family.id]: keep.id }));
          }
          moved += 1;
        } catch {
          // Said below by what stayed out of the count.
        }
      }
    }
    if (mounted.current) {
      setNotice(
        moved === 1
          ? "1 duplicate file went to the Trash."
          : `${moved} duplicate files went to the Trash.`,
      );
    }
  };

  const lookForDuplicates = async (resolve: boolean) => {
    try {
      // Enabled duplicates: a family turned off is not looked at, and its file stays.
      const enabled = (await keptFonts()).filter(
        ({ name }) => !disabled.includes(familyIdOf(name)),
      );
      const groups = duplicateFontFiles(enabled);
      if (!mounted.current) return;
      if (groups.length === 0) setNotice("No enabled duplicates were found.");
      else if (resolve) await resolveGroups(groups);
      else setDuplicates(groups);
    } catch {
      if (mounted.current) setNotice("The fonts on your drive could not be read.");
    }
  };

  // Return, or leaving the field, enters what was typed: a number, brought into the slider's
  // range. Anything else is dropped and the field shows the size again.
  const commitSize = () => {
    const typed = draft === null ? Number.NaN : Number(draft);
    if (draft?.trim() && Number.isFinite(typed))
      setSize(Math.min(MAX_SIZE, Math.max(MIN_SIZE, typed)));
    setDraft(null);
  };

  // Served by the desktop's Ferrite application: the session's collections and turned-off fonts
  // replace the starting ones, and every change is saved. Until the first load settles the
  // window's controls are inert, so no change is made that the load would replace.
  const library = useMemo<FontBookLibrary>(
    () => ({ collections: userCollections, disabled }),
    [userCollections, disabled],
  );
  const loading = useServerState({
    url: FONT_BOOK_LIBRARY_URL,
    enabled: servedByDesktopApp(),
    value: library,
    onLoad: (stored) => {
      if (!libraryReadable(stored)) return false;
      // A library forgotten elsewhere (`null`) is the starting one: no collections, all fonts on.
      const saved = libraryFromServer(stored) ?? { collections: [], disabled: [] };
      setUserCollections(saved.collections);
      setDisabled(saved.disabled);
    },
    toBody: libraryToServer,
  });
  // Every Fonts panel follows this window: what it turns off, adds and removes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a change of the added fonts is the cue
  useEffect(() => {
    if (!loading) holdFontsOff(disabled);
  }, [loading, disabled, kept]);
  useEffect(() => () => holdFontsOff(null), []);

  const showView = (next: FontBookView) => {
    if (view !== "info") viewBeforeInfo.current = view;
    setView(next);
  };

  const setSizeAndField = (next: number) => {
    setSize(next);
    setDraft(null);
  };

  const fitText = view === "custom" ? custom : shown ? sampleOf(shown.family) : "";
  const canFit = shown !== undefined && !severalFonts && (view === "sample" || view === "custom");

  const menuTarget =
    [...libraryRows, ...defaultCollections, ...everySmart, ...userCollections].find(
      (each) => each.id === menuCollection,
    ) ?? (menuCollection === allFonts.id ? allFonts : null);
  const menuFamilies = menuTarget
    ? familiesIn(menuTarget, everyFamily).filter((family) => !family.required && family.available)
    : [];
  const menuFamiliesOff =
    menuFamilies.length > 0 && menuFamilies.every(({ id }) => disabled.includes(id));
  const menuFamiliesWithFiles = menuTarget
    ? familiesIn(menuTarget, everyFamily).filter(hasFile)
    : [];

  useFontBookMenus({
    within: titleBar,
    isKey: state === "key",
    loading,
    status: {
      view,
      enableTitle,
      canToggleEnabled: canToggle,
      removeTitle,
      canRemove,
      canDeleteCollection: inOwn !== undefined || inOwnSmart !== undefined,
      canEditSmart: inOwnSmart !== undefined,
      canExport,
      hasDrive: driveAvailable(),
      canFit,
      canBigger: size < MAX_SIZE,
      canSmaller: size > MIN_SIZE,
      collectionsShown,
      fontsShown,
      toolbarShown,
    },
    commands: {
      print: () => setPrinting(true),
      validateFont: () =>
        void validateFamilies(
          selectedFamilies.length > 0 ? selectedFamilies : shown ? [shown.family] : [],
        ),
      validateFile: () => validateInput.current?.click(),
      exportFonts: () => {
        if (canExport) setExporting(filesOf(selectedFamilies));
      },
      lookForDuplicates: () => void lookForDuplicates(false),
      resolveDuplicates: () => void lookForDuplicates(true),
      toggleToolbar: () => setToolbarShown(!toolbarShown),
      newCollection: () => newCollection(),
      newSmartCollection: () => setEditingSmart(newSmartCollection(ownSmart)),
      newLibrary,
      restoreStandardFonts: () => setRestoring(true),
      customizeToolbar: () => setCustomizing(true),
      editSmartCollection: () => {
        if (inOwnSmart) setEditingSmart(inOwnSmart);
      },
      addFonts: () => fileInput.current?.click(),
      toggleEnabled,
      selectAllFonts: () => setSelected(visible.map((family) => family.id)),
      deleteKey: () => {
        if (sidebar.current?.contains(document.activeElement)) {
          if (inOwn) setDeleting(inOwn);
          else if (inOwnSmart) setDeleting(smartCollectionOf(inOwnSmart));
        } else removeSelected();
      },
      remove: removeSelected,
      deleteCollection: () => {
        if (inOwn) setDeleting(inOwn);
        else if (inOwnSmart) setDeleting(smartCollectionOf(inOwnSmart));
      },
      findFonts: () => {
        // The menu gives the keyboard back as it closes: the field takes it after that.
        whenMenusClosed(document, () => {
          searchInput.current?.focus();
          searchInput.current?.select();
        });
      },
      setView: showView,
      toggleInfo: () => showView(view === "info" ? viewBeforeInfo.current : "info"),
      fit: () => {
        const element = stage.current?.querySelector<HTMLElement>(".mac-font-book-sample");
        if (!element || !shown) return;
        const fitted = fittedSize(element, fitText.split("\n"), shown.family.leading ?? 1.2);
        if (fitted !== undefined) setSizeAndField(fitted);
      },
      bigger: () => setSizeAndField(biggerSize(size)),
      smaller: () => setSizeAndField(smallerSize(size)),
      toggleCollections: () => setCollectionsShown(!collectionsShown),
      toggleFonts: () => setFontsShown(!fontsShown),
      customText: () =>
        customText.current
          ? {
              element: customText.current,
              restore: () => customText.current?.focus(),
              editable: true,
              rich: false,
            }
          : null,
    },
  });

  /** Where an added font's file is, or that a font of the library has none. */
  const locationOf = (family: FontFamily) => {
    const file = fontFiles.current.get(family.id);
    if (!file) return NO_LOCATION;
    return kept[family.id]
      ? `Documents/Fonts/${file.name}`
      : "In this window only: not kept on your drive";
  };

  /** What Info says of a font: what its own file says, where it has one. */
  const factsOf = ({
    family,
    style,
  }: {
    family: FontFamily;
    style: FontStyle;
  }): readonly [term: string, value: string][] => {
    const tables = tablesOf.current.get(family.id);
    const inFile = (value: string | undefined) =>
      !fontFiles.current.has(family.id)
        ? NO_FILE
        : tables
          ? (value ?? "None in this file")
          : COMPRESSED;
    return [
      ["PostScript name", tables?.postScriptName ?? postScriptName(family, style)],
      ["Full name", tables?.fullName ?? `${family.name} ${style.name}`],
      ["Family", tables?.familyName ?? family.name],
      ["Style", tables?.styleName ?? style.name],
      ["Language", family.script],
      ["Fixed width", family.kind === "mono" ? "Yes" : "No"],
      [
        "Enabled",
        !family.available ? "No, not downloaded" : disabled.includes(family.id) ? "No" : "Yes",
      ],
      [
        "Collections",
        [...everySmart, ...collections]
          .filter((other) => familiesIn(other, [family]).length > 0)
          .map((other) => other.name)
          .join(", ") || "None",
      ],
      ["Version", inFile(tables?.version)],
      ["Designer", inFile(tables?.designer)],
      ["Copyright", inFile(tables?.copyright)],
      ["Location", locationOf(family)],
      ["Drawn with", family.stack],
    ];
  };

  const infoList = (font: { family: FontFamily; style: FontStyle }) => (
    <dl className="mac-font-book-info">
      {factsOf(font).map(([term, value]) => (
        <Fragment key={term}>
          <dt className="mac-font-book-info-term">
            <Label color="secondary" align="end">
              {term}
            </Label>
          </dt>
          <dd className="mac-font-book-info-value">
            <Label selectable>{value}</Label>
          </dd>
        </Fragment>
      ))}
    </dl>
  );

  const repertoireGrid = (family: FontFamily, style: FontStyle, label: string) => {
    const glyphs = repertoireOf(family);
    return (
      <>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset is for form controls; this names a block of characters */}
        <div
          role="group"
          aria-label={label}
          className="mac-font-book-repertoire"
          style={fontCss(family, style, size)}
        >
          {glyphs.slice(0, REPERTOIRE_SHOWN).map((glyph) => (
            <span key={glyph}>{glyph}</span>
          ))}
        </div>
        {glyphs.length > REPERTOIRE_SHOWN ? (
          <p className="mac-font-book-several-more">
            The first {REPERTOIRE_SHOWN} of {glyphs.length} characters
          </p>
        ) : null}
      </>
    );
  };

  const customEditor = (className: string, style: CSSProperties) => (
    <ContextualMenu>
      <ContextualMenuTrigger className="mac-font-book-custom-area">
        <TextView
          ref={customText}
          aria-label="Custom text"
          className={className}
          style={style}
          value={custom}
          onValueChange={setCustom}
        />
      </ContextualMenuTrigger>
      <ContextualMenuPopup aria-label="Custom text commands">
        <EditorEditItems
          target={() =>
            customText.current
              ? {
                  element: customText.current,
                  restore: () => customText.current?.focus(),
                  editable: true,
                  rich: false,
                }
              : null
          }
        />
      </ContextualMenuPopup>
    </ContextualMenu>
  );

  /** Several fonts in any view but the Custom one's text: each under its name, up to a limit. */
  const severalSections = (
    show: (font: { id: string | number; family: FontFamily; style: FontStyle }) => ReactNode,
  ) => (
    <ScrollView className="mac-font-book-view">
      {found.slice(0, SEVERAL_SHOWN).map((font) => (
        <section key={font.id} className="mac-font-book-several">
          <h3 className="mac-font-book-several-name">
            {font.family.name} {font.style.name}
          </h3>
          {show(font)}
        </section>
      ))}
      {found.length > SEVERAL_SHOWN ? (
        <p className="mac-font-book-several-more">
          The first {SEVERAL_SHOWN} of {found.length} fonts
        </p>
      ) : null}
    </ScrollView>
  );

  const toolbarItem = (tool: FontTool, key: number) => {
    switch (tool) {
      case "views":
        return (
          <ToolbarSegmentedControl
            key={key}
            aria-label="Preview"
            value={[view]}
            onValueChange={(next) => {
              const chosen = VIEWS.find((candidate) => candidate.value === next[0]);
              if (chosen) showView(chosen.value);
            }}
          >
            {VIEWS.map(({ value, label, glyph, style }) => (
              <ToolbarSegment key={value} value={value} aria-label={label} style={style}>
                {glyph}
              </ToolbarSegment>
            ))}
          </ToolbarSegmentedControl>
        );
      case "fixed":
        return <ToolbarSpace key={key} width={46} style={BUTTON_SPACE} />;
      case "flexible":
        return <ToolbarSpace key={key} />;
      case "add":
        return (
          <ToolbarButton
            key={key}
            aria-label="Add Fonts"
            style={BUTTON}
            onClick={() => fileInput.current?.click()}
          >
            <SystemImage name="add" />
          </ToolbarButton>
        );
      case "enable":
        return (
          <ToolbarButton
            key={key}
            aria-label={shown ? `${verb} ${familyWord}` : "Disable"}
            disabled={!canToggle}
            style={BUTTON}
            onClick={toggleEnabled}
          >
            <EnableGlyph />
          </ToolbarButton>
        );
      case "print":
        return (
          <ToolbarButton
            key={key}
            aria-label="Print"
            style={BUTTON}
            onClick={() => setPrinting(true)}
          >
            <PrintGlyph />
          </ToolbarButton>
        );
      case "validate":
        return (
          <ToolbarButton
            key={key}
            aria-label="Validate Font"
            style={BUTTON}
            onClick={() =>
              void validateFamilies(
                selectedFamilies.length > 0 ? selectedFamilies : shown ? [shown.family] : [],
              )
            }
          >
            <ValidateGlyph />
          </ToolbarButton>
        );
      case "search":
        return (
          <Menu key={key}>
            <ToolbarSearchField
              aria-label="Search"
              inputRef={searchInput}
              value={query}
              onValueChange={setQuery}
              // The field as captured says "Search"; a narrower scope is named in its place.
              placeholder={
                scope === "all" ? "Search" : SEARCH_SCOPES.find(({ id }) => id === scope)?.name
              }
              style={SEARCH}
              searchMenu={
                <MenuTrigger render={<ToolbarSearchFieldMenuButton aria-label="Search in" />} />
              }
            />
            <MenuPopup>
              <MenuRadioGroup value={scope} onValueChange={(next) => setScope(next as SearchScope)}>
                {SEARCH_SCOPES.map(({ id, name }) => (
                  <MenuRadioItem key={id} value={id}>
                    {name}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuPopup>
          </Menu>
        );
    }
  };

  const row = ({ id, name: title, icon }: FontCollection) => {
    const own = ownCollection(id) !== undefined;
    return (
      <SidebarItem
        key={id}
        value={id}
        data-font-collection={id}
        data-font-drop={fontDrag.dropTarget === id ? "" : undefined}
        onDoubleClick={own ? () => beginRename(id) : undefined}
        label={
          renaming === id ? (
            <CollectionNameField
              name={title}
              inputRef={nameInput}
              onCommit={(next) => renameCollection(id, next)}
              onCancel={() => setRenaming(null)}
            />
          ) : (
            title
          )
        }
        icon={ICONS[icon]}
      />
    );
  };

  return (
    <Window
      {...windowProps}
      width={width}
      height={height}
      className={className ? `mac-font-book ${className}` : "mac-font-book"}
      state={state}
    >
      <TitleBar
        ref={setTitleBar}
        variant="unified"
        title={windowTitle(collection, inCollection)}
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
        {toolbarShown ? (
          <Toolbar aria-label="Font Book toolbar" inert={loading || undefined}>
            {tools.map(toolbarItem)}
          </Toolbar>
        ) : null}
      </TitleBar>
      <WindowBody
        ref={dropRef}
        background="content"
        className="mac-font-book-body"
        inert={loading || undefined}
        aria-busy={loading || undefined}
      >
        <input
          ref={fileInput}
          type="file"
          accept={FONT_FILES}
          multiple
          aria-label="Choose font files"
          hidden
          onChange={addFonts}
        />
        <input
          ref={validateInput}
          type="file"
          accept={FONT_FILES}
          multiple
          aria-label="Choose font files to validate"
          hidden
          onChange={(event) => void validateChosen(event)}
        />
        <SplitView className="mac-font-book-split">
          <SplitViewPane
            defaultSize={200}
            size={collectionsShown ? undefined : 0}
            minSize={140}
            maxSize={320}
          >
            <ContextualMenu>
              <ContextualMenuTrigger
                className="mac-font-book-menu-area"
                onContextMenu={(event) => {
                  const target = event.target instanceof Element ? event.target : null;
                  if (target?.closest("input")) {
                    event.preventBaseUIHandler();
                    return;
                  }
                  const id =
                    target?.closest<HTMLElement>("[data-font-collection]")?.dataset.fontCollection;
                  setMenuCollection(id ?? null);
                }}
              >
                <Sidebar
                  ref={sidebar}
                  aria-label="Collections"
                  material="opaque"
                  className="mac-font-book-sidebar"
                  style={SIDEBAR}
                  value={collection.id}
                  onValueChange={setCollectionId}
                  footer={
                    <div className="mac-font-book-footer">
                      <ImageButton
                        aria-label="Add Collection"
                        className="mac-font-book-add-collection"
                        onClick={() => newCollection()}
                      >
                        <SystemImage name="add" />
                      </ImageButton>
                    </div>
                  }
                >
                  {row(allFonts)}
                  {libraryRows.map(row)}
                  <SidebarSection title="Smart Collection">{everySmart.map(row)}</SidebarSection>
                  <SidebarSection title="Collection">{collections.map(row)}</SidebarSection>
                </Sidebar>
              </ContextualMenuTrigger>
              <ContextualMenuPopup aria-label="Collection commands">
                <CollectionContextItems
                  editable={ownCollection(menuCollection) !== undefined}
                  deletable={
                    ownCollection(menuCollection) !== undefined ||
                    smartOwn(menuCollection) !== undefined
                  }
                  onEditSmart={
                    smartOwn(menuCollection)
                      ? () => setEditingSmart(smartOwn(menuCollection) ?? null)
                      : undefined
                  }
                  enableTitle={`${menuFamiliesOff ? "Enable" : "Disable"} Collection`}
                  canToggle={menuFamilies.length > 0}
                  onToggle={() => {
                    const ids = menuFamilies.map(({ id }) => id);
                    setDisabled(
                      menuFamiliesOff
                        ? disabled.filter((other) => !ids.includes(other))
                        : [...new Set([...disabled, ...ids])],
                    );
                  }}
                  onRename={() => {
                    const id = menuCollection;
                    if (id) renameAfterMenus(id);
                  }}
                  onDelete={() => {
                    const smart = smartOwn(menuCollection);
                    setDeleting(
                      smart ? smartCollectionOf(smart) : (ownCollection(menuCollection) ?? null),
                    );
                  }}
                  onNewCollection={() => newCollection()}
                  canExport={driveAvailable() && menuFamiliesWithFiles.length > 0}
                  onExport={() => {
                    if (menuFamiliesWithFiles.length > 0) {
                      setExporting(filesOf(menuFamiliesWithFiles));
                    }
                  }}
                />
              </ContextualMenuPopup>
            </ContextualMenu>
          </SplitViewPane>
          {collectionsShown ? (
            <SplitViewDivider aria-label="Resize the collections" style={SIDEBAR_DIVIDER} />
          ) : null}
          <SplitViewPane
            defaultSize={200}
            size={fontsShown ? undefined : 0}
            minSize={140}
            maxSize={400}
          >
            <ContextualMenu>
              <ContextualMenuTrigger
                className="mac-font-book-menu-area"
                onContextMenu={(event) => {
                  const id = fontAt(event.target);
                  if (!id) {
                    event.preventBaseUIHandler();
                    return;
                  }
                  if (!selection.some((each) => String(each) === id)) setSelected([id]);
                }}
              >
                <OutlineView<FontItem>
                  aria-label="Fonts"
                  className="mac-font-book-list"
                  items={items}
                  selectionMode="multiple"
                  renderCell={(item) => (
                    <span className="mac-font-book-row" data-font-id={item.id}>
                      {item.off ? <span className="mac-font-book-off">Off</span> : null}
                      {item.name}
                    </span>
                  )}
                  getItemLabel={(item) => item.name}
                  expanded={expanded}
                  onExpandedChange={setExpanded}
                  value={selection}
                  onValueChange={setSelected}
                  rowHeight={ROW_HEIGHT}
                  indentation={INDENTATION}
                  // The list opens at its end, as captured, and the list is the user's to scroll
                  // from then on, but for a font asked for.
                  revealedItem={revealed}
                  onPointerDown={(event) => {
                    const id = fontAt(event.target);
                    if (id && !(event.target as Element).closest("button")) {
                      fontDrag.onPress(event, id);
                    }
                  }}
                  onMouseDown={(event) => {
                    // A press on one of several selected fonts keeps them for a drag.
                    const id = fontAt(event.target);
                    if (
                      id &&
                      event.button === 0 &&
                      !event.shiftKey &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      selection.length > 1 &&
                      selection.includes(id) &&
                      !(event.target as Element).closest("button")
                    ) {
                      event.preventDefault();
                      event.currentTarget.focus({ preventScroll: true });
                    }
                  }}
                />
              </ContextualMenuTrigger>
              <ContextualMenuPopup aria-label="Font commands">
                <FontContextItems
                  enableTitle={enableTitle}
                  canToggle={canToggle}
                  onToggle={toggleEnabled}
                  removeTitle={removeTitle}
                  canRemove={canRemove}
                  onRemove={removeSelected}
                  collections={userCollections}
                  onAddTo={(id) => addFamiliesTo(id, selectedFamilies)}
                  onNewCollection={() => newCollection(selectedFamilies)}
                  canValidate={selectedFamilies.length > 0}
                  onValidate={() => void validateFamilies(selectedFamilies)}
                  canExport={canExport}
                  onExport={() => setExporting(filesOf(selectedFamilies))}
                  canReveal={revealFile !== undefined}
                  notDownloaded={selectedFamilies.find((family) => !family.available)?.name}
                  onReveal={() => {
                    if (revealFile) showInFinder({ id: revealFile });
                  }}
                />
              </ContextualMenuPopup>
            </ContextualMenu>
          </SplitViewPane>
          {fontsShown ? <SplitViewDivider aria-label="Resize the font list" /> : null}
          <SplitViewPane minSize={320} className="mac-font-book-preview" data-view={view}>
            <div className="mac-font-book-size">
              <Label id={sizeLabel} className="mac-font-book-size-label">
                Size:
              </Label>
              <ComboBox
                aria-labelledby={sizeLabel}
                className="mac-font-book-size-field"
                inputMode="decimal"
                value={draft ?? String(size)}
                onValueChange={(text, details) => {
                  // A size from the list applies at once; typed text when it is entered.
                  const chosen = details.reason === "item-press" ? parseSize(text) : undefined;
                  if (chosen !== undefined) setSize(chosen);
                  setDraft(chosen === undefined ? text : null);
                }}
                onBlur={commitSize}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitSize();
                }}
              >
                {SIZES.map((choice) => (
                  <ComboBoxItem key={choice}>{choice}</ComboBoxItem>
                ))}
              </ComboBox>
            </div>
            <Slider
              aria-labelledby={sizeLabel}
              className="mac-font-book-slider"
              orientation="vertical"
              min={MIN_SIZE}
              max={MAX_SIZE}
              step={1}
              value={size}
              onValueChange={(next) => {
                setSize(Math.round(next));
                setDraft(null);
              }}
            />
            {shown ? (
              <div ref={stage} className="mac-font-book-stage">
                <h2 className="mac-font-book-title">
                  {severalFonts ? `${found.length} Fonts` : name}
                </h2>
                {view === "sample" && severalFonts ? (
                  severalSections(({ family, style }) => (
                    <div
                      className="mac-font-book-several-sample"
                      style={fontCss(family, style, size)}
                    >
                      {sampleOf(family)}
                    </div>
                  ))
                ) : view === "custom" && severalFonts ? (
                  <>
                    {customEditor("mac-font-book-several-custom", {
                      "--mac-text-view-background": "transparent",
                    } as CSSProperties)}
                    {severalSections(({ family, style }) => (
                      <div
                        className="mac-font-book-several-sample"
                        style={fontCss(family, style, size)}
                      >
                        {custom}
                      </div>
                    ))}
                  </>
                ) : view === "repertoire" && severalFonts ? (
                  severalSections(({ family, style }) =>
                    repertoireGrid(family, style, `Repertoire of ${family.name} ${style.name}`),
                  )
                ) : view === "info" && severalFonts ? (
                  severalSections(infoList)
                ) : view === "sample" ? (
                  <RichTextView
                    readOnly
                    aria-label="Sample"
                    className="mac-font-book-view mac-font-book-sample"
                    style={fontCss(shown.family, shown.style, size)}
                  >
                    {sampleOf(shown.family)}
                  </RichTextView>
                ) : view === "custom" ? (
                  customEditor(
                    "mac-font-book-view mac-font-book-sample",
                    fontCss(shown.family, shown.style, size),
                  )
                ) : view === "repertoire" ? (
                  <ScrollView className="mac-font-book-view">
                    {repertoireGrid(shown.family, shown.style, "Repertoire")}
                  </ScrollView>
                ) : (
                  <ScrollView className="mac-font-book-view">{infoList(shown)}</ScrollView>
                )}
              </div>
            ) : (
              <EmptyState className="mac-font-book-stage">No Fonts</EmptyState>
            )}
          </SplitViewPane>
        </SplitView>
      </WindowBody>
      {fontDrag.ghost}
      <SmartCollectionSheet
        editing={editingSmart}
        anchor={titleBar}
        onSave={(smart) => {
          setOwnSmart(
            ownSmart.some(({ id }) => id === smart.id)
              ? ownSmart.map((each) => (each.id === smart.id ? smart : each))
              : [...ownSmart, smart],
          );
          setCollectionId(smart.id);
          setEditingSmart(null);
        }}
        onClose={() => setEditingSmart(null)}
      />
      <FontValidationSheet
        results={validation}
        anchor={titleBar}
        onClose={() => setValidation(null)}
      />
      <FontDuplicatesSheet
        groups={duplicates}
        anchor={titleBar}
        onResolve={(groups) => void resolveGroups(groups)}
        onClose={() => setDuplicates(null)}
      />
      <FontExportSheet
        count={exporting?.length ?? null}
        anchor={titleBar}
        onExport={(target) => {
          if (exporting) void exportTo(exporting, target.folder, target.name);
        }}
        onClose={() => setExporting(null)}
      />
      <FontPrintSheet
        open={printing}
        anchor={titleBar}
        families={selectedFamilies.length > 0 ? selectedFamilies : shown ? [shown.family] : []}
        report={report}
        onReportChange={setReport}
        fontFile={(family) => fontFiles.current.get(family.id)}
        onClose={() => setPrinting(false)}
      />
      <FontToolsSheet
        open={customizing}
        anchor={titleBar}
        tools={tools}
        onChange={setTools}
        onClose={() => setCustomizing(false)}
      />
      <FontInstallCheckSheet
        fonts={toInstall}
        anchor={titleBar}
        onInstall={(files) => {
          setToInstall(null);
          void installFiles(files);
        }}
        onClose={() => setToInstall(null)}
      />
      <FontInstallSheet
        font={opened}
        anchor={titleBar}
        onInstall={(file) => {
          closeOpened();
          void takeFontFiles([file]);
        }}
        onClose={closeOpened}
      />
      <RestoreFontsAlert
        open={restoring}
        onCancel={() => setRestoring(false)}
        onRestore={() => void restoreStandardFonts()}
      />
      <RemoveFontsAlert
        fonts={removing}
        onCancel={() => setRemoving(null)}
        onRemove={(fonts) => {
          setRemoving(null);
          void removeFonts(fonts);
        }}
      />
      <FontNoticeAlert notice={notice} onClose={() => setNotice(null)} />
      <DeleteCollectionAlert
        collection={deleting}
        onCancel={() => setDeleting(null)}
        onDelete={({ id }) => {
          setUserCollections((all) => all.filter((each) => each.id !== id));
          if (libraryIds.includes(id)) setLibraryIds(libraryIds.filter((each) => each !== id));
          if (smartOwn(id)) setOwnSmart(ownSmart.filter((each) => each.id !== id));
          setDeleting(null);
        }}
      />
    </Window>
  );
}
