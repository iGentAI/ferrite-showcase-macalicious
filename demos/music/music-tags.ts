/**
 * Reads a song file's tags in the browser: title, artist, album, album artist, composer, genre, year,
 * track number and the embedded cover, from ID3v2 (2.2, 2.3, 2.4) and ID3v1 in MP3 files, the
 * `ilst` atoms of MP4 and M4A files, Vorbis comments in FLAC and Ogg (Vorbis and Opus) files,
 * and the `INFO` list or an embedded ID3 chunk of WAV files. Nothing leaves the browser; a file
 * without tags is named after itself.
 */

/** The tags of one song. Every field is absent when the file does not say. */
export interface SongTags {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  composer?: string;
  genre?: string;
  year?: number;
  track?: number;
  grouping?: string;
  comments?: string;
  /** Unsynchronised lyrics, with their line breaks. */
  lyrics?: string;
  /** The embedded cover: its media type and bytes. */
  picture?: { type: string; data: Uint8Array };
}

/** Reads `length` bytes of a file at `offset` (fewer at its end). */
export type ByteReader = (offset: number, length: number) => Promise<Uint8Array>;

/** A reader over a `Blob` (a `File` the person chose). */
export function blobReader(blob: Blob): ByteReader {
  return async (offset, length) =>
    new Uint8Array(await blob.slice(offset, Math.min(blob.size, offset + length)).arrayBuffer());
}

/** A reader over bytes in memory. */
export function bytesReader(bytes: Uint8Array): ByteReader {
  return async (offset, length) => bytes.subarray(offset, Math.min(bytes.length, offset + length));
}

/** The largest block of tags read, in bytes: a cover is rarely larger. */
const MAX_TAG_BYTES = 16 * 1024 * 1024;

/** Bytes as Latin-1 text, a character per byte, built in bounded pieces (a large block would
 * pass too many arguments to `String.fromCharCode` in one call). */
const latin1 = (bytes: Uint8Array) => {
  let text = "";
  for (let at = 0; at < bytes.length; at += 8192) {
    text += String.fromCharCode(...bytes.subarray(at, at + 8192));
  }
  return text;
};
const ascii = (bytes: Uint8Array, start: number, length: number) =>
  latin1(bytes.subarray(start, start + length));
const utf8 = (bytes: Uint8Array) => new TextDecoder("utf-8").decode(bytes);

const u32be = (b: Uint8Array, i: number) =>
  ((b[i] ?? 0) * 0x1000000 + ((b[i + 1] ?? 0) << 16) + ((b[i + 2] ?? 0) << 8) + (b[i + 3] ?? 0)) >>>
  0;
const u32le = (b: Uint8Array, i: number) =>
  ((b[i + 3] ?? 0) * 0x1000000 + ((b[i + 2] ?? 0) << 16) + ((b[i + 1] ?? 0) << 8) + (b[i] ?? 0)) >>>
  0;
const u24be = (b: Uint8Array, i: number) =>
  ((b[i] ?? 0) << 16) + ((b[i + 1] ?? 0) << 8) + (b[i + 2] ?? 0);
const synchsafe = (b: Uint8Array, i: number) =>
  (((b[i] ?? 0) & 0x7f) << 21) |
  (((b[i + 1] ?? 0) & 0x7f) << 14) |
  (((b[i + 2] ?? 0) & 0x7f) << 7) |
  ((b[i + 3] ?? 0) & 0x7f);

/** A tag's text, trimmed, or `undefined` when empty. */
function clean(text: string | undefined): string | undefined {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: tags pad with NUL and controls.
  const trimmed = text?.replace(/[\u0000-\u001f]+/g, " ").trim();
  return trimmed ? trimmed.slice(0, 200) : undefined;
}

/** The most characters of lyrics kept (the module's `MAX_LYRICS_CHARS`). */
const MAX_LYRICS = 10_000;

/** Lyrics with their line breaks, and no other control character. */
function cleanLyrics(text: string | undefined): string | undefined {
  const kept = text
    ?.replace(/\r\n?/g, "\n")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: tags pad with NUL and controls.
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]+/g, " ")
    .trim();
  return kept ? kept.slice(0, MAX_LYRICS) : undefined;
}

