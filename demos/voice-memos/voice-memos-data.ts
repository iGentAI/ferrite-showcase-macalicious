/**
 * The recordings of the Voice Memos demo. Everything is invented: no audio exists, and each
 * recording is an amplitude envelope computed from a seed with integer arithmetic alone, so
 * the server and every browser draw the same bars.
 */

/** One recording as the demo holds it. */
export interface VoiceMemosRecording {
  /** Identifies the recording in the list and in the selection. */
  id: string;
  /** The title: the window's title while the recording is shown. */
  title: string;
  /** When it was made, as the list writes it. */
  date: string;
  /** Length in seconds. */
  duration: number;
  /** The amplitude envelope, `SAMPLE_RATE` numbers from 0 to 1 for each second. */
  samples: readonly number[];
  /** What the envelope is computed from; a take that is resumed continues from it. */
  seed: number;
}

/** Samples of the envelope per second: 3.095 s and 3.065 s are whole numbers of them. */
export const SAMPLE_RATE = 200;

/**
 * The longest a new take gets: a take stops by itself there. At the 128 kbit/s it is recorded at, an
 * hour is 57.6 MB, under the 64 MiB the drive holds in a file (`DRIVE_FILE_BYTES`).
 */
export const MAX_DURATION = 3600;

/** What the drive holds in one file (`MAX_FILE_BYTES` of `ferrite-apps/desktop/src/apps/files/drive.rs`). */
export const DRIVE_FILE_BYTES = 64 * 1024 * 1024;

/** The whole minutes of mono 16-bit WAV at `sampleRate` that fit in a file of the drive, in seconds. */
export const longestWav = (sampleRate: number) =>
  Math.floor((DRIVE_FILE_BYTES - 44) / (2 * sampleRate) / 60) * 60;

/**
 * The longest recording Trim and Replace can save, in seconds. Both write WAV at the 44.1 kHz
 * Voice Memos decodes at, whatever the recording was.
 */
export const MAX_EDITED_DURATION = longestWav(44_100);

