import { describe, expect, it } from "vitest";
import {
  crossfadeLevels,
  EQ_BANDS,
  EQ_OFF,
  EQ_PRESETS,
  enhancerStage,
  equalizerGains,
  readEqualizer,
  SoundCheckLevels,
  soundCheckGain,
} from "./music-audio";

const sine = (amplitude: number, seconds = 2, rate = 8000) =>
  Float32Array.from({ length: seconds * rate }, (_, at) => amplitude * Math.sin(at / 3));

describe("Sound Check", () => {
  it("brings a loud song down and a quiet one up, to the same level", () => {
    // A sine of amplitude 0.5 has a power of -9 dB; -16 dB is 7 dB less.
    expect(soundCheckGain([sine(0.5)], 8000)).toBeCloseTo(0.447, 2);
    // Amplitude 0.05 is 20 dB less: 13 dB more would be asked, and 12 dB is the most it moves.
    expect(soundCheckGain([sine(0.05)], 8000)).toBeCloseTo(3.98, 1);
  });

  it("does not count silence, and leaves a silent song alone", () => {
    const half = new Float32Array(32000);
    half.set(sine(0.5));
    expect(soundCheckGain([half], 8000)).toBeCloseTo(0.447, 2);
    expect(soundCheckGain([new Float32Array(8000)], 8000)).toBe(1);
  });

  it("never raises a song so far that its loudest sample clips", () => {
    const peaky = sine(0.01);
    peaky[100] = 0.9;
    expect(soundCheckGain([peaky], 8000)).toBeCloseTo(1 / 0.9, 2);
  });

  it("measures a song once, and plays a song it cannot read at its own level", async () => {
    let reads = 0;
    const levels = new SoundCheckLevels(
      async () =>
        ({
          numberOfChannels: 1,
          sampleRate: 8000,
          getChannelData: () => sine(0.5),
        }) as unknown as AudioBuffer,
      (async (url: string) => {
        reads += 1;
        return url === "good"
          ? new Response(new ArrayBuffer(8))
          : new Response(null, { status: 404 });
      }) as typeof fetch,
    );
    expect(await levels.of("a", "good")).toBeCloseTo(0.447, 2);
    expect(await levels.of("a", "good")).toBeCloseTo(0.447, 2);
    expect(reads).toBe(1);
    expect(await levels.of("b", "gone")).toBe(1);
  });
});

describe("Crossfade and Sound Enhancer", () => {
  it("crosses at equal power", () => {
    expect(crossfadeLevels(0)).toEqual({ leaving: 1, coming: 0 });
    const { leaving, coming } = crossfadeLevels(0.5);
    expect(leaving).toBeCloseTo(Math.SQRT1_2, 5);
    expect(coming).toBeCloseTo(Math.SQRT1_2, 5);
    expect(crossfadeLevels(2).coming).toBe(1);
  });

  it("leaves the sound untouched when off, and does more toward High", () => {
    expect(enhancerStage(false, 100)).toEqual({ lowDb: 0, highDb: 0, width: 0, trim: 1 });
    expect(enhancerStage(true, 0).highDb).toBe(1.5);
    expect(enhancerStage(true, 100)).toEqual({
      lowDb: 3,
      highDb: 6,
      width: 0.3,
      trim: 10 ** (-3 / 20),
    });
  });
});

describe("Music's Equalizer settings", () => {
  it("has every preset with a gain for each band, in range", () => {
    for (const gains of Object.values(EQ_PRESETS)) {
      expect(gains).toHaveLength(EQ_BANDS.length);
      expect(gains.every((gain) => Math.abs(gain) <= 12)).toBe(true);
    }
  });

  it("lets the sound through untouched when off, whatever the sliders say", () => {
    const off = { ...EQ_OFF, preamp: 12, gains: EQ_PRESETS.Rock ?? [] };
    expect(equalizerGains(off)).toEqual({ preamp: 1, gains: EQ_BANDS.map(() => 0) });
  });

  it("gives the preamp as a factor when on", () => {
    const on = { ...EQ_OFF, on: true, preamp: 20 };
    expect(equalizerGains(on).preamp).toBe(10);
    expect(equalizerGains({ ...on, preamp: 0 }).preamp).toBe(1);
  });

  it("reads back only whole settings", () => {
    const held = { on: true, preset: "Rock", preamp: 2, gains: EQ_PRESETS.Rock };
    expect(readEqualizer(held)).toEqual(held);
    expect(readEqualizer({ ...held, preset: "Polka" })?.preset).toBeNull();
    expect(readEqualizer({ ...held, gains: [1, 2] })).toBeUndefined();
    expect(readEqualizer({ ...held, preamp: 99 })).toBeUndefined();
    expect(readEqualizer(null)).toBeUndefined();
  });
});
