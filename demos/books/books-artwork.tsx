/*
 * The demo's drawings, all original. Books is mostly pictures: the cover in the library, the
 * page spread in the book window and the page thumbnails are the book's own artwork, which is
 * not reproduced. Each is replaced by the same abstract placeholder, a flat panel with the
 * usual sign for "a picture goes here" and the title or the page number as plain text. The
 * sidebar's icons and the book window's glyphs are stand-ins on the measured boxes.
 */
import { type ReactNode, useState } from "react";
import type { BooksSection } from "./books-data";

/** The generated covers in ./art, by the id of the book they belong to. */
const COVERS: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./art/*.webp", { eager: true, query: "?url", import: "default" }),
  ).map(([file, url]) => [file.slice("./art/".length, -".webp".length), url]),
);

/** The textless covers the store's cards take in turn, since a store card's title is invented. */
const STORE_COVERS = Object.keys(COVERS)
  .filter((name) => name.startsWith("store-"))
  .sort()
  .map((name) => COVERS[name]);

/** The cover of a book: its own, or for a store card (`new-3`, `top-1`) one of the store's. */
function coverFor(id: string | undefined): string | undefined {
  if (!id) return undefined;
  if (COVERS[id]) return COVERS[id];
  const dash = id.lastIndexOf("-");
  const index = Number(id.slice(dash + 1));
  if (!Number.isInteger(index) || STORE_COVERS.length === 0) return undefined;
  // The shelf's prefix shifts the sequence so that the shelves do not open with the same cover.
  let shift = 0;
  for (const letter of id.slice(0, dash)) shift += letter.charCodeAt(0) * 3;
  return STORE_COVERS[(index + shift) % STORE_COVERS.length];
}

/** White glyphs of the six Library rows and of a collection, on an 18 pt square. */
const SECTION_GLYPHS: Record<BooksSection | "collection", ReactNode> = {
  // Three spines on a shelf.
  all: <path d="M4.500 5h2v8h-2zM7.500 5h2v8h-2zM10.700 5.600l1.900-.500 2 7.400-1.900.500z" />,
  // An open book.
  books: (
    <path d="M3.500 5.500c2-.700 3.700-.500 5 .500v7.500c-1.300-1-3-1.200-5-.500zM14.500 5.500c-2-.700-3.700-.500-5 .500v7.500c1.300-1 3-1.200 5-.500z" />
  ),
  // Headphones.
  audiobooks: (
    <path
      fillRule="evenodd"
      d="M9 4a5 5 0 0 1 5 5v3.500a1.500 1.500 0 0 1-3 0v-2a1.500 1.500 0 0 1 1.700-1.490A3.700 3.700 0 0 0 5.300 9.010 1.500 1.500 0 0 1 7 10.500v2a1.500 1.500 0 0 1-3 0V9a5 5 0 0 1 5-5z"
    />
  ),
  // A sheet with a folded corner and two lines.
  pdfs: <path fillRule="evenodd" d="M5.500 4h4.500l3 3v7h-7.500zM7 9v1h4.500V9zm0 2v1h4.500v-1z" />,
  // Two people.
  authors: (
    <path d="M6.500 5.500a1.750 1.750 0 1 1 0 3.500 1.750 1.750 0 0 1 0-3.500zM11.500 5.500a1.750 1.750 0 1 1 0 3.500 1.750 1.750 0 0 1 0-3.500zM3.500 13c0-2 1.300-3.200 3-3.200s3 1.200 3 3.200zM10.200 13c0-1.200-.300-2.200-.900-3 .600-.100 1.400-.200 2.200-.200 1.700 0 3 1.200 3 3.200z" />
  ),
  // A stack: a tray under a lid.
  categories: <path d="M5.500 4.500h7v1.500h-7zM4.500 7h9v6.500a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z" />,
  // A plain sheet, for a collection the user made.
  collection: <path d="M5 4.500h8v9H5z" />,
};

/** The icon of a sidebar row: an orange rounded square with a white glyph, 18 pt. */
export function SectionIcon({ section }: { section: BooksSection | "collection" }) {
  return (
    <svg
      className="mac-books-section-icon"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="mac-books-section-icon-plate" width="18" height="18" rx="4" />
      <g className="mac-books-section-icon-glyph">{SECTION_GLYPHS[section]}</g>
    </svg>
  );
}

/*
 * The glyphs of the two bars, in the colour of the control they are in. Measured boxes
 * (reference/spec/apps/books.md and the captures): the list in the library's sidebar button is
 * 20.5 by 10 pt, bullets before 16 pt lines; the book window's are Library 14,
 * Table of Contents 19, Notes 16, Search 15 and Bookmark 9 pt wide.
 */
