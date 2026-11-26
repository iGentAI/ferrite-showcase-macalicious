"use client";

import { BookCover } from "macalicious/book-cover";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { ListView } from "macalicious/list-view";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PushButton } from "macalicious/push-button";
import { Slider } from "macalicious/slider";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { useServerState } from "../desktop/desktop-server";
import { BooksGlyph, RealCoverArtwork } from "./books-artwork";
import {
  type Audiobook,
  type BooksReading,
  chapterAt,
  fetchAudiobook,
  mergeReadings,
  NO_READING,
  type OwnedBook,
  readingFromServer,
  readingReadable,
  readingToServer,
  readingUrl,
  secondsBefore,
} from "./books-server";

const READER_BAR: CSSProperties = { gridTemplateRows: "minmax(37px, auto)" };
const BAR_ITEM = { "--mac-image-button-padding": "5.25px" } as CSSProperties;
const COVER = { "--mac-book-cover-width": "180px" } as CSSProperties;
/** How often the place is kept while the sound plays. */
const KEEP_PLACE_MS = 10_000;
/** How far the two buttons beside Play go, in seconds. */
const SKIP_BACK = 15;
const SKIP_FORWARD = 30;
/** Seconds into a chapter past which Previous Chapter goes to its start, not the chapter before. */
const START_OF_CHAPTER = 3;

