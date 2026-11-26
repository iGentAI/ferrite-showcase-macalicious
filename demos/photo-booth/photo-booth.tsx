"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { ImageButton } from "macalicious/image-button";
import { ImageView } from "macalicious/image-view";
import { cn } from "macalicious/lib/cn";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PageControl } from "macalicious/page-control";
import { PushButton } from "macalicious/push-button";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { SCENE_DESCRIPTION, Scene } from "./photo-booth-artwork";
import { EMPTY_BACKDROP, USER_BACKDROPS } from "./photo-booth-backdrop";
import {
  clampPage,
  EFFECT_PAGES,
  findEffect,
  type PhotoBoothEffect,
  type PhotoBoothPicture,
  takePicture,
} from "./photo-booth-data";
import "./photo-booth.tokens.css";
import "./photo-booth.css";

const NO_BACKDROPS: readonly string[] = [];
const isUserSlot = (id: string) => (USER_BACKDROPS as readonly string[]).includes(id);

export interface PhotoBoothProps extends Omit<WindowProps, "children"> {
  /**
   * What the window shows when it opens: the Effects browser, as in the reference captures, or
   * the camera's picture with the shutter.
   * @default "effects"
   */
  defaultView?: "effects" | "camera";
  /**
   * The page of the Effects browser that is shown at first, from 0. The captures show the
   * second of three.
   * @default 1
   */
  defaultPage?: number;
  /**
   * The pages of the Effects browser. The captures show three; the app has a fourth, of backdrops.
   * @default EFFECT_PAGES
   */
  effectPages?: readonly (readonly PhotoBoothEffect[])[];
  /**
   * The id of the effect that is chosen at first.
   * @default "normal"
   */
  defaultEffect?: string;
  /**
   * Milliseconds each of the countdown's three counts lasts before a picture is taken.
   * @default 1000
   */
  countdownStepDuration?: number;
  /** Called with the id of an effect when one is chosen in the browser. */
  onEffectChange?: (effect: string) => void;
  /** Called with a picture when the countdown ends and it is taken. */
  onPictureTaken?: (picture: PhotoBoothPicture) => void;
  /**
   * The pictures taken, when the owner keeps them: the window then shows these and adds none
   * itself, and the owner adds the one `onPictureTaken` hands it.
   */
  pictures?: readonly PhotoBoothPicture[];
  /**
   * What the camera shows under an effect, in a preview of the Effects browser and in the camera
   * view, such as a video of the browser's camera.
   * @default the placeholder picture
   */
  source?: (effect: PhotoBoothEffect) => ReactNode;
  /** Disables the shutter, as when there is no camera to take a picture with. */
  takeDisabled?: boolean;
  /** A line of text over the stage, such as why no picture can be taken. */
  notice?: ReactNode;
  /**
   * Called with the pictures to delete when Delete or Backspace is pressed on one of the strip, or
   * Delete is chosen from its contextual menu: that picture, or the whole selection when it is in
   * one. Without it or `onExportPicture` the pictures of the strip cannot be focused, deleted or
   * exported.
   */
  onDeletePictures?: (pictures: readonly PhotoBoothPicture[]) => void;
  /** Called with a picture of the strip when Export… is chosen from its contextual menu. */
  onExportPicture?: (picture: PhotoBoothPicture) => void;
  /**
   * Reads a picture of the strip at its full size, to show it large when it is clicked. Without
   * it a click shows the strip's own image.
   */
  readPicture?: (picture: PhotoBoothPicture) => Promise<Blob>;
  /** Called with the picture shown large in place of the camera, or `null` when none is. */
  onViewingChange?: (picture: PhotoBoothPicture | null) => void;
  /**
   * What the mode switch at the bar's left needs: without it the window takes stills only and shows
   * no switch. `clipping` says whether a clip is being recorded, which only the owner knows: a
   * recorder can stop by itself. `four` takes four pictures and calls `flash` before each.
   */
  capture?: {
    clipping: boolean;
    four: (effect: PhotoBoothEffect, flash: () => void) => Promise<void>;
    startClip: (effect: PhotoBoothEffect) => Promise<void>;
    stopClip: () => void;
  };
  /** The view shown, for an owner that keeps it. */
  view?: "effects" | "camera";
  /** Called when the view changes. */
  onViewChange?: (view: "effects" | "camera") => void;
  /** The page of the Effects browser, for an owner that keeps it. */
  page?: number;
  /** Makes the effects of the page shown a drop target, for an owner that takes drops there. */
  effectsRef?: (element: HTMLDivElement | null) => (() => void) | undefined;
  /** The backdrop slots that hold a picture; the others say how to fill them, and do nothing. */
  filledBackdrops?: readonly string[];
  /** Called when the page changes. */
  onPageChange?: (page: number) => void;
  /** The chosen effect's id, for an owner that keeps it. */
  effect?: string;
  /**
   * Whether the screen flashes as a picture is taken.
   * @default true
   */
  flashEnabled?: boolean;
  /** The strip's selected pictures, by id, for an owner that lets several be chosen. */
  selected?: readonly string[];
  /** Called when Command-click or Shift-click changes the selection. */
  onSelectedChange?: (selected: readonly string[]) => void;
  /** More rows for a picture's contextual menu, between Export… and Delete. */
  pictureMenu?: (picture: PhotoBoothPicture) => ReactNode;
  /** Called when a picture of the strip is pressed, which may start a drag of it. */
  onPicturePointerDown?: (
    event: ReactPointerEvent<HTMLElement>,
    picture: PhotoBoothPicture,
  ) => void;
  /** The Share button, in the bar beside Effects, when there is something chosen to share. */
  shareMenu?: ReactNode;
  /** A number that goes up when the owner asks for the live camera instead of a picture shown large. */
  backToCamera?: number;
  /**
   * Told whether a countdown, four pictures or a clip is under way, when the view and the camera
   * must stay as they are.
   */
  onCaptureBusyChange?: (busy: boolean) => void;
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

/** The counts of the countdown: three, two, one. */
const COUNTS = 3;

/** How long the screen's flash lasts, in milliseconds. */
const FLASH_DURATION = 180;

/** What the camera view shows, for assistive technology, when it shows a camera. */
const CAMERA_DESCRIPTION = "The camera's picture";

/* A preview fills its button: the image button's clear space is its documented hook. */
const CELL = { "--mac-image-button-padding": "0px" } as CSSProperties;

/** The stand-in glyphs of the mode switch, drawn in the segment's colour. */
const STILL_GLYPH = (
  <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
    <rect x="1" y="1" width="14" height="10" rx="1" fill="currentColor" />
  </svg>
);
const FOUR_GLYPH = (
  <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
    <path
      d="M1 1h6.5v4.5H1zM8.5 1H15v4.5H8.5zM1 6.5h6.5V11H1zM8.5 6.5H15V11H8.5z"
      fill="currentColor"
    />
  </svg>
);
const CLIP_GLYPH = (
  <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
    <rect x="1" y="2" width="10" height="8" rx="1" fill="currentColor" />
    <path d="M11.5 6 15 3v6z" fill="currentColor" />
  </svg>
);

type CaptureMode = "still" | "four" | "clip";

const SHUTTER_WORDS: Record<CaptureMode, string> = {
  still: "Take Photo",
  four: "Take Four Photos",
  clip: "Record Clip",
};

/**
 * The window of Photo Booth in macOS 10.15: the Effects browser, four pages of nine previews
 * with a page control under them, and the camera view an effect leads to, where the shutter
 * counts down and takes a picture.
 *
 * No camera is used. The picture is an abstract placeholder, and an effect is a CSS filter or
 * transform applied to it.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places and activates it; the window controls' and the title bar's callbacks
 * are handed to those parts.
 */
export function PhotoBooth({
  defaultView = "effects",
  defaultPage = 1,
  effectPages = EFFECT_PAGES,
  defaultEffect = "normal",
  countdownStepDuration = 1000,
  onEffectChange,
  onPictureTaken,
  pictures: givenPictures,
  source,
  takeDisabled = false,
  notice,
  onDeletePictures,
  onExportPicture,
  readPicture,
  onViewingChange,
  capture,
  view: givenView,
  onViewChange,
  page: givenPage,
  effectsRef,
  filledBackdrops = NO_BACKDROPS,
  onPageChange,
  effect: givenEffect,
  flashEnabled = true,
  selected,
  onSelectedChange,
  pictureMenu,
  onPicturePointerDown,
  shareMenu,
  backToCamera,
  onCaptureBusyChange,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 720,
  height = 562,
  className,
  onKeyDown,
  ...windowProps
}: PhotoBoothProps) {
  const [ownView, setOwnView] = useState(defaultView);
  const view = givenView ?? ownView;
  const setView = (next: "effects" | "camera") => {
    setOwnView(next);
    onViewChange?.(next);
  };
  const [ownPage, setOwnPage] = useState(() => clampPage(defaultPage));
  const page = Math.min(clampPage(givenPage ?? ownPage), effectPages.length - 1);
  const setPage = (next: number) => {
    setOwnPage(next);
    onPageChange?.(next);
  };
  const [ownEffect, setEffect] = useState(() => findEffect(defaultEffect).id);
  const effect = givenEffect === undefined ? ownEffect : findEffect(givenEffect).id;
  const [mode, setMode] = useState<CaptureMode>("still");
  // Four pictures being taken, or a clip starting: the shutter waits.
  const [capturing, setCapturing] = useState(false);
  const clipping = capture?.clipping === true;
  const captureBusy = clipping || capturing;
  const anchor = useRef<string | null>(null);
  const [ownPictures, setPictures] = useState<readonly PhotoBoothPicture[]>([]);
  const pictures = givenPictures ?? ownPictures;
  // The count the countdown shows, or null while no picture is being taken.
  const [count, setCount] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // The picture shown large in place of the camera, by the strip's key for it.
  const [viewingKey, setViewingKey] = useState<string | number | null>(null);
  useEffect(() => {
    if (backToCamera) setViewingKey(null);
  }, [backToCamera]);
  const viewing =
    viewingKey === null
      ? undefined
      : pictures.find((each) => (each.id ?? each.number) === viewingKey);
  const [full, setFull] = useState<{ key: string | number; url: string } | null>(null);
  const reading = useRef(viewing);
  reading.current = viewing;
  const viewedKey = viewing ? (viewing.id ?? viewing.number) : null;
  const viewedRev = viewing?.rev;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new revision is a new image to read.
  useEffect(() => {
    const picture = reading.current;
    if (viewedKey === null || !picture || !readPicture) return;
    let open = true;
    let url: string | null = null;
    readPicture(picture).then(
      (blob) => {
        if (!open) return;
        url = URL.createObjectURL(blob);
        setFull({ key: viewedKey, url });
      },
      // The strip's own image stays in its place.
      () => undefined,
    );
    return () => {
      open = false;
      if (url) URL.revokeObjectURL(url);
      setFull(null);
    };
  }, [viewedKey, viewedRev, readPicture]);
  const viewedSrc = full && full.key === viewedKey ? full.url : viewing?.src;
  const viewingNow = useRef(onViewingChange);
  viewingNow.current = onViewingChange;
  // biome-ignore lint/correctness/useExhaustiveDependencies: told when another picture is shown, not on each render of the same one
  useEffect(() => {
    viewingNow.current?.(reading.current ?? null);
  }, [viewedKey]);
  const current = findEffect(effect);
  const busyNow = useRef(onCaptureBusyChange);
  busyNow.current = onCaptureBusyChange;
  const locked = captureBusy || count !== null;
  useEffect(() => {
    busyNow.current?.(locked);
  }, [locked]);
  const effects = effectPages[page] ?? [];

  // Choosing an effect takes its preview away; the keyboard focus goes on to the shutter.
  const shutter = useRef<HTMLElement>(null);
  const chosen = useRef(false);
  useEffect(() => {
    if (view === "camera" && chosen.current) shutter.current?.focus();
    chosen.current = false;
  }, [view]);

  const choose = (id: string) => {
    const next = findEffect(id);
    chosen.current = true;
    setView("camera");
    setAnnouncement(`${next.name} effect`);
    if (next.id === effect) return;
    setEffect(next.id);
    onEffectChange?.(next.id);
  };
  const cancel = () => {
    if (count === null) return;
    setCount(null);
    setAnnouncement("Cancelled");
  };

  // What the end of the countdown does, read when it ends: the pictures of that moment.
  const take = () => {
    const next = takePicture(pictures, effect);
    const taken = next[next.length - 1];
    if (!givenPictures) setPictures(next);
    if (!taken) return;
    setAnnouncement(`Photo ${taken.number} taken, ${current.name}`);
    onPictureTaken?.(taken);
    if (flashNext.current && flashEnabled) setFlash(true);
  };
  // The end of the countdown, in the mode chosen.
  const fire = () => {
    if (capture && mode === "four") {
      setCapturing(true);
      capture
        .four(current, () => {
          if (flashNext.current && flashEnabled) setFlash(true);
        })
        .finally(() => setCapturing(false));
      setAnnouncement("Taking four pictures");
      return;
    }
    if (capture && mode === "clip") {
      setCapturing(true);
      capture.startClip(current).finally(() => setCapturing(false));
      setAnnouncement("Recording");
      return;
    }
    take();
  };
  const stopClip = () => {
    setAnnouncement("Clip saved");
    capture?.stopClip();
  };
  // The shutter: Option takes the picture at once, Shift takes it without the flash.
  const flashNext = useRef(true);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(false), FLASH_DURATION);
    return () => clearTimeout(timer);
  }, [flash]);
  const shoot = ({ altKey, shiftKey }: { altKey: boolean; shiftKey: boolean }) => {
    flashNext.current = !shiftKey;
    if (altKey) {
      fire();
      return;
    }
    setCount(COUNTS);
    setAnnouncement(String(COUNTS));
  };
  const takeNow = useRef(fire);
  useEffect(() => {
    takeNow.current = fire;
  });

  // One timer per count: `count` is a dependency so that each count starts the next.
  useEffect(() => {
    if (count === null) return;
    const timer = setTimeout(() => {
      if (count > 1) {
        setCount(count - 1);
        setAnnouncement(String(count - 1));
      } else {
        setCount(null);
        takeNow.current();
      }
    }, countdownStepDuration);
    return () => clearTimeout(timer);
  }, [count, countdownStepDuration]);

  return (
    <Window
      width={width}
      height={height}
      className={cn("mac-photo-booth", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.metaKey && !event.ctrlKey && event.key.toLowerCase() === "t" && clipping) {
          event.preventDefault();
          stopClip();
          return;
        }
        if (
          event.metaKey &&
          !event.ctrlKey &&
          event.key.toLowerCase() === "t" &&
          view === "camera" &&
          !viewing &&
          count === null &&
          !capturing &&
          !takeDisabled
        ) {
          event.preventDefault();
          shoot({ altKey: event.altKey, shiftKey: event.shiftKey });
          return;
        }
        if (event.key !== "Escape") return;
        // Escape with a menu open closes the menu and does nothing else.
        if (event.currentTarget.ownerDocument.querySelector('[role="menu"]')) return;
        if (count === null && viewing) {
          event.preventDefault();
          setViewingKey(null);
          return;
        }
        if (count === null) return;
        event.preventDefault();
        cancel();
      }}
      {...windowProps}
    >
      <TitleBar
        title="Photo Booth"
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
      />
      <WindowBody className="mac-photo-booth-body">
        <div className="mac-photo-booth-stage">
          {view === "effects" ? (
            // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a form fieldset
            <div
              ref={effectsRef}
              role="group"
              aria-label={`Effects, page ${page + 1} of ${effectPages.length}`}
              className="mac-photo-booth-grid"
            >
              {effects.map((each) => {
                const empty = isUserSlot(each.id) && !filledBackdrops.includes(each.id);
                const name = empty ? EMPTY_BACKDROP : each.name;
                return (
                  <ImageButton
                    // An id is on a page once: the picture as it is, too.
                    key={each.id}
                    aria-label={name}
                    aria-current={each.id === effect ? "true" : undefined}
                    aria-disabled={empty || undefined}
                    title={empty ? "Drag a picture here to use it as a backdrop." : undefined}
                    style={CELL}
                    onClick={() => {
                      if (!empty) choose(each.id);
                    }}
                  >
                    <span className="mac-photo-booth-preview" data-empty={empty || undefined}>
                      {empty ? null : source ? source(each) : <Scene effect={each} />}
                      <span className="mac-photo-booth-effect-name">{name}</span>
                    </span>
                  </ImageButton>
                );
              })}
            </div>
          ) : (
            <div className="mac-photo-booth-camera">
              <ImageView
                className="mac-photo-booth-picture"
                alt={
                  viewing
                    ? `Photo ${viewing.number}, ${findEffect(viewing.effect).name}`
                    : `${source ? CAMERA_DESCRIPTION : SCENE_DESCRIPTION}, ${current.name}`
                }
                scaling="axes-independently"
              >
                {viewing ? (
                  viewing.clip && full && full.key === viewedKey ? (
                    // biome-ignore lint/a11y/useMediaCaption: a clip the person just recorded has no captions to offer.
                    <video
                      src={full.url}
                      controls
                      playsInline
                      className="mac-photo-booth-frame mac-photo-booth-viewed"
                    />
                  ) : viewedSrc ? (
                    <img
                      src={viewedSrc}
                      alt=""
                      className="mac-photo-booth-frame mac-photo-booth-viewed"
                      style={
                        viewing.baked
                          ? undefined
                          : {
                              filter: findEffect(viewing.effect).filter,
                              transform: findEffect(viewing.effect).transform,
                            }
                      }
                    />
                  ) : (
                    <Scene effect={findEffect(viewing.effect)} className="mac-photo-booth-frame" />
                  )
                ) : source ? (
                  <span className="mac-photo-booth-frame">{source(current)}</span>
                ) : (
                  <Scene effect={current} className="mac-photo-booth-frame" />
                )}
              </ImageView>
              {notice ? <p className="mac-photo-booth-notice">{notice}</p> : null}
              {flash ? <span className="mac-photo-booth-flash" aria-hidden="true" /> : null}
              {count === null ? null : (
                <span className="mac-photo-booth-count" aria-hidden="true">
                  {count}
                </span>
              )}
              {pictures.length > 0 ? (
                <ul className="mac-photo-booth-strip" aria-label="Photos">
                  {pictures.map((picture) => {
                    const taken = findEffect(picture.effect);
                    const label = `${picture.clip ? "Clip" : "Photo"} ${picture.number}, ${taken.name}`;
                    const thumb = (
                      <ImageView
                        className="mac-photo-booth-thumb"
                        alt={label}
                        scaling="axes-independently"
                      >
                        {picture.src ? (
                          <img
                            src={picture.src}
                            alt=""
                            className="mac-photo-booth-taken"
                            style={
                              picture.baked
                                ? undefined
                                : { filter: taken.filter, transform: taken.transform }
                            }
                          />
                        ) : (
                          <Scene effect={taken} />
                        )}
                      </ImageView>
                    );
                    const deletePicture = () => {
                      // A picture of the selection takes the rest of the selection with it.
                      const chosen =
                        picture.id && selected?.includes(picture.id)
                          ? pictures.filter((each) => each.id && selected.includes(each.id))
                          : [picture];
                      onDeletePictures?.(chosen);
                      setAnnouncement(
                        chosen.length > 1 ? `${chosen.length} items deleted` : `${label} deleted`,
                      );
                    };
                    const button = (
                      <button
                        type="button"
                        className="mac-photo-booth-thumb-button"
                        aria-label={label}
                        aria-pressed={
                          (picture.id ?? picture.number) === viewedKey ||
                          (picture.id !== undefined && selected?.includes(picture.id)) === true
                        }
                        data-picture-id={picture.id}
                        data-clip={picture.clip || undefined}
                        data-selected={
                          (picture.id !== undefined && selected?.includes(picture.id)) || undefined
                        }
                        aria-keyshortcuts={onDeletePictures ? "Delete" : undefined}
                        onPointerDown={(event) => onPicturePointerDown?.(event, picture)}
                        // A browser's own drag of the image would cancel the pointer the desktop's drag follows.
                        onDragStart={(event) => event.preventDefault()}
                        onClick={(event) => {
                          // The camera stays in view for as long as it is being taken from.
                          if (locked) return;
                          const id = picture.id;
                          if (onSelectedChange && id && (event.metaKey || event.ctrlKey)) {
                            const now = selected ?? [];
                            onSelectedChange(
                              now.includes(id) ? now.filter((each) => each !== id) : [...now, id],
                            );
                            anchor.current = id;
                            return;
                          }
                          if (onSelectedChange && id && event.shiftKey && anchor.current) {
                            const ids = pictures.flatMap((each) => (each.id ? [each.id] : []));
                            const from = ids.indexOf(anchor.current);
                            const to = ids.indexOf(id);
                            if (from >= 0 && to >= 0) {
                              onSelectedChange(
                                ids.slice(Math.min(from, to), Math.max(from, to) + 1),
                              );
                              return;
                            }
                          }
                          anchor.current = id ?? null;
                          onSelectedChange?.([]);
                          setViewingKey(picture.id ?? picture.number);
                          setAnnouncement(`Showing ${label}`);
                        }}
                        onKeyDown={(event) => {
                          if (!onDeletePictures) return;
                          if (event.key !== "Delete" && event.key !== "Backspace") return;
                          event.preventDefault();
                          deletePicture();
                        }}
                      >
                        {thumb}
                      </button>
                    );
                    return (
                      <li key={picture.id ?? picture.number}>
                        {onDeletePictures || onExportPicture ? (
                          // Right-click (or Control-click) a picture: Export… and Delete, as in
                          // Photo Booth.
                          <ContextualMenu>
                            <ContextualMenuTrigger render={button} />
                            <ContextualMenuPopup>
                              <MenuItem
                                disabled={!onExportPicture}
                                onClick={() => onExportPicture?.(picture)}
                              >
                                Export…
                              </MenuItem>
                              {pictureMenu?.(picture)}
                              <MenuSeparator />
                              <MenuItem disabled={!onDeletePictures} onClick={deletePicture}>
                                Delete
                              </MenuItem>
                            </ContextualMenuPopup>
                          </ContextualMenu>
                        ) : (
                          button
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          )}
        </div>
        <div className="mac-photo-booth-bar">
          {capture ? (
            <SegmentedControl
              aria-label="Capture mode"
              className="mac-photo-booth-modes"
              size="small"
              disabled={count !== null || capturing || clipping || view !== "camera"}
              value={[mode]}
              onValueChange={(next) => {
                const chosen = next[0] as CaptureMode | undefined;
                if (chosen) setMode(chosen);
              }}
            >
              <Segment value="still" aria-label="Take a still picture">
                {STILL_GLYPH}
              </Segment>
              <Segment value="four" aria-label="Take four quick pictures">
                {FOUR_GLYPH}
              </Segment>
              <Segment value="clip" aria-label="Record a movie clip">
                {CLIP_GLYPH}
              </Segment>
            </SegmentedControl>
          ) : null}
          <div className="mac-photo-booth-middle">
            {view === "effects" ? (
              <PageControl
                aria-label="Effects pages"
                count={effectPages.length}
                page={page}
                onPageChange={(next) => setPage(clampPage(next))}
              />
            ) : viewing ? (
              <PushButton ref={shutter} onClick={() => setViewingKey(null)}>
                Back to Camera
              </PushButton>
            ) : clipping ? (
              <PushButton ref={shutter} onClick={stopClip}>
                Stop
              </PushButton>
            ) : count === null ? (
              <PushButton ref={shutter} disabled={takeDisabled || capturing} onClick={shoot}>
                {SHUTTER_WORDS[capture ? mode : "still"]}
              </PushButton>
            ) : (
              <PushButton ref={shutter} onClick={cancel}>
                Cancel
              </PushButton>
            )}
          </div>
          {shareMenu ? <span className="mac-photo-booth-share">{shareMenu}</span> : null}
          <PushButton
            className="mac-photo-booth-effects"
            // 95 pt wide, as captured.
            style={{ width: 95 }}
            // The browser cannot be opened in the middle of a countdown or a clip.
            disabled={count !== null || capturing || clipping}
            onClick={() => setView(view === "effects" ? "camera" : "effects")}
          >
            Effects
          </PushButton>
        </div>
      </WindowBody>
      <div role="status" className="mac-photo-booth-announcement">
        {announcement}
      </div>
    </Window>
  );
}
