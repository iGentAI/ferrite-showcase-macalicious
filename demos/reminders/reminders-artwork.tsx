import type { SmartListId } from "./reminders-data";

/*
 * Original stand-in drawings. Apple's glyphs are not reproduced: each is a simple shape drawn
 * for this demo in `currentColor`, on the grid of the disc it sits in.
 */

/** The glyph of a list's disc: three bulleted lines, on a 22 pt grid. */
export function ListGlyph() {
  return (
    <svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <circle cx="6.5" cy="7.25" r="1.1" />
        <circle cx="6.5" cy="11" r="1.1" />
        <circle cx="6.5" cy="14.75" r="1.1" />
        <rect x="9" y="6.5" width="7.5" height="1.5" rx="0.75" />
        <rect x="9" y="10.25" width="7.5" height="1.5" rx="0.75" />
        <rect x="9" y="14" width="7.5" height="1.5" rx="0.75" />
      </g>
    </svg>
  );
}

/** The glyph of a group of lists: a folder, on a 22 pt grid. */
export function GroupGlyph() {
  return (
    <svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h7A1.5 1.5 0 0 1 19 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 15.5Z"
      />
    </svg>
  );
}

/** The glyph of a smart list's disc, on a 24 pt grid. */
export function SmartListGlyph({ list }: { list: SmartListId }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
      {list === "today" ? (
        // A calendar page: a frame with a filled band and two rows of days.
        <g fill="currentColor">
          <path
            fillRule="evenodd"
            d="M7.5 6h9A1.5 1.5 0 0 1 18 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 16.5v-9A1.5 1.5 0 0 1 7.5 6Zm-.25 4v6.5c0 .14.11.25.25.25h9c.14 0 .25-.11.25-.25V10Z"
          />
          <rect x="8.5" y="11.5" width="1.75" height="1.5" />
          <rect x="11.1" y="11.5" width="1.75" height="1.5" />
          <rect x="13.7" y="11.5" width="1.75" height="1.5" />
          <rect x="8.5" y="14" width="1.75" height="1.5" />
          <rect x="11.1" y="14" width="1.75" height="1.5" />
        </g>
      ) : list === "scheduled" ? (
        // A clock face with its hands at three o'clock.
        <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="5.75" />
          <path d="M12 8.5V12h2.75" strokeLinejoin="round" />
        </g>
      ) : list === "all" ? (
        // A tray: an open box with a notch in its front.
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M8.4 7h7.2c.5 0 .95.3 1.15.76L18.5 12v3.5A1.5 1.5 0 0 1 17 17H7a1.5 1.5 0 0 1-1.5-1.5V12l1.75-4.24C7.45 7.3 7.9 7 8.4 7Zm.17 1.25L7.03 12H9.5a2.5 2.5 0 0 0 5 0h2.47l-1.54-3.75Z"
        />
      ) : (
        // A flag on its pole.
        <g fill="currentColor">
          <rect x="7.5" y="6" width="1.5" height="12" rx="0.75" />
          <path d="M9.75 6.75h7.1c.35 0 .53.42.29.67L15.4 9.6l1.74 2.18c.24.25.06.67-.29.67h-7.1Z" />
        </g>
      )}
    </svg>
  );
}

/** The flag of the info popover's flag button, 10 x 11 pt. */
export function FlagGlyph() {
  return (
    <svg viewBox="0 0 10 11" width="10" height="11" aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <rect x="0.5" y="0" width="1.25" height="11" />
        <path d="M2.5 0.75h7v5.5h-7Z" />
      </g>
    </svg>
  );
}

/** A stand-in for an attached picture: a framed landscape, 16 pt. Not Apple's thumbnail. */
export function PictureGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <rect
        x="1.5"
        y="3"
        width="13"
        height="10"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="5" cy="6.25" r="1.1" fill="currentColor" />
      <path fill="currentColor" d="M3 11.5l3-3 2 1.75 2.5-3 2.5 4.25Z" />
    </svg>
  );
}
