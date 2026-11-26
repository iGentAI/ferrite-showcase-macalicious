/*
 * File > Convert: a song written anew. A browser decodes every format it plays; WAV (samples and a
 * header) any page can write, and AAC and MP3 where the browser's WebCodecs `AudioEncoder` has
 * them, which depends on the browser and the platform. An AAC version is an M4A: the one track and
 * the boxes a player needs to find its frames.
 */

export type LossyFormat = "aac" | "mp3";

const ENCODINGS: Record<
  LossyFormat,
  { codec: string; bitrate: number; title: string; extension: string; type: string }
> = {
  aac: { codec: "mp4a.40.2", bitrate: 256_000, title: "AAC", extension: "m4a", type: "audio/mp4" },
  mp3: { codec: "mp3", bitrate: 192_000, title: "MP3", extension: "mp3", type: "audio/mpeg" },
};

/** The samples of an AAC frame. */
const AAC_FRAME_SAMPLES = 1024;
/** How many channels a version keeps: AudioEncoder's AAC and MP3 are asked for stereo at most. */
const MAX_CHANNELS = 2;
const SAMPLE_RATE = 44_100;
/**
 * Silence after an MP3's sound: WebKit's encoder keeps the last frames it holds at `flush()`, which
 * was 0.13 s of a 3 s song, so what it keeps is silence.
 */
const MP3_TAIL_SAMPLES = 6_912;

/** Why a Create Version row is dimmed. */
export const noEncoder = (format: LossyFormat) =>
  `This browser's AudioEncoder has no ${ENCODINGS[format].title} encoder for a page: Music writes WAV here.`;

/** Whether this browser encodes `format`; asks the browser, which alone can say. */
export async function hasEncoder(format: LossyFormat): Promise<boolean> {
  if (typeof AudioEncoder === "undefined") return false;
  const { codec, bitrate } = ENCODINGS[format];
  try {
    const { supported } = await AudioEncoder.isConfigSupported({
      codec,
      bitrate,
      sampleRate: SAMPLE_RATE,
      numberOfChannels: MAX_CHANNELS,
    });
    return supported === true;
  } catch {
    return false;
  }
}

interface Encoded {
  frames: Uint8Array[];
  /** What the decoder needs first: an AAC's AudioSpecificConfig. */
  description: Uint8Array | null;
}

/** `channels` through the browser's encoder, a second of sound at a time. */
async function encode(
  channels: readonly Float32Array[],
  sampleRate: number,
  format: LossyFormat,
): Promise<Encoded> {
  const frames: Uint8Array[] = [];
  let description: Uint8Array | null = null;
  let failure: unknown = null;
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      frames.push(bytes);
      const given = metadata?.decoderConfig?.description;
      if (given && !description) {
        description = ArrayBuffer.isView(given)
          ? new Uint8Array(
              given.buffer.slice(given.byteOffset, given.byteOffset + given.byteLength),
            )
          : new Uint8Array(given.slice(0));
      }
    },
    error: (error) => {
      failure = error;
    },
  });
  const { codec, bitrate } = ENCODINGS[format];
  encoder.configure({ codec, bitrate, sampleRate, numberOfChannels: channels.length });
  const count = channels[0]?.length ?? 0;
  for (let at = 0; at < count && !failure; at += sampleRate) {
    const length = Math.min(sampleRate, count - at);
    const planes = new Float32Array(length * channels.length);
    channels.forEach((channel, index) => {
      planes.set(channel.subarray(at, at + length), index * length);
    });
    const data = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: length,
      numberOfChannels: channels.length,
      timestamp: Math.round((at / sampleRate) * 1_000_000),
      data: planes,
    });
    encoder.encode(data);
    data.close();
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  return { frames, description };
}

const text4 = (name: string) => Uint8Array.from(name, (each) => each.charCodeAt(0));

