import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  documentFromBytes,
  documentFromText,
  documentText,
  fileFitsFormat,
  fileNameFor,
  fileText,
  isTextDocument,
  nameInFormat,
  UNSUPPORTED_ENCODING,
  UnsupportedEncodingError,
} from "./textedit-files";
import {
  DEFAULT_STYLE,
  linesOfParagraphs,
  paragraphsOfContent,
  paragraphsOfLines,
  paragraphsToHtml,
  readRtf,
  rtfTextOfBytes,
  writeRtf,
} from "./textedit-rtf";
import { contentToHtml, htmlToContent } from "./textedit-server";

/*
 * TextEdit's documents as files: the RTF written from the rich text view and read back, RTF as
 * TextEdit on a Mac writes it, and the names and kinds of the drive's text files. What the drive
 * and the server keep is proved by the Rust tests and e2e/textedit-files-journey.mjs.
 */

/** The view's content as the browsers leave it after the format bar's commands (styleWithCSS). */
const STYLED =
  '<div style="text-align: center;">Here\'s to the <span style="font-weight: bold; font-style: italic;">crazy</span> ones</div>' +
  '<div data-spacing="1.5" style="line-height: 1.75;"><span style="text-decoration-line: underline line-through; color: rgb(255, 59, 48); background-color: rgb(255, 234, 0);">marked</span> and <span style="font-family: Georgia, serif; font-size: 18px;">large</span></div>' +
  '<div data-list="disc"><b>bold</b> <i>italic</i> <u>under</u> <s>struck</s> x<sup>2</sup></div>' +
  "<div><br></div>" +
  '<div style="text-align: right;">Braces {} and \\ slash, café € 😀\tend</div>';

const view = (html: string) => {
  const element = document.createElement("div");
  element.append(htmlToContent(html, document));
  return element;
};

