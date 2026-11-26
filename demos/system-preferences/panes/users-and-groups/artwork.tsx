/*
 * Pictures for the Users & Groups pane: a placeholder in place of the account photograph, and
 * original drawings in place of Apple's artwork. Each is decorative: the text beside it names
 * the account.
 */

import type { CSSProperties } from "react";
import { PlaceholderPicture } from "../placeholder";

interface PictureProps {
  /** Diameter in points. */
  size: number;
  /** Draws the picture subdued, as in the row of an account that is locked. */
  dimmed?: boolean;
  /** Places the picture: the rows' pictures start 1 or 3 pt after the row's padding. */
  style?: CSSProperties;
}

/** The current account's picture: a placeholder disc where the capture has a photograph. */
export function LandscapePicture({ size, dimmed = false, style }: PictureProps) {
  return <PlaceholderPicture width={size} height={size} round dimmed={dimmed} style={style} />;
}

/** Another account's picture: a disc in two tones with a ring. */
export function SymbolPicture({ size, dimmed = false, style }: PictureProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      opacity={dimmed ? 0.5 : undefined}
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <circle cx="12" cy="12" r="12" fill="#d2d2d2" />
      <path d="M3.5 3.5A12 12 0 0 0 20.5 20.5Z" fill="#3c3c3c" />
      <circle cx="12" cy="12" r="4" fill="#d2d2d2" stroke="#3c3c3c" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * The Guest User's picture: a figure on a disc. Both are tints of the text colour, so the
 * picture follows the appearance.
 */
export function GuestPicture({ size, style }: PictureProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <circle cx="12" cy="12" r="12" fill="currentColor" opacity="0.25" />
      <g fill="#000000" opacity="0.14">
        <circle cx="12" cy="9" r="3.2" />
        <path d="M6 17.8c0-2.6 2.7-4.2 6-4.2s6 1.6 6 4.2v.7H6z" />
      </g>
    </svg>
  );
}

/** The picture of Login Options: a house with a door, in the text colour. */
export function HousePicture({ style }: { style?: CSSProperties }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      <path
        d="M1 10.5L11 1.5l10 9M3.5 9v11.5h15V9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M15.5 2.5h3v5l-3-2.7z" fill="currentColor" />
      <path d="M8.5 12.5h5v8h-5z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}