const GLYPHS = {
  // Three bulleted lines, as the sidebar button and Table of Contents show them.
  list: [
    20.5,
    10,
    <path
      key="p"
      d="M0 0h2.5v2H0zM4.5 0h16v2h-16zM0 4h2.5v2H0zM4.5 4h16v2h-16zM0 8h2.5v2H0zM4.5 8h16v2h-16z"
    />,
  ],
  contents: [
    19,
    14,
    <path key="p" d="M0 0h2v2H0zM4 0h15v2H4zM0 6h2v2H0zM4 6h15v2H4zM0 12h2v2H0zM4 12h15v2H4z" />,
  ],
  // A closed book, its cover towards the viewer and its spine to the left.
  library: [
    14,
    16.5,
    <path key="p" fillRule="evenodd" d="M0 3 9 0l5 1.5V14l-9 2.5-5-1.5zM4.5 4.3v11l.9-.3V4z" />,
  ],
  // A page of text. A point of space above it: its ink is 10.5 to 27.5 pt down the bar.
  notes: [
    16,
    18,
    <path
      key="p"
      fillRule="evenodd"
      d="M0 1h16v17H0zM1 4v13h14V4zM3 6.5h10v1H3zM3 9h10v1H3zM3 11.5h10v1H3zM3 14h6v1H3z"
    />,
  ],
  // Two points of space above it: the glass is 12 to 23 pt down the bar, its handle to 27.
  search: [
    15,
    17,
    <g key="g" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="6.25" cy="8.25" r="5.25" />
      <path d="M10.2 12.2l4.1 4.1" />
    </g>,
  ],
  bookmark: [9, 13, <path key="p" d="M0 0h9v13L4.5 9.5 0 13z" />],
} satisfies Record<string, readonly [width: number, height: number, drawing: ReactNode]>;

/** A glyph of the library's toolbar or of the book window's bar, drawn in `currentColor`. */
export function BooksGlyph({ name }: { name: keyof typeof GLYPHS }) {
  const [width, height, drawing] = GLYPHS[name];
  return (
    <svg
      className="mac-books-glyph"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {drawing}
    </svg>
  );
}

/** The sign for "a picture goes here": a frame with a disc and a slope. */
function PictureMark() {
  return (
    <svg
      className="mac-books-mark"
      width="40"
      height="32"
      viewBox="0 0 40 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4 0h32a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4zm0 3a1 1 0 0 0-1 1v24a1 1 0 0 0 1 1h32a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm7.500 4a3.500 3.500 0 1 1 0 7 3.500 3.500 0 0 1 0-7zM6 26l8-9 5 5 6.500-8L34 26z"
      />
    </svg>
  );
}

/**
 * The cover of a book: its generated artwork when there is one, otherwise the placeholder, a
 * flat panel with the mark, the title and the author as plain text. Decorative either way:
 * the cover's button names the book.
 */
export function CoverArtwork({
  id,
  title,
  author,
}: {
  id?: string;
  title: string;
  author: string;
}) {
  const url = coverFor(id);
  if (url) {
    return (
      <span className="mac-books-artwork" data-kind="cover" data-art="" aria-hidden="true">
        <img className="mac-books-artwork-image" src={url} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className="mac-books-artwork" data-kind="cover" aria-hidden="true">
      <PictureMark />
      <span className="mac-books-artwork-title">{title}</span>
      <span className="mac-books-artwork-note">{author}</span>
    </span>
  );
}

/**
 * The cover of a real book (the desktop app's library and store): its picture, which the browser
 * loads straight from Project Gutenberg or Standard Ebooks, and the placeholder when it has none
 * or the picture does not load. Decorative, as the demo's covers are.
 */
export function RealCoverArtwork({
  cover,
  title,
  author,
}: {
  cover?: string;
  title: string;
  author: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!cover || failed === cover) return <CoverArtwork title={title} author={author} />;
  return (
    <span className="mac-books-artwork" data-kind="cover" data-art="" aria-hidden="true">
      <img
        className="mac-books-artwork-image"
        src={cover}
        alt=""
        draggable={false}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(cover)}
      />
    </span>
  );
}

/**
 * The placeholder of a page, in the book window and, small, in a thumbnail: a flat sheet with
 * the mark and the page's number. Decorative: what it stands in is named by its container.
 */
export function PageArtwork({
  title,
  page,
  small,
}: {
  title: string;
  page: number;
  small?: boolean;
}) {
  return (
    <span className="mac-books-artwork" data-kind={small ? "thumbnail" : "page"} aria-hidden="true">
      <PictureMark />
      {small ? null : <span className="mac-books-artwork-title">{title}</span>}
      {small ? null : <span className="mac-books-artwork-note">Page {page}</span>}
    </span>
  );
}
