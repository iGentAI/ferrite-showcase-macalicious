"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/*
 * The subtitles inside a movie file. A browser's `<video>` shows no text track of an MP4 or WebM it
 * plays, so this reads them from the file: tx3g and wvtt samples of an MP4's `moov` table, and
 * S_TEXT/UTF8, S_TEXT/WEBVTT and D_WEBVTT/SUBTITLES blocks of a WebM's clusters. A fragmented MP4
 * keeps its samples in `moof` boxes, which are not read, and an edit list does not shift the cues.
 */

export interface MovieCue {
  /** Seconds from the movie's start. */
  start: number;
  end: number;
  text: string;
}

export interface MovieTextTrack {
  /** The track's number in the file. */
  id: number;
  /** What the menu calls it: its name in the file, or its language's. */
  label: string;
  /** Its language as the file gives it: an ISO 639-2 or BCP 47 code, or "". */
  language: string;
  cues: readonly MovieCue[];
}

const MOST_CUES = 20_000;
/** Where a WebM's Tracks element is looked for: a muxer writes it before the first cluster. */
const WEBM_HEAD_BYTES = 16 * 1024 * 1024;
/** How long a WebM block with no duration of its own and no cue after it shows. */
const BLOCK_SECONDS = 5;

const fourcc = (bytes: DataView, at: number) =>
  String.fromCharCode(
    bytes.getUint8(at),
    bytes.getUint8(at + 1),
    bytes.getUint8(at + 2),
    bytes.getUint8(at + 3),
  );

const utf8 = new TextDecoder();

/** A range of a file, read when asked for: most of a movie's bytes are never needed. */
const view = async (file: Blob, start: number, end: number) =>
  new DataView(await file.slice(start, end).arrayBuffer());

/** The boxes directly inside a view: each one's type and the view of its payload. */
function boxesIn(bytes: DataView): { type: string; body: DataView }[] {
  const found: { type: string; body: DataView }[] = [];
  let at = 0;
  while (at + 8 <= bytes.byteLength) {
    let size = bytes.getUint32(at);
    let head = 8;
    if (size === 1) {
      if (at + 16 > bytes.byteLength) break;
      size = Number(bytes.getBigUint64(at + 8));
      head = 16;
    } else if (size === 0) size = bytes.byteLength - at;
    if (size < head || at + size > bytes.byteLength) break;
    found.push({
      type: fourcc(bytes, at + 4),
      body: new DataView(bytes.buffer, bytes.byteOffset + at + head, size - head),
    });
    at += size;
  }
  return found;
}

const child = (parent: DataView | undefined, type: string) =>
  parent && boxesIn(parent).find((box) => box.type === type)?.body;

/** The `moov` box of an MP4, found from the box headers alone. */
async function moovOf(file: Blob): Promise<DataView | null> {
  let at = 0;
  while (at + 8 <= file.size) {
    const head = await view(file, at, at + 16);
    let size = head.getUint32(0);
    let header = 8;
    if (size === 1 && head.byteLength >= 16) {
      size = Number(head.getBigUint64(8));
      header = 16;
    } else if (size === 0) size = file.size - at;
    if (size < header) return null;
    if (fourcc(head, 4) === "moov") return view(file, at + header, at + size);
    at += size;
  }
  return null;
}

interface Sample {
  offset: number;
  size: number;
  start: number;
  end: number;
}

