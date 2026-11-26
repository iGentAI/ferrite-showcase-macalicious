import { PLACEHOLDER_TONES } from "../placeholder";

/*
 * Placeholders for the Appearance choice, on the 67 x 44 pt frame, in place of Apple's artwork:
 * a light grey box for Light, a dark grey one for Dark and one half of each for Auto.
 */

/** The picture of one Appearance choice. Decorative: the caption names the choice. */
export function AppearanceArtwork({ appearance }: { appearance: "light" | "dark" | "auto" }) {
  return (
    <svg width="67" height="44" viewBox="0 0 67 44" aria-hidden="true" focusable="false">
      <rect
        width="67"
        height="44"
        fill={PLACEHOLDER_TONES[appearance === "dark" ? "dark" : "light"].fill}
      />
      {appearance === "auto" ? (
        <rect x="33.5" width="33.5" height="44" fill={PLACEHOLDER_TONES.dark.fill} />
      ) : null}
    </svg>
  );
}

/**
 * The picture beside the default web browser's name: an original drawing of a compass on a
 * 16 pt disc, in place of the browser's icon. Decorative.
 */
export function BrowserArtwork() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7.5" fill="#3d8bdc" stroke="#d9dde2" />
      <path d="M11.8 4.2L7 7l2 2z" fill="#e5484d" />
      <path d="M4.2 11.8L7 7l2 2z" fill="#ffffff" />
    </svg>
  );
}
