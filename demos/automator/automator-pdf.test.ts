import { describe, expect, it } from "vitest";
import {
  addObject,
  drawOnPage,
  gridContent,
  isStream,
  md5,
  type PdfBytes,
  type PdfDict,
  PdfLocked,
  PdfName,
  PdfRef,
  type PdfStream,
  pagesOfPdf,
  pdfLockKeys,
  placedImage,
  rc4,
  readPdf,
  shownMatrix,
  shownSize,
  toneOnPage,
  writePdf,
} from "./automator-pdf";

const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);
const bytesOf = (value: string) => Uint8Array.from(value, (char) => char.charCodeAt(0));
const hex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

/** One page holding `content`, with a real cross-reference table. */
function onePage(content: string, pageEntries = "", extraTrailer = "") {
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    `<</Type/Pages/Count 1/Kids[3 0 R]/MediaBox[0 0 200 100]${pageEntries}>>`,
    "<</Type/Page/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Title(a\\(b\\)\\051)>>",
  ];
  let file = "%PDF-1.4\n";
  const offsets = objects.map((object, at) => {
    const offset = file.length;
    file += `${at + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const start = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) file += `${String(offset).padStart(10, "0")} 00000 n \n`;
  file += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R${extraTrailer}>>\nstartxref\n${start}\n%%EOF\n`;
  return bytesOf(file);
}

const pageOf = (object: unknown) => object as PdfDict;

describe("a tone laid over a page", () => {
  it("blends covers the size of the page over its content, which stays as it was", async () => {
    const document = await readPdf(onePage("BT ET"));
    const [page] = pagesOfPdf(document);
    toneOnPage(document, page as ReturnType<typeof pagesOfPdf>[number], "Sepia Tone");
    const again = await readPdf(await writePdf(document));
    const [written] = pagesOfPdf(again);
    const states = written?.resources.get("ExtGState") as PdfDict;
    const modes = [...states.values()].map(
      (state) => ((state as PdfDict).get("BM") as PdfName).name,
    );
    expect(modes).toEqual(["Saturation", "Multiply"]);
    const contents = written?.dict.get("Contents") as readonly PdfRef[];
    const drawn = contents.map((ref) => text((again.objects.get(ref.ref) as PdfStream).bytes));
    expect(drawn[1]).toBe("BT ET");
    expect(drawn.at(-1)).toBe(
      "q\n1 0 0 1 0 0 cm\n/Automator0 gs\n1 1 1 rg\n0 0 200 100 re f\n/Automator1 gs\n0.96 0.87 0.7 rg\n0 0 200 100 re f\nQ\n",
    );
  });
});

describe("a PDF read as its objects and written again", () => {
  it("keeps its catalogue, its strings, its stream and what pages inherit", async () => {
    const again = await readPdf(await writePdf(await readPdf(onePage("BT ET"))));
    expect(again.trailer.get("Root")).toEqual(new PdfRef(1));
    const [page] = pagesOfPdf(again);
    expect(page?.box).toEqual([0, 0, 200, 100]);
    const contents = again.objects.get(4) as PdfStream;
    expect(text(contents.bytes)).toBe("BT ET");
    expect(pageOf(again.objects.get(5)).get("BaseFont")).toEqual(new PdfName("Helvetica"));
    expect(text((pageOf(again.objects.get(5)).get("Title") as PdfBytes).bytes)).toBe("a(b))");
  });

  it("refuses a locked file for what it is", async () => {
    await expect(readPdf(onePage("BT ET", "", "/Encrypt 5 0 R"))).rejects.toBeInstanceOf(PdfLocked);
  });

  it("refuses bytes that are no PDF", async () => {
    await expect(readPdf(bytesOf("just some text"))).rejects.toThrow(/no table of its objects/);
  });

  it("reads what a cross-reference stream and an object stream hold", async () => {
    const inner = "1 0 2 29 <</Type/Catalog/Pages 2 0 R>> <</Type/Pages/Count 0/Kids[]>>";
    const first = inner.indexOf("<<");
    const objectStream = `<</Type/ObjStm/N 2/First ${first}/Length ${inner.length}>>\nstream\n${inner}\nendstream`;
    let file = "%PDF-1.5\n";
    const containerAt = file.length;
    file += `3 0 obj\n${objectStream}\nendobj\n`;
    const tableAt = file.length;
    const rows = [
      [0, 0, 0],
      [2, 3, 0],
      [2, 3, 1],
      [1, containerAt, 0],
      [1, tableAt, 0],
    ];
    const table = String.fromCharCode(
      ...rows.flatMap(([kind, field, last]) => [
        kind as number,
        ((field as number) >> 8) & 255,
        (field as number) & 255,
        last as number,
      ]),
    );
    file += `4 0 obj\n<</Type/XRef/Size 5/W[1 2 1]/Root 1 0 R/Length ${table.length}>>\nstream\n${table}\nendstream\nendobj\nstartxref\n${tableAt}\n%%EOF\n`;
    const read = await readPdf(bytesOf(file));
    expect(pageOf(read.objects.get(1)).get("Type")).toEqual(new PdfName("Catalog"));
    expect(read.objects.has(3)).toBe(false);
    expect(read.objects.has(4)).toBe(false);
    expect(text(await writePdf(read))).toContain("1 0 obj\n<</Type /Catalog /Pages 2 0 R >>");
  });
});

describe("what is drawn on a page", () => {
  it("goes after the page's content, whose state it cannot inherit", async () => {
    const document = await readPdf(onePage("0.5 0 0 0.5 0 0 cm"));
    const [page] = pagesOfPdf(document);
    drawOnPage(document, page as NonNullable<typeof page>, "0 0 m 10 10 l S");
    const contents = page?.dict.get("Contents") as PdfRef[];
    expect(contents.map((each) => each.ref)).toEqual([7, 4, 8, 6]);
    const textOf = (ref: PdfRef | undefined) =>
      text((document.objects.get(ref?.ref ?? 0) as PdfStream).bytes);
    expect(textOf(contents[0])).toBe("q\n");
    expect(textOf(contents[2])).toBe("\nQ\n");
    expect(textOf(contents[3])).toBe("q\n1 0 0 1 0 0 cm\n0 0 m 10 10 l S\nQ\n");
  });

  it("goes before it when drawn under", async () => {
    const document = await readPdf(onePage("BT ET"));
    const [page] = pagesOfPdf(document);
    if (!page) throw new Error("no page");
    drawOnPage(document, page, "x", true);
    expect((page.dict.get("Contents") as PdfRef[]).map((each) => each.ref)).toEqual([6, 4]);
  });

  it("is upright on a rotated page", async () => {
    const document = await readPdf(onePage("BT ET", "/Rotate 90"));
    const [page] = pagesOfPdf(document);
    expect(page?.rotate).toBe(90);
    expect(shownSize(page as NonNullable<typeof page>)).toEqual([100, 200]);
    expect(shownMatrix(page as NonNullable<typeof page>)).toBe("0 1 -1 0 200 0 cm");
  });

  it("draws a grid of the lines inside the page", () => {
    expect(gridContent(100, 50, 40, [1, 0, 0])).toBe(
      ["1 0 0 RG", "0.5 w", "40 0 m 40 50 l S", "80 0 m 80 50 l S", "0 40 m 100 40 l S"].join("\n"),
    );
  });

  it("places a picture at its size and turn", () => {
    expect(placedImage("I", 20, 10, 5, 6, 0, "S")).toBe("q\n/S gs\n20 0 0 10 5 6 cm\n/I Do\nQ");
    expect(placedImage("I", 20, 10, 5, 6, 90)).toBe("q\n0 20 -10 0 5 6 cm\n/I Do\nQ");
  });

  it("adds an object under the next free number", async () => {
    const document = await readPdf(onePage("BT ET"));
    expect(addObject(document, null)).toEqual(new PdfRef(6));
    expect(isStream(document.objects.get(4))).toBe(true);
  });
});

describe("the sums a locked PDF is built on", () => {
  it("has MD5's published values", () => {
    expect(hex(md5(new Uint8Array()))).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(hex(md5(bytesOf("abc")))).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(hex(md5(bytesOf("a".repeat(80))))).toBe("b15af9cdabbaea0516866a33d8fd0f98");
  });

  it("has RC4's published value", () => {
    expect(hex(rc4(bytesOf("Key"), bytesOf("Plaintext")))).toBe("bbf316e8d940af0ad3");
  });

  it("derives the same checks from the same password and file", () => {
    const id = new Uint8Array(16).fill(7);
    const one = pdfLockKeys("secret", id);
    expect(one.user).toHaveLength(32);
    expect(one.owner).toHaveLength(32);
    expect(hex(pdfLockKeys("secret", id).key)).toBe(hex(one.key));
    expect(hex(pdfLockKeys("other", id).key)).not.toBe(hex(one.key));
  });
});
