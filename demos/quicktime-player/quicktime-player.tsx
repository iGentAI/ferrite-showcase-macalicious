"use client";

import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { HudWindow, HudWindowButton, HudWindowSlider, HudWindowText } from "macalicious/hud-window";
import { ImageView } from "macalicious/image-view";
import { Label } from "macalicious/label";
import { cn } from "macalicious/lib/cn";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuRadioGroup, MenuRadioItem } from "macalicious/menu-item";
import { PictureInPicture } from "macalicious/picture-in-picture";
import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";
import { SystemImage } from "macalicious/system-image";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  AirPlayGlyph,
  FastForwardGlyph,
  MOVIE_FRAME_DESCRIPTION,
  MovieFrame,
  MovieProxyIcon,
  PictureInPictureGlyph,
  PlayGlyph,
  RewindGlyph,
  ServiceGlyph,
  VolumeHighGlyph,
  VolumeLowGlyph,
} from "./quicktime-player-artwork";
import {
  advance,
  createClock,
  durationTimecode,
  elapsedTimecode,
  fastForward,
  isScanning,
  pause,
  type QuickTimePlayerClock,
  rewind,
  seek,
  step,
  toFrames,
  togglePlaying,
} from "./quicktime-player-clock";
import { panoramicStrips } from "./quicktime-player-size";
import "./quicktime-player.tokens.css";
import "./quicktime-player.css";

/** How a real movie's picture lies in a frame of another shape: whole, cropped, or stretched. */
export type MovieScaling = "fit" | "fill" | "panoramic";

/** Something the host asks of a real movie's transport; a new `id` asks again. */
export interface MovieCommand {
  id: number;
  /** Start playing, at normal speed. */
  play?: boolean;
  /** Move the playhead here, in seconds. */
  seconds?: number;
  /** Stop playing. */
  pause?: boolean;
}