/** A number from 0 to 1 for a seed and a whole number, the same on every engine. */
function hash(seed: number, n: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(n + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** The hash, eased between whole numbers: a value that drifts. */
function drift(seed: number, x: number): number {
  const whole = Math.floor(x);
  const part = x - whole;
  const from = hash(seed, whole);
  return from + (hash(seed, whole + 1) - from) * part * part * (3 - 2 * part);
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Loudness over time as `[seconds, level]` corners, level from 0 (room tone) to 1. */
type Contour = readonly (readonly [number, number])[];

/** The level of a contour at a time, straight between its corners. */
function levelAt(contour: Contour, time: number): number {
  let [fromTime, fromLevel] = contour[0] ?? [0, 0];
  for (const [toTime, toLevel] of contour) {
    if (time < toTime) {
      const span = toTime - fromTime;
      return span > 0 ? fromLevel + ((toLevel - fromLevel) * (time - fromTime)) / span : toLevel;
    }
    fromTime = toTime;
    fromLevel = toLevel;
  }
  return fromLevel;
}

/**
 * Samples `from` to `to` (counted from the start of the recording) of the envelope of a seed:
 * room tone that never quite falls silent, and speech in syllables wherever the recording is
 * loud. Without a contour the loud stretches come and go by themselves, a phrase every second
 * or two.
 */
export function envelope(seed: number, from: number, to: number, contour?: Contour): number[] {
  const samples: number[] = [];
  for (let index = from; index < to; index++) {
    const time = index / SAMPLE_RATE;
    const grain = hash(seed + 2, Math.floor(time * 40));
    const loud = contour
      ? levelAt(contour, time)
      : clamp((drift(seed + 3, time * 0.7) - 0.32) / 0.25, 0, 1);
    const voice = loud * (0.3 + 0.7 * drift(seed + 1, time * 5.5)) * (0.7 + 0.3 * grain);
    samples.push(Math.round((0.055 + 0.02 * grain + 0.41 * voice) * 1000) / 1000);
  }
  return samples;
}

/** Minutes and seconds, `00:03`: the list's lengths and the waveform's labels. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(whole / 60))}:${pad(whole % 60)}`;
}

/** Minutes, seconds and hundredths, `00:03.09`: the large timer. Hundredths are cut, not rounded. */
export function formatTimer(seconds: number): string {
  const hundredths = Math.max(0, Math.floor(seconds * 100 + 1e-6));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatClock(hundredths / 100)}.${pad(hundredths % 100)}`;
}

/** The title Voice Memos gives a new recording: the first number of `base` not in use. */
export function nextTitle(
  recordings: readonly { title: string }[],
  base = "New Recording",
): string {
  const taken = new Set(recordings.map((recording) => recording.title));
  let title = base;
  for (let number = 2; taken.has(title); number++) title = `${base} ${number}`;
  return title;
}

/**
 * A recording to record into, at the head of a take: it holds the take's first sample, since
 * a recording of no length has nothing to show a position in.
 */
export function newRecording(recordings: readonly VoiceMemosRecording[]): VoiceMemosRecording {
  const title = nextTitle(recordings);
  let id = `take-${recordings.length + 1}`;
  for (let n = recordings.length + 2; recordings.some((recording) => recording.id === id); n++) {
    id = `take-${n}`;
  }
  const seed = 97 + recordings.length * 13;
  return {
    id,
    title,
    date: "Today",
    duration: 1 / SAMPLE_RATE,
    samples: envelope(seed, 0, 1),
    seed,
  };
}

/** A recording with `seconds` more of the take its seed describes, up to `MAX_DURATION`. */
export function extend(recording: VoiceMemosRecording, seconds: number): VoiceMemosRecording {
  const duration = Math.min(MAX_DURATION, recording.duration + Math.max(0, seconds));
  const count = Math.round(duration * SAMPLE_RATE);
  if (duration === recording.duration) return recording;
  return {
    ...recording,
    duration,
    samples:
      count > recording.samples.length
        ? recording.samples.concat(envelope(recording.seed, recording.samples.length, count))
        : recording.samples,
  };
}

function recording(
  id: string,
  title: string,
  date: string,
  duration: number,
  seed: number,
  contour?: Contour,
): VoiceMemosRecording {
  const samples = envelope(seed, 0, Math.round(duration * SAMPLE_RATE), contour);
  return { id, title, date, duration, samples, seed };
}

/**
 * The recordings the demo opens with, newest first. The two short ones are those of the
 * reference captures: their titles and lengths are the captures' (3.095 s reads `00:03.09`,
 * 3.065 s reads `00:03.06`), and their envelopes follow the captured outlines only roughly,
 * quiet, a burst of speech, quiet again. The rest are made up.
 */
export const defaultRecordings: readonly VoiceMemosRecording[] = [
  recording("new-recording-4", "New Recording 4", "Today", 3.065, 41, [
    [0, 0],
    [1.3, 0.05],
    [1.42, 0.85],
    [1.75, 0.6],
    [2.1, 0.8],
    [2.85, 0.75],
    [2.95, 0.05],
  ]),
  recording("new-recording-3", "New Recording 3", "Today", 3.095, 17, [
    [0, 0],
    [0.62, 0],
    [0.7, 0.9],
    [1.05, 1],
    [1.3, 0.7],
    [2.4, 0.75],
    [2.5, 0.08],
    [3.0, 0],
  ]),
  recording("workshop", "Ideas for the Workshop", "Yesterday", 47.3, 5),
  recording("rehearsal", "Rehearsal Room, Second Verse", "Tuesday", 138.4, 23),
  recording("new-recording-2", "New Recording 2", "28 Sep 2019", 12.6, 59),
  recording("new-recording", "New Recording", "14 Sep 2019", 8.2, 71),
];

/** The recording the demo opens on: the one of the Aqua capture. */
export const defaultRecordingId = "new-recording-3";
