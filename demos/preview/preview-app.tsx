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
import { ColorWell } from "macalicious/color-well";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { EmptyState } from "macalicious/empty-state";
import { Label } from "macalicious/label";
import { FONT_FAMILIES } from "macalicious/lib/font-families";
import { observeResize } from "macalicious/lib/observe-resize";
import { ListView } from "macalicious/list-view";
import { useManagedWindow } from "macalicious/managed-window";
import {
  MarkupToolbar,
  MarkupToolbarSeparator,
  MarkupToolbarSwatch,
  MarkupToolbarTool,
} from "macalicious/markup-toolbar";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { ProgressBar } from "macalicious/progress-bar";
import { PushButton } from "macalicious/push-button";
import {
  ScopeBar,
  ScopeBarAction,
  ScopeBarActionGroup,
  ScopeBarActions,
  ScopeBarButton,
  ScopeBarGroup,
  ScopeBarLabel,
} from "macalicious/scope-bar";
import { ScrollView } from "macalicious/scroll-view";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { Sheet, SheetPopup, SheetTitle } from "macalicious/sheet";
import { Slider } from "macalicious/slider";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { TextField } from "macalicious/text-field";
import { TextView } from "macalicious/text-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarPullDown, ToolbarSplitPullDown } from "macalicious/toolbar-pop-up";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useWindowManager } from "macalicious/window-manager";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  use,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import {
  beginDesktopDrag,
  type DesktopDragItem,
  landingAt,
  useDesktopDrop,
} from "../desktop/desktop-drag";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import type { DriveEntry } from "../desktop/desktop-files";
import { DesktopFontPanel } from "../desktop/desktop-font-panel";
import { openUrl } from "../desktop/desktop-open-url";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp, useServerState } from "../desktop/desktop-server";
import { copyText, FileShareItems } from "../desktop/desktop-share-link";
import { DesktopWindowHostContext, DesktopWindowName } from "../desktop/desktop-windows";
import { mergeByKeys } from "../desktop/document-merge";
import {
  DriveOpenPanel,
  DriveSavePanel,
  type DriveSaveTarget,
} from "../finder/finder-file-dialogs";
import {
  type OpenFileRequest,
  onOpenFileRequest,
  takeOpenFileRequests,
} from "../finder/finder-open";
import { copyOpenAs } from "../photos/photos-edit-with";
import { type ExifFacts, readExif } from "../photos/photos-exif";
import { printPictures } from "../photos/photos-print";
import { Preview } from "./preview";
import { AdjustColorPanel, AdjustSizeSheet, SCREEN_DPI } from "./preview-adjust";
import { DocumentIcon, PreviewGlyph, type PreviewGlyphName } from "./preview-artwork";
import {
  adjustCanvas,
  autoLevels,
  type ColorAdjust,
  isNeutral,
  levelsOf,
  NO_ADJUST,
} from "./preview-color";
import type { PreviewSort } from "./preview-data";
import { defaultPreviewDrive, type PreviewDrive } from "./preview-drive";
import {
  blankPdf,
  canvasBlob,
  canvasTiff,
  downloadBlob,
  EXPORT_FORMATS,
  type ExportFormat,
  extensionOf,
  formatOf,
  isPdf,
  JPEG_QUALITY,
  nameFor,
  opensInPreview,
  PDF_EXPORT_SCALE,
  type PdfPage,
  saveFormatOf,
  stemOf,
  UNWRITABLE_FORMATS,
  UNWRITABLE_REASON,
  withResolution,
  writePdf,
} from "./preview-export";
import { PreviewGallery } from "./preview-gallery";
import { NO_LOCKING, PreviewInspector } from "./preview-inspector";
import { smartOutline } from "./preview-lasso";
import { PreviewMagnifier } from "./preview-magnifier";
import {
  type ArrowEnds,
  afterInsertion,
  applyView,
  boundsOf,
  cutOut,
  drawMarks,
  EMPTY_MARKUP,
  flipped,
  fromView,
  HIGHLIGHT_COLORS,
  handleAt,
  heldOrder,
  intersect,
  isAnnotation,
  isClosedOutline,
  isTextMark,
  LINE_HEIGHT,
  MARKUP_ALIGNMENTS,
  MARKUP_ARROW_ENDS,
  MARKUP_COLORS,
  MARKUP_DASHES,
  MARKUP_FONTS,
  MARKUP_LIMITS,
  MARKUP_STROKES,
  MARKUP_TEXT_SIZES,
  type Mark,
  type MarkDash,
  type MarkStyle,
  type Markup,
  markAt,
  markFont,
  marksIn,
  marksOf,
  markupFromServer,
  markupToServer,
  mergedLines,
  moved,
  NOTE_PRESS_SLOP,
  newMarkId,
  noteMark,
  outlineBox,
  ovalOutline,
  type Point,
  PREVIEW_MARKUP_URL,
  PREVIEW_SIGNATURES_URL,
  pageTurns,
  placeSignature,
  type Rect,
  rearranged,
  rectFromView,
  resized,
  round6,
  type Signature,
  shapeBetween,
  signatureFromStrokes,
  signaturesFromServer,
  signaturesToServer,
  TEXT_LINE_COLOR,
  type TextMarkStyle,
  type Turns,
  textBox,
  textMarks,
  thinPoints,
  toView,
  turned,
  typedRuns,
  typingFont,
  type View,
  viewSize,
  WHOLE_PAGE,
  withinLimits,
  withMarks,
  withPagesTurned,
} from "./preview-markup";
import { PreviewPage } from "./preview-page";
import { extractionParts, insertionParts, pagedPdf, passwordRefusal } from "./preview-pages";
import type { PdfField, PdfFile, PdfLink, PdfOutlineEntry, PdfPageSize } from "./preview-pdf";
import {
  forgetPlace,
  movedPlace,
  openedPlace,
  type PageDisplay,
  type Place,
  PREVIEW_PLACES_URL,
  pagesShown,
  placesFromServer,
  placesToServer,
  RECENT_SHOWN,
} from "./preview-places";
import {
  canCaptureScreen,
  captureScreen,
  NO_CAPTURE,
  type ScreenshotKind,
  screenshotName,
} from "./preview-screenshot";
import {
  type Bookmark,
  bookmarkedPages,
  MAX_BOOKMARKS,
  PAPER_ZOOM,
  PREVIEW_SETTINGS,
  readAlign,
  readArrowEnds,
  readBookmarks,
  readColor,
  readDash,
  readFill,
  readFont,
  readScale,
  readShadow,
  readSidebar,
  readSidebarWidth,
  readStroke,
  readTextSize,
  type ScaleChoice,
  type SidebarChoice,
  toggledBookmark,
} from "./preview-settings";
import { cleanedSketch, type OutlineKind, outlineBetween } from "./preview-shapes";
import { MoveSheet, PasswordSheet, RenameSheet } from "./preview-sheets";
import { SignatureCamera } from "./preview-signature-camera";
import { PreviewSlideshow } from "./preview-slideshow";
import { keepPdfWords } from "./preview-spotlight";
import { selectedOnPages } from "./preview-text";
import { usePreviewFieldTyping, usePreviewTextTools } from "./preview-text-tools";
import { TitleMenu } from "./preview-title";
import {
  PreviewCustomizeToolbar,
  type PreviewToolbarItem,
  readHiddenTools,
} from "./preview-toolbar-sheet";
import {
  forgetFileOf,
  isFirstPreviewWindow,
  keepFileOf,
  keptFileOf,
  notePagesDragged,
  type OpenPreviewWindow,
  otherWindowWithFile,
  type PreviewFileRef,
  type PreviewOpening,
  pagesDragged,
  registerPreviewWindow,
} from "./preview-windows";
import "./preview.tokens.css";
import "./preview.css";
import "./preview-app.css";

/** The step of the zoom buttons, and how far they go either way. */
const ZOOM_STEP = 1.25;
const ZOOM_MIN = ZOOM_STEP ** -6;
const ZOOM_MAX = ZOOM_STEP ** 10;
/** Undo steps kept. */
const HISTORY = 30;
/** The gap between two pages side by side (`--mac-preview-app-page-gap`), and a contact sheet's
 * page, in points. */
const PAGE_GAP = 12;
const CONTACT_SIDE = 160;
/** The width a signature is placed at, as a share of the page shown. */
const SIGNATURE_WIDTH = 0.3;

type Tool =
  | "select"
  | "sketch"
  | "rect"
  | "oval"
  | "line"
  | "arrow"
  | OutlineKind
  | "mask"
  | "loupe"
  | "text"
  | "crop"
  | "ellipse"
  | "lasso"
  | "smartLasso"
  | "note";

const TOOL_NAMES: Record<Tool, string> = {
  select: "Select",
  sketch: "Sketch",
  rect: "Rectangle",
  oval: "Oval",
  line: "Line",
  arrow: "Arrow",
  star: "Star",
  polygon: "Polygon",
  bubble: "Speech Bubble",
  mask: "Mask",
  loupe: "Loupe",
  text: "Text",
  crop: "Rectangular Selection",
  ellipse: "Elliptical Selection",
  lasso: "Lasso Selection",
  smartLasso: "Smart Lasso",
  note: "Note",
};

const SHAPE_GLYPHS: Partial<Record<Tool, PreviewGlyphName>> = {
  line: "line",
  arrow: "arrow",
  rect: "rectangle",
  oval: "oval",
  star: "star",
  polygon: "polygon",
  bubble: "bubble",
  mask: "mask",
  loupe: "loupe",
};
const isOutline = (tool: Tool): tool is OutlineKind =>
  tool === "star" || tool === "polygon" || tool === "bubble";
const isBoxShape = (tool: Tool): tool is "rect" | "oval" | "line" | "arrow" | "mask" | "loupe" =>
  tool === "rect" ||
  tool === "oval" ||
  tool === "line" ||
  tool === "arrow" ||
  tool === "mask" ||
  tool === "loupe";
const isLasso = (tool: Tool) => tool === "lasso" || tool === "smartLasso";
const isSelection = (tool: Tool) => tool === "crop" || tool === "ellipse" || isLasso(tool);
/** Whether a mark takes a line style and a shadow. */
const isStyledLine = (mark: Pick<Mark, "kind">) =>
  mark.kind === "rect" ||
  mark.kind === "oval" ||
  mark.kind === "line" ||
  mark.kind === "arrow" ||
  mark.kind === "sketch";
const isLine = (mark: Pick<Mark, "kind">) => mark.kind === "line" || mark.kind === "arrow";
/** The longer side a picture is read at to find its edges. */
const EDGE_SAMPLE = 512;
/** The width of a rectangle dragged over marks, how small it may be before it chooses none, and its colour. */
const BAND_STROKE = 0.001;
const BAND_SLOP = 0.003;
const BAND_COLOR = "#007aff";

/** What the Highlights and Notes sidebar calls each kind of mark it lists. */
const ANNOTATION_NAMES: Partial<Record<Mark["kind"], string>> = {
  highlight: "Highlight",
  underline: "Underline",
  strikethrough: "Strikethrough",
  note: "Note",
};

/** The first colour of the Highlight menu, which Highlight Text takes until another is chosen. */
const FIRST_HIGHLIGHT: TextMarkStyle = {
  kind: "highlight",
  color: HIGHLIGHT_COLORS[0]?.value ?? "#fbe04d",
};
const UNDERLINE: TextMarkStyle = { kind: "underline", color: TEXT_LINE_COLOR };
const STRIKETHROUGH: TextMarkStyle = { kind: "strikethrough", color: TEXT_LINE_COLOR };
const HIGHLIGHT_BUTTON: CSSProperties = { width: "var(--mac-preview-app-highlight-width)" };

/** Why a row that a web page cannot carry out is dimmed. */
const NO_VERSIONS =
  "Save replaces a picture and puts the old one in the Trash, so here there are no earlier versions to go back to. Take the old one back from the Trash.";
const NO_TABS = "Windows on this desktop do not have tabs.";
const NO_IPHONE = "A web page cannot reach an iPhone connected to this computer.";
const NO_SCANNER = "A web page cannot reach a scanner connected to this computer.";
const NO_CAMERA = "A web page cannot read the pictures on a connected camera.";
const NO_PROFILE =
  "A browser draws a picture in the display’s colours and cannot change its colour profile.";
const NO_PRESSURE = "Draw needs a Force Touch trackpad’s pressure, which a web page cannot read.";
const NO_PAGE_CROP = "Only a picture has a selection to crop to here, not a PDF’s page.";
const ONLY_PDF_TEXT = "Only a PDF has text to mark.";
const NOT_LOCKED = "This document is not locked with a password.";
const ONLY_PICTURE_COLOR = "Only a picture’s colours can be adjusted, not a PDF’s pages.";
const NO_BOOKMARKS: readonly Bookmark[] = [];
const NO_TOOLS: readonly PreviewToolbarItem[] = [];
const NO_MARKS: readonly string[] = [];
const NO_FILES: readonly DriveEntry[] = [];
const NO_KEYWORDS: readonly string[] = [];

/** The dots per inch an exported PDF's pages can be drawn at. */
const EXPORT_RESOLUTIONS = [72, 100, 150, 200, 300];
/** A picture's folder on the drive, where New from Clipboard writes. */
const PICTURES = "pictures";
/** How much of a JPEG holds its EXIF segment: the segment is at the start and at most 64 KB. */
const EXIF_BYTES = 128 * 1024;

/** A picture's edits: what of it is kept (crop), how it is turned, and its size. */
interface ImageEdits {
  crop: Rect;
  /** Outlines it is also cut to: an elliptical or lasso selection cropped to. */
  clips: readonly (readonly Point[])[];
  /** Outlines cut out of it: a selection Edit > Cut took away. */
  cuts: readonly (readonly Point[])[];
  turns: Turns;
  /** Mirrored left to right, before it is turned. */
  mirrored: boolean;
  /** The saved picture's size as a share of the size the crop gives. */
  scale: number;
  /** How much its height goes beyond that share: Adjust Size out of proportion. */
  stretch: number;
  /** The pixels to the inch it says it has when saved; `null` says nothing. */
  dpi: number | null;
  color: ColorAdjust;
}

const NO_EDITS: ImageEdits = {
  crop: WHOLE_PAGE,
  clips: [],
  cuts: [],
  turns: 0,
  mirrored: false,
  scale: 1,
  stretch: 1,
  dpi: null,
  color: NO_ADJUST,
};

const editsChanged = (edits: ImageEdits) =>
  edits.turns !== 0 ||
  edits.mirrored ||
  edits.scale !== 1 ||
  edits.stretch !== 1 ||
  edits.dpi !== null ||
  edits.clips.length > 0 ||
  edits.cuts.length > 0 ||
  !isNeutral(edits.color) ||
  edits.crop.x !== 0 ||
  edits.crop.y !== 0 ||
  edits.crop.w !== 1 ||
  edits.crop.h !== 1;

/** The document open in the window. */
type OpenDocument =
  | {
      kind: "image";
      entry: DriveEntry;
      image: CanvasImageSource;
      width: number;
      height: number;
      /** Lets the picture go. */
      release: () => void;
    }
  | { kind: "pdf"; entry: DriveEntry; pdf: PdfFile; sizes: PdfPageSize[] };

interface Snapshot {
  markup: Markup;
  edits: ImageEdits;
}

/** A mark of text being typed. */
interface Typing {
  page: number;
  point: Point;
  value: string;
  /** The mark it replaces, when an existing text is edited. */
  replaces?: Mark;
}

/** A note being written. */
interface Noting {
  page: number;
  /** Where its icon is centred, in page space. */
  center: Point;
  value: string;
  /** The note it replaces, when an existing one is edited. */
  replaces?: Mark;
}

/** What the pointer is doing on a page. */
type Gesture =
  | { kind: "draw"; page: number; from: Point; points: Point[] }
  | { kind: "move"; page: number; from: Point; mark: Mark; marks: readonly Mark[] }
  | { kind: "band"; page: number; from: Point }
  | { kind: "resize"; page: number; mark: Mark; handle: number }
  | { kind: "crop"; from: Point; lasso?: Point[] };

type SheetName =
  | "open"
  | "insert"
  | "export"
  | "resize"
  | "signature"
  | "page"
  | "rename"
  | "move"
  | "password";
/** A locked PDF waiting for its password. */
interface Locked {
  file: DriveEntry;
  place?: Place;
  wrong: boolean;
}
/** The pages gone to in a document, for Go > Back and Forward. */
const NO_TRAIL = { back: [], forward: [] };

export interface PreviewAppProps extends Omit<WindowProps, "children" | "title"> {
  /**
   * Where files are read and written. Without one, the window is the demo of the reference
   * captures (`Preview`), which opens no file.
   * @default the person's drive where the desktop app serves the page, otherwise none
   */
  drive?: PreviewDrive | null;
  /**
   * Whether the desktop's Ferrite application keeps the markup and the signatures.
   * @default whether the desktop app serves the page (`servedByDesktopApp()`)
   */
  served?: boolean;
  /**
   * Opens a PDF, with its password when it is locked with one.
   * @default pdf.js, loaded when the first PDF is opened
   */
  loadPdf?: (blob: Blob, password?: string) => Promise<PdfFile>;
  /**
   * Decodes a picture.
   * @default the browser's own decoder (an `<img>`)
   */
  loadImage?: (
    blob: Blob,
  ) => Promise<{ image: CanvasImageSource; width: number; height: number; release: () => void }>;
  onClose?: WindowControlsProps["onClose"];
  onMinimize?: WindowControlsProps["onMinimize"];
  onZoom?: WindowControlsProps["onZoom"];
  zoomRole?: WindowControlsProps["zoomRole"];
  minimizeDisabled?: boolean;
  zoomDisabled?: boolean;
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
  /** Given by the desktop to an app with shared settings; this one has none. */
  // biome-ignore lint/suspicious/noExplicitAny: the desktop's settings type is each app's own.
  settings?: any;
  /** What the desktop was asked to open this further window for. */
  opening?: PreviewOpening;
}

const openPdfWithPdfJs = async (blob: Blob, password?: string) =>
  (await import("./preview-pdf")).openPdf(blob, password);

/** Decodes a picture with an `<img>`, which reads every format the browser shows. */
async function decodeImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("The picture could not be read: its format may not be one this browser shows.");
  }
  return {
    image,
    width: image.naturalWidth || 1,
    height: image.naturalHeight || 1,
    release: () => URL.revokeObjectURL(url),
  };
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const signaturesFullMessage = `Preview keeps at most ${MARKUP_LIMITS.signatures} signatures. Delete them (Sign → Delete All Signatures) to make another; none is removed for you.`;

/**
 * Preview as the desktop runs it: open a picture or a PDF from the person's drive, zoom, turn it,
 * crop and resize a picture, mark it up with shapes, text, sketches and signatures, find text in
 * a PDF, and save or export the result to the drive or to the computer. Where no drive is given
 * (the documentation site), it is the demo of the reference captures.
 */
export function PreviewApp({
  drive: givenDrive,
  served = servedByDesktopApp(),
  loadPdf = openPdfWithPdfJs,
  loadImage = decodeImage,
  settings: _settings,
  opening,
  ...props
}: PreviewAppProps) {
  // The window saves for the session it opened in, whoever signs in elsewhere meanwhile.
  const [ownDrive] = useState(defaultPreviewDrive);
  const drive = givenDrive === undefined ? ownDrive : givenDrive;
  const onDesktop = Boolean(use(DesktopWindowHostContext)) && served;
  if (!drive) return <Preview {...props} />;
  const shared = { drive, served, loadPdf, loadImage, ...props };
  return onDesktop ? (
    <PreviewOnDesktop {...shared} opening={opening} />
  ) : (
    <PreviewDocumentWindow {...shared} />
  );
}

/** A window of the desktop lists itself among Preview's windows and forgets its file as it closes. */
function PreviewOnDesktop({ opening, ...props }: DocumentWindowProps) {
  const { id } = useManagedWindow();
  const { focus } = useWindowManager();
  const self = useRef<OpenPreviewWindow>({
    id,
    file: opening?.kind === "file" ? opening.file.id : opening?.files[0]?.id,
    focus: () => {},
  });
  self.current.focus = () => focus(id);
  // Before the window's effects, which ask whether it is the one that takes files sent to Preview.
  useLayoutEffect(() => registerPreviewWindow(self.current), []);
  useEffect(() => () => forgetFileOf(id), [id]);
  return <PreviewDocumentWindow {...props} opening={opening} self={self.current} />;
}

interface DocumentWindowProps
  extends Omit<PreviewAppProps, "drive" | "served" | "loadPdf" | "loadImage"> {
  drive: PreviewDrive;
  served: boolean;
  loadPdf: NonNullable<PreviewAppProps["loadPdf"]>;
  loadImage: NonNullable<PreviewAppProps["loadImage"]>;
  /** On the desktop: this window among Preview's, each holding a file of its own. */
  self?: OpenPreviewWindow;
}