/** Where and when a track's samples are, from its sample tables. */
function samplesOf(stbl: DataView, timescale: number): Sample[] {
  const [stts, stsc, stsz] = [child(stbl, "stts"), child(stbl, "stsc"), child(stbl, "stsz")];
  const [stco, co64] = [child(stbl, "stco"), child(stbl, "co64")];
  if (!stts || !stsc || !stsz || !(stco || co64)) return [];
  const fixed = stsz.getUint32(4);
  const count = Math.min(stsz.getUint32(8), MOST_CUES);
  const chunks = stco ? stco.getUint32(4) : (co64 as DataView).getUint32(4);
  const chunkAt = (index: number) =>
    stco ? stco.getUint32(8 + index * 4) : Number((co64 as DataView).getBigUint64(8 + index * 8));
  const samples: Sample[] = [];
  let sample = 0;
  let tick = 0;
  let timeEntry = 0;
  let timeLeft = stts.getUint32(4) > 0 ? stts.getUint32(8) : 0;
  const runs = stsc.getUint32(4);
  for (let run = 0; run < runs && sample < count; run += 1) {
    const first = stsc.getUint32(8 + run * 12) - 1;
    const each = stsc.getUint32(12 + run * 12);
    const last = run + 1 < runs ? stsc.getUint32(8 + (run + 1) * 12) - 1 : chunks;
    for (let chunk = first; chunk < last && sample < count; chunk += 1) {
      let offset = chunkAt(chunk);
      for (let n = 0; n < each && sample < count; n += 1, sample += 1) {
        const size = fixed || stsz.getUint32(12 + sample * 4);
        while (timeLeft === 0 && timeEntry + 1 < stts.getUint32(4)) {
          timeEntry += 1;
          timeLeft = stts.getUint32(8 + timeEntry * 8);
        }
        const delta = stts.getUint32(12 + timeEntry * 8);
        samples.push({
          offset,
          size,
          start: tick / timescale,
          end: (tick + delta) / timescale,
        });
        tick += delta;
        timeLeft -= 1;
        offset += size;
      }
    }
  }
  return samples;
}

/** A tx3g sample's text: a 16-bit length, then UTF-8 or, after a byte order mark, UTF-16. */
function tx3gText(sample: DataView): string {
  if (sample.byteLength < 2) return "";
  const length = Math.min(sample.getUint16(0), sample.byteLength - 2);
  const bytes = new Uint8Array(sample.buffer, sample.byteOffset + 2, length);
  return bytes[0] === 0xfe && bytes[1] === 0xff
    ? new TextDecoder("utf-16be").decode(bytes.subarray(2))
    : utf8.decode(bytes);
}

/** A wvtt sample's text: the `payl` of each `vttc`; `vtte` is a gap. */
const wvttText = (sample: DataView) =>
  boxesIn(sample)
    .filter((box) => box.type === "vttc")
    .map((box) => child(box.body, "payl"))
    .filter((payload): payload is DataView => payload !== undefined)
    .map((payload) =>
      utf8.decode(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)),
    )
    .join("\n");

/** An `mdhd`'s language: three letters of five bits each. */
function mp4Language(mdhd: DataView): string {
  const packed = mdhd.getUint16(mdhd.getUint8(0) === 1 ? 28 : 20);
  const letters = [(packed >> 10) & 31, (packed >> 5) & 31, packed & 31];
  const code = String.fromCharCode(...letters.map((each) => each + 0x60));
  return /^[a-z]{3}$/.test(code) ? code : "";
}

async function mp4Tracks(file: Blob): Promise<MovieTextTrack[]> {
  const moov = await moovOf(file);
  if (!moov) return [];
  const tracks: MovieTextTrack[] = [];
  for (const { type, body: trak } of boxesIn(moov)) {
    if (type !== "trak") continue;
    const mdia = child(trak, "mdia");
    const [mdhd, stbl] = [child(mdia, "mdhd"), child(child(mdia, "minf"), "stbl")];
    const stsd = child(stbl, "stsd");
    if (!mdhd || !stbl || !stsd || stsd.byteLength < 16) continue;
    const format = fourcc(stsd, 12);
    if (format !== "tx3g" && format !== "wvtt") continue;
    const timescale = mdhd.getUint32(mdhd.getUint8(0) === 1 ? 20 : 12);
    if (timescale === 0) continue;
    const cues: MovieCue[] = [];
    for (const sample of samplesOf(stbl, timescale)) {
      if (sample.size === 0) continue;
      const bytes = await view(file, sample.offset, sample.offset + sample.size);
      const text = format === "tx3g" ? tx3gText(bytes) : wvttText(bytes);
      if (text.trim()) cues.push({ start: sample.start, end: sample.end, text });
    }
    if (cues.length === 0) continue;
    const tkhd = child(trak, "tkhd");
    const id = tkhd ? tkhd.getUint32(tkhd.getUint8(0) === 1 ? 20 : 12) : tracks.length + 1;
    const language = mp4Language(mdhd);
    tracks.push({ id, language, label: "", cues });
  }
  return tracks;
}

