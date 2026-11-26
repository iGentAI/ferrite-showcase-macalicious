/**
 * What the Voice Memos app does with sound, apart from the microphone and the drive: the recording
 * format a browser is asked for, the names and dates the list shows, the waveform's peaks of a
 * decoded recording, the maths of a trim, and the 16-bit PCM WAV file a trim (or a browser
 * without `MediaRecorder`) produces. Everything here but `decodeAudio` is pure.
 */

/**
 * The recording formats asked of `MediaRecorder`, best first. Ogg comes first because Firefox,
 * the one browser that records it, plays and seeks its own Ogg while its WebM has no duration and
 * cannot be seeked; Chromium records WebM, WebKit on the Mac MP4.
 */
export const RECORDING_TYPES: readonly string[] = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
];

/** The type a browser records without `MediaRecorder`: PCM from Web Audio, written as WAV. */
export const WAV_TYPE = "audio/wav";

/** The first of `RECORDING_TYPES` the browser records, or none (the recorder then picks). */
export function pickRecordingType(isSupported: (type: string) => boolean): string | undefined {
  for (const type of RECORDING_TYPES) {
    try {
      if (isSupported(type)) return type;
    } catch {
      // A browser that throws for a type does not record it.
    }
  }
  return undefined;
}

/** A media type without its parameters, in lowercase: `audio/webm;codecs=opus` is `audio/webm`. */
const baseType = (type: string) => (type.split(";")[0] ?? "").trim().toLowerCase();

/** The extension a recording of `type` is saved with, without the dot: webm, ogg, m4a or wav. */
export function extensionForType(type: string): string {
  switch (baseType(type)) {
    case "audio/ogg":
    case "application/ogg":
    case "audio/opus":
      return "ogg";
    case "audio/mp4":
    case "video/mp4":
    case "audio/x-m4a":
    case "audio/m4a":
    case "audio/aac":
      return "m4a";
    case "audio/wav":
    case "audio/wave":
    case "audio/x-wav":
      return "wav";
    case "audio/mpeg":
      return "mp3";
    default:
      return "webm";
  }
}

/** Where a file name's extension starts, or -1: a leading dot is part of the name. */
const dotOf = (name: string) => {
  const at = name.lastIndexOf(".");
  return at > 0 && at < name.length - 1 ? at : -1;
};

/** A recording's title: its file name without the extension. */
export function titleOf(name: string): string {
  const at = dotOf(name);
  return at < 0 ? name : name.slice(0, at);
}

/** A file name's extension with its dot, `.webm`, or `""`. Renaming keeps it. */
export function extensionOf(name: string): string {
  const at = dotOf(name);
  return at < 0 ? "" : name.slice(at);
}

/** Extensions of the audio files Voice Memos lists, beside files typed `audio/*`. */
const AUDIO_EXTENSIONS = new Set([
  ".aac",
  ".aif",
  ".aiff",
  ".caf",
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".oga",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
]);

