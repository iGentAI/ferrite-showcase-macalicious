import type { CSSProperties } from "react";

/*
 * Stand-in artwork, drawn for this demo. Mail's toolbar and sidebar glyphs and its preference
 * pane icons are Apple's and are not reproduced: these are original line drawings that say the
 * same thing, in the tint of whatever holds them (`currentColor`).
 */
const GLYPHS = {
  // Toolbar of the viewer
  envelope: "M1.5 4h15v10h-15zM1.5 4.5l7.5 5.5l7.5-5.5",
  compose: "M9 3.5H2.5v12h12V9M15.5 2.5l-7 7l-.5 2l2-.5l7-7z",
  archive: "M2 3h14v3.5H2zM3 6.5v8h12v-8M7 9.5h4",
  trash: "M3 4.5h12M7 4.5v-2h4v2M4.5 4.5l.75 11h7.5l.75-11M7.5 7.5v5M10.5 7.5v5",
  junk: "M2 3h14v3.5H2zM3 6.5v8h12v-8M7 8.5l4 4M11 8.5l-4 4",
  reply: "M7.5 4L2 9l5.5 5v-3c4 0 6.5 1 8.5 3.5c-.5-5-3.5-8-8.5-8z",
  replyAll: "M10.5 4.5L5.5 9l5 4.5v-2.75c3 0 5 .75 6.5 2.75c-.5-4-2.5-6.5-6.5-6.5zM6 4.5L1 9l5 4.5",
  forward: "M10.5 4L16 9l-5.5 5v-3c-4 0-6.5 1-8.5 3.5c.5-5 3.5-8 8.5-8z",
  flag: "M4 16V2.5M4 3h10l-2.5 3.5L14 10H4",
  mute: "M9 2.5c-3 0-4.5 2-4.5 5v3L3 13h12l-1.5-2.5v-3c0-3-1.5-5-4.5-5zM7.5 15h3M2.5 2.5l13 13",
  move: "M2 9.5V15h14V9.5M2 9.5l2.5-6h3M16 9.5l-2.5-6h-3M2 9.5h4l1 2h4l1-2h4M9 1.5v6M6.75 5.5L9 7.75l2.25-2.25",
  sidebar: "M1.5 3.5h15v11h-15zM6.5 3.5v11",
  filter: "M9 15.5a6.5 6.5 0 1 0 0-13a6.5 6.5 0 0 0 0 13zM5.5 7h7M6.75 9.25h4.5M8 11.5h2",
  // Sidebar
  inbox: "M1.5 9l3-5h9l3 5v5h-15zM1.5 9h4.5l1 2h4l1-2h4.5",
  drafts: "M4 2h7l3 3v11H4zM11 2v3h3",
  sent: "M2 9l14-6l-5 13l-3-5z",
  folder: "M1.5 4h5.5l1.5 2h8v8.5h-15z",
  smart:
    "M1.5 4h5.5l1.5 2h8v8.5h-15zM9 8.5l.75 1.5l1.75.25l-1.25 1.25l.25 1.75L9 12.5l-1.5.75l.25-1.75L6.5 10.25L8.25 10z",
  // Toolbar of the New Message window
  send: "M2 9l14-6l-5 13l-3-5zM8 11l8-8",
  fields: "M2 4.5h1M5.5 4.5h10M2 9h1M5.5 9h10M2 13.5h1M5.5 13.5h10",
  attach:
    "M12.5 5.5l-6 6a1.75 1.75 0 0 0 2.5 2.5l6.5-6.5a3.25 3.25 0 0 0-4.6-4.6L4 9.8a4.75 4.75 0 0 0 6.7 6.7l4.3-4.3",
  markup: "M9 3.5H2.5v11h13V10M16 3l-5.5 5.5l-.5 2l2-.5L17.5 4.5z",
  format: "M4.5 14.5L9 3l4.5 11.5M6.25 10.5h5.5",
  emoji:
    "M9 16A7 7 0 1 0 9 2a7 7 0 0 0 0 14zM5.75 10.5c.75 1.5 1.9 2.25 3.25 2.25s2.5-.75 3.25-2.25M6.75 7v1M11.25 7v1",
  photo: "M2 4h14v10H2zM2 12l4-4l3 3l2.5-2L16 12.5M12 6.5h.5",
  // Sidebar's Flagged row borrows `flag`; a VIP's row and mark
  vip: "M9 2.5l2 4.5l4.75.5l-3.5 3.25l1 4.75L9 13l-4.25 2.5l1-4.75l-3.5-3.25L7 7z",
} as const;