/** An EBML number at `at`: how many bytes it takes, and its value with the length bit kept or not. */
function vint(bytes: DataView, at: number, keepMarker: boolean) {
  if (at >= bytes.byteLength) return null;
  const first = bytes.getUint8(at);
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length += 1;
  if (length > 8 || at + length > bytes.byteLength) return null;
  let value = keepMarker ? first : first & (0xff >> length);
  let unknown = (first & (0xff >> length)) === 0xff >> length;
  for (let i = 1; i < length; i += 1) {
    const next = bytes.getUint8(at + i);
    if (next !== 0xff) unknown = false;
    value = value * 256 + next;
  }
  return { length, value, unknown };
}

const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const TRACKS = 0x1654ae6b;
const CLUSTER = 0x1f43b675;
const TRACK_ENTRY = 0xae;
const BLOCK_GROUP = 0xa0;
/** Elements that hold others, and so end a cluster of unknown size when met at its level. */
const SEGMENT_LEVEL = new Set([CLUSTER, 0x1c53bb6b, 0x1254c367, INFO, TRACKS]);

interface Element {
  id: number;
  body: DataView;
  /** The body's end in the view it was read from. */
  end: number;
}

/** The elements inside a view. An element of unknown size runs to the next at its parent's level. */
function elementsIn(bytes: DataView): Element[] {
  const found: Element[] = [];
  let at = 0;
  while (at < bytes.byteLength) {
    const id = vint(bytes, at, true);
    if (!id) break;
    const size = vint(bytes, at + id.length, false);
    if (!size) break;
    const start = at + id.length + size.length;
    if (size.unknown && id.value === CLUSTER) {
      let end = start;
      while (end < bytes.byteLength) {
        const inner = vint(bytes, end, true);
        if (!inner || SEGMENT_LEVEL.has(inner.value)) break;
        const innerSize = vint(bytes, end + inner.length, false);
        if (!innerSize) break;
        end += inner.length + innerSize.length + innerSize.value;
      }
      end = Math.min(end, bytes.byteLength);
      found.push({
        id: id.value,
        body: new DataView(bytes.buffer, bytes.byteOffset + start, end - start),
        end,
      });
      at = end;
      continue;
    }
    const end = size.unknown ? bytes.byteLength : Math.min(start + size.value, bytes.byteLength);
    found.push({
      id: id.value,
      body: new DataView(bytes.buffer, bytes.byteOffset + start, end - start),
      end,
    });
    at = end;
  }
  return found;
}

const unsigned = (bytes: DataView) => {
  let value = 0;
  for (let i = 0; i < bytes.byteLength; i += 1) value = value * 256 + bytes.getUint8(i);
  return value;
};
const textOf = (bytes: DataView) =>
  utf8.decode(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)).replace(/\0+$/, "");

interface WebmText {
  number: number;
  codec: string;
  language: string;
  name: string;
  cues: MovieCue[];
}

/** The text of a WebM block: WebVTT's has its cue's identifier and settings on the first two lines. */
function blockText(codec: string, data: string): string {
  if (codec !== "D_WEBVTT/SUBTITLES") return data;
  return data.split("\n").slice(2).join("\n");
}

