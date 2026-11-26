import { describe, expect, it } from "vitest";
import {
  cutChannels,
  encodeWav,
  encodeWavChannels,
  extensionForType,
  extensionOf,
  formatMemoDate,
  isAudioFile,
  keepsWhole,
  levelOf,
  MIN_TRIM_SECONDS,
  moveTrimEnd,
  moveTrimStart,
  normalisePeaks,
  pcm16,
  peaksOf,
  pickRecordingType,
  sampleRange,
  titleOf,
} from "./voice-memos-audio";
import {
  DRIVE_FILE_BYTES,
  longestWav,
  MAX_DURATION,
  MAX_EDITED_DURATION,
} from "./voice-memos-data";

const text = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, at + length));

describe("what fits in a file of the drive", () => {
  it("counts whole minutes of mono WAV", () => {
    expect(longestWav(44_100)).toBe(720);
    expect(longestWav(48_000)).toBe(660);
    expect(MAX_EDITED_DURATION).toBe(720);
  });

  it("holds an hour of a take at 128 kbit/s", () => {
    expect((MAX_DURATION * 128_000) / 8).toBeLessThan(DRIVE_FILE_BYTES);
  });
});

describe("the recording format", () => {
  it("asks for Ogg in Firefox, WebM in Chromium and MP4 in Safari", () => {
    const firefox = new Set(["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"]);
    const chromium = new Set(["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]);
    const safari = new Set(["audio/mp4"]);
    expect(pickRecordingType((type) => firefox.has(type))).toBe("audio/ogg;codecs=opus");
    expect(pickRecordingType((type) => chromium.has(type))).toBe("audio/webm;codecs=opus");
    expect(pickRecordingType((type) => safari.has(type))).toBe("audio/mp4");
    // None of them, or a browser that throws when asked: the recorder picks.
    expect(pickRecordingType(() => false)).toBeUndefined();
    expect(
      pickRecordingType(() => {
        throw new Error("no");
      }),
    ).toBeUndefined();
  });

  it("saves each type under the extension that matches it", () => {
    expect(extensionForType("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionForType("audio/ogg; codecs=opus")).toBe("ogg");
    expect(extensionForType("audio/mp4")).toBe("m4a");
    expect(extensionForType("AUDIO/MP4;codecs=mp4a.40.2")).toBe("m4a");
    expect(extensionForType("audio/wav")).toBe("wav");
    expect(extensionForType("audio/mpeg")).toBe("mp3");
    expect(extensionForType("")).toBe("webm");
  });
});

describe("names and dates", () => {
  it("splits a file name into the title and the extension a rename keeps", () => {
    expect(titleOf("New Recording 2.webm")).toBe("New Recording 2");
    expect(extensionOf("New Recording 2.webm")).toBe(".webm");
    expect(titleOf("Interview v1.2.m4a")).toBe("Interview v1.2");
    expect(extensionOf("Interview v1.2.m4a")).toBe(".m4a");
    // No extension, a leading dot, a trailing dot: the whole name is the title.
    expect([titleOf("Notes"), extensionOf("Notes")]).toEqual(["Notes", ""]);
    expect([titleOf(".hidden"), extensionOf(".hidden")]).toEqual([".hidden", ""]);
    expect([titleOf("Odd."), extensionOf("Odd.")]).toEqual(["Odd.", ""]);
  });

  it("lists audio files by their type or their name", () => {
    expect(isAudioFile({ name: "a.bin", type: "audio/webm" })).toBe(true);
    expect(isAudioFile({ name: "Memo.M4A" })).toBe(true);
    expect(isAudioFile({ name: "Memo.wav", type: "" })).toBe(true);
    expect(isAudioFile({ name: "notes.txt", type: "text/plain" })).toBe(false);
    expect(isAudioFile({ name: "photo.jpg", type: "image/jpeg" })).toBe(false);
  });

  it("writes the date as the list does, from fixed English names", () => {
    const now = new Date(2019, 9, 10, 15, 30).getTime(); // Thursday 10 October 2019
    expect(formatMemoDate(new Date(2019, 9, 10, 0, 1).getTime(), now)).toBe("Today");
    expect(formatMemoDate(new Date(2019, 9, 9, 23, 59).getTime(), now)).toBe("Yesterday");
    expect(formatMemoDate(new Date(2019, 9, 7, 12).getTime(), now)).toBe("Monday");
    expect(formatMemoDate(new Date(2019, 9, 3, 12).getTime(), now)).toBe("3 Oct 2019");
    expect(formatMemoDate(new Date(2019, 8, 28, 12).getTime(), now)).toBe("28 Sep 2019");
    // A date after the clock's (another machine's clock) is written in full.
    expect(formatMemoDate(new Date(2019, 9, 12).getTime(), now)).toBe("12 Oct 2019");
  });
});

describe("the waveform", () => {
  it("takes the loudest sample of every channel in each stretch, scaled to the loudest", () => {
    // 1 s at 10 samples a second, 5 peaks a second: two samples to a peak.
    const left = Float32Array.from([0.1, -0.2, 0, 0.05, 0.4, 0, 0, 0, 0.2, 0.1]);
    const right = Float32Array.from([0, 0, 0.3, 0, 0, -0.8, 0, 0, 0, 0]);
    expect(peaksOf([left, right], 10, 5)).toEqual([0.25, 0.375, 1, 0, 0.25]);
    expect(peaksOf([], 44100)).toEqual([]);
    expect(peaksOf([new Float32Array(0)], 44100)).toEqual([]);
    // 1.5 s at 50 a second: 75 peaks, the last stretch shorter.
    expect(peaksOf([new Float32Array(66_150)], 44_100)).toHaveLength(75);
  });

  it("leaves a quiet recording quiet", () => {
    expect(normalisePeaks([0.5, 0.25, 0])).toEqual([1, 0.5, 0]);
    // Silence and a murmur are not blown up to full height.
    expect(normalisePeaks([0.05, 0.1])).toEqual([0.2, 0.4]);
  });

  it("reads the microphone's level from an analyser's bytes", () => {
    expect(levelOf([128, 128, 128])).toBe(0);
    expect(levelOf([128, 192, 100])).toBe(0.5);
    expect(levelOf([0, 255])).toBe(1);
  });
});

describe("a trim", () => {
  it("keeps its handles within the recording and apart", () => {
    const whole = { start: 0, end: 3 };
    expect(moveTrimStart(whole, 1.2)).toEqual({ start: 1.2, end: 3 });
    expect(moveTrimStart(whole, -1)).toEqual({ start: 0, end: 3 });
    expect(moveTrimStart({ start: 0, end: 2 }, 2.5).start).toBeCloseTo(2 - MIN_TRIM_SECONDS, 9);
    expect(moveTrimEnd(whole, 2, 3)).toEqual({ start: 0, end: 2 });
    expect(moveTrimEnd(whole, 9, 3)).toEqual({ start: 0, end: 3 });
    expect(moveTrimEnd({ start: 1, end: 3 }, 0.5, 3).end).toBeCloseTo(1 + MIN_TRIM_SECONDS, 9);
    expect(keepsWhole(whole, 3)).toBe(true);
    expect(keepsWhole({ start: 0.004, end: 2.996 }, 3)).toBe(true);
    expect(keepsWhole({ start: 0.5, end: 3 }, 3)).toBe(false);
  });

  it("cuts the samples between its handles from every channel, keeping them apart", () => {
    expect(sampleRange({ start: 0.5, end: 1.25 }, 8, 16)).toEqual([4, 10]);
    expect(sampleRange({ start: 1.5, end: 9 }, 8, 16)).toEqual([12, 16]);
    const left = Float32Array.from([0, 0.2, 0.4, 0.6, 0.8, 1]);
    // Opposite in phase: mixed into one, the two would cancel.
    const right = left.map((sample) => -sample);
    const kept = cutChannels([left, right], 2, { start: 0.5, end: 2 });
    expect(kept.map((channel) => Array.from(channel))).toEqual([
      Array.from(left.slice(1, 4)),
      Array.from(right.slice(1, 4)),
    ]);
    expect(cutChannels([], 2, { start: 0, end: 1 })).toHaveLength(0);
  });
});

describe("the WAV file", () => {
  it("keeps every channel of a trimmed recording, interleaved", () => {
    const file = encodeWavChannels(
      [Float32Array.from([0.5, 0]), Float32Array.from([-0.5, 1])],
      8000,
    );
    const view = new DataView(file.buffer);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(28, true)).toBe(8000 * 2 * 2);
    expect(file.byteLength).toBe(44 + 2 * 2 * 2);
    expect([0, 1, 2, 3].map((at) => view.getInt16(44 + at * 2, true))).toEqual([
      16384, -16384, 0, 32767,
    ]);
  });

  it("writes 16-bit samples, clipped", () => {
    expect(Array.from(pcm16([0, 1, -1, 0.5, 2, -2]))).toEqual([
      0, 32767, -32768, 16384, 32767, -32768,
    ]);
  });

  it("is a mono 16-bit PCM RIFF file with a header that names its length", () => {
    const samples = Float32Array.from({ length: 22_050 }, (_, at) => Math.sin(at / 10) / 2);
    const file = encodeWav(samples, 44_100);
    const view = new DataView(file.buffer);
    expect(file.byteLength).toBe(44 + 22_050 * 2);
    expect(text(file, 0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(file.byteLength - 8);
    expect(text(file, 8, 8)).toBe("WAVEfmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // one channel
    expect(view.getUint32(24, true)).toBe(44_100);
    expect(view.getUint32(28, true)).toBe(88_200); // bytes a second
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(file, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(22_050 * 2);
    // The samples follow the header, little-endian.
    expect(view.getInt16(44 + 20 * 2, true)).toBe(pcm16([Math.sin(2) / 2])[0]);
    // Half a second of sound at 44.1 kHz.
    expect(view.getUint32(40, true) / view.getUint32(28, true)).toBe(0.5);
  });
});
