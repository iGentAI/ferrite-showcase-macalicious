"use client";

import { HudWindow, HudWindowButton, HudWindowSlider, HudWindowText } from "macalicious/hud-window";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { useEffect, useRef, useState } from "react";
import { readBoolean, readNumber, useDesktopSetting } from "../desktop/desktop-personal";
import {
  FastForwardGlyph,
  PictureInPictureGlyph,
  PlayGlyph,
  RewindGlyph,
  VolumeHighGlyph,
  VolumeLowGlyph,
} from "../quicktime-player/quicktime-player-artwork";
import { startScreenSaverNow } from "../system-preferences/panes/desktop-and-screen-saver/screen-saver";
import { type HomeSubtitlesFile, homeVideoApi, homeVideoErrorText } from "./tv-home-player";
import { clockTime, type TvVideo, watchUrl } from "./tv-youtube-data";

/*
 * TV's player: YouTube's official IFrame Player API (https://developers.google.com/youtube/
 * iframe_api_reference) in the TV window, with YouTube's own controls turned off and TV's
 * controller under it. The video streams from YouTube to the browser; nothing passes through the
 * desktop's server, and nothing is downloaded. Nothing of TV's lies over YouTube's player.
 */

/** The part of YouTube's player object this window uses. */
export interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
  getVideoData?: () => { title?: string; author?: string } | undefined;
  /** A player that holds its video can float it; the promise says whether the browser agreed. */
  togglePictureInPicture?: () => Promise<void>;
  /** A player that holds its video says its subtitles itself. */
  subtitleTracks?: () => readonly TvSubtitleTrack[];
  showSubtitles?: (id: string | null) => void;
  /**
   * YouTube's captions module. The API reference does not list it, but its player has it: a video
   * whose captions it cannot list simply offers none.
   */
  loadModule?: (module: string) => void;
  getOption?: (module: string, option: string) => unknown;
  setOption?: (module: string, option: string, value: unknown) => void;
}

/** One set of subtitles a video offers. */
export interface TvSubtitleTrack {
  id: string;
  label: string;
}

const tracksOf = (player: YouTubePlayer): readonly TvSubtitleTrack[] => {
  if (player.subtitleTracks) return player.subtitleTracks();
  const list = player.getOption?.("captions", "tracklist");
  if (!Array.isArray(list)) return [];
  return list.flatMap((track: { languageCode?: unknown; displayName?: unknown }) =>
    typeof track?.languageCode === "string"
      ? [
          {
            id: track.languageCode,
            label: typeof track.displayName === "string" ? track.displayName : track.languageCode,
          },
        ]
      : [],
  );
};

const showTrack = (player: YouTubePlayer, id: string | null) => {
  if (player.showSubtitles) player.showSubtitles(id);
  else player.setOption?.("captions", "track", id ? { languageCode: id } : {});
};

const readSubtitleChoice = (stored: unknown) => (typeof stored === "string" ? stored : undefined);

/** What `new YT.Player(element, options)` is given. */
export interface YouTubePlayerOptions {
  host?: string;
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YouTubePlayer }) => void;
    onApiChange?: (event: { target: YouTubePlayer }) => void;
    onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
    onError?: (event: { data: number; target: YouTubePlayer }) => void;
  };
}

/** The `YT` namespace the IFrame API defines. */
export interface YouTubeApi {
  Player: new (element: HTMLElement, options: YouTubePlayerOptions) => YouTubePlayer;
}

type WithYouTube = typeof globalThis & {
  YT?: Partial<YouTubeApi>;
  onYouTubeIframeAPIReady?: () => void;
};

/** YouTube's script that defines `YT`. */
export const IFRAME_API = "https://www.youtube.com/iframe_api";

let loading: Promise<YouTubeApi> | null = null;

