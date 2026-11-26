import type { ReactNode } from "react";
import type { ConsoleMessageType, ConsoleSourceIcon } from "./console-data";
import { TYPE_NAMES } from "./console-data";

/*
 * Stand-in drawings. Console's toolbar and sidebar glyphs are Apple's artwork; these are plain
 * original marks, drawn in the current colour, that only say which control or source is which.
 * Reload, Share and the sidebar button are standard images and come from the library's
 * `SystemImage`.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Glyph({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <svg
      className="mac-console-glyph"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/*
 * Now is a disc with a mark in it. The mark is cut out of the disc, so it shows in any colour
 * of the glyph, and drawn again over the hole: the stylesheet fills it with the colour the
 * toolbar button gives a mark, which is white while the button is on in Aqua and nothing
 * otherwise, as the captures have it. Info is the library's `info` system image, drawn the
 * same way.
 */
const NOW_MARK = "M3.4 3.4v4.4l1.5-1.5 3 3 1.4-1.4-3-3 1.5-1.5z";

/** Now: a disc with an arrow to the latest line, and the arrow's tail. */
export function NowGlyph() {
  return (
    <Glyph width={15} height={15}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d={`M6.5 0a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z${NOW_MARK}`}
      />
      <path className="mac-console-glyph-mark" d={NOW_MARK} />
      <path {...stroke} strokeWidth={1.5} d="M11.6 11.6l2.4 2.4" />
    </Glyph>
  );
}

/** Activities: two points joined by a winding path. */
export function ActivitiesGlyph() {
  return (
    <Glyph width={13} height={15}>
      <circle {...stroke} cx="3.4" cy="2.9" r="2.1" />
      <circle {...stroke} cx="10.4" cy="12.1" r="1.9" />
      <path {...stroke} d="M3.4 5v2.6c0 2.6 4.1 1 4.1 3.4 0 .8.4 1.1 1 1.1" />
    </Glyph>
  );
}

/** Clear: a page being wiped. */
export function ClearGlyph() {
  return (
    <Glyph width={14} height={15}>
      <path {...stroke} d="M6.2 2.6H1.6v10.8h10.8V8.8" />
      <path {...stroke} d="M12.6 5.2L9.4 2 4.3 7.1v3.2h3.2zM7.6 3.8l3.2 3.2" />
      <path {...stroke} d="M3.6 4.9h1.2M3.6 12h6.8" />
    </Glyph>
  );
}

const SOURCES: Record<ConsoleSourceIcon, ReactNode> = {
  laptop: (
    <>
      <rect {...stroke} x="3" y="3.6" width="12" height="8.2" rx="0.9" />
      <path fill="currentColor" d="M1 12.6h16v.6c0 .7-.6 1.2-1.3 1.2H2.3c-.7 0-1.3-.5-1.3-1.2z" />
    </>
  ),
  warning: (
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 1.6c.5 0 .9.2 1.1.7l6.4 11.7c.5.9-.1 2-1.1 2H2.6c-1 0-1.6-1.1-1.1-2L7.9 2.3c.2-.5.6-.7 1.1-.7zM8.2 6.2l.3 5h1l.3-5zM9 12.3a1 1 0 1 0 0 2a1 1 0 0 0 0-2z"
    />
  ),
  spin: (
    <>
      <circle {...stroke} cx="9" cy="9" r="7.2" />
      {[0, 60, 120, 180, 240, 300].map((turn) => (
        <path
          key={turn}
          {...stroke}
          transform={`rotate(${turn} 9 9)`}
          d="M9 9c.2-2.6 1.4-4.4 3.5-5.6"
        />
      ))}
    </>
  ),
  log: (
    <>
      <rect {...stroke} x="3.6" y="1.8" width="10.8" height="14.4" rx="1" />
      <path fill="currentColor" d="M4 2.2h2.6v13.6H4z" />
      <path {...stroke} d="M8.4 5.2h4M8.4 7.8h4M8.4 10.4h4M8.4 13h2.4" />
    </>
  ),
  tools: (
    <>
      <path {...stroke} strokeWidth={1.6} d="M2.6 15.4l7.2-7.2" />
      <path {...stroke} d="M12.4 2.2a3.3 3.3 0 1 0 3.4 3.4l-2.2 1-2.2-2.2z" />
      <path {...stroke} d="M2.4 2.6l1.4-.6 2.2 2.4-.9.9L2.8 4zM5.6 4.9l5.2 5.2" />
      <path {...stroke} strokeWidth={2.2} d="M11.4 10.8l3.7 3.9" />
    </>
  ),
  chart: (
    <>
      <path
        fill="currentColor"
        d="M2.2 8h2.2v6.4H2.2zM5.6 3.4h2.2v11H5.6zM9 6.2h2.2v8.2H9zM12.4 9.4h2.2v5h-2.2z"
      />
      <path {...stroke} d="M1.4 15.6h14.2" />
    </>
  ),
  file: (
    <>
      <path {...stroke} d="M4 1.8h6.2l3.8 3.8v10.6H4z" />
      <path {...stroke} d="M10 2v3.8h3.8" />
    </>
  ),
};

/** The 18 pt template glyph of a sidebar row. */
export function SourceIcon({ kind }: { kind: ConsoleSourceIcon }) {
  return (
    <Glyph width={18} height={18}>
      {SOURCES[kind]}
    </Glyph>
  );
}

/**
 * The Type column's mark: a dot in the level's colour, named by the level. A default message
 * has none, as in Console.
 */
export function TypeMark({ type }: { type: ConsoleMessageType }) {
  if (type === "default") return null;
  return (
    <span className="mac-console-type" data-type={type} role="img" aria-label={TYPE_NAMES[type]} />
  );
}
