import { markOpened, readFile } from "../desktop/desktop-files";
import type { YouTubeApi, YouTubePlayer, YouTubePlayerOptions } from "./tv-youtube-player";

/** What the player is told when the drive could not hand the file over. */
const UNREADABLE = -1;
/** What the player is told when the browser cannot play what the file holds. */
const UNPLAYABLE = 5;

/** The window's words for what `homeVideoApi` reports through `onError`. */
export const homeVideoErrorText = (code: number): string =>
  code === UNREADABLE
    ? "The file could not be read from your drive."
    : "This browser cannot play this file.";

/** Reads a home video out of the person's drive, whole, and marks it opened for Finder's Recents. */
export async function readHomeVideo(id: string): Promise<Blob> {
  const blob = await readFile(id);
  markOpened(id);
  return blob;
}

/** A subtitles file beside a home video: `label` says its language when its name does. */
export interface HomeSubtitlesFile {
  id: string;
  label: string;
}

/**
 * The subtitles files of a video in its folder: `Beach.vtt` and `Beach.en.srt` for `Beach.mp4`, one
 * per label, WebVTT before SubRip.
 */
export function subtitleFilesFor(
  siblings: readonly { id: string; name: string }[],
  video: string,
): HomeSubtitlesFile[] {
  const base = video.replace(/\.[^.]+$/, "").toLowerCase();
  const files = new Map<string, HomeSubtitlesFile>();
  for (const extension of [".vtt", ".srt"]) {
    for (const { id, name } of siblings) {
      const lower = name.toLowerCase();
      if (!lower.startsWith(base) || !lower.endsWith(extension)) continue;
      const middle = name.slice(base.length, name.length - extension.length);
      if (middle !== "" && !/^\.[A-Za-z-]{2,}$/.test(middle)) continue;
      const label = middle.slice(1) || "Subtitles";
      if (!files.has(label)) files.set(label, { id, label });
    }
  }
  return [...files.values()];
}

/** Subtitles as the browser plays them: WebVTT as it is, SubRip with its times rewritten. */
export function asWebVtt(text: string): string {
  const plain = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (plain.startsWith("WEBVTT")) return plain;
  return `WEBVTT\n\n${plain.replace(/(\d\d:\d\d:\d\d),(\d{3})/g, "$1.$2")}`;
}

const readText = async (id: string) => (await readFile(id)).text();

/**
 * A video file played in the page, behind the player object YouTube's API makes, so that TV's
 * controller and menus work the same on both: `videoId` is the drive file `read` is given, and the
 * events are YouTube's states. A subtitles file that cannot be read is left out of the choices.
 */
export function homeVideoApi(
  read: (id: string) => Promise<Blob>,
  subtitles: readonly HomeSubtitlesFile[] = [],
  readSubtitles: (id: string) => Promise<string> = readText,
): YouTubeApi {
  class HomePlayer implements YouTubePlayer {
    private readonly element = document.createElement("video");
    private readonly urls: string[] = [];
    private gone = false;

    constructor(mount: HTMLElement, options: YouTubePlayerOptions) {
      const { element } = this;
      const events = options.events;
      const state = (data: number) => {
        if (!this.gone) events?.onStateChange?.({ data, target: this });
      };
      const failed = (data: number) => {
        if (!this.gone) events?.onError?.({ data, target: this });
      };
      element.playsInline = true;
      mount.replaceWith(element);
      element.onloadedmetadata = () => {
        if (this.gone) return;
        const start = Number(options.playerVars?.start) || 0;
        if (start > 0 && start < element.duration) element.currentTime = start;
        events?.onReady?.({ target: this });
      };
      element.onplaying = () => state(1);
      element.onpause = () => state(2);
      element.onended = () => state(0);
      element.onwaiting = () => state(3);
      element.onerror = () => failed(UNPLAYABLE);
      read(options.videoId).then(
        (blob) => {
          if (!this.gone) element.src = this.urlOf(blob);
        },
        () => failed(UNREADABLE),
      );
      // Each on its own, so that one slow or stuck file holds up neither the video nor the others.
      for (const file of subtitles) {
        readSubtitles(file.id).then(
          (text) => {
            if (this.gone) return;
            const track = document.createElement("track");
            track.kind = "subtitles";
            track.label = file.label;
            track.src = this.urlOf(new Blob([asWebVtt(text)], { type: "text/vtt" }));
            element.append(track);
            events?.onApiChange?.({ target: this });
          },
          () => {},
        );
      }
    }

    private urlOf(blob: Blob) {
      const url = URL.createObjectURL(blob);
      this.urls.push(url);
      return url;
    }

    subtitleTracks() {
      return [...this.element.querySelectorAll("track")].map(({ label }) => ({
        id: label,
        label,
      }));
    }
    showSubtitles(id: string | null) {
      for (const track of this.element.textTracks) {
        track.mode = track.label === id ? "showing" : "disabled";
      }
    }
    playVideo() {
      // A browser may refuse to start without a click: the person then has the Play button.
      void this.element.play().catch(() => {
        this.element.dispatchEvent(new Event("pause"));
      });
    }
    pauseVideo() {
      this.element.pause();
    }
    seekTo(seconds: number) {
      this.element.currentTime = seconds;
    }
    getCurrentTime() {
      return this.element.currentTime;
    }
    getDuration() {
      return Number.isFinite(this.element.duration) ? this.element.duration : 0;
    }
    setVolume(volume: number) {
      this.element.volume = volume / 100;
    }
    mute() {
      this.element.muted = true;
    }
    unMute() {
      this.element.muted = false;
    }
    togglePictureInPicture() {
      return document.pictureInPictureElement === this.element
        ? document.exitPictureInPicture()
        : this.element.requestPictureInPicture().then(() => {});
    }
    destroy() {
      this.gone = true;
      this.element.pause();
      this.element.removeAttribute("src");
      this.element.load();
      for (const url of this.urls) URL.revokeObjectURL(url);
    }
  }
  return { Player: HomePlayer };
}