/** Load YouTube's IFrame API once per page: resolves with `YT` when its player can be made. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  const page = globalThis as WithYouTube;
  if (page.YT?.Player) return Promise.resolve(page.YT as YouTubeApi);
  if (loading) return loading;
  loading = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = page.onYouTubeIframeAPIReady;
    page.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (page.YT?.Player) resolve(page.YT as YouTubeApi);
    };
    const script = document.createElement("script");
    script.src = IFRAME_API;
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("YouTube's player could not be loaded."));
    };
    document.head.append(script);
  });
  return loading;
}

/** What YouTube's `onError` codes mean, in the window's words. */
export function youTubeErrorText(code: number): string {
  switch (code) {
    case 2:
      return "The link does not name a video YouTube can play.";
    case 5:
      return "This browser cannot play the video.";
    case 100:
      return "YouTube says the video was removed or is private.";
    case 101:
    case 150:
      return "YouTube will not play this video here: its owner may not allow it in other apps, or YouTube refused this network.";
    case 153:
      return "YouTube refused to play it without knowing which site asked for it.";
    default:
      return `YouTube could not play the video (error ${code}).`;
  }
}

/** How the player stands, from YouTube's states (-1, 0, 1, 2, 3, 5). */
export type TvPlayerStatus = "loading" | "unstarted" | "playing" | "paused" | "buffering" | "ended";

const STATES: Record<number, TvPlayerStatus> = {
  [-1]: "unstarted",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "unstarted",
};

/** Seconds a skip button moves. */
export const SKIP_SECONDS = 10;
/** How far the menu's and the arrow keys' volume commands move the volume, out of 100. */
export const VOLUME_STEP = 10;

const NO_PICTURE_IN_PICTURE =
  "YouTube's player runs in a frame of its own, and a page cannot float a video it does not hold.";

/**
 * What the window's menus can do with the player: whether it can be asked anything (YouTube's
 * player is ready and has not refused the video), whether it plays, and its commands.
 */
export interface TvPlayerControls {
  usable: boolean;
  playing: boolean;
  /** The volume, out of 100, and whether it is muted: the person's, across videos. */
  volume: number;
  muted: boolean;
  toggle: () => void;
  /** Move the place by `seconds` (negative: back). */
  skip: (seconds: number) => void;
  /** Move the volume by `by` (negative: down). */
  changeVolume: (by: number) => void;
  toggleMute: () => void;
  /** The subtitles the video offers, the one showing (`""` for none), and the choice of one. */
  subtitles: readonly TvSubtitleTrack[];
  subtitle: string;
  chooseSubtitle: (id: string) => void;
}

