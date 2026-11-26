import { describe, expect, it } from "vitest";
import { readTextTracks } from "./quicktime-player-tracks";

const word = (value: number) => [
  (value >>> 24) & 255,
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
const text = (value: string) => [...new TextEncoder().encode(value)];
const box = (type: string, ...body: number[][]) => {
  const content = body.flat();
  return [...word(content.length + 8), ...text(type), ...content];
};

/** An MP4 of one text track: `samples` follow the `ftyp`, then its `moov` tables point at them. */
function mp4(format: string, samples: number[][], language = [0x15, 0xc7]) {
  const ftyp = box("ftyp", text("isom"), word(0));
  const offset = ftyp.length + 8;
  const mdat = box("mdat", ...samples);
  const stbl = box(
    "stbl",
    box("stsd", word(0), word(1), box(format, [0, 0, 0, 0, 0, 0, 0, 1])),
    box("stts", word(0), word(1), word(samples.length), word(2000)),
    box("stsc", word(0), word(1), word(1), word(samples.length), word(1)),
    box(
      "stsz",
      word(0),
      word(0),
      word(samples.length),
      ...samples.map((each) => word(each.length)),
    ),
    box("stco", word(0), word(1), word(offset)),
  );
  const mdhd = box("mdhd", word(0), word(0), word(0), word(1000), word(10000), language, [0, 0]);
  const tkhd = box("tkhd", word(0), word(0), word(0), word(7), word(0));
  const moov = box("moov", box("trak", tkhd, box("mdia", mdhd, box("minf", stbl))));
  return new Blob([new Uint8Array([...ftyp, ...mdat, ...moov])]);
}
const tx3g = (line: string) => {
  const bytes = text(line);
  return [(bytes.length >> 8) & 255, bytes.length & 255, ...bytes];
};

const ebml = (id: number[], ...body: number[][]) => {
  const content = body.flat();
  return [
    ...id,
    0x10 | ((content.length >>> 24) & 15),
    ...word(content.length).slice(1),
    ...content,
  ];
};

/** A WebM of one text track, cues given in milliseconds of one cluster at `base`. */
function webm(codec: string, cues: { at: number; ms: number; line: string }[], base = 1000) {
  const entry = ebml(
    [0xae],
    ebml([0xd7], [3]),
    ebml([0x83], [0x11]),
    ebml([0x86], text(codec)),
    ebml([0x22, 0xb5, 0x9c], text("fra")),
  );
  const blocks = cues.flatMap(({ at, ms, line }) =>
    ebml(
      [0xa0],
      ebml([0xa1], [0x83, (at >> 8) & 255, at & 255, 0], text(line)),
      ebml([0x9b], [(ms >> 8) & 255, ms & 255]),
    ),
  );
  const segment = ebml(
    [0x18, 0x53, 0x80, 0x67],
    ebml([0x15, 0x49, 0xa9, 0x66], ebml([0x2a, 0xd7, 0xb1], [0x0f, 0x42, 0x40])),
    ebml([0x16, 0x54, 0xae, 0x6b], entry),
    ebml([0x1f, 0x43, 0xb6, 0x75], ebml([0xe7], [(base >> 8) & 255, base & 255]), blocks),
  );
  return new Blob([new Uint8Array([...ebml([0x1a, 0x45, 0xdf, 0xa3], []), ...segment])]);
}

describe("the text tracks inside a movie file", () => {
  it("reads an MP4's tx3g samples with their times and language", async () => {
    await expect(
      readTextTracks(mp4("tx3g", [tx3g("Hello"), tx3g(""), tx3g("Café")])),
    ).resolves.toEqual([
      {
        id: 7,
        language: "eng",
        label: "English",
        cues: [
          { start: 0, end: 2, text: "Hello" },
          { start: 4, end: 6, text: "Café" },
        ],
      },
    ]);
  });

  it("reads an MP4's wvtt samples, a gap being none", async () => {
    const cue = box("vttc", box("payl", text("Line one")));
    const [track] = await readTextTracks(mp4("wvtt", [box("vtte"), cue]));
    expect(track?.cues).toEqual([{ start: 2, end: 4, text: "Line one" }]);
  });

  it("reads a WebM's D_WEBVTT blocks, without their identifier and settings lines", async () => {
    const [track] = await readTextTracks(
      webm("D_WEBVTT/SUBTITLES", [{ at: 500, ms: 1000, line: "\n\nBonjour\nà tous" }]),
    );
    expect(track).toEqual({
      id: 3,
      language: "fra",
      label: "French",
      cues: [{ start: 1.5, end: 2.5, text: "Bonjour\nà tous" }],
    });
  });

  it("reads a WebM's S_TEXT/UTF8 blocks", async () => {
    const [track] = await readTextTracks(webm("S_TEXT/UTF8", [{ at: 0, ms: 250, line: "Salut" }]));
    expect(track?.cues).toEqual([{ start: 1, end: 1.25, text: "Salut" }]);
  });

  it("finds none in a movie without them or in another kind of file", async () => {
    await expect(readTextTracks(mp4("mp4v", [tx3g("Not text")]))).resolves.toEqual([]);
    await expect(readTextTracks(new Blob(["RIFF....AVI "]))).resolves.toEqual([]);
    await expect(readTextTracks(new Blob([]))).resolves.toEqual([]);
  });
});
