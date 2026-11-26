import { describe, expect, it } from "vitest";
import {
  documentFromText,
  fileBlob,
  fileText,
  isTextDocument,
  nameInFormat,
} from "./textedit-files";
import {
  readDocx,
  readOdt,
  readWebArchive,
  unzip,
  writeDocx,
  writeOdt,
  writeWebArchive,
  zipStored,
} from "./textedit-office";
import { DEFAULT_STYLE, linesOfParagraphs, type RtfParagraph } from "./textedit-rtf";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==";

const styled = (text: string, change: Partial<typeof DEFAULT_STYLE> & { link?: string } = {}) => ({
  text,
  style: { ...DEFAULT_STYLE, ...change },
});

/** One of everything the view holds, as a file should give it back. */
const SAMPLE: RtfParagraph[] = [
  {
    align: "center",
    spacing: "1.5",
    before: 6,
    after: 3,
    runs: [
      styled("Bold", { bold: true, size: 18 }),
      styled(" and  spaced\ttab", { italic: true, color: "#ff0000", family: "Times" }),
    ],
  },
  {
    align: "left",
    runs: [
      styled("under", { underline: true }),
      styled("gone", { strikethrough: true, highlight: "#ffff00" }),
      styled("up", { script: "super" }),
      styled("a link", { link: "https://example.com/?a=1&b=2" }),
    ],
  },
  {
    align: "left",
    runs: [{ text: "", style: { ...DEFAULT_STYLE }, picture: { src: PNG, width: 30, height: 20 } }],
  },
  { align: "left", list: "decimal", runs: [styled("First")] },
  { align: "left", list: "square", runs: [styled("Square")] },
  {
    align: "left",
    runs: [],
    table: {
      border: 1,
      rows: [
        [
          { paragraphs: [{ align: "left", runs: [styled("A")] }], background: "#00ff00" },
          { paragraphs: [{ align: "left", runs: [styled("B")] }] },
        ],
        [{ paragraphs: [{ align: "left", runs: [styled("Wide")] }], span: 2 }],
      ],
    },
  },
];

const base64Bytes = (data: string) => Uint8Array.from(atob(data), (char) => char.charCodeAt(0));

const expectSample = (read: RtfParagraph[]) => {
  expect(linesOfParagraphs(read)).toEqual([
    "Bold and  spaced\ttab",
    "undergoneupa link",
    "",
    "First",
    "Square",
    "A\tB",
    "Wide",
  ]);
  const [first, second, third, fourth, fifth, table] = read;
  expect(first?.align).toBe("center");
  expect(first?.spacing).toBe("1.5");
  expect(first?.before).toBe(6);
  expect(first?.after).toBe(3);
  expect(first?.runs[0]?.style).toEqual({ ...DEFAULT_STYLE, bold: true, size: 18 });
  expect(first?.runs[1]?.style).toEqual({
    ...DEFAULT_STYLE,
    italic: true,
    color: "#ff0000",
    family: "Times",
  });
  expect(second?.runs[0]?.style.underline).toBe(true);
  expect(second?.runs[1]?.style.strikethrough).toBe(true);
  expect(second?.runs[1]?.style.highlight).toBe("#ffff00");
  expect(second?.runs[2]?.style.script).toBe("super");
  expect(second?.runs[3]?.style.link).toBe("https://example.com/?a=1&b=2");
  expect(third?.runs[0]?.picture).toEqual({ src: PNG, width: 30, height: 20 });
  expect(fourth?.list).toBe("decimal");
  expect(fifth?.list).toBe("square");
  expect(table?.table?.border).toBe(1);
  expect(table?.table?.rows[0]?.[0]?.background).toBe("#00ff00");
  expect(table?.table?.rows[1]?.[0]?.span).toBe(2);
};

describe("zip", () => {
  it("reads back what it stored, with a name that is not ASCII", async () => {
    const files = await unzip(
      zipStored([
        { name: "a.txt", bytes: new TextEncoder().encode("one") },
        { name: "d/é.txt", bytes: new TextEncoder().encode("two") },
      ]),
    );
    expect([...files.keys()]).toEqual(["a.txt", "d/é.txt"]);
    expect(new TextDecoder().decode(files.get("d/é.txt"))).toBe("two");
  });

  it("refuses bytes that are not a zip", async () => {
    await expect(unzip(new TextEncoder().encode("not a zip at all, not one bit"))).rejects.toThrow(
      "The file is not a zip.",
    );
  });
});

describe("Word files", () => {
  it("give back what they were written with", async () => {
    expectSample(await readDocx(writeDocx(SAMPLE)));
  });

  it("read a file Python's zipfile deflated, with the file's styles and defaults", async () => {
    const read = await readDocx(base64Bytes(DEFLATED_DOCX));
    expect(read.map((each) => each.align)).toEqual(["center", "left"]);
    expect(read[0]?.runs[0]).toEqual({
      text: "Title",
      style: { ...DEFAULT_STYLE, family: "Calibri", size: 20, bold: true },
    });
    expect(read[1]?.runs[0]).toEqual({
      text: "Body",
      style: { ...DEFAULT_STYLE, family: "Calibri", size: 11, italic: true },
    });
  });

  it("refuse a zip that holds no Word document", async () => {
    await expect(readDocx(zipStored([]))).rejects.toThrow("The file is not a Word document.");
  });
});

