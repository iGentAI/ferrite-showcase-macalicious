/*
 * The playback model of the QuickTime Player demo: a position on a timeline of frames, moved
 * by a transport. It is pure: every function returns a new clock and nothing reads the time.
 * The component owns the timer and tells the clock how many seconds have passed.
 */

/** The transport of a movie. */
export interface QuickTimePlayerClock {
  /** The playhead, in frames from the start: 0 to `duration`. Fractional between two frames. */
  position: number;
  /** The movie's length, in frames. */
  duration: number;
  /** Frames in a second: the timebase of the time code. A whole number of at least 1. */
  frameRate: number;
  /** Whether the movie is moving: playing, fast-forwarding or rewinding. */
  playing: boolean;
  /**
   * How fast it moves, in multiples of normal speed: 1 while playing normally, one of
   * `SCAN_RATES` while fast-forwarding and its negative while rewinding.
   */
  rate: number;
}

/** The speeds the rewind and fast-forward buttons step through, as QuickTime Player's do. */
export const SCAN_RATES = [2, 5, 10, 30, 60] as const;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** A whole timebase of at least one frame a second, whatever is given. */
const timebase = (frameRate: number) =>
  Number.isFinite(frameRate) ? Math.max(1, Math.round(frameRate)) : 30;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * A position as a time code, `HH:MM:SS:FF`: hours, minutes, seconds and the frame within the
 * second. 5892 frames at 30 frames a second are `00:03:16:12`.
 */
export function formatTimecode(frames: number, frameRate: number): string {
  const base = timebase(frameRate);
  const whole = Math.max(0, Math.floor(Number.isFinite(frames) ? frames : 0));
  const seconds = Math.floor(whole / base);
  return [
    pad(Math.floor(seconds / 3600)),
    pad(Math.floor(seconds / 60) % 60),
    pad(seconds % 60),
    pad(whole % base),
  ].join(":");
}

/**
 * The frames a time code stands for: `HH:MM:SS:FF`, or the shorter `MM:SS:FF`, `SS:FF` and
 * `FF`. `undefined` for anything else.
 */
export function parseTimecode(text: string, frameRate: number): number | undefined {
  if (!/^\d+(:\d+){0,3}$/.test(text.trim())) return undefined;
  const parts = text.trim().split(":").map(Number);
  const frames = parts.pop() ?? 0;
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  return seconds * timebase(frameRate) + frames;
}

/** A number of frames, or a time code, as frames: what the component's props accept. */
export function toFrames(value: number | string, frameRate: number): number {
  const frames = typeof value === "number" ? value : parseTimecode(value, frameRate);
  return frames !== undefined && Number.isFinite(frames) ? Math.max(0, frames) : 0;
}

/** A clock at `position` of a movie of `duration` frames; paused unless `playing`. */
export function createClock({
  duration,
  position = 0,
  frameRate = 30,
  playing = false,
}: {
  duration: number;
  position?: number;
  frameRate?: number;
  playing?: boolean;
}): QuickTimePlayerClock {
  const length = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const start = clamp(Number.isFinite(position) ? position : 0, 0, length);
  return {
    position: start,
    duration: length,
    frameRate: timebase(frameRate),
    // A movie that opens at its end has nothing left to play.
    playing: playing && start < length,
    rate: 1,
  };
}

/** Whether the playhead is on the last frame's far edge: nothing is left to play. */
export const atEnd = (clock: QuickTimePlayerClock) => clock.position >= clock.duration;

/** Whether the movie is fast-forwarding or rewinding. */
export const isScanning = (clock: QuickTimePlayerClock) => clock.playing && clock.rate !== 1;

/** Stop where the playhead is. */
export function pause(clock: QuickTimePlayerClock): QuickTimePlayerClock {
  return clock.playing || clock.rate !== 1 ? { ...clock, playing: false, rate: 1 } : clock;
}

/** Play at normal speed. A movie that has ended starts again from its first frame. */
export function play(clock: QuickTimePlayerClock): QuickTimePlayerClock {
  if (clock.duration <= 0) return pause(clock);
  return { ...clock, position: atEnd(clock) ? 0 : clock.position, playing: true, rate: 1 };
}

/**
 * What the play button does: pause a movie playing at normal speed, bring one that is
 * fast-forwarding or rewinding back to normal speed, and play one that is paused.
 */
export function togglePlaying(clock: QuickTimePlayerClock): QuickTimePlayerClock {
  return clock.playing && clock.rate === 1 ? pause(clock) : play(clock);
}

/** The speed after `current` in the direction of `sign`: 2 first, then up, and round again. */
function nextRate(current: number, sign: 1 | -1): number {
  const index = SCAN_RATES.indexOf((current * sign) as (typeof SCAN_RATES)[number]);
  return sign * (SCAN_RATES[(index + 1) % SCAN_RATES.length] ?? SCAN_RATES[0]);
}

/**
 * What the fast-forward button does: 2x at first, and with every further press 5x, 10x, 30x,
 * 60x and 2x again. A paused movie starts moving. Nothing happens at the end.
 */
export function fastForward(clock: QuickTimePlayerClock): QuickTimePlayerClock {
  if (atEnd(clock)) return clock;
  return { ...clock, playing: true, rate: nextRate(clock.playing ? clock.rate : 1, 1) };
}

/**
 * What the rewind button does: backwards at 2x at first, and with every further press 5x, 10x,
 * 30x, 60x and 2x again. A paused movie starts moving. Nothing happens at the start.
 */
export function rewind(clock: QuickTimePlayerClock): QuickTimePlayerClock {
  if (clock.position <= 0) return clock;
  return { ...clock, playing: true, rate: nextRate(clock.playing ? clock.rate : 1, -1) };
}

/** Move the playhead to a frame, as the scrubber does. Playback goes on from there. */
export function seek(clock: QuickTimePlayerClock, position: number): QuickTimePlayerClock {
  if (!Number.isFinite(position)) return clock;
  const next = clamp(position, 0, clock.duration);
  return next === clock.position ? clock : { ...clock, position: next };
}

/** Pause and move by whole frames from the frame shown: the arrow keys of a paused movie. */
export function step(clock: QuickTimePlayerClock, frames: number): QuickTimePlayerClock {
  return seek(pause(clock), Math.floor(clock.position) + frames);
}

/**
 * The clock after `seconds` of real time. A paused clock does not move. Playback stops, back
 * at normal speed, when it reaches the end, and a rewind stops when it reaches the start.
 */
export function advance(clock: QuickTimePlayerClock, seconds: number): QuickTimePlayerClock {
  if (!clock.playing || !(seconds > 0)) return clock;
  // Rounded to a millionth of a frame, so that ticks of a whole frame add up to whole frames.
  const moved = clock.position + clock.rate * seconds * clock.frameRate;
  const position = Math.round(moved * 1e6) / 1e6;
  if (position >= clock.duration) {
    return { ...clock, position: clock.duration, playing: false, rate: 1 };
  }
  if (position <= 0) return { ...clock, position: 0, playing: false, rate: 1 };
  return { ...clock, position };
}

/** The playhead as a time code. */
export const elapsedTimecode = (clock: QuickTimePlayerClock) =>
  formatTimecode(clock.position, clock.frameRate);

/** The movie's length as a time code. */
export const durationTimecode = (clock: QuickTimePlayerClock) =>
  formatTimecode(clock.duration, clock.frameRate);
