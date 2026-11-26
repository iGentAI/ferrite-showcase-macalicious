import { describe, expect, it } from "vitest";
import { attachedFile, attachmentHtml, pictureHeader, pictureHtml } from "./textedit-picture";
import {
  linesOfParagraphs,
  paragraphsOfContent,
  paragraphsToHtml,
  readRtf,
  writeRtf,
} from "./textedit-rtf";
import { contentToHtml, htmlToContent } from "./textedit-server";

/** A one-pixel PNG. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==";
const pngBytes = () => Uint8Array.from(atob(PNG_BASE64), (char) => char.charCodeAt(0));
const PNG_SOURCE = `data:image/png;base64,${PNG_BASE64}`;

const contentOf = (html: string) => htmlToContent(html, document);
const roundTrip = (html: string) => {
  const { paragraphs } = readRtf(writeRtf(paragraphsOfContent(contentOf(html))));
  return contentToHtml(contentOf(paragraphsToHtml(paragraphs)));
};

describe("pictures", () => {
  it("reads a PNG's and a JPEG's size from its header, and nothing else", () => {
    expect(pictureHeader(pngBytes())).toEqual({ type: "png", width: 1, height: 1 });
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x20,
      0x00, 0x40, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(pictureHeader(jpeg)).toEqual({ type: "jpeg", width: 64, height: 32 });
    expect(pictureHeader(new TextEncoder().encode("GIF89a.............."))).toBeNull();
  });

  it("makes an img held in the text", () => {
    expect(pictureHtml(pngBytes())).toBe(`<img src="${PNG_SOURCE}" width="1" height="1">`);
    expect(pictureHtml(new TextEncoder().encode("not a picture"))).toBeNull();
  });

  it("keeps a picture through an RTF file, at its size, with the text around it", () => {
    const html = `<div>Before <img src="${PNG_SOURCE}" width="120" height="80"> after</div>`;
    const written = writeRtf(paragraphsOfContent(contentOf(html)));
    expect(written).toContain("{\\pict\\pngblip\\picw120\\pich80\\picwgoal2400\\pichgoal1600");
    expect(roundTrip(html)).toBe(html);
    const { paragraphs } = readRtf(written);
    expect(linesOfParagraphs(paragraphs)).toEqual(["Before  after"]);
  });

  it("reads the picture of a Word RTF file and leaves its stand-in out", () => {
    const hex = [...pngBytes()].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const { paragraphs } = readRtf(
      `{\\rtf1\\ansi{\\*\\shppict{\\pict\\pngblip\\picw10\\pich10\\picwgoal400\\pichgoal200\\picscalex50\\picscaley100 ${hex}}}{\\nonshppict{\\pict\\wmetafile8 00ff}}Text\\par}`,
    );
    expect(paragraphs[0]?.runs.map((run) => run.picture ?? run.text)).toEqual([
      { src: PNG_SOURCE, width: 10, height: 10 },
      "Text",
    ]);
  });

  it("drops a picture of a kind the file formats do not hold, without its text", () => {
    const { paragraphs } = readRtf("{\\rtf1\\ansi A{\\pict\\wmetafile8 00ff}B\\par}");
    expect(linesOfParagraphs(paragraphs)).toEqual(["AB"]);
  });

  it("lets through a stored picture only as a PNG or JPEG in the text itself", () => {
    expect(contentToHtml(contentOf(`<img src="${PNG_SOURCE}" onerror="x()" width="1">`))).toBe(
      `<img src="${PNG_SOURCE}" width="1">`,
    );
    expect(contentToHtml(contentOf('<img src="https://example.com/a.png">'))).toBe("");
    expect(contentToHtml(contentOf('<img src="data:image/svg+xml;base64,AAAA">'))).toBe("");
  });
});

describe("links in an RTF file", () => {
  it("keeps a link as a HYPERLINK field that other readers understand", () => {
    const html = '<div>See <a href="https://example.com/a">the page</a>.</div>';
    const written = writeRtf(paragraphsOfContent(contentOf(html)));
    expect(written).toContain(
      '{\\field{\\*\\fldinst{HYPERLINK "https://example.com/a"}}{\\fldrslt ',
    );
    expect(roundTrip(html)).toBe(html);
  });

  it("reads a field as TextEdit writes it, its result's format included", () => {
    const { paragraphs } = readRtf(
      '{\\rtf1\\ansi{\\field{\\*\\fldinst{HYPERLINK "http://a.example/"}}{\\fldrslt \\b Go}}\\par}',
    );
    expect(paragraphs[0]?.runs[0]?.text).toBe("Go");
    expect(paragraphs[0]?.runs[0]?.style.link).toBe("http://a.example/");
    expect(paragraphs[0]?.runs[0]?.style.bold).toBe(true);
  });

  it("keeps the text of a field that is no web link, without the link", () => {
    const { paragraphs } = readRtf(
      '{\\rtf1\\ansi{\\field{\\*\\fldinst{HYPERLINK "javascript:x()"}}{\\fldrslt Go}}{\\field{\\*\\fldinst{PAGE}}{\\fldrslt 3}}\\par}',
    );
    expect(linesOfParagraphs(paragraphs)).toEqual(["Go3"]);
    expect(paragraphs[0]?.runs[0]?.style.link).toBeUndefined();
  });
});

describe("attachments", () => {
  it("are a link to the drive file with its name, kept through the draft and an RTF file", () => {
    const html = attachmentHtml("abc123", "Report <1>.pdf");
    expect(html).toBe(
      '<a href="drive:abc123" contenteditable="false">Report &lt;1&gt;.pdf</a>&nbsp;',
    );
    const made = contentToHtml(contentOf(`<div>${html}</div>`));
    expect(made).toBe(`<div>${html}</div>`);
    expect(roundTrip(`<div>${html}</div>`)).toBe(`<div>${html}</div>`);
    expect(attachedFile("drive:abc123")).toBe("abc123");
    expect(attachedFile("https://example.com")).toBeUndefined();
  });

  it("accept no other address", () => {
    expect(contentToHtml(contentOf('<a href="drive:../x">x</a>'))).toBe("x");
    expect(contentToHtml(contentOf('<a href="javascript:x()">x</a>'))).toBe("x");
  });
});
