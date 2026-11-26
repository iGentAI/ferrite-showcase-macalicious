/** What the File menu's three New … Recording rows record. */
export type RecordingKind = "movie" | "audio" | "screen";

export const RECORDING_TITLES: Record<RecordingKind, string> = {
  movie: "Movie Recording",
  audio: "Audio Recording",
  screen: "Screen Recording",
};

/** The frame of a recording window, in points. */
export const RECORDING_SIZES: Record<RecordingKind, { width: number; height: number }> = {
  movie: { width: 640, height: 420 },
  audio: { width: 420, height: 130 },
  screen: { width: 420, height: 130 },
};

/** What the Options menu's Quality rows ask of the recorder, in bits per second. */
export const QUALITY_BITS = { high: 2_500_000, maximum: 8_000_000 } as const;
export type RecordingQuality = keyof typeof QUALITY_BITS;

/*
 * WebM comes first: Chromium builds without H.264 (the bundled Playwright one, for example) play
 * it, and Safari, which records no WebM, falls through to MP4.
 */
const VIDEO_TYPES = [
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
  "video/mp4",
];
const AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** The first type the browser records for `kind`, or undefined to leave it to the browser. */
export function recordingType(
  kind: RecordingKind,
  supports: (type: string) => boolean,
): string | undefined {
  return (kind === "audio" ? AUDIO_TYPES : VIDEO_TYPES).find(supports);
}

/** A media type without its parameters, as the drive keeps it. */
export const plainType = (type: string) => (type.split(";")[0] ?? "").trim();

const extensionOf = (type: string) => {
  const plain = plainType(type);
  if (plain === "video/mp4") return "mp4";
  if (plain === "audio/mp4") return "m4a";
  if (plain === "audio/ogg") return "ogg";
  return "webm";
};

/** A take's file name, as macOS names a screen recording: "Movie Recording 2026-11-01 at 10.15.30.webm". */
export function recordingName(kind: RecordingKind, type: string, at: Date): string {
  const two = (value: number) => String(value).padStart(2, "0");
  const day = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
  const time = `${two(at.getHours())}.${two(at.getMinutes())}.${two(at.getSeconds())}`;
  return `${RECORDING_TITLES[kind]} ${day} at ${time}.${extensionOf(type)}`;
}

/** A movie's name with `suffix` after its stem, in the format `type` is: "Harbour edited.webm". */
export function derivedName(name: string, suffix: string, type: string): string {
  const stem = name.replace(/\.[^.]+$/, "");
  const kept = stem.endsWith(` ${suffix}`) ? stem : `${stem} ${suffix}`;
  return `${kept}.${extensionOf(type)}`;
}

/** Whether a file called `name` says its bytes are of the format `type`. */
export const nameFitsType = (name: string, type: string) =>
  name.toLowerCase().endsWith(`.${extensionOf(type)}`);

/** The name `stem` in the format `type` is. */
export const nameInType = (stem: string, type: string) => `${stem}.${extensionOf(type)}`;

/** A length in seconds as the windows show it: 1:02:03, or 2:03. */
export function timeText(seconds: number): string {
  const whole = Math.round(seconds);
  const two = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  return hours > 0
    ? `${hours}:${two(minutes)}:${two(whole % 60)}`
    : `${minutes}:${two(whole % 60)}`;
}

/** The sentence for a refused camera, microphone or screen, by the name the browser gives it. */
export function recordingProblem(kind: RecordingKind, error: unknown): string {
  const device =
    kind === "movie" ? "the camera and microphone" : kind === "audio" ? "the microphone" : null;
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return device
      ? `QuickTime Player is not allowed to use ${device}. Allow it in the browser's settings for this site, then try again.`
      : "The screen recording was cancelled, or the browser does not allow it.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return kind === "movie"
      ? "No camera is connected."
      : kind === "audio"
        ? "No microphone is connected."
        : "This browser has no screen to record.";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "The recording could not be started. Another application may be using the device.";
  }
  const detail = error instanceof Error && error.message ? `: ${error.message}` : ".";
  return `The recording could not be started${detail}`;
}
