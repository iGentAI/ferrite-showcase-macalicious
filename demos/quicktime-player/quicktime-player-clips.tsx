"use client";

import { HudWindow } from "macalicious/hud-window";
import { PushButton } from "macalicious/push-button";
import { useEffect, useRef, useState } from "react";
import {
  beginDesktopDrag,
  type DesktopDragItem,
  registerDropTarget,
} from "../desktop/desktop-drag";
import type { MoviePiece } from "./quicktime-player-picture";
import { opensInQuickTime } from "./quicktime-player-recents";
import { timeText } from "./quicktime-player-recording-files";

/** The shortest clip a split leaves, in seconds. */
const LEAST_CLIP = 0.1;
/** The most splits a movie keeps, as the server holds them. */
export const MAX_CUTS = 256;
/**
 * How far into a clip its still is taken from, in seconds, at most a third of the clip. A replay records
 * its picture 0.05 to 0.15 s behind its place, measured from the frames of three replays one after
 * another, and a movie edited several times adds these up, so a frame read at a clip's start belongs to
 * the clip before it. Only the still: choosing a clip goes to its start.
 */
const CLIP_INSET = 0.3;
const insetOf = (start: number, end: number) => Math.min(CLIP_INSET, (end - start) / 3);
/** The height a still is kept at, in pixels: the strip's own at twice the density. */
const STILL_HEIGHT = 96;
/** How far a press on a clip moves before it is a drag and not a choice, in points. */
const DRAG_AFTER = 4;
/** How far outside the strip a clip being dragged has gone to leave the movie, in points. */
const LEAVES_AFTER = 12;

export interface MovieClip {
  /** Where it begins and ends, in seconds of the movie. */
  start: number;
  end: number;
}

/** The clips a movie of `length` seconds is split into at `cuts`, in order. A replay's length can differ a little, so a cut past the end is no clip. */
export function clipsOf(length: number, cuts: readonly number[]): MovieClip[] {
  const edges = [0, ...cuts.filter((cut) => cut > 0 && cut < length), length];
  return edges.slice(0, -1).map((start, index) => ({ start, end: edges[index + 1] ?? length }));
}

/** `cuts` with one more at `at`, in order; null where that would leave a clip too short to keep, or there are as many as are kept. */
export function withCut(cuts: readonly number[], at: number, length: number): number[] | null {
  const tooNear = [0, ...cuts, length].some((edge) => Math.abs(edge - at) < LEAST_CLIP);
  return tooNear || cuts.length >= MAX_CUTS ? null : [...cuts, at].sort((a, b) => a - b);
}

/** Where `cuts` fall after a trim: those it leaves out go, and the rest move with its start. Other whole-movie edits leave them where they are. */
export function cutsAfter(
  cuts: readonly number[],
  { start = 0, end = Number.POSITIVE_INFINITY }: { start?: number; end?: number },
): number[] {
  return cuts.filter((cut) => cut > start && cut < end).map((cut) => cut - start);
}

/** `cuts` as they are stored: to the millisecond, above 0, once each. */
export const storedCuts = (cuts: readonly number[]): number[] =>
  [...new Set(cuts.map((cut) => Math.round(cut * 1000) / 1000))].filter((cut) => cut > 0);

/** `pieces` with the one at `from` moved to the gap `gap`, counted before the move: 0 is the very start. */
export function movedTo<T>(pieces: readonly T[], from: number, gap: number): T[] {
  const moved = pieces[from];
  if (moved === undefined) return [...pieces];
  const rest = pieces.filter((_, index) => index !== from);
  rest.splice(gap > from ? gap - 1 : gap, 0, moved);
  return rest;
}

/** `pieces` with `added` after the one at `index`. */
export function insertedAfter<T>(pieces: readonly T[], index: number, ...added: T[]): T[] {
  return [...pieces.slice(0, index + 1), ...added, ...pieces.slice(index + 1)];
}

/**
 * The clips chosen after a click on the clip at `index`: Command adds or takes away that clip, Shift
 * reaches it from the last one chosen, and a plain click chooses it alone. In the order of the movie.
 */
export function clipsChosen(
  now: readonly number[],
  index: number,
  { toggle = false, extend = false }: { toggle?: boolean; extend?: boolean } = {},
): number[] {
  if (toggle) {
    return now.includes(index)
      ? now.filter((each) => each !== index)
      : [...now, index].sort((a, b) => a - b);
  }
  const from = now.at(-1);
  if (!extend || from === undefined) return [index];
  const reached = Array.from(
    { length: Math.abs(index - from) + 1 },
    (_, step) => Math.min(index, from) + step,
  );
  return [...new Set([...now, ...reached])].sort((a, b) => a - b);
}