/** The name of a stand-in glyph. */
export type MailGlyphName = keyof typeof GLYPHS;

/** One stand-in glyph on an 18 pt grid, drawn in `currentColor`. Decorative. */
export function MailGlyph({
  name,
  size = 18,
  style,
}: {
  name: MailGlyphName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 18 18"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path d={GLYPHS[name]} />
    </svg>
  );
}

/** How a paragraph is set: the lines of each alignment glyph, as [from, to] on a 12 pt row. */
const ALIGNMENT_LINES: Record<"left" | "center" | "right" | "justify", [number, number][]> = {
  left: [
    [0, 12],
    [0, 8],
    [0, 12],
    [0, 7],
    [0, 10],
  ],
  center: [
    [0, 12],
    [2, 10],
    [0, 12],
    [2.5, 9.5],
    [1, 11],
  ],
  right: [
    [0, 12],
    [4, 12],
    [0, 12],
    [5, 12],
    [2, 12],
  ],
  justify: [
    [0, 12],
    [0, 12],
    [0, 12],
    [0, 12],
    [0, 7],
  ],
};

/** The glyph of an alignment segment of the format bar: five lines set that way. Decorative. */
export function MailAlignmentGlyph({ align }: { align: keyof typeof ALIGNMENT_LINES }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 12 10" width="12" height="10">
      <path
        d={ALIGNMENT_LINES[align]
          .map(([from, to], row) => `M${from} ${row * 2 + 1}H${to}`)
          .join("")}
        fill="none"
        stroke="currentColor"
      />
    </svg>
  );
}

/** The 16 pt stand-in before a choice's title: a stamp for the Mail app, a folder. */
export function MailChoiceIcon({ name }: { name: "app" | "folder" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {name === "app" ? (
        <>
          <rect x="1" y="2" width="14" height="12" rx="2" fill="#3b99fc" />
          <path d="M3 5l5 4l5-4" fill="none" stroke="#ffffff" strokeWidth="1.25" />
        </>
      ) : (
        <path d="M1 3.5h5l1.5 1.5H15v8.5H1z" fill="#59b0f0" />
      )}
    </svg>
  );
}

const PANE_ICONS: Record<string, [fill: string, glyph: string]> = {
  general: ["#8e8e93", "M11 9h10v14H11zM14 13h4M14 16h4"],
  accounts: ["#1a82f7", "M16 21a5 5 0 1 1 5-5v1.5a2 2 0 0 0 4 0V16a9 9 0 1 0-4 7.5"],
  junk: ["#a2845e", "M9 11h14M11 11l1 12h8l1-12M13.5 15l5 5M18.5 15l-5 5"],
  fonts: ["#af52de", "M11 23l5-14l5 14M12.75 18.5h6.5"],
  viewing: [
    "#5ac8fa",
    "M8 17a4 4 0 1 0 8 0a4 4 0 1 0-8 0M16 17a4 4 0 1 0 8 0a4 4 0 1 0-8 0M8 15l2-5M24 15l-2-5",
  ],
  composing: ["#ff9f0a", "M10 9h9v5M10 9v14h12v-5M23 9l-8 8l-.5 2.5l2.5-.5l8-8z"],
  signatures: ["#636366", "M7 20c3-9 5-9 5-4s2 5 4 0s3-3 3 0s3 2 6-2M8 24h16"],
  rules: ["#34c759", "M8 11h16v10H8zM8 11.5l8 5.5l8-5.5M13 6l3-3l3 3M16 3v6"],
};

/** The 32 pt stand-in icon of a Preferences toolbar item: a coloured tile with a line drawing. */
export function MailPaneIcon({ pane }: { pane: string }) {
  const [fill, glyph] = PANE_ICONS[pane] ?? PANE_ICONS.general ?? ["#8e8e93", ""];
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="26" height="26" rx="6" fill={fill} />
      <path
        d={glyph}
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