/** The first number of `3/12`, `03` or `2014-02-10`, within `[min, max]`. */
function leadingNumber(text: string | undefined, min: number, max: number): number | undefined {
  const match = text?.trim().match(/^\d+/);
  const value = match ? Number(match[0]) : Number.NaN;
  return Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

/** The ID3v1 genres, by number, as `(17)` and `17` in TCON refer to them. */
const ID3_GENRES = [
  "Blues",
  "Classic Rock",
  "Country",
  "Dance",
  "Disco",
  "Funk",
  "Grunge",
  "Hip-Hop",
  "Jazz",
  "Metal",
  "New Age",
  "Oldies",
  "Other",
  "Pop",
  "R&B",
  "Rap",
  "Reggae",
  "Rock",
  "Techno",
  "Industrial",
  "Alternative",
  "Ska",
  "Death Metal",
  "Pranks",
  "Soundtrack",
  "Euro-Techno",
  "Ambient",
  "Trip-Hop",
  "Vocal",
  "Jazz+Funk",
  "Fusion",
  "Trance",
  "Classical",
  "Instrumental",
  "Acid",
  "House",
  "Game",
  "Sound Clip",
  "Gospel",
  "Noise",
  "Alternative Rock",
  "Bass",
  "Soul",
  "Punk",
  "Space",
  "Meditative",
  "Instrumental Pop",
  "Instrumental Rock",
  "Ethnic",
  "Gothic",
  "Darkwave",
  "Techno-Industrial",
  "Electronic",
  "Pop-Folk",
  "Eurodance",
  "Dream",
  "Southern Rock",
  "Comedy",
  "Cult",
  "Gangsta",
  "Top 40",
  "Christian Rap",
  "Pop/Funk",
  "Jungle",
  "Native American",
  "Cabaret",
  "New Wave",
  "Psychedelic",
  "Rave",
  "Showtunes",
  "Trailer",
  "Lo-Fi",
  "Tribal",
  "Acid Punk",
  "Acid Jazz",
  "Polka",
  "Retro",
  "Musical",
  "Rock & Roll",
  "Hard Rock",
  // The extended table (80 to 147) that Winamp added and taggers since use.
  "Folk",
  "Folk-Rock",
  "National Folk",
  "Swing",
  "Fast Fusion",
  "Bebop",
  "Latin",
  "Revival",
  "Celtic",
  "Bluegrass",
  "Avantgarde",
  "Gothic Rock",
  "Progressive Rock",
  "Psychedelic Rock",
  "Symphonic Rock",
  "Slow Rock",
  "Big Band",
  "Chorus",
  "Easy Listening",
  "Acoustic",
  "Humour",
  "Speech",
  "Chanson",
  "Opera",
  "Chamber Music",
  "Sonata",
  "Symphony",
  "Booty Bass",
  "Primus",
  "Groove",
  "Satire",
  "Slow Jam",
  "Club",
  "Tango",
  "Samba",
  "Folklore",
  "Ballad",
  "Power Ballad",
  "Rhythmic Soul",
  "Freestyle",
  "Duet",
  "Punk Rock",
  "Drum Solo",
  "A Cappella",
  "Euro-House",
  "Dance Hall",
  "Goa",
  "Drum & Bass",
  "Club-House",
  "Hardcore",
  "Terror",
  "Indie",
  "BritPop",
  "Afro-Punk",
  "Polsk Punk",
  "Beat",
  "Christian Gangsta Rap",
  "Heavy Metal",
  "Black Metal",
  "Crossover",
  "Contemporary Christian",
  "Christian Rock",
  "Merengue",
  "Salsa",
  "Thrash Metal",
  "Anime",
  "JPop",
  "Synthpop",
];

/** A genre as written, with ID3's numbered genres named. */
function genreName(text: string | undefined): string | undefined {
  const value = clean(text);
  if (!value) return undefined;
  const numbered = value.match(/^\((\d+)\)(.*)$/) ?? value.match(/^(\d+)()$/);
  if (numbered) return clean(numbered[2]) ?? ID3_GENRES[Number(numbered[1])] ?? undefined;
  return value;
}

// ---- ID3v2 ------------------------------------------------------------------------------

/** Undoes ID3 unsynchronisation: every `FF 00` was `FF`. */
function resynchronise(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    out.push(bytes[i] as number);
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) i += 1;
  }
  return Uint8Array.from(out);
}

