import type { ReactNode } from "react";

/*
 * The toolbar glyphs the library's System Image has no counterpart for, drawn for this demo:
 * original line drawings in the role of Apple's template images, which are not included. The
 * list view, show folders, share and pull-down chevron glyphs are the library's system images.
 * Each is decorative; the button that holds it carries the name. They take the button's text
 * colour.
 */

function Glyph({
  width = 20,
  height = 16,
  children,
}: {
  width?: number;
  height?: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** The chevron of the toolbar's Back to Gallery. */
export function BackGlyph() {
  return (
    <Glyph width={9} height={14}>
      <path d="M7 1.5 1.5 7 7 12.5" />
    </Glyph>
  );
}

/** A pin: a pinned note's mark in the list. */
export function PinGlyph() {
  return (
    <Glyph width={9} height={11}>
      <path d="M2 1h5M3 1v4L1 7h7L6 5V1M4.5 7v4" />
    </Glyph>
  );
}

/** Four small squares: the gallery view. */
export function GalleryGlyph() {
  return (
    <Glyph width={11} height={11}>
      <path d="M1 1h3v3H1zM7 1h3v3H7zM1 7h3v3H1zM7 7h3v3H7z" />
    </Glyph>
  );
}

/** A sheet with a paper clip: the attachments browser. */
export function AttachmentsGlyph() {
  return (
    <Glyph width={18} height={13}>
      <path d="M9 1H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1" />
      <path d="M7.5 7h7a2 2 0 0 0 0-4h-6a1 1 0 0 0 0 2h5.5" strokeWidth="1" />
    </Glyph>
  );
}

/** A bin: delete. */
export function TrashGlyph() {
  return (
    <Glyph width={14} height={16}>
      <path d="M1 3.5h12M5 3.5V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M2.5 3.5l.7 10.4a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10.4" />
      <path d="M5.2 6v6.2M7 6v6.2M8.8 6v6.2" strokeWidth="1" />
    </Glyph>
  );
}

/** A sheet and a pencil: new note. */
export function ComposeGlyph() {
  return (
    <Glyph width={16} height={15}>
      <path d="M9 3H2.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V7.5" />
      <path d="M13.6 0.8l1.6 1.6-6.4 6.4-2.2.6.6-2.2z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** A padlock: lock the note. */
export function LockGlyph() {
  return (
    <Glyph width={11} height={15}>
      <rect x="1" y="6.5" width="9" height="7.5" rx="1" />
      <path d="M2.8 6.5V4.2a2.7 2.7 0 0 1 5.4 0v2.3" />
    </Glyph>
  );
}

/** The mark of a locked note that is open now: the shackle lifted. */
export function OpenLockGlyph() {
  return (
    <Glyph width={14} height={15}>
      <rect x="1" y="6.5" width="9" height="7.5" rx="1" />
      <path d="M7.5 6.5V4.2a2.7 2.7 0 0 1 5.4 0v1.3" />
    </Glyph>
  );
}

/** A grid of cells: add a table. */
export function TableGlyph() {
  return (
    <Glyph width={17} height={13}>
      <rect x="1" y="1" width="15" height="11" rx="0.5" />
      <path d="M1 4.7h15M1 8.3h15M6 1v11M11 1v11" strokeWidth="1" />
    </Glyph>
  );
}

/** A tick in a circle: make a checklist. */
export function ChecklistGlyph() {
  return (
    <Glyph width={15} height={15}>
      <circle cx="7.5" cy="7.5" r="6.5" strokeWidth="1" />
      <path d="M4.5 7.8l2.2 2.2 3.9-4.6" />
    </Glyph>
  );
}

/** Two stacked pictures: add a photo or video. */
export function MediaGlyph() {
  return (
    <Glyph width={17} height={14}>
      <path d="M3 3V1.5h13v9h-1.5" strokeWidth="1" />
      <rect x="1" y="3.5" width="13" height="9.5" rx="0.5" />
      <path d="M2.5 11.5l3.2-3.6 2.4 2.4 1.6-1.4 2.8 2.6z" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="6.3" r="1" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** A person and a plus: add people to the note. */
export function PeopleGlyph() {
  return (
    <Glyph width={18} height={15}>
      <circle cx="10.5" cy="7.5" r="6.5" strokeWidth="1" />
      <circle cx="10.5" cy="5.6" r="2.3" fill="currentColor" stroke="none" />
      <path
        d="M6.3 12.2a4.4 4.4 0 0 1 8.4 0 6.4 6.4 0 0 1-8.4 0z"
        fill="currentColor"
        stroke="none"
      />
      <circle cx="4" cy="11" r="3.6" fill="currentColor" stroke="none" />
      <path d="M4 9.2v3.6M2.2 11h3.6" stroke="var(--mac-notes-glyph-knockout)" strokeWidth="1" />
    </Glyph>
  );
}