function joined(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const boxOf = (name: string, parts: readonly Uint8Array[]) => {
  const body = joined(parts);
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(text4(name), 4);
  out.set(body, 8);
  return out;
};

const box = (name: string, ...parts: readonly Uint8Array[]) => boxOf(name, parts);

const u32List = (values: readonly number[]) => {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((value, index) => {
    view.setUint32(index * 4, value);
  });
  return out;
};

const u32s = (...values: readonly number[]) => u32List(values);

const u16s = (...values: readonly number[]) => {
  const out = new Uint8Array(values.length * 2);
  const view = new DataView(out.buffer);
  values.forEach((value, index) => {
    view.setUint16(index * 2, value);
  });
  return out;
};

/** A 16.16 identity matrix, as `mvhd` and `tkhd` hold it. */
const MATRIX = u32s(0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000);

/** An MPEG-4 descriptor: its tag, its length in the four-byte form, its body. */
const descriptor = (tag: number, ...parts: readonly Uint8Array[]) => {
  const body = joined(parts);
  const { length } = body;
  return joined([
    Uint8Array.of(
      tag,
      0x80 | ((length >> 21) & 0x7f),
      0x80 | ((length >> 14) & 0x7f),
      0x80 | ((length >> 7) & 0x7f),
      length & 0x7f,
    ),
    body,
  ]);
};

/** AAC frames, in order, as an M4A file. The frames are written after the boxes that index them. */
export function m4aBytes(
  frames: readonly Uint8Array[],
  description: Uint8Array,
  sampleRate: number,
  channelCount: number,
  bitrate: number = ENCODINGS.aac.bitrate,
): Uint8Array {
  const samples = frames.length * AAC_FRAME_SAMPLES;
  const movie = (firstFrameAt: number) => {
    const esds = box(
      "esds",
      u32s(0),
      descriptor(
        3,
        u16s(1),
        Uint8Array.of(0),
        descriptor(
          4,
          Uint8Array.of(0x40, 0x15, 0, 0, 0),
          u32s(bitrate, bitrate),
          descriptor(5, description),
        ),
        descriptor(6, Uint8Array.of(2)),
      ),
    );
    const entry = box(
      "mp4a",
      new Uint8Array(6),
      u16s(1),
      new Uint8Array(8),
      u16s(channelCount, 16, 0, 0),
      u32s(sampleRate * 0x10000),
      esds,
    );
    const table = box(
      "stbl",
      box("stsd", u32s(0, 1), entry),
      box("stts", u32s(0, 1, frames.length, AAC_FRAME_SAMPLES)),
      box("stsc", u32s(0, 1, 1, frames.length, 1)),
      box("stsz", u32s(0, 0, frames.length), u32List(frames.map((frame) => frame.length))),
      box("stco", u32s(0, 1, firstFrameAt)),
    );
    const location = box("url ", u32s(1));
    return box(
      "moov",
      box(
        "mvhd",
        u32s(0, 0, 0, sampleRate, samples, 0x10000),
        u16s(0x100, 0),
        new Uint8Array(8),
        MATRIX,
        new Uint8Array(24),
        u32s(2),
      ),
      box(
        "trak",
        box(
          "tkhd",
          u32s(7, 0, 0, 1, 0, samples),
          new Uint8Array(8),
          u16s(0, 0, 0x100, 0),
          MATRIX,
          u32s(0, 0),
        ),
        box(
          "mdia",
          box("mdhd", u32s(0, 0, 0, sampleRate, samples), u16s(0x55c4, 0)),
          box("hdlr", u32s(0, 0), text4("soun"), new Uint8Array(12), Uint8Array.of(0)),
          box(
            "minf",
            box("smhd", u32s(0, 0)),
            box("dinf", box("dref", u32s(0, 1), location)),
            table,
          ),
        ),
      ),
    );
  };
  const type = box("ftyp", text4("M4A "), u32s(0), text4("M4A "), text4("mp42"), text4("isom"));
  const size = type.length + movie(0).length + 8;
  return joined([type, movie(size), boxOf("mdat", frames)]);
}

/** The sound of `blob` as a file of `format` named after `name`. Rejects when it cannot be done. */
export async function lossyVersion(blob: Blob, name: string, format: LossyFormat): Promise<File> {
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const sound = await context.decodeAudioData(await blob.arrayBuffer());
  const channels = Array.from(
    { length: Math.min(sound.numberOfChannels, MAX_CHANNELS) },
    (_, index) => {
      const samples = sound.getChannelData(index);
      if (format !== "mp3") return samples;
      const padded = new Float32Array(samples.length + MP3_TAIL_SAMPLES);
      padded.set(samples);
      return padded;
    },
  );
  const { frames, description } = await encode(channels, sound.sampleRate, format);
  if (frames.length === 0) throw new Error("the encoder gave back no sound");
  const { extension, type } = ENCODINGS[format];
  let bytes: Uint8Array;
  if (format === "mp3") bytes = joined(frames);
  else if (description) bytes = m4aBytes(frames, description, sound.sampleRate, channels.length);
  else throw new Error("the encoder did not describe its AAC");
  return new File([bytes as BlobPart], versionName(name, extension), { type });
}

/** The samples of `channels`, each -1 to 1 and of the same length, as a 16-bit PCM WAV file. */
export function wavBytes(channels: readonly Float32Array[], sampleRate: number): Uint8Array {
  const count = channels[0]?.length ?? 0;
  const blockAlign = channels.length * 2;
  const dataBytes = count * blockAlign;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const tag = (at: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(at + index, text.charCodeAt(index));
    }
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let frame = 0; frame < count; frame += 1) {
    channels.forEach((channel, index) => {
      const sample = Math.max(-1, Math.min(1, channel[frame] ?? 0));
      view.setInt16(
        44 + frame * blockAlign + index * 2,
        Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff),
        true,
      );
    });
  }
  return out;
}

/** The name of a song's version: its file's own name with the extension changed. */
export const versionName = (name: string, extension: string): string =>
  `${name.replace(/\.[^./]+$/, "")}.${extension}`;

export const wavName = (name: string): string => versionName(name, "wav");

/** The sound of `blob` as a WAV file called `name`. Rejects when the browser cannot decode it. */
export async function wavOfSong(blob: Blob, name: string): Promise<File> {
  const context = new OfflineAudioContext(1, 1, 44_100);
  const sound = await context.decodeAudioData(await blob.arrayBuffer());
  const channels = Array.from({ length: sound.numberOfChannels }, (_, index) =>
    sound.getChannelData(index),
  );
  return new File([wavBytes(channels, sound.sampleRate) as BlobPart], wavName(name), {
    type: "audio/wav",
  });
}

/** A stream's address as Music keeps it, or `null` when it is no web address. */
export function streamAddress(typed: string): string | null {
  try {
    const url = new URL(typed.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && url.href.length <= 2000
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** What a stream is listed as: the last part of its address, or its host. */
export function streamTitle(address: string): string {
  const url = new URL(address);
  const last = url.pathname.split("/").filter(Boolean).at(-1);
  if (!last) return url.host;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}
