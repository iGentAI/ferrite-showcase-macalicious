/*
 * Test support, not part of the demo: a ZIP writer and a small EPUB 3 built with it, so the tests
 * read a real archive (one entry compressed with `CompressionStream("deflate-raw")`, the others
 * stored) through the same code the window uses.
 */

export const encode = (text: string) => new TextEncoder().encode(text);

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  }).pipeThrough(
    new CompressionStream("deflate-raw") as unknown as TransformStream<Uint8Array, Uint8Array>,
  );
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** A ZIP of `files`: those named in `deflated` compressed, the others stored. */
export async function zip(
  files: Record<string, string | Uint8Array>,
  deflated: string[] = [],
): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = typeof text === "string" ? encode(text) : text;
    const method = deflated.includes(name) ? 8 : 0;
    const data = method === 8 ? await deflateRaw(raw) : raw;
    const nameBytes = encode(name);
    const local = new Uint8Array(30 + nameBytes.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(8, method, true);
    l.setUint32(18, data.length, true);
    l.setUint32(22, raw.length, true);
    l.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    const entry = new Uint8Array(46 + nameBytes.length);
    const c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(10, method, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, raw.length, true);
    c.setUint16(28, nameBytes.length, true);
    c.setUint32(42, offset, true);
    entry.set(nameBytes, 46);
    parts.push(local, data);
    central.push(entry);
    offset += local.length + data.length;
  }
  const size = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, central.length, true);
  e.setUint16(10, central.length, true);
  e.setUint32(12, size, true);
  e.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** How `smallEpub` differs from the plain one. */
export interface SmallEpubOptions {
  /** The package's title. */
  title?: string;
  /** The `<spine>`'s contents: `itemref`s to `nav`, `one` and `two` (or to ids not listed). */
  spine?: string;
  /** Files of the archive left out of it. */
  without?: readonly string[];
}

const SPINE = `<itemref idref="nav" linear="no"/><itemref idref="one"/><itemref idref="two"/>`;

/** A small EPUB 3: two chapters, the first deflated, and a navigation document left out. */
export function smallEpub({
  title = "A Small   Book",
  spine = SPINE,
  without = [],
}: SmallEpubOptions = {}): Promise<Uint8Array> {
  const files: Record<string, string> = {
    mimetype: "application/epub+zip",
    "META-INF/container.xml": `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
    "OEBPS/content.opf": `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title><dc:creator>Ada Writer</dc:creator><dc:identifier id="id">x</dc:identifier>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="one" href="Text/ch%201.xhtml" media-type="application/xhtml+xml"/>
    <item id="two" href="Text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine>${spine}</spine>
</package>`,
    "OEBPS/nav.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Contents</p></body></html>`,
    "OEBPS/Text/ch 1.xhtml": `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title><style>p { margin: 0 }</style></head>
<body><section><h1>Chapter One</h1><p>It was a <em>bright</em> day.</p><p>Second
   paragraph.</p></section></body></html>`,
    "OEBPS/Text/ch2.xhtml": `<html xmlns="http://www.w3.org/1999/xhtml"><body><h2>Chapter Two</h2><p>The end.</p></body></html>`,
    "OEBPS/style.css": "p {}",
  };
  for (const name of without) delete files[name];
  return zip(files, ["OEBPS/Text/ch 1.xhtml"]);
}
