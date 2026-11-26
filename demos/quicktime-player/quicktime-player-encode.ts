/**
 * Movie edits through the browser's own encoders (WebCodecs), where it has them for WebM. Every frame
 * is taken from the source at its exact place and every sample of sound from the decoded file, so the
 * result does not depend on how the machine kept up, unlike a replay through `MediaRecorder`
 * (`quicktime-player-replay.ts`), which is what a browser without them gets.
 */
import {
  editedSize,
  type MovieEdit,
  type MoviePiece,
  moviePainter,
} from "./quicktime-player-picture";
import { muxWebm, type WebmFrame, type WebmTracks } from "./quicktime-player-webm";

const FRAMES_PER_SECOND = 30;
const KEY_FRAME_EVERY = FRAMES_PER_SECOND * 2;
const SAMPLE_RATE = 48_000;
const SOUND_BLOCK = 4800;
const BUSY_QUEUE = 4;
/** Past this the sound alone would hold over a gigabyte of the page's memory while it is encoded. */
const LONGEST_SECONDS = 45 * 60;
/** Bits for each pixel of each frame: a plain picture takes less, and busy noise stays clean. */
const BITS_PER_PIXEL = 0.15;

const waitFor = (element: HTMLMediaElement, event: string) =>
  new Promise<void>((resolve) => {
    element.addEventListener(event, () => resolve(), { once: true });
  });

async function videoCodec(size: { width: number; height: number }) {
  const base = {
    ...size,
    framerate: FRAMES_PER_SECOND,
    bitrate: Math.round(size.width * size.height * FRAMES_PER_SECOND * BITS_PER_PIXEL),
  };
  for (const [codec, name] of [
    ["vp09.00.51.08", "V_VP9"],
    ["vp8", "V_VP8"],
  ] as const) {
    const config = { ...base, codec };
    const { supported } = await VideoEncoder.isConfigSupported(config).catch(() => ({
      supported: false,
    }));
    if (supported) return { config, name };
  }
  return null;
}

/** Whether a movie the sound could not be decoded from has any: then its sound must not be lost. */
async function holdsSound(video: HTMLVideoElement): Promise<boolean> {
  const element = video as HTMLVideoElement & {
    mozHasAudio?: boolean;
    audioTracks?: { length: number };
    webkitAudioDecodedByteCount?: number;
  };
  if (element.mozHasAudio !== undefined) return element.mozHasAudio;
  if (element.audioTracks) return element.audioTracks.length > 0;
  if (element.webkitAudioDecodedByteCount === undefined) return true;
  await video.play().catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 300));
  video.pause();
  return element.webkitAudioDecodedByteCount > 0;
}

/** A stand-in head for an encoder that gives none: two channels or one, no samples to skip. */
function opusHead(channels: number, sampleRate: number): Uint8Array<ArrayBuffer> {
  const head = new Uint8Array(19);
  head.set(new TextEncoder().encode("OpusHead"));
  const view = new DataView(head.buffer);
  head[8] = 1;
  head[9] = channels;
  view.setUint32(12, sampleRate, true);
  return head;
}

/**
 * Encodes the stretches into a WebM file. Answers `null`, having done nothing to the movie, when this
 * browser or this movie is for the replay to do: no encoder for WebM, sound it cannot decode apart from
 * the picture, or a length past `LONGEST_SECONDS`. Rejects when `signal` aborts or an encoder fails.
 */