/** Text in one of ID3's four encodings; with `terminated`, up to the first NUL of it. */
function id3Text(
  bytes: Uint8Array,
  encoding: number,
  terminated = false,
): { text: string; next: number } {
  const wide = encoding === 1 || encoding === 2;
  let end = bytes.length;
  if (terminated) {
    for (let i = 0; i < bytes.length; i += wide ? 2 : 1) {
      if (bytes[i] === 0 && (!wide || bytes[i + 1] === 0)) {
        end = i;
        break;
      }
    }
  }
  const body = bytes.subarray(0, end);
  const next = Math.min(bytes.length, end + (wide ? 2 : 1));
  if (encoding === 0) return { text: latin1(body), next };
  if (encoding === 3) return { text: utf8(body), next };
  // UTF-16: with a byte-order mark (1), or big-endian without one (2).
  let little = false;
  let start = 0;
  if (body[0] === 0xff && body[1] === 0xfe) {
    little = true;
    start = 2;
  } else if (body[0] === 0xfe && body[1] === 0xff) {
    start = 2;
  }
  let text = "";
  for (let i = start; i + 1 < body.length; i += 2) {
    text += String.fromCharCode(
      little
        ? (body[i] as number) | ((body[i + 1] as number) << 8)
        : ((body[i] as number) << 8) | (body[i + 1] as number),
    );
  }
  return { text, next };
}

/** A text frame's first value (ID3v2.4 separates several with NUL). */
function id3TextFrame(data: Uint8Array): string | undefined {
  if (data.length < 1) return undefined;
  const { text } = id3Text(data.subarray(1), data[0] as number, true);
  return clean(text);
}

/** The text of a USLT or COMM frame: encoding, language, a descriptor, then the text. */
function id3LanguageFrame(data: Uint8Array): string | undefined {
  if (data.length < 5) return undefined;
  const encoding = data[0] as number;
  const { next } = id3Text(data.subarray(4), encoding, true);
  return id3Text(data.subarray(4 + next), encoding).text;
}

function id3Picture(data: Uint8Array, v22: boolean): SongTags["picture"] {
  const encoding = data[0] ?? 0;
  let offset = 1;
  let type: string;
  if (v22) {
    const format = ascii(data, 1, 3).toUpperCase();
    type = format === "PNG" ? "image/png" : "image/jpeg";
    offset = 4;
  } else {
    const end = data.indexOf(0, 1);
    if (end < 0) return undefined;
    type = latin1(data.subarray(1, end)).toLowerCase() || "image/jpeg";
    if (!type.includes("/")) type = `image/${type === "jpg" ? "jpeg" : type}`;
    offset = end + 1;
  }
  offset += 1; // the picture type
  offset += id3Text(data.subarray(offset), encoding, true).next;
  const picture = data.subarray(offset);
  return picture.length > 0 ? { type, data: picture.slice() } : undefined;
}