async function webmTracks(file: Blob): Promise<MovieTextTrack[]> {
  const head = elementsIn(await view(file, 0, WEBM_HEAD_BYTES));
  const segment = head.find((element) => element.id === SEGMENT);
  if (!segment) return [];
  const children = elementsIn(segment.body);
  const entries = children.find((element) => element.id === TRACKS);
  if (!entries) return [];
  const texts = new Map<number, WebmText>();
  for (const entry of elementsIn(entries.body)) {
    if (entry.id !== TRACK_ENTRY) continue;
    const fields = new Map(elementsIn(entry.body).map((field) => [field.id, field.body]));
    const read = (id: number) => fields.get(id);
    const number = read(0xd7);
    const kind = read(0x83);
    const codec = read(0x86);
    if (!number || !kind || !codec || unsigned(kind) !== 0x11) continue;
    const codecId = textOf(codec);
    if (!["S_TEXT/UTF8", "S_TEXT/WEBVTT", "D_WEBVTT/SUBTITLES"].includes(codecId)) continue;
    const bcp47 = read(0x22b59d);
    const language = read(0x22b59c);
    const name = read(0x536e);
    texts.set(unsigned(number), {
      number: unsigned(number),
      codec: codecId,
      language: textOf(bcp47 ?? language ?? new DataView(new ArrayBuffer(0))) || "eng",
      name: name ? textOf(name) : "",
      cues: [],
    });
  }
  if (texts.size === 0) return [];
  const whole = elementsIn(new DataView(await file.arrayBuffer())).find(
    (element) => element.id === SEGMENT,
  );
  if (!whole) return [];
  let scale = 1_000_000;
  const addBlock = (block: DataView, cluster: number, duration: number | null) => {
    const number = vint(block, 0, false);
    if (!number) return;
    const track = texts.get(number.value);
    if (!track || track.cues.length >= MOST_CUES) return;
    const start = (cluster + block.getInt16(number.length)) * (scale / 1e9);
    const data = new DataView(
      block.buffer,
      block.byteOffset + number.length + 3,
      block.byteLength - number.length - 3,
    );
    const text = blockText(track.codec, textOf(data));
    if (!text.trim()) return;
    const last = track.cues.at(-1);
    if (last && last.end === Number.POSITIVE_INFINITY) last.end = Math.max(last.start, start);
    track.cues.push({
      start,
      end: duration === null ? Number.POSITIVE_INFINITY : start + duration * (scale / 1e9),
      text,
    });
  };
  for (const element of elementsIn(whole.body)) {
    if (element.id === INFO) {
      const scaled = elementsIn(element.body).find((field) => field.id === 0x2ad7b1);
      if (scaled) scale = unsigned(scaled.body);
    } else if (element.id === CLUSTER) {
      let time = 0;
      for (const part of elementsIn(element.body)) {
        if (part.id === 0xe7) time = unsigned(part.body);
        else if (part.id === 0xa3) addBlock(part.body, time, null);
        else if (part.id === BLOCK_GROUP) {
          const fields = elementsIn(part.body);
          const block = fields.find((field) => field.id === 0xa1);
          const duration = fields.find((field) => field.id === 0x9b);
          if (block) addBlock(block.body, time, duration ? unsigned(duration.body) : null);
        }
      }
    }
  }
  return [...texts.values()]
    .filter((track) => track.cues.length > 0)
    .map(({ number, language, name, cues }) => ({
      id: number,
      language,
      label: name,
      cues: cues.map((cue) =>
        cue.end === Number.POSITIVE_INFINITY ? { ...cue, end: cue.start + BLOCK_SECONDS } : cue,
      ),
    }));
}

