import { PlaceholderPicture } from "../placeholder";

/*
 * The pictures of the Mouse pane: a placeholder and a glyph, no photograph and no Apple
 * artwork.
 */

/**
 * The picture in the place of the gesture video: a placeholder on the 236 x 301 pt frame of the
 * capture's still, under the frame's shadow. Decorative.
 */
export function GestureArtwork() {
  return (
    <PlaceholderPicture
      width={236}
      height={301}
      style={{ filter: "drop-shadow(0 4px 5px rgb(0 0 0 / 0.35))" }}
    />
  );
}

/** The battery that is charging, 23 x 12 pt, in the colour of the text around it. Decorative. */
export function BatteryArtwork() {
  return (
    <svg width="23" height="12" viewBox="0 0 23 12" aria-hidden="true" focusable="false">
      <rect
        x="0.75"
        y="0.75"
        width="19"
        height="10.5"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M21.5 4h.5a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-.5z" fill="currentColor" />
      <path d="M3 3h4.5L6 6.2h4L4.5 9h-1.5zM17.5 9H13l1.5-3.2h-4L16 3h1.5z" fill="currentColor" />
    </svg>
  );
}