/** The tags of an ID3v2 tag, from its 10-byte header on. */
export function parseId3v2(tag: Uint8Array): SongTags {
  const tags: SongTags = {};
  if (ascii(tag, 0, 3) !== "ID3") return tags;
  const version = tag[3] ?? 0;
  const flags = tag[5] ?? 0;
  const size = synchsafe(tag, 6);
  let body = tag.subarray(10, 10 + size);
  if (flags & 0x80 && version < 4) body = resynchronise(body);
  let offset = 0;
  if (flags & 0x40) {
    // The extended header: its size counts itself in 2.4, not in 2.3.
    offset = version >= 4 ? synchsafe(body, 0) : u32be(body, 0) + 4;
  }
  const v22 = version === 2;
  const header = v22 ? 6 : 10;
  const frames: Record<string, keyof SongTags> = v22
    ? {
        TT2: "title",
        TP1: "artist",
        TP2: "albumArtist",
        TAL: "album",
        TCO: "genre",
        TCM: "composer",
        TT1: "grouping",
      }
    : {
        TIT2: "title",
        TPE1: "artist",
        TPE2: "albumArtist",
        TALB: "album",
        TCON: "genre",
        TCOM: "composer",
        TIT1: "grouping",
      };
  while (offset + header <= body.length) {
    const id = ascii(body, offset, v22 ? 3 : 4);
    if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
    const frameSize = v22
      ? u24be(body, offset + 3)
      : version >= 4
        ? synchsafe(body, offset + 4)
        : u32be(body, offset + 4);
    const frameFlags = v22 ? 0 : (body[offset + 9] ?? 0);
    let data = body.subarray(offset + header, offset + header + frameSize);
    offset += header + frameSize;
    if (frameSize === 0) continue;
    // Compressed or encrypted frames are not read (2.3: 0x80, 0x40; 2.4: 0x08, 0x04).
    if (!v22 && (frameFlags & (version >= 4 ? 0x0c : 0xc0)) !== 0) continue;
    if (version >= 4) {
      // 2.4: a group id byte (0x40), then a data length indicator (0x01), before the data,
      // which is unsynchronised when the frame says so (0x02) or the whole tag does.
      data = data.subarray((frameFlags & 0x40 ? 1 : 0) + (frameFlags & 0x01 ? 4 : 0));
      if (frameFlags & 0x02 || flags & 0x80) data = resynchronise(data);
    } else if (!v22 && frameFlags & 0x20) {
      // 2.3: a group id byte before the data.
      data = data.subarray(1);
    }
    const field = frames[id];
    if (field === "genre") tags.genre ??= genreName(id3TextFrame(data));
    else if (field) (tags as Record<string, unknown>)[field] ??= id3TextFrame(data);
    else if (id === "TRCK" || id === "TRK")
      tags.track ??= leadingNumber(id3TextFrame(data), 1, 9999);
    else if (id === "TYER" || id === "TYE" || id === "TDRC" || id === "TDOR")
      tags.year ??= leadingNumber(id3TextFrame(data), 1000, 9999);
    else if (id === "APIC" || id === "PIC") tags.picture ??= id3Picture(data, v22);
    else if (id === "USLT" || id === "ULT") tags.lyrics ??= cleanLyrics(id3LanguageFrame(data));
    else if (id === "COMM" || id === "COM") tags.comments ??= clean(id3LanguageFrame(data));
  }
  return tags;
}

/** The tags of a 128-byte ID3v1 tag. */
export function parseId3v1(tag: Uint8Array): SongTags {
  if (tag.length < 128 || ascii(tag, 0, 3) !== "TAG") return {};
  const field = (start: number, length: number) => clean(ascii(tag, start, length));
  return {
    title: field(3, 30),
    artist: field(33, 30),
    album: field(63, 30),
    year: leadingNumber(field(93, 4), 1000, 9999),
    track: tag[125] === 0 && (tag[126] ?? 0) > 0 ? tag[126] : undefined,
    genre: ID3_GENRES[tag[127] ?? 255],
  };
}

// ---- Vorbis comments (FLAC, Ogg) -----------------------------------------------------------

/** Tags from a Vorbis comment block: a vendor string and `KEY=value` entries, little-endian. */
export function parseVorbisComments(block: Uint8Array): SongTags {
  const tags: SongTags = {};
  let offset = 4 + u32le(block, 0);
  const count = u32le(block, offset);
  offset += 4;
  for (let n = 0; n < count && offset + 4 <= block.length; n += 1) {
    const length = u32le(block, offset);
    const entry = utf8(block.subarray(offset + 4, offset + 4 + length));
    offset += 4 + length;
    const equals = entry.indexOf("=");
    if (equals < 0) continue;
    const key = entry.slice(0, equals).toUpperCase();
    if (key === "METADATA_BLOCK_PICTURE") {
      // Decoded whole: a cover is far longer than any text field is kept.
      try {
        const bytes = Uint8Array.from(atob(entry.slice(equals + 1).trim()), (c) => c.charCodeAt(0));
        tags.picture ??= parseFlacPicture(bytes);
      } catch {
        // A picture that is not base64 is left out.
      }
      continue;
    }
    if (key === "LYRICS" || key === "UNSYNCEDLYRICS") {
      tags.lyrics ??= cleanLyrics(entry.slice(equals + 1));
      continue;
    }
    const value = clean(entry.slice(equals + 1));
    if (!value) continue;
    if (key === "TITLE") tags.title ??= value;
    else if (key === "ARTIST") tags.artist ??= value;
    else if (key === "ALBUMARTIST" || key === "ALBUM ARTIST") tags.albumArtist ??= value;
    else if (key === "ALBUM") tags.album ??= value;
    else if (key === "GENRE") tags.genre ??= value;
    else if (key === "COMPOSER") tags.composer ??= value;
    else if (key === "GROUPING") tags.grouping ??= value;
    else if (key === "COMMENT" || key === "DESCRIPTION") tags.comments ??= value;
    else if (key === "DATE" || key === "YEAR") tags.year ??= leadingNumber(value, 1000, 9999);
    else if (key === "TRACKNUMBER") tags.track ??= leadingNumber(value, 1, 9999);
  }
  return tags;
}

