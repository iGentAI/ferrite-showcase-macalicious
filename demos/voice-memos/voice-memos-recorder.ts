import { levelOf, pcm16, pickRecordingType, WAV_TYPE, wavHeader } from "./voice-memos-audio";
import { longestWav, MAX_DURATION } from "./voice-memos-data";

/** Asked of every browser, so that `MAX_DURATION` of a take fits in a file of the drive. */
const BITS_PER_SECOND = 128_000;

/** Why the microphone could not be used. */
export type MicrophoneProblem = "unsupported" | "denied" | "missing" | "busy" | "failed";

/** The microphone or the recorder could not be started; `message` is fit to show. */
export class MicrophoneError extends Error {
  readonly problem: MicrophoneProblem;
  constructor(problem: MicrophoneProblem, message: string) {
    super(message);
    this.name = "MicrophoneError";
    this.problem = problem;
  }
}

/** A recording being made. */
export interface VoiceMemosTake {
  /** The recording's media type: the recorder's, or `audio/wav` without `MediaRecorder`. */
  readonly type: string;
  /** Whether the take is paused. */
  readonly paused: boolean;
  /** Seconds recorded so far, pauses left out. */
  elapsed(): number;
  /** The seconds this take stops at by itself: what a file of its format can hold. */
  readonly longest: number;
  /** The microphone's level now, from 0 to 1; 0 where the browser gives no levels. */
  level(): number;
  pause(): void;
  resume(): void;
  /** Ends the take: the microphone is released, and the recording answered. */
  stop(): Promise<Blob>;
  /** Ends the take and throws the recording away. */
  cancel(): void;
}

/** The sentence for a refusal of `getUserMedia`, by the name the browser gives it. */
export function microphoneError(error: unknown): MicrophoneError {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "PermissionDeniedError":
      return new MicrophoneError(
        "denied",
        "Voice Memos is not allowed to use the microphone. Allow it in the browser's settings for this site, then try again.",
      );
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return new MicrophoneError("missing", "No microphone is connected.");
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return new MicrophoneError(
        "busy",
        "The microphone could not be started. Another application may be using it.",
      );
    default:
      return new MicrophoneError(
        "failed",
        `The microphone could not be started${error instanceof Error && error.message ? `: ${error.message}` : "."}`,
      );
  }
}

const UNSUPPORTED = "This browser cannot record sound.";

/** How long a take without `MediaRecorder` waits for Web Audio to start before giving up. */
const START_WAIT_MS = 2000;

type AudioContextClass = typeof AudioContext;

/** A clock of the time a take runs, pauses left out. */
function takeClock() {
  let total = 0;
  let since: number | undefined = performance.now();
  return {
    elapsed: () => total + (since === undefined ? 0 : (performance.now() - since) / 1000),
    pause: () => {
      if (since !== undefined) total += (performance.now() - since) / 1000;
      since = undefined;
    },
    resume: () => {
      since ??= performance.now();
    },
  };
}

/**
 * Told when a take ends without being asked to: the recorder failed (`reason`), or the input went
 * away (the microphone was unplugged or its permission withdrawn; `reason` is null). The take's
 * clock has stopped; `stop()` still answers what was recorded and releases what is left.
 */
export type TakeEndedListener = (take: VoiceMemosTake, reason: Error | null) => void;

/**
 * Starts a recording from the microphone. Call it from the press that starts the take: the
 * levels' audio context is made before the first wait, while the press still counts as the
 * person's gesture.
 *
 * With `MediaRecorder` the take is in the first format of `RECORDING_TYPES` the browser records;
 * without it (WebKit on Linux has none), the microphone's samples are taken from Web Audio and
 * written as a 16-bit WAV file. The levels come from an analyser on the same context; a context
 * that never starts (a browser with no sound device) gives none, and the take goes on without
 * them. `onEnded` hears a take that ends by itself. With `lossless`, a browser that has Web Audio takes
 * the samples as WAV even with `MediaRecorder`. Rejects with a `MicrophoneError`.
 */
export async function startTake(
  onEnded?: TakeEndedListener,
  options: { lossless?: boolean } = {},
): Promise<VoiceMemosTake> {
  const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  const Recorder = typeof MediaRecorder === "undefined" ? undefined : MediaRecorder;
  const Context =
    (globalThis as { AudioContext?: AudioContextClass }).AudioContext ??
    (globalThis as { webkitAudioContext?: AudioContextClass }).webkitAudioContext;
  if (!media?.getUserMedia) throw new MicrophoneError("unsupported", UNSUPPORTED);
  let context: AudioContext | undefined;
  try {
    context = Context ? new Context() : undefined;
    // Not waited for: a context with no sound device never starts.
    context?.resume().catch(() => {});
  } catch {
    context = undefined;
  }
  const closeContext = () => {
    if (context && context.state !== "closed") context.close().catch(() => {});
  };
  if (!Recorder && !context) throw new MicrophoneError("unsupported", UNSUPPORTED);

  let stream: MediaStream;
  try {
    stream = await media.getUserMedia({ audio: true });
  } catch (error) {
    closeContext();
    throw microphoneError(error);
  }

  let source: MediaStreamAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  try {
    if (context) {
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
    }
  } catch {
    analyser = undefined;
  }
  const bytes = analyser ? new Uint8Array(analyser.fftSize) : undefined;
  const level = () => {
    if (!analyser || !bytes || context?.state !== "running") return 0;
    analyser.getByteTimeDomainData(bytes);
    return levelOf(bytes);
  };
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    for (const track of stream.getTracks()) track.stop();
    try {
      source?.disconnect();
    } catch {
      // Already disconnected.
    }
    closeContext();
  };

  try {
    return Recorder && !(options.lossless && context)
      ? recorderTake(Recorder, stream, level, release, onEnded)
      : await pcmTake(context as AudioContext, source, stream, level, release, onEnded);
  } catch (error) {
    release();
    throw error instanceof MicrophoneError
      ? error
      : new MicrophoneError(
          "failed",
          `The recording could not be started${error instanceof Error && error.message ? `: ${error.message}` : "."}`,
        );
  }
}

