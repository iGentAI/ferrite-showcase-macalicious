import { describe, expect, it } from "vitest";
import { decodeText, encodeText, UnencodableTextError } from "./textedit-encodings";
import { documentFromBytes, fileBlob, UnsupportedEncodingError } from "./textedit-files";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("plain text encodings", () => {
  it("writes each encoding's own bytes", () => {
    expect([...encodeText("café", "utf-8")]).toEqual([0x63, 0x61, 0x66, 0xc3, 0xa9]);
    expect([...encodeText("é", "windows-1252")]).toEqual([0xe9]);
    expect([...encodeText("é", "macintosh")]).toEqual([0x8e]);
    expect([...encodeText("é", "utf-16")]).toEqual([0xff, 0xfe, 0xe9, 0x00]);
    expect([...encodeText("あ", "shift_jis")]).toEqual([0x82, 0xa0]);
  });

  it("refuses a character the encoding does not hold, naming the encoding", () => {
    expect(() => encodeText("あ", "windows-1252")).toThrow(UnencodableTextError);
    expect(() => encodeText("あ", "windows-1252")).toThrow(
      "The text has characters that can’t be saved as Western (Windows Latin 1). Choose another encoding.",
    );
  });

  it("reads a byte order mark, UTF-8, or the encoding chosen, and never guesses", () => {
    expect(decodeText(bytes(0xff, 0xfe, 0xe9, 0x00))).toEqual({ text: "é", encoding: "utf-16" });
    expect(decodeText(bytes(0xfe, 0xff, 0x00, 0xe9))).toEqual({ text: "é", encoding: "utf-16" });
    expect(decodeText(bytes(0xc3, 0xa9))).toEqual({ text: "é", encoding: "utf-8" });
    expect(decodeText(bytes(0xe9))).toBeNull();
    expect(decodeText(bytes(0xe9), "windows-1252")).toEqual({
      text: "é",
      encoding: "windows-1252",
    });
  });

  it("opens a file in the encoding asked for, keeps that encoding, and writes it back", async () => {
    const opened = documentFromBytes("Old.txt", bytes(0x63, 0xe9), document, "windows-1252");
    expect(opened.document.lines).toEqual(["cé"]);
    expect(opened.encoding).toBe("windows-1252");
    const blob = fileBlob("cé", "Old.txt", "plain", opened.encoding);
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([0x63, 0xe9]);
    expect(blob.type).toBe("text/plain;charset=windows-1252");
  });

  it("still refuses other bytes unasked, as a file in an unknown encoding", () => {
    expect(() => documentFromBytes("Old.txt", bytes(0x63, 0xe9), document)).toThrow(
      UnsupportedEncodingError,
    );
  });
});
