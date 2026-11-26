/*
 * What the Movie Inspector says of a movie that a browser does not name: its container, from the type
 * the drive keeps or else its name, its size and its data rate, from its bytes and its length. Every
 * function is pure.
 */

import { formatDate } from "../finder/finder-data";

const BY_TYPE: Readonly<Record<string, string>> = {
  "video/webm": "WebM",
  "video/mp4": "MPEG-4",
  "video/x-m4v": "MPEG-4",
  "video/quicktime": "QuickTime",
  "video/ogg": "Ogg",
  "video/x-matroska": "Matroska",
  "audio/webm": "WebM audio",
  "audio/mp4": "MPEG-4 audio",
  "audio/x-m4a": "MPEG-4 audio",
  "audio/mpeg": "MP3",
  "audio/wav": "WAV",
  "audio/x-wav": "WAV",
  "audio/aiff": "AIFF",
  "audio/flac": "FLAC",
  "audio/ogg": "Ogg audio",
};
const BY_EXTENSION: Readonly<Record<string, string>> = {
  webm: "WebM",
  mp4: "MPEG-4",
  m4v: "MPEG-4",
  mov: "QuickTime",
  ogv: "Ogg",
  mkv: "Matroska",
  m4a: "MPEG-4 audio",
  mp3: "MP3",
  wav: "WAV",
  aif: "AIFF",
  aiff: "AIFF",
  flac: "FLAC",
};

/** The movie's container in words; "Unknown" when neither its type nor its name says. */
export function formatOf(type: string | undefined, name: string): string {
  const plain = (type ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";
  return BY_TYPE[plain] ?? BY_EXTENSION[extension] ?? "Unknown";
}

/** Bytes over a length in seconds, as the Inspector writes it: "7.91 Mbit/s", "128 kbit/s". */
export function dataRateText(bytes: number, seconds: number): string {
  if (!(seconds > 0)) return "Unknown";
  const bits = (bytes * 8) / seconds;
  return bits >= 1_000_000
    ? `${(bits / 1_000_000).toFixed(2)} Mbit/s`
    : `${Math.round(bits / 1000)} kbit/s`;
}

/** A moment in epoch milliseconds as Finder's list view writes it, in the page's time zone. */
export function modifiedText(at: number | undefined): string {
  if (at === undefined) return "--";
  const moment = new Date(at);
  const two = (value: number) => String(value).padStart(2, "0");
  return formatDate(
    `${moment.getFullYear()}-${two(moment.getMonth() + 1)}-${two(moment.getDate())} ${two(moment.getHours())}:${two(moment.getMinutes())}`,
  );
}