/** A FLAC PICTURE block (also the payload of METADATA_BLOCK_PICTURE), big-endian. */
export function parseFlacPicture(block: Uint8Array): SongTags["picture"] {
  let offset = 4;
  const mimeLength = u32be(block, offset);
  const type = latin1(block.subarray(offset + 4, offset + 4 + mimeLength)) || "image/jpeg";
  offset += 4 + mimeLength;
  offset += 4 + u32be(block, offset); // the description
  offset += 16; // width, height, depth, colours
  const length = u32be(block, offset);
  const data = block.subarray(offset + 4, offset + 4 + length);
  return data.length > 0 && data.length === length ? { type, data: data.slice() } : undefined;
}

async function readFlac(read: ByteReader): Promise<SongTags> {
  let tags: SongTags = {};
  let offset = 4;
  for (let blocks = 0; blocks < 64; blocks += 1) {
    const header = await read(offset, 4);
    if (header.length < 4) break;
    const last = ((header[0] as number) & 0x80) !== 0;
    const type = (header[0] as number) & 0x7f;
    const length = u24be(header, 1);
    if (type === 4 || type === 6) {
      const block = await read(offset + 4, Math.min(length, MAX_TAG_BYTES));
      if (type === 4) {
        const comments = parseVorbisComments(block);
        tags = { ...comments, picture: tags.picture ?? comments.picture };
      } else tags.picture ??= parseFlacPicture(block);
    }
    offset += 4 + length;
    if (last) break;
  }
  return tags;
}

/** How much of an Ogg file is read for its comment header: covers are seldom larger. */
const OGG_HEAD_BYTES = 4 * 1024 * 1024;

/**
 * The first packets of each logical stream of an Ogg file, by serial number, rebuilt from its
 * pages: each page's segment table says how long each segment is, and a packet ends at the first
 * segment shorter than 255 bytes, which may be pages later. Pages of other streams (an Ogg
 * Skeleton, say) interleave without mixing. Each stream keeps at most `count` packets.
 */
export function oggStreams(bytes: Uint8Array, count: number): Map<number, Uint8Array[]> {
  const streams = new Map<number, { packets: Uint8Array[]; parts: Uint8Array[] }>();
  for (let at = 0; at + 27 <= bytes.length; ) {
    if (ascii(bytes, at, 4) !== "OggS") break;
    const serial = u32le(bytes, at + 14);
    const segments = bytes[at + 26] as number;
    const table = bytes.subarray(at + 27, at + 27 + segments);
    let body = at + 27 + segments;
    let stream = streams.get(serial);
    if (!stream) {
      stream = { packets: [], parts: [] };
      streams.set(serial, stream);
    }
    for (const lace of table) {
      if (stream.packets.length < count) stream.parts.push(bytes.subarray(body, body + lace));
      body += lace;
      if (lace < 255 && stream.packets.length < count) {
        const length = stream.parts.reduce((sum, part) => sum + part.length, 0);
        const packet = new Uint8Array(length);
        let offset = 0;
        for (const part of stream.parts) {
          packet.set(part, offset);
          offset += part.length;
        }
        stream.packets.push(packet);
        stream.parts = [];
      }
    }
    at = body;
  }
  return new Map([...streams].map(([serial, stream]) => [serial, stream.packets]));
}