describe("RTF", () => {
  it("keeps a document's properties in \\info, and reads those another program wrote", () => {
    const properties = {
      author: "Ada — Lovelace",
      organization: "Analytical {Co}",
      comment: "Back\\slash",
    };
    const read = readRtf(writeRtf([{ align: "left", runs: [] }], undefined, properties));
    expect(read.properties).toEqual(properties);
    expect(linesOfParagraphs(read.paragraphs)).toEqual([""]);
    const word = readRtf(
      "{\\rtf1\\ansi{\\info{\\title A}{\\author B\\'e9}{\\operator C}{\\creatim\\yr2020}{\\*\\company D}{\\*\\unknown E}}\\pard text\\par}",
    );
    expect(word.properties).toEqual({ title: "A", author: "Bé", organization: "D" });
    expect(word.paragraphs[0]?.runs[0]?.text).toBe("text");
  });

  it("has no \\info group without properties", () => {
    expect(writeRtf([{ align: "left", runs: [] }])).not.toContain("\\info");
    expect(readRtf(writeRtf([{ align: "left", runs: [] }])).properties).toBeUndefined();
  });

  it("keeps every format the format bar, the menus and the panels set through a file and back", () => {
    const before = paragraphsOfContent(view(STYLED));
    const ruler = { first: 36, head: 18, tail: 9, tabStops: [72, 144] };
    const read = readRtf(writeRtf(before, ruler));
    expect(read.paragraphs).toEqual(before);
    expect(read.ruler).toEqual(ruler);
    // Shown again in the view, the paragraphs are the same once more.
    const again = paragraphsOfContent(view(paragraphsToHtml(read.paragraphs)));
    expect(again).toEqual(before);
    expect(linesOfParagraphs(again)).toEqual([
      "Here's to the crazy ones",
      "marked and large",
      "bold italic under struck x2",
      "",
      "Braces {} and \\ slash, café € 😀\tend",
    ]);
  });

  it("keeps a paragraph's writing direction through a file and back", () => {
    const before = paragraphsOfContent(
      view('<div dir="rtl">a</div><div dir="ltr">b</div><div dir="auto">c</div><div>d</div>'),
    );
    expect(before.map((paragraph) => paragraph.direction)).toEqual([
      "rtl",
      "ltr",
      "auto",
      undefined,
    ]);
    const written = writeRtf(before);
    expect(written).toContain("\\rtlpar");
    expect(written).toContain("\\ltrpar");
    const read = readRtf(written);
    expect(read.paragraphs).toEqual(before);
    expect(paragraphsToHtml(read.paragraphs)).toContain('<div dir="rtl">');
  });

  it("keeps Align Left on a paragraph with a direction, and its own start without one", () => {
    const left = paragraphsOfContent(view('<div dir="rtl" style="text-align: left;">a</div>'));
    const html = paragraphsToHtml(readRtf(writeRtf(left)).paragraphs);
    expect(html).toContain("text-align: left");
    expect(html).toContain('dir="rtl"');
    const own = paragraphsOfContent(view('<div dir="rtl">a</div>'));
    expect(paragraphsToHtml(readRtf(writeRtf(own)).paragraphs)).not.toContain("text-align");
  });

  it("reads what each format of a paragraph and a run is", () => {
    const [first, second, third] = paragraphsOfContent(view(STYLED));
    expect(first?.align).toBe("center");
    expect(first?.runs[1]?.style).toMatchObject({ bold: true, italic: true });
    expect(second?.spacing).toBe("1.5");
    expect(second?.runs[0]?.style).toMatchObject({
      underline: true,
      strikethrough: true,
      color: "#ff3b30",
      highlight: "#ffea00",
    });
    expect(second?.runs[2]?.style).toMatchObject({ family: "Georgia", size: 18 });
    expect(third?.list).toBe("disc");
    expect(third?.runs.at(-1)?.style.script).toBe("super");
  });

  it("reads RTF as TextEdit on a Mac writes it", () => {
    const rtf = [
      "{\\rtf1\\ansi\\ansicpg1252\\cocoartf2513",
      "\\cocoatextscaling0\\cocoaplatform0{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;\\f1\\fswiss\\fcharset0 Helvetica-Bold;\\f2\\froman\\fcharset0 TimesNewRomanPSMT;}",
      "{\\colortbl;\\red255\\green255\\blue255;\\red251\\green2\\blue7;\\red0\\green0\\blue0;}",
      "{\\*\\expandedcolortbl;;\\cssrgb\\c100000\\c14913\\c0;}",
      "\\paperw11900\\paperh16840\\margl1440\\margr1440\\vieww11520\\viewh8400\\viewkind0",
      "\\pard\\tx566\\tx1133\\pardirnatural\\partightenfactor0",
      "",
      "\\f0\\fs24 \\cf3 Hello ",
      "\\f1\\b world",
      "\\f0\\b0 \\",
      "\\pard\\tx566\\pardirnatural\\qc\\partightenfactor0",
      "\\cf2 \\ul Centered red\\ulnone  caf\\'e9 \\uc0\\u8364 \\",
      "\\f2\\fs36 Times}",
    ].join("\n");
    const { paragraphs, ruler } = readRtf(rtf);
    expect(linesOfParagraphs(paragraphs)).toEqual(["Hello world", "Centered red café €", "Times"]);
    expect(paragraphs[0]?.runs.map((run) => [run.text, run.style.bold])).toEqual([
      ["Hello ", false],
      ["world", true],
    ]);
    // Black named by the colour table is that colour (only entry 0, or none, is the automatic
    // colour, which follows dark mode).
    expect(paragraphs[0]?.runs[0]?.style.color).toBe("#000000");
    expect(paragraphs[1]?.align).toBe("center");
    expect(paragraphs[1]?.runs[0]?.style).toMatchObject({ underline: true, color: "#fb0207" });
    expect(paragraphs[2]?.runs[0]?.style).toMatchObject({ family: "Times New Roman", size: 18 });
    expect(ruler?.tabStops).toEqual([28.3, 56.65]);
  });

  it("keeps a field's shown text and nothing of its instruction, and reads plain text as lines", () => {
    const { paragraphs } = readRtf(
      '{\\rtf1{\\field{\\*\\fldinst HYPERLINK "javascript:alert(1)"}{\\fldrslt click}} here\\par}',
    );
    expect(linesOfParagraphs(paragraphs)).toEqual(["click here"]);
    expect(linesOfParagraphs(readRtf("Just text\r\nTwo").paragraphs)).toEqual(["Just text", "Two"]);
  });

  it("shows a hostile file's fonts and colours through the view's allowlist only", () => {
    const { paragraphs } = readRtf(
      "{\\rtf1{\\fonttbl\\f0 x'); background: url(javascript:y);}\\f0 Evil\\par}",
    );
    const shown = view(paragraphsToHtml(paragraphs));
    expect(shown.textContent).toBe("Evil");
    expect(shown.innerHTML).not.toMatch(/url\(|javascript/);
  });

  it("keeps an empty block as a blank line, and adds none for a block that holds blocks", () => {
    const cases: [html: string, lines: string[]][] = [
      ["<div>A</div><div></div><div>B</div>", ["A", "", "B"]],
      ["<div>A</div><div><br></div><div>B</div>", ["A", "", "B"]],
      ["<div>A</div><div></div>", ["A", ""]],
      ["<div><div>A</div><div></div></div><div><div><p>B</p></div></div>", ["A", "", "B"]],
      ["<ul><li>one</li><li></li></ul><div>after</div>", ["one", "", "after"]],
      ["<div>A</div><p><span></span></p><div>B</div>", ["A", "", "B"]],
    ];
    for (const [html, lines] of cases) {
      const element = document.createElement("div");
      element.innerHTML = html;
      const before = paragraphsOfContent(element);
      expect(linesOfParagraphs(before), html).toEqual(lines);
      // Through a file and back, and shown in the view again: the same lines.
      const read = readRtf(writeRtf(before));
      expect(read.paragraphs, html).toEqual(before);
      const again = paragraphsOfContent(view(paragraphsToHtml(read.paragraphs)));
      expect(again, html).toEqual(before);
    }
    // The view's own content, through htmlToContent, keeps the blank line too.
    const shown = paragraphsOfContent(view("<div>A</div><div></div><div>B</div>"));
    expect(linesOfParagraphs(shown)).toEqual(["A", "", "B"]);
    const opened = documentFromText("Blank.rtf", writeRtf(shown), document);
    expect(opened.lines).toEqual(["A", "", "B"]);
  });

  it("skips a \\bin payload unread, whatever braces and backslashes it holds", () => {
    // Six bytes each: `}}AB\{` in a skipped picture, `}CD\{x` in a plain group.
    const rtf =
      "{\\rtf1\\ansi Before {\\*\\shppict{\\pict\\pngblip\\bin6 }}AB\\{}}after\\par\n" +
      "{\\bin6 }CD\\{x}More\\par\n" +
      // Five bytes in UTF-8: `é` is two.
      "{\\pict\\bin5 é{}\\}End\\par}";
    const { paragraphs } = readRtf(rtf);
    expect(linesOfParagraphs(paragraphs)).toEqual(["Before after", "More", "End"]);
    expect(linesOfParagraphs(paragraphs).join("")).not.toMatch(/AB|CD|é|[{}\\]/);
    // The groups closed where they should: the text after them has the document's format.
    expect(paragraphs[1]?.runs).toEqual([{ text: "More", style: paragraphs[0]?.runs[0]?.style }]);
    // A \bin and its payload are one fallback character of a \u.
    expect(linesOfParagraphs(readRtf("{\\rtf1\\uc1\\u65\\bin1 xB}").paragraphs)).toEqual(["AB"]);
  });

  it("reads \\sl as line spacing only with \\slmult1, and an explicit first colour as a colour", () => {
    const spacing = readRtf(
      "{\\rtf1\\ansi \\pard\\sl360\\slmult1 Wide\\par\\pard\\sl480\\slmult0 Exact\\par" +
        "\\pard\\sl-240 Exact too\\par}",
    ).paragraphs;
    expect(spacing[0]?.spacing).toBe("1.5");
    expect(spacing[1]?.spacing).toBeUndefined();
    expect(spacing[2]?.spacing).toBeUndefined();
    const red = readRtf("{\\rtf1\\ansi{\\colortbl\\red255\\green0\\blue0;}\\cf0 Red\\par}");
    expect(red.paragraphs[0]?.runs[0]?.style.color).toBe("#ff0000");
    const auto = readRtf(
      "{\\rtf1\\ansi{\\colortbl;\\red255\\green0\\blue0;}\\cf1 Red\\cf0  Auto\\par}",
    );
    expect(auto.paragraphs[0]?.runs.map((run) => run.style.color)).toEqual(["#ff0000", undefined]);
  });

  it("skips a control symbol that is a \\u's fallback, as it skips a character", () => {
    // \u160 (a no-break space) with \~ as its one fallback character, then X.
    expect(linesOfParagraphs(readRtf("{\\rtf1\\uc1\\u160\\~X\\par}").paragraphs)).toEqual([
      "\u00a0X",
    ]);
    expect(linesOfParagraphs(readRtf("{\\rtf1\\uc1\\u8209\\_Y\\par}").paragraphs)).toEqual([
      "\u2011Y",
    ]);
    expect(linesOfParagraphs(readRtf("{\\rtf1\\uc1\\u173\\-Z\\par}").paragraphs)).toEqual([
      "\u00adZ",
    ]);
    // Not a fallback: a no-break space of its own.
    expect(linesOfParagraphs(readRtf("{\\rtf1 a\\~b\\par}").paragraphs)).toEqual(["a\u00a0b"]);
  });

  it("keeps a no-break space, explicit black and white, and a group's paragraph format to its group", () => {
    // The document's own group keeps a last paragraph's format, ended without \par.
    expect(readRtf("{\\rtf1\\qc Centered}").paragraphs[0]?.align).toBe("center");
    // A no-break space read from a file stays one through the view's paragraphs and back.
    const read = readRtf("{\\rtf1 10\\~km and 5\\u160?m\\par}");
    expect(linesOfParagraphs(read.paragraphs)).toEqual(["10\u00a0km and 5\u00a0m"]);
    const html = paragraphsToHtml(read.paragraphs);
    const root = document.createElement("div");
    root.innerHTML = html;
    const again = readRtf(writeRtf(paragraphsOfContent(root)));
    expect(linesOfParagraphs(again.paragraphs)).toEqual(["10\u00a0km and 5\u00a0m"]);

    // Black text and a white highlight named by the colour table are those colours, not the
    // automatic ones; entry 0 is automatic.
    const colours = readRtf(
      "{\\rtf1{\\colortbl;\\red0\\green0\\blue0;\\red255\\green255\\blue255;}" +
        "\\cf1\\highlight2 Ink\\cf0\\highlight0  plain\\par}",
    );
    const [ink, plain] = colours.paragraphs[0]?.runs ?? [];
    expect(ink?.style.color).toBe("#000000");
    expect(ink?.style.highlight).toBe("#ffffff");
    expect(plain?.style.color).toBeUndefined();
    expect(plain?.style.highlight).toBeUndefined();
    // And they are written back as those colours.
    const back = readRtf(writeRtf(colours.paragraphs)).paragraphs[0]?.runs[0];
    expect(back?.style.color).toBe("#000000");
    expect(back?.style.highlight).toBe("#ffffff");

    // A paragraph format set in a group ends with the group.
    const grouped = readRtf("{\\rtf1{\\qc Centered\\par}Left\\par}").paragraphs;
    expect(grouped.map((paragraph) => paragraph.align)).toEqual(["center", "left"]);
    // A list style's group sets the paragraph's list, which stays.
    const listed = readRtf("{\\rtf1{\\*\\macaliciouslist disc}One\\par}").paragraphs;
    expect(listed[0]?.list).toBe("disc");
  });

  it("keeps a list's style and the number it starts at, through a file and through a draft", () => {
    const content = view(
      '<div data-list="roman" data-list-start="5">five</div><div data-list="roman">six</div><div>out</div>',
    );
    const written = writeRtf(paragraphsOfContent(content));
    expect(written).toContain("{\\*\\macaliciouslistat 5}");
    const { paragraphs } = readRtf(written);
    expect(paragraphs.map(({ list, listStart }) => [list, listStart])).toEqual([
      ["roman", 5],
      ["roman", undefined],
      [undefined, undefined],
    ]);
    const shown = view(paragraphsToHtml(paragraphs));
    const first = shown.firstElementChild as HTMLElement;
    expect(first.dataset.list).toBe("roman");
    expect(first.dataset.listStart).toBe("5");
    expect(view('<div data-list="roman" data-list-start="x">a</div>').innerHTML).not.toContain(
      "data-list-start",
    );
  });

  it("reads escaped bytes in Windows-1252, the one code page it opens", () => {
    expect(linesOfParagraphs(readRtf("{\\rtf1\\ansi caf\\'e9 \\'80\\par}").paragraphs)).toEqual([
      "café €",
    ]);
    const declared = readRtf(
      "{\\rtf1\\ansi\\ansicpg1252{\\fonttbl\\f0\\fcharset0 Arial;}\\f0 caf\\'e9\\par}",
    );
    expect(declared.unsupported).toBeUndefined();
    expect(linesOfParagraphs(declared.paragraphs)).toEqual(["café"]);
  });

  it("reads a font's name written with \\u in the font table, without its fallback characters", () => {
    const rtf =
      "{\\rtf1\\ansi\\deff0{\\fonttbl\\f0\\fswiss Helvetica;" +
      "\\f1\\fnil\\fcharset0 \\uc1\\u24494?\\u36719?Ya;}" +
      "\\f1 Hi\\par}";
    const { paragraphs } = readRtf(rtf);
    expect(linesOfParagraphs(paragraphs)).toEqual(["Hi"]);
    expect(paragraphs[0]?.runs[0]?.style.family).toBe("\u5fae\u8f6fYa");
  });
});

/** A file's bytes: each piece a string of byte values (`\x83`) or an array of bytes. */
const bytesOf = (...pieces: (string | number[])[]) =>
  Uint8Array.from(
    pieces.flatMap((piece) =>
      typeof piece === "string" ? Array.from(piece, (char) => char.charCodeAt(0)) : piece,
    ),
  );

/** The document a file's bytes are, read as `documentFromBytes` reads them. */
const readBytes = (bytes: Uint8Array) => {
  const text = rtfTextOfBytes(bytes);
  return { text, ...readRtf(text) };
};

describe("RTF read from its bytes", () => {
  it("opens TextEdit's own RTF, its text in every script as 7-bit escapes", () => {
    const own = writeRtf(paragraphsOfLines(["café € Привет こんにちは 😀"]));
    const opened = documentFromBytes("Own.rtf", new TextEncoder().encode(own), document);
    expect(opened.text).toBe(own);
    expect(opened.document.lines).toEqual(["café € Привет こんにちは 😀"]);
    // Opened again from its text, it is the same document.
    expect(documentFromText("again.rtf", own, document).lines).toEqual(opened.document.lines);
    expect(readRtf("{\\rtf1{\\*\\macaliciouslist disc}One\\par}").unsupported).toBeUndefined();
  });

  it("keeps a font's whole name unless what follows its hyphen is a face", () => {
    const fontOf = (name: string) =>
      readRtf(`{\\rtf1{\\fonttbl\\f0\\fnil ${name};}\\f0 Hi\\par}`).paragraphs[0]?.runs[0]?.style;
    expect(fontOf("My-Custom-Font")).toMatchObject({ family: "My-Custom-Font", bold: false });
    expect(fontOf("My-Custom-Font-BoldItalic")).toMatchObject({
      family: "My-Custom-Font",
      bold: true,
      italic: true,
    });
    expect(fontOf("Mine-BoldItalic")).toMatchObject({ family: "Mine", bold: true, italic: true });
    expect(fontOf("Plain")).toMatchObject({ family: "Plain", bold: false });
  });

  it("opens RTF from a Mac's TextEdit and other writers when its text is 7-bit or Windows-1252", () => {
    // As TextEdit on a Mac saves it: \cocoartf, Windows-1252 bytes as \'hh, the rest as \u.
    const mac = [
      "{\\rtf1\\ansi\\ansicpg1252\\cocoartf2513",
      "\\cocoatextscaling0\\cocoaplatform0{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;\\f1\\fswiss\\fcharset0 Helvetica-Bold;}",
      "{\\colortbl;\\red255\\green255\\blue255;}",
      "{\\*\\expandedcolortbl;;}",
      "\\paperw11900\\paperh16840\\margl1440\\margr1440\\vieww11520\\viewh8400\\viewkind0",
      "\\pard\\tx566\\pardirnatural\\partightenfactor0",
      "",
      "\\f0\\fs24 \\cf0 Caf\\'e9 ",
      "\\f1\\b au lait\\f0\\b0  \\uc0\\u8364 \\uc0\\u12371 \\",
      "Next}",
    ].join("\n");
    const fromMac = documentFromBytes("Mac.rtf", new TextEncoder().encode(mac), document);
    expect(fromMac.document).toMatchObject({ format: "rich", lines: ["Café au lait €こ", "Next"] });
    expect(fromMac.document.content?.textContent).toContain("au lait");
    // Plain ANSI with a literal Windows-1252 byte, after a UTF-8 byte order mark, and 7-bit text
    // under any declared code page: each is read, never guessed.
    expect(
      documentFromBytes(
        "Ansi.rtf",
        bytesOf("{\\rtf1\\ansi caf", [0xe9], " ", [0x80], "\\par}"),
        document,
      ).document.lines,
    ).toEqual(["café €"]);
    expect(
      documentFromBytes("Bom.rtf", bytesOf([0xef, 0xbb, 0xbf], "{\\rtf1\\ansi Hi\\par}"), document)
        .document.lines,
    ).toEqual(["Hi"]);
    for (const declared of [
      "{\\rtf1\\ansi\\ansicpg1251 Hi\\par}",
      "{\\rtf1\\mac Hi\\par}",
      "{\\rtf1\\ansi{\\fonttbl\\f0\\fnil\\fcharset128 HiraginoSans-W3;}\\f0 \\uc0\\u12371 Hi\\par}",
    ]) {
      expect(documentFromText("Declared.rtf", declared, document).lines.at(-1), declared).toMatch(
        /Hi$/,
      );
    }
  });

  it("refuses RTF whose text is in a code page the browser does not decode, or that the reader does not read", () => {
    const refusedText = [
      "{\\rtf1\\ansi\\ansicpg99999 \\'cf\\'f0\\par}",
      "{\\rtf1\\pc \\'82\\par}",
      "{\\rtf1\\ansi {\\upr{x}{\\*\\ud{x}}}\\par}",
    ];
    for (const text of refusedText) {
      expect(() => documentFromText("Other.rtf", text, document), text).toThrow(
        UnsupportedEncodingError,
      );
    }
    // TextEdit's own words for it.
    expect(() => documentFromText("Other.rtf", refusedText[0] ?? "", document)).toThrow(
      UNSUPPORTED_ENCODING,
    );
    // From a file's bytes: literal bytes of another code page, and RTF behind a UTF-16 or UTF-32
    // byte order mark, which is no RTF the reader reads.
    const ownBytes = Array.from(new TextEncoder().encode(writeRtf(paragraphsOfLines(["Hi"]))));
    const refusedBytes = [
      [...Array.from(new TextEncoder().encode("{\\rtf1\\ansi\\ansicpg99999 ")), 0xcf, 0x7d],
      [0xff, 0xfe, ...ownBytes],
      [0xfe, 0xff, ...ownBytes],
      [0xff, 0xfe, 0x00, 0x00, ...ownBytes],
    ];
    for (const bytes of refusedBytes) {
      expect(() => documentFromBytes("Other.rtf", Uint8Array.from(bytes), document)).toThrow(
        UnsupportedEncodingError,
      );
    }
    // Plain text is UTF-8 unless a byte order mark says otherwise; anything else is refused.
    const text = bytesOf([0xef, 0xbb, 0xbf], [0xc3, 0xbc], "ber\nzwei");
    expect(documentFromBytes("Text.txt", text, document).document.lines).toEqual(["über", "zwei"]);
    expect(() => documentFromBytes("Latin.txt", bytesOf("caf", [0xe9]), document)).toThrow(
      UnsupportedEncodingError,
    );
    expect(
      documentFromBytes("Wide.txt", bytesOf([0xff, 0xfe], "H\0i\0"), document).document.lines,
    ).toEqual(["Hi"]);
  });

  it("marks text in a code page the browser does not decode, wherever it is declared", () => {
    const latin = readBytes(bytesOf("{\\rtf1\\ansi\\ansicpg1252 caf", [0xe9], "\\par Next\\par}"));
    expect(latin.unsupported).toBeUndefined();
    expect(linesOfParagraphs(latin.paragraphs)).toEqual(["café", "Next"]);
    const refused = [
      "{\\rtf1\\ansi\\ansicpg99999 \\'cf\\'f0\\par}",
      "{\\rtf1\\pca \\'82\\par}",
      "{\\rtf1\\ansi {\\upr{x}{\\*\\ud{x}}}\\par}",
      "{\\rtf1\\ansi \\dbch x\\par}",
    ];
    for (const rtf of refused) expect(readRtf(rtf).unsupported, rtf).toBe(true);
    const decoded: readonly (readonly [string, string])[] = [
      ["{\\rtf1\\ansi\\ansicpg1251 \\'cf\\'f0\\par}", "Пр"],
      ["{\\rtf1\\ansi\\ansicpg932 \\'82\\'a0\\par}", "あ"],
      ["{\\rtf1\\ansi{\\fonttbl\\f0\\fcharset128 Osaka;}\\f0 \\'82\\'a0\\par}", "あ"],
      ["{\\rtf1\\ansi{\\fonttbl\\f0\\cpg1251 Arial;}\\f0 \\'cf\\par}", "П"],
      ["{\\rtf1\\mac \\'8e\\par}", "é"],
    ];
    for (const [rtf, line] of decoded) {
      const read = readRtf(rtf);
      expect(read.unsupported, rtf).toBeUndefined();
      expect(linesOfParagraphs(read.paragraphs)).toEqual([line]);
    }
    // A declaration alone is not text in that code page: the Symbol font's 7-bit text, a skipped
    // destination's bytes, and a \u's fallback bytes read the same in any.
    const accepted = [
      "{\\rtf1\\ansi{\\fonttbl\\f0\\fcharset2 Symbol;}\\f0 x\\par}",
      "{\\rtf1\\ansi\\ansicpg1251{\\info{\\title \\'cf}}Hi\\par}",
      "{\\rtf1\\ansi\\ansicpg932\\uc2 \\u12354\\'82\\'a0\\par}",
    ];
    for (const rtf of accepted) expect(readRtf(rtf).unsupported, rtf).toBeUndefined();
    expect(linesOfParagraphs(readRtf(accepted[2] ?? "").paragraphs)).toEqual(["\u3042"]);
  });
});

/*
 * A real RTF file saved on a Mac by the Cocoa text system: the ReadMe of CPython's macOS installer
 * (python/cpython, Mac/BuildScript/resources/ReadMe.rtf at fdec4df45ab69fc25019565992d95b26b4e37523,
 * byte for byte, sha256 a4b74a92…cc91510). Copyright (c) 2001 Python Software Foundation; All
 * Rights Reserved; used under the PSF License Version 2. Its monospace words are in CourierNewPSMT,
 * a font the library's Fonts panel does not list, marked \fmodern in the font table.
 */
const MAC_README = readFileSync(path.join(import.meta.dirname, "textedit-cpython-readme.rtf"));

describe("a real RTF file saved by TextEdit on a Mac", () => {
  /** The style of the run whose whole text is `text`, and that run's element. */
  const run = (content: Node, text: string) => {
    const holder = document.createElement("div");
    holder.append(content.cloneNode(true));
    const span = [...holder.querySelectorAll("span")].find((each) => each.textContent === text);
    return span?.style;
  };

  it("keeps its Courier New runs monospace when opened, saved, reloaded and opened again", () => {
    const opened = documentFromBytes("ReadMe.rtf", new Uint8Array(MAC_README), document);
    const content = opened.document.content as Node;
    // Opened: CourierNewPSMT is shown as Courier New, and as monospace where neither is
    // installed. Bold, italic and underline are as the file has them.
    const courier = '"CourierNewPSMT", "Courier New", monospace';
    for (const word of ["certifi", "ssl", "/Applications/Python 3.15"]) {
      expect(run(content, word)?.fontFamily, word).toBe(courier);
    }
    expect(run(content, "Keychain Access ")?.fontStyle).toBe("italic");
    expect(run(content, "Certificate verification and OpenSSL")).toMatchObject({
      fontWeight: "bold",
      textDecorationLine: "underline",
    });

    // Saved: the font table names the font as the file did, as a fixed-width (\fmodern) font.
    const holder = document.createElement("div");
    holder.append(content.cloneNode(true));
    const saved = documentText({ format: "rich", lines: opened.document.lines, content: holder });
    expect(saved).toMatch(/\\f\d+\\fmodern\\fcharset0 CourierNewPSMT;/);

    // Reloaded from the draft the server keeps (the view's HTML through the allowlist), then
    // saved again and opened again from the file: still Courier New, monospace.
    const reloaded = htmlToContent(
      contentToHtml(htmlToContent(holder.innerHTML, document)),
      document,
    );
    expect(run(reloaded, "certifi")?.fontFamily).toBe(courier);
    const again = document.createElement("div");
    again.append(reloaded);
    const reopened = documentFromText(
      "ReadMe.rtf",
      documentText({ format: "rich", lines: opened.document.lines, content: again }),
      document,
    );
    expect(run(reopened.content as Node, "certifi")?.fontFamily).toBe(courier);
    expect(reopened.lines).toEqual(opened.document.lines);
  });

  it("keeps a font name the library does not know as written, with the table's class", () => {
    const rtf =
      "{\\rtf1\\ansi{\\fonttbl\\f0\\fswiss Helvetica;\\f1\\froman\\fcharset0 BookmanOldStylePSMT;" +
      "\\f2\\fnil\\fcharset0 OpenDyslexic;}\\f1 Old \\f2 New\\f0  Plain\\par}";
    const { paragraphs } = readRtf(rtf);
    expect(
      (paragraphs[0]?.runs ?? []).map(({ text, style }) => [text, style.family, style.generic]),
    ).toEqual([
      ["Old ", "BookmanOldStylePSMT", "serif"],
      ["New", "OpenDyslexic", undefined],
      [" Plain", "Helvetica", undefined],
    ]);
    // Shown: a PostScript name is followed by the family it stands for; a family name that only
    // looks like one (OpenDyslexic) is asked for as it is.
    const view = htmlToContent(paragraphsToHtml(paragraphs), document);
    const holder = document.createElement("div");
    holder.append(view);
    const spans = [...holder.querySelectorAll("span")].map((each) => each.style.fontFamily);
    expect(spans).toEqual(['"BookmanOldStylePSMT", "Bookman Old Style", serif', '"OpenDyslexic"']);
  });

  it("writes one family with two generic families as two fonts, each read back as it was", () => {
    const style = { ...DEFAULT_STYLE, family: "Plex" };
    const rtf = writeRtf([
      {
        align: "left",
        runs: [
          { text: "code ", style: { ...style, generic: "monospace" as const } },
          { text: "prose", style: { ...style, generic: "serif" as const } },
        ],
      },
    ]);
    expect(rtf).toContain("\\fmodern\\fcharset0 Plex;");
    expect(rtf).toContain("\\froman\\fcharset0 Plex;");
    const runs = readRtf(rtf).paragraphs[0]?.runs ?? [];
    expect(runs.map(({ text, style }) => [text, style.family, style.generic])).toEqual([
      ["code ", "Plex", "monospace"],
      ["prose", "Plex", "serif"],
    ]);
  });
});

describe("documents as drive files", () => {
  it("opens a plain text file as plain text, though its text starts as RTF does", () => {
    const opened = documentFromText("Notes.txt", "{\\rtf1 example}\nmore", document);
    expect(opened).toMatchObject({ format: "plain", lines: ["{\\rtf1 example}", "more"] });
    // A name that says nothing opens such text as the RTF it is.
    expect(documentFromText("Notes", "{\\rtf1 example}", document)).toMatchObject({
      format: "rich",
      lines: ["example"],
    });
  });
  it("opens .rtf as rich text, .html as rich text through the allowlist, and the rest as plain", () => {
    const rtf = writeRtf(paragraphsOfContent(view("<div><b>Dear</b> Ada</div><div>Yours</div>")));
    const letter = documentFromText("Letter.rtf", rtf, document);
    expect(letter).toMatchObject({
      name: "Letter.rtf",
      format: "rich",
      lines: ["Dear Ada", "Yours"],
    });
    const holder = document.createElement("div");
    holder.append(letter.content as DocumentFragment);
    expect(holder.querySelector("span")?.style.fontWeight).toBe("bold");

    const page = documentFromText(
      "Page.html",
      '<p onclick="x()">Hi <img src=x>there</p>',
      document,
    );
    const shown = document.createElement("div");
    shown.append(page.content as DocumentFragment);
    expect(shown.innerHTML).toBe("<p>Hi there</p>");

    expect(documentFromText("Notes.txt", "\uFEFFone\r\ntwo", document)).toEqual({
      name: "Notes.txt",
      format: "plain",
      lines: ["one", "two"],
    });
  });

  it("writes an .html file back as HTML that opens again as the same document, and others as before", () => {
    const content = view(
      '<div><b>Hi</b> &lt;there&gt;</div><div style="text-align: center;">Two</div>',
    );
    const body = { format: "rich" as const, lines: ["Hi <there>", "Two"], content };
    const html = fileText(body, "Page.html");
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).not.toMatch(/\{\\rtf/);
    const again = documentFromText("Page.html", html, document);
    expect(again).toMatchObject({ format: "rich", lines: ["Hi <there>", "Two"] });
    const shown = document.createElement("div");
    shown.append(again.content as DocumentFragment);
    expect(shown.querySelector("b")?.textContent).toBe("Hi");
    expect((shown.lastElementChild as HTMLElement).style.textAlign).toBe("center");
    // Without the view, the lines are its paragraphs, escaped.
    const lines = fileText({ format: "rich", lines: ["a < b", ""] }, "Page.htm");
    expect(lines).toContain("<div>a &lt; b</div><div><br></div>");
    // An .rtf file stays RTF, and plain text stays its lines whatever the name.
    expect(fileText(body, "Letter.rtf")).toMatch(/^\{\\rtf/);
    expect(fileText({ format: "plain", lines: ["x", "y"] }, "Page.html")).toBe("x\ny");
  });

  it("names a saved document by its format, and opens the drive's text files only", () => {
    expect(fileNameFor("Untitled", "rich")).toBe("Untitled.rtf");
    expect(fileNameFor("Letter.rtf", "plain")).toBe("Letter.txt");
    expect(fileNameFor("  ", "plain")).toBe("Untitled.txt");
    expect(fileNameFor("Notes.md", "plain")).toBe("Notes.md");
    expect(fileNameFor("Notes.md", "rich")).toBe("Notes.rtf");
    expect(fileNameFor("Page.html", "plain")).toBe("Page.txt");
    expect(fileNameFor("Draft v1.2", "rich")).toBe("Draft v1.2.rtf");
    // A switch of format rewrites a document extension only.
    expect(nameInFormat("Letter.rtf", "plain")).toBe("Letter.txt");
    expect(nameInFormat("List.TXT", "rich")).toBe("List.rtf");
    expect(nameInFormat("Page.htm", "rich")).toBe("Page.rtf");
    expect(nameInFormat("Notes.md", "plain")).toBe("Notes.md");
    expect(nameInFormat("Letter", "plain")).toBe("Letter");
    expect(nameInFormat("photo.png", "rich")).toBe("photo.png");
    // A converted document keeps only a file it is still written into as it is.
    expect(fileFitsFormat("Letter.rtf", "rich")).toBe(true);
    expect(fileFitsFormat("Page.html", "rich")).toBe(true);
    expect(fileFitsFormat("Page.html", "plain")).toBe(false);
    expect(fileFitsFormat("Letter.rtf", "plain")).toBe(false);
    expect(fileFitsFormat("Notes.md", "plain")).toBe(true);
    expect(fileFitsFormat("Notes.md", "rich")).toBe(false);
    const file = (name: string, type?: string) => ({ kind: "file" as const, name, type });
    expect(isTextDocument(file("a.rtf"))).toBe(true);
    expect(isTextDocument(file("a.md"))).toBe(true);
    expect(isTextDocument(file("notes", "text/plain"))).toBe(true);
    expect(isTextDocument(file("photo.png", "image/png"))).toBe(false);
    expect(isTextDocument({ kind: "folder", name: "a.txt" })).toBe(false);
  });
});