/** Whether a file of the drive is a recording: typed as audio, or named like one. */
export function isAudioFile(file: { name: string; type?: string }): boolean {
  return (
    baseType(file.type ?? "").startsWith("audio/") ||
    AUDIO_EXTENSIONS.has(extensionOf(file.name).toLowerCase())
  );
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * When a recording was made, as the list writes it, in the browser's own time zone: "Today",
 * "Yesterday", the weekday within the last week, otherwise "28 Sep 2019". Written from fixed
 * English names, so every engine writes the same.
 */
export function formatMemoDate(ms: number, now: number): string {
  const then = new Date(ms);
  const today = new Date(now);
  const midnight = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((midnight(today) - midnight(then)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return WEEKDAYS[then.getDay()] ?? "";
  return `${then.getDate()} ${MONTHS[then.getMonth()]} ${then.getFullYear()}`;
}

/** Points of the waveform per second of sound: finer than the detailed view draws. */
export const PEAKS_PER_SECOND = 50;

/**
 * The level a quiet recording is drawn against: its peaks are scaled so that the loudest is at
 * full height, but never by more than this would, so silence stays low.
 */
const QUIETEST_FULL_SCALE = 0.25;

/** Peaks scaled so the loudest is 1 (see `QUIETEST_FULL_SCALE`), to three decimals. */
export function normalisePeaks(peaks: readonly number[]): number[] {
  let loudest = 0;
  for (const peak of peaks) if (peak > loudest) loudest = peak;
  const scale = 1 / Math.max(loudest, QUIETEST_FULL_SCALE);
  return peaks.map((peak) => Math.round(Math.min(1, peak * scale) * 1000) / 1000);
}

/**
 * The waveform of decoded sound: for each of `perSecond` stretches a second, the loudest sample
 * of any channel, normalised. A recording of no samples has no peaks.
 */
export function peaksOf(
  channels: readonly Float32Array[],
  sampleRate: number,
  perSecond: number = PEAKS_PER_SECOND,
): number[] {
  const length = channels[0]?.length ?? 0;
  if (length === 0 || !(sampleRate > 0)) return [];
  const stretch = sampleRate / perSecond;
  const count = Math.max(1, Math.ceil(length / stretch));
  const peaks: number[] = new Array(count).fill(0);
  for (let index = 0; index < count; index++) {
    const from = Math.floor(index * stretch);
    const to = Math.min(length, Math.floor((index + 1) * stretch));
    let loudest = 0;
    for (const channel of channels) {
      for (let at = from; at < to; at++) {
        const sample = Math.abs(channel[at] ?? 0);
        if (sample > loudest) loudest = sample;
      }
    }
    peaks[index] = loudest;
  }
  return normalisePeaks(peaks);
}

/** The level of one look at a microphone (an analyser's bytes, 128 being silence), 0 to 1. */
export function levelOf(bytes: ArrayLike<number>): number {
  let loudest = 0;
  for (let at = 0; at < bytes.length; at++) {
    const level = Math.abs((bytes[at] ?? 128) - 128) / 128;
    if (level > loudest) loudest = level;
  }
  return Math.min(1, loudest);
}

/** The shortest recording a trim leaves, in seconds. */
export const MIN_TRIM_SECONDS = 0.1;

/** The stretch of a recording a trim keeps, in seconds from its start. */
export interface TrimRange {
  start: number;
  end: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** The range with its start moved to `value`, no nearer the end than `MIN_TRIM_SECONDS`. */
export function moveTrimStart(range: TrimRange, value: number): TrimRange {
  return { ...range, start: clamp(value, 0, Math.max(0, range.end - MIN_TRIM_SECONDS)) };
}

/** The range with its end moved to `value`, within the recording, no nearer the start than
 * `MIN_TRIM_SECONDS`. */
export function moveTrimEnd(range: TrimRange, value: number, duration: number): TrimRange {
  return {
    ...range,
    end: clamp(value, Math.min(duration, range.start + MIN_TRIM_SECONDS), duration),
  };
}

/** Whether the range keeps the whole recording (to a hundredth of a second), so a trim would
 * change nothing. */
export function keepsWhole(range: TrimRange, duration: number): boolean {
  return range.start < 0.005 && range.end > duration - 0.005;
}

/** The samples `[from, to)` of a recording of `length` samples that a range keeps. */
export function sampleRange(
  range: TrimRange,
  sampleRate: number,
  length: number,
): [from: number, to: number] {
  const from = clamp(Math.round(range.start * sampleRate), 0, length);
  const to = clamp(Math.round(range.end * sampleRate), from, length);
  return [from, to];
}

/** The kept stretch of decoded sound, channel by channel, so a trim changes nothing but its length. */
export function cutChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  range: TrimRange,
): Float32Array[] {
  const [from, to] = sampleRange(range, sampleRate, channels[0]?.length ?? 0);
  return channels.map((channel) => channel.slice(from, to));
}

/** Decoded sound without a stretch of it: what comes before and after `range`, joined. */
export function removeRange(
  channels: readonly Float32Array[],
  sampleRate: number,
  range: TrimRange,
): Float32Array[] {
  const length = channels[0]?.length ?? 0;
  const [from, to] = sampleRange(range, sampleRate, length);
  return channels.map((channel) => {
    const rest = new Float32Array(length - (to - from));
    rest.set(channel.subarray(0, from));
    rest.set(channel.subarray(to), from);
    return rest;
  });
}

/**
 * `recording` with `take` written over it from `at` seconds on: what the take outlasts stays, and
 * a take that runs past the end makes the recording longer. A take at the end adds to it. With
 * unequal channel counts, a mono side is heard in every channel of the result.
 */
export function spliceChannels(
  recording: readonly Float32Array[],
  take: readonly Float32Array[],
  sampleRate: number,
  at: number,
): Float32Array[] {
  const length = recording[0]?.length ?? 0;
  const from = clamp(Math.round(at * sampleRate), 0, length);
  const total = Math.max(length, from + (take[0]?.length ?? 0));
  return Array.from({ length: Math.max(recording.length, take.length) }, (_, index) => {
    const joined = new Float32Array(total);
    joined.set(recording[index] ?? recording[0] ?? new Float32Array());
    joined.set(take[index] ?? take[0] ?? new Float32Array(), from);
    return joined;
  });
}

/** The waveform while a take is written over `peaks` from `at` seconds on. */
export function splicePeaks(
  peaks: readonly number[],
  take: readonly number[],
  at: number,
): number[] {
  const from = Math.round(at * PEAKS_PER_SECOND);
  return [...peaks.slice(0, from), ...take, ...peaks.slice(from + take.length)];
}

/** Samples from -1 to 1 as signed 16-bit integers, clipped. */
export function pcm16(samples: ArrayLike<number>): Int16Array<ArrayBuffer> {
  const out = new Int16Array(samples.length);
  for (let at = 0; at < samples.length; at++) {
    const sample = clamp(samples[at] ?? 0, -1, 1);
    out[at] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
  }
  return out;
}

/** The 44-byte header of a 16-bit PCM WAV file of `dataBytes` bytes of samples. */
export function wavHeader(dataBytes: number, sampleRate: number, channels = 1): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const text = (at: number, value: string) => {
    for (let index = 0; index < value.length; index++) {
      view.setUint8(at + index, value.charCodeAt(index));
    }
  };
  const rate = Math.round(sampleRate);
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // the size of the format chunk
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true); // bytes a second
  view.setUint16(32, channels * 2, true); // bytes a frame
  view.setUint16(34, 16, true); // bits a sample
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  return header;
}

/** A mono 16-bit PCM WAV file of `samples` (from -1 to 1) at `sampleRate`. */
export function encodeWav(samples: ArrayLike<number>, sampleRate: number): Uint8Array<ArrayBuffer> {
  return encodeWavChannels([samples], sampleRate);
}

/**
 * A 16-bit PCM WAV file of `channels` (each from -1 to 1, all of one length) at `sampleRate`,
 * their samples interleaved as WAV keeps them.
 */
export function encodeWavChannels(
  channels: readonly ArrayLike<number>[],
  sampleRate: number,
): Uint8Array<ArrayBuffer> {
  const count = Math.max(1, channels.length);
  const frames = channels[0]?.length ?? 0;
  const interleaved = new Float32Array(frames * count);
  channels.forEach((channel, index) => {
    for (let at = 0; at < frames; at++) interleaved[at * count + index] = channel[at] ?? 0;
  });
  const data = pcm16(interleaved);
  const file = new Uint8Array(44 + data.byteLength);
  file.set(new Uint8Array(wavHeader(data.byteLength, sampleRate, count)), 0);
  file.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), 44);
  return file;
}

