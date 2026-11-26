"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PullDownButton } from "macalicious/pull-down-button";
import { SystemImage } from "macalicious/system-image";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { readFile } from "../desktop/desktop-files";
import { useServerState } from "../desktop/desktop-server";
import type { PdfFile, PdfOutlineEntry } from "../preview/preview-pdf";
import { BooksGlyph } from "./books-artwork";
import {
  type BooksReading,
  mergeReadings,
  NO_READING,
  type OwnedBook,
  readingFromServer,
  readingReadable,
  readingToServer,
  readingUrl,
} from "./books-server";

const READER_BAR: CSSProperties = { gridTemplateRows: "minmax(37px, auto)" };
const BAR_ITEM = { "--mac-image-button-padding": "5.25px" } as CSSProperties;
const TURN: CSSProperties = { padding: 16 };

export interface BooksPdfReaderProps extends Omit<WindowProps, "children"> {
  /** The PDF of the person's library the window shows; its title is the window's. */
  book: OwnedBook;
  /** Called by the Library button of the bar. */
  onLibrary?: () => void;
  /** Called with how far the person has read, 1 to 100, as it changes. */
  onReadPercent?: (percent: number) => void;
  /**
   * Opens the file's bytes as a PDF.
   * @default pdf.js, loaded when the first PDF is opened
   */
  openPdfFile?: (blob: Blob) => Promise<PdfFile>;
  /** What else is drawn in the window: a window that moves on its own has its edges here. */
  overlay?: ReactNode;
  onClose?: WindowControlsProps["onClose"];
  onMinimize?: WindowControlsProps["onMinimize"];
  onZoom?: WindowControlsProps["onZoom"];
  zoomRole?: WindowControlsProps["zoomRole"];
  minimizeDisabled?: boolean;
  zoomDisabled?: boolean;
  controlsProps?: WindowControlsProps;
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

const openWithPdfJs = async (blob: Blob) => (await import("../preview/preview-pdf")).openPdf(blob);

type Opened =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; pdf: PdfFile; outline: PdfOutlineEntry[] };

/**
 * The book window of a PDF of the person's library: its pages as the file draws them, its table of
 * contents and bookmarks, and the place kept with the person's other readings, as the page's index.
 */
