/**
 * A WebM file from encoded frames: an EBML header, then a Segment of Info, Tracks, Cues and Clusters,
 * by the Matroska element IDs of https://www.matroska.org/technical/elements.html. The Cues stand
 * before the Clusters because the frames are all in hand, so the file seeks and knows its length
 * without being read to the end, which a `MediaRecorder` recording does not.
 */

export interface WebmFrame {
  /** 1 is the picture, 2 is the sound. */
  track: 1 | 2;
  /** Microseconds from the movie's start. */
  timestamp: number;
  key: boolean;
  data: Uint8Array;
}

export interface WebmTracks {
  video?: { codec: "V_VP9" | "V_VP8"; width: number; height: number };
  audio?: { sampleRate: number; channels: number; head: Uint8Array };
}

type Bytes = Uint8Array<ArrayBuffer>;

const CLUSTER_MS = 2000;
/** How far Opus's decoder must start before a place it is asked for, in nanoseconds, as WebM asks. */
const OPUS_PRE_ROLL_NS = 80_000_000;

const bytes = (...values: readonly number[]): Bytes => new Uint8Array(values);

function joined(parts: readonly Uint8Array[]): Bytes {
  const all = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    all.set(part, at);
    at += part.length;
  }
  return all;
}

/** An element's size: one byte when it fits, otherwise the eight-byte form. */
function size(length: number): Bytes {
  if (length < 0x7f) return bytes(0x80 | length);
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(length));
  out[0] = 0x01;
  return out;
}

const element = (id: readonly number[], ...content: readonly Uint8Array[]): Bytes => {
  const body = joined(content);
  return joined([bytes(...id), size(body.length), body]);
};

function uint(value: number): Bytes {
  const out: number[] = [];
  let rest = value;
  do {
    out.unshift(rest % 256);
    rest = Math.floor(rest / 256);
  } while (rest > 0);
  return bytes(...out);
}

function fixedUint(value: number): Bytes {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(value));
  return out;
}

function float(value: number): Bytes {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, value);
  return out;
}

const text = (value: string): Bytes => new TextEncoder().encode(value);

const HEADER = element(
  [0x1a, 0x45, 0xdf, 0xa3],
  element([0x42, 0x86], uint(1)),
  element([0x42, 0xf7], uint(1)),
  element([0x42, 0xf2], uint(4)),
  element([0x42, 0xf3], uint(8)),
  element([0x42, 0x82], text("webm")),
  element([0x42, 0x87], uint(4)),
  element([0x42, 0x85], uint(2)),
);

function tracksOf({ video, audio }: WebmTracks): Bytes {
  const entries: Bytes[] = [];
  if (video) {
    entries.push(
      element(
        [0xae],
        element([0xd7], uint(1)),
        element([0x73, 0xc5], uint(1)),
        element([0x83], uint(1)),
        element([0x86], text(video.codec)),
        element([0xe0], element([0xb0], uint(video.width)), element([0xba], uint(video.height))),
      ),
    );
  }
  if (audio) {
    const preSkip = new DataView(audio.head.buffer, audio.head.byteOffset).getUint16(10, true);
    entries.push(
      element(
        [0xae],
        element([0xd7], uint(2)),
        element([0x73, 0xc5], uint(2)),
        element([0x83], uint(2)),
        element([0x86], text("A_OPUS")),
        element([0x63, 0xa2], audio.head),
        element([0x56, 0xaa], uint(Math.round((preSkip * 1e9) / 48_000))),
        element([0x56, 0xbb], uint(OPUS_PRE_ROLL_NS)),
        element(
          [0xe1],
          element([0xb5], float(audio.sampleRate)),
          element([0x9f], uint(audio.channels)),
        ),
      ),
    );
  }
  return element([0x16, 0x54, 0xae, 0x6b], ...entries);
}

/** The frames as clusters, each opening on a key frame of the picture when the movie has one. */
function clustersOf(frames: readonly WebmFrame[], pictured: boolean) {
  const clusters: { ms: number; frames: WebmFrame[] }[] = [];
  for (const frame of frames) {
    const ms = Math.round(frame.timestamp / 1000);
    const last = clusters.at(-1);
    // A block's time is 16 bits from its cluster's, which a run without key frames must not outgrow.
    const due = !last || ms - last.ms >= CLUSTER_MS;
    const opens = pictured ? frame.track === 1 && frame.key : true;
    if (!last || (due && opens) || ms - last.ms > 30_000) clusters.push({ ms, frames: [frame] });
    else last.frames.push(frame);
  }
  return clusters;
}

const cluster = (ms: number, frames: readonly WebmFrame[]): Bytes =>
  element(
    [0x1f, 0x43, 0xb6, 0x75],
    element([0xe7], uint(ms)),
    ...frames.map((frame) => {
      const block = new Uint8Array(4);
      block[0] = 0x80 | frame.track;
      const view = new DataView(block.buffer);
      view.setInt16(1, Math.round(frame.timestamp / 1000) - ms);
      block[3] = frame.key ? 0x80 : 0;
      return element([0xa3], block, frame.data);
    }),
  );

/** The whole file, its frames in the order of their times. */
export function muxWebm(tracks: WebmTracks, frames: readonly WebmFrame[], seconds: number): Blob {
  const ordered = [...frames].sort(
    (a, b) => a.timestamp - b.timestamp || (a.track === b.track ? 0 : a.track - b.track),
  );
  const info = element(
    [0x15, 0x49, 0xa9, 0x66],
    element([0x2a, 0xd7, 0xb1], uint(1_000_000)),
    element([0x4d, 0x80], text("Macalicious")),
    element([0x57, 0x41], text("Macalicious")),
    element([0x44, 0x89], float(seconds * 1000)),
  );
  const tracksElement = tracksOf(tracks);
  const parts = clustersOf(ordered, tracks.video !== undefined).map((each) => ({
    ms: each.ms,
    bytes: cluster(each.ms, each.frames),
  }));
  const cueTrack = tracks.video ? 1 : 2;
  const cuesAt = (start: number) => {
    let at = start;
    return element(
      [0x1c, 0x53, 0xbb, 0x6b],
      ...parts.map((part) => {
        const cue = element(
          [0xbb],
          element([0xb3], fixedUint(part.ms)),
          element([0xb7], element([0xf7], uint(cueTrack)), element([0xf1], fixedUint(at))),
        );
        at += part.bytes.length;
        return cue;
      }),
    );
  };
  const before = info.length + tracksElement.length;
  // Every position takes eight bytes, so the Cues are as long whatever they say.
  const cues = cuesAt(before + cuesAt(0).length);
  const body = before + cues.length + parts.reduce((sum, part) => sum + part.bytes.length, 0);
  const segmentSize = new Uint8Array(8);
  new DataView(segmentSize.buffer).setBigUint64(0, BigInt(body));
  segmentSize[0] = 0x01;
  return new Blob(
    [
      HEADER,
      bytes(0x18, 0x53, 0x80, 0x67),
      segmentSize,
      info,
      tracksElement,
      cues,
      ...parts.map((part) => part.bytes),
    ],
    { type: tracks.video ? "video/webm" : "audio/webm" },
  );
}