export interface BooksAudiobookPlayerProps extends Omit<WindowProps, "children"> {
  /** The audiobook of the person's library the window plays; its title is the window's. */
  book: OwnedBook;
  /** Called by the Library button of the bar. */
  onLibrary?: () => void;
  /** Called with how far the person has listened, 1 to 100, as it changes. */
  onReadPercent?: (percent: number) => void;
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

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const hours = Math.floor(minutes / 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes % 60)}:${pad(whole % 60)}`
    : `${minutes}:${pad(whole % 60)}`;
};

const NO_CHAPTERS: Audiobook["chapters"] = [];

type Loaded =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; audiobook: Audiobook };

/**
 * The book window of an audiobook from LibriVox: one audio element, which plays a chapter straight
 * from the Internet Archive, with the chapters listed beside it and the place kept with the person's
 * other readings, as seconds across the whole recording, the same in every browser.
 */
export function BooksAudiobookPlayer({
  book,
  onLibrary,
  onReadPercent,
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
  height = 560,
  className,
  inert,
  "aria-busy": busy,
  ...props
}: BooksAudiobookPlayerProps) {
  const [reading, setReading] = useState<BooksReading>(NO_READING);
  const loadingPlace = useServerState({
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
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Try Again asks once more
  useEffect(() => {
    let live = true;
    setLoaded({ status: "loading" });
    fetchAudiobook(book.id).then(
      (audiobook) => {
        if (live) setLoaded({ status: "ready", audiobook });
      },
      (error: unknown) => {
        if (live) {
          setLoaded({
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    );
    return () => {
      live = false;
    };
  }, [book.id, attempt]);
  const audiobook = loaded.status === "ready" ? loaded.audiobook : null;
  const chapters = audiobook?.chapters ?? NO_CHAPTERS;

  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [chapter, setChapter] = useState(0);
  const [position, setPosition] = useState(0);
  // Where to go in the chapter once its sound says how long it is, and whether to play on.
  const seekOnLoad = useRef<number | null>(null);
  const playOnLoad = useRef(false);
  // Whether the window has taken its place from the server, once.
  const [placed, setPlaced] = useState(false);

  // Until a chapter's sound has said how long it is, the element's time says nothing of the place.
  const placeNow = useCallback(
    () =>
      secondsBefore(chapters, chapter) +
      (seekOnLoad.current ?? audio.current?.currentTime ?? position),
    [chapters, chapter, position],
  );
  const keepPlace = useCallback((place: number) => {
    const next = Math.max(0, Math.floor(place));
    setReading((now) => (now.place === next ? now : { ...now, place: next }));
  }, []);

  useEffect(() => {
    if (placed || loadingPlace || chapters.length === 0) return;
    setPlaced(true);
    const { index, offset } = chapterAt(chapters, reading.place);
    seekOnLoad.current = offset;
    setChapter(index);
    setPosition(offset);
  }, [placed, loadingPlace, chapters, reading.place]);

  const current = chapters[chapter];
  const source = placed ? current?.url : undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new chapter is a new source
  useEffect(() => {
    setFailed(null);
  }, [source]);

  const goToChapter = (index: number, offset: number, play: boolean) => {
    const element = audio.current;
    if (index < 0 || index >= chapters.length || !element) return;
    keepPlace(secondsBefore(chapters, index) + offset);
    setPosition(offset);
    setFailed(null);
    if (index === chapter) {
      element.currentTime = offset;
      if (play) void element.play().catch(() => {});
      return;
    }
    seekOnLoad.current = offset;
    playOnLoad.current = play;
    setChapter(index);
  };
  const toggle = () => {
    const element = audio.current;
    if (!element || !source) return;
    if (element.paused) {
      setFailed(null);
      // A source that failed is asked for again.
      if (element.error) element.load();
      element.play().catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") setFailed(error.message);
      });
    } else element.pause();
  };
  const skip = (by: number) => {
    const element = audio.current;
    if (!element) return;
    const to = element.currentTime + by;
    if (to < 0) {
      if (chapter > 0) {
        const before = chapters[chapter - 1]?.seconds ?? 0;
        goToChapter(chapter - 1, Math.max(0, before + to), !element.paused);
      } else goToChapter(0, 0, !element.paused);
      return;
    }
    goToChapter(chapter, Math.min(to, element.duration || to), !element.paused);
  };
  const previousChapter = () => {
    const element = audio.current;
    if ((element?.currentTime ?? 0) > START_OF_CHAPTER || chapter === 0) {
      goToChapter(chapter, 0, !(element?.paused ?? true));
    } else goToChapter(chapter - 1, 0, !(element?.paused ?? true));
  };
  const nextChapter = () => goToChapter(chapter + 1, 0, !(audio.current?.paused ?? true));

  // While it plays the place is kept every so often, and whenever it stops.
  const latestPlace = useRef(placeNow);
  latestPlace.current = placeNow;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => keepPlace(latestPlace.current()), KEEP_PLACE_MS);
    return () => clearInterval(timer);
  }, [playing, keepPlace]);

  const total = audiobook?.seconds ?? 0;
  const listened = secondsBefore(chapters, chapter) + position;
  const percent = total > 0 ? Math.min(100, Math.max(1, Math.round((listened / total) * 100))) : 1;
  useEffect(() => {
    if (audiobook && !loadingPlace) onReadPercent?.(percent);
  }, [audiobook, loadingPlace, percent, onReadPercent]);

  // The window's own ways out keep the place first: rendered now, so its save starts before the
  // window goes.
  const keepThen =
    <Args extends unknown[]>(then?: (...args: Args) => void) =>
    (...args: Args) => {
      if (usable) flushSync(() => keepPlace(placeNow()));
      then?.(...args);
    };
  const usable = audiobook !== null && !loadingPlace;
  const commands = useRef({ toggle, previousChapter, nextChapter, onLibrary });
  commands.current = { toggle, previousChapter, nextChapter, onLibrary };
  const hasNext = chapter + 1 < chapters.length;
  const controlsMenu = useMemo(
    () => (
      <>
        <MenuItem disabled={!usable} onClick={() => commands.current.toggle()}>
          {playing ? "Pause" : "Play"}
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled={!usable} onClick={() => commands.current.previousChapter()}>
          Previous Chapter
        </MenuItem>
        <MenuItem disabled={!usable || !hasNext} onClick={() => commands.current.nextChapter()}>
          Next Chapter
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="shift+command+l" onClick={() => commands.current.onLibrary?.()}>
          Show Library
        </MenuItem>
      </>
    ),
    [usable, playing, hasNext],
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
      (event.target instanceof Element && event.target.closest("input, textarea, button"))
    ) {
      return;
    }
    if (matchesMenuKeyEquivalent(event, "shift+command+l")) {
      event.preventDefault();
      onLibrary?.();
      return;
    }
    if (event.key === " " && usable) {
      event.preventDefault();
      toggle();
    }
  };
  useEffect(() => {
    const listen = (event: globalThis.KeyboardEvent) => keys.current(event);
    document.addEventListener("keydown", listen);
    return () => document.removeEventListener("keydown", listen);
  }, []);

  const length = current?.seconds ?? 0;
  return (
    <Window
      width={width}
      height={height}
      className={
        className
          ? `mac-books-reader mac-books-audiobook ${className}`
          : "mac-books-reader mac-books-audiobook"
      }
      {...props}
      aria-busy={busy || loadingPlace || undefined}
      inert={inert || loadingPlace || undefined}
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
            onClose={keepThen(onClose)}
            onMinimize={onMinimize}
            onZoom={onZoom}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset */}
        <div ref={frame} className="mac-books-reader-bar" role="group" aria-label="Book controls">
          <ImageButton aria-label="Library" style={BAR_ITEM} onClick={keepThen(onLibrary)}>
            <BooksGlyph name="library" />
          </ImageButton>
          <span className="mac-books-reader-bar-space" />
        </div>
      </TitleBar>
      <WindowBody className="mac-books-reader-body mac-books-audiobook-body">
        {loaded.status === "failed" ? (
          <div className="mac-books-text-status">
            <EmptyState role="status">
              Books could not read this audiobook's chapters: {loaded.message}
            </EmptyState>
            <PushButton onClick={() => setAttempt((count) => count + 1)}>Try Again</PushButton>
          </div>
        ) : !usable ? (
          <div className="mac-books-text-status">
            <ProgressSpinner size="small" aria-label="Loading the chapters" />
          </div>
        ) : (
          <>
            <div className="mac-books-audiobook-player">
              <BookCover className="mac-books-cover" style={COVER}>
                <RealCoverArtwork cover={book.cover} title={book.title} author={book.author} />
              </BookCover>
              <h2 className="mac-books-audiobook-title">{book.title}</h2>
              <p className="mac-books-audiobook-line">{book.author || "Unknown author"}</p>
              <p className="mac-books-audiobook-line" aria-live="polite">
                {current?.title}
                {current?.reader ? `, read by ${current.reader}` : ""}
              </p>
              <Slider
                className="mac-books-audiobook-position"
                aria-label="Position in the chapter"
                min={0}
                max={Math.max(1, length)}
                value={Math.min(position, Math.max(1, length))}
                onValueChange={(value) =>
                  goToChapter(chapter, value as number, !(audio.current?.paused ?? true))
                }
              />
              <p className="mac-books-audiobook-times">
                <span>{clock(position)}</span>
                <span>
                  {clock(listened)} of {clock(total)}
                </span>
                <span>-{clock(Math.max(0, length - position))}</span>
              </p>
              {/* biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset */}
              <div className="mac-books-audiobook-buttons" role="group" aria-label="Playback">
                <PushButton onClick={previousChapter}>Previous Chapter</PushButton>
                <PushButton onClick={() => skip(-SKIP_BACK)}>Back {SKIP_BACK}</PushButton>
                <PushButton onClick={toggle}>{playing ? "Pause" : "Play"}</PushButton>
                <PushButton onClick={() => skip(SKIP_FORWARD)}>Forward {SKIP_FORWARD}</PushButton>
                <PushButton disabled={!hasNext} onClick={nextChapter}>
                  Next Chapter
                </PushButton>
              </div>
              {waiting && !failed ? (
                <ProgressSpinner size="small" aria-label="Waiting for the sound" />
              ) : null}
              {failed ? (
                <p className="mac-books-audiobook-line" role="status">
                  The Internet Archive did not give this chapter: {failed}
                </p>
              ) : null}
              <p className="mac-books-audiobook-credit">
                Recorded by volunteers for LibriVox, in the public domain. The sound comes from the
                Internet Archive.
              </p>
            </div>
            <ListView
              aria-label="Chapters"
              className="mac-books-audiobook-chapters"
              count={chapters.length}
              rowHeight={36}
              selectionMode="single"
              getRowId={(index) => index}
              getRowLabel={(index) => chapters[index]?.title ?? ""}
              value={[chapter]}
              onValueChange={(value) => {
                const index = Number(value[0]);
                if (Number.isInteger(index) && index !== chapter) {
                  goToChapter(index, 0, !(audio.current?.paused ?? true));
                }
              }}
              renderRow={(index) => (
                <span className="mac-books-audiobook-chapter">
                  <span>{chapters[index]?.title}</span>
                  <span>{clock(chapters[index]?.seconds ?? 0)}</span>
                </span>
              )}
            />
          </>
        )}
        {/* biome-ignore lint/a11y/useMediaCaption: LibriVox's recordings have no captions */}
        <audio
          ref={audio}
          src={source}
          preload="metadata"
          onLoadedMetadata={(event) => {
            const offset = seekOnLoad.current;
            seekOnLoad.current = null;
            if (offset !== null) event.currentTarget.currentTime = offset;
            if (playOnLoad.current) {
              playOnLoad.current = false;
              void event.currentTarget.play().catch(() => {});
            }
          }}
          onPlay={() => setPlaying(true)}
          onPlaying={() => setWaiting(false)}
          onWaiting={() => setWaiting(true)}
          onPause={() => {
            setPlaying(false);
            setWaiting(false);
            keepPlace(placeNow());
          }}
          onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
          onSeeked={(event) =>
            keepPlace(secondsBefore(chapters, chapter) + event.currentTarget.currentTime)
          }
          onEnded={() => {
            if (hasNext) goToChapter(chapter + 1, 0, true);
          }}
          onError={(event) => {
            // An error leaves `paused` false, so Play would pause the element and play nothing.
            event.currentTarget.pause();
            setPlaying(false);
            setWaiting(false);
            setFailed(event.currentTarget.error?.message || "it did not answer");
          }}
        />
      </WindowBody>
      {overlay}
    </Window>
  );
}
