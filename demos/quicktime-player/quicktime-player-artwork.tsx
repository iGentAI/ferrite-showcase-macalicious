import type { ComponentProps } from "react";
import movieFrame from "./art/movie-frame.webp";

/*
 * Every drawing here is original artwork. The movie in the reference captures is a third
 * party's, the document's proxy icon is Apple's, and so are the controller's glyphs: none of
 * them is reproduced, and the movie is not imitated either. The movie frame is an original
 * generated picture in art/.
 */

/** What the movie frame shows, for assistive technology. */
export const MOVIE_FRAME_DESCRIPTION =
  "A movie frame: a misty mountain river valley at golden hour.";

/**
 * The movie frame, 16:9: an original generated still of a river valley. It stands where a
 * movie would be; nothing of it comes from the reference captures.
 *
 * It fills the box it is given and is cropped to it; it is decorative, and the element around
 * it names the picture.
 */
export function MovieFrame(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 1470 827"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect width="1470" height="827" fill="#30353d" />
      <image href={movieFrame} width="1470" height="827" preserveAspectRatio="xMidYMid slice" />
    </svg>
  );
}

/**
 * The proxy icon of a movie document, in the title bar's 16 pt box: a sheet with a folded
 * corner and a play mark. The sheet is 11 by 14.5 pt and sits where the capture has its icon.
 */
export function MovieProxyIcon() {
  return (
    <svg
      className="mac-quicktime-player-proxy"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path className="mac-quicktime-player-proxy-paper" d="M2 1h7l3 3v10.5H2z" />
      <path className="mac-quicktime-player-proxy-fold" d="M9 1v3h3" />
      <circle className="mac-quicktime-player-proxy-mark" cx="7" cy="9.5" r="3.25" />
      <path className="mac-quicktime-player-proxy-paper-mark" d="M6 7.75v3.5L9 9.5z" />
    </svg>
  );
}

/* The controller's glyphs, at the sizes measured in the captures and drawn with currentColor. */

/** A loudspeaker with one wave: the quiet end of the volume slider. */
export function VolumeLowGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M0 3.5h2.5L6.5 0v12L2.5 8.5H0z" fill="currentColor" />
      <path d="M9 3.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" />
    </svg>
  );
}

/** A loudspeaker with three waves: the loud end of the volume slider. */
export function VolumeHighGlyph() {
  return (
    <svg width="20" height="15" viewBox="0 0 20 15" aria-hidden="true" focusable="false">
      <path d="M0 5h2.5l4-3.5v12L2.5 10H0z" fill="currentColor" />
      <path
        d="M9 5a3.5 3.5 0 0 1 0 5M12 2.5a7 7 0 0 1 0 10M15 0.5a10 10 0 0 1 0 14"
        fill="none"
        stroke="currentColor"
      />
    </svg>
  );
}

/** Two triangles pointing back. */
export function RewindGlyph() {
  return (
    <svg width="24" height="15" viewBox="0 0 24 15" aria-hidden="true" focusable="false">
      <path d="M12 0v15L0 7.5zM24 0v15L12 7.5z" fill="currentColor" />
    </svg>
  );
}

/** Two triangles pointing forward. */
export function FastForwardGlyph() {
  return (
    <svg width="24" height="15" viewBox="0 0 24 15" aria-hidden="true" focusable="false">
      <path d="M0 0v15l12-7.5zM12 0v15l12-7.5z" fill="currentColor" />
    </svg>
  );
}

/** The play triangle, or the two bars of pause. */
export function PlayGlyph({ paused }: { paused: boolean }) {
  return (
    <svg width="22" height="25" viewBox="0 0 22 25" aria-hidden="true" focusable="false">
      <path
        d={paused ? "M0 0l22 12.5L0 25z" : "M2 0h6.5v25H2zM13.5 0H20v25h-6.5z"}
        fill="currentColor"
      />
    </svg>
  );
}

/** A screen over a triangle. */
export function AirPlayGlyph() {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true" focusable="false">
      <path
        d="M3.5 10.25H1.75a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1h12.5a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8 9l4.5 5h-9z" fill="currentColor" />
    </svg>
  );
}

/** A screen with an arrow into a smaller, filled screen. */
export function PictureInPictureGlyph() {
  return (
    <svg width="20.5" height="16.5" viewBox="0 0 20.5 16.5" aria-hidden="true" focusable="false">
      <path
        d="M7.5 12.25H1.75a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1h14.5a1 1 0 0 1 1 1V7M4 4l4 4M8 5v3H5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect x="8.5" y="8.5" width="12" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/** A service's mark in the Share menu: an outline drawn for this demo. */
export function ServiceGlyph({ kind }: { kind: "mail" | "messages" | "airdrop" | "notes" }) {
  const marks = {
    mail: "M3 5l5 4 5-4M3 4.5h10v7H3z",
    messages: "M3 4h10v6H8l-3 2.5V10H3z",
    airdrop: "M4.5 10.5a5 5 0 1 1 7 0M6.3 8.8a2.4 2.4 0 1 1 3.4 0M8 9.5v3",
    notes: "M4 3.5h8v9H4zM6 6h4M6 8h4M6 10h2.5",
  };
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={marks[kind]} fill="none" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
