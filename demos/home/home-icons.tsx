import type { ReactNode } from "react";
import type { HomeAccessoryKind, HomeScene } from "./home-data";

/*
 * The glyphs of the demo: original drawings that stand in for Home's artwork, which is Apple's.
 * Each is drawn with `currentColor`, so a tile gives it its tint while the accessory is on and
 * the tone of its text while it is off. A glyph with a second part (the base of a bulb, the
 * figure beside a house) draws that part in a grey of its own on a tile that is on, as Home
 * does, and in the same tone as the rest otherwise.
 */

interface GlyphProps {
  /** Whether the tile the glyph is on is active: its second part is then grey. */
  active?: boolean;
}

/** The second colour of a two-part glyph on a tile that is on. */
const detail = (active: boolean | undefined) =>
  active ? "var(--mac-home-glyph-detail)" : "currentColor";

function Bulb({ active }: GlyphProps) {
  return (
    <svg viewBox="0 0 17 24.5" width="17" height="24.5" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8.5 0a8.5 8.5 0 0 0-5 15.4c.9.7 1.5 1.7 1.5 2.8h7c0-1.1.6-2.1 1.5-2.8A8.5 8.5 0 0 0 8.5 0z"
      />
      <path fill={detail(active)} d="M5.2 19.7h6.6v1.5H5.2zM5.7 22.2h5.6L10 24.5H7z" />
    </svg>
  );
}

function DeskLamp({ active }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24.5" width="24" height="24.5" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M9.5 1h9l4 9.5h-17z" />
      <path
        fill={detail(active)}
        d="M13 12h2v8.5h-2zM7.5 21.5h13A1.5 1.5 0 0 1 22 23v1.5H6V23a1.5 1.5 0 0 1 1.5-1.5z"
      />
    </svg>
  );
}

function Outlet() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4.5 0h15A4.5 4.5 0 0 1 24 4.5v15a4.5 4.5 0 0 1-4.5 4.5h-15A4.5 4.5 0 0 1 0 19.5v-15A4.5 4.5 0 0 1 4.5 0zM8 6.5V13h2V6.5zm6 0V13h2V6.5zm-2 9.5a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z"
      />
    </svg>
  );
}

function SetTopBox() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4.5 3.5h15A4.5 4.5 0 0 1 24 8v8a4.5 4.5 0 0 1-4.5 4.5h-15A4.5 4.5 0 0 1 0 16V8a4.5 4.5 0 0 1 4.5-4.5zm14 10.9a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"
      />
    </svg>
  );
}

function Speaker() {
  return (
    <svg viewBox="0 0 20 24.5" width="20" height="24.5" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M10 0c5.2 0 9 2 9.6 5.4.5 3.6.5 10.1 0 13.7C19 22.5 15.2 24.5 10 24.5S1 22.5.4 19.1c-.5-3.6-.5-10.1 0-13.7C1 2 4.8 0 10 0zm0 2.4c-3.2 0-5.8.9-5.8 2.1S6.8 6.6 10 6.6s5.8-.9 5.8-2.1S13.2 2.4 10 2.4z"
      />
    </svg>
  );
}

function GarageDoor() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 1 0 8.5V24h3.5V11.5h17V24H24V8.5zM5.5 13.5h13v2h-13zm0 4h13v2h-13zm0 4h13V24h-13z"
      />
    </svg>
  );
}

function Sensor() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4.5 1h15A4.5 4.5 0 0 1 24 5.5v13a4.5 4.5 0 0 1-4.5 4.5h-15A4.5 4.5 0 0 1 0 18.5v-13A4.5 4.5 0 0 1 4.5 1zm10 4.4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm4 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm-4 4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm4 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z"
      />
    </svg>
  );
}

function House() {
  return (
    <svg viewBox="0 0 20 18.5" width="20" height="18.5" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M10 0 0 8.6h2.6v9.9H8v-6h4v6h5.4V8.6H20z" />
    </svg>
  );
}

function HousePerson({ active }: GlyphProps) {
  return (
    <svg viewBox="0 0 24.5 25" width="24.5" height="25" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M8 2 0 9h2.2v9.5h11.6V9H16z" />
      <path
        fill={detail(active)}
        d="M19.5 9.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM14.5 25v-1.2c0-3.6 2.2-5.8 5-5.8s5 2.2 5 5.8V25z"
      />
    </svg>
  );
}

/** Slats under a headrail: original artwork. */
function Blinds({ active }: GlyphProps) {
  const slats = active ? [9, 13] : [9, 13, 17, 21];
  return (
    <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" fill="currentColor">
      <rect x="5" y="5" width="18" height="2" rx="1" />
      {slats.map((y) => (
        <rect key={y} x="6" y={y} width="16" height="2" rx="0.5" />
      ))}
    </svg>
  );
}

const ACCESSORY: Record<HomeAccessoryKind, (props: GlyphProps) => ReactNode> = {
  light: Bulb,
  lamp: DeskLamp,
  outlet: Outlet,
  tv: SetTopBox,
  speaker: Speaker,
  "garage-door": GarageDoor,
  blinds: Blinds,
  sensor: Sensor,
};

/** The glyph of an accessory tile, by what the accessory is. */
export function AccessoryGlyph({ kind, active }: GlyphProps & { kind: HomeAccessoryKind }) {
  const Glyph = ACCESSORY[kind];
  return <Glyph active={active} />;
}

/** The glyph of a scene tile. */
export function SceneGlyph({ icon, active }: GlyphProps & { icon: HomeScene["icon"] }) {
  return icon === "house" ? <House /> : <HousePerson active={active} />;
}

/** The mark in a speaker's badge: a microphone that is struck out. */
export function MicrophoneOffGlyph() {
  return (
    <svg viewBox="0 0 9 9" width="9" height="9" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M4.5 1a1.3 1.3 0 0 0-1.3 1.3v2a1.3 1.3 0 0 0 2.6 0v-2A1.3 1.3 0 0 0 4.5 1z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        d="M2 4.3a2.5 2.5 0 0 0 5 0M4.5 6.9V8M1.5 1.5l6 6"
      />
    </svg>
  );
}

/** The house of the toolbar's pull-down button, 15 pt wide. */
export function HomeGlyph() {
  return (
    <svg viewBox="0 0 15 13" width="15" height="13" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M7.5 0 0 6.2h2V13h4V8.5h3V13h4V6.2h2z" />
    </svg>
  );
}

/** The plus of the toolbar's add button. */
export function PlusGlyph() {
  return (
    <svg viewBox="0 0 13 13" width="13" height="13" aria-hidden="true" focusable="false">
      <path fill="none" stroke="currentColor" strokeWidth="1.2" d="M6.5 0v13M0 6.5h13" />
    </svg>
  );
}

/** The chevron after "and 1 More". */
export function ChevronGlyph() {
  return (
    <svg viewBox="0 0 5.5 9" width="5.5" height="9" aria-hidden="true" focusable="false">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M1 1l3.5 3.5L1 8"
      />
    </svg>
  );
}
