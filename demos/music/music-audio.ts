import { sessionFetch } from "../desktop/desktop-server";

/** The ten bands of the Equalizer, in Hz. */
export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
/** How far a band or the preamp moves, in dB either way. */
export const EQ_RANGE = 12;

export interface EqualizerState {
  on: boolean;
  /** The preset chosen, or `null` once the sliders have been moved by hand. */
  preset: string | null;
  /** dB. */
  preamp: number;
  /** dB, one per band of `EQ_BANDS`. */
  gains: readonly number[];
}

export const EQ_PRESETS: Readonly<Record<string, readonly number[]>> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Acoustic: [5, 5, 4, 1, 2, 2, 3.5, 4, 3.5, 2],
  "Bass Booster": [5.5, 4.5, 3.5, 2.5, 1, 0, 0, 0, 0, 0],
  "Bass Reducer": [-5.5, -4.5, -3.5, -2.5, -1, 0, 0, 0, 0, 0],
  Classical: [4.5, 3.5, 3, 2.5, -1.5, -1.5, 0, 2, 3, 3.5],
  Dance: [3.5, 6.5, 5, 0, 2, 3.5, 5, 4.5, 3.5, 0],
  Electronic: [4, 3.5, 1, 0, -2, 2, 1, 1.5, 4, 5],
  "Hip-Hop": [5, 4, 1.5, 3, -1, -1, 1.5, -0.5, 2, 3],
  Jazz: [4, 3, 1.5, 2, -1.5, -1.5, 0, 1.5, 3, 3.5],
  Pop: [-1.5, -1, 0, 2, 4, 4, 2, 0, -1, -1.5],
  Rock: [5, 4, 3, 1.5, -0.5, -1, 0.5, 2.5, 3.5, 4.5],
  Spoken: [-3.5, -0.5, 0, 0.5, 3.5, 4.5, 4.5, 4, 2.5, 0],
  "Treble Booster": [0, 0, 0, 0, 0, 1, 2.5, 3.5, 4.5, 5.5],
  "Vocal Booster": [-1.5, -3, -3, 1.5, 3.5, 3.5, 3, 1.5, 0, -1.5],
};

export const EQ_OFF: EqualizerState = {
  on: false,
  preset: "Flat",
  preamp: 0,
  gains: EQ_PRESETS.Flat ?? [],
};

const inRange = (value: unknown): value is number =>
  typeof value === "number" && Math.abs(value) <= EQ_RANGE;

/** The settings kept for the Equalizer, when they are whole. */
export function readEqualizer(stored: unknown): EqualizerState | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { on, preset, preamp, gains } = stored as Partial<Record<keyof EqualizerState, unknown>>;
  if (typeof on !== "boolean" || !inRange(preamp)) return undefined;
  if (!Array.isArray(gains) || gains.length !== EQ_BANDS.length || !gains.every(inRange)) {
    return undefined;
  }
  return {
    on,
    preamp,
    gains,
    preset: typeof preset === "string" && preset in EQ_PRESETS ? preset : null,
  };
}

/** What the Web Audio nodes are told: with the Equalizer off, the sound goes through untouched. */
export function equalizerGains(state: EqualizerState): {
  preamp: number;
  gains: readonly number[];
} {
  return state.on
    ? { preamp: 10 ** (state.preamp / 20), gains: state.gains }
    : { preamp: 1, gains: EQ_BANDS.map(() => 0) };
}

/** What a song's own Equalizer preset (Song Info, Options) makes of the window's Equalizer. */
export function equalizerForSong(
  state: EqualizerState,
  preset: string | undefined,
): EqualizerState {
  const gains = preset ? EQ_PRESETS[preset] : undefined;
  return gains ? { on: true, preset: preset ?? null, preamp: state.preamp, gains } : state;
}

/** How loud Sound Check makes every song, in dB against full scale. */
export const SOUND_CHECK_TARGET_DB = -16;
/** The most Sound Check moves a song, in dB either way. */
const SOUND_CHECK_RANGE_DB = 12;
/** Blocks quieter than this say nothing of a song's level, in dB: the silence between its parts. */
const SOUND_CHECK_GATE_DB = -50;
const SOUND_CHECK_BLOCK_SECONDS = 0.4;
/** The longest file Sound Check decodes, in bytes: a longer one plays at its own level. */
const SOUND_CHECK_MOST_BYTES = 64 * 1024 * 1024;

