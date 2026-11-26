import type { CSSProperties } from "react";

/*
 * The placeholder that stands where a capture shows a photograph, a video still or Apple's
 * artwork: the box of the picture, filled with one neutral grey and crossed by its two
 * diagonals. It imitates nothing of the picture it stands for; the visual comparisons mask its
 * box.
 */

export interface PlaceholderPictureProps {
  /** Width in points. */
  width: number;
  /** Height in points. */
  height: number;
  /**
   * The grey of the box: `light` and `dark` keep two placeholders apart where a pane shows a
   * light and a dark picture side by side.
   * @default "light"
   */
  tone?: "light" | "dark";
  /** Draws a disc in place of the box, for an account picture. */
  round?: boolean;
  /** Draws the placeholder subdued. */
  dimmed?: boolean;
  style?: CSSProperties;
}

export const PLACEHOLDER_TONES = {
  light: { fill: "#c7c7cc", line: "#aeaeb2" },
  dark: { fill: "#636366", line: "#8e8e93" },
} as const;

/** A placeholder picture. Decorative: the text beside it says what it stands for. */
export function PlaceholderPicture({
  width,
  height,
  tone = "light",
  round = false,
  dimmed = false,
  style,
}: PlaceholderPictureProps) {
  const { fill, line } = PLACEHOLDER_TONES[tone];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      opacity={dimmed ? 0.5 : undefined}
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {round ? (
        <ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={fill} />
      ) : (
        <>
          <rect width={width} height={height} fill={fill} />
          <path d={`M0 0L${width} ${height}M${width} 0L0 ${height}`} stroke={line} />
        </>
      )}
    </svg>
  );
}