function PreviewDocumentWindow({
  drive,
  served,
  loadPdf,
  loadImage,
  opening,
  self,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  onKeyDown,
  state = "key",
  className,
  ...windowProps
}: DocumentWindowProps) {
  const [opened, setDoc] = useState<OpenDocument | null>(null);
  const [markup, setMarkup] = useState<Markup>(EMPTY_MARKUP);
  // The document as the window shows it: a PDF's pages in the order its markup keeps.
  const doc = useMemo<OpenDocument | null>(() => {
    const order = opened?.kind === "pdf" ? heldOrder(markup.order, opened.sizes.length) : undefined;
    return opened?.kind === "pdf" && order
      ? { ...opened, ...pagedPdf(opened.pdf, opened.sizes, order) }
      : opened;
  }, [opened, markup.order]);
  const [edits, setEdits] = useState<ImageEdits>(NO_EDITS);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [copied, setCopied] = useState<readonly Mark[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [zoom, setZoom] = useState(1);
  const [display, setDisplay] = useState<PageDisplay>("continuous");
  // What the contact sheet returns to when a page is chosen on it.
  const beforeContact = useRef<PageDisplay>("continuous");
  const [sidebar, setSidebar] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<Exclude<SidebarChoice, "hidden">>("thumbnails");
  const [keptSidebar, keepSidebar] = useDesktopSetting<SidebarChoice>(
    PREVIEW_SETTINGS.sidebar,
    readSidebar,
    "thumbnails",
  );
  const [keptWidth, keepWidth] = useDesktopSetting(
    PREVIEW_SETTINGS.sidebarWidth,
    readSidebarWidth,
    180,
  );
  const [sidebarWidth, setSidebarWidth] = useState(keptWidth);
  useEffect(() => setSidebarWidth(keptWidth), [keptWidth]);
  // Kept once a drag of the divider has come to rest, not for each point it passes.
  useEffect(() => {
    if (sidebarWidth === keptWidth) return;
    const timer = setTimeout(() => keepWidth(sidebarWidth), 400);
    return () => clearTimeout(timer);
  }, [sidebarWidth, keptWidth, keepWidth]);
  const pdfOpen = opened?.kind === "pdf";
  // The settings can arrive after a PDF has opened on launch.
  useEffect(() => {
    if (!pdfOpen) return;
    setSidebar(keptSidebar !== "hidden");
    if (keptSidebar !== "hidden") setSidebarMode(keptSidebar);
  }, [pdfOpen, keptSidebar]);
  const [bookmarks, setBookmarks] = useDesktopSetting(
    PREVIEW_SETTINGS.bookmarks,
    readBookmarks,
    NO_BOOKMARKS,
  );
  const [imageBackground] = useDesktopSetting(PREVIEW_SETTINGS.imageBackground, readColor, "");
  const [pdfBackground] = useDesktopSetting(PREVIEW_SETTINGS.pdfBackground, readColor, "");
  const [imageScale] = useDesktopSetting<ScaleChoice>(
    PREVIEW_SETTINGS.imageScale,
    readScale,
    "pixel",
  );
  const [pdfScale] = useDesktopSetting<ScaleChoice>(PREVIEW_SETTINGS.pdfScale, readScale, "pixel");
  const [adjusting, setAdjusting] = useState(false);
  // Whether the sliders opened now have made their one change for Undo yet.
  const adjustRemembered = useRef(false);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ page: number; count: number; snippet: string }[]>([]);
  const [sort, setSort] = useState<PreviewSort>("page");
  const sortLabel = useId();
  const [toolbarShown, setToolbarShown] = useState(true);
  const [magnifier, setMagnifier] = useState(false);
  const [slideshow, setSlideshow] = useState(false);
  const [locked, setLocked] = useState<Locked | null>(null);
  const [outline, setOutline] = useState<PdfOutlineEntry[]>([]);
  const [exif, setExif] = useState<ExifFacts>({});
  const [exportQuality, setExportQuality] = useState(JPEG_QUALITY);
  const [exportDpi, setExportDpi] = useState(150);
  // The markup as it was when the document opened, or was last saved: File > Revert To > Last Saved.
  const savedMarkup = useRef<Markup>(EMPTY_MARKUP);
  // A copy's markup, kept for the copy once its own (none) has loaded: File > Duplicate.
  const carried = useRef<{ file: string; markup: Markup } | null>(null);
  const [markupBar, setMarkupBar] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useDesktopSetting(PREVIEW_SETTINGS.color, readColor, "#ff3b30");
  const [fillChoice, setFillChoice] = useDesktopSetting(PREVIEW_SETTINGS.fill, readFill, "none");
  const fill = fillChoice === "none" ? null : fillChoice;
  const [stroke, setStroke] = useDesktopSetting(PREVIEW_SETTINGS.stroke, readStroke, 0.004);
  const [textSize, setTextSize] = useDesktopSetting(PREVIEW_SETTINGS.textSize, readTextSize, 0.03);
  const [fontsShown, setFontsShown] = useState(false);
  const [dash, setDash] = useDesktopSetting<MarkDash | "solid">(
    PREVIEW_SETTINGS.dash,
    readDash,
    "solid",
  );
  const [shadow, setShadow] = useDesktopSetting(PREVIEW_SETTINGS.shadow, readShadow, false);
  const [arrowEnds, setArrowEnds] = useDesktopSetting<ArrowEnds | "tool">(
    PREVIEW_SETTINGS.arrowEnds,
    readArrowEnds,
    "tool",
  );
  const [textFont, setTextFont] = useDesktopSetting<NonNullable<Mark["font"]> | "system">(
    PREVIEW_SETTINGS.font,
    readFont,
    "system",
  );
  const [textAlign, setTextAlign] = useDesktopSetting<NonNullable<Mark["align"]>>(
    PREVIEW_SETTINGS.align,
    readAlign,
    "left",
  );
  const [textBold, setTextBold] = useDesktopSetting(PREVIEW_SETTINGS.bold, readBoolean, false);
  const [textItalic, setTextItalic] = useDesktopSetting(
    PREVIEW_SETTINGS.italic,
    readBoolean,
    false,
  );
  const [textUnderline, setTextUnderline] = useDesktopSetting(
    PREVIEW_SETTINGS.underline,
    readBoolean,
    false,
  );
  const [hiddenTools, setHiddenTools] = useDesktopSetting<readonly PreviewToolbarItem[]>(
    PREVIEW_SETTINGS.hiddenTools,
    readHiddenTools,
    NO_TOOLS,
  );
  const [customizing, setCustomizing] = useState(false);
  const toolShown = (item: PreviewToolbarItem) => !hiddenTools.includes(item);
  // The marks chosen, the last one chosen at the end: it is the one a single-mark command acts on.
  const [chosenMarks, setChosenMarks] = useState<readonly string[]>(NO_MARKS);
  const selected = chosenMarks.at(-1) ?? null;
  const setSelected = useCallback(
    (id: string | null) => setChosenMarks(id === null ? NO_MARKS : [id]),
    [],
  );
  // How far the marks being moved are, in page space.
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  // Pictures that share the window, each with a thumbnail in the sidebar.
  const [gallery, keepGallery] = useState<readonly DriveEntry[]>(NO_FILES);
  const galleryNow = useRef<readonly DriveEntry[]>(NO_FILES);
  const setGallery = useCallback((files: readonly DriveEntry[]) => {
    galleryNow.current = files;
    keepGallery(files);
  }, []);
  // Whether a PDF's form fields hold what its file does not yet.
  const [formFilled, setFormFilled] = useState(false);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [draft, setDraft] = useState<Mark | null>(null);
  const [typing, setTyping] = useState<Typing | null>(null);
  const [noting, setNoting] = useState<Noting | null>(null);
  // Whether a drag over a PDF's text marks it as it is let go, and how.
  const [highlighting, setHighlighting] = useState(false);
  const [textMarkStyle, setTextMarkStyle] = useState<TextMarkStyle>(FIRST_HIGHLIGHT);
  const [highlightStyle, setHighlightStyle] = useState<TextMarkStyle>(FIRST_HIGHLIGHT);
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  // The outline of an elliptical or lasso selection, in place of `cropRect`'s box.
  const [cropOutline, setCropOutline] = useState<readonly Point[] | null>(null);
  const shownOutline = cropRect ? cropOutline : null;
  // A screenshot from a selection: the selection is made in the window it opens in.
  const selectOnOpen = useRef(false);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [trail, setTrail] = useState<{ back: number[]; forward: number[] }>(NO_TRAIL);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("jpeg");
  const [busy, setBusy] = useState<{ label: string; fraction: number | null } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  // Where each file opened was left, newest first: Open Recent, and the reopening on launch.
  const [places, setPlaces] = useState<Place[]>([]);
  // Explicit opens can finish before the initial places read; apply them after hydration.
  const pendingPlaces = useRef<Place[]>([]);
  const [inspector, setInspector] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const viewport = useRef<HTMLDivElement | null>(null);
  const [viewportElement, setViewportElement] = useState<HTMLDivElement | null>(null);
  const attachViewport = useCallback((element: HTMLDivElement | null) => {
    viewport.current = element;
    setViewportElement(element);
  }, []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // On launch the document last opened reopens where it was left, as a Mac resumes Preview; the
  // Open dialog shows only when there is none to reopen (or it is no longer on the drive). The
  // places are read first, from the desktop app where it keeps them.
  const launched = useRef(false);
  const reopenLast = useRef<(place: Place) => void>(() => {});
  const openingRef = useRef<(asked: PreviewOpening) => void>(() => {});
  const placesLoading = useServerState({
    url: PREVIEW_PLACES_URL,
    enabled: served,
    value: places,
    onLoad: (stored) => {
      const loaded = placesFromServer(stored);
      if (!loaded) return false;
      setPlaces(loaded);
    },
    toBody: placesToServer,
  });
  useEffect(() => {
    if (launched.current || placesLoading) return;
    launched.current = true;
    if (opening) {
      openingRef.current(opening);
      return;
    }
    // A window that comes back after a reload shows what it showed, wherever it had got to.
    const kept = self && keptFileOf(self.id);
    const last = kept
      ? (places.find((place) => place.file === kept) ?? {
          file: kept,
          name: "The document",
          page: 1,
          zoom: 1,
          opened_ms: 0,
        })
      : places[0];
    if (last && !(self && otherWindowWithFile(last.file, self))) reopenLast.current(last);
    else setSheet("open");
  }, [placesLoading, places, opening, self]);

  // The picture or PDF is let go when another is opened or the window closes; a change of its name
  // or folder is the same picture.
  const resource = opened?.kind === "image" ? opened.image : opened?.pdf;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `opened` holds `resource`, and is read for what lets it go.
  useEffect(() => {
    if (!opened) return;
    return () => {
      if (opened.kind === "image") opened.release();
      else opened.pdf.destroy();
    };
  }, [resource]);

  const entry = doc?.entry ?? null;
  const entryId = entry?.id;
  useEffect(() => {
    if (!self || !entryId) return;
    self.file = entryId;
    keepFileOf(self.id, entryId);
  }, [self, entryId]);
  const markupLoading = useServerState({
    url: `${PREVIEW_MARKUP_URL}/${entry?.id ?? "none"}`,
    enabled: served && entry !== null,
    value: markup,
    onLoad: (stored) => {
      const loaded = markupFromServer(stored);
      if (!loaded) return false;
      setMarkup(loaded);
      savedMarkup.current = loaded;
    },
    toBody: markupToServer,
    // A page's marks are named by the page's number, and each mark by its id.
    merge: mergeByKeys("id", "page"),
  });
  useEffect(() => {
    const now = carried.current;
    if (!now || markupLoading || entry?.id !== now.file) return;
    carried.current = null;
    setMarkup(now.markup);
    savedMarkup.current = now.markup;
  }, [markupLoading, entry]);
  const signaturesLoading = useServerState({
    url: PREVIEW_SIGNATURES_URL,
    enabled: served,
    value: signatures,
    onLoad: (stored) => {
      const loaded = signaturesFromServer(stored);
      if (!loaded) return false;
      setSignatures(loaded);
    },
    toBody: signaturesToServer,
  });
  const loading = markupLoading || signaturesLoading;

  // One operation (opening, saving, exporting, downloading) at a time, from the moment it is
  // asked for, before its first render shows it.
  const operating = useRef(false);
  const exclusive = async <T,>(task: () => Promise<T>): Promise<T | undefined> => {
    if (operating.current) return undefined;
    operating.current = true;
    try {
      return await task();
    } finally {
      operating.current = false;
    }
  };
  // Nothing changes the document or the signatures while an operation runs, or before the
  // markup and signatures kept for them have loaded (they would replace the change).
  const blocked = () => operating.current || busy !== null || loading;
  const blockedNow = busy !== null || loading;
  // Changes to a picture that live only in this window until it is saved, and markup too when
  // the desktop app does not keep it.
  const editsUnsaved =
    (doc?.kind === "image" && editsChanged(edits)) ||
    // Text being typed (a new text, or a change to one) is kept nowhere yet.
    (typing !== null &&
      (typing.replaces !== undefined
        ? typing.value !== (typing.replaces.text ?? "")
        : typing.value.trim() !== "")) ||
    (noting !== null && noting.value !== (noting.replaces?.text ?? "")) ||
    formFilled ||
    (doc !== null &&
      !served &&
      (markup.rotation !== 0 ||
        markup.turns !== undefined ||
        markup.pages.some((entry) => entry.items.length > 0)));
  // What waits on the answer to “Do you want to save the changes?”.
  const [leaving, setLeaving] = useState<{ proceed: () => void } | null>(null);
  // Leaving the page (a reload, another address, closing the tab) would lose them too: the
  // browser asks first.
  useEffect(() => {
    if (!editsUnsaved) return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [editsUnsaved]);

  useEffect(() => {
    const element = viewportElement;
    if (!element) return;
    const measure = () =>
      setViewportSize({ width: element.clientWidth || 800, height: element.clientHeight || 600 });
    measure();
    return observeResize(element, measure);
  }, [viewportElement]);

  // A pinch on a trackpad comes to a page as a wheel with Control held, and in Safari as gestures.
  useEffect(() => {
    const element = viewportElement;
    if (!element) return;
    const pinched = (factor: number) =>
      setZoom((now) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, now * factor)));
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      pinched(Math.exp(-event.deltaY * 0.01));
    };
    let last = 1;
    const gestureStart = (event: Event) => {
      event.preventDefault();
      last = 1;
    };
    const gestureChange = (event: Event) => {
      event.preventDefault();
      const { scale } = event as Event & { scale: number };
      pinched(scale / last);
      last = scale;
    };
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("gesturestart", gestureStart);
    element.addEventListener("gesturechange", gestureChange);
    return () => {
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("gesturestart", gestureStart);
      element.removeEventListener("gesturechange", gestureChange);
    };
  }, [viewportElement]);

  /* The document's geometry. */

  const pdf = doc?.kind === "pdf" ? doc : null;
  const pageCount = pdf ? pdf.sizes.length : doc ? 1 : 0;
  const pdfFile = pdf?.pdf ?? null;
  useEffect(() => {
    if (!pdfFile) {
      setOutline([]);
      return;
    }
    let live = true;
    pdfFile.outline().then(
      (found) => {
        if (live) setOutline(found);
      },
      () => {
        if (live) setOutline([]);
      },
    );
    return () => {
      live = false;
    };
  }, [pdfFile]);
  const view: View = useMemo(
    () =>
      doc?.kind === "image"
        ? { crop: edits.crop, turns: edits.turns, mirrored: edits.mirrored, clips: edits.clips }
        : { crop: WHOLE_PAGE, turns: markup.rotation },
    [doc, edits.crop, edits.turns, edits.mirrored, edits.clips, markup.rotation],
  );
  const pageViews = useMemo<readonly View[]>(
    () => ([0, 1, 2, 3] as const).map((turns) => ({ crop: WHOLE_PAGE, turns })),
    [],
  );
  /** What the window shows of page `number`: a PDF's pages each stand at a turn of their own. */
  const viewOf = useCallback(
    (number: number): View =>
      doc?.kind === "pdf"
        ? (pageViews[pageTurns({ rotation: markup.rotation, turns: markup.turns }, number)] ?? view)
        : view,
    [doc, pageViews, view, markup.rotation, markup.turns],
  );
  const sourceOf = useCallback(
    (number: number) =>
      doc?.kind === "image"
        ? { width: doc.width, height: doc.height * edits.stretch }
        : (pdf?.sizes[number - 1] ?? { width: 612, height: 792 }),
    [doc, pdf, edits.stretch],
  );
  /** The width a page is drawn at on the screen. */
  const cssWidthOf = useCallback(
    (number: number) => {
      const shown = viewSize(sourceOf(number).width, sourceOf(number).height, viewOf(number));
      const margin = 32;
      // A PDF's Two Pages share the width, with the gap between them; Single Page and Two Pages
      // fit the height too, as a picture does, so that the page shows whole.
      const layout = doc?.kind === "pdf" ? display : "continuous";
      const room = Math.max(
        120,
        layout === "two"
          ? (viewportSize.width - margin - PAGE_GAP) / 2
          : viewportSize.width - margin,
      );
      const fit =
        doc?.kind === "image" || layout === "single" || layout === "two"
          ? Math.min(
              room,
              Math.max(120, viewportSize.height - margin) * (shown.width / shown.height),
            )
          : room;
      return Math.max(24, fit * zoom);
    },
    [doc, display, sourceOf, viewOf, viewportSize, zoom],
  );

  /* Changes, with undo. */

  const remember = () => {
    setHistory((past) => [...past.slice(-(HISTORY - 1)), { markup, edits }]);
    setFuture([]);
  };
  /** Changes the markup; answers whether it did (not while blocked, nor past the limits). */
  const changeMarkup = (next: Markup): boolean => {
    if (blocked()) return false;
    if (!withinLimits(next)) {
      setFailure(
        `A file keeps at most ${MARKUP_LIMITS.marks} marks of markup; remove some before adding more.`,
      );
      return false;
    }
    remember();
    setMarkup(next);
    return true;
  };
  const changeMarks = (number: number, items: readonly Mark[]): boolean =>
    changeMarkup(withMarks(markup, number, items));
  const changeEdits = (next: ImageEdits) => {
    if (blocked()) return;
    remember();
    setEdits(next);
  };
  const undo = () => {
    const last = history.at(-1);
    if (!last || blocked()) return;
    setHistory(history.slice(0, -1));
    setFuture((later) => [...later, { markup, edits }]);
    setMarkup(last.markup);
    setEdits(last.edits);
    setSelected(null);
  };
  const redo = () => {
    const next = future.at(-1);
    if (!next || blocked()) return;
    setFuture(future.slice(0, -1));
    setHistory((past) => [...past, { markup, edits }]);
    setMarkup(next.markup);
    setEdits(next.edits);
    setSelected(null);
  };

  /* Opening. */

  // The page to show once a document reopened at its place has been laid out.
  const restoreTo = useRef<number | null>(null);

  const open = (file: DriveEntry, place?: Place, password?: string) =>
    exclusive(async () => {
      // The list of places answering later must not put the Open sheet over this document.
      launched.current = true;
      if (self) self.file = file.id;
      setSheet(null);
      setFailure(null);
      setNotice(null);
      const label = `Opening “${file.name}”…`;
      setBusy({ label, fraction: 0 });
      try {
        const blob = await drive.read(file.id, (fraction) =>
          setBusy({ label, fraction: Math.min(1, fraction) }),
        );
        if (!mounted.current) return;
        setBusy({ label, fraction: null });
        let next: OpenDocument;
        let facts: ExifFacts = {};
        if (isPdf(file)) {
          const opened = await loadPdf(blob, password);
          let sizes: PdfPageSize[];
          try {
            sizes = await Promise.all(
              Array.from({ length: opened.pageCount }, (_, index) => opened.size(index + 1)),
            );
          } catch (error) {
            opened.destroy();
            throw error;
          }
          next = { kind: "pdf", entry: file, pdf: opened, sizes };
          if (served && password === undefined) void keepPdfWords(file.id, opened);
        } else {
          const decoded = await loadImage(blob);
          next = { kind: "image", entry: file, ...decoded };
          if (saveFormatOf(file) === "image/jpeg") {
            facts = readExif(new Uint8Array(await blob.slice(0, EXIF_BYTES).arrayBuffer()));
          }
        }
        if (!mounted.current) {
          if (next.kind === "image") next.release();
          else next.pdf.destroy();
          return;
        }
        setDoc(next);
        setLocked(null);
        setExif(facts);
        setFormFilled(false);
        // Pictures that share the window stay together as one of them is shown.
        const sharing = galleryNow.current.some((each) => each.id === file.id);
        if (!sharing) setGallery(NO_FILES);
        savedMarkup.current = EMPTY_MARKUP;
        setChosenPages([]);
        draggedPages.current = null;
        setMarkup(EMPTY_MARKUP);
        setEdits(NO_EDITS);
        setHistory([]);
        setFuture([]);
        setTrail(NO_TRAIL);
        // Where it was left, when it is reopened from its place: the page within the document,
        // the zoom within the range of the buttons.
        const keptPage = Math.min(
          Math.max(1, place?.page ?? 1),
          next.kind === "pdf" ? next.sizes.length : 1,
        );
        const keptZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, place?.zoom ?? 1));
        setZoom(keptZoom);
        setPage(keptPage);
        setDisplay(next.kind === "pdf" ? (place?.display ?? "continuous") : "continuous");
        beforeContact.current = "continuous";
        restoreTo.current = keptPage > 1 ? keptPage : null;
        setQuery("");
        setResults([]);
        setSelected(null);
        setTyping(null);
        setNoting(null);
        setHighlighting(false);
        setCropRect(null);
        setAdjusting(false);
        setSidebar((next.kind === "pdf" && keptSidebar !== "hidden") || sharing);
        setSidebarMode(
          next.kind === "pdf" && keptSidebar !== "hidden" ? keptSidebar : "thumbnails",
        );
        const selecting = selectOnOpen.current && next.kind === "image";
        selectOnOpen.current = false;
        setMarkupBar((shown) => shown || selecting);
        setTool(selecting ? "crop" : "select");
        drive.opened(file.id);
        pendingPlaces.current = openedPlace(pendingPlaces.current, {
          file: file.id,
          name: file.name,
          page: keptPage,
          zoom: keptZoom,
          opened_ms: Date.now(),
        });
      } catch (error) {
        const refusal = passwordRefusal(error);
        if (refusal && mounted.current) {
          setLocked({ file, ...(place ? { place } : {}), wrong: refusal === "wrong" });
          setSheet("password");
        } else if (mounted.current) {
          if (self) self.file = opened?.entry.id;
          setFailure(`“${file.name}” could not be opened. ${messageOf(error)}`);
        }
      } finally {
        if (mounted.current) setBusy(null);
      }
    });

  /**
   * Opens `file`, first asking about changes to the picture that are not saved. Refused only
   * while an operation runs: the markup of the file open now still loading does not keep
   * another file from opening, which replaces it.
   */
  const requestOpen = (file: DriveEntry) => {
    if (operating.current || busy !== null) return;
    if (editsUnsaved) {
      setSheet(null);
      setLeaving({ proceed: () => void open(file) });
    } else {
      void open(file);
    }
  };

  /**
   * On the desktop a file has a window of its own: the one that has it comes to the front, and a
   * window that already holds a document leaves it there and asks for another. False when the file
   * is to open in this window.
   */
  const sendElsewhere = (file: PreviewFileRef, place?: Place): boolean => {
    if (!self) return false;
    const there = otherWindowWithFile(file.id, self);
    if (there) {
      setSheet(null);
      there.focus();
      return true;
    }
    if (opened?.entry.id === file.id) {
      setSheet(null);
      return true;
    }
    if (!opened && !operating.current && busy === null) return false;
    setSheet(null);
    requestDesktopEffects([
      {
        newWindow: "preview",
        opening: {
          kind: "file",
          file: { id: file.id, name: file.name },
          ...(place ? { place } : {}),
        } satisfies PreviewOpening,
      },
    ]);
    return true;
  };
  /** A file chosen or sent: here, or in the window it should have. */
  const routeOpen = (file: DriveEntry) => {
    if (!sendElsewhere(file)) requestOpen(file);
  };
  /** Pictures chosen together share a window, and each PDF has one to itself. */
  const routeSeveral = (files: readonly DriveEntry[]) => {
    const first = files[0];
    if (!first) return;
    if (files.length > 1 && files.every((each) => !isPdf(each))) {
      if (opened || operating.current || busy !== null) {
        setSheet(null);
        requestDesktopEffects([
          {
            newWindow: "preview",
            opening: {
              kind: "pictures",
              files: files.map(({ id, name }) => ({ id, name })),
            } satisfies PreviewOpening,
          },
        ]);
        return;
      }
      setGallery(files);
      requestOpen(first);
      return;
    }
    routeOpen(first);
    // This window may only now have started on the first.
    for (const each of files.slice(1)) {
      if (self && !otherWindowWithFile(each.id, self)) {
        requestDesktopEffects([
          {
            newWindow: "preview",
            opening: {
              kind: "file",
              file: { id: each.id, name: each.name },
            } satisfies PreviewOpening,
          },
        ]);
      }
    }
  };

  // Files sent to Preview (a double-click in Finder, Quick Look's Open with Preview). One asked for
  // before the window was there opens instead of the last place; one asked for later opens as a
  // choice in the Open sheet does. A file the drive no longer has is said so.
  const routeOpenRef = useRef(routeOpen);
  routeOpenRef.current = routeOpen;
  const routeSeveralRef = useRef(routeSeveral);
  routeSeveralRef.current = routeSeveral;
  const driveOf = useRef(drive);
  driveOf.current = drive;
  const openAsked = useRef(async ({ id, name }: Pick<OpenFileRequest, "id" | "name">) => {
    let found: DriveEntry | undefined;
    try {
      found = await driveOf.current.current(id);
    } catch (error) {
      if (mounted.current) {
        setFailure(
          `“${name}” could not be opened: the drive could not be reached. ${messageOf(error)}`,
        );
      }
      return;
    }
    if (!mounted.current) return;
    if (found) routeOpenRef.current(found);
    else setNotice(`“${name}” is no longer on the drive.`);
  }).current;
  /** Several pictures asked for together: they share the window, and the first is shown. */
  const openTogether = async (asked: readonly Pick<OpenFileRequest, "id" | "name">[]) => {
    const found = await Promise.all(
      asked.map((each) => driveOf.current.current(each.id).catch(() => undefined)),
    );
    if (!mounted.current) return;
    const files = found.filter((each): each is DriveEntry => each !== undefined);
    const first = files[0];
    if (!first) {
      setNotice(`“${asked[0]?.name}” is no longer on the drive.`);
      return;
    }
    if (self) {
      routeSeveralRef.current(files);
      return;
    }
    setGallery(files.length > 1 ? files : NO_FILES);
    routeOpenRef.current(first);
  };
  const openTogetherRef = useRef(openTogether);
  openTogetherRef.current = openTogether;
  /** Files asked for at once: pictures share the window; of anything else, the first opens. */
  const openAskedAtOnce = useRef((asked: readonly OpenFileRequest[]) => {
    if (asked.length > 1 && asked.every((each) => !isPdf(each))) {
      void openTogetherRef.current(asked);
      return;
    }
    for (const each of asked) void openAsked(each);
  }).current;
  // A picture or PDF dropped from Finder or the desktop opens here; pictures dropped together share
  // the window, and of several PDFs the first opens.
  const dropRef = useDesktopDrop<HTMLDivElement>({
    enabled: served,
    accepts: (item) => item.kind === "file" && opensInPreview(item) && !item.bytes,
    onDrop: (items) => {
      const first = items[0];
      if (items.length > 1 && items.every((each) => !isPdf(each))) {
        void openTogether(items);
        return;
      }
      if (first) void openAsked(first);
      if (self) {
        for (const each of items.slice(1)) void openAsked(each);
      } else if (items.length > 1) {
        setNotice(`Preview opened “${first?.name}”: a PDF has a window to itself.`);
      }
    },
  });
  useEffect(() => {
    if (!served) return;
    const mine = () => !self || isFirstPreviewWindow(self);
    const asked = !opening && mine() ? takeOpenFileRequests("preview") : [];
    if (asked.length > 0) {
      launched.current = true;
      setSheet(null);
      openAskedAtOnce(asked);
    }
    // Finder sends what it opens one request at a time, in one go: those are taken together.
    let waiting: OpenFileRequest[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = onOpenFileRequest("preview", (request) => {
      if (!mine()) return;
      waiting.push(request);
      clearTimeout(timer);
      timer = setTimeout(() => {
        const now = waiting;
        waiting = [];
        openAskedAtOnce(now);
      });
    });
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [served, openAskedAtOnce, opening, self]);

  /**
   * Opens a file from its place (Open Recent, or the launch), at the page and zoom it was left at,
   * once the drive says it is still there. A file the drive no longer has is said so and its place
   * forgotten; a drive that cannot be reached keeps the place (nothing is known to be gone) and
   * says so, to try again. Either way the Open dialog shows on launch.
   */
  const reopen = async (place: Place) => {
    let found: DriveEntry | undefined;
    try {
      found = await drive.current(place.file);
    } catch (error) {
      if (!mounted.current) return;
      setFailure(
        `“${place.name}” could not be reopened: the drive could not be reached. ${messageOf(error)} Try again from File → Open Recent.`,
      );
      if (!doc) setSheet("open");
      return;
    }
    if (!mounted.current) return;
    if (!found) {
      setPlaces((list) => forgetPlace(list, place.file));
      setNotice(`“${place.name}” is no longer on the drive.`);
      setSheet("open");
      return;
    }
    await open(found, place);
  };
  reopenLast.current = (place) => void reopen(place);
  openingRef.current = (asked) => {
    if (asked.kind === "pictures") void openTogether(asked.files);
    else if (asked.place) void reopen(asked.place);
    else void openAsked(asked.file);
  };
  /** Open Recent: asks about changes to the picture that are not saved first. */
  const openRecent = (place: Place) => {
    if (operating.current || busy !== null) return;
    if (sendElsewhere({ id: place.file, name: place.name }, place)) return;
    if (editsUnsaved) setLeaving({ proceed: () => void reopen(place) });
    else void reopen(place);
  };

  /* Rendering for export and save. */

  /** The picture as it is now, edits and `marked` drawn in, `scale` times the crop's size. */
  const renderImage = (
    scale: number,
    opaque: boolean,
    marked: Markup,
    area: View = view,
  ): HTMLCanvasElement | null => {
    if (doc?.kind !== "image") return null;
    const height = doc.height * edits.stretch;
    const shown = viewSize(doc.width, height, area);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(shown.width * scale));
    canvas.height = Math.max(1, Math.round(shown.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    if (opaque) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.save();
    applyView(context, doc.width, height, area, canvas);
    context.drawImage(doc.image, 0, 0, doc.width, height);
    cutOut(context, edits.cuts, doc.width, height, opaque ? "#ffffff" : undefined);
    if (!isNeutral(edits.color)) adjustCanvas(context, canvas, edits.color);
    drawMarks(context, marksOf(marked, 1), doc.width, height, null, canvas);
    context.restore();
    return canvas;
  };

  /** Page `number` of the PDF as it is now, turned and `marked` up, at `scale` pixels a point. */
  const renderPdfPage = async (
    number: number,
    marked: Markup,
    scale = PDF_EXPORT_SCALE,
  ): Promise<HTMLCanvasElement> => {
    if (!pdf) throw new Error("No PDF is open.");
    const source = sourceOf(number);
    const pageView = viewOf(number);
    const shown = viewSize(source.width, source.height, pageView);
    const canvas = document.createElement("canvas");
    await pdf.pdf.render(number, canvas, shown.width * scale, pageView.turns, 1);
    const context = canvas.getContext("2d");
    if (context) {
      context.save();
      applyView(context, source.width, source.height, pageView, canvas);
      drawMarks(context, marksOf(marked, number), source.width, source.height, null, canvas);
      context.restore();
    }
    return canvas;
  };

  const jpegPage = async (
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
  ): Promise<PdfPage> => ({
    jpeg: new Uint8Array(
      await (await canvasBlob(canvas, "image/jpeg", JPEG_QUALITY)).arrayBuffer(),
    ),
    pixelWidth: canvas.width,
    pixelHeight: canvas.height,
    width,
    height,
  });

  /**
   * Print…: the browser's print dialog over the picture, or every page of the PDF, as it is now,
   * with its markup drawn in.
   */
  const printDocument = () =>
    exclusive(async () => {
      if (!doc) return;
      const target = doc.entry.name;
      setBusy({ label: `Preparing to print “${target}”…`, fraction: null });
      const made: string[] = [];
      try {
        const marked = markupWithTyping();
        const add = async (canvas: HTMLCanvasElement) =>
          made.push(URL.createObjectURL(await canvasBlob(canvas, "image/png")));
        if (doc.kind === "image") {
          const canvas = renderImage(edits.scale, true, marked);
          if (canvas) await add(canvas);
        } else {
          for (let number = 1; number <= pageCount; number += 1) {
            await add(await renderPdfPage(number, marked));
          }
        }
      } catch (error) {
        for (const url of made) URL.revokeObjectURL(url);
        if (mounted.current) setBusy(null);
        console.warn(`Preview could not prepare “${target}” to print (${error})`);
        if (mounted.current) setNotice(`“${target}” could not be printed.`);
        return;
      }
      if (mounted.current) setBusy(null);
      if (made.length === 0) return;
      printPictures(made, target, () => {
        for (const url of made) URL.revokeObjectURL(url);
      });
    });

  /**
   * The document as `format`: a picture of the picture or of the page shown, or a PDF, with the
   * markup, including the text being typed, drawn in. A PDF with nothing changed in it is its own
   * file, so its text and links stay; a changed one has each page as a JPEG picture with its text
   * laid invisibly over it, so it can still be selected and searched.
   */
  const exported = async (
    format: ExportFormat,
    quality = JPEG_QUALITY,
    scale = PDF_EXPORT_SCALE,
  ): Promise<Blob> => {
    if (!doc) throw new Error("No document is open.");
    const marked = markupWithTyping();
    const type = formatOf(format).type;
    const encoded = (canvas: HTMLCanvasElement) =>
      format === "tiff" ? Promise.resolve(canvasTiff(canvas)) : canvasBlob(canvas, type, quality);
    if (doc.kind === "image") {
      const canvas = renderImage(edits.scale, format === "jpeg" || format === "pdf", marked);
      if (!canvas) throw new Error("The picture could not be drawn.");
      if (format !== "pdf") return encoded(canvas);
      // A picture's page is its size in pixels, taken as points (72 to the inch).
      const one = await jpegPage(canvas, canvas.width, canvas.height);
      const words = typedRuns(
        marksOf(marked, 1),
        { width: doc.width, height: doc.height * edits.stretch },
        view,
        canvas.width,
        canvas.height,
      );
      return new Blob([writePdf([{ ...one, text: words }], doc.entry.name) as BlobPart], { type });
    }
    if (format !== "pdf") return encoded(await renderPdfPage(page, marked, scale));
    if (marked.rotation === 0 && !marked.turns && marked.pages.length === 0) {
      if (!marked.order) {
        if (formFilled && opened?.kind === "pdf") {
          return new Blob([(await opened.pdf.filled()) as BlobPart], { type });
        }
        return new Blob([await drive.read(doc.entry.id)], { type });
      }
      // Only the pages' order changed: written from the file itself, its text and links kept.
      const moved = formFilled ? null : await keptPagesPdf(marked.order);
      if (moved) return new Blob([moved as BlobPart], { type });
    }
    const pages: PdfPage[] = [];
    for (let number = 1; number <= pageCount; number += 1) {
      setBusy({
        label: `Exporting page ${number} of ${pageCount}…`,
        fraction: (number - 1) / pageCount,
      });
      const source = sourceOf(number);
      const shown = viewSize(source.width, source.height, viewOf(number));
      const picture = await jpegPage(
        await renderPdfPage(number, marked, scale),
        shown.width,
        shown.height,
      );
      const own = await pdf?.pdf.textRuns(number, viewOf(number).turns).catch((error: unknown) => {
        console.warn(`Preview could not read the text of page ${number} (${error})`);
        return [];
      });
      pages.push({
        ...picture,
        text: [
          ...(own ?? []),
          ...typedRuns(marksOf(marked, number), source, viewOf(number), shown.width, shown.height),
        ],
      });
    }
    return new Blob([writePdf(pages, doc.entry.name) as BlobPart], { type });
  };

  /**
   * A PDF of the file's pages in `order` with nothing drawn on them; `null` when the reader cannot
   * write one (a file locked with a password), when the pages are drawn as pictures instead.
   */
  const keptPagesPdf = async (order: readonly number[]): Promise<Uint8Array | null> => {
    if (opened?.kind !== "pdf") return null;
    const size = opened.sizes[0] ?? { width: 612, height: 792 };
    const blank = blankPdf(size.width, size.height);
    const parts = insertionParts(order, order.length, { bytes: blank, count: 0 }, blank).filter(
      (part) => part.pages.length > 0,
    );
    try {
      return await opened.pdf.combined(parts);
    } catch (error) {
      console.warn(`Preview wrote the pages as pictures: the reader refused (${error})`);
      return null;
    }
  };

  const exportTo = (target: DriveSaveTarget) =>
    exclusive(async () => {
      setSheet(null);
      if (!doc || loading) return;
      setBusy({ label: `Exporting “${target.name}”…`, fraction: null });
      try {
        const blob = await exported(exportFormat, exportQuality, exportDpi / 72);
        const kept =
          doc.kind === "image" && edits.dpi !== null ? await withResolution(blob, edits.dpi) : blob;
        setBusy({ label: `Saving “${target.name}”…`, fraction: null });
        const saved = await drive.save(target, kept);
        if (mounted.current) setNotice(`Exported “${saved.name}”.`);
      } catch (error) {
        if (mounted.current) setFailure(`The document could not be exported. ${messageOf(error)}`);
      } finally {
        if (mounted.current) setBusy(null);
      }
    });

  const download = (format: ExportFormat) =>
    exclusive(async () => {
      if (!doc || loading) return;
      setBusy({ label: "Preparing the download…", fraction: null });
      try {
        downloadBlob(await exported(format), nameFor(doc.entry.name, format));
      } catch (error) {
        if (mounted.current)
          setFailure(`The document could not be downloaded. ${messageOf(error)}`);
      } finally {
        if (mounted.current) setBusy(null);
      }
    });

  const imageEdited =
    doc?.kind === "image" && (editsChanged(edits) || marksOf(markup, 1).length > 0);

  /* The file: changing its place on the drive, copying it, starting one from the clipboard. */

  /** Opens `file` in this window, first asking about changes that are not saved. */
  const openOrAsk = (file: DriveEntry) => {
    if (editsUnsaved) setLeaving({ proceed: () => void open(file) });
    else void open(file);
  };

  /** Runs a change of the open file on the drive: the window then shows it under its new entry. */
  const changeFile = (
    task: (file: DriveEntry) => Promise<DriveEntry>,
    said: (file: DriveEntry) => string,
  ) =>
    exclusive(async () => {
      setSheet(null);
      if (!doc) return;
      try {
        const next = await task(doc.entry);
        if (!mounted.current) return;
        setDoc((now) =>
          now?.entry.id === next.id ? ({ ...now, entry: next } as OpenDocument) : now,
        );
        setGallery(galleryNow.current.map((each) => (each.id === next.id ? next : each)));
        setPlaces((list) =>
          list.map((place) => (place.file === next.id ? { ...place, name: next.name } : place)),
        );
        setNotice(said(next));
      } catch (error) {
        if (mounted.current) setFailure(`“${doc.entry.name}” was not changed. ${messageOf(error)}`);
      }
    });

  /**
   * File > Duplicate: a copy beside the file, “<name> copy”, which the window then shows. A picture
   * with changes is written as it is now, in PNG when its own format cannot be written; a PDF's
   * markup, kept beside the file, is carried to the copy.
   */
  const duplicate = async () => {
    const current = doc;
    if (!current || loading) return;
    const made = await exclusive(async () => {
      const extension = extensionOf(current.entry.name);
      const type = current.kind === "image" && imageEdited ? saveFormatOf(current.entry) : null;
      const flatten = current.kind === "image" && imageEdited;
      const name = `${stemOf(current.entry.name)} copy${
        flatten && !type ? ".png" : extension ? `.${extension}` : ""
      }`;
      setBusy({ label: `Duplicating “${current.entry.name}”…`, fraction: null });
      try {
        if (flatten) {
          const written = type ?? "image/png";
          const canvas = renderImage(edits.scale, written === "image/jpeg", markupWithTyping());
          if (!canvas) throw new Error("The picture could not be drawn.");
          return await drive.create(
            current.entry.parent ?? PICTURES,
            name,
            await canvasBlob(canvas, written),
          );
        }
        return await drive.duplicate(current.entry, name);
      } catch (error) {
        if (mounted.current)
          setFailure(`“${current.entry.name}” could not be duplicated. ${messageOf(error)}`);
        return undefined;
      } finally {
        if (mounted.current) setBusy(null);
      }
    });
    if (!made || !mounted.current) return;
    if (current.kind === "pdf" && markup !== EMPTY_MARKUP) {
      carried.current = { file: made.id, markup };
    } else if (markup.keywords) {
      carried.current = { file: made.id, markup: { ...EMPTY_MARKUP, keywords: markup.keywords } };
    }
    openOrAsk(made);
  };

  /** File > New from Clipboard: the picture copied, as a new file in Pictures, opened here. */
  const newFromClipboard = async () => {
    if (operating.current || busy !== null) return;
    let picture: Blob | undefined;
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((each) => each.startsWith("image/"));
        if (type) {
          picture = await item.getType(type);
          break;
        }
      }
    } catch (error) {
      setFailure(`This browser did not let Preview read the clipboard. ${messageOf(error)}`);
      return;
    }
    if (!picture) {
      setFailure("The clipboard holds no picture.");
      return;
    }
    const data = picture;
    const made = await exclusive(async () => {
      setBusy({ label: "Writing the clipboard’s picture…", fraction: null });
      try {
        return await drive.create(PICTURES, `Untitled.${data.type.split("/")[1] ?? "png"}`, data);
      } catch (error) {
        if (mounted.current)
          setFailure(`The clipboard’s picture could not be written. ${messageOf(error)}`);
        return undefined;
      } finally {
        if (mounted.current) setBusy(null);
      }
    });
    if (made && mounted.current && !sendElsewhere(made)) openOrAsk(made);
  };

  /** File > Take Screenshot: one frame of what the person shares, as a new file in Pictures. */
  const takeScreenshot = async (kind: ScreenshotKind) => {
    if (operating.current || busy !== null) return;
    let frame: Blob | null;
    try {
      frame = await captureScreen(kind);
    } catch (error) {
      if (mounted.current) setFailure(`The screen could not be captured. ${messageOf(error)}`);
      return;
    }
    if (!frame || !mounted.current) return;
    const data = frame;
    const made = await exclusive(async () => {
      setBusy({ label: "Writing the screenshot…", fraction: null });
      try {
        return await drive.create(PICTURES, screenshotName(new Date()), data);
      } catch (error) {
        if (mounted.current) setFailure(`The screenshot could not be written. ${messageOf(error)}`);
        return undefined;
      } finally {
        if (mounted.current) setBusy(null);
      }
    });
    if (!made || !mounted.current) return;
    selectOnOpen.current = kind === "selection";
    openOrAsk(made);
  };

  /**
   * Edit > Insert > Page from File, or a file dropped on the thumbnails: the pages of a PDF, or a
   * picture as a page, after page `after`. Text and links stay, in the new pages and the old. The
   * pages are written into the file, as on a Mac; the file as it was goes to the Trash.
   */
  const insertPagesOf = async (
    source: Pick<DesktopDragItem, "id" | "name" | "type" | "bytes">,
    after: number,
  ) => {
    if (opened?.kind !== "pdf" || blocked()) return;
    const current = opened;
    const made = await exclusive(async () => {
      setSheet(null);
      setBusy({ label: `Inserting “${source.name}”…`, fraction: null });
      try {
        const blob = await (source.bytes ? source.bytes() : drive.read(source.id));
        let bytes: Uint8Array;
        let count = 1;
        if (isPdf({ name: source.name, type: source.type ?? "" })) {
          const other = await loadPdf(blob);
          count = other.pageCount;
          other.destroy();
          bytes = new Uint8Array(await blob.arrayBuffer());
        } else {
          const picture = await loadImage(blob);
          try {
            const canvas = document.createElement("canvas");
            canvas.width = picture.width;
            canvas.height = picture.height;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("The picture could not be drawn.");
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(picture.image, 0, 0);
            const one = await jpegPage(canvas, picture.width, picture.height);
            bytes = writePdf([one], source.name);
          } finally {
            picture.release();
          }
        }
        const size = current.sizes[0] ?? { width: 612, height: 792 };
        const shown =
          heldOrder(markup.order, current.sizes.length) ??
          current.sizes.map((_, index) => index + 1);
        const written = await current.pdf.combined(
          insertionParts(shown, after, { bytes, count }, blankPdf(size.width, size.height)),
        );
        const saved = await drive.replace(
          current.entry,
          new Blob([written as BlobPart], { type: "application/pdf" }),
        );
        setPlaces((list) => forgetPlace(list, current.entry.id));
        return { saved, count };
      } catch (error) {
        if (mounted.current)
          setFailure(`“${source.name}” could not be inserted. ${messageOf(error)}`);
        return undefined;
      } finally {
        if (mounted.current) setBusy(null);
      }
    });
    if (!made || !mounted.current) return;
    carried.current = { file: made.saved.id, markup: afterInsertion(markup, after, made.count) };
    await open(made.saved, {
      file: made.saved.id,
      name: made.saved.name,
      page: after + 1,
      zoom,
      ...(display === "continuous" ? {} : { display }),
      opened_ms: Date.now(),
    });
    if (mounted.current) {
      setNotice(
        `Inserted ${made.count} ${made.count === 1 ? "page" : "pages"} from “${source.name}”. The PDF as it was is in the Trash.`,
      );
    }
  };

  /** A file brought from the computer: onto the drive, then opened, or inserted after a page. */
  const takeFromComputer = async (files: readonly File[], after: number | null) => {
    const first = files[0];
    if (!first || operating.current || busy !== null) return;
    if (!opensInPreview({ name: first.name, type: first.type })) {
      setNotice(`Preview can’t open “${first.name}”.`);
      return;
    }
    // Pictures brought together share the window.
    const together =
      after === null &&
      files.length > 1 &&
      files.every((file) => opensInPreview(file) && !isPdf(file));
    const made = await exclusive(async () => {
      setBusy({ label: `Copying “${first.name}” to the drive…`, fraction: null });
      try {
        const taken: DriveEntry[] = [];
        for (const file of together ? files : [first]) {
          taken.push(await drive.create(isPdf(file) ? "documents" : PICTURES, file.name, file));
        }
        return taken;
      } catch (error) {
        if (mounted.current) setFailure(`“${first.name}” could not be copied. ${messageOf(error)}`);
        return undefined;
      } finally {
        if (mounted.current) setBusy(null);
      }
    });
    const madeFirst = made?.[0];
    if (!made || !madeFirst || !mounted.current) return;
    if (together) setGallery(made);
    if (after === null) openOrAsk(madeFirst);
    else await insertPagesOf(madeFirst, after);
    if (files.length > 1 && !together && mounted.current) {
      setNotice(`Preview took “${first.name}”: one file at a time.`);
    }
  };

  /** The picture's selection as a canvas; the whole of what it keeps when none is made. */
  const selectionCanvas = () => {
    const area = cropRect ? intersect(cropRect, edits.crop) : null;
    return {
      area,
      canvas: renderImage(
        edits.scale,
        false,
        markupWithTyping(),
        area
          ? {
              ...view,
              crop: area,
              clips: shownOutline ? [...edits.clips, shownOutline] : edits.clips,
            }
          : view,
      ),
    };
  };

  /** A drag of the picture's selection out of the window: a PNG, written where it lands. */
  const selectionDragItem = (): DesktopDragItem => ({
    id: `preview-selection-${newMarkId()}`,
    name: `${stemOf(doc?.entry.name ?? "Preview")} selection.png`,
    kind: "file",
    type: "image/png",
    bytes: async () => {
      const { canvas } = selectionCanvas();
      if (!canvas) throw new Error("The picture could not be drawn.");
      return canvasBlob(canvas, "image/png");
    },
  });

  /** Edit > Copy with no mark chosen: the picture, or its selection, as PNG on the clipboard. */
  const copyPicture = (): Promise<boolean | undefined> =>
    exclusive(async () => {
      const { area, canvas } = selectionCanvas();
      if (!canvas) return false;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": canvasBlob(canvas, "image/png") }),
        ]);
        if (mounted.current) setNotice(area ? "Copied the selection." : "Copied the picture.");
        return true;
      } catch (error) {
        if (mounted.current)
          setFailure(`This browser did not let Preview copy the picture. ${messageOf(error)}`);
        return false;
      }
    });

  /**
   * Edit > Cut with a picture's selection: it goes to the clipboard and is taken out of the picture,
   * as one change to Undo. A clipboard that refuses leaves the picture whole.
   */
  const cutPicture = async () => {
    const area = cropRect ? intersect(cropRect, edits.crop) : null;
    if (doc?.kind !== "image" || !area) return;
    const outline: readonly Point[] = shownOutline ?? [
      [area.x, area.y],
      [area.x + area.w, area.y],
      [area.x + area.w, area.y + area.h],
      [area.x, area.y + area.h],
    ];
    if (!(await copyPicture()) || !mounted.current) return;
    changeEdits({ ...edits, cuts: [...edits.cuts, outline] });
    setCropRect(null);
    setCropOutline(null);
    setNotice("Cut the selection.");
  };

  /** File > Revert To > Last Saved: one more change, so that Undo brings the edits back. */
  const revertToSaved = () => {
    if (blocked()) return;
    remember();
    setMarkup(savedMarkup.current);
    setEdits(NO_EDITS);
    setSelected(null);
    setCropRect(null);
  };

  /**
   * Saves a picture in place, in its own format, with its edits and its markup drawn in, as
   * Preview flattens markup into a picture it saves. The file it replaces goes to the drive's
   * Trash, with its markup still kept beside it, so putting it back from the Trash brings its
   * markup back too; the saved picture is a new file, with none. A picture whose format cannot
   * be written (GIF, SVG) is exported instead. A PDF with its form fields filled is written with what
   * they hold, and shown again from the new file. Resolves whether it was saved in place.
   */
  const save = async (): Promise<boolean> => {
    if (formFilled && opened?.kind === "pdf") return saveFilledForm(opened);
    return (
      (await exclusive(async () => {
        // Saved only once its stored markup has loaded: the markup is drawn into the picture,
        // with the text being typed.
        if (doc?.kind !== "image" || (!imageEdited && !typing) || loading) return false;
        const type = saveFormatOf(doc.entry);
        if (!type) {
          setExportFormat("png");
          setSheet("export");
          return false;
        }
        setBusy({ label: `Saving “${doc.entry.name}”…`, fraction: null });
        try {
          const canvas = renderImage(edits.scale, type === "image/jpeg", markupWithTyping());
          if (!canvas) throw new Error("The picture could not be drawn.");
          const encoded = await canvasBlob(canvas, type);
          const blob = edits.dpi !== null ? await withResolution(encoded, edits.dpi) : encoded;
          // Decoded before the drive is changed: a picture that cannot be shown is not saved.
          const decoded = await loadImage(blob);
          let saved: DriveEntry;
          try {
            saved = await drive.replace(doc.entry, blob);
          } catch (error) {
            decoded.release();
            throw error;
          }
          if (!mounted.current) {
            decoded.release();
            return true;
          }
          if (copyOpenAs(doc.entry.id)) {
            try {
              const { returnToPhotos } = await import("../photos/photos-edit-return");
              await returnToPhotos(doc.entry.id, saved, blob);
            } catch (error) {
              setFailure(
                `“${saved.name}” is saved, but Photos could not take it. ${messageOf(error)}`,
              );
            }
          }
          setDoc({ kind: "image", entry: saved, ...decoded });
          setGallery(galleryNow.current.map((each) => (each.id === doc.entry.id ? saved : each)));
          if (markup.keywords) {
            carried.current = {
              file: saved.id,
              markup: { ...EMPTY_MARKUP, keywords: markup.keywords },
            };
          }
          // The saved picture is a new file: its place takes over the one it replaced.
          setPlaces((list) =>
            openedPlace(forgetPlace(list, doc.entry.id), {
              file: saved.id,
              name: saved.name,
              page: 1,
              zoom,
              opened_ms: Date.now(),
            }),
          );
          setMarkup(EMPTY_MARKUP);
          savedMarkup.current = EMPTY_MARKUP;
          setEdits(NO_EDITS);
          setHistory([]);
          setFuture([]);
          setSelected(null);
          setTyping(null);
          setNotice(`Saved “${saved.name}”.`);
          return true;
        } catch (error) {
          if (mounted.current)
            setFailure(`“${doc.entry.name}” could not be saved. ${messageOf(error)}`);
          return false;
        } finally {
          if (mounted.current) setBusy(null);
        }
      })) ?? false
    );
  };

  const saveFilledForm = async (current: Extract<OpenDocument, { kind: "pdf" }>) => {
    const saved = await exclusive(async () => {
      setBusy({ label: `Saving “${current.entry.name}”…`, fraction: null });
      try {
        const written = await current.pdf.filled();
        const entry = await drive.replace(
          current.entry,
          new Blob([written as BlobPart], { type: "application/pdf" }),
        );
        setPlaces((list) => forgetPlace(list, current.entry.id));
        return entry;
      } catch (error) {
        if (mounted.current)
          setFailure(`“${current.entry.name}” could not be saved. ${messageOf(error)}`);
        return undefined;
      } finally {
        if (mounted.current) setBusy(null);
      }
    });
    if (!saved || !mounted.current) return false;
    carried.current = { file: saved.id, markup };
    await open(saved, {
      file: saved.id,
      name: saved.name,
      page,
      zoom,
      ...(display === "continuous" ? {} : { display }),
      opened_ms: Date.now(),
    });
    if (mounted.current) setNotice(`Saved “${saved.name}”. The PDF as it was is in the Trash.`);
    return true;
  };

  /** The close button: changes to the picture that are not saved are asked about first. */
  const close: DocumentWindowProps["onClose"] = onClose
    ? (event) => {
        if (editsUnsaved) setLeaving({ proceed: () => onClose(event) });
        else onClose(event);
      }
    : undefined;

  /* Turning, zooming, cropping. */

  const rotate = (by: 1 | -1) => {
    if (!doc) return;
    setCropRect(null);
    if (doc.kind === "image") changeEdits({ ...edits, turns: turned(edits.turns, by) });
    else changeMarkup(withPagesTurned(markup, pageCount, chosen, by));
  };
  const flip = (axis: "horizontal" | "vertical") => {
    if (doc?.kind !== "image") return;
    setCropRect(null);
    changeEdits({ ...edits, ...flipped(edits, axis) });
  };
  const zoomBy = (factor: number) =>
    setZoom((now) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, now * factor)));
  /** The zoom at which one pixel of a picture, or one point of a PDF, is one point on the screen. */
  const actualSize = () => {
    if (!doc) return;
    const source = sourceOf(page);
    const shown = viewSize(source.width, source.height, viewOf(page));
    const atFit = cssWidthOf(page) / zoom;
    const paper = (doc.kind === "pdf" ? pdfScale : imageScale) === "paper";
    setZoom(
      Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (shown.width * (paper ? PAPER_ZOOM : 1)) / atFit)),
    );
  };
  /**
   * What Zoom to Selection fits: a picture's selection, or the PDF text selected, as a page and the
   * fractions of it as shown.
   */
  const selectionShown = () => {
    if (cropRect && doc?.kind === "image") {
      const a = toView([cropRect.x, cropRect.y], view);
      const b = toView([cropRect.x + cropRect.w, cropRect.y + cropRect.h], view);
      return {
        page: 1,
        x: Math.min(a[0], b[0]),
        y: Math.min(a[1], b[1]),
        w: Math.abs(a[0] - b[0]),
        h: Math.abs(a[1] - b[1]),
      };
    }
    const selection = document.getSelection();
    if (!selectedText || !selection || selection.rangeCount === 0) return null;
    const anchor = selection.anchorNode;
    const leaf = (anchor instanceof Element ? anchor : anchor?.parentElement)?.closest<HTMLElement>(
      "[data-page]",
    );
    const box = leaf?.getBoundingClientRect();
    if (!leaf || !box || box.width === 0 || box.height === 0) return null;
    const range = selection.getRangeAt(0).getBoundingClientRect();
    return {
      page: Number(leaf.dataset.page),
      x: (range.left - box.left) / box.width,
      y: (range.top - box.top) / box.height,
      w: range.width / box.width,
      h: range.height / box.height,
    };
  };
  const zoomToSelection = () => {
    const area = selectionShown();
    if (!area || area.w <= 0 || area.h <= 0) return;
    const source = sourceOf(area.page);
    const shown = viewSize(source.width, source.height, viewOf(area.page));
    const width = cssWidthOf(area.page);
    const height = (width * shown.height) / shown.width;
    const fit = Math.min(
      viewportSize.width / (area.w * width),
      viewportSize.height / (area.h * height),
    );
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom * fit * 0.95));
    setZoom(next);
    // Once the pages stand at their new size, the selection is brought to the middle of the view.
    requestAnimationFrame(() => {
      const element = viewport.current;
      const leaf = element?.querySelector<HTMLElement>(`[data-page="${area.page}"]`);
      if (!element || !leaf) return;
      const box = leaf.getBoundingClientRect();
      const view = element.getBoundingClientRect();
      element.scrollLeft +=
        box.left - view.left + (area.x + area.w / 2) * box.width - element.clientWidth / 2;
      element.scrollTop +=
        box.top - view.top + (area.y + area.h / 2) * box.height - element.clientHeight / 2;
    });
  };
  /** What Crop keeps: the selection, or a mask chosen on a picture. */
  const maskChosen = () => {
    const mark = selectedMarks.length === 1 ? selectedMarks[0] : undefined;
    return doc?.kind === "image" && mark?.kind === "mask" ? mark : undefined;
  };
  const crop = () => {
    if (doc?.kind !== "image") return;
    const mask = maskChosen();
    const area = cropRect ?? (mask ? boundsOf(mask) : null);
    if (!area) return;
    const kept = intersect(area, edits.crop);
    setCropRect(null);
    if (!kept) return;
    // The mask is used up, in the same change the crop is.
    if (mask && !cropRect) {
      if (blocked()) return;
      remember();
      setMarkup(
        withMarks(
          markup,
          1,
          marksOf(markup, 1).filter((each) => each.id !== mask.id),
        ),
      );
      setEdits({ ...edits, crop: kept });
      setSelected(null);
      setTool("select");
      return;
    }
    changeEdits({
      ...edits,
      crop: kept,
      clips: shownOutline ? [...edits.clips, shownOutline] : edits.clips,
    });
    setCropOutline(null);
    setTool("select");
  };

  /* Adjust Color. */

  const pictureSample = useMemo(() => {
    if (!adjusting || opened?.kind !== "image") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = Math.max(1, Math.round((128 * opened.height) / opened.width));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(opened.image, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  }, [adjusting, opened]);
  const levels = useMemo(() => (pictureSample ? levelsOf(pictureSample) : []), [pictureSample]);
  const showAdjustColor = () => {
    adjustRemembered.current = false;
    setAdjusting(true);
  };
  /** One change for Undo however far the sliders go while the panel is open. */
  const changeColor = (next: ColorAdjust) => {
    if (blocked()) return;
    if (!adjustRemembered.current) remember();
    adjustRemembered.current = true;
    setEdits((now) => ({ ...now, color: next }));
  };

  /* Bookmarks. */

  const bookmarkedNow = pdf
    ? bookmarkedPages(
        bookmarks,
        pdf.entry.id,
        heldOrder(markup.order, opened?.kind === "pdf" ? opened.sizes.length : 0),
        pageCount,
      )
    : [];
  const toggleBookmark = () => {
    if (!pdf) return;
    // Kept by the file's own page, so that it follows the page when it is moved.
    const next = toggledBookmark(bookmarks, pdf.entry.id, markup.order?.[page - 1] ?? page);
    if (next) setBookmarks(next);
    else setFailure(`Preview keeps at most ${MAX_BOOKMARKS} bookmarks. Remove one to add another.`);
  };

  /* A PDF's pages: chosen in the sidebar, moved, deleted and inserted, kept with the markup. */

  const [chosenPages, setChosenPages] = useState<readonly number[]>([]);
  const inRange = chosenPages.filter((number) => number <= pageCount);
  const chosen = inRange.includes(page) ? inRange : [page];
  const [dropLine, setDropLine] = useState<{ before: number; top: number } | null>(null);
  const draggedPages = useRef<readonly number[] | null>(null);
  // Undo can bring back fewer pages than the page shown.
  useEffect(() => {
    if (pageCount > 0 && page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const layOutPages = (next: readonly number[], showing: number) => {
    if (opened?.kind !== "pdf") return;
    if (next.length === pageCount && next.every((number, index) => number === index + 1)) return;
    if (!changeMarkup(rearranged(markup, opened.sizes.length, next))) return;
    setSelected(null);
    setChosenPages([]);
    setTrail(NO_TRAIL);
    setPage(showing);
    restoreTo.current = showing;
  };
  const allPages = () => Array.from({ length: pageCount }, (_, index) => index + 1);
  const deletePages = () => {
    if (!pdf) return;
    const next = allPages().filter((number) => !chosen.includes(number));
    if (next.length === 0) {
      setFailure("A PDF keeps at least one page.");
      return;
    }
    layOutPages(next, Math.min(Math.min(...chosen), next.length));
  };
  /** Puts `moving`, in their order, before the page numbered `before` now. */
  const movePages = (moving: readonly number[], before: number) => {
    const sorted = [...moving].sort((a, b) => a - b);
    const kept = allPages().filter((number) => !sorted.includes(number));
    const at = kept.filter((number) => number < before).length;
    layOutPages([...kept.slice(0, at), ...sorted, ...kept.slice(at)], at + 1);
  };
  const insertBlankPage = () => {
    if (!pdf) return;
    const after = Math.max(...chosen);
    const all = allPages();
    layOutPages([...all.slice(0, after), 0, ...all.slice(after)], after + 1);
  };
  // A picture or PDF dragged from Finder onto the thumbnails goes in after the page it is let go on.
  const thumbnailsDrop = useDesktopDrop<HTMLDivElement>({
    enabled: served && pdf !== null,
    accepts: (item) => item.kind === "file" && opensInPreview(item),
    onDrop: (items, drag) => {
      const first = items[0];
      if (!first) return;
      const row = drag.at
        ? document.elementFromPoint(drag.at.x, drag.at.y)?.closest<HTMLElement>("[data-index]")
        : null;
      const after = row ? Number(row.dataset.index) + 1 : pageCount;
      void (async () => {
        const found = first.bytes
          ? first
          : await driveOf.current.current(first.id).catch(() => undefined);
        if (!mounted.current) return;
        if (found) await insertPagesOf(found, after);
        else setNotice(`“${first.name}” is no longer on the drive.`);
      })();
    },
  });
  /** Pages of this PDF as a file of their own, for a drag out of the thumbnails. */
  const pagesDragItem = (pages: readonly number[]): DesktopDragItem | null => {
    if (opened?.kind !== "pdf") return null;
    const file = opened.pdf;
    const shown = heldOrder(markup.order, opened.sizes.length);
    const sources = pages.map((number) => shown?.[number - 1] ?? number);
    const first = pages[0] ?? 1;
    const named = pages.length === 1 ? `page ${first}` : `${pages.length} pages`;
    return {
      id: `preview-pages-${newMarkId()}`,
      name: `${stemOf(opened.entry.name)} (${named}).pdf`,
      kind: "file",
      type: "application/pdf",
      bytes: async () =>
        new Blob([(await file.combined(extractionParts(sources))) as BlobPart], {
          type: "application/pdf",
        }),
    };
  };
  /**
   * A drag of thumbnails let go outside their list: on whatever on the desktop takes a file there.
   * It is the browser's own drag, for the reordering in the list, so it needs a browser that says
   * where the drag ended. Another Preview window takes it as it lands, and marks where on the way.
   */
  const dropPagesAt = (x: number, y: number, frame: HTMLElement, pages: readonly number[]) => {
    const hit = document.elementFromPoint(x, y);
    const item = pagesDragItem(pages);
    if (!hit || !item || frame.contains(hit)) return;
    const landing = landingAt(hit, {
      from: "preview",
      items: [item],
      copy: true,
      at: { x, y },
    });
    if (landing && !landing.refusal) landing.drop();
  };
  const borderChooser = useRef<HTMLElement | null>(null);
  const fillChooser = useRef<HTMLElement | null>(null);
  /** Opens the browser's colour chooser for a menu's Show Colors… row. */
  const openColorChooser = (input: HTMLElement | null) => {
    const chooser = input as HTMLInputElement | null;
    if (!chooser) return;
    try {
      chooser.showPicker();
    } catch {
      chooser.click();
    }
  };

  /* Pages on the screen. */

  const showPage = (number: number) => {
    const element = viewport.current?.querySelector<HTMLElement>(`[data-page="${number}"]`);
    element?.scrollIntoView?.({ block: "start" });
    setPage(number);
  };
  const goTo = (number: number) => {
    if (number !== page)
      setTrail(({ back }) => ({ back: [...back.slice(-(HISTORY - 1)), page], forward: [] }));
    showPage(number);
  };
  const goBack = () => {
    const to = trail.back.at(-1);
    if (to === undefined) return;
    setTrail({ back: trail.back.slice(0, -1), forward: [...trail.forward, page] });
    showPage(to);
  };
  const goForward = () => {
    const to = trail.forward.at(-1);
    if (to === undefined) return;
    setTrail({ back: [...trail.back, page], forward: trail.forward.slice(0, -1) });
    showPage(to);
  };
  const follow = () => {
    const element = viewport.current;
    // Only a continuous scroll has a page that scrolling chooses.
    if (!element || !pdf || display !== "continuous") return;
    const top = element.getBoundingClientRect().top + 24;
    let shown = 1;
    for (const leaf of element.querySelectorAll<HTMLElement>("[data-page]")) {
      if (leaf.getBoundingClientRect().top > top) break;
      shown = Number(leaf.dataset.page);
    }
    if (shown !== page) setPage(shown);
  };

  const layout: PageDisplay = pdf ? display : "continuous";
  const shownPages = useMemo(() => pagesShown(layout, page, pageCount), [layout, page, pageCount]);
  // Previous and Next go from the page, and in Two Pages from the pair shown together.
  const pair = layout === "two" ? shownPages : [page];
  const firstShown = pair[0] ?? page;
  const lastShown = pair.at(-1) ?? page;
  const previousPage = Math.max(1, firstShown - (layout === "two" ? 2 : 1));
  const nextPage = Math.min(pageCount, lastShown + 1);
  const chooseDisplay = (next: PageDisplay) => {
    if (next === "contact" && display !== "contact") beforeContact.current = display;
    setDisplay(next);
  };
  // A new layout shows the current page: at the top of a continuous scroll or of its own view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a continuous scroll's first page never changes, so scrolling, which moves the current page, moves nothing here
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const frame = requestAnimationFrame(() => {
      if (layout === "continuous") {
        element
          .querySelector<HTMLElement>(`[data-page="${page}"]`)
          ?.scrollIntoView?.({ block: "start" });
      } else {
        element.scrollTop = 0;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [layout, shownPages[0]]);

  const drawPage = useCallback(
    (number: number) => (canvas: HTMLCanvasElement, width: number, ratio: number) => {
      if (!doc) return undefined;
      if (doc.kind === "pdf") {
        return doc.pdf.render(number, canvas, width, viewOf(number).turns, ratio);
      }
      const height = doc.height * edits.stretch;
      const shown = viewSize(doc.width, height, view);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round((width * ratio * shown.height) / shown.width));
      const context = canvas.getContext("2d");
      if (!context) return undefined;
      context.save();
      applyView(context, doc.width, height, view, canvas);
      context.drawImage(doc.image, 0, 0, doc.width, height);
      cutOut(context, edits.cuts, doc.width, height);
      if (!isNeutral(edits.color)) adjustCanvas(context, canvas, edits.color);
      context.restore();
      return undefined;
    },
    [doc, view, viewOf, edits.stretch, edits.color, edits.cuts],
  );
  const drawers = useMemo(() => {
    const map = new Map<number, ReturnType<typeof drawPage>>();
    for (let number = 1; number <= pageCount; number += 1) map.set(number, drawPage(number));
    return map;
  }, [drawPage, pageCount]);
  const textLayouts = useMemo(() => {
    const map = new Map<number, (container: HTMLElement, width: number) => Promise<void>>();
    if (doc?.kind !== "pdf") return map;
    for (let number = 1; number <= pageCount; number += 1) {
      map.set(number, (container, width) =>
        doc.pdf.layOutText(number, container, width, viewOf(number).turns),
      );
    }
    return map;
  }, [doc, viewOf, pageCount]);
  const linkReaders = useMemo(() => {
    const map = new Map<number, () => Promise<readonly PdfLink[]>>();
    if (doc?.kind !== "pdf") return map;
    for (let number = 1; number <= pageCount; number += 1) {
      map.set(number, () => doc.pdf.links(number));
    }
    return map;
  }, [doc, pageCount]);
  const fieldReaders = useMemo(() => {
    const map = new Map<number, () => Promise<readonly PdfField[]>>();
    if (doc?.kind !== "pdf") return map;
    for (let number = 1; number <= pageCount; number += 1) {
      map.set(number, () => doc.pdf.fields(number));
    }
    return map;
  }, [doc, pageCount]);
  const fillField = useCallback(
    (field: PdfField, value: string | boolean) => {
      if (doc?.kind !== "pdf") return;
      doc.pdf.setField(field.id, field.kind === "choice" ? [String(value)] : value, field.group);
      setFormFilled(true);
    },
    [doc],
  );
  const followLink = (link: PdfLink) => {
    if (link.page !== undefined) goTo(link.page);
    else if (!link.url || !openUrl(link.url, "preview")) {
      setNotice("Only a web address can be opened from a link here.");
    }
  };
  // What changes a picture's drawing besides its crop and turn.
  const imageDrawn =
    doc?.kind === "image"
      ? JSON.stringify([edits.stretch, edits.clips.length, edits.cuts.length, edits.color])
      : "";
  // The PDF text selected on a page, which Copy takes.
  const [selectedText, setSelectedText] = useState("");
  useEffect(() => {
    const note = () => {
      const selection = document.getSelection();
      const inPages =
        selection &&
        !selection.isCollapsed &&
        selection.anchorNode &&
        viewport.current?.contains(selection.anchorNode);
      setSelectedText(inPages ? selection.toString() : "");
    };
    document.addEventListener("selectionchange", note);
    return () => document.removeEventListener("selectionchange", note);
  }, []);
  const selectPageText = () => {
    const layer = viewport.current?.querySelector(
      `[data-page="${page}"] .mac-preview-app-page-text`,
    );
    if (layer) document.getSelection()?.selectAllChildren(layer);
  };
  const onDrawError = useCallback((error: unknown) => {
    if (mounted.current) setFailure(`A page could not be drawn. ${messageOf(error)}`);
  }, []);

  /* Searching a PDF. */

  const searching = pdf !== null && query.trim() !== "";
  // Read when the results of a search arrive, not watched: a search goes to the first page found
  // unless the page shown is one of them.
  const listed = useMemo(
    () =>
      sort === "rank" ? [...results].sort((a, b) => b.count - a.count || a.page - b.page) : results,
    [results, sort],
  );
  const shownPage = useRef(page);
  const goToPage = useRef(goTo);
  useEffect(() => {
    shownPage.current = page;
    goToPage.current = goTo;
  });
  // A document reopened at its place: shown at that page once its pages are laid out.
  useEffect(() => {
    const number = restoreTo.current;
    if (!doc || number === null) return;
    restoreTo.current = null;
    const frame = requestAnimationFrame(() => goToPage.current(number));
    return () => cancelAnimationFrame(frame);
  }, [doc]);
  // The place follows the page and the zoom (kept on the server with the rest of the places).
  useEffect(() => {
    if (!doc) return;
    pendingPlaces.current = movedPlace(pendingPlaces.current, doc.entry.id, page, zoom, display);
    if (placesLoading) return;
    const pending = pendingPlaces.current;
    pendingPlaces.current = [];
    setPlaces((list) => {
      const remembered = pending.reduceRight((list, place) => openedPlace(list, place), list);
      return movedPlace(remembered, doc.entry.id, page, zoom, display);
    });
  }, [doc, page, zoom, display, placesLoading]);
  useEffect(() => {
    if (!pdf || query.trim() === "") {
      setResults([]);
      return;
    }
    const needle = query.trim().toLowerCase();
    let live = true;
    const timer = setTimeout(async () => {
      const found: { page: number; count: number; snippet: string }[] = [];
      for (let number = 1; number <= pdf.sizes.length; number += 1) {
        const text = await pdf.pdf.text(number).catch(() => "");
        if (!live) return;
        const lower = text.toLowerCase();
        let count = 0;
        let at = lower.indexOf(needle);
        const first = at;
        while (at >= 0) {
          count += 1;
          at = lower.indexOf(needle, at + needle.length);
        }
        if (count > 0) {
          const start = Math.max(0, first - 40);
          const snippet = `${start > 0 ? "…" : ""}${text.slice(start, first + needle.length + 60)}…`;
          found.push({ page: number, count, snippet });
        }
      }
      if (!live) return;
      setResults(found);
      const firstPage = found[0]?.page;
      if (firstPage !== undefined && !found.some((result) => result.page === shownPage.current)) {
        goToPage.current(firstPage);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [pdf, query]);
  const position = listed.findIndex((result) => result.page === page);
  const canFindNext = listed.length > 0 && position !== listed.length - 1;
  const canFindPrevious = position > 0;
  const searchField = useRef<HTMLInputElement | null>(null);
  const findInDocument = () => {
    setToolbarShown(true);
    if (!toolShown("search")) setHiddenTools(hiddenTools.filter((tool) => tool !== "search"));
    // After the menu has closed: a menu gives focus back to its title as it does.
    requestAnimationFrame(() => {
      searchField.current?.focus();
      searchField.current?.select();
    });
  };
  const step = (by: 1 | -1) => {
    const next = listed[position < 0 ? 0 : position + by];
    if (next) goTo(next.page);
  };

  /* Markup on a page. */

  const interactive = markupBar && !typing && !noting && !highlighting && !busy;
  const style: MarkStyle = {
    color,
    stroke,
    ...(fill ? { fill } : {}),
    ...(dash === "solid" ? {} : { dash }),
    ...(shadow ? { shadow: true as const } : {}),
    ...(arrowEnds === "tool" ? {} : { arrow_ends: arrowEnds }),
  };
  const { fill: _fill, arrow_ends: _ends, ...lineStyle } = style;

  const onPagePointerDown = ({
    page: number,
    point,
    viewPoint,
    event,
  }: {
    page: number;
    point: Point;
    viewPoint: Point;
    event: ReactPointerEvent<HTMLCanvasElement>;
  }) => {
    if (blocked()) return;
    setPage(number);
    if (isSelection(tool)) {
      if (doc?.kind !== "image") return;
      // A press inside the selection carries it out of the window, a copy of it.
      if (
        cropRect &&
        point[0] >= cropRect.x &&
        point[0] <= cropRect.x + cropRect.w &&
        point[1] >= cropRect.y &&
        point[1] <= cropRect.y + cropRect.h
      ) {
        beginDesktopDrag(event.nativeEvent, {
          from: "preview",
          icon: titleBar?.querySelector(".mac-preview-app-proxy"),
          items: () => [selectionDragItem()],
        });
        return;
      }
      setGesture({
        kind: "crop",
        from: viewPoint,
        ...(isLasso(tool) ? { lasso: [point] } : {}),
      });
      setCropRect(null);
      setCropOutline(null);
      return;
    }
    if (tool === "text") {
      setTyping({ page: number, point, value: "" });
      return;
    }
    if (tool === "note") {
      setNoting({ page: number, center: point, value: "" });
      return;
    }
    if (tool === "select") {
      const here = marksOf(markup, number);
      const chosen =
        chosenMarks.length === 1 ? here.find((mark) => mark.id === selected) : undefined;
      const handle = chosen ? handleAt(chosen, point) : null;
      if (chosen && handle !== null) {
        setGesture({ kind: "resize", page: number, mark: chosen, handle });
        return;
      }
      const hit = markAt(here, point, 0.012);
      // Shift-click adds a mark to those chosen, or takes it out.
      if (event.shiftKey) {
        if (!hit) return;
        setChosenMarks((now) =>
          now.includes(hit.id) ? now.filter((id) => id !== hit.id) : [...now, hit.id],
        );
        return;
      }
      if (!hit) {
        setSelected(null);
        setGesture({ kind: "band", page: number, from: point });
        return;
      }
      // A press on one of the marks chosen moves them all.
      const moving = chosenMarks.includes(hit.id)
        ? here.filter((mark) => chosenMarks.includes(mark.id) && !isTextMark(mark))
        : [hit];
      if (!chosenMarks.includes(hit.id)) setSelected(hit.id);
      // A mark on text stays on its words: it is chosen, not moved.
      if (!isTextMark(hit)) {
        setGesture({ kind: "move", page: number, from: point, mark: hit, marks: moving });
      }
      return;
    }
    setSelected(null);
    setGesture({ kind: "draw", page: number, from: point, points: [point] });
  };

  const onPagePointerMove = ({ point, viewPoint }: { point: Point; viewPoint: Point }) => {
    if (!gesture) return;
    if (gesture.kind === "crop") {
      if (gesture.lasso) {
        const lasso = [...gesture.lasso, point];
        setGesture({ ...gesture, lasso });
        setCropOutline(lasso);
        setCropRect(outlineBox(lasso));
        return;
      }
      const rect = rectFromView(gesture.from, viewPoint, view);
      setCropRect(rect);
      if (tool === "ellipse") setCropOutline(ovalOutline(rect));
      return;
    }
    if (gesture.kind === "move") {
      setDragOffset([point[0] - gesture.from[0], point[1] - gesture.from[1]]);
      return;
    }
    if (gesture.kind === "band") {
      setDraft({
        ...shapeBetween("rect", gesture.from, point, {
          color: BAND_COLOR,
          stroke: BAND_STROKE,
          dash: "dashed",
        }),
        id: "draft",
      });
      return;
    }
    if (gesture.kind === "resize") {
      setDraft(resized(gesture.mark, gesture.handle, point));
      return;
    }
    if (tool === "sketch") {
      const points = [...gesture.points, point];
      setGesture({ ...gesture, points });
      setDraft({
        id: "draft",
        kind: "sketch",
        ...lineStyle,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        points,
      });
    } else if (isBoxShape(tool)) {
      setDraft({ ...shapeBetween(tool, gesture.from, point, style), id: "draft" });
    } else if (isOutline(tool)) {
      setDraft({ ...outlineBetween(tool, gesture.from, point, style), id: "draft" });
    }
  };

  const onPagePointerUp = ({ point, viewPoint }: { point: Point; viewPoint: Point }) => {
    const done = gesture;
    setGesture(null);
    setDraft(null);
    setDragOffset(null);
    if (!done) return;
    if (done.kind === "band") {
      const box = {
        x: Math.min(done.from[0], point[0]),
        y: Math.min(done.from[1], point[1]),
        w: Math.abs(point[0] - done.from[0]),
        h: Math.abs(point[1] - done.from[1]),
      };
      if (box.w > BAND_SLOP || box.h > BAND_SLOP) {
        setChosenMarks(marksIn(marksOf(markup, done.page), box));
      }
      return;
    }
    if (done.kind === "crop") {
      if (done.lasso) {
        const drawn = thinPoints(done.lasso);
        const outline = tool === "smartLasso" ? snappedToEdges(drawn) : drawn;
        const rect = outline.length > 2 ? intersect(outlineBox(outline), edits.crop) : null;
        setCropRect(rect);
        setCropOutline(rect ? outline : null);
        return;
      }
      const rect = intersect(rectFromView(done.from, viewPoint, view), edits.crop);
      const kept = rect && rect.w > 0.005 && rect.h > 0.005 ? rect : null;
      setCropRect(kept);
      setCropOutline(kept && tool === "ellipse" ? ovalOutline(kept) : null);
      return;
    }
    const marks = marksOf(markup, done.page);
    if (done.kind === "resize") {
      // A press on a handle that does not move leaves the mark as it is.
      if (!draft) return;
      const next = resized(done.mark, done.handle, point);
      changeMarks(
        done.page,
        marks.map((mark) => (mark.id === next.id ? next : mark)),
      );
      return;
    }
    if (done.kind === "move") {
      const dx = point[0] - done.from[0];
      const dy = point[1] - done.from[1];
      if (
        done.mark.kind === "note" &&
        Math.abs(dx) < NOTE_PRESS_SLOP &&
        Math.abs(dy) < NOTE_PRESS_SLOP
      ) {
        openNote(done.page, done.mark);
        return;
      }
      if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return;
      const ids = done.marks.map((mark) => mark.id);
      changeMarks(
        done.page,
        marks.map((mark) => (ids.includes(mark.id) ? moved(mark, dx, dy) : mark)),
      );
      return;
    }
    if (tool === "sketch") {
      const points = thinPoints([...done.points, point]);
      if (points.length < 2) return;
      const drawn: Mark = {
        id: newMarkId(),
        kind: "sketch",
        ...lineStyle,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        points,
      };
      const source = sourceOf(done.page);
      const tidy = cleanedSketch(points, source.height / source.width, lineStyle);
      if (!tidy) {
        changeMarks(done.page, [...marks, drawn]);
        return;
      }
      // Two changes, so that Undo gives back the line as it was drawn.
      const asDrawn = withMarks(markup, done.page, [...marks, drawn]);
      if (!changeMarkup(asDrawn)) return;
      setHistory((past) => [...past.slice(-(HISTORY - 1)), { markup: asDrawn, edits }]);
      setMarkup(withMarks(asDrawn, done.page, [...marks, tidy]));
      setSelected(tidy.id);
      setNotice(
        `Preview made your line a ${TOOL_NAMES[tidy.kind as Tool].toLowerCase()}. Undo brings back the line as you drew it.`,
      );
    } else if (isBoxShape(tool)) {
      const mark = shapeBetween(tool, done.from, point, style);
      if (Math.abs(mark.w) < 0.003 && Math.abs(mark.h) < 0.003) return;
      changeMarks(done.page, [...marks, mark]);
      setSelected(mark.id);
    } else if (isOutline(tool)) {
      if (Math.abs(point[0] - done.from[0]) < 0.003 && Math.abs(point[1] - done.from[1]) < 0.003)
        return;
      const mark = outlineBetween(tool, done.from, point, style);
      const said =
        tool === "bubble"
          ? {
              ...mark,
              ...(textFont === "system" ? {} : { font: textFont }),
              ...(textBold ? { bold: true as const } : {}),
              ...(textItalic ? { italic: true as const } : {}),
              ...(textUnderline ? { underline: true as const } : {}),
            }
          : mark;
      if (!changeMarks(done.page, [...marks, said])) return;
      setSelected(said.id);
      // What a speech bubble says is typed in it at once, and kept in it.
      if (tool === "bubble") {
        setTyping({
          page: done.page,
          point: [
            Math.min(done.from[0], point[0]) + Math.abs(point[0] - done.from[0]) * 0.1,
            Math.min(done.from[1], point[1]) + Math.abs(point[1] - done.from[1]) * 0.1,
          ],
          value: "",
          replaces: said,
        });
      }
    }
  };

  /** A loop drawn with the Smart Lasso, drawn in to the picture's edges. */
  const snappedToEdges = (drawn: Point[]): Point[] => {
    if (doc?.kind !== "image") return drawn;
    const scale = Math.min(1, EDGE_SAMPLE / Math.max(doc.width, doc.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(doc.width * scale));
    canvas.height = Math.max(1, Math.round(doc.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return drawn;
    context.drawImage(doc.image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    return thinPoints(smartOutline(drawn, data, canvas.width, canvas.height));
  };

  const onPageDoubleClick = ({ page: number, point }: { page: number; point: Point }) => {
    if (tool !== "select") return;
    const hit = markAt(marksOf(markup, number), point, 0.012);
    if (hit?.kind === "text") {
      setTyping({ page: number, point: [hit.x, hit.y], value: hit.text ?? "", replaces: hit });
    }
    if (hit?.bubble) {
      const box = boundsOf(hit);
      setTyping({
        page: number,
        point: [box.x + box.w * 0.1, box.y + box.h * 0.1],
        value: hit.text ?? "",
        replaces: hit,
      });
    }
    if (hit?.kind === "note") openNote(number, hit);
  };

  const openNote = (number: number, note: Mark) => {
    // A note that cannot be kept yet stays open, so what it says is not lost to the next one.
    if (!commitNote(true)) return;
    setSelected(note.id);
    setNoting({
      page: number,
      center: [note.x + note.w / 2, note.y + note.h / 2],
      value: note.text ?? "",
      replaces: note,
    });
  };

  /**
   * Ends writing a note: it becomes a mark (or replaces the one edited, or removes it when left
   * empty); `keep: false` throws away what was written. Answers whether writing ended: while the
   * mark cannot be kept now, the note stays open, so nothing written is lost.
   */
  const commitNote = (keep: boolean): boolean => {
    const now = noting;
    if (!now) return true;
    const done = () => {
      setNoting(null);
      setTool((chosen) => (chosen === "note" ? "select" : chosen));
      return true;
    };
    if (!keep || now.value === (now.replaces?.text ?? "")) return done();
    const others = marksOf(markup, now.page).filter((mark) => mark.id !== now.replaces?.id);
    if (now.value.trim() === "") {
      if (!now.replaces) return done();
      if (!changeMarks(now.page, others)) return false;
      setSelected(null);
      return done();
    }
    const source = sourceOf(now.page);
    const written = noteMark(now.center, now.value, source.height / source.width);
    const note = now.replaces ? { ...now.replaces, text: written.text } : written;
    if (!changeMarks(now.page, [...others, note])) return false;
    setSelected(note.id);
    return done();
  };

  const startNote = () => {
    if (typing && !commitTyping(true)) return;
    setHighlighting(false);
    setMarkupBar(true);
    setTool("note");
    setSelected(null);
    setCropRect(null);
  };

  /**
   * Marks the PDF text selected, on as many pages as it runs over, as one change. Answers whether
   * anything was marked: there may be nothing selected, or the markup cannot change now.
   */
  const markSelectedText = (style: TextMarkStyle): boolean => {
    let next = markup;
    for (const part of selectedOnPages(viewport.current)) {
      const source = sourceOf(part.page);
      const pageView = viewOf(part.page);
      const lines = mergedLines(
        part.boxes.map((box) =>
          rectFromView([box.left, box.top], [box.right, box.bottom], pageView),
        ),
        source.height / source.width,
      );
      const marks = textMarks(style, lines, part.words);
      if (marks.length > 0) {
        next = withMarks(next, part.page, [...marksOf(next, part.page), ...marks]);
      }
    }
    if (next === markup || !changeMarkup(next)) return false;
    document.getSelection()?.removeAllRanges();
    return true;
  };

  /** Tools > Annotate: marks what is selected, or else marks what is dragged over next. */
  const chooseStyle = (style: TextMarkStyle) => {
    setTextMarkStyle(style);
    if (style.kind === "highlight") setHighlightStyle(style);
  };
  const annotateText = (style: TextMarkStyle) => {
    chooseStyle(style);
    if (!markSelectedText(style)) {
      setHighlighting(true);
      setSelected(null);
    }
  };
  /** The Highlight menu: a chosen mark on text changes to its choice; otherwise as above. */
  const chooseTextMark = (choice: string) => {
    const style =
      choice === "underline"
        ? UNDERLINE
        : choice === "strikethrough"
          ? STRIKETHROUGH
          : { kind: "highlight" as const, color: choice };
    if (!selectedMark || !isTextMark(selectedMark)) {
      annotateText(style);
      return;
    }
    chooseStyle(style);
    for (const entry of markup.pages) {
      if (entry.items.some((mark) => mark.id === selectedMark.id)) {
        changeMarks(
          entry.page,
          entry.items.map((mark) => (mark.id === selectedMark.id ? { ...mark, ...style } : mark)),
        );
      }
    }
  };

  /**
   * Ends typing: the text becomes a mark (or replaces the one edited), or nothing when empty;
   * `keep: false` throws it away. Answers whether typing ended. The box keeps its text when the
   * mark cannot be kept now (an operation runs, stored markup loads, or the file's markup is at
   * its limit), so nothing typed is lost.
   */
  const commitTyping = (keep: boolean): boolean => {
    const now = typing;
    if (!now || !doc || !keep) {
      setTyping(null);
      return true;
    }
    const typed = typedMark(now);
    if (!typed.mark && !now.replaces) {
      setTyping(null);
      return true;
    }
    const kept = changeMarks(now.page, typed.mark ? [...typed.others, typed.mark] : typed.others);
    if (!kept) return false;
    setTyping(null);
    if (typed.mark) setSelected(typed.mark.id);
    return true;
  };

  /** The markup as it would be with the text being typed kept: what Save and Export draw. */
  const markupWithTyping = (): Markup => {
    if (!typing) return markup;
    const typed = typedMark(typing);
    if (!typed.mark && !typing.replaces) return markup;
    return withMarks(
      markup,
      typing.page,
      typed.mark ? [...typed.others, typed.mark] : typed.others,
    );
  };

  /** The box a text takes, measured in the font it is drawn in, turned as it was typed. */
  const textBoxOf = (
    text: string,
    number: number,
    size: number,
    font: Mark["font"],
    turns: Turns,
    mirrored: boolean,
    style: Pick<Mark, "bold" | "italic"> = {},
  ) => {
    const source = sourceOf(number);
    const measure = document.createElement("canvas").getContext("2d");
    const px = size * source.width;
    let widest = px * 0.6 * Math.max(...text.split("\n").map((line) => line.length));
    if (measure) {
      measure.font = markFont(font, px, style);
      widest = Math.max(...text.split("\n").map((line) => measure.measureText(line).width));
    }
    const lines = text.split("\n").length;
    return textBox(
      widest / source.width,
      (lines * px * LINE_HEIGHT) / source.height,
      turns,
      source.width,
      source.height,
      mirrored,
    );
  };

  /** The mark the text being typed makes, and the other marks of its page. */
  function typedMark(now: Typing): { others: Mark[]; mark: Mark | null } {
    const others = marksOf(markup, now.page).filter((mark) => mark.id !== now.replaces?.id);
    // Kept exactly as typed, spaces included: what is drawn is what the box showed. Only a
    // box with nothing but spaces makes no mark.
    const text = now.value;
    const pageView = viewOf(now.page);
    if (now.replaces?.bubble) {
      const {
        text: _said,
        size: _size,
        turns: _turns,
        mirrored: _mirrored,
        ...shape
      } = now.replaces;
      if (text.trim() === "") return { others, mark: shape };
      return {
        others,
        mark: {
          ...shape,
          text: text.slice(0, MARKUP_LIMITS.text),
          size: now.replaces.size ?? textSize,
          ...(pageView.turns === 0 ? {} : { turns: pageView.turns }),
          ...(pageView.mirrored ? { mirrored: true as const } : {}),
        },
      };
    }
    if (text.trim() === "") return { others, mark: null };
    const size = now.replaces?.size ?? textSize;
    const font = now.replaces ? now.replaces.font : textFont === "system" ? undefined : textFont;
    const align = now.replaces ? now.replaces.align : textAlign === "left" ? undefined : textAlign;
    const bold = now.replaces ? now.replaces.bold : textBold ? (true as const) : undefined;
    const italic = now.replaces ? now.replaces.italic : textItalic ? (true as const) : undefined;
    const underline = now.replaces
      ? now.replaces.underline
      : textUnderline
        ? (true as const)
        : undefined;
    const box = textBoxOf(text, now.page, size, font, pageView.turns, pageView.mirrored === true, {
      bold,
      italic,
    });
    const mark: Mark = {
      id: now.replaces?.id ?? newMarkId(),
      kind: "text",
      color: now.replaces?.color ?? color,
      stroke: now.replaces?.stroke ?? stroke,
      x: round6(now.point[0]),
      y: round6(now.point[1]),
      w: round6(box.w),
      h: round6(box.h),
      text: text.slice(0, MARKUP_LIMITS.text),
      size,
      ...(pageView.turns === 0 ? {} : { turns: pageView.turns }),
      ...(pageView.mirrored ? { mirrored: true as const } : {}),
      ...(font ? { font } : {}),
      ...(align ? { align } : {}),
      ...(bold ? { bold } : {}),
      ...(italic ? { italic } : {}),
      ...(underline ? { underline } : {}),
    };
    return { others, mark };
  }

  /**
   * Changes every mark chosen, as one change: `change` answers the mark as it is to be, or `null` to
   * take it away. Nothing changes, and Undo gets no step, when it answers each as it was.
   */
  const changeChosen = (change: (mark: Mark) => Mark | null) => {
    let next = markup;
    for (const entry of markup.pages) {
      if (!entry.items.some((mark) => chosenMarks.includes(mark.id))) continue;
      const items = entry.items.flatMap((mark) => {
        if (!chosenMarks.includes(mark.id)) return [mark];
        const changed = change(mark);
        return changed ? [changed] : [];
      });
      if (
        items.length !== entry.items.length ||
        items.some((mark, index) => mark !== entry.items[index])
      ) {
        next = withMarks(next, entry.page, items);
      }
    }
    if (next !== markup) changeMarkup(next);
  };

  const deleteSelected = () => {
    if (!selected) return;
    changeChosen(() => null);
    setSelected(null);
  };

  const allMarks = markup.pages.flatMap((entry) => entry.items);
  const selectedMark = allMarks.find((mark) => mark.id === selected);
  const shownTextFont = selectedMark?.kind === "text" ? (selectedMark.font ?? "system") : textFont;
  const selectedMarks = allMarks.filter((mark) => chosenMarks.includes(mark.id));
  const pageOfMark = (id: string) =>
    markup.pages.find((entry) => entry.items.some((mark) => mark.id === id))?.page ?? page;
  // Every highlight and note of the PDF, by page and then from the top of it.
  const annotations = useMemo(
    () =>
      markup.pages
        .filter((entry) => entry.page <= pageCount)
        .flatMap((entry) =>
          entry.items
            .filter(isAnnotation)
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .map((mark) => ({ page: entry.page, mark })),
        ),
    [markup.pages, pageCount],
  );
  const copyMark = () => {
    if (selectedMarks.length === 1 && selectedMark && isTextMark(selectedMark)) {
      void copyText(selectedMark.text ?? "");
    } else if (selectedMarks.length > 0) setCopied(selectedMarks);
    else if (selectedText) void copyText(selectedText);
    else if (doc?.kind === "image") void copyPicture();
  };
  const cutMark = () => {
    copyMark();
    deleteSelected();
  };
  /** Puts copies of the marks copied on the page shown, a little off the place they came from. */
  const pasteMark = () => {
    if (copied.length === 0 || !doc) return;
    const marks = copied.map((mark) => ({ ...moved(mark, 0.02, 0.02), id: newMarkId() }));
    if (changeMarks(page, [...marksOf(markup, page), ...marks])) {
      setChosenMarks(marks.map((mark) => mark.id));
    }
  };
  /** Edit > Select All with the markup bar on a PDF: the marks of the page shown. */
  const selectAllMarks = () => setChosenMarks(marksOf(markup, page).map((mark) => mark.id));

  const recolor = (value: string, which: "color" | "fill") => {
    if (which === "color") setColor(value);
    else setFillChoice(value);
    changeChosen((mark) => {
      if (which === "color") return { ...mark, color: value };
      if (mark.kind !== "rect" && mark.kind !== "oval" && !isClosedOutline(mark)) return mark;
      const { fill: _old, ...rest } = mark;
      return value === "none" ? rest : { ...rest, fill: value };
    });
  };

  /** Changes the mark chosen, on whichever page it stands. */
  const changeSelected = (change: (mark: Mark) => Mark) => {
    for (const entry of markup.pages) {
      if (entry.items.some((mark) => mark.id === selected)) {
        changeMarks(
          entry.page,
          entry.items.map((mark) => (mark.id === selected ? change(mark) : mark)),
        );
      }
    }
  };
  const chooseStroke = (value: number) => {
    setStroke(value);
    changeChosen((mark) =>
      isAnnotation(mark) || mark.kind === "text" ? mark : { ...mark, stroke: value },
    );
  };
  const chooseDash = (value: MarkDash | "solid") => {
    setDash(value);
    changeChosen((mark) => {
      if (!isStyledLine(mark)) return mark;
      const { dash: _old, ...rest } = mark;
      return value === "solid" ? rest : { ...rest, dash: value };
    });
  };
  const chooseShadow = (value: boolean) => {
    setShadow(value);
    changeChosen((mark) => {
      if (!isStyledLine(mark)) return mark;
      const { shadow: _old, ...rest } = mark;
      return value ? { ...rest, shadow: true } : rest;
    });
  };
  const chooseArrowEnds = (value: ArrowEnds) => {
    setArrowEnds(value);
    changeChosen((mark) => (isLine(mark) ? { ...mark, arrow_ends: value } : mark));
  };
  /** What the Shape Style menu shows of a line's ends: the one chosen's, or the next one's. */
  const arrowEndsShown: ArrowEnds =
    selectedMark && isLine(selectedMark)
      ? (selectedMark.arrow_ends ?? (selectedMark.kind === "arrow" ? "end" : "none"))
      : arrowEnds === "tool"
        ? tool === "arrow"
          ? "end"
          : "none"
        : arrowEnds;
  const chooseTextSize = (value: number) => {
    setTextSize(value);
    changeChosen((mark) => {
      if (mark.bubble) return { ...mark, size: value };
      if (mark.kind !== "text") return mark;
      const factor = value / (mark.size ?? value);
      return {
        ...mark,
        size: value,
        w: round6(mark.w * factor),
        h: round6(mark.h * factor),
      };
    });
  };
  /** A text as it stands with `change`, its box measured again in the font it now has. */
  const remeasured = (mark: Mark, change: Partial<Mark>): Mark => {
    const next = { ...mark, ...change };
    const box = textBoxOf(
      next.text ?? "",
      pageOfMark(mark.id),
      next.size ?? textSize,
      next.font,
      next.turns ?? 0,
      next.mirrored === true,
      next,
    );
    return { ...next, w: round6(box.w), h: round6(box.h) };
  };
  const chooseFont = (value: NonNullable<Mark["font"]> | "system") => {
    setTextFont(value);
    changeChosen((mark) => {
      if (mark.kind !== "text" && !mark.bubble) return mark;
      const { font: _old, ...rest } = mark;
      const change = value === "system" ? {} : { font: value };
      return mark.bubble ? { ...rest, ...change } : remeasured(rest, change);
    });
  };
  const chooseAlign = (value: NonNullable<Mark["align"]>) => {
    setTextAlign(value);
    changeChosen((mark) => {
      if (mark.kind !== "text" && !mark.bubble) return mark;
      const { align: _old, ...rest } = mark;
      return value === "left" && !mark.bubble ? rest : { ...rest, align: value };
    });
  };
  /** Bold, Italic or Underline for the next text and the texts and bubbles chosen. */
  const chooseTextStyle = (which: "bold" | "italic" | "underline", on: boolean) => {
    if (which === "bold") setTextBold(on);
    else if (which === "italic") setTextItalic(on);
    else setTextUnderline(on);
    changeChosen((mark) => {
      if (mark.kind !== "text" && !mark.bubble) return mark;
      const { [which]: _old, ...rest } = mark;
      const change = on ? { [which]: true as const } : {};
      return mark.bubble ? { ...rest, ...change } : remeasured(rest, change);
    });
  };
  const textStyleOf = (which: "bold" | "italic" | "underline") => {
    if (selectedMark?.kind === "text" || selectedMark?.bubble) return selectedMark[which] === true;
    return which === "bold" ? textBold : which === "italic" ? textItalic : textUnderline;
  };
  // What Spelling and Substitutions read: one text or note chosen.
  const textMark =
    selectedMarks.length === 1 && (selectedMark?.kind === "text" || selectedMark?.kind === "note")
      ? selectedMark
      : undefined;
  const textTools = usePreviewTextTools({
    mark: textMark,
    onChange: (text) => {
      if (text.trim() === "") return;
      changeSelected((mark) =>
        mark.kind === "text" ? remeasured(mark, { text }) : { ...mark, text },
      );
    },
  });
  const fieldTyping = usePreviewFieldTyping();

  const sign = (signature: Signature) => {
    if (!doc) return;
    const number = page;
    const source = sourceOf(number);
    const pageView = viewOf(number);
    const center = fromView([0.5, 0.5], pageView);
    const across = SIGNATURE_WIDTH * (pageView.turns % 2 === 0 ? pageView.crop.w : pageView.crop.h);
    // On a mirrored picture it is written mirrored in the page, to read rightly as shown.
    const written = pageView.mirrored
      ? {
          ...signature,
          strokes: signature.strokes.map((line) =>
            line.map(([u, v]): [number, number] => [1 - u, v]),
          ),
        }
      : signature;
    const mark = placeSignature(written, center, across, source.width / source.height, {
      color: color === "#ffffff" ? "#000000" : color,
      stroke: Math.max(stroke, 0.003),
    });
    changeMarks(number, [...marksOf(markup, number), mark]);
    setSelected(mark.id);
    setTool("select");
  };

  const keepSignature = (signature: Signature) => {
    if (blocked()) return;
    // A full set is never trimmed: the person deletes signatures to make room.
    if (signatures.length >= MARKUP_LIMITS.signatures) {
      setSheet(null);
      setFailure(signaturesFullMessage);
      return;
    }
    setSignatures((list) => [signature, ...list]);
    setSheet(null);
    sign(signature);
  };

  /* The keyboard. */

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    const typingInField = target.closest("input, textarea, [contenteditable]") !== null;
    const command = (event.metaKey || event.ctrlKey) && !event.altKey;
    const key = event.key.toLowerCase();
    const act = (run: () => void) => {
      event.preventDefault();
      run();
    };
    if (event.metaKey && event.ctrlKey && !event.altKey && !event.shiftKey) {
      if (key === "h" && pdf && !sheet && !typingInField) {
        return act(() => annotateText(highlightStyle));
      }
      if (key === "n" && pdf && !sheet && !typingInField) return act(startNote);
      if (key === "t" && doc && !sheet && !typingInField) return act(() => pickTool("text"));
    }
    const both = event.metaKey && event.ctrlKey;
    if (command && !event.shiftKey && !both && key === "n" && !sheet) {
      return act(() => void newFromClipboard());
    }
    if (command && event.shiftKey && key === "s" && doc && !sheet) {
      return act(() => void duplicate());
    }
    if (command && event.shiftKey && key === "f" && doc && !sheet) {
      return act(() => setSlideshow(true));
    }
    if (command && key === "*" && !sheet && selectionShown()) return act(zoomToSelection);
    if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === "KeyC") {
      if (doc?.kind === "image" && !sheet) return act(showAdjustColor);
    }
    if (command && !event.shiftKey && !both && key === "d" && pdf && !sheet) {
      return act(toggleBookmark);
    }
    if (command && !event.shiftKey && !both && key === "a" && !typingInField && !sheet) {
      if (doc?.kind === "image") return act(selectWholePicture);
      // In the thumbnails it chooses every page; on the page, its text, or its marks with the bar on.
      if (pdf && target.closest(".mac-preview-app-thumbnails")) {
        return act(() => setChosenPages(allPages()));
      }
      if (pdf && markupBar) return act(selectAllMarks);
      if (pdf && !markupBar) return act(selectPageText);
    }
    if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === "KeyT") {
      return act(() => setToolbarShown((shown) => !shown));
    }
    if (command && !event.shiftKey) {
      if (key === "o") return act(() => setSheet("open"));
      if (key === "i" && doc) return act(() => setInspector((shown) => !shown));
      if (key === "s" && doc) return act(() => void save());
      if (key === "f" && pdf && !sheet) return act(findInDocument);
      if (key === "g" && canFindNext && !sheet) return act(() => step(1));
      if (key === "z" && !typingInField) return act(undo);
      if (!typingInField && selectedMark && key === "c") return act(copyMark);
      if (!typingInField && selectedMark && key === "x") return act(cutMark);
      if (
        !typingInField &&
        !selectedMark &&
        !selectedText &&
        cropRect &&
        doc?.kind === "image" &&
        key === "x"
      )
        return act(() => void cutPicture());
      if (!typingInField && !selectedMark && !selectedText && doc?.kind === "image" && key === "c")
        return act(copyMark);
      if (!typingInField && copied.length > 0 && doc && key === "v") return act(pasteMark);
      if ((key === "=" || key === "+") && doc) return act(() => zoomBy(ZOOM_STEP));
      if (key === "-" && doc) return act(() => zoomBy(1 / ZOOM_STEP));
      if (key === "0" && doc) return act(actualSize);
      if (key === "9" && doc) return act(() => setZoom(1));
      if (key === "p" && doc) return act(() => void printDocument());
      if (key === "l" && doc) return act(() => rotate(-1));
      if (key === "r" && doc) return act(() => rotate(1));
      if (key === "k" && (cropRect || maskChosen())) return act(crop);
    }
    if (command && event.shiftKey && key === "g" && canFindPrevious && !sheet)
      return act(() => step(-1));
    if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === "KeyG" && pdf && !sheet)
      return act(() => setSheet("page"));
    if (command && event.shiftKey && key === "z" && !typingInField) return act(redo);
    if (command && event.shiftKey && key === "a" && doc) return act(() => showMarkup(!markupBar));
    if (typingInField) return;
    if (event.key === "`" && !command && !event.altKey && doc && !sheet) {
      return act(() => setMagnifier((shown) => !shown));
    }
    if (pdf && !sheet) {
      const steps: Record<string, number> = command
        ? { arrowup: page - 1, arrowdown: page + 1 }
        : { pageup: page - 1, pagedown: page + 1, home: 1, end: pageCount };
      const to = event.shiftKey ? undefined : steps[key];
      if (to !== undefined && to >= 1 && to <= pageCount) return act(() => goTo(to));
      if (command && key === "[" && !event.shiftKey) return act(goBack);
      if (command && key === "]" && !event.shiftKey) return act(goForward);
    }
    if (galleryAt >= 0 && !sheet && command && !event.shiftKey) {
      const to = gallery[galleryAt + (key === "arrowup" ? -1 : key === "arrowdown" ? 1 : 0)];
      if (to && to.id !== doc?.entry.id) return act(() => requestOpen(to));
    }
    if ((event.key === "Backspace" || event.key === "Delete") && selected)
      return act(deleteSelected);
    if (event.key === "Escape" && (cropRect || selected)) {
      return act(() => {
        setCropRect(null);
        setSelected(null);
      });
    }
  };

  /* The window. */

  // Where the file shown stands among the pictures sharing the window; -1 when none do.
  const galleryAt =
    gallery.length > 1 ? gallery.findIndex((each) => each.id === doc?.entry.id) : -1;
  const previousFile = galleryAt > 0 ? gallery[galleryAt - 1] : undefined;
  const nextFile = galleryAt >= 0 ? gallery[galleryAt + 1] : undefined;

  /** Shows or hides the Markup toolbar; text being typed is kept first (while it cannot be, the
   * toolbar stays). */
  const showMarkup = (pressed: boolean) => {
    if (typing && !commitTyping(true)) return;
    if (!commitNote(true)) return;
    setMarkupBar(pressed);
    setCropRect(null);
  };
  const sidebarChoice = sidebar ? sidebarMode : "hidden";
  const chooseSidebar = (choice: unknown) => {
    const kept = readSidebar(choice);
    if (!kept) return;
    setSidebar(kept !== "hidden");
    if (kept !== "hidden") setSidebarMode(kept);
    if (pdf) keepSidebar(kept);
  };
  const chooseTool = (value: Tool) => {
    setTool(value);
    setHighlighting(false);
    if (!isSelection(value)) setCropRect(null);
    if (value !== "select") setSelected(null);
  };
  /** Edit > Select All on a picture: all of what it keeps now, ready to copy or crop to. */
  const selectWholePicture = () => {
    if (typing && !commitTyping(true)) return;
    setMarkupBar(true);
    setTool("crop");
    setSelected(null);
    setCropOutline(null);
    setCropRect(edits.crop);
  };
  /** A tool from the Tools menu: the Markup toolbar shows with it, as it does on a Mac. */
  const pickTool = (value: Tool) => {
    if (typing && !commitTyping(true)) return;
    if (!commitNote(true)) return;
    setMarkupBar(true);
    chooseTool(value);
  };
  /** Tools > Text Selection: the pointer selects a PDF's text again. */
  const selectText = () => {
    showMarkup(false);
    setTool("select");
    setHighlighting(false);
  };
  const askSignature = () =>
    signatures.length >= MARKUP_LIMITS.signatures
      ? setFailure(signaturesFullMessage)
      : setSheet("signature");
  const signRows = (
    <>
      {signatures.map((signature, index) => (
        <MenuItem key={signature.id} onClick={() => sign(signature)}>
          Signature {index + 1}
        </MenuItem>
      ))}
      {signatures.length > 0 ? <MenuSeparator /> : null}
      <MenuItem onClick={askSignature}>Create Signature…</MenuItem>
      {signatures.length > 0 ? (
        <MenuItem onClick={() => blocked() || setSignatures([])}>Delete All Signatures</MenuItem>
      ) : null}
    </>
  );
  const pageDisplayRows = (
    <MenuRadioGroup value={layout} onValueChange={(value) => chooseDisplay(value as PageDisplay)}>
      <MenuRadioItem value="continuous" disabled={!pdf}>
        Continuous Scroll
      </MenuRadioItem>
      <MenuRadioItem value="single" disabled={!pdf}>
        Single Page
      </MenuRadioItem>
      <MenuRadioItem value="two" disabled={!pdf}>
        Two Pages
      </MenuRadioItem>
      <MenuRadioItem value="contact" disabled={!pdf}>
        Contact Sheet
      </MenuRadioItem>
    </MenuRadioGroup>
  );
  const sidebarRows = (
    <MenuRadioGroup value={sidebarChoice} onValueChange={chooseSidebar}>
      <MenuRadioItem value="hidden" disabled={!doc}>
        Hide Sidebar
      </MenuRadioItem>
      <MenuRadioItem value="thumbnails" disabled={!doc}>
        Thumbnails
      </MenuRadioItem>
      <MenuRadioItem value="contents" disabled={!pdf}>
        Table of Contents
      </MenuRadioItem>
      <MenuRadioItem value="notes" disabled={!pdf}>
        Highlights and Notes
      </MenuRadioItem>
      <MenuRadioItem value="bookmarks" disabled={!pdf}>
        Bookmarks
      </MenuRadioItem>
    </MenuRadioGroup>
  );
  const openExport = () => {
    setExportFormat(
      doc?.kind === "pdf"
        ? "pdf"
        : saveFormatOf(doc?.entry ?? { name: "" }) === "image/png"
          ? "png"
          : "jpeg",
    );
    setSheet("export");
  };
  const recentMenu = (
    <Submenu>
      <SubmenuTrigger disabled={places.length === 0}>Open Recent</SubmenuTrigger>
      <SubmenuPopup>
        {places.slice(0, RECENT_SHOWN).map((place) => (
          <MenuItem key={place.file} onClick={() => openRecent(place)}>
            {place.name}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem onClick={() => setPlaces([])}>Clear Menu</MenuItem>
      </SubmenuPopup>
    </Submenu>
  );

  const shareRows = (
    <FileShareItems
      items={
        doc ? [{ id: doc.entry.id, name: doc.entry.name, kind: "file", type: doc.entry.type }] : []
      }
      from="preview"
    />
  );

  // Preview's own menus in the menu bar while its window is in front; every key they show is
  // handled by the window (`keyDown`): the menu bar only labels it.
  useDesktopAppMenu(
    "preview",
    "File",
    <>
      <MenuItem keyEquivalent="command+n" onClick={() => void newFromClipboard()}>
        New from Clipboard
      </MenuItem>
      <MenuItem keyEquivalent="command+o" onClick={() => setSheet("open")}>
        Open…
      </MenuItem>
      {recentMenu}
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+s"
        disabled={!imageEdited && !formFilled}
        onClick={() => void save()}
      >
        Save
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+s"
        disabled={!doc || blockedNow}
        onClick={() => void duplicate()}
      >
        Duplicate
      </MenuItem>
      <MenuItem disabled={!doc || blockedNow} onClick={() => setSheet("rename")}>
        Rename…
      </MenuItem>
      <MenuItem disabled={!doc || blockedNow} onClick={() => setSheet("move")}>
        Move To…
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={!doc}>Revert To</SubmenuTrigger>
        <SubmenuPopup aria-label="Revert To">
          <MenuItem disabled={history.length === 0 || blockedNow} onClick={revertToSaved}>
            Last Saved
          </MenuItem>
          <MenuItem disabled title={NO_VERSIONS}>
            Previous Save
          </MenuItem>
          <MenuSeparator />
          <MenuItem disabled title={NO_VERSIONS}>
            Browse All Versions…
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem disabled={!doc} onClick={openExport}>
        Export…
      </MenuItem>
      <MenuItem
        disabled={!doc}
        onClick={() => {
          setExportFormat("pdf");
          setSheet("export");
        }}
      >
        Export as PDF…
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={!doc}>Share</SubmenuTrigger>
        <SubmenuPopup aria-label="Share">{shareRows}</SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem
        disabled={!locked}
        title={locked ? undefined : NOT_LOCKED}
        onClick={() => setSheet("password")}
      >
        Enter Password…
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled title={NO_IPHONE}>
        Import from iPhone
      </MenuItem>
      <MenuItem disabled title={NO_SCANNER}>
        Import from Scanner
      </MenuItem>
      <MenuItem disabled title={NO_CAMERA}>
        Import from Camera
      </MenuItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger>Take Screenshot</SubmenuTrigger>
        <SubmenuPopup aria-label="Take Screenshot">
          {(
            [
              ["selection", "From Selection…"],
              ["window", "From Window…"],
              ["screen", "From Entire Screen"],
            ] as const
          ).map(([kind, label]) => (
            <MenuItem
              key={kind}
              disabled={!canCaptureScreen()}
              title={canCaptureScreen() ? undefined : NO_CAPTURE}
              onClick={() => void takeScreenshot(kind)}
            >
              {label}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+p" disabled={!doc} onClick={() => void printDocument()}>
        Print…
      </MenuItem>
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "preview",
    "Edit",
    <>
      <MenuItem
        keyEquivalent="command+z"
        disabled={history.length === 0 || typing !== null}
        onClick={undo}
      >
        Undo
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+z"
        disabled={future.length === 0 || typing !== null}
        onClick={redo}
      >
        Redo
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+x"
        disabled={!selectedMark && !(cropRect && doc?.kind === "image")}
        onClick={() => (selectedMark ? cutMark() : void cutPicture())}
      >
        Cut
      </MenuItem>
      <MenuItem
        keyEquivalent="command+c"
        disabled={!selectedMark && !selectedText && doc?.kind !== "image"}
        onClick={copyMark}
      >
        Copy
      </MenuItem>
      <MenuItem
        keyEquivalent="command+v"
        disabled={copied.length === 0 || !doc}
        onClick={pasteMark}
      >
        Paste
      </MenuItem>
      <MenuItem
        disabled={!selectedMark && !(pdf && sidebar && pageCount > 1 && !blockedNow)}
        onClick={() => (selectedMark ? deleteSelected() : deletePages())}
      >
        Delete
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={!pdf || blockedNow}>Insert</SubmenuTrigger>
        <SubmenuPopup aria-label="Insert">
          <MenuItem onClick={() => setSheet("insert")}>Page from File…</MenuItem>
          <MenuItem onClick={insertBlankPage}>Blank Page</MenuItem>
          <MenuItem disabled title={NO_SCANNER}>
            Page from Scanner
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuItem
        disabled={doc === null}
        keyEquivalent="command+a"
        onClick={() =>
          doc?.kind === "image"
            ? selectWholePicture()
            : markupBar
              ? selectAllMarks()
              : selectPageText()
        }
      >
        Select All
      </MenuItem>
      <MenuItem
        disabled={!selected && !cropRect}
        onClick={() => {
          setSelected(null);
          setCropRect(null);
        }}
      >
        Deselect All
      </MenuItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger disabled={!pdf}>Find</SubmenuTrigger>
        <SubmenuPopup>
          <MenuItem keyEquivalent="command+f" onClick={findInDocument}>
            Find…
          </MenuItem>
          <MenuItem keyEquivalent="command+g" disabled={!canFindNext} onClick={() => step(1)}>
            Find Next
          </MenuItem>
          <MenuItem
            keyEquivalent="shift+command+g"
            disabled={!canFindPrevious}
            onClick={() => step(-1)}
          >
            Find Previous
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      {textTools.items}
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "preview",
    "View",
    <>
      {pageDisplayRows}
      <MenuSeparator />
      {sidebarRows}
      <MenuSeparator />
      <MenuItem keyEquivalent="command+0" disabled={!doc} onClick={actualSize}>
        Actual Size
      </MenuItem>
      <MenuItem keyEquivalent="command+9" disabled={!doc} onClick={() => setZoom(1)}>
        Zoom to Fit
      </MenuItem>
      <MenuItem
        keyEquivalent="command+="
        disabled={!doc || zoom >= ZOOM_MAX}
        onClick={() => zoomBy(ZOOM_STEP)}
      >
        Zoom In
      </MenuItem>
      <MenuItem
        keyEquivalent="command+-"
        disabled={!doc || zoom <= ZOOM_MIN}
        onClick={() => zoomBy(1 / ZOOM_STEP)}
      >
        Zoom Out
      </MenuItem>
      <MenuItem
        keyEquivalent="command+*"
        disabled={!cropRect && !selectedText}
        title={cropRect || selectedText ? undefined : "Select part of the document first."}
        onClick={zoomToSelection}
      >
        Zoom to Selection
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="shift+command+a"
        disabled={!doc}
        onClick={() => showMarkup(!markupBar)}
      >
        {markupBar ? "Hide Markup Toolbar" : "Show Markup Toolbar"}
      </MenuItem>
      <MenuItem keyEquivalent="option+command+t" onClick={() => setToolbarShown((shown) => !shown)}>
        {toolbarShown ? "Hide Toolbar" : "Show Toolbar"}
      </MenuItem>
      <MenuItem disabled={!toolbarShown} onClick={() => setCustomizing(true)}>
        Customize Toolbar…
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+f" disabled={!doc} onClick={() => setSlideshow(true)}>
        Slideshow
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled title={NO_TABS}>
        Show Tab Bar
      </MenuItem>
      <MenuItem disabled title={NO_TABS}>
        Show All Tabs
      </MenuItem>
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "preview",
    "Go",
    <>
      <MenuItem
        keyEquivalent="command+up"
        disabled={pdf ? firstShown <= 1 : !previousFile}
        onClick={() => (pdf ? goTo(previousPage) : previousFile && requestOpen(previousFile))}
      >
        Previous
      </MenuItem>
      <MenuItem
        keyEquivalent="command+down"
        disabled={pdf ? lastShown >= pageCount : !nextFile}
        onClick={() => (pdf ? goTo(nextPage) : nextFile && requestOpen(nextFile))}
      >
        Next
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="page-up"
        disabled={!pdf || firstShown <= 1}
        onClick={() => goTo(previousPage)}
      >
        Page Up
      </MenuItem>
      <MenuItem
        keyEquivalent="page-down"
        disabled={!pdf || lastShown >= pageCount}
        onClick={() => goTo(nextPage)}
      >
        Page Down
      </MenuItem>
      <MenuItem keyEquivalent="home" disabled={!pdf || page <= 1} onClick={() => goTo(1)}>
        Home
      </MenuItem>
      <MenuItem
        keyEquivalent="end"
        disabled={!pdf || page >= pageCount}
        onClick={() => goTo(pageCount)}
      >
        End
      </MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="option+command+g" disabled={!pdf} onClick={() => setSheet("page")}>
        Go to Page…
      </MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+[" disabled={trail.back.length === 0} onClick={goBack}>
        Back
      </MenuItem>
      <MenuItem keyEquivalent="command+]" disabled={trail.forward.length === 0} onClick={goForward}>
        Forward
      </MenuItem>
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "preview",
    "Tools",
    <>
      <MenuItem disabled={!pdf} onClick={selectText}>
        Text Selection
      </MenuItem>
      <MenuItem
        disabled={doc?.kind !== "image"}
        title={doc?.kind === "pdf" ? NO_PAGE_CROP : undefined}
        onClick={() => pickTool("crop")}
      >
        Rectangular Selection
      </MenuItem>
      <MenuItem
        disabled={doc?.kind !== "image"}
        title={doc?.kind === "pdf" ? NO_PAGE_CROP : undefined}
        onClick={() => pickTool("ellipse")}
      >
        Elliptical Selection
      </MenuItem>
      <MenuItem
        disabled={doc?.kind !== "image"}
        title={doc?.kind === "pdf" ? NO_PAGE_CROP : undefined}
        onClick={() => pickTool("lasso")}
      >
        Lasso Selection
      </MenuItem>
      <MenuItem
        disabled={doc?.kind !== "image"}
        title={doc?.kind === "pdf" ? NO_PAGE_CROP : undefined}
        onClick={() => pickTool("smartLasso")}
      >
        Smart Lasso
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+i"
        disabled={!doc}
        onClick={() => setInspector((shown) => !shown)}
      >
        {inspector ? "Hide Inspector" : "Show Inspector"}
      </MenuItem>
      <MenuItem keyEquivalent="`" disabled={!doc} onClick={() => setMagnifier((shown) => !shown)}>
        {magnifier ? "Hide Magnifier" : "Show Magnifier"}
      </MenuItem>
      <MenuSeparator />
      <Submenu>
        <SubmenuTrigger disabled={!doc}>Annotate</SubmenuTrigger>
        <SubmenuPopup aria-label="Annotate">
          <MenuItem
            keyEquivalent="control+command+h"
            disabled={!pdf}
            title={pdf ? undefined : ONLY_PDF_TEXT}
            onClick={() => annotateText(highlightStyle)}
          >
            Highlight Text
          </MenuItem>
          <MenuItem
            disabled={!pdf}
            title={pdf ? undefined : ONLY_PDF_TEXT}
            onClick={() => annotateText(UNDERLINE)}
          >
            Underline Text
          </MenuItem>
          <MenuItem
            disabled={!pdf}
            title={pdf ? undefined : ONLY_PDF_TEXT}
            onClick={() => annotateText(STRIKETHROUGH)}
          >
            Strikethrough Text
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => pickTool("rect")}>Rectangle</MenuItem>
          <MenuItem onClick={() => pickTool("oval")}>Oval</MenuItem>
          <MenuItem onClick={() => pickTool("line")}>Line</MenuItem>
          <MenuItem onClick={() => pickTool("arrow")}>Arrow</MenuItem>
          <MenuItem onClick={() => pickTool("star")}>Star</MenuItem>
          <MenuItem onClick={() => pickTool("polygon")}>Polygon</MenuItem>
          <MenuItem onClick={() => pickTool("bubble")}>Speech Bubble</MenuItem>
          <MenuItem onClick={() => pickTool("mask")}>Mask</MenuItem>
          <MenuItem onClick={() => pickTool("loupe")}>Loupe</MenuItem>
          <MenuSeparator />
          <MenuItem keyEquivalent="control+command+t" onClick={() => pickTool("text")}>
            Text
          </MenuItem>
          <Submenu>
            <SubmenuTrigger>Signature</SubmenuTrigger>
            <SubmenuPopup aria-label="Signature">{signRows}</SubmenuPopup>
          </Submenu>
          <MenuItem
            keyEquivalent="control+command+n"
            disabled={!pdf}
            title={pdf ? undefined : "Only a PDF keeps notes."}
            onClick={startNote}
          >
            Note
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+l" disabled={!doc} onClick={() => rotate(-1)}>
        Rotate Left
      </MenuItem>
      <MenuItem keyEquivalent="command+r" disabled={!doc} onClick={() => rotate(1)}>
        Rotate Right
      </MenuItem>
      <MenuItem disabled={doc?.kind !== "image"} onClick={() => flip("horizontal")}>
        Flip Horizontal
      </MenuItem>
      <MenuItem disabled={doc?.kind !== "image"} onClick={() => flip("vertical")}>
        Flip Vertical
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={doc?.kind !== "image"} onClick={() => setSheet("resize")}>
        Adjust Size…
      </MenuItem>
      <MenuItem
        keyEquivalent="option+command+c"
        disabled={doc?.kind !== "image"}
        title={doc?.kind === "pdf" ? ONLY_PICTURE_COLOR : undefined}
        onClick={showAdjustColor}
      >
        Adjust Color…
      </MenuItem>
      <MenuItem keyEquivalent="command+k" disabled={!cropRect && !maskChosen()} onClick={crop}>
        Crop
      </MenuItem>
      <MenuItem disabled title={NO_PROFILE}>
        Assign Profile…
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+d"
        disabled={!pdf}
        title={pdf ? undefined : "Only a PDF has pages to bookmark."}
        onClick={toggleBookmark}
      >
        {bookmarkedNow.includes(page) ? "Remove Bookmark" : "Add Bookmark"}
      </MenuItem>
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "preview",
    "Window",
    <>
      <MenuItem disabled title={NO_TABS}>
        Merge All Windows
      </MenuItem>
      <MenuItem disabled title={NO_TABS}>
        Move Tab to New Window
      </MenuItem>
      <MenuSeparator />
    </>,
    titleBar,
  );

  const name = doc?.entry.name ?? "Preview";
  const title = !doc
    ? "Preview"
    : pdf
      ? `${name} (page ${page} of ${pageCount})${history.length > 0 ? " — Edited" : ""}`
      : `${name}${imageEdited ? " — Edited" : ""}`;
  const status = busy ? busy.label : (notice ?? null);
  const canvasColor = doc?.kind === "pdf" ? pdfBackground : imageBackground;
  const typingSource = typing ? sourceOf(typing.page) : null;
  const toolButton = (value: Tool, glyph: Parameters<typeof PreviewGlyph>[0]["name"]) => (
    <MarkupToolbarTool
      key={value}
      aria-label={TOOL_NAMES[value]}
      selected={tool === value}
      onClick={() => chooseTool(value)}
    >
      <PreviewGlyph name={glyph} />
    </MarkupToolbarTool>
  );

  return (
    <Window
      state={state}
      className={
        className ? `mac-preview mac-preview-app ${className}` : "mac-preview mac-preview-app"
      }
      aria-busy={busy !== null || loading || undefined}
      onKeyDown={keyDown}
      {...windowProps}
    >
      {self ? <DesktopWindowName title={doc?.entry.name ?? "Preview"} /> : null}
      <TitleBar
        ref={setTitleBar}
        variant={toolbarShown ? "unified" : "standard"}
        divider={searching || markupBar ? "bar" : "content"}
        title={
          doc ? (
            <>
              {title}
              <TitleMenu
                entry={doc.entry}
                list={drive.folders}
                onRename={(name) =>
                  void changeFile(
                    (file) => drive.rename(file, name),
                    (file) => `Renamed to “${file.name}”.`,
                  )
                }
                onMove={(folder) =>
                  void changeFile(
                    (file) => drive.move(file, folder),
                    (file) => `Moved “${file.name}”.`,
                  )
                }
              />
            </>
          ) : (
            title
          )
        }
        icon={
          doc ? (
            <span
              className="mac-preview-app-proxy"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                // The press drags the file and not the window.
                event.preventDefault();
                beginDesktopDrag(event.nativeEvent, {
                  from: "preview",
                  icon: event.currentTarget,
                  items: () => [
                    {
                      id: doc.entry.id,
                      name: doc.entry.name,
                      kind: "file",
                      type: doc.entry.type,
                      size: doc.entry.size,
                    },
                  ],
                });
              }}
            >
              <DocumentIcon kind={doc.kind} />
            </span>
          ) : undefined
        }
        controls={
          <WindowControls
            onClose={close}
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
          <Toolbar aria-label="Preview toolbar" className="mac-preview-toolbar">
            {toolShown("view") ? (
              <ToolbarPullDown
                compact
                image={<SystemImage name="sidebar" />}
                aria-label="View"
                disabled={!doc}
              >
                {sidebarRows}
                <MenuSeparator />
                {pageDisplayRows}
                <MenuSeparator />
                <MenuItem onClick={actualSize}>Actual Size</MenuItem>
                <MenuItem onClick={() => setZoom(1)}>Zoom to Fit</MenuItem>
              </ToolbarPullDown>
            ) : null}
            {toolShown("zoom") ? (
              <ToolbarSegmentedControl variant="separated" tracking="momentary" aria-label="Zoom">
                <ToolbarSegment
                  aria-label="Zoom Out"
                  disabled={!doc || zoom <= ZOOM_MIN}
                  onClick={() => zoomBy(1 / ZOOM_STEP)}
                >
                  <PreviewGlyph name="zoomOut" />
                </ToolbarSegment>
                <ToolbarSegment
                  aria-label="Zoom In"
                  disabled={!doc || zoom >= ZOOM_MAX}
                  onClick={() => zoomBy(ZOOM_STEP)}
                >
                  <PreviewGlyph name="zoomIn" />
                </ToolbarSegment>
              </ToolbarSegmentedControl>
            ) : null}
            {toolShown("open") ? (
              <ToolbarButton onClick={() => setSheet("open")}>Open…</ToolbarButton>
            ) : null}
            {toolShown("file") ? (
              <ToolbarPullDown
                compact
                image={<SystemImage name="share" />}
                aria-label="File"
                disabled={!doc}
              >
                <MenuItem disabled={!imageEdited && !formFilled} onClick={() => void save()}>
                  Save
                </MenuItem>
                <MenuItem onClick={openExport}>Export…</MenuItem>
                <Submenu>
                  <SubmenuTrigger>Share</SubmenuTrigger>
                  <SubmenuPopup aria-label="Share">{shareRows}</SubmenuPopup>
                </Submenu>
                {recentMenu}
                <MenuSeparator />
                {EXPORT_FORMATS.map((format) => (
                  <MenuItem key={format.value} onClick={() => void download(format.value)}>
                    Download as {format.label}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem
                  disabled={
                    doc?.kind !== "image" || history.length === 0 || busy !== null || loading
                  }
                  onClick={() => changeEdits(NO_EDITS)}
                >
                  Revert Edits
                </MenuItem>
                <MenuItem
                  disabled={markup.pages.length === 0 || busy !== null || loading}
                  onClick={() => changeMarkup({ ...markup, pages: [] })}
                >
                  Remove All Markup
                </MenuItem>
              </ToolbarPullDown>
            ) : null}
            <ToolbarSpace />
            {toolShown("highlight") ? (
              <ToolbarSplitPullDown
                image={<PreviewGlyph name="highlight" size={14} />}
                aria-label={highlighting ? "Stop Highlighting" : "Highlight"}
                data-pressed={highlighting ? "" : undefined}
                menuLabel="Highlight Style"
                disabled={!pdf}
                style={HIGHLIGHT_BUTTON}
                onClick={() => {
                  if (!markSelectedText(textMarkStyle)) setHighlighting(!highlighting);
                }}
              >
                <MenuRadioGroup
                  value={
                    textMarkStyle.kind === "highlight" ? textMarkStyle.color : textMarkStyle.kind
                  }
                  onValueChange={(value) => chooseTextMark(String(value))}
                >
                  {HIGHLIGHT_COLORS.map((entry) => (
                    <MenuRadioItem key={entry.value} value={entry.value}>
                      {entry.name}
                    </MenuRadioItem>
                  ))}
                  <MenuSeparator />
                  <MenuRadioItem value="underline">Underline</MenuRadioItem>
                  <MenuRadioItem value="strikethrough">Strikethrough</MenuRadioItem>
                </MenuRadioGroup>
              </ToolbarSplitPullDown>
            ) : null}
            {toolShown("rotate") ? (
              <>
                <ToolbarButton aria-label="Rotate Left" disabled={!doc} onClick={() => rotate(-1)}>
                  <PreviewGlyph name="rotate" />
                </ToolbarButton>
                <ToolbarButton aria-label="Rotate Right" disabled={!doc} onClick={() => rotate(1)}>
                  <PreviewGlyph name="rotateRight" />
                </ToolbarButton>
              </>
            ) : null}
            {toolShown("markup") ? (
              <ToolbarButton
                aria-label="Show Markup Toolbar"
                disabled={!doc}
                pressed={markupBar}
                onPressedChange={showMarkup}
              >
                <PreviewGlyph name="markup" />
              </ToolbarButton>
            ) : null}
            {toolShown("inspector") ? (
              <ToolbarButton
                aria-label="Show Inspector"
                disabled={!doc}
                pressed={inspector}
                onPressedChange={setInspector}
              >
                <SystemImage name="info-outline" />
              </ToolbarButton>
            ) : null}
            {toolShown("search") ? (
              <ToolbarSearchField
                className="mac-preview-app-search"
                aria-label="Search"
                inputRef={searchField}
                disabled={!pdf}
                value={query}
                onValueChange={setQuery}
              />
            ) : null}
          </Toolbar>
        ) : null}
      </TitleBar>
      {markupBar && doc ? (
        <div className="mac-preview-markup">
          <MarkupToolbar aria-label="Markup">
            {toolButton("select", "select")}
            {doc.kind === "image" ? toolButton("crop", "crop") : null}
            {doc.kind === "image" ? toolButton("ellipse", "ellipseSelect") : null}
            {doc.kind === "image" ? toolButton("lasso", "lasso") : null}
            {doc.kind === "image" ? toolButton("smartLasso", "smartLasso") : null}
            {toolButton("sketch", "sketch")}
            <MarkupToolbarTool aria-label="Draw" disabled title={NO_PRESSURE}>
              <PreviewGlyph name="sketch" />
            </MarkupToolbarTool>
            <Menu>
              <MenuTrigger
                render={
                  <MarkupToolbarTool
                    menu
                    aria-label="Shapes"
                    selected={SHAPE_GLYPHS[tool] !== undefined}
                  />
                }
              >
                <PreviewGlyph name={SHAPE_GLYPHS[tool] ?? "shapes"} />
              </MenuTrigger>
              <MenuPopup>
                {(
                  [
                    "line",
                    "arrow",
                    "rect",
                    "oval",
                    "star",
                    "polygon",
                    "bubble",
                    "mask",
                    "loupe",
                  ] as const
                ).map((shape) => (
                  <MenuItem
                    key={shape}
                    onClick={() => {
                      setTool(shape);
                      setHighlighting(false);
                    }}
                  >
                    {TOOL_NAMES[shape]}
                  </MenuItem>
                ))}
              </MenuPopup>
            </Menu>
            {toolButton("text", "text")}
            {pdf ? toolButton("note", "note") : null}
            <Menu>
              <MenuTrigger render={<MarkupToolbarTool menu aria-label="Sign" />}>
                <PreviewGlyph name="sign" />
              </MenuTrigger>
              <MenuPopup>{signRows}</MenuPopup>
            </Menu>
            <MarkupToolbarSeparator />
            {doc.kind === "image" ? (
              <>
                <MarkupToolbarTool
                  aria-label="Crop"
                  disabled={!cropRect && !maskChosen()}
                  onClick={crop}
                >
                  <PreviewGlyph name="crop" />
                </MarkupToolbarTool>
                <MarkupToolbarTool aria-label="Adjust Size" onClick={() => setSheet("resize")}>
                  <PreviewGlyph name="resize" />
                </MarkupToolbarTool>
                <MarkupToolbarTool aria-label="Adjust Color" onClick={showAdjustColor}>
                  <PreviewGlyph name="adjust" />
                </MarkupToolbarTool>
                <MarkupToolbarSeparator />
              </>
            ) : null}
            <Menu>
              <MenuTrigger render={<MarkupToolbarTool menu aria-label="Shape Style" />}>
                <PreviewGlyph name="line" />
              </MenuTrigger>
              <MenuPopup>
                <MenuRadioGroup
                  value={String(stroke)}
                  onValueChange={(value) => chooseStroke(Number(value))}
                >
                  {MARKUP_STROKES.map((entry) => (
                    <MenuRadioItem key={entry.name} value={String(entry.value)}>
                      {entry.name}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
                <MenuSeparator />
                <MenuRadioGroup
                  value={
                    selectedMark && isStyledLine(selectedMark)
                      ? (selectedMark.dash ?? "solid")
                      : dash
                  }
                  onValueChange={(value) => chooseDash(value as MarkDash | "solid")}
                >
                  {MARKUP_DASHES.map((entry) => (
                    <MenuRadioItem key={entry.value} value={entry.value}>
                      {entry.name}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
                <MenuSeparator />
                <MenuRadioGroup
                  value={arrowEndsShown}
                  onValueChange={(value) => chooseArrowEnds(value as ArrowEnds)}
                >
                  {MARKUP_ARROW_ENDS.map((entry) => (
                    <MenuRadioItem key={entry.value} value={entry.value}>
                      {entry.name}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
                <MenuSeparator />
                <MenuCheckboxItem
                  checked={
                    selectedMark && isStyledLine(selectedMark)
                      ? selectedMark.shadow === true
                      : shadow
                  }
                  onCheckedChange={(checked) => chooseShadow(checked === true)}
                >
                  Shadow
                </MenuCheckboxItem>
              </MenuPopup>
            </Menu>
            <Menu>
              <MenuTrigger render={<MarkupToolbarTool menu aria-label="Border Color" />}>
                <MarkupToolbarSwatch variant="border" color={color} />
              </MenuTrigger>
              <MenuPopup>
                <MenuRadioGroup
                  value={color}
                  onValueChange={(value) => recolor(String(value), "color")}
                >
                  {MARKUP_COLORS.map((entry) => (
                    <MenuRadioItem key={entry.value} value={entry.value}>
                      {entry.name}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
                <MenuSeparator />
                <MenuItem onClick={() => openColorChooser(borderChooser.current)}>
                  Show Colors…
                </MenuItem>
              </MenuPopup>
            </Menu>
            <Menu>
              <MenuTrigger render={<MarkupToolbarTool menu aria-label="Fill Color" />}>
                <MarkupToolbarSwatch color={fill ?? undefined} />
              </MenuTrigger>
              <MenuPopup>
                <MenuRadioGroup
                  value={fill ?? "none"}
                  onValueChange={(value) => recolor(String(value), "fill")}
                >
                  <MenuRadioItem value="none">No Fill</MenuRadioItem>
                  {MARKUP_COLORS.map((entry) => (
                    <MenuRadioItem key={entry.value} value={entry.value}>
                      {entry.name}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
                <MenuSeparator />
                <MenuItem onClick={() => openColorChooser(fillChooser.current)}>
                  Show Colors…
                </MenuItem>
              </MenuPopup>
            </Menu>
            <Menu>
              <MenuTrigger render={<MarkupToolbarTool menu aria-label="Text Style" />}>
                <PreviewGlyph name="text" />
              </MenuTrigger>
              <MenuPopup>
                <MenuRadioGroup
                  value={String(textSize)}
                  onValueChange={(value) => chooseTextSize(Number(value))}
                >
                  {MARKUP_TEXT_SIZES.map((entry) => (
                    <MenuRadioItem key={entry.name} value={String(entry.value)}>
                      {entry.name}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
                <MenuSeparator />
                <MenuRadioGroup
                  value={shownTextFont}
                  onValueChange={(value) =>
                    chooseFont(value as NonNullable<Mark["font"]> | "system")
                  }
                >
                  <MenuRadioItem value="system">System Font</MenuRadioItem>
                  {[
                    ...MARKUP_FONTS.map((entry) => entry.name),
                    ...(shownTextFont !== "system" &&
                    !MARKUP_FONTS.some((entry) => entry.name === shownTextFont)
                      ? [shownTextFont]
                      : []),
                  ].map((family) => (
                    <MenuRadioItem key={family} value={family}>
                      {family}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
                <MenuItem onClick={() => setFontsShown(true)}>Show Fonts</MenuItem>
                <MenuSeparator />
                {(
                  [
                    ["bold", "Bold"],
                    ["italic", "Italic"],
                    ["underline", "Underline"],
                  ] as const
                ).map(([which, name]) => (
                  <MenuCheckboxItem
                    key={which}
                    checked={textStyleOf(which)}
                    onCheckedChange={(checked) => chooseTextStyle(which, checked === true)}
                  >
                    {name}
                  </MenuCheckboxItem>
                ))}
                <MenuSeparator />
                <MenuRadioGroup
                  value={selectedMark?.kind === "text" ? (selectedMark.align ?? "left") : textAlign}
                  onValueChange={(value) => chooseAlign(value as NonNullable<Mark["align"]>)}
                >
                  {MARKUP_ALIGNMENTS.map((entry) => (
                    <MenuRadioItem key={entry.value} value={entry.value}>
                      {entry.name}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
            <MarkupToolbarSeparator />
            <MarkupToolbarTool aria-label="Undo" disabled={history.length === 0} onClick={undo}>
              <PreviewGlyph name="undo" />
            </MarkupToolbarTool>
          </MarkupToolbar>
          <ColorWell
            ref={borderChooser}
            className="mac-preview-app-color-input"
            aria-label="Border Color Chooser"
            tabIndex={-1}
            value={color}
            onValueChange={(value) => recolor(String(value), "color")}
          />
          <ColorWell
            ref={fillChooser}
            className="mac-preview-app-color-input"
            aria-label="Fill Color Chooser"
            tabIndex={-1}
            value={fill ?? "#ffffff"}
            onValueChange={(value) => recolor(String(value), "fill")}
          />
        </div>
      ) : null}
      {searching ? (
        <ScopeBar surface="toolbar" className="mac-preview-find">
          <ScopeBarLabel>Search “{query.trim()}”</ScopeBarLabel>
          <ScopeBarLabel id={sortLabel}>Sort by:</ScopeBarLabel>
          <ScopeBarGroup
            aria-labelledby={sortLabel}
            value={sort}
            onValueChange={(value) => setSort(value as PreviewSort)}
          >
            <ScopeBarButton value="rank">Search Rank</ScopeBarButton>
            <ScopeBarButton value="page">Page Order</ScopeBarButton>
          </ScopeBarGroup>
          <ScopeBarActions>
            <span role="status" className="mac-preview-found">
              {results.length > 0
                ? `Found on ${results.length} ${results.length === 1 ? "page" : "pages"}`
                : "Not found"}
            </span>
            <ScopeBarActionGroup aria-label="Pages found">
              <ScopeBarAction
                glyph="previous"
                aria-label="Previous"
                disabled={!canFindPrevious}
                onClick={() => step(-1)}
              />
              <ScopeBarAction
                glyph="next"
                aria-label="Next"
                disabled={!canFindNext}
                onClick={() => step(1)}
              />
            </ScopeBarActionGroup>
            <ScopeBarAction onClick={() => setQuery("")}>Done</ScopeBarAction>
          </ScopeBarActions>
        </ScopeBar>
      ) : null}
      <WindowBody
        ref={dropRef}
        background="content"
        className="mac-preview-body"
        inert={loading || undefined}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) event.preventDefault();
        }}
        onDrop={(event) => {
          if (event.dataTransfer.files.length === 0) return;
          event.preventDefault();
          void takeFromComputer([...event.dataTransfer.files], null);
        }}
      >
        {doc ? (
          <SplitView className="mac-preview-split">
            <SplitViewPane
              size={sidebar || searching ? sidebarWidth : 0}
              onSizeChange={(size) => {
                if (size > 0) setSidebarWidth(size);
                else if (!searching) chooseSidebar("hidden");
              }}
              minSize={150}
              maxSize={320}
              collapsible
              className="mac-preview-sidebar"
            >
              <div className="mac-preview-file">{doc.entry.name}</div>
              {searching ? (
                <ListView
                  aria-label="Pages found"
                  className="mac-preview-rows"
                  count={listed.length}
                  rowHeight={82}
                  separatorInset={14}
                  getRowId={(index) => listed[index]?.page ?? index}
                  getRowLabel={(index) => `Page ${listed[index]?.page ?? ""}`}
                  value={position >= 0 ? [page] : []}
                  onValueChange={(value) => value.length > 0 && goTo(Number(value[0]))}
                  renderRow={(index) => {
                    const result = listed[index];
                    return result ? (
                      <span className="mac-preview-app-result">
                        <span className="mac-preview-row-head">
                          <span className="mac-preview-row-title">Page {result.page}</span>
                          <span className="mac-preview-row-count">
                            {result.count} {result.count === 1 ? "match" : "matches"}
                          </span>
                        </span>
                        <span className="mac-preview-row-snippet">{result.snippet}</span>
                      </span>
                    ) : null;
                  }}
                />
              ) : sidebarMode === "contents" && outline.length === 0 ? (
                <div className="mac-preview-app-annotations-empty">
                  <EmptyState role="status">No Table of Contents</EmptyState>
                </div>
              ) : sidebarMode === "contents" ? (
                <ListView
                  aria-label="Table of Contents"
                  className="mac-preview-rows"
                  count={outline.length}
                  rowHeight={24}
                  getRowId={(index) => index}
                  getRowLabel={(index) => outline[index]?.title ?? ""}
                  onValueChange={(value) => {
                    const row = outline[Number(value[0])];
                    if (row) goTo(row.page);
                  }}
                  renderRow={(index) => {
                    const row = outline[index];
                    return row ? (
                      <span
                        className="mac-preview-app-contents-row"
                        style={{ "--mac-preview-app-contents-level": row.level } as CSSProperties}
                      >
                        {row.title}
                      </span>
                    ) : null;
                  }}
                />
              ) : sidebarMode === "bookmarks" && bookmarkedNow.length === 0 ? (
                <div className="mac-preview-app-annotations-empty">
                  <EmptyState role="status">No Bookmarks</EmptyState>
                </div>
              ) : sidebarMode === "bookmarks" ? (
                <ListView
                  aria-label="Bookmarks"
                  className="mac-preview-rows"
                  count={bookmarkedNow.length}
                  rowHeight={24}
                  getRowId={(index) => bookmarkedNow[index] ?? index}
                  getRowLabel={(index) => `Page ${bookmarkedNow[index] ?? ""}`}
                  value={bookmarkedNow.includes(page) ? [page] : []}
                  onValueChange={(value) => {
                    if (value.length > 0) goTo(Number(value[0]));
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Delete" && event.key !== "Backspace") return;
                    if (!bookmarkedNow.includes(page)) return;
                    event.preventDefault();
                    toggleBookmark();
                  }}
                  renderRow={(index) => (
                    <span
                      className="mac-preview-app-contents-row"
                      style={{ "--mac-preview-app-contents-level": 0 } as CSSProperties}
                    >
                      Page {bookmarkedNow[index]}
                    </span>
                  )}
                />
              ) : sidebarMode === "notes" && annotations.length === 0 ? (
                <div className="mac-preview-app-annotations-empty">
                  <EmptyState role="status">No Highlights or Notes</EmptyState>
                </div>
              ) : sidebarMode === "notes" ? (
                <ListView
                  aria-label="Highlights and Notes"
                  className="mac-preview-rows"
                  count={annotations.length}
                  rowHeight={82}
                  separatorInset={14}
                  getRowId={(index) => annotations[index]?.mark.id ?? index}
                  getRowLabel={(index) => {
                    const row = annotations[index];
                    return row ? `${ANNOTATION_NAMES[row.mark.kind]}, page ${row.page}` : "";
                  }}
                  value={selected ? [selected] : []}
                  onValueChange={(value) => {
                    const row = annotations.find((each) => each.mark.id === value[0]);
                    if (!row) return;
                    goTo(row.page);
                    setSelected(row.mark.id);
                  }}
                  renderRow={(index) => {
                    const row = annotations[index];
                    return row ? (
                      <span className="mac-preview-app-result">
                        <span className="mac-preview-row-head">
                          <span className="mac-preview-row-title">
                            <span
                              className="mac-preview-app-annotation-color"
                              style={{ background: row.mark.color }}
                            />
                            {ANNOTATION_NAMES[row.mark.kind]}
                          </span>
                          <span className="mac-preview-row-count">Page {row.page}</span>
                        </span>
                        <span className="mac-preview-row-snippet">{row.mark.text}</span>
                      </span>
                    ) : null;
                  }}
                />
              ) : galleryAt >= 0 ? (
                <PreviewGallery
                  files={gallery}
                  current={doc.entry.id}
                  read={drive.read}
                  loadImage={loadImage}
                  onChoose={requestOpen}
                />
              ) : (
                <ContextualMenu>
                  <ContextualMenuTrigger className="mac-preview-app-thumbnails-menu">
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: a drag of the list's rows, which are its controls */}
                    <div
                      ref={thumbnailsDrop}
                      className="mac-preview-app-thumbnails-frame"
                      onDragStart={(event) => {
                        const row = (event.target as HTMLElement).closest<HTMLElement>(
                          "[data-index]",
                        );
                        if (!pdf || !row) return;
                        const number = Number(row.dataset.index) + 1;
                        draggedPages.current = chosen.includes(number) ? chosen : [number];
                        if (self) {
                          const pages = draggedPages.current;
                          notePagesDragged({
                            from: self,
                            item: () => pagesDragItem(pages),
                            taken: false,
                          });
                        }
                        event.dataTransfer.effectAllowed = "copyMove";
                        event.dataTransfer.setData("text/plain", `Page ${number}`);
                      }}
                      onDragOver={(event) => {
                        const row = (event.target as HTMLElement).closest<HTMLElement>(
                          "[data-index]",
                        );
                        const coming = pagesDragged();
                        const fromElsewhere = coming !== null && coming.from !== self;
                        if ((!draggedPages.current && !fromElsewhere) || !row) return;
                        event.preventDefault();
                        if (fromElsewhere) event.dataTransfer.dropEffect = "copy";
                        const box = row.getBoundingClientRect();
                        const below = event.clientY > box.top + box.height / 2;
                        setDropLine({
                          before: Number(row.dataset.index) + 1 + (below ? 1 : 0),
                          top:
                            (below ? box.bottom : box.top) -
                            event.currentTarget.getBoundingClientRect().top,
                        });
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          setDropLine(null);
                        }
                      }}
                      onDrop={(event) => {
                        if (event.dataTransfer.files.length > 0 && pdf) {
                          event.preventDefault();
                          event.stopPropagation();
                          const row = (event.target as HTMLElement).closest<HTMLElement>(
                            "[data-index]",
                          );
                          void takeFromComputer(
                            [...event.dataTransfer.files],
                            row ? Number(row.dataset.index) + 1 : pageCount,
                          );
                          return;
                        }
                        const coming = pagesDragged();
                        if (coming && coming.from !== self && dropLine) {
                          event.preventDefault();
                          event.stopPropagation();
                          coming.taken = true;
                          const item = coming.item();
                          const after = dropLine.before - 1;
                          setDropLine(null);
                          if (item) void insertPagesOf(item, after);
                          return;
                        }
                        const moving = draggedPages.current;
                        if (!moving || !dropLine) return;
                        event.preventDefault();
                        movePages(moving, dropLine.before);
                        draggedPages.current = null;
                        setDropLine(null);
                      }}
                      onDragEnd={(event) => {
                        const moving = draggedPages.current;
                        draggedPages.current = null;
                        setDropLine(null);
                        const taken = pagesDragged()?.taken ?? false;
                        notePagesDragged(null);
                        if (moving && !taken) {
                          dropPagesAt(event.clientX, event.clientY, event.currentTarget, moving);
                        }
                      }}
                    >
                      <ListView
                        aria-label="Thumbnails"
                        className="mac-preview-rows mac-preview-app-thumbnails"
                        count={pageCount}
                        rowHeight={132}
                        selectionMode="multiple"
                        rowDraggable={pdf !== null}
                        getRowId={(index) => index + 1}
                        getRowLabel={(index) => `Page ${index + 1}`}
                        value={chosen as number[]}
                        onValueChange={(value) => {
                          const numbers = value.map(Number);
                          const added = numbers.find((number) => !chosen.includes(number));
                          if (numbers.length === 0) return;
                          setChosenPages(numbers);
                          const to =
                            numbers.length === 1
                              ? numbers[0]
                              : (added ?? (numbers.includes(page) ? undefined : numbers.at(-1)));
                          if (to !== undefined) goTo(to);
                        }}
                        onKeyDown={(event) => {
                          if ((event.key !== "Delete" && event.key !== "Backspace") || selected)
                            return;
                          event.preventDefault();
                          deletePages();
                        }}
                        onContextMenuCapture={(event) => {
                          const at = (event.target as HTMLElement)
                            .closest("[data-index]")
                            ?.getAttribute("data-index");
                          const number = at == null ? 0 : Number(at) + 1;
                          if (number > 0 && !chosen.includes(number)) {
                            setChosenPages([number]);
                            goTo(number);
                          }
                        }}
                        renderRow={(index) => (
                          <Thumbnail
                            number={index + 1}
                            source={sourceOf(index + 1)}
                            view={viewOf(index + 1)}
                            marks={marksOf(markup, index + 1)}
                            draw={drawers.get(index + 1)}
                          />
                        )}
                      />
                      {dropLine ? (
                        <div
                          className="mac-preview-app-thumbnails-line"
                          style={{ top: dropLine.top }}
                        />
                      ) : null}
                    </div>
                  </ContextualMenuTrigger>
                  <ContextualMenuPopup>
                    <MenuItem disabled={!pdf || blockedNow} onClick={() => rotate(-1)}>
                      Rotate Left
                    </MenuItem>
                    <MenuItem disabled={!pdf || blockedNow} onClick={() => rotate(1)}>
                      Rotate Right
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem disabled={!pdf || blockedNow} onClick={insertBlankPage}>
                      Insert Blank Page
                    </MenuItem>
                    <MenuItem disabled={!pdf || blockedNow} onClick={() => setSheet("insert")}>
                      Insert Page from File…
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem disabled={!pdf || pageCount < 2 || blockedNow} onClick={deletePages}>
                      Delete
                    </MenuItem>
                  </ContextualMenuPopup>
                </ContextualMenu>
              )}
            </SplitViewPane>
            <SplitViewDivider aria-label="Resize the sidebar" />
            <SplitViewPane minSize={240} className="mac-preview-content">
              <ContextualMenu>
                <ContextualMenuTrigger className="mac-preview-app-page-menu">
                  <ScrollView
                    axis="both"
                    className="mac-preview-canvas mac-preview-app-canvas"
                    style={
                      canvasColor
                        ? ({ "--mac-preview-canvas": canvasColor } as CSSProperties)
                        : undefined
                    }
                    viewportProps={{
                      ref: attachViewport,
                      onScroll: follow,
                      // A drag over a PDF's text, ended, marks it while Highlight is on.
                      onMouseUp: () => {
                        if (highlighting) markSelectedText(textMarkStyle);
                      },
                      role: "document",
                      "aria-label": doc.entry.name,
                      tabIndex: 0,
                    }}
                  >
                    <div
                      className="mac-preview-app-pages"
                      data-kind={doc.kind}
                      data-display={layout}
                    >
                      {layout === "contact"
                        ? Array.from({ length: pageCount }, (_, index) => {
                            const number = index + 1;
                            return (
                              <button
                                key={number}
                                type="button"
                                className="mac-preview-app-contact"
                                aria-label={`Page ${number}`}
                                aria-current={number === page ? "page" : undefined}
                                onClick={() => {
                                  setDisplay(beforeContact.current);
                                  goTo(number);
                                }}
                              >
                                <Thumbnail
                                  number={number}
                                  box={CONTACT_SIDE}
                                  source={sourceOf(number)}
                                  view={viewOf(number)}
                                  marks={marksOf(markup, number)}
                                  draw={drawers.get(number)}
                                />
                              </button>
                            );
                          })
                        : null}
                      {shownPages.map((number) => {
                        const source = sourceOf(number);
                        const pageView = viewOf(number);
                        const shown = viewSize(source.width, source.height, pageView);
                        const width = cssWidthOf(number);
                        const height = (width * shown.height) / shown.width;
                        const editing = typing?.page === number && typingSource;
                        const at = editing ? toView(typing.point, pageView) : null;
                        const here = marksOf(markup, number);
                        return (
                          <PreviewPage
                            key={number}
                            number={number}
                            width={width}
                            height={height}
                            source={source}
                            view={pageView}
                            marks={
                              gesture?.kind === "resize" && gesture.page === number && draft
                                ? here.filter((mark) => mark.id !== gesture.mark.id)
                                : gesture?.kind === "move" && gesture.page === number && dragOffset
                                  ? here.map((mark) =>
                                      gesture.marks.some((each) => each.id === mark.id)
                                        ? moved(mark, dragOffset[0], dragOffset[1])
                                        : mark,
                                    )
                                  : here.flatMap((mark) => {
                                      if (mark.id !== typing?.replaces?.id) return [mark];
                                      if (!mark.bubble) return [];
                                      const { text: _said, ...shape } = mark;
                                      return [shape];
                                    })
                            }
                            draft={
                              draft &&
                              gesture?.kind !== "crop" &&
                              gesture &&
                              "page" in gesture &&
                              gesture.page === number
                                ? draft
                                : null
                            }
                            selection={doc.kind === "image" ? cropRect : null}
                            selectionOutline={shownOutline}
                            links={linkReaders.get(number)}
                            onFollowLink={followLink}
                            fields={fieldReaders.get(number)}
                            onFieldChange={fillField}
                            selected={chosenMarks}
                            drawPage={
                              drawers.get(number) as NonNullable<ReturnType<typeof drawPage>>
                            }
                            layOutText={textLayouts.get(number)}
                            found={searching ? query : undefined}
                            drawKey={`${doc.entry.id}|${markup.order?.[number - 1] ?? number}|${pageView.turns}|${view.mirrored === true}|${view.crop.x},${view.crop.y},${view.crop.w},${view.crop.h}|${imageDrawn}`}
                            interactive={interactive}
                            cursor={
                              tool === "select" ? "default" : tool === "text" ? "text" : "crosshair"
                            }
                            onPagePointerDown={onPagePointerDown}
                            onPagePointerMove={onPagePointerMove}
                            onPagePointerUp={onPagePointerUp}
                            onPageDoubleClick={onPageDoubleClick}
                            onDrawError={onDrawError}
                          >
                            {editing && at ? (
                              <div
                                className="mac-preview-app-typing"
                                style={
                                  {
                                    left: `${at[0] * 100}%`,
                                    top: `${at[1] * 100}%`,
                                    "--mac-preview-app-typing-size": `${
                                      (typing.replaces?.size ?? textSize) *
                                      typingSource.width *
                                      (width / shown.width)
                                    }px`,
                                    "--mac-preview-app-typing-color":
                                      typing.replaces?.color ?? color,
                                    "--mac-preview-app-typing-align":
                                      (typing.replaces ? typing.replaces.align : textAlign) ??
                                      "left",
                                    "--mac-preview-app-typing-font": typingFont(
                                      typing.replaces ? typing.replaces.font : textFont,
                                    ),
                                    "--mac-preview-app-typing-weight": (
                                      typing.replaces
                                        ? typing.replaces.bold
                                        : textBold
                                    )
                                      ? "bold"
                                      : "normal",
                                    "--mac-preview-app-typing-style": (
                                      typing.replaces
                                        ? typing.replaces.italic
                                        : textItalic
                                    )
                                      ? "italic"
                                      : "normal",
                                    "--mac-preview-app-typing-decoration": (
                                      typing.replaces
                                        ? typing.replaces.underline
                                        : textUnderline
                                    )
                                      ? "underline"
                                      : "none",
                                  } as CSSProperties
                                }
                              >
                                <TextView
                                  aria-label="Text"
                                  autoFocus
                                  rows={typing.value.split("\n").length}
                                  spellCheck={fieldTyping.spellCheck}
                                  onInput={fieldTyping.onInput}
                                  value={typing.value}
                                  // A text mark keeps at most this many characters: the box takes
                                  // no more, so what is kept is exactly what is shown.
                                  maxLength={MARKUP_LIMITS.text}
                                  // Read only while a save or another operation runs: it saves
                                  // the text as it was when it started.
                                  readOnly={busy !== null}
                                  onValueChange={(value) => {
                                    if (blocked()) return;
                                    // The box is full (the input's own limit cuts a longer paste
                                    // before it arrives): say so, so nothing goes missing unseen.
                                    if (value.length >= MARKUP_LIMITS.text) {
                                      setNotice(
                                        `A text keeps at most ${MARKUP_LIMITS.text.toLocaleString("en")} characters; anything past that is not added.`,
                                      );
                                    }
                                    setTyping({
                                      ...typing,
                                      value: value.slice(0, MARKUP_LIMITS.text),
                                    });
                                  }}
                                  onKeyDown={(event) => {
                                    // Return ends the text, and Shift-Return starts another line.
                                    if (event.key === "Enter" && !event.shiftKey) {
                                      event.preventDefault();
                                      commitTyping(true);
                                    } else if (event.key === "Escape") {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      commitTyping(false);
                                    }
                                  }}
                                  onBlur={() => commitTyping(true)}
                                />
                              </div>
                            ) : null}
                            {interactive
                              ? null
                              : marksOf(markup, number)
                                  .filter(
                                    (mark) =>
                                      mark.kind === "note" && mark.id !== noting?.replaces?.id,
                                  )
                                  .map((note) => {
                                    const a = toView([note.x, note.y], pageView);
                                    const b = toView([note.x + note.w, note.y + note.h], pageView);
                                    return (
                                      <button
                                        key={note.id}
                                        type="button"
                                        className="mac-preview-app-note-spot"
                                        aria-label={`Note: ${note.text}`}
                                        title={note.text}
                                        style={{
                                          left: `${Math.min(a[0], b[0]) * 100}%`,
                                          top: `${Math.min(a[1], b[1]) * 100}%`,
                                          width: `${Math.abs(a[0] - b[0]) * 100}%`,
                                          height: `${Math.abs(a[1] - b[1]) * 100}%`,
                                        }}
                                        onClick={() => openNote(number, note)}
                                      />
                                    );
                                  })}
                            {noting?.page === number ? (
                              <NoteEditor
                                at={toView(noting.center, pageView)}
                                value={noting.value}
                                readOnly={busy !== null}
                                spellCheck={fieldTyping.spellCheck}
                                onInput={fieldTyping.onInput}
                                onChange={(value) => setNoting({ ...noting, value })}
                                onEnd={commitNote}
                              />
                            ) : null}
                          </PreviewPage>
                        );
                      })}
                    </div>
                  </ScrollView>
                </ContextualMenuTrigger>
                <ContextualMenuPopup>
                  <MenuItem onClick={() => zoomBy(ZOOM_STEP)}>Zoom In</MenuItem>
                  <MenuItem onClick={() => zoomBy(1 / ZOOM_STEP)}>Zoom Out</MenuItem>
                  <MenuItem onClick={actualSize}>Actual Size</MenuItem>
                  <MenuItem onClick={() => setZoom(1)}>Zoom to Fit</MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    disabled={!selectedMark && !selectedText && doc.kind !== "image"}
                    onClick={copyMark}
                  >
                    Copy
                  </MenuItem>
                  {pdf ? (
                    <>
                      <MenuSeparator />
                      <MenuItem onClick={() => annotateText(highlightStyle)}>
                        Highlight Text
                      </MenuItem>
                      <MenuItem onClick={() => annotateText(UNDERLINE)}>Underline Text</MenuItem>
                      <MenuItem onClick={() => annotateText(STRIKETHROUGH)}>
                        Strikethrough Text
                      </MenuItem>
                      <MenuItem onClick={startNote}>Add Note</MenuItem>
                    </>
                  ) : null}
                </ContextualMenuPopup>
              </ContextualMenu>
              {magnifier ? <PreviewMagnifier viewport={viewportElement} /> : null}
            </SplitViewPane>
          </SplitView>
        ) : (
          <div className="mac-preview-app-empty">
            <EmptyState role="status">{busy ? busy.label : "No Document Open"}</EmptyState>
            {busy ? null : <PushButton onClick={() => setSheet("open")}>Open…</PushButton>}
          </div>
        )}
        {inspector && doc ? (
          <div className="mac-preview-app-inspector">
            <PreviewInspector
              entry={doc.entry}
              kind={doc.kind}
              {...(doc.kind === "image"
                ? { dimensions: { width: doc.width, height: doc.height } }
                : {
                    pages: {
                      count: pageCount,
                      width: sourceOf(page).width,
                      height: sourceOf(page).height,
                    },
                  })}
              exif={exif}
              keywords={markup.keywords ?? NO_KEYWORDS}
              onKeywords={(keywords) => {
                const { keywords: _old, ...rest } = markup;
                changeMarkup(keywords.length > 0 ? { ...rest, keywords: [...keywords] } : rest);
              }}
              {...(doc.kind === "pdf" ? { security: doc.pdf.security } : {})}
              marks={markup.pages
                .filter((entry) => entry.page <= pageCount)
                .flatMap((entry) => entry.items.map((mark) => ({ page: entry.page, mark })))}
              selected={selected}
              onChooseMark={(number, mark) => {
                goTo(number);
                setSelected(mark.id);
              }}
              selection={cropRect}
              kept={edits.crop}
              dpi={edits.dpi ?? SCREEN_DPI}
              onSelect={(rect) => {
                const kept = intersect(rect, edits.crop);
                if (!kept) return;
                setCropOutline(null);
                setCropRect(kept);
              }}
              onClose={() => setInspector(false)}
            />
          </div>
        ) : null}
        {fontsShown ? (
          <DesktopFontPanel
            role="dialog"
            className="mac-preview-app-fonts"
            families={FONT_FAMILIES}
            value={{
              ...(shownTextFont === "system" ? {} : { family: shownTextFont }),
              bold: textStyleOf("bold"),
              italic: textStyleOf("italic"),
              underline: textStyleOf("underline"),
            }}
            onFontChange={(change) => {
              if (change.family) chooseFont(change.family);
              if (change.bold !== undefined) chooseTextStyle("bold", change.bold);
              if (change.italic !== undefined) chooseTextStyle("italic", change.italic);
              if (change.underline !== undefined) chooseTextStyle("underline", change.underline);
            }}
            onClose={() => setFontsShown(false)}
          />
        ) : null}
        {adjusting && doc?.kind === "image" ? (
          <AdjustColorPanel
            value={edits.color}
            levels={levels}
            onChange={changeColor}
            onAuto={() => {
              if (pictureSample) changeColor({ ...edits.color, ...autoLevels(pictureSample) });
            }}
            onClose={() => setAdjusting(false)}
          />
        ) : null}
      </WindowBody>
      {status || (busy && doc) ? (
        <div className="mac-preview-app-status" role="status">
          <Label color="secondary">{status}</Label>
          {busy ? <ProgressBar aria-label={busy.label} max={1} value={busy.fraction} /> : null}
        </div>
      ) : null}

      <Sheet open={sheet === "open"} onOpenChange={(next) => next || setSheet(null)}>
        <SheetPopup anchor={titleBar} width={680} aria-label="Choose a document">
          <DriveOpenPanel
            accept={(file) => opensInPreview(file)}
            defaultFolder="pictures"
            multiple
            onOpen={(files) => {
              const first = files[0];
              if (!first) return;
              if (self) {
                routeSeveral(files);
                return;
              }
              const together = files.length > 1 && files.every((each) => !isPdf(each));
              setGallery(together ? files : NO_FILES);
              requestOpen(first);
              if (files.length > 1 && !together)
                setNotice(`Preview opened “${first.name}”: a PDF has a window to itself.`);
            }}
            onCancel={() => setSheet(null)}
            width={660}
            height={400}
          />
        </SheetPopup>
      </Sheet>
      <Sheet open={sheet === "insert"} onOpenChange={(next) => next || setSheet(null)}>
        <SheetPopup anchor={titleBar} width={680} aria-label="Choose a file to insert">
          <DriveOpenPanel
            accept={(file) => opensInPreview(file)}
            defaultFolder="documents"
            onOpen={(file) => void insertPagesOf(file, Math.max(...chosen))}
            onCancel={() => setSheet(null)}
            width={660}
            height={400}
          />
        </SheetPopup>
      </Sheet>
      <Sheet open={sheet === "export"} onOpenChange={(next) => next || setSheet(null)}>
        <SheetPopup anchor={titleBar} width={640} aria-label="Export the document">
          {doc ? (
            <DriveSavePanel
              key={exportFormat}
              defaultName={nameFor(doc.entry.name, exportFormat)}
              defaultFolder={doc.entry.parent ?? "documents"}
              accessory={
                <div className="mac-preview-app-format">
                  <Label>Format:</Label>
                  <PopUpButton
                    aria-label="Format"
                    value={exportFormat}
                    onValueChange={(value) => value && setExportFormat(value as ExportFormat)}
                  >
                    {EXPORT_FORMATS.map((format) => (
                      <PopUpButtonItem key={format.value} value={format.value}>
                        {format.label}
                      </PopUpButtonItem>
                    ))}
                    {UNWRITABLE_FORMATS.map((label) => (
                      <PopUpButtonItem key={label} value={label} disabled title={UNWRITABLE_REASON}>
                        {label}
                      </PopUpButtonItem>
                    ))}
                  </PopUpButton>
                  {exportFormat === "jpeg" ? (
                    <>
                      <Label>Quality:</Label>
                      <Slider
                        aria-label="Quality"
                        min={0.1}
                        max={1}
                        step={0.01}
                        value={exportQuality}
                        onValueChange={(value) => setExportQuality(value as number)}
                      />
                    </>
                  ) : null}
                  {doc.kind === "pdf" ? (
                    <>
                      <Label>Resolution:</Label>
                      <PopUpButton
                        aria-label="Resolution"
                        value={String(exportDpi)}
                        onValueChange={(value) => value && setExportDpi(Number(value))}
                      >
                        {EXPORT_RESOLUTIONS.map((dpi) => (
                          <PopUpButtonItem key={dpi} value={String(dpi)}>
                            {dpi} pixels/inch
                          </PopUpButtonItem>
                        ))}
                      </PopUpButton>
                    </>
                  ) : null}
                  {exportFormat === "pdf" ? (
                    <Checkbox disabled title={NO_LOCKING}>
                      Encrypt
                    </Checkbox>
                  ) : null}
                </div>
              }
              onSave={(target) => void exportTo(target)}
              onCancel={() => setSheet(null)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Sheet open={sheet === "resize"} onOpenChange={(next) => next || setSheet(null)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Adjust Size">
          {doc?.kind === "image" ? (
            <AdjustSizeSheet
              size={viewSize(doc.width, doc.height, view)}
              current={{
                scale: edits.scale,
                stretch: edits.stretch,
                dpi: edits.dpi ?? SCREEN_DPI,
              }}
              bytes={doc.entry.size}
              onCancel={() => setSheet(null)}
              onResize={({ scale, stretch, dpi }) => {
                setSheet(null);
                changeEdits({
                  ...edits,
                  scale,
                  stretch,
                  dpi: edits.dpi === null && dpi === SCREEN_DPI ? null : dpi,
                });
              }}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Sheet open={sheet === "page"} onOpenChange={(next) => next || setSheet(null)}>
        <SheetPopup anchor={titleBar} width={300} aria-label="Go to Page">
          <GoToPageSheet
            count={pageCount}
            current={page}
            onCancel={() => setSheet(null)}
            onGo={(number) => {
              setSheet(null);
              goTo(number);
            }}
          />
        </SheetPopup>
      </Sheet>
      <Sheet open={sheet === "signature"} onOpenChange={(next) => next || setSheet(null)}>
        <SheetPopup anchor={titleBar} width={460} aria-label="Create Signature">
          <SignatureSheet onCancel={() => setSheet(null)} onDone={keepSignature} />
        </SheetPopup>
      </Sheet>
      <Sheet open={sheet === "rename"} onOpenChange={(next) => next || setSheet(null)}>
        <SheetPopup anchor={titleBar} width={360} aria-label="Rename">
          {doc ? (
            <RenameSheet
              name={doc.entry.name}
              onCancel={() => setSheet(null)}
              onDone={(name) =>
                void changeFile(
                  (file) => drive.rename(file, name),
                  (file) => `Renamed to “${file.name}”.`,
                )
              }
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Sheet open={sheet === "move"} onOpenChange={(next) => next || setSheet(null)}>
        <SheetPopup anchor={titleBar} width={420} aria-label="Move To">
          {doc ? (
            <MoveSheet
              name={doc.entry.name}
              folder={doc.entry.parent ?? ""}
              list={drive.folders}
              onCancel={() => setSheet(null)}
              onDone={(folder) =>
                void changeFile(
                  (file) => drive.move(file, folder),
                  (file) => `Moved “${file.name}”.`,
                )
              }
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Sheet open={sheet === "password"} onOpenChange={(next) => next || setSheet(null)}>
        <SheetPopup anchor={titleBar} width={360} aria-label="Enter Password">
          {locked ? (
            <PasswordSheet
              name={locked.file.name}
              wrong={locked.wrong}
              onCancel={() => setSheet(null)}
              onDone={(password) => void open(locked.file, locked.place, password)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <PreviewCustomizeToolbar
        open={customizing}
        anchor={titleBar}
        hidden={hiddenTools}
        onChange={setHiddenTools}
        onDone={() => setCustomizing(false)}
      />
      {textTools.panels}
      {slideshow && doc ? (
        <PreviewSlideshow
          count={pageCount}
          page={page}
          onPageChange={setPage}
          onEnd={() => {
            setSlideshow(false);
            showPage(page);
          }}
          renderPage={(number, room) => {
            const source = sourceOf(number);
            const pageView = viewOf(number);
            const shown = viewSize(source.width, source.height, pageView);
            const scale = Math.min(room.width / shown.width, room.height / shown.height);
            return (
              <PreviewPage
                key={number}
                number={number}
                width={shown.width * scale}
                height={shown.height * scale}
                source={source}
                view={pageView}
                marks={marksOf(markup, number)}
                drawPage={drawers.get(number) as NonNullable<ReturnType<typeof drawPage>>}
                drawKey={`slideshow|${doc.entry.id}|${markup.order?.[number - 1] ?? number}|${pageView.turns}|${view.mirrored === true}|${view.crop.x},${view.crop.y},${view.crop.w},${view.crop.h}`}
                interactive={false}
                onDrawError={onDrawError}
              />
            );
          }}
        />
      ) : null}
      <Alert open={leaving !== null} onOpenChange={(next) => next || setLeaving(null)}>
        <AlertPopup>
          <AlertMessage>
            Do you want to save the changes made to the document “{doc?.entry.name}”?
          </AlertMessage>
          <AlertInformativeText>
            Your changes will be lost if you don’t save them.
          </AlertInformativeText>
          <AlertButtons>
            <PushButton
              onClick={() => {
                // The edits stay until the next document has opened (or the window closes).
                const next = leaving?.proceed;
                setLeaving(null);
                next?.();
              }}
            >
              Don’t Save
            </PushButton>
            <AlertClose render={<PushButton />}>Cancel</AlertClose>
            {doc?.kind === "image" || formFilled ? (
              <DefaultButton
                onClick={() => {
                  const next = leaving?.proceed;
                  setLeaving(null);
                  void save().then((saved) => saved && next?.());
                }}
              >
                Save
              </DefaultButton>
            ) : null}
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={failure !== null} onOpenChange={(next) => next || setFailure(null)}>
        <AlertPopup>
          <AlertMessage>The operation can’t be completed.</AlertMessage>
          <AlertInformativeText>{failure}</AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<DefaultButton />}>OK</AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </Window>
  );
}

/** A note being written, beside its icon: Escape puts it back, leaving it keeps it. */
function NoteEditor({
  at,
  value,
  readOnly,
  spellCheck,
  onInput,
  onChange,
  onEnd,
}: {
  /** Where its icon is centred, as fractions of the page shown. */
  at: Point;
  value: string;
  readOnly: boolean;
  spellCheck: boolean;
  onInput: (event: FormEvent<HTMLTextAreaElement>) => void;
  onChange: (value: string) => void;
  onEnd: (keep: boolean) => void;
}) {
  return (
    <div
      className="mac-preview-app-note-editor"
      style={{
        left: `${at[0] * 100}%`,
        top: `${at[1] * 100}%`,
        translate: `${at[0] > 0.6 ? "-100%" : "0"} ${at[1] > 0.6 ? "-100%" : "0"}`,
      }}
    >
      <TextView
        aria-label="Note"
        autoFocus
        maxLength={MARKUP_LIMITS.text}
        readOnly={readOnly}
        spellCheck={spellCheck}
        onInput={onInput}
        value={value}
        onValueChange={onChange}
        onBlur={() => onEnd(true)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          onEnd(false);
        }}
      />
    </div>
  );
}

/** A page's thumbnail in the sidebar, drawn small when its row is shown, with its markup. */
function Thumbnail({
  number,
  box = 96,
  source,
  view,
  marks,
  draw,
}: {
  number: number;
  /** The longer side it is drawn at. */
  box?: number;
  source: { width: number; height: number };
  view: View;
  marks: readonly Mark[];
  draw:
    | ((canvas: HTMLCanvasElement, width: number, ratio: number) => Promise<unknown> | undefined)
    | undefined;
}) {
  const page = useRef<HTMLCanvasElement>(null);
  const tint = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const [pageDrawn, setPageDrawn] = useState(0);
  const shown = viewSize(source.width, source.height, view);
  const width = shown.width >= shown.height ? box : (box * shown.width) / shown.height;
  const height = (width * shown.height) / shown.width;
  useEffect(() => {
    const canvas = page.current;
    if (!canvas || !draw) return;
    void Promise.resolve(draw(canvas, width, 2))
      .then(() => setPageDrawn((times) => times + 1))
      .catch(() => {});
  }, [draw, width]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `pageDrawn` is a new page for a loupe to magnify.
  useEffect(() => {
    const paint = (canvas: HTMLCanvasElement | null, items: readonly Mark[]) => {
      if (!canvas) return;
      canvas.width = Math.round(width * 2);
      canvas.height = Math.round(height * 2);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      applyView(context, source.width, source.height, view, canvas);
      drawMarks(context, items, source.width, source.height, null, page.current);
      context.restore();
    };
    paint(
      tint.current,
      marks.filter((mark) => mark.kind === "highlight"),
    );
    paint(
      over.current,
      marks.filter((mark) => mark.kind !== "highlight"),
    );
  }, [marks, width, height, source.width, source.height, view, pageDrawn]);
  return (
    <span className="mac-preview-app-thumbnail">
      <span className="mac-preview-app-thumbnail-page" style={{ width, height }}>
        <canvas ref={page} />
        <canvas ref={tint} data-tint="" />
        <canvas ref={over} />
      </span>
      <span className="mac-preview-app-thumbnail-label">{number}</span>
    </span>
  );
}

/** Go to Page: the number of a page of the PDF. */
function GoToPageSheet({
  count,
  current,
  onGo,
  onCancel,
}: {
  count: number;
  current: number;
  onGo: (page: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(String(current));
  const number = Number(value);
  const valid = Number.isInteger(number) && number >= 1 && number <= count;
  return (
    <div className="mac-preview-app-sheet">
      <SheetTitle>Go to Page</SheetTitle>
      <div className="mac-preview-app-fields">
        <Label>Page:</Label>
        <TextField
          aria-label="Page"
          autoFocus
          inputMode="numeric"
          value={value}
          onValueChange={setValue}
          onKeyDown={(event) => {
            if (event.key === "Enter" && valid) onGo(number);
          }}
        />
        <Label color="secondary">of {count}</Label>
      </div>
      <div className="mac-preview-app-sheet-buttons">
        <PushButton keyEquivalent="escape" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton disabled={!valid} onClick={() => onGo(number)}>
          OK
        </DefaultButton>
      </div>
    </div>
  );
}

/** Create Signature: a pad to sign on with the pointer (a trackpad, a mouse or a finger), or the camera. */
function SignatureSheet({
  onDone,
  onCancel,
}: {
  onDone: (signature: Signature) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState<"trackpad" | "camera">("trackpad");
  const [fromCamera, setFromCamera] = useState<Signature | null>(null);
  const pad = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const drawing = useRef(false);
  // A signature keeps at most this many strokes: the pad takes no more, and says so.
  const full = strokes.length >= MARKUP_LIMITS.strokes;
  // biome-ignore lint/correctness/useExhaustiveDependencies: choosing Trackpad again makes a new canvas to draw on
  useEffect(() => {
    const canvas = pad.current;
    if (!canvas) return;
    const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * ratio) || 400;
    canvas.height = Math.round(canvas.clientHeight * ratio) || 150;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#000000";
    for (const stroke of strokes) {
      context.beginPath();
      stroke.forEach(([x, y], index) => {
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      if (stroke.length === 1) context.lineTo((stroke[0]?.[0] ?? 0) + 0.1, stroke[0]?.[1] ?? 0);
      context.stroke();
    }
  }, [strokes, source]);
  const at = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const box = event.currentTarget.getBoundingClientRect();
    return [event.clientX - box.left, event.clientY - box.top];
  };
  const onPad = source === "trackpad";
  const signature = onPad ? signatureFromStrokes(strokes) : fromCamera;
  return (
    <div className="mac-preview-app-sheet">
      <SegmentedControl
        aria-label="Signature source"
        size="small"
        distribution="fit"
        value={[source]}
        onValueChange={(value) => {
          const next = value[0];
          if (next !== "trackpad" && next !== "camera") return;
          setFromCamera(null);
          setSource(next);
        }}
      >
        <Segment value="trackpad">Trackpad</Segment>
        <Segment value="camera">Camera</Segment>
      </SegmentedControl>
      {onPad ? (
        <SheetTitle>Sign your name on the pad.</SheetTitle>
      ) : (
        <SheetTitle>
          Sign your name on white paper and hold it up to the camera, on the blue line.
        </SheetTitle>
      )}
      {onPad ? (
        <canvas
          ref={pad}
          className="mac-preview-app-pad"
          aria-label="Signature pad"
          role="img"
          onPointerDown={(event) => {
            if (event.button !== 0 || full) return;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            drawing.current = true;
            const point = at(event);
            setStrokes((list) => [...list, [point]]);
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            const point = at(event);
            setStrokes((list) => {
              const last = list.at(-1);
              return last ? [...list.slice(0, -1), [...last, point]] : list;
            });
          }}
          onPointerUp={(event) => {
            drawing.current = false;
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          // A touch or pen the system takes back ends the stroke as a release does.
          onPointerCancel={() => {
            drawing.current = false;
          }}
          onLostPointerCapture={() => {
            drawing.current = false;
          }}
        />
      ) : (
        <SignatureCamera onRead={setFromCamera} />
      )}
      {onPad && full ? (
        <Label color="secondary">
          A signature holds at most {MARKUP_LIMITS.strokes} strokes; Clear to start again.
        </Label>
      ) : null}
      <div className="mac-preview-app-sheet-buttons">
        {onPad ? (
          <PushButton disabled={strokes.length === 0} onClick={() => setStrokes([])}>
            Clear
          </PushButton>
        ) : null}
        <span className="mac-preview-app-gap" />
        <PushButton keyEquivalent="escape" onClick={onCancel}>
          Cancel
        </PushButton>
        <DefaultButton disabled={!signature} onClick={() => signature && onDone(signature)}>
          Done
        </DefaultButton>
      </div>
    </div>
  );
}