const toDb = (power: number) => 10 * Math.log10(power);

/**
 * The factor that brings a decoded song to `SOUND_CHECK_TARGET_DB`: its power over the blocks that
 * are not silent, kept within the range, and never so high that its loudest sample would clip.
 * Silence is left as it is.
 */
export function soundCheckGain(channels: readonly Float32Array[], sampleRate: number): number {
  const length = channels[0]?.length ?? 0;
  const block = Math.max(1, Math.round(sampleRate * SOUND_CHECK_BLOCK_SECONDS));
  const powers: number[] = [];
  let peak = 0;
  for (let from = 0; from < length; from += block) {
    const to = Math.min(length, from + block);
    let sum = 0;
    for (const samples of channels) {
      for (let at = from; at < to; at += 1) {
        const sample = samples[at] ?? 0;
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
    }
    powers.push(sum / ((to - from) * channels.length));
  }
  const heard = powers.filter((power) => power > 0 && toDb(power) > SOUND_CHECK_GATE_DB);
  if (heard.length === 0) return 1;
  const level = toDb(heard.reduce((sum, power) => sum + power, 0) / heard.length);
  const moved = Math.min(
    SOUND_CHECK_RANGE_DB,
    Math.max(-SOUND_CHECK_RANGE_DB, SOUND_CHECK_TARGET_DB - level),
  );
  return Math.min(10 ** (moved / 20), 1 / peak);
}

/** Each song's Sound Check factor, measured once from its sound; 1 when it cannot be read. */
export class SoundCheckLevels {
  private readonly levels = new Map<string, Promise<number>>();

  constructor(
    private readonly decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>,
    private readonly read: (url: string) => Promise<Response> = (url) => sessionFetch(url),
  ) {}

  of(songId: string, url: string): Promise<number> {
    const held = this.levels.get(songId);
    if (held) return held;
    const measured = this.measure(url);
    this.levels.set(songId, measured);
    return measured;
  }

  private async measure(url: string): Promise<number> {
    try {
      const answer = await this.read(url);
      if (!answer.ok || Number(answer.headers.get("content-length")) > SOUND_CHECK_MOST_BYTES) {
        return 1;
      }
      const sound = await this.decode(await answer.arrayBuffer());
      const channels = Array.from({ length: sound.numberOfChannels }, (_, channel) =>
        sound.getChannelData(channel),
      );
      return soundCheckGain(channels, sound.sampleRate);
    } catch {
      return 1;
    }
  }
}

/** How long a crossfade may be, in seconds: the Playback pane's slider. */
export const CROSSFADE_SECONDS = { least: 1, most: 12 } as const;

/**
 * The two songs' levels `done` of the way (0 to 1) through a crossfade: equal power, so the sum
 * of their power stays the same throughout.
 */
export function crossfadeLevels(done: number): { leaving: number; coming: number } {
  const at = (Math.min(1, Math.max(0, done)) * Math.PI) / 2;
  return { leaving: Math.cos(at), coming: Math.sin(at) };
}

/**
 * What Sound Enhancer does at `level` (0, Low, to 100, High): brighter highs, some more bass and a
 * wider stereo image, with the whole lowered so that the boost does not clip.
 */
export function enhancerStage(
  on: boolean,
  level: number,
): { lowDb: number; highDb: number; width: number; trim: number } {
  if (!on) return { lowDb: 0, highDb: 0, width: 0, trim: 1 };
  const amount = 0.25 + (Math.min(100, Math.max(0, level)) / 100) * 0.75;
  const highDb = 6 * amount;
  return { lowDb: 3 * amount, highDb, width: 0.3 * amount, trim: 10 ** (-highDb / 2 / 20) };
}

/**
 * The sound of Music's media elements through Sound Check, the Equalizer and Sound Enhancer, and to
 * the Visualizer's analyser. An element joined to Web Audio can never leave it
 * (`createMediaElementSource`), so the graph is made only when one of them is first used, and
 * stays. The player has two elements, for a crossfade; each has a Sound Check level of its own.
 */
export class MusicAudioGraph {
  private readonly context = new AudioContext();
  private readonly levels = new Map<HTMLMediaElement, GainNode>();
  private sink = "";
  private readonly preamp = this.context.createGain();
  private readonly filters = EQ_BANDS.map((frequency, index) => {
    const filter = this.context.createBiquadFilter();
    filter.type =
      index === 0 ? "lowshelf" : index === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
    filter.frequency.value = frequency;
    filter.Q.value = 1.4;
    return filter;
  });
  private readonly stereo = this.context.createGain();
  private readonly splitter = this.context.createChannelSplitter(2);
  private readonly merger = this.context.createChannelMerger(2);
  /** Each side to itself, and each to the other: the mid and side of a widened stereo image. */
  private readonly straight = [this.context.createGain(), this.context.createGain()];
  private readonly crossed = [this.context.createGain(), this.context.createGain()];
  private readonly lowShelf = this.context.createBiquadFilter();
  private readonly highShelf = this.context.createBiquadFilter();
  private readonly trim = this.context.createGain();
  readonly analyser = this.context.createAnalyser();
  readonly soundCheck = new SoundCheckLevels((bytes) => this.context.decodeAudioData(bytes));

  constructor() {
    let from: AudioNode = this.preamp;
    for (const to of [...this.filters, this.stereo]) {
      from.connect(to);
      from = to;
    }
    // A mono song is spread to both sides, so that each side is fed.
    this.stereo.channelCount = 2;
    this.stereo.channelCountMode = "explicit";
    this.stereo.channelInterpretation = "speakers";
    this.stereo.connect(this.splitter);
    for (const side of [0, 1]) {
      const straight = this.straight[side] as GainNode;
      const crossed = this.crossed[side] as GainNode;
      this.splitter.connect(straight, side);
      this.splitter.connect(crossed, side);
      straight.connect(this.merger, 0, side);
      crossed.connect(this.merger, 0, 1 - side);
    }
    this.lowShelf.type = "lowshelf";
    this.lowShelf.frequency.value = 120;
    this.highShelf.type = "highshelf";
    this.highShelf.frequency.value = 6000;
    from = this.merger;
    for (const to of [
      this.lowShelf,
      this.highShelf,
      this.trim,
      this.analyser,
      this.context.destination,
    ]) {
      from.connect(to);
      from = to;
    }
    this.enhance(false, 0);
  }

  /** Brings an element's sound into the graph; once is enough. */
  join(media: HTMLMediaElement): void {
    if (this.levels.has(media)) return;
    const level = this.context.createGain();
    this.context.createMediaElementSource(media).connect(level);
    level.connect(this.preamp);
    this.levels.set(media, level);
    media.addEventListener("play", () => void this.context.resume());
    if (!media.paused) void this.context.resume();
  }

  apply(state: EqualizerState): void {
    const { preamp, gains } = equalizerGains(state);
    this.preamp.gain.value = preamp;
    this.filters.forEach((filter, index) => {
      filter.gain.value = gains[index] ?? 0;
    });
  }

  /** Sound Enhancer, on or off, at the Playback pane's level. */
  enhance(on: boolean, level: number): void {
    const { lowDb, highDb, width, trim } = enhancerStage(on, level);
    this.lowShelf.gain.value = lowDb;
    this.highShelf.gain.value = highDb;
    this.trim.gain.value = trim;
    for (const gain of this.straight) gain.gain.value = 1 + width;
    for (const gain of this.crossed) gain.gain.value = -width;
  }

  /** An element's Sound Check factor, moved to over a tenth of a second so that it does not click. */
  setLevel(media: HTMLMediaElement, factor: number): void {
    this.levels.get(media)?.gain.setTargetAtTime(factor, this.context.currentTime, 0.03);
  }

  /** Sound Check turned off: every element at its own level again. */
  clearLevels(): void {
    for (const media of this.levels.keys()) this.setLevel(media, 1);
  }

  /** The output device the whole graph sounds on, where the browser can change it. */
  async setSink(id: string): Promise<void> {
    if (id === this.sink) return;
    const context = this.context as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    await context.setSinkId?.(id);
    this.sink = id;
  }
}

const graphs = new WeakMap<object, MusicAudioGraph>();

/** The player's graph, if something has needed one yet. */
export const madeAudioGraph = (player: object) => graphs.get(player);

export function audioGraphOf(player: object): MusicAudioGraph {
  const held = graphs.get(player);
  if (held) return held;
  const made = new MusicAudioGraph();
  graphs.set(player, made);
  return made;
}