async function readOgg(read: ByteReader): Promise<SongTags> {
  // The comment header is the second packet of the Vorbis or Opus stream, after its
  // identification header.
  for (const [first, comment] of oggStreams(await read(0, OGG_HEAD_BYTES), 2).values()) {
    if (!first || !comment) continue;
    if (ascii(first, 0, 7) === "\u0001vorbis" && ascii(comment, 0, 7) === "\u0003vorbis") {
      return parseVorbisComments(comment.subarray(7));
    }
    if (ascii(first, 0, 8) === "OpusHead" && ascii(comment, 0, 8) === "OpusTags") {
      return parseVorbisComments(comment.subarray(8));
    }
  }
  return {};
}

// ---- MP4 ----------------------------------------------------------------------------------

interface Box {
  type: string;
  start: number;
  end: number;
  body: number;
}

function boxesIn(bytes: Uint8Array, from: number, to: number): Box[] {
  const boxes: Box[] = [];
  for (let offset = from; offset + 8 <= to; ) {
    let size = u32be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    let body = offset + 8;
    if (size === 1) {
      size = u32be(bytes, offset + 8) * 2 ** 32 + u32be(bytes, offset + 12);
      body = offset + 16;
    } else if (size === 0) size = to - offset;
    if (size < 8 || offset + size > to) break;
    boxes.push({ type, start: offset, end: offset + size, body });
    offset += size;
  }
  return boxes;
}

/** The tags of an MP4 `moov` box's bytes (from its header). */
export function parseMp4Moov(moov: Uint8Array): SongTags {
  const tags: SongTags = {};
  const find = (boxes: Box[], type: string) => boxes.find((box) => box.type === type);
  const root = find(boxesIn(moov, 0, moov.length), "moov");
  const udta = root && find(boxesIn(moov, root.body, root.end), "udta");
  const meta = udta && find(boxesIn(moov, udta.body, udta.end), "meta");
  // `meta` is a full box: four bytes of version and flags before its children.
  const ilst = meta && find(boxesIn(moov, meta.body + 4, meta.end), "ilst");
  if (!ilst) return tags;
  for (const item of boxesIn(moov, ilst.body, ilst.end)) {
    const data = find(boxesIn(moov, item.body, item.end), "data");
    if (!data) continue;
    const kind = u32be(moov, data.body) & 0xffffff;
    const value = moov.subarray(data.body + 8, data.end);
    // Text atoms are UTF-8 (kind 1) or UTF-16 big-endian (kind 2).
    const text = () => clean(kind === 2 ? new TextDecoder("utf-16be").decode(value) : utf8(value));
    switch (item.type) {
      case "\u00a9nam":
        tags.title ??= text();
        break;
      case "\u00a9ART":
        tags.artist ??= text();
        break;
      case "aART":
        tags.albumArtist ??= text();
        break;
      case "\u00a9alb":
        tags.album ??= text();
        break;
      case "\u00a9gen":
        tags.genre ??= text();
        break;
      case "\u00a9wrt":
        tags.composer ??= text();
        break;
      case "\u00a9grp":
        tags.grouping ??= text();
        break;
      case "\u00a9cmt":
        tags.comments ??= text();
        break;
      case "\u00a9lyr":
        tags.lyrics ??= cleanLyrics(new TextDecoder().decode(value));
        break;
      case "gnre":
        tags.genre ??= ID3_GENRES[(((value[0] ?? 0) << 8) | (value[1] ?? 0)) - 1];
        break;
      case "\u00a9day":
        tags.year ??= leadingNumber(text(), 1000, 9999);
        break;
      case "trkn": {
        const track = ((value[2] ?? 0) << 8) | (value[3] ?? 0);
        if (track > 0) tags.track ??= track;
        break;
      }
      case "covr":
        if (value.length > 0) {
          tags.picture ??= { type: kind === 14 ? "image/png" : "image/jpeg", data: value.slice() };
        }
        break;
    }
  }
  return tags;
}

async function readMp4(read: ByteReader, size: number): Promise<SongTags> {
  for (let offset = 0; offset + 8 <= size; ) {
    const head = await read(offset, 16);
    let boxSize = u32be(head, 0);
    const type = ascii(head, 4, 4);
    if (boxSize === 1) boxSize = u32be(head, 8) * 2 ** 32 + u32be(head, 12);
    else if (boxSize === 0) boxSize = size - offset;
    if (boxSize < 8) break;
    if (type === "moov") {
      if (boxSize > MAX_TAG_BYTES) return {};
      return parseMp4Moov(await read(offset, boxSize));
    }
    offset += boxSize;
  }
  return {};
}