/** A track's language in words, in English as the rest of the desktop. */
function languageName(code: string): string {
  if (!code || code === "und") return "Unknown Language";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * The text tracks of an MP4 or WebM file, in the file's order, none for any other. A file that cannot
 * be read as what its first bytes say simply has none.
 */
export async function readTextTracks(file: Blob): Promise<MovieTextTrack[]> {
  const start = await view(file, 0, 12);
  if (start.byteLength < 8) return [];
  const tracks =
    start.getUint32(0) === 0x1a45dfa3
      ? await webmTracks(file)
      : fourcc(start, 4) === "ftyp"
        ? await mp4Tracks(file)
        : [];
  const labelled = tracks.map((track) => ({
    ...track,
    label: track.label || languageName(track.language),
  }));
  return labelled.map((track) =>
    labelled.filter((other) => other.label === track.label).length > 1 && !track.label.includes("#")
      ? { ...track, label: `${track.label} (Track ${track.id})` }
      : track,
  );
}

/** One of the audio tracks a browser exposes: Safari always, others behind a flag. */
export interface MovieAudioTrack {
  id: string;
  label: string;
  enabled: boolean;
}

interface BrowserAudioTrack {
  id: string;
  label: string;
  language: string;
  enabled: boolean;
}
interface BrowserAudioTrackList extends EventTarget {
  readonly length: number;
  [index: number]: BrowserAudioTrack;
}
const audioListOf = (video: HTMLVideoElement) =>
  (video as HTMLVideoElement & { audioTracks?: BrowserAudioTrackList }).audioTracks;

const audioRows = (list: BrowserAudioTrackList): MovieAudioTrack[] =>
  Array.from({ length: list.length }, (_, index) => {
    const track = list[index] as BrowserAudioTrack;
    return {
      id: String(index),
      label: track.label || (track.language ? languageName(track.language) : `Track ${index + 1}`),
      enabled: track.enabled,
    };
  });

/** Cue text is parsed for WebVTT's own tags, which a tx3g or plain line does not mean. */
const plainCue = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface MovieLanguages {
  textTracks: readonly MovieTextTrack[];
  /** The text track showing, or null for none. */
  showing: number | null;
  show: (id: number | null) => void;
  audioTracks: readonly MovieAudioTrack[];
  chooseAudio: (id: string) => void;
}

/**
 * What the movie's View menu rows act on: the file's text tracks handed to its `<video>` as cues of
 * its own text tracks, which the browser draws over the picture, and the audio tracks it exposes.
 */
export function useMovieLanguages(
  file: Blob | undefined,
  video: HTMLVideoElement | null,
): MovieLanguages {
  const [textTracks, setTextTracks] = useState<readonly MovieTextTrack[]>([]);
  const [showing, setShowing] = useState<number | null>(null);
  const [audioTracks, setAudioTracks] = useState<readonly MovieAudioTrack[]>([]);

  useEffect(() => {
    setTextTracks([]);
    setShowing(null);
    if (!file) return;
    let current = true;
    void readTextTracks(file).then(
      (tracks) => {
        if (current) setTextTracks(tracks);
      },
      () => {
        if (current) setTextTracks([]);
      },
    );
    return () => {
      current = false;
    };
  }, [file]);

  const cued = useMemo(() => new WeakMap<HTMLVideoElement, Map<number, TextTrack>>(), []);
  useEffect(() => {
    if (!video || typeof video.addTextTrack !== "function" || typeof VTTCue === "undefined") return;
    const held = cued.get(video) ?? new Map<number, TextTrack>();
    cued.set(video, held);
    for (const track of textTracks) {
      if (held.has(track.id)) continue;
      const added = video.addTextTrack("subtitles", track.label, track.language);
      for (const cue of track.cues)
        added.addCue(new VTTCue(cue.start, cue.end, plainCue(cue.text)));
      held.set(track.id, added);
    }
    for (const [id, added] of held) added.mode = id === showing ? "showing" : "disabled";
  }, [video, textTracks, showing, cued]);

  useEffect(() => {
    const list = video ? audioListOf(video) : undefined;
    if (!(list instanceof EventTarget)) {
      setAudioTracks([]);
      return;
    }
    const read = () => setAudioTracks(audioRows(list));
    read();
    list.addEventListener("addtrack", read);
    list.addEventListener("removetrack", read);
    list.addEventListener("change", read);
    return () => {
      list.removeEventListener("addtrack", read);
      list.removeEventListener("removetrack", read);
      list.removeEventListener("change", read);
    };
  }, [video]);

  const chooseAudio = useCallback(
    (id: string) => {
      const list = video ? audioListOf(video) : undefined;
      if (!list) return;
      for (let index = 0; index < list.length; index += 1) {
        (list[index] as BrowserAudioTrack).enabled = String(index) === id;
      }
    },
    [video],
  );

  return { textTracks, showing, show: setShowing, audioTracks, chooseAudio };
}