export interface QuickTimePlayerProps extends Omit<WindowProps, "children" | "title"> {
  /**
   * The movie's name, shown in the title bar after the document's proxy icon. It names the
   * window for assistive technology.
   * @default "Untitled Movie"
   */
  title?: string;
  /**
   * The movie's length: a number of frames, or a time code (`"00:12:49:22"`). Read when the
   * window opens; a later change is not followed.
   * @default "00:12:49:22"
   */
  duration?: number | string;
  /**
   * Where the playhead is when the window opens: a number of frames, or a time code.
   * @default 0
   */
  defaultPosition?: number | string;
  /**
   * Whether the movie plays as soon as the window opens.
   * @default false
   */
  defaultPlaying?: boolean;
  /** Called with a real movie's size in pixels when it has loaded: zero for sound alone. */
  onMovieSize?: (size: { width: number; height: number }) => void;
  /**
   * With `src`: how the picture lies in a frame that is not its shape.
   * @default "fit"
   */
  scaling?: MovieScaling;
  /** With `src`: what the host last asked of the transport. */
  command?: MovieCommand;
  /** With `src`: the rows of the menu a secondary click on the picture opens. */
  pictureMenu?: ReactNode;
  /** With `src`: called when the window starts or stops filling the screen by itself. */
  onFullScreenChange?: (fullScreen: boolean) => void;
  /** A panel floating over the movie, such as its inspector. */
  panel?: ReactNode;
  /** The rows of the Share button's menu. Without them its rows are dimmed, saying why. */
  shareItems?: ReactNode;
  /** With `src`: the rows of the menu a click on the title opens. Without them the title is plain text. */
  titleMenu?: ReactNode;
  /** With `src`: a press on the proxy icon, which then does not move the window. Without it, it does. */
  onProxyPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  /** With `src`: called with the frames in a second measured while the movie plays at normal speed. */
  onFrameRate?: (framesPerSecond: number) => void;
  /**
   * Whether a real movie starts again when it ends.
   * @default false
   */
  loop?: boolean;
  /**
   * The volume when the window opens, from 0 (silent) to 1 (full).
   * @default 1
   */
  defaultVolume?: number;
  /**
   * Frames in a second: the timebase of the time codes. A whole number.
   * @default 30
   */
  frameRate?: number;
  /**
   * A still shown as the movie's picture instead of the placeholder: an image of your own.
   * It fills the window and keeps its shape.
   */
  poster?: ReactNode;
  /**
   * The movie itself, shown instead of the placeholder and of `poster`: your own `<video>`,
   * for example. The demo ships no media and does not drive this element; follow the
   * transport with `onPlayingChange`, `onSeek` and `onVolumeLevelChange`. Give `src` instead to
   * have the window play a movie itself.
   */
  children?: ReactNode;
  /**
   * A movie to play for real: the address of a video the browser can play (the `blob:` address
   * of a file, for one). The window then plays it in a `<video>` of its own, and its controller,
   * keys, Picture in Picture and full screen act on it; `duration` and `frameRate` are then the
   * time base of its time codes only, and the movie's own length replaces `duration`.
   */
  src?: string;
  /** With `src`: called with the movie's `<video>` as it appears and with null as it goes. */
  onMovieElement?: (video: HTMLVideoElement | null) => void;
  /** With `src`: called with the movie's place and length in seconds, and whether it plays, at
   * every change of either (about four times a second while it plays). */
  onTimeChange?: (seconds: number, duration: number, playing: boolean) => void;
  /** Called when the movie starts or stops moving, also when it stops at its end. */
  onPlayingChange?: (playing: boolean) => void;
  /** Called with the frame the playhead is moved to by the scrubber or by a frame step. */
  onSeek?: (position: number) => void;
  /**
   * Called with the new volume, from 0 to 1. (`onVolumeChange` is the element's own media
   * event, which the window passes on like every other.)
   */
  onVolumeLevelChange?: (volume: number) => void;
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
 * The frame at `seconds` of the element's time. Browsers hold that time in whole microseconds, so
 * a seek to a frame reads back just short of it, which is still that frame.
 */
function frameAt(seconds: number, frameRate: number): number {
  const frames = seconds * frameRate;
  const nearest = Math.round(frames);
  return Math.abs(frames - nearest) < 0.001 ? nearest : frames;
}

type Action =
  | { type: "tick"; seconds: number }
  | { type: "toggle" }
  | { type: "pause" }
  | { type: "rewind" }
  | { type: "fast-forward" }
  | { type: "seek"; position: number }
  | { type: "step"; frames: number }
  | { type: "media"; position: number; duration?: number; playing?: boolean }
  | { type: "resume"; rate: number };

function reduce(clock: QuickTimePlayerClock, action: Action): QuickTimePlayerClock {
  switch (action.type) {
    case "tick":
      return advance(clock, action.seconds);
    case "toggle":
      return togglePlaying(clock);
    case "pause":
      return pause(clock);
    case "rewind":
      return rewind(clock);
    case "fast-forward":
      return fastForward(clock);
    case "seek":
      return seek(clock, action.position);
    case "step":
      return step(clock, action.frames);
    case "media": {
      // What a real movie reports: its place, its length, and whether it plays.
      const duration =
        action.duration !== undefined && Number.isFinite(action.duration)
          ? Math.max(0, action.duration)
          : clock.duration;
      const position = Math.min(duration, Math.max(0, action.position));
      const playing = action.playing ?? clock.playing;
      return { ...clock, duration, position, playing, rate: playing ? clock.rate : 1 };
    }
    case "resume":
      // A movie that took another's place goes on as that one went: playing, at its speed.
      return clock.duration > 0 ? { ...clock, playing: true, rate: action.rate } : clock;
  }
}

type PictureInPictureVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

/** Whether the browser can float this video in a window of the system's own. */
function nativePictureInPicture(video: PictureInPictureVideo): boolean {
  if (typeof document === "undefined") return false;
  if (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === "function") {
    return !video.disablePictureInPicture;
  }
  return video.webkitSupportsPresentationMode?.("picture-in-picture") === true;
}

/**
 * A video the browser may send to another screen: the Remote Playback API (Chromium) or
 * Safari's AirPlay picker. Either may be missing, so both are optional here.
 */
type RoutableVideo = Omit<HTMLVideoElement, "remote"> & {
  remote?: RemotePlayback;
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
};

/** Whether the browser offers its own picker of screens for this video. */
function browserRoutes(video: RoutableVideo | null): boolean {
  if (!video) return false;
  if (typeof video.webkitShowPlaybackTargetPicker === "function") return true;
  return typeof video.remote?.prompt === "function" && !video.disableRemotePlayback;
}

type FullScreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

const fullScreenElement = () => {
  const page = document as FullScreenDocument;
  return page.fullscreenElement ?? page.webkitFullscreenElement ?? null;
};

/** Fill the screen with `element`, or leave full screen. */
function toggleFullScreen(element: HTMLElement) {
  const page = document as FullScreenDocument;
  if (fullScreenElement()) {
    void (page.exitFullscreen?.() ?? page.webkitExitFullscreen?.());
    return;
  }
  const target = element as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (target.requestFullscreen) target.requestFullscreen().catch(() => {});
  else target.webkitRequestFullscreen?.();
}

/** A live copy of `video`'s picture: what the in-window floating window shows of a real movie
 * where the browser has no Picture in Picture of its own. */
function MovieMirror({ video }: { video: HTMLVideoElement | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!video) return;
    let frame = 0;
    const draw = () => {
      // The next frame first, so that a failed draw never stops the copy.
      frame = requestAnimationFrame(draw);
      const target = canvas.current;
      // HAVE_CURRENT_DATA: a frame to draw, not only the movie's size.
      if (!target || video.readyState < 2 || video.videoWidth === 0) return;
      if (target.width !== video.videoWidth) target.width = video.videoWidth;
      if (target.height !== video.videoHeight) target.height = video.videoHeight;
      try {
        target.getContext("2d")?.drawImage(video, 0, 0, target.width, target.height);
      } catch {
        // A frame not yet drawable: the next one is tried.
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [video]);
  return <canvas ref={canvas} className="mac-quicktime-player-mirror" />;
}

/** `video`'s picture stretched to its frame's edges (`panoramicStrips`), redrawn every frame. */
function PanoramicPicture({ video }: { video: HTMLVideoElement | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!video) return;
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const target = canvas.current;
      if (!target || video.readyState < 2 || video.videoWidth === 0) return;
      const { clientWidth: width, clientHeight: height } = target;
      if (width === 0 || height === 0) return;
      if (target.width !== width) target.width = width;
      if (target.height !== height) target.height = height;
      const context = target.getContext("2d");
      if (!context) return;
      const movie = { width: video.videoWidth, height: video.videoHeight };
      for (const strip of panoramicStrips(movie, { width, height })) {
        context.drawImage(
          video,
          strip.sx,
          strip.sy,
          strip.sw,
          strip.sh,
          strip.dx,
          strip.dy,
          strip.dw,
          strip.dh,
        );
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [video]);
  return <canvas ref={canvas} className="mac-quicktime-player-panoramic" />;
}

/** Milliseconds a playing movie is left alone before the title bar and the controller fade. */
const HIDE_DELAY = 3000;

/** What keeps a press of the space bar for itself. A slider does not: it has no use for it. */
const TAKES_SPACE =
  "button, a[href], input:not([type='range']), select, textarea, [role='menuitem'], [contenteditable='true']";

/** What keeps the arrow keys for itself. A button does not: it has no use for them. */
const TAKES_ARROWS =
  "input, select, textarea, [role='slider'], [role='menuitem'], [role='listbox'], [contenteditable='true']";

/** How many frames the measured frame rate is taken over. */
const RATE_SAMPLES = 24;
/** What a media key's skip moves by, when the system names no distance, in seconds. */
const MEDIA_KEY_SKIP = 10;

/** The window whose movie the system's media keys and Now Playing reach: the last to play. */
let nowPlaying: object | null = null;
const MEDIA_ACTIONS = ["play", "pause", "seekbackward", "seekforward", "seekto"] as const;

function mediaSession(): MediaSession | undefined {
  return typeof navigator !== "undefined" && "mediaSession" in navigator
    ? navigator.mediaSession
    : undefined;
}

function setMediaHandlers(session: MediaSession, handlers: MediaSessionActionHandler[] | null) {
  MEDIA_ACTIONS.forEach((action, index) => {
    try {
      session.setActionHandler(action, handlers?.[index] ?? null);
    } catch {
      // An action this browser does not know.
    }
  });
}

const SERVICES = ["Mail", "Messages", "AirDrop", "Notes"] as const;
/**
 * Why each sharing service is dimmed. The menu has no action for any of them: a movie is a file,
 * with no web address to share, and AirDrop sends to nearby devices, which a web page can’t reach
 * (the desktop’s own wording for both, demos/desktop/desktop-share-link.tsx).
 */
const SHARE_REASONS: Readonly<Record<(typeof SERVICES)[number], string>> = {
  Mail: "There is no web address to share.",
  Messages: "There is no web address to share.",
  AirDrop: "AirDrop sends to nearby devices, which a web page can’t reach.",
  Notes: "There is no web address to share.",
};
/** What a dimmed AirPlay button says once the browser’s own picker found no screen. */
const NO_SCREEN = "No screen was found to send the movie to.";

/** Where the AirPlay menu can send the picture: the window itself, and an invented device. */
const OUTPUTS = ["This Computer", "Living Room"] as const;

/**
 * The movie window of QuickTime Player in macOS 10.15: the picture fills the window, and a
 * translucent title bar and a floating controller lie over it while the pointer is there. The
 * window is dark in Aqua and in Dark Aqua alike.
 *
 * No media is included. The transport is a model: a timer moves a time code, and the picture
 * is an abstract placeholder unless `poster` or `children` replace it.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function QuickTimePlayer({
  title = "Untitled Movie",
  duration = "00:12:49:22",
  defaultPosition = 0,
  defaultPlaying = false,
  defaultVolume = 1,
  frameRate = 30,
  poster,
  children,
  src,
  onMovieElement,
  onMovieSize,
  scaling = "fit",
  command,
  pictureMenu,
  onFullScreenChange,
  panel,
  shareItems,
  titleMenu,
  onProxyPointerDown,
  onFrameRate,
  loop = false,
  onTimeChange,
  onPlayingChange,
  onSeek,
  onVolumeLevelChange,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1470,
  height = 827,
  className,
  onKeyDown,
  onPointerMove,
  onPointerDown,
  onPointerLeave,
  ...windowProps
}: QuickTimePlayerProps) {
  const [clock, dispatch] = useReducer(reduce, undefined, () =>
    createClock({
      duration: toFrames(duration, frameRate),
      position: toFrames(defaultPosition, frameRate),
      frameRate,
      playing: defaultPlaying,
    }),
  );
  const [volume, setVolume] = useState(() => Math.min(1, Math.max(0, defaultVolume)));
  // The volume the Mute button silenced, to give back when it is pressed again.
  const [silenced, setSilenced] = useState<number>();
  const [sharing, setSharing] = useState(false);
  const [routing, setRouting] = useState(false);
  const [output, setOutput] = useState<string>(OUTPUTS[0]);
  const [floating, setFloating] = useState(false);
  // A real movie: its element, whether the system floats it, and whether it fills the screen.
  const real = src !== undefined;
  const movie = useRef<HTMLVideoElement>(null);
  const [movieElement, setMovieElement] = useState<HTMLVideoElement | null>(null);
  const onMovieElementRef = useRef(onMovieElement);
  onMovieElementRef.current = onMovieElement;
  // One ref callback for the window's life: a new one each render would be detached and
  // attached again on every commit, setting the element state twice each time.
  const attachMovie = useCallback((element: HTMLVideoElement | null) => {
    movie.current = element;
    setMovieElement(element);
    onMovieElementRef.current?.(element);
  }, []);
  const [systemFloating, setSystemFloating] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [unplayable, setUnplayable] = useState(false);
  // A real movie the browser has sent to another screen through its own picker.
  const [remote, setRemote] = useState(false);
  const rewinding = useRef(false);
  const latestTime = useRef(onTimeChange);
  const latestMovieSize = useRef(onMovieSize);
  latestMovieSize.current = onMovieSize;
  const latestFullScreen = useRef(onFullScreenChange);
  latestFullScreen.current = onFullScreenChange;
  useEffect(() => {
    latestTime.current = onTimeChange;
  });

  // The browser says when a real movie starts and stops playing on another screen.
  useEffect(() => {
    const video = movieElement as RoutableVideo | null;
    if (!video) {
      setRemote(false);
      return;
    }
    const playback = video.remote;
    const follow = () =>
      setRemote(
        playback?.state === "connected" || video.webkitCurrentPlaybackTargetIsWireless === true,
      );
    follow();
    const events = ["connect", "connecting", "disconnect"] as const;
    for (const name of events) playback?.addEventListener?.(name, follow);
    video.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", follow);
    return () => {
      for (const name of events) playback?.removeEventListener?.(name, follow);
      video.removeEventListener("webkitcurrentplaybacktargetiswirelesschanged", follow);
    };
  }, [movieElement]);
  // Set once the browser's picker finds no screen: the button is then dimmed, saying so.
  const [noScreen, setNoScreen] = useState<string | null>(null);
  // Whether the browser sees a screen to send the movie to (the Remote Playback API's availability
  // watch); null where it cannot tell, and then its picker decides. Headless and screenless browsers
  // report none, and their picker is dismissed at once: the button was enabled and did nothing.
  const [screens, setScreens] = useState<boolean | null>(null);
  useEffect(() => {
    const remote = movieElement?.remote;
    if (!remote || typeof remote.watchAvailability !== "function") return;
    let live = true;
    let watch: number | null = null;
    remote
      .watchAvailability((available) => {
        if (live) setScreens(available);
      })
      .then(
        (id) => {
          watch = id;
          if (!live) remote.cancelWatchAvailability(id).catch(() => undefined);
        },
        () => undefined,
      );
    return () => {
      live = false;
      if (watch !== null) remote.cancelWatchAvailability(watch).catch(() => undefined);
    };
  }, [movieElement]);
  // A real movie goes to another screen only through the browser's own picker; where the
  // browser has none, the AirPlay button is disabled.
  const routable = real && browserRoutes(movieElement as RoutableVideo | null);
  const chooseScreen = () => {
    const video = movie.current as RoutableVideo | null;
    if (!video) return;
    if (typeof video.webkitShowPlaybackTargetPicker === "function") {
      video.webkitShowPlaybackTargetPicker();
    } else {
      // Dismissing the picker changes nothing; a picker that finds no screen dims the button,
      // which then says so (before, the click did nothing at all).
      video.remote?.prompt().catch((error: unknown) => {
        const name = error instanceof Error ? error.name : "";
        if (name !== "NotAllowedError" && name !== "AbortError") setNoScreen(NO_SCREEN);
      });
    }
  };

  const changeVolume = (next: number) => {
    const value = Math.min(1, Math.max(0, next));
    setSilenced(undefined);
    if (value === volume) return;
    setVolume(value);
    onVolumeLevelChange?.(value);
  };
  const toggleMute = () => {
    if (volume > 0) {
      changeVolume(0);
      setSilenced(volume);
    } else changeVolume(silenced ?? 1);
  };

  // The simulated transport: the timer says how much real time has passed since its last
  // tick, so playback keeps time when the page's timers are slowed down. A real movie keeps its
  // own time.
  const { playing } = clock;
  const tick = Math.max(10, Math.round(1000 / clock.frameRate));
  useEffect(() => {
    if (!playing || real) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      dispatch({ type: "tick", seconds: (now - last) / 1000 });
      last = now;
    }, tick);
    return () => clearInterval(timer);
  }, [playing, tick, real]);

  // A real movie reports its place, its length and whether it plays; the clock follows it.
  const frameRateOf = clock.frameRate;
  const startAt = useRef(toFrames(defaultPosition, frameRate) / Math.max(1, clock.frameRate));
  // The movie the transport was last set up for: another `src` is another movie, which starts
  // at its beginning, its length unknown until it has loaded. If the movie it replaces was
  // playing, the new one goes on the same way once it has loaded: at the same forward speed,
  // or at normal speed after a rewind, which has nothing to go back over at the start.
  const shownSrc = useRef(src);
  const clockNow = useRef(clock);
  clockNow.current = clock;
  const resumeAt = useRef<number | null>(null);
  // Between another `src` and its metadata, the element is still reporting the movie it is
  // leaving (a browser queues a `pause` for it): nothing it says about playing is taken then.
  const loadingSrc = useRef(false);
  useEffect(() => {
    const video = movie.current;
    if (!real || !video) return;
    if (shownSrc.current !== src) {
      shownSrc.current = src;
      startAt.current = 0;
      const was = clockNow.current;
      // A source replaced before it loaded hands on the intent it was given: the clock was
      // reset for it and no longer says how the movie before it was going.
      if (!loadingSrc.current) resumeAt.current = was.playing ? Math.max(1, was.rate) : null;
      loadingSrc.current = true;
      dispatch({ type: "media", position: 0, duration: 0, playing: false });
    }
    setUnplayable(false);
    // Whether the movie is moving, as the transport means it: a rewind pauses the element and
    // moves it back by hand, and is still playing.
    const moving = () => rewinding.current || !video.paused;
    let returnTo: number | null = null;
    const report = (playingNow?: boolean) => {
      const length = Number.isFinite(video.duration) ? video.duration : 0;
      dispatch({
        type: "media",
        position: frameAt(video.currentTime, frameRateOf),
        duration: length * frameRateOf,
        playing: playingNow,
      });
      latestTime.current?.(video.currentTime, length, playingNow ?? moving());
    };
    const onMetadata = () => {
      loadingSrc.current = false;
      latestMovieSize.current?.({ width: video.videoWidth, height: video.videoHeight });
      if (video.duration === Number.POSITIVE_INFINITY) {
        // `MediaRecorder`'s WebM names no length: a seek past its end makes the browser find it.
        returnTo = startAt.current;
        video.currentTime = Number.MAX_SAFE_INTEGER;
      } else if (startAt.current > 0 && startAt.current < video.duration) {
        video.currentTime = startAt.current;
      }
      startAt.current = 0;
      report();
      const rate = resumeAt.current;
      resumeAt.current = null;
      if (rate !== null) dispatch({ type: "resume", rate });
    };
    const onTime = () => {
      if (returnTo !== null && Number.isFinite(video.duration)) {
        video.currentTime = returnTo;
        returnTo = null;
      }
      report();
    };
    // `play` and `pause` are taken only when they still describe the element: a queued event of
    // the movie being replaced, or one overtaken by the transport (a `pause` that arrives after
    // the element was set playing again), changes nothing.
    const onPlay = () => {
      if (loadingSrc.current || video.paused) return;
      report(true);
    };
    const onPause = () => {
      if (loadingSrc.current || rewinding.current || !video.paused) return;
      report(false);
    };
    const onEnded = () => {
      // An `ended` queued for the movie being replaced, or one the element has since left (it was
      // set playing again), is not about the movie it now shows.
      if (loadingSrc.current || !video.ended) return;
      report(false);
    };
    const onError = () => {
      // A new load clears the element's error: an `error` queued for the movie it replaced finds
      // none, and says nothing about this one.
      if (!video.error) return;
      loadingSrc.current = false;
      resumeAt.current = null;
      setUnplayable(true);
      // A movie that cannot be played is not moving: the transport stops (a rewind with it).
      report(false);
    };
    const onEnterFloat = () => setSystemFloating(true);
    const onLeaveFloat = () => setSystemFloating(false);
    const onPresentation = () =>
      setSystemFloating(
        (video as PictureInPictureVideo).webkitPresentationMode === "picture-in-picture",
      );
    const events: [string, () => void][] = [
      ["loadedmetadata", onMetadata],
      ["durationchange", onTime],
      ["timeupdate", onTime],
      ["seeked", onTime],
      ["play", onPlay],
      ["pause", onPause],
      ["ended", onEnded],
      ["error", onError],
      ["enterpictureinpicture", onEnterFloat],
      ["leavepictureinpicture", onLeaveFloat],
      ["webkitpresentationmodechanged", onPresentation],
    ];
    for (const [name, listener] of events) video.addEventListener(name, listener);
    if (video.readyState >= 1) onMetadata();
    return () => {
      for (const [name, listener] of events) video.removeEventListener(name, listener);
    };
  }, [real, src, frameRateOf]);

  // The transport drives a real movie: play, pause, the speed of a fast-forward, and a rewind
  // moved back by hand, since browsers play no negative rate.
  const { rate } = clock;
  // The movie the transport last drove. In the render that brings another `src`, the clock still
  // says what the previous movie was doing, and the reset to a paused start is only dispatched by
  // the effect above: this one waits for the render that shows the reset, and drives nothing until
  // then, so the new movie is never set playing by the old one's state.
  const drivenSrc = useRef(src);
  // A rewind the transport has just ended (its effect cleaned up while it moved).
  const stoppedRewind = useRef(false);
  useEffect(() => {
    const video = movie.current;
    if (!real || !video) return;
    if (drivenSrc.current !== src) {
      drivenSrc.current = src;
      return;
    }
    if (!playing) {
      const wasRewinding = stoppedRewind.current;
      stoppedRewind.current = false;
      rewinding.current = false;
      if (!video.paused) video.pause();
      else if (wasRewinding) {
        // The element was already paused by the rewind, so no `pause` will tell the host.
        const length = Number.isFinite(video.duration) ? video.duration : 0;
        latestTime.current?.(video.currentTime, length, false);
      }
      return;
    }
    stoppedRewind.current = false;
    if (rate > 0) {
      rewinding.current = false;
      video.playbackRate = Math.min(16, rate);
      if (video.paused) {
        // The element is reused for another `src`: a play refused for the movie it was asked for
        // (or cut short, which a new source or a pause does) says nothing about the movie now in
        // it, so only a refusal of this same source stops the transport.
        const asked = video.getAttribute("src");
        video.play().catch((error: unknown) => {
          if (movie.current !== video || video.getAttribute("src") !== asked) return;
          if (error instanceof DOMException && error.name === "AbortError") return;
          dispatch({
            type: "media",
            position: frameAt(video.currentTime, frameRateOf),
            playing: false,
          });
        });
      }
      return;
    }
    rewinding.current = true;
    video.pause();
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const to = Math.max(0, video.currentTime + (rate * (now - last)) / 1000);
      last = now;
      video.currentTime = to;
      dispatch({ type: "media", position: to * frameRateOf, playing: to > 0 });
      const length = Number.isFinite(video.duration) ? video.duration : 0;
      latestTime.current?.(to, length, to > 0);
    }, 100);
    return () => {
      clearInterval(timer);
      if (rewinding.current) stoppedRewind.current = true;
      rewinding.current = false;
    };
  }, [real, playing, rate, frameRateOf, src]);

  useEffect(() => {
    const video = movie.current;
    if (!real || !video) return;
    video.volume = volume;
    video.muted = volume === 0;
  }, [real, volume]);

  useEffect(() => {
    if (!real) return;
    const follow = () => {
      const now = fullScreenElement()?.contains(movie.current) ?? false;
      setFullScreen(now);
      latestFullScreen.current?.(now);
    };
    document.addEventListener("fullscreenchange", follow);
    document.addEventListener("webkitfullscreenchange", follow);
    return () => {
      document.removeEventListener("fullscreenchange", follow);
      document.removeEventListener("webkitfullscreenchange", follow);
    };
  }, [real]);

  // Only a command given while this movie shows: a window that opens on another `src` asks for
  // nothing the one before it was asked.
  const commandDone = useRef(command?.id);
  useEffect(() => {
    const video = movie.current;
    if (!command || commandDone.current === command.id) return;
    commandDone.current = command.id;
    if (!real || !video) return;
    if (command.seconds !== undefined) {
      video.currentTime = command.seconds;
      dispatch({ type: "media", position: command.seconds * frameRateOf });
    }
    if (command.play) dispatch({ type: "resume", rate: 1 });
    if (command.pause) dispatch({ type: "pause" });
  }, [command, real, frameRateOf]);

  const reported = useRef(playing);
  useEffect(() => {
    if (reported.current === playing) return;
    reported.current = playing;
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  // The title bar and the controller leave a playing movie alone once nothing has moved for a
  // while. `activity` restarts the wait; a paused movie, and an open menu, keep them shown.
  const [idle, setIdle] = useState(false);
  const [activity, setActivity] = useState(0);
  const woken = useRef(0);
  const wake = () => {
    const now = Date.now();
    if (!idle && now - woken.current < 250) return;
    woken.current = now;
    setIdle(false);
    setActivity((count) => count + 1);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: `activity` only restarts the wait.
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setIdle(true), HIDE_DELAY);
    return () => clearTimeout(timer);
  }, [playing, activity]);
  const [titleOpen, setTitleOpen] = useState(false);
  const [titleButton, setTitleButton] = useState<HTMLButtonElement | null>(null);
  const titlePressed = useRef<{ x: number; y: number } | null>(null);
  const hidden = idle && playing && !sharing && !routing && !titleOpen;

  const seekTo = (position: number) => {
    dispatch({ type: "seek", position });
    const to = Math.min(clock.duration, Math.max(0, position));
    if (real && movie.current) movie.current.currentTime = to / clock.frameRate;
    onSeek?.(to);
  };
  const stepBy = (frames: number) => {
    dispatch({ type: "step", frames });
    const to = Math.min(clock.duration, Math.max(0, Math.floor(clock.position) + frames));
    if (real && movie.current) movie.current.currentTime = to / clock.frameRate;
    onSeek?.(to);
  };
  // The system's media keys and Now Playing reach the movie that last played, for as long as its
  // window stays.
  const transport = useRef({ seekTo, frames: clock.position, frameRate: clock.frameRate });
  transport.current = { seekTo, frames: clock.position, frameRate: clock.frameRate };
  const nowPlayingOwner = useRef({});
  useEffect(() => {
    const session = mediaSession();
    if (!real || !session) return;
    if (!playing) {
      if (nowPlaying === nowPlayingOwner.current) session.playbackState = "paused";
      return;
    }
    nowPlaying = nowPlayingOwner.current;
    if (typeof MediaMetadata !== "undefined") {
      session.metadata = new MediaMetadata({ title, artist: "QuickTime Player" });
    }
    session.playbackState = "playing";
    const skip = (seconds: number) => {
      const { seekTo: to, frames, frameRate: rate } = transport.current;
      to(frames + seconds * rate);
    };
    setMediaHandlers(session, [
      () => dispatch({ type: "resume", rate: 1 }),
      () => dispatch({ type: "pause" }),
      (details) => skip(-(details.seekOffset ?? MEDIA_KEY_SKIP)),
      (details) => skip(details.seekOffset ?? MEDIA_KEY_SKIP),
      (details) => {
        const { seekTo: to, frameRate: rate } = transport.current;
        to((details.seekTime ?? 0) * rate);
      },
    ]);
  }, [real, playing, title]);
  useEffect(() => {
    const owner = nowPlayingOwner.current;
    return () => {
      const session = mediaSession();
      if (!session || nowPlaying !== owner) return;
      nowPlaying = null;
      setMediaHandlers(session, null);
      session.metadata = null;
      session.playbackState = "none";
    };
  }, []);

  // The frames in a second a playing movie shows: a browser names no frame rate, but it says when
  // each frame comes. The middle gap, so that a frame dropped now and then counts for nothing.
  const latestFrameRate = useRef(onFrameRate);
  latestFrameRate.current = onFrameRate;
  useEffect(() => {
    const video = movieElement;
    if (!video || !playing || rate !== 1 || !video.requestVideoFrameCallback) return;
    let last: number | null = null;
    let gaps: number[] = [];
    const frame: VideoFrameRequestCallback = (_now, { mediaTime }) => {
      if (last !== null && mediaTime > last) gaps.push(mediaTime - last);
      last = mediaTime;
      if (gaps.length >= RATE_SAMPLES) {
        const middle = [...gaps].sort((a, b) => a - b)[gaps.length >> 1] as number;
        latestFrameRate.current?.(Math.round(100 / middle) / 100);
        gaps = [];
      }
      asked = video.requestVideoFrameCallback(frame);
    };
    let asked = video.requestVideoFrameCallback(frame);
    return () => video.cancelVideoFrameCallback(asked);
  }, [movieElement, playing, rate]);

  // Where the person dragged the controller to: the two hooks of the stylesheet, held inside the
  // window whatever its size becomes.
  const [controllerAt, setControllerAt] = useState<{ shift: number; bottom: number } | null>(null);
  const dragController = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as Element;
    if (event.button !== 0 || target.closest("button, input, [role='slider'], [data-control]")) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    const frame = event.currentTarget.closest(".mac-quicktime-player")?.getBoundingClientRect();
    if (!frame) return;
    event.preventDefault();
    const from = { x: event.clientX, y: event.clientY };
    const start = {
      shift: box.left + box.width / 2 - (frame.left + frame.width / 2),
      bottom: frame.bottom - box.bottom,
    };
    const page = event.currentTarget.ownerDocument.defaultView ?? window;
    const move = (now: PointerEvent) =>
      setControllerAt({
        shift: start.shift + now.clientX - from.x,
        bottom: start.bottom - (now.clientY - from.y),
      });
    const end = () => {
      page.removeEventListener("pointermove", move);
      page.removeEventListener("pointerup", end);
      page.removeEventListener("pointercancel", end);
    };
    page.addEventListener("pointermove", move);
    page.addEventListener("pointerup", end);
    page.addEventListener("pointercancel", end);
  };

  // Picture in Picture: the system's own window for a real movie where the browser has one,
  // and otherwise the floating window inside this one.
  const togglePictureInPicture = () => {
    const video = movie.current as PictureInPictureVideo | null;
    if (real && video && !floating && nativePictureInPicture(video)) {
      if (systemFloating) {
        if (document.pictureInPictureElement) void document.exitPictureInPicture();
        else video.webkitSetPresentationMode?.("inline");
        return;
      }
      if (typeof video.requestPictureInPicture === "function" && document.pictureInPictureEnabled) {
        video.requestPictureInPicture().catch(() => setFloating(true));
      } else video.webkitSetPresentationMode?.("picture-in-picture");
      return;
    }
    setFloating(!floating);
  };

  const elapsed = elapsedTimecode(clock);
  const length = durationTimecode(clock);
  const scanning = isScanning(clock);
  const speed = scanning
    ? `${clock.rate > 0 ? "Fast forward" : "Rewind"} ${Math.abs(clock.rate)}×`
    : "";
  // At normal speed the middle button pauses; while the movie scans it brings it back to
  // normal speed, so it is a play button then.
  const pauses = playing && !scanning;
  // Why the window shows no picture, when it does not.
  const elsewhere =
    floating || systemFloating
      ? "This video is playing in Picture in Picture."
      : real && remote
        ? "This video is playing on another screen."
        : !real && output !== OUTPUTS[0]
          ? `This video is playing on “${output}”.`
          : unplayable
            ? "This movie can’t be played in this browser."
            : undefined;

  const picture = (
    // biome-ignore lint/a11y/noStaticElementInteractions: a double click on the picture is QuickTime's full screen; Control-Command-F does the same from the keyboard.
    <div
      className="mac-quicktime-player-movie"
      data-elsewhere={real && elsewhere ? "" : undefined}
      data-scaling={real ? scaling : undefined}
      onDoubleClick={
        real
          ? (event) => {
              const root = event.currentTarget.parentElement;
              if (root) toggleFullScreen(root);
            }
          : undefined
      }
    >
      {real ? (
        // biome-ignore lint/a11y/useMediaCaption: the person's own movie, which has no captions file.
        <video
          ref={attachMovie}
          className="mac-quicktime-player-video"
          src={src}
          playsInline
          loop={loop}
          preload="metadata"
          aria-label={title}
        />
      ) : null}
      {real && scaling === "panoramic" && !elsewhere ? (
        <PanoramicPicture video={movieElement} />
      ) : null}
      {elsewhere ? (
        <Label color="secondary" className="mac-quicktime-player-note">
          {elsewhere}
        </Label>
      ) : real ? null : (
        (children ??
        poster ?? (
          <ImageView
            className="mac-quicktime-player-picture"
            alt={MOVIE_FRAME_DESCRIPTION}
            scaling="axes-independently"
          >
            <MovieFrame className="mac-quicktime-player-frame" />
          </ImageView>
        ))
      )}
    </div>
  );

  return (
    <Window
      // Dark in both appearances, like the HUD inside it.
      data-appearance="dark"
      data-chrome={hidden ? "hidden" : "shown"}
      data-full-screen={fullScreen ? "" : undefined}
      // Focusable from a script and by a click on the picture, so that the keys reach the
      // window; not a tab stop of its own.
      tabIndex={-1}
      width={width}
      height={height}
      className={cn("mac-quicktime-player", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        wake();
        // Control-Command-F: full screen, for a real movie.
        if (
          real &&
          !event.defaultPrevented &&
          event.ctrlKey &&
          event.metaKey &&
          event.key.toLowerCase() === "f"
        ) {
          event.preventDefault();
          toggleFullScreen(event.currentTarget);
          return;
        }
        if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;
        const target = event.target as Element;
        // A key pressed in a menu reaches the window through React though it is elsewhere.
        if (!event.currentTarget.contains(target)) return;
        const own = target === event.currentTarget || !target.closest(TAKES_ARROWS);
        const nudged = Math.round(volume * 100);
        const action = event.altKey
          ? own
            ? {
                ArrowLeft: () => seekTo(0),
                ArrowRight: () => seekTo(clock.duration),
                ArrowUp: () => changeVolume(1),
                ArrowDown: () => changeVolume(0),
              }[event.key]
            : undefined
          : event.key === " "
            ? target.closest(TAKES_SPACE)
              ? undefined
              : () => dispatch({ type: "toggle" })
            : (
                {
                  j: () => dispatch({ type: "rewind" }),
                  k: () => dispatch({ type: "pause" }),
                  l: () => dispatch({ type: "fast-forward" }),
                  ...(own
                    ? {
                        ArrowRight: () => stepBy(1),
                        ArrowLeft: () => stepBy(-1),
                        ArrowUp: () => changeVolume((nudged + 10) / 100),
                        ArrowDown: () => changeVolume((nudged - 10) / 100),
                      }
                    : {}),
                } as Record<string, () => void>
              )[event.key];
        if (action) {
          event.preventDefault();
          action();
        }
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        wake();
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        wake();
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        // QuickTime Player hides the controls of a playing movie as the pointer leaves it.
        if (playing) setIdle(true);
      }}
      {...windowProps}
    >
      {real && pictureMenu ? (
        <ContextualMenu>
          <ContextualMenuTrigger render={picture} />
          <ContextualMenuPopup aria-label="Movie">{pictureMenu}</ContextualMenuPopup>
        </ContextualMenu>
      ) : (
        picture
      )}
      <span role="status" className="mac-quicktime-player-status">
        {speed}
      </span>
      {scanning ? (
        <HudWindow aria-hidden="true" className="mac-quicktime-player-speed">
          <HudWindowText>{speed}</HudWindowText>
        </HudWindow>
      ) : null}
      <TitleBar
        className="mac-quicktime-player-title-bar"
        material="translucent"
        title={
          real && titleMenu ? (
            <>
              {/* Not a menu's own trigger, which opens on the press: a press here still moves the window. */}
              <button
                ref={setTitleButton}
                type="button"
                className="mac-quicktime-player-title-button"
                aria-haspopup="menu"
                aria-expanded={titleOpen}
                onPointerDown={(event) => {
                  titlePressed.current = { x: event.clientX, y: event.clientY };
                  if (event.button === 0) onDragRegionPointerDown?.(event as never);
                }}
                onClick={(event) => {
                  // The click that ends moving the window opens nothing. A key's click has no press.
                  const from = titlePressed.current;
                  titlePressed.current = null;
                  if (!from || Math.hypot(event.clientX - from.x, event.clientY - from.y) < 4) {
                    setTitleOpen(true);
                  }
                }}
              >
                {title}
              </button>
              <Menu open={titleOpen} onOpenChange={setTitleOpen}>
                <MenuPopup aria-label="Document" anchor={titleButton} sideOffset={2}>
                  {titleMenu}
                </MenuPopup>
              </Menu>
            </>
          ) : (
            title
          )
        }
        icon={
          real && onProxyPointerDown ? (
            <span
              data-proxy-drag=""
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
                onProxyPointerDown(event);
              }}
            >
              <MovieProxyIcon />
            </span>
          ) : (
            <MovieProxyIcon />
          )
        }
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
      {/* The fade is the wrapper's: an opacity on the HUD itself would cut its glyphs off
          from its material (HUD Window, API). */}
      <div
        className="mac-quicktime-player-controller"
        style={
          controllerAt
            ? ({
                "--mac-quicktime-player-controller-shift": `clamp(calc(var(--mac-quicktime-player-hud-width) / 2 - 50%), ${controllerAt.shift}px, calc(50% - var(--mac-quicktime-player-hud-width) / 2))`,
                "--mac-quicktime-player-controller-bottom": `clamp(0px, ${controllerAt.bottom}px, calc(100% - var(--mac-quicktime-player-hud-height)))`,
              } as CSSProperties)
            : undefined
        }
      >
        <HudWindow
          variant="controller"
          aria-label="Playback controls"
          className="mac-quicktime-player-hud"
          onPointerDown={real ? dragController : undefined}
        >
          <HudWindowButton
            aria-label="Mute"
            aria-pressed={volume === 0}
            className="mac-quicktime-player-control"
            data-control="mute"
            onClick={toggleMute}
          >
            <VolumeLowGlyph />
          </HudWindowButton>
          <HudWindowSlider
            variant="knob"
            aria-label="Volume"
            className="mac-quicktime-player-control"
            data-control="volume"
            value={Math.round(volume * 100)}
            onValueChange={(value) => changeVolume(value / 100)}
          />
          <HudWindowButton
            aria-label="Full Volume"
            className="mac-quicktime-player-control"
            data-control="full-volume"
            onClick={() => changeVolume(1)}
          >
            <VolumeHighGlyph />
          </HudWindowButton>
          <HudWindowButton
            aria-label="Rewind"
            className="mac-quicktime-player-control"
            data-control="rewind"
            onClick={() => dispatch({ type: "rewind" })}
          >
            <RewindGlyph />
          </HudWindowButton>
          <HudWindowButton
            aria-label={pauses ? "Pause" : "Play"}
            className="mac-quicktime-player-control"
            data-control="play"
            onClick={() => dispatch({ type: "toggle" })}
          >
            <PlayGlyph paused={!pauses} />
          </HudWindowButton>
          <HudWindowButton
            aria-label="Fast Forward"
            className="mac-quicktime-player-control"
            data-control="fast-forward"
            onClick={() => dispatch({ type: "fast-forward" })}
          >
            <FastForwardGlyph />
          </HudWindowButton>
          {real ? (
            // A real movie: the browser's own picker of screens, or nothing where it has none.
            <HudWindowButton
              aria-label="AirPlay"
              className="mac-quicktime-player-control"
              data-control="airplay"
              disabled={!routable || noScreen !== null || screens === false}
              focusableWhenDisabled
              title={
                routable
                  ? (noScreen ?? (screens === false ? NO_SCREEN : undefined))
                  : "This browser can’t send the movie to another screen."
              }
              onClick={chooseScreen}
            >
              <AirPlayGlyph />
            </HudWindowButton>
          ) : (
            <Menu open={routing} onOpenChange={setRouting}>
              <MenuTrigger
                render={
                  <HudWindowButton
                    aria-label="AirPlay"
                    className="mac-quicktime-player-control"
                    data-control="airplay"
                  >
                    <AirPlayGlyph />
                  </HudWindowButton>
                }
              />
              <MenuPopup sideOffset={6}>
                <MenuRadioGroup value={output} onValueChange={setOutput}>
                  {OUTPUTS.map((name) => (
                    <MenuRadioItem key={name} value={name}>
                      {name}
                    </MenuRadioItem>
                  ))}
                </MenuRadioGroup>
              </MenuPopup>
            </Menu>
          )}
          <ShareMenu
            open={sharing}
            onOpenChange={setSharing}
            trigger={
              <HudWindowButton
                aria-label="Share"
                className="mac-quicktime-player-control"
                data-control="share"
              >
                <SystemImage name="share" />
              </HudWindowButton>
            }
            popupProps={{ sideOffset: 6 }}
          >
            {shareItems ??
              SERVICES.map((service) => (
                <ShareMenuItem
                  key={service}
                  image={<ServiceGlyph kind={service.toLowerCase() as Lowercase<typeof service>} />}
                  disabled
                  title={SHARE_REASONS[service]}
                >
                  {service}
                </ShareMenuItem>
              ))}
          </ShareMenu>
          <HudWindowButton
            aria-label="Picture in Picture"
            aria-pressed={floating || systemFloating}
            className="mac-quicktime-player-control"
            data-control="picture-in-picture"
            onClick={togglePictureInPicture}
          >
            <PictureInPictureGlyph />
          </HudWindowButton>
          <HudWindowText className="mac-quicktime-player-time" data-time="elapsed">
            {elapsed}
          </HudWindowText>
          <HudWindowSlider
            variant="scrubber"
            aria-label="Timeline"
            aria-valuetext={`${elapsed} of ${length}`}
            className="mac-quicktime-player-control"
            data-control="timeline"
            max={Math.max(1, clock.duration)}
            step={1}
            largeStep={clock.frameRate * 10}
            value={Math.floor(clock.position)}
            onValueChange={seekTo}
          />
          <HudWindowText className="mac-quicktime-player-time" data-time="duration">
            {length}
          </HudWindowText>
        </HudWindow>
      </div>
      {/* The movie as a floating window. It floats inside this window, clear of the title
          bar: the demo has no screen to put it on. */}
      <PictureInPicture
        style={{ "--mac-picture-in-picture-inset": "34px" } as CSSProperties}
        open={floating}
        onOpenChange={setFloating}
        defaultCorner="top-right"
        defaultWidth={280}
        maxWidth={420}
        playing={pauses}
        onPlayingChange={() => dispatch({ type: "toggle" })}
      >
        {/* Without the class that sizes the drawing to the image view: here it fills the
            floating window as that window's own stylesheet says. A real movie stays in its
            element, and the floating window shows a live copy of its picture. */}
        {real ? (
          <MovieMirror video={floating ? movieElement : null} />
        ) : (
          (children ?? poster ?? <MovieFrame />)
        )}
      </PictureInPicture>
      {panel}
    </Window>
  );
}