/** Sound as Web Audio decodes it. */
export interface DecodedAudio {
  duration: number;
  sampleRate: number;
  channels: Float32Array[];
}

/** The rate recordings are decoded at, and so the rate of a trimmed recording. */
export const DECODE_RATE = 44_100;

/**
 * Decodes a recording with Web Audio (`decodeAudioData`). An offline context is used: it needs
 * no sound device, which a page may lack while a live context then never starts. Rejects when
 * the browser cannot decode the file.
 */
export function decodeAudio(blob: Blob): Promise<DecodedAudio> {
  const Offline =
    globalThis.OfflineAudioContext ??
    (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!Offline) return Promise.reject(new Error("This browser cannot decode audio."));
  return blob.arrayBuffer().then(
    (data) =>
      new Promise<DecodedAudio>((resolve, reject) => {
        const context = new Offline(1, 1, DECODE_RATE);
        let settled = false;
        const done = (buffer: AudioBuffer) => {
          if (settled) return;
          settled = true;
          const channels: Float32Array[] = [];
          for (let index = 0; index < buffer.numberOfChannels; index++) {
            channels.push(buffer.getChannelData(index));
          }
          resolve({ duration: buffer.duration, sampleRate: buffer.sampleRate, channels });
        };
        const fail = (error: unknown) => {
          if (settled) return;
          settled = true;
          reject(error instanceof Error ? error : new Error("The recording could not be decoded."));
        };
        // The callbacks serve engines whose decodeAudioData answers no promise; where it does,
        // the promise is followed too, so that its rejection is handled.
        const answer = context.decodeAudioData(data, done, fail) as
          | Promise<AudioBuffer>
          | undefined;
        answer?.then(done, fail);
      }),
  );
}
