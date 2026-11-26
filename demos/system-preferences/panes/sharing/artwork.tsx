/*
 * Stand-in pictures for the Sharing pane: original drawings in place of Apple's artwork, each
 * on the 16 x 16 pt box of a table cell, and the dimple between the two lists. All are
 * decorative: the text beside a picture names what it stands for.
 */

import type { ReactNode } from "react";

function Picture({ children }: { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none" }}
    >
      {children}
    </svg>
  );
}

/** A home folder: a small house. */
export function HomeFolderPicture() {
  return (
    <Picture>
      <path d="M3 8h10v6.5H3z" fill="#f1e3c8" />
      <path d="M8 1.5l7 6.2-1 1.1-6-5.3-6 5.3-1-1.1z" fill="#b0683b" />
      <path d="M6.5 10h3v4.5h-3z" fill="#8a5a3a" />
    </Picture>
  );
}

/** A Public folder: a blue folder. */
export function PublicFolderPicture() {
  return (
    <Picture>
      <path d="M1 3.5a1 1 0 0 1 1-1h4l1.5 1.5H14a1 1 0 0 1 1 1V6H1z" fill="#4d9fdc" />
      <path d="M1 5.5h14v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z" fill="#6fbcee" />
    </Picture>
  );
}

const HEAD = "M0-3.4a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2z";
const SHOULDERS = "M-5.2 7.6c0-3 2.2-4.6 5.2-4.6s5.2 1.6 5.2 4.6z";

function Person({
  x,
  y,
  scale,
  opacity,
}: {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="currentColor" opacity={opacity}>
      <path d={HEAD} />
      <path d={SHOULDERS} />
    </g>
  );
}

/** One account: a head and shoulders in the text colour. */
export function UserPicture() {
  return (
    <Picture>
      <Person x={8} y={6.5} scale={1.25} opacity={1} />
    </Picture>
  );
}

/** A group of accounts: two figures, the one behind fainter. */
export function GroupPicture() {
  return (
    <Picture>
      <Person x={5.2} y={8.2} scale={0.85} opacity={0.45} />
      <Person x={10} y={8.4} scale={0.95} opacity={0.7} />
    </Picture>
  );
}

/** Everyone: three figures. */
export function EveryonePicture() {
  return (
    <Picture>
      <Person x={3.4} y={8.6} scale={0.7} opacity={0.45} />
      <Person x={12.6} y={8.6} scale={0.7} opacity={0.45} />
      <Person x={8} y={8.2} scale={0.95} opacity={0.7} />
    </Picture>
  );
}

/** The dimple of the splitter between the two lists: a 6 pt disc, a tint of the text colour. */
export function Dimple() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6" aria-hidden="true" focusable="false">
      <circle cx="3" cy="3" r="3" fill="currentColor" opacity="0.15" />
    </svg>
  );
}
