import { describe, expect, it, vi } from "vitest";
import {
  hasEncoder,
  m4aBytes,
  noEncoder,
  streamAddress,
  streamTitle,
  versionName,
  wavBytes,
  wavName,
} from "./music-convert";

/** The boxes of `bytes` from `at` to `end`, by name, with where each one's body starts. */
function boxes(bytes: Uint8Array, at: number, end: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const found = new Map<string, { body: number; end: number }>();
  for (let place = at; place < end; ) {
    const size = view.getUint32(place);
    found.set(String.fromCharCode(...bytes.subarray(place + 4, place + 8)), {
      body: place + 8,
      end: place + size,
    });
    place += size;
  }
  return found;
}

describe("Create AAC Version", () => {
  const frames = [Uint8Array.of(1, 2, 3), Uint8Array.of(4, 5), Uint8Array.of(6, 7, 8, 9)];
  const bytes = m4aBytes(frames, Uint8Array.of(0x12, 0x10), 44_100, 2, 256_000);
  const view = new DataView(bytes.buffer);
  const top = boxes(bytes, 0, bytes.length);
  const moov = top.get("moov");
  if (!moov) throw new Error("no moov");
  const trak = boxes(bytes, moov.body, moov.end).get("trak");
  if (!trak) throw new Error("no trak");
  const mdia = boxes(bytes, trak.body, trak.end).get("mdia");
  if (!mdia) throw new Error("no mdia");
  const minf = boxes(bytes, mdia.body, mdia.end).get("minf");
  if (!minf) throw new Error("no minf");
  const stbl = boxes(bytes, minf.body, minf.end).get("stbl");
  if (!stbl) throw new Error("no stbl");
  const table = boxes(bytes, stbl.body, stbl.end);

  it("says what it is and how long it runs", () => {
    expect([...top.keys()]).toEqual(["ftyp", "moov", "mdat"]);
    const brand = top.get("ftyp")?.body ?? 0;
    expect(String.fromCharCode(...bytes.subarray(brand, brand + 4))).toBe("M4A ");
    const movieHeader = boxes(bytes, moov.body, moov.end).get("mvhd")?.body ?? 0;
    expect(view.getUint32(movieHeader + 12)).toBe(44_100);
    expect(view.getUint32(movieHeader + 16)).toBe(3072);
  });

  it("points its index at the frames, in order", () => {
    const chunk = view.getUint32((table.get("stco")?.body ?? 0) + 8);
    expect([...bytes.subarray(chunk, chunk + 9)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(chunk).toBe(top.get("mdat")?.body ?? 0);
    const sizes = (table.get("stsz")?.body ?? 0) + 12;
    expect([0, 1, 2].map((at) => view.getUint32(sizes + 4 * at))).toEqual([3, 2, 4].map(Number));
    const timing = (table.get("stts")?.body ?? 0) + 8;
    expect(view.getUint32(timing)).toBe(3);
    expect(view.getUint32(timing + 4)).toBe(1024);
  });

  it("carries the encoder's description in the sample entry", () => {
    const description = table.get("stsd");
    if (!description) throw new Error("no stsd");
    const held = [...bytes.subarray(description.body, description.end)];
    const at = held.findIndex((value, index) => value === 0x12 && held[index + 1] === 0x10);
    expect(at).toBeGreaterThan(0);
    expect(held[at - 1]).toBe(2);
  });

  it("names the file after the song's", () => {
    expect(versionName("Blue Train.final.flac", "m4a")).toBe("Blue Train.final.m4a");
  });

  it("asks the browser whether it has the encoder, and says why not", async () => {
    expect(await hasEncoder("aac")).toBe(false);
    const isConfigSupported = vi.fn(async ({ codec }: { codec: string }) => ({
      supported: codec === "mp3",
    }));
    vi.stubGlobal("AudioEncoder", { isConfigSupported });
    try {
      expect(await hasEncoder("aac")).toBe(false);
      expect(await hasEncoder("mp3")).toBe(true);
      expect(isConfigSupported.mock.calls[0]?.[0]).toEqual({
        codec: "mp4a.40.2",
        bitrate: 256_000,
        sampleRate: 44_100,
        numberOfChannels: 2,
      });
    } finally {
      vi.unstubAllGlobals();
    }
    expect(noEncoder("aac")).toBe(
      "This browser's AudioEncoder has no AAC encoder for a page: Music writes WAV here.",
    );
  });
});

describe("Create WAV Version", () => {
  it("writes a header a player reads and the samples as 16-bit", () => {
    const bytes = wavBytes([new Float32Array([0, 1, -1]), new Float32Array([0.5, -0.5, 2])], 8000);
    const view = new DataView(bytes.buffer);
    const text = (at: number, length: number) =>
      String.fromCharCode(...bytes.subarray(at, at + length));
    expect(bytes.length).toBe(44 + 12);
    expect(text(0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(48);
    expect(text(8, 8)).toBe("WAVEfmt ");
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(28, true)).toBe(32000);
    expect(text(36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(12);
    const samples = Array.from({ length: 6 }, (_, at) => view.getInt16(44 + at * 2, true));
    expect(samples).toEqual([0, 16384, 32767, -16384, -32768, 32767]);
  });

  it("names the file after the song's", () => {
    expect(wavName("Blue Train.final.mp3")).toBe("Blue Train.final.wav");
    expect(wavName("noextension")).toBe("noextension.wav");
  });
});

describe("Open Stream", () => {
  it("takes a web address and nothing else", () => {
    expect(streamAddress("  https://radio.example/live.mp3 ")).toBe(
      "https://radio.example/live.mp3",
    );
    expect(streamAddress("http://radio.example")).toBe("http://radio.example/");
    expect(streamAddress("javascript:alert(1)")).toBeNull();
    expect(streamAddress("not an address")).toBeNull();
    expect(streamAddress(`https://a.example/${"x".repeat(2000)}`)).toBeNull();
  });

  it("lists a stream by the end of its address, or its host", () => {
    expect(streamTitle("https://radio.example/jazz%20hits.mp3")).toBe("jazz hits.mp3");
    expect(streamTitle("https://radio.example/")).toBe("radio.example");
    expect(streamTitle("https://radio.example/100%ZZ")).toBe("100%ZZ");
  });

  it("writes an M4A of more frames than a call can take as arguments", () => {
    const many = Array.from({ length: 500_000 }, () => Uint8Array.of(1));
    const file = m4aBytes(many, Uint8Array.of(0x12, 0x10), 44_100, 2);
    const mdat = boxes(file, 0, file.length).get("mdat");
    expect(mdat && mdat.end - mdat.body).toBe(500_000);
  });
});