export async function encodeMovie(
  pieces: readonly MoviePiece[],
  edit: MovieEdit,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
  onJoin?: (seconds: number) => void,
): Promise<Blob | null> {
  if (
    typeof VideoEncoder === "undefined" ||
    typeof VideoFrame === "undefined" ||
    typeof AudioEncoder === "undefined" ||
    typeof AudioData === "undefined" ||
    typeof OfflineAudioContext === "undefined"
  ) {
    return null;
  }
  const elements = new Map<Blob, { video: HTMLVideoElement; url: string }>();
  const live: { close: () => void; state: string }[] = [];
  let failure: unknown = null;
  const failed = (error: unknown) => {
    failure ??= error;
  };
  const check = () => {
    signal?.throwIfAborted();
    if (failure) throw failure;
  };
  try {
    for (const { blob } of pieces) {
      if (elements.has(blob)) continue;
      const video = document.createElement("video");
      video.playsInline = true;
      video.preload = "auto";
      video.muted = true;
      const url = URL.createObjectURL(blob);
      elements.set(blob, { video, url });
      const loaded = waitFor(video, "loadedmetadata");
      const broke = new Promise<"broke">((resolve) =>
        video.addEventListener("error", () => resolve("broke"), { once: true }),
      );
      video.src = url;
      if ((await Promise.race([loaded, broke])) === "broke") return null;
      if (!Number.isFinite(video.duration)) {
        const seeked = waitFor(video, "seeked");
        video.currentTime = Number.MAX_SAFE_INTEGER;
        await seeked;
      }
    }
    const stretches = pieces.flatMap((piece) => {
      const video = elements.get(piece.blob)?.video;
      if (!video) return [];
      const start = Math.max(0, piece.start);
      const end = Math.min(video.duration, piece.end);
      return end > start ? [{ blob: piece.blob, video, start, end }] : [];
    });
    const whole = stretches.reduce((sum, { start, end }) => sum + end - start, 0);
    if (stretches.length === 0 || whole > LONGEST_SECONDS) return null;

    const pictured = stretches.find(({ video }) => video.videoWidth > 0 && video.videoHeight > 0);
    const wantPicture = pictured !== undefined && !edit.noVideo;
    const size =
      wantPicture && editedSize(pictured.video.videoWidth, pictured.video.videoHeight, edit);
    const picture = size ? await videoCodec(size) : null;
    if (size && !picture) return null;

    const sounds = new Map<Blob, AudioBuffer>();
    if (!edit.noAudio) {
      for (const [blob, { video }] of elements) {
        const context = new OfflineAudioContext(1, 1, SAMPLE_RATE);
        const decoded = await blob
          .arrayBuffer()
          .then((buffer) => context.decodeAudioData(buffer))
          .catch(() => null);
        check();
        if (decoded) sounds.set(blob, decoded);
        else if (await holdsSound(video)) return null;
      }
    }
    const channels = Math.min(
      2,
      Math.max(0, ...[...sounds.values()].map((b) => b.numberOfChannels)),
    );
    const soundConfig =
      channels > 0
        ? {
            codec: "opus",
            sampleRate: SAMPLE_RATE,
            numberOfChannels: channels,
            bitrate: 96_000 * channels,
          }
        : null;
    if (soundConfig) {
      const { supported } = await AudioEncoder.isConfigSupported(soundConfig).catch(() => ({
        supported: false,
      }));
      if (!supported) return null;
    }
    if (!picture && !soundConfig) return null;

    const frames: WebmFrame[] = [];
    const keep = (track: 1 | 2, chunk: EncodedVideoChunk | EncodedAudioChunk) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      frames.push({ track, timestamp: chunk.timestamp, key: chunk.type === "key", data });
    };
    let head: Uint8Array<ArrayBuffer> | null = null;

    // The length of each stretch in whole frames: its sound is cut to that, so nothing drifts.
    const lengths = stretches.map(({ start, end }) =>
      Math.max(1, Math.round((end - start) * FRAMES_PER_SECOND)),
    );
    const totalFrames = lengths.reduce((sum, count) => sum + count, 0);
    let joined = 0;
    for (const [index, count] of lengths.entries()) {
      if (index > 0) onJoin?.(joined / FRAMES_PER_SECOND);
      joined += count;
    }

    if (soundConfig) {
      const encoder = new AudioEncoder({
        output: (chunk, metadata) => {
          const description = metadata?.decoderConfig?.description;
          if (description && !head) {
            head = new Uint8Array(
              ArrayBuffer.isView(description)
                ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
                : new Uint8Array(description),
            );
          }
          keep(2, chunk);
        },
        error: failed,
      });
      live.push(encoder);
      encoder.configure(soundConfig);
      let written = 0;
      for (const [index, { blob, start }] of stretches.entries()) {
        const samples = Math.round(((lengths[index] as number) / FRAMES_PER_SECOND) * SAMPLE_RATE);
        const sound = sounds.get(blob);
        const first = Math.round(start * SAMPLE_RATE);
        for (let done = 0; done < samples; done += SOUND_BLOCK) {
          check();
          const count = Math.min(SOUND_BLOCK, samples - done);
          const planes = new Float32Array(count * channels);
          if (sound) {
            for (let channel = 0; channel < channels; channel += 1) {
              const from = sound.getChannelData(Math.min(channel, sound.numberOfChannels - 1));
              planes.set(from.subarray(first + done, first + done + count), channel * count);
            }
          }
          const block = new AudioData({
            format: "f32-planar",
            sampleRate: SAMPLE_RATE,
            numberOfFrames: count,
            numberOfChannels: channels,
            timestamp: Math.round(((written + done) / SAMPLE_RATE) * 1e6),
            data: planes,
          });
          encoder.encode(block);
          block.close();
        }
        written += samples;
      }
      await encoder.flush();
      encoder.close();
      check();
    }

    if (picture && size && pictured) {
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const draw = canvas.getContext("2d");
      if (!draw) return null;
      const paint = moviePainter(draw, size, edit);
      const encoder = new VideoEncoder({ output: (chunk) => keep(1, chunk), error: failed });
      live.push(encoder);
      encoder.configure(picture.config);
      let made = 0;
      for (const [index, { video, start }] of stretches.entries()) {
        for (let at = 0; at < (lengths[index] as number); at += 1) {
          check();
          // Just past the frame's time: a seek to the very time can land on the frame before it.
          const seeked = waitFor(video, "seeked");
          video.currentTime = start + at / FRAMES_PER_SECOND + 0.001;
          await seeked;
          paint(video);
          const frame = new VideoFrame(canvas, {
            timestamp: Math.round((made / FRAMES_PER_SECOND) * 1e6),
            duration: Math.round(1e6 / FRAMES_PER_SECOND),
          });
          encoder.encode(frame, { keyFrame: made % KEY_FRAME_EVERY === 0 });
          frame.close();
          made += 1;
          onProgress(made / totalFrames);
          while (encoder.encodeQueueSize > BUSY_QUEUE) {
            await waitForDequeue(encoder);
            check();
          }
        }
      }
      await encoder.flush();
      encoder.close();
      check();
    }

    const tracks: WebmTracks = {};
    if (picture && size) tracks.video = { codec: picture.name, ...size };
    if (soundConfig) {
      tracks.audio = {
        sampleRate: SAMPLE_RATE,
        channels,
        head: head ?? opusHead(channels, SAMPLE_RATE),
      };
    }
    onProgress(1);
    return muxWebm(tracks, frames, totalFrames / FRAMES_PER_SECOND);
  } finally {
    for (const coder of live) {
      if (coder.state !== "closed") coder.close();
    }
    for (const { video, url } of elements.values()) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }
  }
}

const waitForDequeue = (encoder: VideoEncoder) =>
  new Promise<void>((resolve) => {
    encoder.addEventListener("dequeue", () => resolve(), { once: true });
  });