/** A plus, or a check mark once the video is in Watch Later. */
function WatchLaterGlyph({ added }: { added: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={added ? "M2.5 8.5l3.5 3.5 7.5-8" : "M8 2v12M2 8h12"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

/** Four corners pointing out, or in while the player fills the screen. */
function FullScreenGlyph({ exit }: { exit: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={
          exit ? "M6 1v5H1M10 1v5h5M6 15v-5H1M10 15v-5h5" : "M1 6V1h5M15 6V1h-5M1 10v5h5M15 10v5h-5"
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

type FullScreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FullScreenElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const fullScreenElement = () => {
  const page = document as FullScreenDocument;
  return page.fullscreenElement ?? page.webkitFullscreenElement ?? null;
};

export interface TvYouTubePlayerProps {
  /** The video to play. */
  video: TvVideo;
  /** Where to start, in seconds. */
  start?: number;
  /**
   * Reads `video.id` as a file of the person's drive, which then plays in the page and not through
   * YouTube.
   */
  readHome?: (id: string) => Promise<Blob>;
  /** The subtitles files beside a home video. */
  homeSubtitles?: readonly HomeSubtitlesFile[];
  /** Whether the video is in Watch Later. */
  inWatchLater?: boolean;
  /** Without it the controller has no Watch Later button. */
  onToggleWatchLater?: () => void;
  /** Called with the place, the length and whether it plays, four times a second while it
   * plays and at every pause, seek and end. */
  onProgress: (seconds: number, duration: number, playing: boolean) => void;
  /** Called when the video played to its end. */
  onEnded: () => void;
  /** Called with the title and channel YouTube's player reports. */
  onDetails: (title: string, channel: string) => void;
  /** Called by Done: back to the video's page. */
  onDone: () => void;
  /**
   * Called with what the player's controls can do whenever that changes, and with `null` when
   * the player goes: the window's Controls menu acts through it.
   */
  onControls?: (controls: TvPlayerControls | null) => void;
  /** Preferences' Use the screen saver while paused: it starts after a pause with no input. */
  screenSaverWhilePaused?: boolean;
}

/** How long a video stays paused, with no pointer or key, before the screen saver starts. */
export const PAUSED_SAVER_MS = 60_000;

const INPUT = ["pointermove", "pointerdown", "keydown", "wheel"] as const;

/** The video in YouTube's embedded player, under TV's controller. */
export function TvYouTubePlayer({
  video,
  start = 0,
  readHome,
  homeSubtitles,
  inWatchLater = false,
  onToggleWatchLater,
  onProgress,
  onEnded,
  onDetails,
  onDone,
  onControls,
  screenSaverWhilePaused = false,
}: TvYouTubePlayerProps) {
  const stage = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const [status, setStatus] = useState<TvPlayerStatus>("loading");
  // Why the video does not play: YouTube's error code (`null` when YouTube's player could not be
  // loaded at all) and the window's words for it.
  const [error, setError] = useState<{ code: number | null; text: string } | null>(null);
  const [time, setTime] = useState(start);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useDesktopSetting("tv.volume", readNumber, 100);
  const [muted, setMuted] = useDesktopSetting("tv.muted", readBoolean, false);
  const [fullScreen, setFullScreen] = useState(false);
  const [tracks, setTracks] = useState<readonly TvSubtitleTrack[]>([]);
  // The subtitles last told to the player; `undefined` before anything has been.
  const shownTrack = useRef<string | null | undefined>(undefined);
  // The subtitles the person last chose, by language: on again wherever a video offers it.
  const [subtitleChoice, setSubtitleChoice] = useDesktopSetting(
    "tv.subtitles",
    readSubtitleChoice,
    "",
  );
  // Whether YouTube's player has said it is ready: its playback methods are installed only then,
  // so the controls that call them wait for it.
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const [floatRefused, setFloatRefused] = useState(false);

  // The callbacks of the latest render, for the player's events.
  const latest = useRef({
    onProgress,
    onEnded,
    onDetails,
    start,
    volume,
    muted,
    readHome,
    homeSubtitles,
    subtitleChoice,
  });
  useEffect(() => {
    latest.current = {
      onProgress,
      onEnded,
      onDetails,
      start,
      volume,
      muted,
      readHome,
      homeSubtitles,
      subtitleChoice,
    };
  });

  // The player has the keyboard from the start, and gets it back from YouTube's frame, where a
  // click would otherwise leave Space and the arrows.
  useEffect(() => {
    stage.current?.focus({ preventScroll: true });
    const takeBack = () => {
      const focused = document.activeElement;
      if (!focused || !host.current?.contains(focused)) return;
      // At once, Chromium's frame in another process takes the focus after this has given it away.
      setTimeout(() => {
        window.focus();
        stage.current?.focus({ preventScroll: true });
      }, 100);
    };
    window.addEventListener("blur", takeBack);
    return () => window.removeEventListener("blur", takeBack);
  }, []);

  // One player per video: made when the window opens it, destroyed when it leaves.
  useEffect(() => {
    let live = true;
    const box = host.current;
    setStatus("loading");
    setError(null);
    setDuration(0);
    readyRef.current = false;
    setReady(false);
    setTime(latest.current.start);
    const read = latest.current.readHome;
    setTracks([]);
    shownTrack.current = undefined;
    const followTracks = (target: YouTubePlayer) => {
      const offered = tracksOf(target);
      setTracks(offered);
      // Until captions are listed the module may not be ready to hear anything.
      if (offered.length === 0) return;
      const chosen = latest.current.subtitleChoice;
      const wanted = offered.some(({ id }) => id === chosen) ? chosen : null;
      // YouTube may show captions of its own, and setting them can tell of an API change again.
      if (shownTrack.current !== wanted) {
        shownTrack.current = wanted;
        showTrack(target, wanted);
      }
    };
    (read
      ? Promise.resolve(homeVideoApi(read, latest.current.homeSubtitles))
      : loadYouTubeApi()
    ).then(
      (api) => {
        if (!live || !box) return;
        // YouTube replaces the element it is given with its iframe: give it one of its own, not
        // an element React renders.
        const mount = document.createElement("div");
        box.replaceChildren(mount);
        const report = (target: YouTubePlayer, playing: boolean) => {
          const seconds = target.getCurrentTime() || 0;
          const length = target.getDuration() || 0;
          setTime(seconds);
          setDuration(length);
          latest.current.onProgress(seconds, length, playing);
        };
        player.current = new api.Player(mount, {
          host: "https://www.youtube-nocookie.com",
          videoId: video.id,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
            rel: 0,
            start: Math.max(0, Math.floor(latest.current.start)),
            origin: globalThis.location?.origin ?? "",
          },
          events: {
            onReady: ({ target }) => {
              if (!live) return;
              readyRef.current = true;
              setReady(true);
              setStatus("unstarted");
              setDuration(target.getDuration() || 0);
              target.setVolume(latest.current.volume);
              if (latest.current.muted) target.mute();
              else target.unMute();
              // Out of the Tab order: with YouTube's controls off there is nothing to reach in it.
              box?.querySelector("iframe")?.setAttribute("tabindex", "-1");
              target.loadModule?.("captions");
              followTracks(target);
              const data = target.getVideoData?.();
              if (data?.title) latest.current.onDetails(data.title, data.author ?? "");
              target.playVideo();
            },
            onApiChange: ({ target }) => {
              if (live) followTracks(target);
            },
            onStateChange: ({ data, target }) => {
              if (!live) return;
              const next = STATES[data] ?? "unstarted";
              setStatus(next);
              if (next === "playing") {
                setError(null);
                const details = target.getVideoData?.();
                if (details?.title) latest.current.onDetails(details.title, details.author ?? "");
              }
              if (next === "paused") report(target, false);
              if (next === "ended") {
                report(target, false);
                latest.current.onEnded();
              }
            },
            onError: ({ data }) => {
              if (live) {
                setError({
                  code: data,
                  text: read ? homeVideoErrorText(data) : youTubeErrorText(data),
                });
              }
            },
          },
        });
      },
      (failure: unknown) => {
        if (live) {
          setError({
            code: null,
            text: failure instanceof Error ? failure.message : String(failure),
          });
        }
      },
    );
    return () => {
      live = false;
      readyRef.current = false;
      const current = player.current;
      player.current = null;
      if (current) {
        // The place where the person left, before the player goes.
        try {
          const seconds = current.getCurrentTime() || 0;
          if (seconds > 0) latest.current.onProgress(seconds, current.getDuration() || 0, false);
        } catch {
          // A player that never became ready has no place.
        }
        current.destroy();
      }
      box?.replaceChildren();
    };
  }, [video.id]);

  useEffect(() => {
    if (!screenSaverWhilePaused || status !== "paused") return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(startScreenSaverNow, PAUSED_SAVER_MS);
    };
    arm();
    for (const kind of INPUT) window.addEventListener(kind, arm, { capture: true, passive: true });
    return () => {
      clearTimeout(timer);
      for (const kind of INPUT) window.removeEventListener(kind, arm, { capture: true });
    };
  }, [screenSaverWhilePaused, status]);

  // Four times a second while it plays: the place and the length.
  useEffect(() => {
    if (status !== "playing") return;
    const timer = setInterval(() => {
      const current = player.current;
      if (!current || !readyRef.current) return;
      const seconds = current.getCurrentTime() || 0;
      const length = current.getDuration() || 0;
      setTime(seconds);
      setDuration(length);
      latest.current.onProgress(seconds, length, true);
    }, 250);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    const follow = () => setFullScreen(fullScreenElement() === stage.current);
    document.addEventListener("fullscreenchange", follow);
    document.addEventListener("webkitfullscreenchange", follow);
    return () => {
      document.removeEventListener("fullscreenchange", follow);
      document.removeEventListener("webkitfullscreenchange", follow);
    };
  }, []);

  const floats = readHome !== undefined && document.pictureInPictureEnabled === true;
  const playing = status === "playing" || status === "buffering";
  // The controls work once YouTube's player is ready, and not after it refused the video: a
  // refused video has nothing to play, pause or move, so its controls are dimmed.
  const usable = ready && error === null;
  // The player, once it can be asked anything; `null` before YouTube's `onReady`.
  const player_ = () => (readyRef.current ? player.current : null);
  const toggle = () => {
    const current = player_();
    if (!current) return;
    // YouTube reports the new state a moment later: a second press before then still toggles.
    if (playing) {
      setStatus("paused");
      current.pauseVideo();
    } else {
      setStatus("playing");
      current.playVideo();
    }
  };
  const seekTo = (seconds: number) => {
    const current = player_();
    if (!current) return;
    const to = Math.max(0, duration > 0 ? Math.min(duration, seconds) : seconds);
    current.seekTo(to, true);
    setTime(to);
    latest.current.onProgress(to, duration, playing);
  };
  const changeVolume = (next: number) => {
    const current = player_();
    if (!current) return;
    const value = Math.min(100, Math.max(0, Math.round(next)));
    setVolume(value);
    current.setVolume(value);
    if (value > 0 && muted) {
      current.unMute();
      setMuted(false);
    }
  };
  const toggleMute = () => {
    const current = player_();
    if (!current) return;
    if (muted) current.unMute();
    else current.mute();
    setMuted(!muted);
  };

  // The window's Controls menu acts through the commands of the latest render.
  const live = {
    toggle,
    toggleMute,
    chooseSubtitle: (id: string) => {
      setSubtitleChoice(id);
      const current = player_();
      shownTrack.current = id || null;
      if (current) showTrack(current, id || null);
    },
    skip: (by: number) => seekTo(time + by),
    changeVolume: (by: number) => changeVolume(volume + by),
  };
  const commands = useRef(live);
  commands.current = live;
  const subtitle = tracks.some(({ id }) => id === subtitleChoice) ? subtitleChoice : "";
  useEffect(() => {
    onControls?.({
      usable,
      playing,
      volume,
      muted,
      subtitles: tracks,
      subtitle,
      chooseSubtitle: (id) => commands.current.chooseSubtitle(id),
      toggle: () => commands.current.toggle(),
      skip: (by) => commands.current.skip(by),
      changeVolume: (by) => commands.current.changeVolume(by),
      toggleMute: () => commands.current.toggleMute(),
    });
  }, [onControls, usable, playing, volume, muted, tracks, subtitle]);
  useEffect(() => () => onControls?.(null), [onControls]);
  const toggleFullScreen = () => {
    const page = document as FullScreenDocument;
    if (fullScreenElement()) {
      void (page.exitFullscreen?.() ?? page.webkitExitFullscreen?.());
      return;
    }
    const element = stage.current as FullScreenElement | null;
    if (!element) return;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(() => setFullScreen(false));
    } else element.webkitRequestFullscreen?.();
  };

  // Nothing of TV's lies over YouTube's player: its title row is above the video, its controller
  // and any message below it, so YouTube's own screens (consent, sign-in, its links) stay usable.
  return (
    <section
      ref={stage}
      aria-label={`Playing ${video.title}`}
      className="mac-tv-player"
      data-state={status}
      data-error={error ? (error.code ?? "load") : undefined}
      data-full-screen={fullScreen ? "" : undefined}
      tabIndex={-1}
      // A click on a control leaves the keyboard with the player, as on a Mac; Tab still reaches them.
      onMouseDown={(event) => {
        if (!(event.target as Element).closest("button")) return;
        event.preventDefault();
        stage.current?.focus({ preventScroll: true });
      }}
      onKeyDown={(event) => {
        const target = event.target as Element;
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === " ") {
          if (target.closest("button, input, [role='slider']")) return;
          event.preventDefault();
          toggle();
          return;
        }
        if (target.closest("input, [role='slider']")) return;
        const keys: Record<string, () => void> = {
          ArrowLeft: () => seekTo(time - SKIP_SECONDS),
          ArrowRight: () => seekTo(time + SKIP_SECONDS),
          ArrowUp: () => changeVolume(volume + VOLUME_STEP),
          ArrowDown: () => changeVolume(volume - VOLUME_STEP),
        };
        const act = keys[event.key];
        if (act) {
          event.preventDefault();
          act();
        }
      }}
    >
      <div className="mac-tv-player-top">
        <HudWindow variant="controller" aria-label="Video" className="mac-tv-player-title">
          <div className="mac-tv-player-title-row">
            <HudWindowButton className="mac-tv-player-done" onClick={onDone}>
              Done
            </HudWindowButton>
            <HudWindowText className="mac-tv-player-name">
              {video.title}
              {video.channel ? ` · ${video.channel}` : ""}
            </HudWindowText>
          </div>
        </HudWindow>
      </div>
      <div ref={host} className="mac-tv-player-video" />
      {error ? (
        <div className="mac-tv-player-message" role="alert">
          <Label color="secondary">{error.text}</Label>
          {readHome ? null : (
            <PushButton
              onClick={() => window.open(watchUrl(video.id), "_blank", "noopener,noreferrer")}
            >
              Watch on YouTube
            </PushButton>
          )}
        </div>
      ) : readHome && !ready ? (
        <div className="mac-tv-player-message" role="status">
          <Label color="secondary">Reading “{video.title}” from your drive…</Label>
        </div>
      ) : floatRefused ? (
        <div className="mac-tv-player-message" role="alert">
          <Label color="secondary">The browser would not float this video.</Label>
        </div>
      ) : null}
      <div className="mac-tv-player-controller">
        <HudWindow
          variant="controller"
          aria-label="Playback controls"
          className="mac-tv-player-hud"
        >
          <div className="mac-tv-player-rows">
            <div className="mac-tv-player-row">
              <HudWindowButton
                aria-label="Mute"
                aria-pressed={muted}
                disabled={!usable}
                focusableWhenDisabled
                onClick={toggleMute}
              >
                <VolumeLowGlyph />
              </HudWindowButton>
              <HudWindowSlider
                variant="knob"
                aria-label="Volume"
                className="mac-tv-player-volume"
                disabled={!usable}
                value={muted ? 0 : volume}
                onValueChange={(value) => changeVolume(value)}
              />
              <HudWindowButton
                aria-label="Full Volume"
                disabled={!usable}
                focusableWhenDisabled
                onClick={() => changeVolume(100)}
              >
                <VolumeHighGlyph />
              </HudWindowButton>
              <span className="mac-tv-player-gap" />
              <HudWindowButton
                aria-label={`Back ${SKIP_SECONDS} seconds`}
                disabled={!usable}
                focusableWhenDisabled
                onClick={() => seekTo(time - SKIP_SECONDS)}
              >
                <RewindGlyph />
              </HudWindowButton>
              <HudWindowButton
                aria-label={playing ? "Pause" : "Play"}
                disabled={!usable}
                focusableWhenDisabled
                onClick={toggle}
              >
                <PlayGlyph paused={!playing} />
              </HudWindowButton>
              <HudWindowButton
                aria-label={`Forward ${SKIP_SECONDS} seconds`}
                disabled={!usable}
                focusableWhenDisabled
                onClick={() => seekTo(time + SKIP_SECONDS)}
              >
                <FastForwardGlyph />
              </HudWindowButton>
              <span className="mac-tv-player-gap" />
              {onToggleWatchLater ? (
                <HudWindowButton
                  aria-label={inWatchLater ? "Remove from Watch Later" : "Add to Watch Later"}
                  aria-pressed={inWatchLater}
                  onClick={onToggleWatchLater}
                >
                  <WatchLaterGlyph added={inWatchLater} />
                </HudWindowButton>
              ) : null}
              <HudWindowButton
                aria-label="Picture in Picture"
                title={
                  floats
                    ? undefined
                    : readHome
                      ? "This browser cannot float a video."
                      : NO_PICTURE_IN_PICTURE
                }
                disabled={!floats || !usable}
                focusableWhenDisabled
                onClick={() => {
                  setFloatRefused(false);
                  player_()
                    ?.togglePictureInPicture?.()
                    .catch(() => setFloatRefused(true));
                }}
              >
                <PictureInPictureGlyph />
              </HudWindowButton>
              <HudWindowButton
                aria-label={fullScreen ? "Exit Full Screen" : "Enter Full Screen"}
                onClick={toggleFullScreen}
              >
                <FullScreenGlyph exit={fullScreen} />
              </HudWindowButton>
            </div>
            <div className="mac-tv-player-row">
              <HudWindowText data-time="elapsed">{clockTime(time)}</HudWindowText>
              <HudWindowSlider
                variant="scrubber"
                aria-label="Timeline"
                aria-valuetext={`${clockTime(time)} of ${clockTime(duration)}`}
                className="mac-tv-player-timeline"
                min={0}
                max={Math.max(1, Math.floor(duration))}
                step={1}
                largeStep={SKIP_SECONDS}
                disabled={!usable || duration <= 0}
                value={Math.min(Math.floor(time), Math.max(1, Math.floor(duration)))}
                onValueChange={(value) => seekTo(value)}
              />
              <HudWindowText data-time="remaining">
                -{clockTime(Math.max(0, duration - time))}
              </HudWindowText>
            </div>
          </div>
        </HudWindow>
      </div>
    </section>
  );
}
