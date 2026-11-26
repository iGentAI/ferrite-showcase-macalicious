import type { ComponentProps } from "react";

/*
 * The glyphs of the Font Book demo that the library's System Image does not have (the plus and
 * the Info view's disc are its `add` and `info`). Every one is an original drawing to the size
 * measured in the reference screenshots, in the colour of its place (`currentColor`); none is
 * Apple's artwork.
 */

type GlyphProps = ComponentProps<"svg">;

function Glyph({ width, height, children, ...props }: GlyphProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Print, for a toolbar that was customized: a printer, 16 pt; no reference shows it. */
export function PrintGlyph(props: GlyphProps) {
  return (
    <Glyph width={16} height={16} {...props}>
      <path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5.5h11v5.5h-2M4.5 9.5h7v4h-7z" strokeLinejoin="round" />
    </Glyph>
  );
}

/** Validate Font, for a toolbar that was customized: a tick, 16 pt; no reference shows it. */
export function ValidateGlyph(props: GlyphProps) {
  return (
    <Glyph width={16} height={16} {...props}>
      <path d="M3 8.5l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
    </Glyph>
  );
}

/** Sample view: four centred lines of text, 14 by 11 pt. */
export function SampleGlyph(props: GlyphProps) {
  return (
    <Glyph width={14} height={11} {...props}>
      <path d="M0 1h14M2.5 4h9M0 7h14M2.5 10h9" />
    </Glyph>
  );
}

/** Repertoire view: a grid of four by three dots, 14 by 10 pt. */
export function RepertoireGlyph(props: GlyphProps) {
  return (
    <Glyph width={14} height={10} stroke="none" fill="currentColor" {...props}>
      <path d="M0 0h2v2H0zM4 0h2v2H4zM8 0h2v2H8zM12 0h2v2h-2zM0 4h2v2H0zM4 4h2v2H4zM8 4h2v2H8zM12 4h2v2h-2zM0 8h2v2H0zM4 8h2v2H4zM8 8h2v2H8zM12 8h2v2h-2z" />
    </Glyph>
  );
}

/** Custom view: the insertion point that follows the letters "Aa", 5 by 14 pt, in half tone. */
export function InsertionPointGlyph(props: GlyphProps) {
  return (
    <Glyph width={5} height={14} opacity={0.5} {...props}>
      <path d="M0 .5h1.25c.7 0 1.25.5 1.25 1.2v10.6c0 .7-.55 1.2-1.25 1.2H0M5 .5H3.75c-.7 0-1.25.5-1.25 1.2M5 13.5H3.75c-.7 0-1.25-.5-1.25-1.2" />
    </Glyph>
  );
}

/** Enable or disable: a checked box, 14 pt. */
export function EnableGlyph(props: GlyphProps) {
  return (
    <Glyph width={14} height={14} {...props}>
      <rect x=".5" y=".5" width="13" height="13" rx="2.5" />
      <path d="M3.6 7.4l2.4 2.6 4.4-6" strokeWidth="1.3" />
    </Glyph>
  );
}

/** The library and a language collection: a book with the letter F on its cover, 15 by 16 pt. */
export function LibraryGlyph(props: GlyphProps) {
  return (
    <Glyph width={15} height={16} {...props}>
      <rect x="3.5" y="3.5" width="11" height="12" rx="1.5" />
      <path d="M3.5 14.5l-3-2.4V2A1.5 1.5 0 0 1 2 .5h9.4l1.9 3M7.4 12.6V6.4h3.5M7.4 9.4h2.8" />
    </Glyph>
  );
}

const TEETH = [0, 45, 90, 135, 180, 225, 270, 315];

/** A smart collection: a gear, 16 pt. */
export function SmartGlyph(props: GlyphProps) {
  return (
    <Glyph width={16} height={16} {...props}>
      <circle cx="8" cy="8" r="4.25" strokeWidth="3" />
      {TEETH.map((angle) => (
        <path key={angle} d="M8 .2v2.6" strokeWidth="2.8" transform={`rotate(${angle} 8 8)`} />
      ))}
    </Glyph>
  );
}

/** A collection: two cards, the letter A on the front one, 17 by 15 pt. */
export function CollectionGlyph(props: GlyphProps) {
  return (
    <Glyph width={17} height={15} {...props}>
      <rect x="3" y="3" width="13.5" height="11.5" rx="1.5" />
      <path d="M3 12.2H2A1.5 1.5 0 0 1 .5 10.7V2A1.5 1.5 0 0 1 2 .5h10.7A1.5 1.5 0 0 1 14.2 2v1M7 12l2.75-6.8L12.5 12M8 9.8h3.5" />
    </Glyph>
  );
}
