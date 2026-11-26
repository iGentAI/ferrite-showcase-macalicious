import { describe, expect, it } from "vitest";
import {
  audioType,
  bytesReader,
  isSongFile,
  parseId3v1,
  readSongTags,
  titleFromFileName,
} from "./music-tags";

const enc = new TextEncoder();
const bytes = (...parts: (number[] | Uint8Array | string)[]) => {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === "string") for (const c of part) out.push(c.charCodeAt(0) & 0xff);
    else out.push(...part);
  }
  return Uint8Array.from(out);
};
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const synchsafe = (n: number) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
const utf16le = (text: string) => [
  0xff,
  0xfe,
  ...[...text].flatMap((c) => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8]),
];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];

const read = (file: Uint8Array) => readSongTags(bytesReader(file), file.length);

function id3v23(frames: [string, number[] | Uint8Array][]) {
  const body = bytes(...frames.flatMap(([id, data]) => [id, be32(data.length), [0, 0], data]));
  return bytes("ID3", [3, 0, 0], synchsafe(body.length), body);
}

describe("isSongFile", () => {
  it("leaves a movie to QuickTime Player, by its type or an untyped .mp4", () => {
    expect(isSongFile({ name: "Clip.mp4", type: "video/mp4" })).toBe(false);
    expect(isSongFile({ name: "Clip.mp4" })).toBe(false);
  });

  it("takes sound, in an .mp4 too when the type says so", () => {
    expect(isSongFile({ name: "Song.mp4", type: "audio/mp4" })).toBe(true);
    expect(isSongFile({ name: "Song.m4a" })).toBe(true);
  });
});

