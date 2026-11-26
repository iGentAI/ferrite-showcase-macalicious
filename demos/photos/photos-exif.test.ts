import { describe, expect, it } from "vitest";
import { exifDate, readExif } from "./photos-exif";

/** A JPEG whose APP1 segment holds a big-endian TIFF with the given ASCII tags. */
function exifJpeg(tags: { make?: string; model?: string; dateTime?: string; original?: string }) {
  const first: [number, string][] = [];
  if (tags.make) first.push([0x010f, tags.make]);
  if (tags.model) first.push([0x0110, tags.model]);
  if (tags.dateTime) first.push([0x0132, tags.dateTime]);
  const sub: [number, string][] = tags.original ? [[0x9003, tags.original]] : [];
  const firstCount = first.length + (sub.length ? 1 : 0);
  const ifd0 = 8;
  const ifd0Size = 2 + firstCount * 12 + 4;
  const subIfd = ifd0 + ifd0Size;
  const subSize = sub.length ? 2 + sub.length * 12 + 4 : 0;
  let data = subIfd + subSize;
  const tiff = new DataView(new ArrayBuffer(1024));
  tiff.setUint16(0, 0x4d4d);
  tiff.setUint16(2, 42);
  tiff.setUint32(4, ifd0);
  const write = (ifd: number, entries: [number, string][], extra?: [number, number]) => {
    const count = entries.length + (extra ? 1 : 0);
    tiff.setUint16(ifd, count);
    let at = ifd + 2;
    for (const [tag, text] of entries) {
      const bytes = `${text}\0`;
      tiff.setUint16(at, tag);
      tiff.setUint16(at + 2, 2);
      tiff.setUint32(at + 4, bytes.length);
      tiff.setUint32(at + 8, data);
      for (let i = 0; i < bytes.length; i += 1) tiff.setUint8(data + i, bytes.charCodeAt(i));
      data += bytes.length;
      at += 12;
    }
    if (extra) {
      tiff.setUint16(at, extra[0]);
      tiff.setUint16(at + 2, 4);
      tiff.setUint32(at + 4, 1);
      tiff.setUint32(at + 8, extra[1]);
    }
  };
  write(ifd0, first, sub.length ? [0x8769, subIfd] : undefined);
  if (sub.length) write(subIfd, sub);
  const body = new Uint8Array(tiff.buffer, 0, data);
  const header = [..."Exif"].map((c) => c.charCodeAt(0)).concat([0, 0]);
  const length = 2 + header.length + body.length;
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    length >> 8,
    length & 0xff,
    ...header,
    ...body,
    0xff,
    0xda,
    0,
    2,
  ]);
}

describe("EXIF data", () => {
  it("gives the time a photo was taken, preferring the original's, and its camera", () => {
    const facts = readExif(
      exifJpeg({
        make: "Canon",
        model: "Canon EOS R",
        dateTime: "2020:01:01 00:00:00",
        original: "2019:10:07 14:03:22",
      }),
    );
    expect(facts.takenMs).toBe(new Date(2019, 9, 7, 14, 3, 22).getTime());
    expect(facts.camera).toBe("Canon EOS R");
  });

  it("falls back to the file's date and joins a make the model leaves out", () => {
    const facts = readExif(
      exifJpeg({ make: "Apple", model: "iPhone 11", dateTime: "2019:12:24 08:30:00" }),
    );
    expect(facts.takenMs).toBe(new Date(2019, 11, 24, 8, 30, 0).getTime());
    expect(facts.camera).toBe("Apple iPhone 11");
  });

  it("is nothing for a picture without it or a file that is not a JPEG", () => {
    expect(readExif(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toEqual({});
    expect(readExif(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({});
    // Cut short in the middle of its segment.
    expect(readExif(exifJpeg({ make: "Canon" }).slice(0, 20))).toEqual({});
    // "Exif" without its two zero bytes, or a TIFF header without its 42, is not EXIF.
    const unsigned = exifJpeg({ make: "Canon", model: "EOS R" });
    unsigned[10] = 1;
    expect(readExif(unsigned)).toEqual({});
    const wrongMagic = exifJpeg({ make: "Canon", model: "EOS R" });
    wrongMagic[15] = 43;
    expect(readExif(wrongMagic)).toEqual({});
  });

  it("reads only well-formed dates", () => {
    expect(exifDate("2019:10:07 14:03:22")).toBe(new Date(2019, 9, 7, 14, 3, 22).getTime());
    expect(exifDate("0000:00:00 00:00:00")).toBeUndefined();
    expect(exifDate("2019:02:31 10:00:00")).toBeUndefined();
    expect(exifDate("2019:10:07 25:00:00")).toBeUndefined();
    expect(exifDate("yesterday")).toBeUndefined();
    expect(exifDate("2019:10:07 14:03:22garbage")).toBeUndefined();
  });

  it("keeps dates before 1970 and before 1900, back to the year 1", () => {
    expect(exifDate("1955:06:15 09:30:00")).toBe(new Date(1955, 5, 15, 9, 30, 0).getTime());
    expect(exifDate("1899:10:07 14:03:22")).toBe(new Date(1899, 9, 7, 14, 3, 22).getTime());
    const yearOne = new Date(2000, 0, 1, 12, 0, 0);
    yearOne.setFullYear(1, 0, 1);
    expect(exifDate("0001:01:01 12:00:00")).toBe(yearOne.getTime());
    // A two-digit year is not read as the 1900s.
    expect(new Date(exifDate("0050:03:01 08:00:00") ?? 0).getFullYear()).toBe(50);
    expect(exifDate("1899:02:29 10:00:00")).toBeUndefined();
    expect(exifDate("1899:13:01 10:00:00")).toBeUndefined();
  });

  it("falls back to the file's date when the original's cannot be read", () => {
    const facts = readExif(
      exifJpeg({ dateTime: "2019:12:24 08:30:00", original: "2019:02:31 10:00:00" }),
    );
    expect(facts.takenMs).toBe(new Date(2019, 11, 24, 8, 30, 0).getTime());
  });

  it("reads nothing from a segment that runs past the file", () => {
    const whole = exifJpeg({ make: "Canon", model: "EOS R" });
    // Keep the first entries but cut the segment short of its stated length.
    expect(readExif(whole.slice(0, whole.length - 8))).toEqual({});
  });
});
