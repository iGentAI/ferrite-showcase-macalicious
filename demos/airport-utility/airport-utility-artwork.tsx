import type { ComponentProps } from "react";

/*
 * Stand-in pictures. AirPort Utility's globe and its base station pictures are Apple's artwork
 * and are not reproduced: these are abstract placeholders that take nothing from them, neither
 * tone nor composition. Their colours are the demo's provisional tokens.
 */

/**
 * The placeholder for the Internet's picture, in a 128 pt square: a flat hexagon with a mark
 * at its middle and three spokes.
 */
export function NetworkMark(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 128 128" width="128" height="128" aria-hidden="true" {...props}>
      <path
        d="M64 10 110.8 37v54L64 118 17.2 91V37Z"
        fill="var(--mac-airport-utility-placeholder-field)"
        stroke="var(--mac-airport-utility-placeholder-line)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M64 64V26M64 64 96.9 83M64 64 31.1 83"
        fill="none"
        stroke="var(--mac-airport-utility-placeholder-line)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="52"
        y="52"
        width="24"
        height="24"
        rx="4"
        fill="var(--mac-airport-utility-placeholder-mark)"
      />
    </svg>
  );
}

/** The placeholder for a base station's picture, in a 64 pt square: a flat slab with a mark. */
export function BaseStationMark(props: ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" {...props}>
      <rect
        x="7.5"
        y="19.5"
        width="49"
        height="25"
        rx="5"
        fill="var(--mac-airport-utility-placeholder-field)"
        stroke="var(--mac-airport-utility-placeholder-line)"
        strokeWidth="3"
      />
      <rect
        x="27"
        y="29"
        width="10"
        height="6"
        rx="2"
        fill="var(--mac-airport-utility-placeholder-mark)"
      />
    </svg>
  );
}
