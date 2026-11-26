"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readDriveFile } from "./photos-drive";
import { encodeJpeg, renderEdit } from "./photos-edit";
import { decodePicture, type LibraryPhoto, readOriginal } from "./photos-library";
import { isVideo, titleOf } from "./photos-served-data";

/** The longer side a photo is drawn at on the stage, in pixels. */
const STAGE_SIDE = 2560;
/** How long a photo of a slideshow stays, unless the show says otherwise, in seconds. */
const DEFAULT_SECONDS = 3;
/** How long the controls stay after the pointer stops, in milliseconds. */
const CONTROLS_MS = 2500;

/** How a slideshow leads from one picture to the next. */
export const SLIDESHOW_THEMES = [
  { id: "dissolve", name: "Dissolve" },
  { id: "ken-burns", name: "Ken Burns" },
  { id: "cut", name: "Cut" },
] as const;

/** A photo as the stage shows it: an address for its picture, with its edit drawn in. */
export function usePhotoUrl(photo: LibraryPhoto | undefined): string | undefined {
  const [shown, setShown] = useState<{ id: string; url: string } | null>(null);
  const id = photo ? `${photo.id}:${photo.edited_ms ?? 0}` : "";
  const latest = useRef(photo);
  latest.current = photo;
  useEffect(() => {
    const target = latest.current;
    if (!id || !target) return;
    let live = true;
    let made: string | undefined;
    (async () => {
      const original = await readOriginal(target);
      let image: Blob = original;
      if (target.edit && !isVideo(target)) {
        const decoded = await decodePicture(original);
        try {
          const drawn = await encodeJpeg(
            renderEdit(decoded, target.edit, STAGE_SIDE),
            Number.MAX_SAFE_INTEGER,
            [0.92],
          );
          if (drawn) image = drawn;
        } finally {
          decoded.close();
        }
      }
      if (!live) return;
      made = URL.createObjectURL(image);
      setShown({ id, url: made });
    })().catch((error) => console.warn(`Photos could not show a photo (${error})`));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return shown?.id === id ? shown.url : undefined;
}

export interface PhotoStageProps {
  /** The photos in the order they are stepped through. */
  photos: readonly LibraryPhoto[];
  /** The one shown first. */
  startId?: string;
  /** Plays by itself. */
  slideshow?: boolean;
  theme?: string;
  seconds?: number;
  /** The drive file of the song a slideshow plays, over and over while it runs. */
  musicFile?: string;
  /** Called with the photo shown when the stage closes. */
  onClose: (photoId: string | undefined) => void;
}

/**
 * The photo with nothing around it, filling the screen: the full-screen viewer, and with
 * `slideshow` the slideshow, which goes on by itself, a movie running for its own length. The arrow keys step, Space pauses and
 * resumes a slideshow, and Escape leaves; moving the pointer shows the controls. The page asks
 * the browser for the screen, and stays filling the page where it refuses.
 */
export function PhotoStage({
  photos,
  startId,
  slideshow = false,
  theme = "dissolve",
  seconds = DEFAULT_SECONDS,
  musicFile,
  onClose,
}: PhotoStageProps) {
  const [at, setAt] = useState(() =>
    Math.max(
      0,
      photos.findIndex((photo) => photo.id === startId),
    ),
  );
  const [playing, setPlaying] = useState(slideshow);
  const [controls, setControls] = useState(true);
  const stage = useRef<HTMLDivElement>(null);
  const photo = photos[at];
  const url = usePhotoUrl(photo);
  const movieShown = slideshow && photo !== undefined && isVideo(photo);
  const movie = useRef<HTMLVideoElement>(null);
  const close = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    onClose(photos[at]?.id);
  }, [at, onClose, photos]);

  const song = useRef<HTMLAudioElement | null>(null);
  // A movie has its own sound: the song waits while one runs.
  const songOn = playing && !movieShown;
  const playingNow = useRef(songOn);
  playingNow.current = songOn;
  const showing = useRef(playing);
  showing.current = playing;
  useEffect(() => {
    if (!musicFile) return;
    let live = true;
    let address: string | undefined;
    const audio = new Audio();
    audio.loop = true;
    song.current = audio;
    readDriveFile(musicFile, "")
      .then((blob) => {
        if (!live) return;
        address = URL.createObjectURL(blob);
        audio.src = address;
        return playingNow.current ? audio.play() : undefined;
      })
      .catch((error) => console.warn(`Photos could not play the slideshow's song (${error})`));
    return () => {
      live = false;
      audio.pause();
      song.current = null;
      if (address) URL.revokeObjectURL(address);
    };
  }, [musicFile]);
  useEffect(() => {
    const audio = song.current;
    if (!audio?.src) return;
    if (songOn) void audio.play().catch(() => {});
    else audio.pause();
  }, [songOn]);

  useEffect(() => {
    const element = stage.current;
    element?.focus();
    element?.requestFullscreen?.().catch(() => {});
  }, []);

  // Leaving the browser's full screen by its own means (Escape there) ends the stage too.
  const entered = useRef(false);
  const latestClose = useRef(close);
  latestClose.current = close;
  useEffect(() => {
    const follow = () => {
      if (document.fullscreenElement) entered.current = true;
      else if (entered.current) latestClose.current();
    };
    document.addEventListener("fullscreenchange", follow);
    return () => document.removeEventListener("fullscreenchange", follow);
  }, []);

  const nextInShow = useCallback(() => {
    if (at + 1 < photos.length) setAt(at + 1);
    else setPlaying(false);
  }, [at, photos.length]);

  // A slideshow moves on only once the picture is in, and stops after the last.
  useEffect(() => {
    if (!playing || !url || movieShown) return;
    const timer = setTimeout(nextInShow, seconds * 1000);
    return () => clearTimeout(timer);
  }, [playing, url, movieShown, nextInShow, seconds]);

  // A movie in a slideshow runs for its own length; one the browser cannot play is passed over.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new address is a new element to play
  useEffect(() => {
    const element = movie.current;
    if (!movieShown || !element) return;
    if (!playing) {
      element.pause();
      return;
    }
    if (element.error) {
      nextInShow();
      return;
    }
    element.play().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) return;
      element.muted = true;
      void element.play().catch(() => {});
    });
  }, [playing, movieShown, url, nextInShow]);

  useEffect(() => {
    if (!controls) return;
    const timer = setTimeout(() => setControls(false), CONTROLS_MS);
    return () => clearTimeout(timer);
  }, [controls]);

  const step = (by: number) => setAt((now) => Math.min(photos.length - 1, Math.max(0, now + by)));
  const button = (label: string, glyph: ReactNode, onClick: () => void, disabled = false) => (
    <button
      type="button"
      className="mac-photos-stage-button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {glyph}
    </button>
  );
  return createPortal(
    <div
      ref={stage}
      className="mac-photos-stage"
      role="dialog"
      aria-label={slideshow ? "Slideshow" : "Full Screen Viewer"}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the stage holds the keyboard while it is shown
      tabIndex={0}
      data-theme={theme}
      data-controls={controls ? "" : undefined}
      onPointerMove={() => setControls(true)}
      onKeyDown={(event) => {
        // A movie's keys are its own controls', all but the one that leaves.
        if (event.target instanceof HTMLVideoElement && event.key !== "Escape") return;
        if (event.key === "Escape") close();
        else if (event.key === "ArrowLeft") step(-1);
        else if (event.key === "ArrowRight") step(1);
        else if (event.key === " ") {
          if (slideshow) setPlaying((now) => !now);
          else close();
        } else return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {photo && url ? (
        movieShown ? (
          // biome-ignore lint/a11y/useMediaCaption: the person's own movie has no captions
          <video
            key={url}
            ref={movie}
            className="mac-photos-stage-picture"
            src={url}
            onEnded={nextInShow}
            onError={() => {
              if (showing.current) nextInShow();
            }}
          />
        ) : isVideo(photo) ? (
          // biome-ignore lint/a11y/useMediaCaption: the person's own movie has no captions
          <video key={url} className="mac-photos-stage-picture" src={url} controls autoPlay />
        ) : (
          <img
            key={url}
            className="mac-photos-stage-picture"
            src={url}
            alt={titleOf(photo)}
            data-playing={playing ? "" : undefined}
          />
        )
      ) : null}
      <div className="mac-photos-stage-controls">
        {button("Previous", "‹", () => step(-1), at <= 0)}
        {slideshow
          ? button(playing ? "Pause" : "Play", playing ? "❙❙" : "▶", () =>
              setPlaying((now) => !now),
            )
          : null}
        {button("Next", "›", () => step(1), at >= photos.length - 1)}
        {button("Close", "×", close)}
        <span className="mac-photos-stage-place" role="status">
          {`${at + 1} of ${photos.length}`}
        </span>
      </div>
    </div>,
    document.body,
  );
}