// ---- WAV ----------------------------------------------------------------------------------

/** A WAV INFO string: UTF-8 when it is valid UTF-8, else the Windows code page that older
 * tools wrote (windows-1252). */
function infoText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function readWav(read: ByteReader, size: number): Promise<SongTags> {
  let tags: SongTags = {};
  for (let offset = 12; offset + 8 <= size; ) {
    const head = await read(offset, 12);
    const id = ascii(head, 0, 4);
    const length = u32le(head, 4);
    if (id === "LIST" && ascii(head, 8, 4) === "INFO" && length <= MAX_TAG_BYTES) {
      const list = await read(offset + 12, length - 4);
      const info: Record<string, keyof SongTags> = {
        INAM: "title",
        IART: "artist",
        IPRD: "album",
        IGNR: "genre",
      };
      for (let at = 0; at + 8 <= list.length; ) {
        const key = ascii(list, at, 4);
        const len = u32le(list, at + 4);
        const value = clean(infoText(list.subarray(at + 8, at + 8 + len)));
        const field = info[key];
        if (field && value) (tags as Record<string, unknown>)[field] ??= value;
        if (key === "ICRD") tags.year ??= leadingNumber(value, 1000, 9999);
        if (key === "ITRK" || key === "IPRT") tags.track ??= leadingNumber(value, 1, 9999);
        at += 8 + len + (len % 2);
      }
    } else if ((id === "id3 " || id === "ID3 ") && length <= MAX_TAG_BYTES) {
      tags = { ...parseId3v2(await read(offset + 8, length)), ...definedOnly(tags) };
    }
    offset += 8 + length + (length % 2);
  }
  return tags;
}

function definedOnly(tags: SongTags): SongTags {
  return Object.fromEntries(Object.entries(tags).filter(([, value]) => value !== undefined));
}

// ---- Every format --------------------------------------------------------------------------

/** Reads the tags of a file of `size` bytes through `read`, whatever its format. */
export async function readSongTags(read: ByteReader, size: number): Promise<SongTags> {
  const head = await read(0, 12);
  const magic = ascii(head, 0, 4);
  if (magic === "fLaC") return readFlac(read);
  if (magic === "OggS") return readOgg(read);
  if (magic === "RIFF" && ascii(head, 8, 4) === "WAVE") return readWav(read, size);
  if (ascii(head, 4, 4) === "ftyp") return readMp4(read, size);
  let tags: SongTags = {};
  if (ascii(head, 0, 3) === "ID3") {
    const total = 10 + synchsafe(head, 6);
    tags = parseId3v2(await read(0, Math.min(total, MAX_TAG_BYTES)));
  }
  if (size >= 128) {
    const v1 = definedOnly(parseId3v1(await read(size - 128, 128)));
    tags = { ...v1, ...definedOnly(tags) };
  }
  return tags;
}

/** The tags of a file the person chose. */
export function readFileTags(file: Blob): Promise<SongTags> {
  return readSongTags(blobReader(file), file.size);
}

/** A title from a file name: without its extension, with `_` as spaces. */
export function titleFromFileName(name: string): string {
  const base = name
    .replace(/\.[^./]{1,5}$/, "")
    .replace(/_/g, " ")
    .trim();
  return base || name || "Untitled";
}

/** The media type of a song file, from its own type or its extension. */
/**
 * Whether a drive file is a song to Music: a sound file, by its type or name. An `.mp4` without a
 * type is taken for a movie, which QuickTime Player opens.
 */
export function isSongFile(file: { name: string; type?: string }): boolean {
  if (file.type?.startsWith("video/")) return false;
  if (!file.type && /\.mp4$/i.test(file.name)) return false;
  return audioType({ name: file.name, type: file.type ?? "" }) !== undefined;
}

export function audioType(file: { name: string; type: string }): string | undefined {
  if (file.type.startsWith("audio/")) return file.type;
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const byExtension: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    mp4: "audio/mp4",
    flac: "audio/flac",
    wav: "audio/wav",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    opus: "audio/ogg",
  };
  return extension ? byExtension[extension] : undefined;
}
