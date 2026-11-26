import { describe, expect, it } from "vitest";
import { isBundleName, joinBundle, splitBundle } from "./textedit-rtfd";

/** A PNG's signature and header, 300 by 200 pixels: what `pictureHeader` reads. */
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1,
  0x2c, 0, 0, 0, 0xc8, 8, 6, 0, 0, 0,
]);
const HEX = [...PNG].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const WHOLE = `{\\rtf1 Before {\\pict\\pngblip\\picw300\\pich200\\picwgoal6000\\pichgoal4000\n${HEX}} after}`;

describe("a Rich Text With Graphics bundle", () => {
  it("takes the pictures out of the RTF into files it names", () => {
    const { text, pictures } = splitBundle(WHOLE);
    expect(pictures).toHaveLength(1);
    expect(pictures[0]?.name).toMatch(/^Pasted Graphic [0-9a-f]{8}\.png$/);
    expect([...(pictures[0]?.bytes ?? [])]).toEqual([...PNG]);
    expect(text).toBe(
      `{\\rtf1 Before {{\\NeXTGraphic ${pictures[0]?.name} \\width6000 \\height4000\n}\\'ac} after}`,
    );
  });

  it("names the same picture alike, so it is written once", () => {
    const twice = `${WHOLE}${WHOLE}`;
    expect(splitBundle(twice).pictures).toHaveLength(1);
  });

  it("puts them back as they were", () => {
    const { text, pictures } = splitBundle(WHOLE);
    const files = new Map(pictures.map(({ name, bytes }) => [name, bytes]));
    expect(joinBundle(text, files)).toBe(WHOLE);
  });

  it("reads a bundle a Mac wrote, and leaves what is not a picture as its name", () => {
    const mac =
      "{\\rtf1 {{\\NeXTGraphic Pasted Graphic.png \\width5760 \\height3600 \\appleattachmentpadding0 \\appleembedmedia\n}¬}{{\\NeXTGraphic notes.pdf \\width100 \\height100\n}¬}}";
    expect(joinBundle(mac, new Map([["Pasted Graphic.png", PNG]]))).toBe(
      `{\\rtf1 {\\pict\\pngblip\\picw300\\pich200\\picwgoal5760\\pichgoal3600\n${HEX}}notes.pdf}`,
    );
  });

  it("goes by the name's extension", () => {
    expect(["A.rtfd", "A.RTFD", "A.rtf", "rtfd"].map(isBundleName)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});
