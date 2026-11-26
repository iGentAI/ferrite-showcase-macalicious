import type { ReactNode } from "react";
import type { AutomatorTint } from "./automator-data";

/*
 * Stand-ins. Automator's library, action and description icons are Apple's colour artwork, and
 * no drawing here imitates one: an icon is a plain rounded square in a system colour, which
 * says only which category a row belongs to. The toolbar and bottom bar glyphs that the
 * library's `SystemImage` does not have are simple original marks in the current colour.
 */

/**
 * The placeholder for a colour icon: a rounded square of `size` points, tinted by category.
 * It is decoration and hidden from assistive technology; the row's text names the row.
 */
export function PlaceholderIcon({ tint, size = 16 }: { tint: AutomatorTint; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="mac-automator-icon"
      data-tint={tint}
      style={{ width: size, height: size }}
    />
  );
}

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
      className="mac-automator-glyph"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable={false}
    >
      {children}
    </svg>
  );
}

const line = { fill: "none", stroke: "currentColor" } as const;

/** Media: two frames, one behind the other. */
export function MediaGlyph() {
  return (
    <Glyph width={17} height={13}>
      <path {...line} d="M3.5 3V.5h13v9H14" />
      <rect {...line} x=".5" y="3.5" width="13" height="9" rx=".5" />
    </Glyph>
  );
}

/** Record: a disc. */
export function RecordGlyph() {
  return (
    <Glyph width={13} height={13}>
      <circle fill="currentColor" cx="6.5" cy="6.5" r="6.5" />
    </Glyph>
  );
}

/** Step: an arrow up to a bar. */
export function StepGlyph() {
  return (
    <Glyph width={14} height={12}>
      <path fill="currentColor" d="M0 4h6V0l6 6-6 6V8H0zM13 0h1v12h-1z" />
    </Glyph>
  );
}

/** Stop: a square. */
export function StopGlyph() {
  return (
    <Glyph width={13} height={13}>
      <path fill="currentColor" d="M0 0h13v13H0z" />
    </Glyph>
  );
}

/** Run: a triangle that points forward. */
export function RunGlyph() {
  return (
    <Glyph width={12} height={13}>
      <path fill="currentColor" d="M0 0l12 6.5L0 13z" />
    </Glyph>
  );
}

/** The description pane's toggle: a box with a chevron that points down while it is shown. */
export function DisclosureGlyph({ open }: { open: boolean }) {
  return (
    <Glyph width={13} height={12}>
      <rect {...line} x=".5" y=".5" width="12" height="11" rx=".5" />
      <path {...line} strokeWidth="1.2" d={open ? "M3.5 4.5l3 3 3-3" : "M3.5 7.5l3-3 3 3"} />
    </Glyph>
  );
}

/** The variables' toggle: two capsules, one above the other. */
export function VariablesGlyph() {
  return (
    <Glyph width={13} height={13}>
      <rect {...line} x=".5" y=".5" width="12" height="5" rx="1.5" />
      <rect {...line} x=".5" y="7.5" width="12" height="5" rx="1.5" />
    </Glyph>
  );
}

/** The runs' toggle, on the desktop's server: a clock face. */
export function RunsGlyph() {
  return (
    <Glyph width={13} height={13}>
      <circle {...line} cx="6.5" cy="6.5" r="6" />
      <path {...line} d="M6.5 2.5v4h3" />
    </Glyph>
  );
}