describe("Music's tag reader", () => {
  it("reads lyrics with their line breaks, the grouping and a comment from ID3v2.3", async () => {
    const tags = await read(
      id3v23([
        ["USLT", bytes([0], "eng", "desc", [0], "First line\r\nSecond line")],
        ["TIT1", bytes([0], "Morning")],
        ["COMM", bytes([0], "eng", [0], "From a tape")],
      ]),
    );
    expect(tags.lyrics).toBe("First line\nSecond line");
    expect(tags.grouping).toBe("Morning");
    expect(tags.comments).toBe("From a tape");
  });
  it("reads the composer from ID3v2.3", async () => {
    const tags = await read(id3v23([["TCOM", bytes([0], "Ada Row")]]));
    expect(tags.composer).toBe("Ada Row");
  });
  it("reads ID3v2.3 text in Latin-1 and UTF-16, numbered genres, the track and the picture", async () => {
    const tag = id3v23([
      ["TIT2", [1, ...utf16le("Héllo Wörld"), 0, 0]],
      ["TPE1", bytes([0], "Ada Rowan")],
      ["TALB", bytes([0], "Paper Lanterns")],
      ["TRCK", bytes([0], "3/12")],
      ["TYER", bytes([0], "2018")],
      ["TCON", bytes([0], "(17)")],
      ["APIC", bytes([0], "image/png", [0, 3], "cover", [0], PNG)],
    ]);
    const file = bytes(tag, [0xff, 0xfb, 0x90, 0x00], new Array(200).fill(0));
    const tags = await read(file);
    expect(tags).toMatchObject({
      title: "Héllo Wörld",
      artist: "Ada Rowan",
      album: "Paper Lanterns",
      track: 3,
      year: 2018,
      genre: "Rock",
    });
    expect(tags.picture?.type).toBe("image/png");
    expect([...(tags.picture?.data ?? [])]).toEqual(PNG);
  });

  it("reads ID3v2.4's synchsafe frames, UTF-8 text, TDRC dates and the first of several values", async () => {
    const frame = (id: string, data: Uint8Array) => bytes(id, synchsafe(data.length), [0, 0], data);
    const body = bytes(
      frame("TIT2", bytes([3], enc.encode("Café ☕"))),
      frame("TCON", bytes([3], "Jazz", [0], "Funk")),
      frame("TDRC", bytes([3], "2014-02-10")),
    );
    const tags = await read(bytes("ID3", [4, 0, 0], synchsafe(body.length), body));
    expect(tags).toMatchObject({ title: "Café ☕", genre: "Jazz", year: 2014 });
  });

  it("reads ID3v2.2's three-letter frames and its PIC picture", async () => {
    const frame = (id: string, data: Uint8Array) =>
      bytes(id, [(data.length >> 16) & 255, (data.length >> 8) & 255, data.length & 255], data);
    const body = bytes(
      frame("TT2", bytes([0], "Old Song")),
      frame("TP1", bytes([0], "Old Band")),
      frame("PIC", bytes([0], "PNG", [3], [0], PNG)),
    );
    const tags = await read(bytes("ID3", [2, 0, 0], synchsafe(body.length), body));
    expect(tags).toMatchObject({ title: "Old Song", artist: "Old Band" });
    expect(tags.picture?.type).toBe("image/png");
  });

  it("falls back on ID3v1 for what ID3v2 does not say", async () => {
    const v1 = new Uint8Array(128);
    v1.set(bytes("TAG"), 0);
    v1.set(bytes("V1 Title"), 3);
    v1.set(bytes("V1 Artist"), 33);
    v1.set(bytes("V1 Album"), 63);
    v1.set(bytes("1999"), 93);
    v1[126] = 7;
    v1[127] = 80;
    expect(parseId3v1(v1)).toMatchObject({
      title: "V1 Title",
      track: 7,
      genre: "Folk",
      year: 1999,
    });
    const tag = id3v23([["TIT2", bytes([0], "V2 Title")]]);
    const tags = await read(bytes(tag, new Array(300).fill(0), v1));
    expect(tags).toMatchObject({ title: "V2 Title", artist: "V1 Artist", album: "V1 Album" });
  });

  it("reads an MP4 file's ilst atoms", async () => {
    const box = (type: string, ...content: (number[] | Uint8Array)[]) => {
      const body = bytes(...content);
      return bytes(be32(body.length + 8), type, body);
    };
    const data = (kind: number, value: number[] | Uint8Array) =>
      box("data", be32(kind), [0, 0, 0, 0], value);
    const ilst = box(
      "ilst",
      box("\u00a9nam", data(1, enc.encode("M4A Song"))),
      box("\u00a9ART", data(1, enc.encode("M4A Artist"))),
      box("\u00a9alb", data(1, enc.encode("M4A Album"))),
      box("\u00a9day", data(1, enc.encode("2020-01-01"))),
      box("trkn", data(0, [0, 0, 0, 4, 0, 10, 0, 0])),
      box("covr", data(14, PNG)),
    );
    const moov = box(
      "moov",
      box("mvhd", new Array(20).fill(0)),
      box("udta", box("meta", [0, 0, 0, 0], ilst)),
    );
    const file = bytes(
      box("ftyp", bytes("M4A "), [0, 0, 0, 0]),
      box("mdat", new Array(64).fill(1)),
      moov,
    );
    const tags = await read(file);
    expect(tags).toMatchObject({
      title: "M4A Song",
      artist: "M4A Artist",
      album: "M4A Album",
      year: 2020,
      track: 4,
    });
    expect(tags.picture?.type).toBe("image/png");
  });

  const vorbis = (entries: string[]) =>
    bytes(
      le32(6),
      "vendor",
      le32(entries.length),
      ...entries.flatMap((entry) => {
        const encoded = enc.encode(entry);
        return [le32(encoded.length), encoded];
      }),
    );

  it("reads a FLAC file's Vorbis comments and its PICTURE block", async () => {
    const comments = vorbis([
      "TITLE=Flac Song",
      "artist=Flac Artist",
      "ALBUM=Flac Album",
      "TRACKNUMBER=2/9",
      "DATE=2001",
    ]);
    const picture = bytes(
      be32(3),
      be32(9),
      "image/png",
      be32(0),
      new Array(16).fill(0),
      be32(PNG.length),
      PNG,
    );
    const block = (type: number, last: boolean, body: Uint8Array) =>
      bytes(
        [
          type | (last ? 0x80 : 0),
          (body.length >> 16) & 255,
          (body.length >> 8) & 255,
          body.length & 255,
        ],
        body,
      );
    const file = bytes(
      "fLaC",
      block(0, false, new Uint8Array(34)),
      block(4, false, comments),
      block(6, true, picture),
    );
    const tags = await read(file);
    expect(tags).toMatchObject({
      title: "Flac Song",
      artist: "Flac Artist",
      album: "Flac Album",
      track: 2,
      year: 2001,
    });
    expect([...(tags.picture?.data ?? [])]).toEqual(PNG);
  });

  it("reads an Ogg Vorbis comment packet that spans pages, with its picture, whatever its bytes say", async () => {
    const picture = bytes(
      be32(3),
      be32(9),
      "image/png",
      be32(150),
      new Array(150).fill(0x41),
      new Array(16).fill(0),
      be32(PNG.length),
      PNG,
    );
    const base64 = btoa(String.fromCharCode(...picture));
    expect(base64.length).toBeGreaterThan(200);
    const comments = bytes(
      [3],
      "vorbis",
      vorbis([
        "TITLE=Ogg Song",
        "ARTIST=Ogg Artist",
        // A capture pattern inside the packet is data, not a page.
        "COMMENT=OggS in the middle of a comment",
        `METADATA_BLOCK_PICTURE=${base64}`,
      ]),
      [1],
    );
    expect(comments.length).toBeGreaterThan(255);
    /** A page of `segments` (lace values) holding `body`; `flag` 1 continues a packet. */
    const page = (flag: number, segments: number[], body: Uint8Array) =>
      bytes("OggS", [0, flag], new Array(20).fill(0), [segments.length], segments, body);
    const laces = (length: number) => {
      const out = new Array(Math.floor(length / 255)).fill(255);
      return [...out, length % 255];
    };
    const identification = bytes([1], "vorbis", new Array(23).fill(0));
    const first = comments.subarray(0, 255);
    const rest = comments.subarray(255);
    const file = bytes(
      page(0, [identification.length], identification),
      page(0, [255], first),
      page(1, laces(rest.length), rest),
    );
    const tags = await read(file);
    expect(tags).toMatchObject({ title: "Ogg Song", artist: "Ogg Artist" });
    expect([...(tags.picture?.data ?? [])]).toEqual(PNG);
  });

  it("undoes ID3v2.4 unsynchronisation that the tag header declares for every frame", async () => {
    const frame = (id: string, data: Uint8Array) => bytes(id, synchsafe(data.length), [0, 0], data);
    const body = frame("TIT2", bytes([0], "A", [0xff, 0x00], "B"));
    const tags = await read(bytes("ID3", [4, 0, 0x80], synchsafe(body.length), body));
    expect(tags.title).toBe("A\u00ffB");
  });

  it("skips the group id byte of grouped ID3v2.3 frames", async () => {
    const body = bytes("TIT2", be32(10), [0, 0x20], [0x07, 0], "Grouped!");
    const tags = await read(bytes("ID3", [3, 0, 0], synchsafe(body.length), body));
    expect(tags.title).toBe("Grouped!");
  });

  it("reads a WAV file's INFO list", async () => {
    const sub = (id: string, text: string) => {
      const value = bytes(enc.encode(text), [0]);
      return bytes(id, le32(value.length), value, value.length % 2 ? [0] : []);
    };
    const info = bytes(
      "INFO",
      sub("INAM", "Wav Song"),
      sub("IART", "Wav Artist"),
      sub("IPRD", "Wav Album"),
      sub("ITRK", "5"),
    );
    const fmt = bytes("fmt ", le32(16), new Array(16).fill(0));
    const data = bytes("data", le32(8), new Array(8).fill(0));
    const body = bytes("WAVE", fmt, "LIST", le32(info.length), info, data);
    const file = bytes("RIFF", le32(body.length), body);
    expect(await read(file)).toMatchObject({
      title: "Wav Song",
      artist: "Wav Artist",
      album: "Wav Album",
      track: 5,
    });
  });

  it("names an untagged file after itself, and knows song files by type or extension", async () => {
    expect(await read(new Uint8Array(400))).toEqual({});
    expect(titleFromFileName("01_Morning_Walk.mp3")).toBe("01 Morning Walk");
    expect(titleFromFileName(".mp3")).toBe(".mp3");
    expect(audioType({ name: "a.FLAC", type: "" })).toBe("audio/flac");
    expect(audioType({ name: "a.bin", type: "audio/x-m4a" })).toBe("audio/x-m4a");
    expect(audioType({ name: "notes.txt", type: "text/plain" })).toBeUndefined();
  });
});
