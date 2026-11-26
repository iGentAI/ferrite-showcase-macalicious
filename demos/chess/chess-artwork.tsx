import type { ReactNode } from "react";
import type { ChessPieceKind, ChessSide } from "./chess-game";

/*
 * Every drawing here is original artwork. Chess in macOS draws a wooden board and turned
 * wooden pieces in three dimensions; none of that is reproduced and none of it is imitated:
 * these are flat silhouettes on a 40 unit square, coloured by the demo's tokens.
 */

/** The foot every piece stands on. */
const FOOT = <rect x="9" y="32" width="22" height="4.5" rx="1.5" />;

/** The widening stem of a king and a queen, between the crown and the foot. */
const STEM = <path d="M12.5 27h15l1 5.5h-17z" />;

/** The outline of each kind of piece: a few shapes that overlap into one silhouette. */
const SHAPES: Readonly<Record<ChessPieceKind, ReactNode>> = {
  // A ball on a collar, on a body that widens to the foot.
  pawn: (
    <>
      <circle cx="20" cy="11.5" r="5" />
      <rect x="14.5" y="16" width="11" height="3" rx="1.5" />
      <path d="M17.5 18.5C17.5 24 13.5 26.5 12.5 32.5h15C26.5 26.5 22.5 24 22.5 18.5z" />
      {FOOT}
    </>
  ),
  // A tower with three merlons.
  rook: (
    <>
      <path d="M11 6h4.5v3h3V6h3v3h3V6H29v8.5H11z" />
      <path d="M13.5 14.5h13l1.5 18h-16z" />
      {FOOT}
    </>
  ),
  // A head in profile, facing left: ear, forehead, muzzle, jaw, and the curve of the neck.
  knight: (
    <>
      <path d="M12.5 32.5C12.5 26 17 23.5 18 19.5L13 21.5L9.5 18L16.5 9L17.5 4.5L21.5 8C27.5 10 30 18 29 32.5z" />
      {FOOT}
    </>
  ),
  // A pointed cap under a small ball, on a collar.
  bishop: (
    <>
      <circle cx="20" cy="5.2" r="2" />
      <path d="M20 7C25 11.5 27 15.5 27 19C27 22.5 24 25 20 25C16 25 13 22.5 13 19C13 15.5 15 11.5 20 7z" />
      <rect x="14" y="24.5" width="12" height="3" rx="1.5" />
      <path d="M16.5 27h7l4 5.5h-15z" />
      {FOOT}
    </>
  ),
  // A crown of five points, each with a ball.
  queen: (
    <>
      <path d="M9 12.5L13.5 22L15 10L18.5 21.5L20 8.5L21.5 21.5L25 10L26.5 22L31 12.5L28 27.5H12z" />
      <circle cx="9" cy="12.5" r="1.9" />
      <circle cx="15" cy="10" r="1.9" />
      <circle cx="20" cy="8.5" r="1.9" />
      <circle cx="25" cy="10" r="1.9" />
      <circle cx="31" cy="12.5" r="1.9" />
      {STEM}
      {FOOT}
    </>
  ),
  // A broad crown under a cross.
  king: (
    <>
      <path d="M18.75 2.5h2.5v3h3V8h-3v4h-2.5V8h-3V5.5h3z" />
      <path d="M20 11.5C24.5 11.5 30.5 13.5 30.5 19C30.5 22.5 28 25 27.5 27.5H12.5C12 25 9.5 22.5 9.5 19C9.5 13.5 15.5 11.5 20 11.5z" />
      {STEM}
      {FOOT}
    </>
  ),
};

/** Marks drawn on a silhouette in the colour of its outline: the bishop's notch, the knight's eye. */
const MARKS: Readonly<Partial<Record<ChessPieceKind, ReactNode>>> = {
  bishop: <path d="M21.5 12l-3.5 5.5" />,
  knight: <circle cx="16.5" cy="13" r="0.8" />,
};

/** The props of `ChessPieceShape`. */
export interface ChessPieceShapeProps {
  /** Which piece to draw. */
  kind: ChessPieceKind;
  /** Whose piece it is: White's are light with a dark outline, Black's dark with a light one. */
  side: ChessSide;
}

/**
 * One piece as a flat drawing that fills the square it stands on. It is decorative: the
 * square names the piece for assistive technology.
 *
 * The silhouette is drawn twice, first as a thick outline and then as the fill, so that the
 * shapes it is made of show no seams.
 */
export function ChessPieceShape({ kind, side }: ChessPieceShapeProps) {
  const marks = MARKS[kind];
  return (
    <svg
      className="mac-chess-piece"
      data-side={side}
      data-kind={kind}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <g className="mac-chess-piece-edge">{SHAPES[kind]}</g>
      <g className="mac-chess-piece-body">{SHAPES[kind]}</g>
      {marks ? <g className="mac-chess-piece-mark">{marks}</g> : null}
    </svg>
  );
}