describe("OpenDocument files", () => {
  it("give back what they were written with", async () => {
    expectSample(await readOdt(writeOdt(SAMPLE)));
  });

  it("start with their type, stored, as the format asks", async () => {
    const bytes = writeOdt(SAMPLE);
    expect(new TextDecoder().decode(bytes.subarray(30, 38))).toBe("mimetype");
    expect(new TextDecoder().decode(bytes.subarray(38, 77))).toBe(
      "application/vnd.oasis.opendocument.text",
    );
  });
});

describe("Web Archive files", () => {
  it("give back the page they were written with, as an XML property list", () => {
    const html = "<div>Café</div>";
    const bytes = writeWebArchive(html);
    expect(new TextDecoder().decode(bytes)).toContain("<key>WebMainResource</key>");
    expect(readWebArchive(bytes)).toBe(html);
  });

  it("read the binary property list Safari writes", () => {
    expect(readWebArchive(base64Bytes(BINARY_ARCHIVE))).toBe(
      "<html><body><b>Safari</b> page</body></html>",
    );
  });

  it("refuse another property list", () => {
    expect(() =>
      readWebArchive(
        new TextEncoder().encode(
          '<plist version="1.0"><dict><key>A</key><string>b</string></dict></plist>',
        ),
      ),
    ).toThrow("The file is not a Web Archive.");
  });
});

describe("a document in these files", () => {
  it("is a text document TextEdit opens, held as HTML, and packed when it is written", async () => {
    expect(isTextDocument({ kind: "file", name: "A.docx" })).toBe(true);
    expect(isTextDocument({ kind: "file", name: "A.odt" })).toBe(true);
    expect(isTextDocument({ kind: "file", name: "A.webarchive" })).toBe(true);
    const holder = document.createElement("div");
    holder.innerHTML = '<div style="text-align: center">Hello</div>';
    const text = fileText({ format: "rich", lines: ["Hello"], content: holder }, "A.docx");
    const blob = fileBlob(text, "A.docx", "rich");
    expect(blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const read = await readDocx(new Uint8Array(await blob.arrayBuffer()));
    expect(read[0]?.align).toBe("center");
    expect(read[0]?.runs[0]?.text).toBe("Hello");
    expect(documentFromText("A.docx", text, document).lines).toEqual(["Hello"]);
  });

  it("takes the plain text extension when it is made plain", () => {
    expect(nameInFormat("A.docx", "plain")).toBe("A.txt");
    expect(nameInFormat("A.docx", "rich")).toBe("A.rtf");
  });
});

/** Written by Python's `plistlib`, for lack of a Mac's Safari. */
const BINARY_ARCHIVE =
  "YnBsaXN0MDDRAQJfEA9XZWJNYWluUmVzb3VyY2XVAwQFBgcICQoLDF8QD1dlYlJlc291cmNlRGF0YV8QFFdlYlJlc291cmNlRnJhbWVOYW1lXxATV2ViUmVzb3VyY2VNSU1FVHlwZV8QG1dlYlJlc291cmNlVGV4dEVuY29kaW5nTmFtZV5XZWJSZXNvdXJjZVVSTE8QLDxodG1sPjxib2R5PjxiPlNhZmFyaTwvYj4gcGFnZTwvYm9keT48L2h0bWw+UFl0ZXh0L2h0bWxVVVRGLThfEBRodHRwczovL2V4YW1wbGUuY29tLwgLHSg6UWeFlMPEztQAAAAAAAABAQAAAAAAAAANAAAAAAAAAAAAAAAAAAAA6w==";

/** Written by Python's `zipfile`, deflated: a centred Title in a bold 20 pt style, then italic Body. */
const DEFLATED_DOCX =
  "UEsDBBQAAAAIAFweZl32i0f6rgAAACABAAARAAAAd29yZC9kb2N1bWVudC54bWxtT0sOgjAQvQrpARx04YLwSVy5NNELYBmhpr+0I8jtbYvgxs2bzPtM3pTNW8lsROeF0RXb73LW1OVUdIa/FGrKgqx9MVVsILIFgOcDqtbvjEUdtIdxqqWwuh4m4zrrDEfvhe6VhEOeH0G1QrN48m66OU6b4OLSuNIsMZuKsZUVOzOI5JOvBA8N0EUWtkgCqm+CJEaakugWy3Z/sS4JseS/G9WnUORPEtaK8Hu//gBQSwMEFAAAAAgAXB5mXUcuOQqyAAAAMwEAAA8AAAB3b3JkL3N0eWxlcy54bWxlT8sOgjAQ/BWyH8AiMR4IhYPG6M1fKKVAkz5It4L69QIhUfE0OzuZmd28fBgdDdKTcpbBLk6gLPIxo/DUkqJJtJSNDLoQ+gyRRCcNp9j10k5a47zhYaK+xdH5uvdOSCJlW6MxTZIDGq4szIG1EyfZ8LsONFN/8ytd2QJnZwNFY8ZJKMXgyLWqvAJcLnpNwsA1gzSdN7ja8DcM/6qWV6IVrzWDC3x1VpvwfbIJX2yfiYo3UEsBAhQDFAAAAAgAXB5mXfaLR/quAAAAIAEAABEAAAAAAAAAAAAAAIABAAAAAHdvcmQvZG9jdW1lbnQueG1sUEsBAhQDFAAAAAgAXB5mXUcuOQqyAAAAMwEAAA8AAAAAAAAAAAAAAIAB3QAAAHdvcmQvc3R5bGVzLnhtbFBLBQYAAAAAAgACAHwAAAC8AQAAAAA=";
