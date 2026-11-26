/**
 * TextEdit's drawings. None of them is Apple's artwork: the proxy icon, the file icons, the
 * glyphs of the format bar and of the panels' sidebar are original stand-ins, drawn here with
 * `currentColor` so that they follow the control they are in.
 */
import { TagDot } from "macalicious/tag-dot";
import type { ReactNode } from "react";
import type { TextEditFile, TextEditPlace } from "./textedit-data";
import type { TextEditAlignment } from "./textedit-document";

/** The document proxy icon of the title bar, and the icon of a document in a file list. */
export function DocumentIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width={size} height={size}>
      <path
        d="M3.5 1.5h6l3 3v10h-9z"
        fill="var(--mac-textedit-page)"
        stroke="currentColor"
        strokeOpacity="0.55"
      />
      <path
        d="M9.5 1.5v3h3M5.5 7h5M5.5 9h5M5.5 11h3"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.55"
      />
    </svg>
  );
}

/** A folder, in a file list. */
export function FolderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width={size} height={size}>
      <path d="M1 3h5l1.5 1.5H15V13H1z" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

/** The icon of a file by its kind, at 16 pt for a list or larger for the icon view. */
export function FileIcon({ file, size = 16 }: { file: TextEditFile; size?: number }) {
  return file.kind === "folder" ? <FolderIcon size={size} /> : <DocumentIcon size={size} />;
}

// The lines of the four alignment glyphs: where each of the five lines starts and ends, on a
// drawing 12 pt wide.
const ALIGNMENTS: Record<TextEditAlignment, [number, number][]> = {
  left: [
    [0, 12],
    [0, 8],
    [0, 12],
    [0, 8],
    [0, 12],
  ],
  center: [
    [0, 12],
    [2, 10],
    [0, 12],
    [2, 10],
    [0, 12],
  ],
  right: [
    [0, 12],
    [4, 12],
    [0, 12],
    [4, 12],
    [0, 12],
  ],
  justify: [
    [0, 12],
    [0, 12],
    [0, 12],
    [0, 12],
    [0, 12],
  ],
};

/** The glyph of an alignment segment: five lines set the way the paragraph would be. */
export function AlignmentGlyph({ align }: { align: TextEditAlignment }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 12 10" width="12" height="10">
      <path
        d={ALIGNMENTS[align].map(([from, to], row) => `M${from} ${row * 2 + 1}H${to}`).join("")}
        fill="none"
        stroke="currentColor"
      />
    </svg>
  );
}

/** The glyph of the list button: three bullets, each with its line. */
export function ListGlyph() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 13 10" width="13" height="10">
      <path d="M4 1.5h9M4 5h9M4 8.5h9" fill="none" stroke="currentColor" />
      <path d="M0 .5h2v2H0zM0 4h2v2H0zM0 7.5h2v2H0z" fill="currentColor" />
    </svg>
  );
}

/**
 * The glyph of the highlight button: a slanted "a" on the chosen colour, or struck through
 * with a red line while no highlight is set.
 */
export function HighlightGlyph({ color }: { color?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 18 12" width="18" height="12">
      {color ? <rect width="18" height="12" rx="1.5" fill={color} /> : null}
      <text
        x="9"
        y="10"
        textAnchor="middle"
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize="12"
        fontStyle="italic"
        fill={color ? "var(--mac-textedit-highlight-ink)" : "currentColor"}
      >
        a
      </text>
      {color ? null : <path d="M1 11L17 1" stroke="var(--mac-color-system-red)" />}
    </svg>
  );
}

/** A colour chip for a row of the highlight menu. */
export function ColorChip({ color }: { color?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16">
      <rect
        x="2.5"
        y="4.5"
        width="11"
        height="7"
        rx="1"
        fill={color ?? "none"}
        stroke="currentColor"
        strokeOpacity="0.4"
      />
      {color ? null : <path d="M3 11L13 5" stroke="var(--mac-color-system-red)" />}
    </svg>
  );
}

// Outlines of the sidebar's glyphs, on an 18 pt square.
const PLACE_GLYPHS: Record<string, string> = {
  recents: "M2 10l2-7h10l2 7v5H2zM2 10h4l1 2h4l1-2h4",
  applications: "M4 15L9 3l5 12M2 11h14",
  desktop: "M2 3h14v10H2zM6 16h6",
  documents: "M4 2h7l3 3v11H4zM11 2v3h3",
  downloads: "M9 1.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15zM9 5v7M6 9.5l3 3l3-3",
  cloud: "M5 14a3.5 3.5 0 0 1 0-7a4.5 4.5 0 0 1 8.5 1a3 3 0 0 1-.5 6z",
  drive: "M4 2h10l1 9v4H3v-4zM3 11h12",
  computer: "M2 3h14v10H2zM6 16h6",
  network:
    "M9 1.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 0 1 0-15zM1.5 9h15M9 1.5c-5 5-5 10 0 15c5-5 5-10 0-15",
};

/** The glyph of a sidebar row: an outline for a place, the library's dot for a tag. */
export function PlaceGlyph({ glyph }: { glyph: TextEditPlace["glyph"] }): ReactNode {
  const d = PLACE_GLYPHS[glyph];
  if (!d) return <TagDot color={glyph as "blue" | "orange" | "gray" | "green" | "none"} />;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 18 18"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d={d} />
    </svg>
  );
}