/** A take recorded by `MediaRecorder`. */
function recorderTake(
  Recorder: typeof MediaRecorder,
  stream: MediaStream,
  level: () => number,
  release: () => void,
  onEnded?: TakeEndedListener,
): VoiceMemosTake {
  const chosen = pickRecordingType((type) => Recorder.isTypeSupported(type));
  const recorder = new Recorder(stream, {
    ...(chosen ? { mimeType: chosen } : {}),
    audioBitsPerSecond: BITS_PER_SECOND,
  });
  const chunks: Blob[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  // Set once the window asked the take to end: a stop after that is the expected one.
  let asked = false;
  let failure: Error | null = null;
  recorder.addEventListener("error", (event) => {
    // Browsers give a DOMException, which is not an `Error` everywhere: its message is read.
    const message = (event as Event & { error?: { message?: unknown } }).error?.message;
    failure = new Error(typeof message === "string" && message ? message : "the recorder failed");
  });
  const stopped = new Promise<void>((resolve) => {
    recorder.addEventListener(
      "stop",
      () => {
        resolve();
        // A recorder stops by itself when it fails or when its input ends.
        if (!asked) {
          clock.pause();
          onEnded?.(take, failure);
        }
      },
      { once: true },
    );
  });
  // Without a timeslice: Firefox plays a WebM recorded in slices only to its first slice.
  recorder.start();
  const clock = takeClock();
  let paused = false;
  const type = () => recorder.mimeType || chosen || chunks[0]?.type || "audio/webm";
  const take: VoiceMemosTake = {
    get type() {
      return type();
    },
    get paused() {
      return paused;
    },
    elapsed: clock.elapsed,
    longest: MAX_DURATION,
    level: () => (paused ? 0 : level()),
    pause() {
      if (paused || recorder.state !== "recording") return;
      recorder.pause();
      clock.pause();
      paused = true;
    },
    resume() {
      if (!paused || recorder.state !== "paused") return;
      recorder.resume();
      clock.resume();
      paused = false;
    },
    async stop() {
      asked = true;
      clock.pause();
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      release();
      return new Blob(chunks, { type: type() });
    },
    cancel() {
      asked = true;
      clock.pause();
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
  return take;
}

/** A take of the microphone's samples from Web Audio, written as a 16-bit mono WAV file. */
async function pcmTake(
  context: AudioContext,
  source: MediaStreamAudioSourceNode | undefined,
  stream: MediaStream,
  level: () => number,
  release: () => void,
  onEnded?: TakeEndedListener,
): Promise<VoiceMemosTake> {
  if (!source) throw new MicrophoneError("unsupported", UNSUPPORTED);
  if (context.state !== "running") {
    await Promise.race([
      context.resume().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, START_WAIT_MS)),
    ]);
  }
  if (context.state !== "running") throw new MicrophoneError("unsupported", UNSUPPORTED);
  // A script processor runs only while it is connected to the output: through a silent gain, so
  // the microphone is not played back.
  const processor = context.createScriptProcessor(4096, 1, 1);
  const silence = context.createGain();
  silence.gain.value = 0;
  const chunks: Int16Array<ArrayBuffer>[] = [];
  let frames = 0;
  let paused = false;
  let ended = false;
  processor.addEventListener("audioprocess", (event) => {
    if (paused || ended) return;
    const samples = event.inputBuffer.getChannelData(0);
    chunks.push(pcm16(samples));
    frames += samples.length;
  });
  source.connect(processor);
  processor.connect(silence);
  silence.connect(context.destination);
  const rate = context.sampleRate;
  const end = () => {
    ended = true;
    try {
      processor.disconnect();
      silence.disconnect();
    } catch {
      // Already disconnected.
    }
    release();
  };
  const take: VoiceMemosTake = {
    type: WAV_TYPE,
    get paused() {
      return paused;
    },
    elapsed: () => frames / rate,
    longest: Math.min(MAX_DURATION, longestWav(rate)),
    level: () => (paused ? 0 : level()),
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    async stop() {
      end();
      return new Blob([wavHeader(frames * 2, rate), ...chunks], { type: WAV_TYPE });
    },
    cancel: end,
  };
  // The input went away (unplugged, or its permission withdrawn): the take ends there, and no
  // more samples arrive.
  for (const track of stream.getAudioTracks()) {
    track.addEventListener(
      "ended",
      () => {
        if (ended) return;
        paused = true;
        onEnded?.(take, null);
      },
      { once: true },
    );
  }
  return take;
}
