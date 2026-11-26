/** The browser's speech recognition, where it has one (Chrome, Edge and Safari do): what Siri, Start Dictation, Hey Siri and Dictation Commands listen with. */

type HeardResult = ArrayLike<{ transcript: string }> & { isFinal?: boolean };

export type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous?: boolean;
  onresult: ((event: { results: ArrayLike<HeardResult>; resultIndex?: number }) => void) | null;
  onend: (() => void) | null;
  /** `error` names why it stopped: `not-allowed`, `service-not-allowed`, `audio-capture`,
   * `network`, `no-speech`, `aborted` and others. */
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  addEventListener?: (type: "end", listener: () => void) => void;
};

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speech = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
}

export const offersSpeechRecognition = (): boolean => recognitionConstructor() !== undefined;

/** Recognition errors that mean nothing can be heard at all (the microphone is denied or failed,
 * or the speech service is unavailable), as opposed to hearing nothing this time. */
export const CANNOT_LISTEN: ReadonlySet<string> = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "network",
]);

/** Recognizers given to someone who asked to be heard, each with what gives its turn back. */
const turns = new Map<Recognition, () => void>();

export function recognition(): Recognition | null {
  const Constructor = recognitionConstructor();
  if (!Constructor) return null;
  let heard: Recognition;
  try {
    heard = new Constructor();
  } catch {
    return null;
  }
  // A browser hears through one recognizer at a time: whoever asks goes before what waits for a
  // phrase, which comes back when they have finished.
  dropAmbient();
  const release = () => {
    if (turns.delete(heard)) ambientLater(RESTART_MS);
  };
  turns.set(heard, release);
  heard.addEventListener?.("end", release);
  const start = heard.start.bind(heard);
  heard.start = () => {
    try {
      start();
    } catch (error) {
      release();
      throw error;
    }
  };
  return heard;
}

/** Drop a recognizer: nothing it still reports is heard, and it stops recording. */
export function abandon(heard: Recognition) {
  heard.onresult = null;
  heard.onend = null;
  heard.onerror = null;
  try {
    heard.stop();
  } catch {
    // Already stopped.
  }
  turns.get(heard)?.();
}

/* ----------------------------------------------------- listening while the page is open */

/** Who waits for a phrase. */
export interface Ear {
  /** The language to listen in, when this one has a say. */
  lang?: () => string | undefined;
  /** Each thing said, whole. */
  hear: (said: string) => void;
  /** The browser will not listen: `reason` is its word for why. This ear has gone. */
  refused?: (reason: string) => void;
}

/** A recognizer that ends on silence starts again after this long. */
const RESTART_MS = 500;
/** The speech service could not be reached: it is tried again after this long. */
const OFFLINE_RETRY_MS = 30_000;

const ears = new Set<Ear>();
let ambient: Recognition | null = null;
let ambientTimer: ReturnType<typeof setTimeout> | undefined;

function dropAmbient() {
  clearTimeout(ambientTimer);
  const heard = ambient;
  ambient = null;
  if (heard) abandon(heard);
}

function ambientLater(ms: number) {
  clearTimeout(ambientTimer);
  ambientTimer = setTimeout(startAmbient, ms);
}

function startAmbient() {
  const Constructor = recognitionConstructor();
  if (ambient || turns.size > 0 || ears.size === 0 || !Constructor) return;
  let heard: Recognition;
  try {
    heard = new Constructor();
  } catch {
    return;
  }
  ambient = heard;
  const current = () => ambient === heard;
  heard.continuous = true;
  heard.interimResults = false;
  heard.lang =
    [...ears].map((ear) => ear.lang?.()).find(Boolean) ??
    (typeof navigator === "undefined" ? "en-US" : navigator.language || "en-US");
  heard.onresult = ({ results, resultIndex = results.length - 1 }) => {
    for (let at = resultIndex; current() && at < results.length; at += 1) {
      const result = results[at];
      const said = result?.[0]?.transcript.trim();
      if (!said || result?.isFinal === false) continue;
      for (const ear of [...ears]) ear.hear(said);
    }
  };
  heard.onend = () => {
    if (!current()) return;
    ambient = null;
    ambientLater(RESTART_MS);
  };
  heard.onerror = ({ error = "" }) => {
    if (!current()) return;
    if (error === "network") {
      dropAmbient();
      ambientLater(OFFLINE_RETRY_MS);
    } else if (CANNOT_LISTEN.has(error)) {
      dropAmbient();
      const gone = [...ears];
      ears.clear();
      for (const ear of gone) ear.refused?.(error);
    }
  };
  try {
    heard.start();
  } catch {
    if (current()) {
      ambient = null;
      ambientLater(OFFLINE_RETRY_MS);
    }
  }
}

/**
 * Keeps a recognizer listening for as long as anyone waits for a phrase and the page is open, and
 * tells each ear what was said. The recognizer belongs to the browser: Chrome and Edge send what it
 * hears to their maker's speech service, so nothing may wait here that the person did not turn on.
 * Answers the function that stops.
 */
export function listenWhileOpen(ear: Ear): () => void {
  ears.add(ear);
  startAmbient();
  return () => {
    ears.delete(ear);
    if (ears.size === 0) dropAmbient();
  };
}

/** The desktop value that says Hey Siri is on. It is off until the person turns it on. */
export const HEY_SIRI_SETTING = "siri.listenForHeySiri";

/** Why the browser stopped listening for "Hey Siri"; the pane reads it. */
export const HEY_SIRI_REFUSED = "siri.heySiriRefused";

/** What follows "Hey Siri" in what was said; `null` when it was not said to Siri. */
export function afterHeySiri(said: string): string | null {
  const match = /(?:^|[^\p{L}])hey,?\s+siri\b[\s,.!?]*(.*)$/iu.exec(said);
  return match ? (match[1] ?? "").trim() : null;
}
