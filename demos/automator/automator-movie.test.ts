import { describe, expect, it } from "vitest";
import { parseMp4Moov } from "../music/music-tags";
import { annotatedMovie, NotAMovie } from "./automator-movie";

const ascii = (text: string) => Uint8Array.from(text, (char) => char.charCodeAt(0));

function box(type: string, ...parts: readonly Uint8Array[]): Uint8Array {
  const size = 8 + parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, size);
  out.set(ascii(type), 4);
  let at = 8;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const item = (type: string, text: string) =>
  box(type, box("data", Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 0), ascii(text)));

const NOTES = { title: "Beach", author: "Ann", description: "Waves", copyright: "2019 Ann" };
const SAMPLES = ascii("the samples");

/** The `moov` of a movie's bytes, the last one, and what stands before it. */
async function read(movie: Blob) {
  const bytes = new Uint8Array(await movie.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const types: string[] = [];
  let moov = new Uint8Array();
  for (let at = 0; at < bytes.length; at += view.getUint32(at)) {
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    types.push(type);
    if (type === "moov") moov = bytes.subarray(at, at + view.getUint32(at));
  }
  return { bytes, types, tags: parseMp4Moov(moov), moov };
}

describe("annotating a movie", () => {
  it("adds the annotations and leaves every sample at its offset", async () => {
    const ftyp = box("ftyp", ascii("isom"));
    const moov = box("moov", box("mvhd", new Uint8Array(4)));
    const mdat = box("mdat", SAMPLES);
    const movie = new Blob([ftyp, moov, mdat] as BlobPart[], { type: "video/mp4" });

    const annotated = await annotatedMovie(movie, NOTES);
    const { bytes, types, tags, moov: written } = await read(annotated);

    expect(types).toEqual(["ftyp", "free", "mdat", "moov"]);
    expect(tags.title).toBe("Beach");
    expect(tags.artist).toBe("Ann");
    expect(tags.comments).toBe("Waves");
    expect(String.fromCharCode(...written)).toContain("mvhd");
    expect(String.fromCharCode(...written)).toContain("cprt");
    const samplesAt = ftyp.length + moov.length + 8;
    expect(String.fromCharCode(...bytes.subarray(samplesAt, samplesAt + 11))).toBe("the samples");
    expect(annotated.type).toBe("video/mp4");
  });

  it("replaces only the annotations it is given, in a movie that already has some", async () => {
    const meta = box(
      "meta",
      new Uint8Array(4),
      box("ilst", item("\u00a9nam", "Old"), item("\u00a9alb", "Summer")),
    );
    const movie = new Blob([box("ftyp"), box("moov", box("udta", meta))] as BlobPart[]);

    const { tags } = await read(
      await annotatedMovie(movie, { title: "New", author: "", description: "", copyright: "" }),
    );

    expect(tags.title).toBe("New");
    expect(tags.album).toBe("Summer");
    expect(tags.artist).toBeUndefined();
  });

  it("refuses a file that is not a QuickTime or MP4 movie, and says why", async () => {
    const webm = new Blob([Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5)]);
    await expect(annotatedMovie(webm, NOTES)).rejects.toThrow(NotAMovie);
    await expect(annotatedMovie(webm, NOTES)).rejects.toThrow(
      "only a QuickTime or MP4 file has a place for them.",
    );
  });

  it("refuses a movie with no movie box", async () => {
    await expect(annotatedMovie(new Blob([box("ftyp")] as BlobPart[]), NOTES)).rejects.toThrow(
      "it has no movie box.",
    );
  });
});