let copiedClips: readonly MoviePiece[] | null = null;
const copyListeners = new Set<() => void>();
/**
 * Edit > Copy's clips, for as long as the page lives. A browser takes no movie onto the system's
 * clipboard, and clips copied here can be pasted into any movie window, as on a Mac.
 */
export const clipClipboard = {
  subscribe: (listener: () => void) => {
    copyListeners.add(listener);
    return () => {
      copyListeners.delete(listener);
    };
  },
  read: () => copiedClips,
  write: (clips: readonly MoviePiece[]) => {
    copiedClips = clips;
    for (const listener of copyListeners) listener();
  },
};

/** Answers when `event` comes. */
const heard = (video: HTMLVideoElement, event: string) =>
  new Promise<void>((resolve) => {
    video.addEventListener(event, () => resolve(), { once: true });
  });

/** The length of a movie that is not open, in seconds; rejects when the browser cannot play it. */
export async function movieLengthOf(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "auto";
  // The movie can fail at any wait: finding its length seeks after its metadata has come.
  const failed = new Promise<never>((_resolve, reject) => {
    video.addEventListener("error", () => reject(new Error("this browser cannot play it")));
  });
  try {
    const loaded = heard(video, "loadedmetadata");
    video.src = url;
    await Promise.race([loaded, failed]);
    if (!Number.isFinite(video.duration)) {
      const found = heard(video, "seeked");
      video.currentTime = Number.MAX_SAFE_INTEGER;
      await Promise.race([found, failed]);
    }
    return video.duration;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** A picture from within each of `clips` of the movie, by the second its clip starts at. */
function useMovieStills(blob: Blob, clips: readonly MovieClip[]) {
  const [stills, setStills] = useState<ReadonlyMap<number, string>>(new Map());
  const wanted = clips.map((clip) => `${clip.start}:${clip.end}`).join();
  // biome-ignore lint/correctness/useExhaustiveDependencies: `wanted` is `clips`, by value.
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    let live = true;
    void (async () => {
      const loaded = heard(video, "loadedmetadata");
      video.src = url;
      await loaded;
      if (!live || video.videoWidth === 0) return;
      if (!Number.isFinite(video.duration)) {
        // `MediaRecorder`'s WebM names no length: a seek past its end makes the browser find it.
        const found = heard(video, "seeked");
        video.currentTime = Number.MAX_SAFE_INTEGER;
        await found;
      }
      const canvas = document.createElement("canvas");
      canvas.height = STILL_HEIGHT;
      canvas.width = Math.round((STILL_HEIGHT * video.videoWidth) / video.videoHeight);
      for (const { start, end } of clips) {
        if (!live) return;
        const seeked = heard(video, "seeked");
        video.currentTime = start + insetOf(start, end);
        await seeked;
        if (!live) return;
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const still = canvas.toDataURL("image/jpeg");
        setStills((now) => new Map(now).set(start, still));
      }
    })();
    return () => {
      live = false;
      setStills(new Map());
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [blob, wanted]);
  return stills;
}

export interface QuickTimeClipStripProps {
  /** The movie the clips are parts of. */
  blob: Blob;
  /** Its length, in seconds. */
  length: number;
  /** Where it is split, in seconds, in order. */
  cuts: readonly number[];
  /** The playhead, in seconds. */
  at: number;
  /** The clips chosen, by their places in the strip, or all of them, for the Edit menu's commands. */
  chosen: readonly number[] | "all";
  /** A clip was clicked, with what the click held down; the playhead goes to its start. */
  onChoose: (index: number, seconds: number, keys: { toggle: boolean; extend: boolean }) => void;
  /** The clip at `from` was dragged to the gap `gap`, counted before the move. */
  onMove: (from: number, gap: number) => void;
  onDone: () => void;
  /** A clip as a file, when one dragged out of the strip can leave the movie. */
  clipFile?: (index: number) => DesktopDragItem | null;
  /** Movies of the drive were dropped on the strip, at the gap `gap`. */
  onDropMovies?: (items: DesktopDragItem[], gap: number) => void;
}

/**
 * View > Show Clips: the movie's clips in order, each as wide as it is long, with the playhead. A click
 * chooses a clip for the Edit menu, Command and Shift several; a drag puts one in another place, or,
 * out of the strip, gives it to what takes it (`clipFile`). A movie dropped on the strip joins it.
 */
export function QuickTimeClipStrip({
  blob,
  length,
  cuts,
  at,
  chosen,
  onChoose,
  onMove,
  onDone,
  clipFile,
  onDropMovies,
}: QuickTimeClipStripProps) {
  const clips = clipsOf(length, cuts);
  const stills = useMovieStills(blob, clips);
  const track = useRef<HTMLDivElement>(null);
  const pressed = useRef<{ from: number; x: number; dragging: boolean } | null>(null);
  // A drag ends in the click its release makes, which chooses nothing.
  const dragged = useRef(false);
  const [gap, setGap] = useState<number | null>(null);
  const gapAt = (x: number) => {
    const boxes = [...(track.current?.querySelectorAll("button") ?? [])].map((each) =>
      each.getBoundingClientRect(),
    );
    const past = boxes.findIndex((box) => x < box.left + box.width / 2);
    return past < 0 ? boxes.length : past;
  };
  const strip = useRef<HTMLDivElement>(null);
  const dropped = useRef(onDropMovies);
  dropped.current = onDropMovies;
  const gapNow = useRef(gapAt);
  gapNow.current = gapAt;
  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    return registerDropTarget({
      element,
      landing: (_hit, drag) => {
        const take = dropped.current;
        if (!take) return undefined;
        const taken = drag.items.filter((item) => item.kind === "file" && opensInQuickTime(item));
        return {
          element,
          copies: true,
          refusal: taken.length > 0 ? undefined : "Only movies can be added to a movie.",
          drop: () => take(taken, gapNow.current(drag.at?.x ?? Number.POSITIVE_INFINITY)),
        };
      },
    });
  }, []);
  return (
    <HudWindow
      ref={strip}
      aria-label="Clips"
      className="mac-quicktime-player-clips"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onDone();
      }}
    >
      <div className="mac-quicktime-player-clips-row">
        <div ref={track} className="mac-quicktime-player-clips-track">
          {clips.map((clip, index) => {
            const still = stills.get(clip.start);
            return (
              <button
                key={clip.start}
                type="button"
                className="mac-quicktime-player-clip"
                aria-label={`Clip ${index + 1} of ${clips.length}, ${timeText(clip.start)} to ${timeText(clip.end)}`}
                aria-pressed={chosen === "all" || chosen.includes(index)}
                data-still={still ? "" : undefined}
                style={{
                  flexGrow: clip.end - clip.start,
                  backgroundImage: still ? `url(${still})` : undefined,
                }}
                onClick={(event) => {
                  if (dragged.current) {
                    dragged.current = false;
                    return;
                  }
                  onChoose(index, clip.start, {
                    toggle: event.metaKey || event.ctrlKey,
                    extend: event.shiftKey,
                  });
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  pressed.current = { from: index, x: event.clientX, dragging: false };
                }}
                onPointerMove={(event) => {
                  const press = pressed.current;
                  if (!press) return;
                  const box = track.current?.getBoundingClientRect();
                  const out =
                    box &&
                    (event.clientY < box.top - LEAVES_AFTER ||
                      event.clientY > box.bottom + LEAVES_AFTER);
                  const file = out ? clipFile?.(press.from) : null;
                  if (file) {
                    pressed.current = null;
                    setGap(null);
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    beginDesktopDrag(event.nativeEvent, {
                      from: "quicktime-player",
                      items: () => [file],
                    });
                    return;
                  }
                  if (clips.length < 2) return;
                  if (Math.abs(event.clientX - press.x) >= DRAG_AFTER) press.dragging = true;
                  if (press.dragging) setGap(gapAt(event.clientX));
                }}
                onPointerUp={(event) => {
                  const press = pressed.current;
                  pressed.current = null;
                  setGap(null);
                  if (!press?.dragging) return;
                  dragged.current = true;
                  const to = gapAt(event.clientX);
                  if (to !== press.from && to !== press.from + 1) onMove(press.from, to);
                }}
                onPointerCancel={() => {
                  pressed.current = null;
                  setGap(null);
                }}
              />
            );
          })}
          {gap === null ? null : (
            <span
              className="mac-quicktime-player-clips-gap"
              style={{
                insetInlineStart: `${((clips[gap]?.start ?? length) / length) * 100}%`,
              }}
            />
          )}
          <span
            className="mac-quicktime-player-clips-playhead"
            style={{ insetInlineStart: `${(Math.min(at, length) / length) * 100}%` }}
          />
        </div>
        <PushButton onClick={onDone}>Done</PushButton>
      </div>
    </HudWindow>
  );
}