export function BooksPdfReader({
  book,
  onLibrary,
  onReadPercent,
  openPdfFile = openWithPdfJs,
  overlay,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 786,
  height = 785,
  className,
  inert,
  "aria-busy": busy,
  ...props
}: BooksPdfReaderProps) {
  const [reading, setReading] = useState<BooksReading>(NO_READING);
  const loading = useServerState({
    url: readingUrl(book.id),
    enabled: true,
    value: reading,
    onLoad: (stored) => {
      if (!readingReadable(stored)) return false;
      setReading(readingFromServer(stored) ?? NO_READING);
    },
    toBody: readingToServer,
    merge: mergeReadings,
  });
  const [opened, setOpened] = useState<Opened>({ status: "loading" });
  const opener = useRef(openPdfFile);
  useEffect(() => {
    let live = true;
    let pdf: PdfFile | undefined;
    setOpened({ status: "loading" });
    (async () => {
      if (!book.file) throw new Error("this book names no file on your drive");
      pdf = await opener.current(await readFile(book.file));
      const outline = await pdf.outline();
      if (live) setOpened({ status: "ready", pdf, outline });
    })().catch((error: unknown) => {
      if (live) {
        setOpened({
          status: "failed",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
    return () => {
      live = false;
      pdf?.destroy();
    };
  }, [book.file]);
  const pdf = opened.status === "ready" ? opened.pdf : null;
  const count = pdf?.pageCount ?? 1;
  const page = Math.min(count, reading.place + 1);
  const goTo = (next: number) => {
    if (loading || next < 1 || next > count || next === page) return;
    setReading((now) => ({ ...now, place: next - 1 }));
  };
  const marked = reading.bookmarks.some((mark) => mark.at === page - 1);
  const toggleBookmark = () =>
    setReading((now) => ({
      ...now,
      bookmarks: marked
        ? now.bookmarks.filter((mark) => mark.at !== page - 1)
        : [...now.bookmarks, { at: page - 1, label: `Page ${page}` }].sort((a, b) => a.at - b.at),
    }));

  const percent = Math.max(1, Math.round((page / count) * 100));
  useEffect(() => {
    if (pdf && !loading) onReadPercent?.(percent);
  }, [pdf, loading, percent, onReadPercent]);

  // The page, as large as the window holds it, drawn again when the window changes size.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [room, setRoom] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      setRoom({ width: box.clientWidth, height: box.clientHeight }),
    );
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!pdf || !element || room.width === 0 || room.height === 0) return;
    let live = true;
    void pdf.size(page).then((size) => {
      if (!live) return;
      const fit = Math.min(room.width, (room.height * size.width) / size.height);
      return pdf.render(page, element, fit, 0, window.devicePixelRatio || 1);
    });
    return () => {
      live = false;
    };
  }, [pdf, page, room]);

  const commands = useRef({ goTo, toggleBookmark, onLibrary, page });
  commands.current = { goTo, toggleBookmark, onLibrary, page };
  const controlsMenu = useMemo(
    () => (
      <>
        <MenuItem onClick={() => commands.current.goTo(commands.current.page - 1)}>
          Previous Page
        </MenuItem>
        <MenuItem onClick={() => commands.current.goTo(commands.current.page + 1)}>
          Next Page
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+d" onClick={() => commands.current.toggleBookmark()}>
          {marked ? "Remove Bookmark" : "Add Bookmark"}
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="shift+command+l" onClick={() => commands.current.onLibrary?.()}>
          Show Library
        </MenuItem>
      </>
    ),
    [marked],
  );
  useDesktopAppMenu("books", "Controls", controlsMenu);

  const frame = useRef<HTMLDivElement>(null);
  const keys = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  keys.current = (event) => {
    const here = frame.current;
    if (
      event.defaultPrevented ||
      !here ||
      here.closest('[data-window-state]:not([data-window-state="key"])') ||
      (event.target instanceof Element && event.target.closest("input, textarea"))
    ) {
      return;
    }
    if (matchesMenuKeyEquivalent(event, "command+d")) {
      event.preventDefault();
      toggleBookmark();
      return;
    }
    if (matchesMenuKeyEquivalent(event, "shift+command+l")) {
      event.preventDefault();
      onLibrary?.();
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") goTo(page + 1);
    else if (event.key === "ArrowLeft" || event.key === "PageUp") goTo(page - 1);
    else return;
    event.preventDefault();
  };
  useEffect(() => {
    const listen = (event: globalThis.KeyboardEvent) => keys.current(event);
    document.addEventListener("keydown", listen);
    return () => document.removeEventListener("keydown", listen);
  }, []);

  const statusId = useId();
  const usable = pdf !== null;
  return (
    <Window
      width={width}
      height={height}
      className={
        className
          ? `mac-books-reader mac-books-pdf-reader ${className}`
          : "mac-books-reader mac-books-pdf-reader"
      }
      {...props}
      aria-busy={busy || loading || undefined}
      inert={inert || loading || undefined}
    >
      <TitleBar
        variant="title-hidden"
        title={book.title}
        style={READER_BAR}
        controls={
          <WindowControls
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
            zoomRole={zoomRole}
            {...controlsProps}
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset */}
        <div ref={frame} className="mac-books-reader-bar" role="group" aria-label="Book controls">
          <ImageButton aria-label="Library" style={BAR_ITEM} onClick={onLibrary}>
            <BooksGlyph name="library" />
          </ImageButton>
          <Menu>
            <MenuTrigger
              disabled={!usable}
              render={<ImageButton aria-label="Table of Contents" style={BAR_ITEM} />}
            >
              <BooksGlyph name="contents" />
            </MenuTrigger>
            <MenuPopup>
              <MenuItem onClick={() => goTo(1)}>Beginning</MenuItem>
              {opened.status === "ready" && opened.outline.length > 0 ? <MenuSeparator /> : null}
              {opened.status === "ready"
                ? opened.outline.map((entry) => (
                    <MenuItem key={`${entry.page}:${entry.title}`} onClick={() => goTo(entry.page)}>
                      {entry.title}
                    </MenuItem>
                  ))
                : null}
            </MenuPopup>
          </Menu>
          <span className="mac-books-reader-bar-space" />
          <PullDownButton
            bordered={false}
            aria-label="Bookmarks"
            disabled={!usable}
            data-marked={marked ? "" : undefined}
            className="mac-books-bookmarks"
            image={<BooksGlyph name="bookmark" />}
          >
            <MenuItem onClick={toggleBookmark}>
              {marked ? "Remove Bookmark" : "Add Bookmark"}
            </MenuItem>
            {reading.bookmarks.length > 0 ? <MenuSeparator /> : null}
            {reading.bookmarks.map((mark) => (
              <MenuItem key={mark.at} onClick={() => goTo(mark.at + 1)}>
                {mark.label}
              </MenuItem>
            ))}
          </PullDownButton>
        </div>
      </TitleBar>
      <WindowBody className="mac-books-reader-body mac-books-pdf-body">
        {opened.status === "failed" ? (
          <div className="mac-books-text-status">
            <EmptyState role="status">Books could not open this PDF: {opened.message}</EmptyState>
          </div>
        ) : (
          <>
            <div ref={setBox} className="mac-books-pdf-page">
              <canvas
                ref={canvas}
                role="img"
                aria-label={usable ? `Page ${page} of ${count}` : "Loading"}
              />
              {usable ? null : (
                <div className="mac-books-text-loading">
                  <ProgressSpinner size="small" aria-labelledby={statusId} />
                  <span id={statusId}>Loading the PDF…</span>
                </div>
              )}
            </div>
            <p className="mac-books-pdf-footer">{usable ? `Page ${page} of ${count}` : ""}</p>
          </>
        )}
        {usable ? (
          <>
            <span className="mac-books-turn" data-direction="previous">
              <BorderlessButton
                aria-label="Previous Page"
                focusableWhenDisabled
                disabled={page <= 1}
                style={TURN}
                onClick={() => goTo(page - 1)}
              >
                <SystemImage name="go-back" />
              </BorderlessButton>
            </span>
            <span className="mac-books-turn" data-direction="next">
              <BorderlessButton
                aria-label="Next Page"
                focusableWhenDisabled
                disabled={page >= count}
                style={TURN}
                onClick={() => goTo(page + 1)}
              >
                <SystemImage name="go-forward" />
              </BorderlessButton>
            </span>
          </>
        ) : null}
      </WindowBody>
      {overlay}
    </Window>
  );
}
