import type { ComponentProps, ReactNode } from "react";
import type { Photo, PhotoShape, PhotosSourceIcon } from "./photos-data";

/*
 * Every drawing here is original artwork. The pictures of the reference captures are Apple's
 * desktop pictures, and the glyphs of its toolbar and sidebar are Apple's too: none of them is
 * reproduced, and the pictures are not imitated either.
 */

/*
 * The pictures of the library are original generated photographs in art/: `<id>.webp`, 480 px
 * on its longer side, for thumbnails and sidebar icons, and `<id>-large.webp`, 1200 px, for the
 * picture opened on its own. An item without one falls back to the grey placeholder below.
 */
const FILES = import.meta.glob<string>("./art/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});
const artOf = (name: string): string | undefined => FILES[`./art/${name}.webp`];

/*
 * The placeholder pictures are neutral greys, taken in turn from these five pairs of a flat
 * fill and the grey of the one shape on it. The turn is the picture's place in the library,
 * so no grey follows the tone of a captured picture.
 */
const GREYS: readonly [fill: string, shape: string][] = [
  ["#b9b9b9", "#8c8c8c"],
  ["#9c9c9c", "#c6c6c6"],
  ["#cdcdcd", "#a2a2a2"],
  ["#8a8a8a", "#b4b4b4"],
  ["#adadad", "#d6d6d6"],
];

/* The one shape of a placeholder, in a box of 160 units on its longer side. */
function shapeOf(shape: PhotoShape, w: number, h: number, color: string) {
  const unit = Math.min(w, h);
  switch (shape) {
    case "disc":
      return <circle cx={w * 0.68} cy={h * 0.4} r={unit * 0.22} fill={color} />;
    case "bands":
      return (
        <>
          <rect y={h * 0.58} width={w} height={h * 0.12} fill={color} />
          <rect y={h * 0.78} width={w} height={h * 0.22} fill={color} />
        </>
      );
    case "triangle":
      return <path d={`M${w * 0.12} ${h}L${w * 0.42} ${h * 0.3}L${w * 0.72} ${h}Z`} fill={color} />;
    case "ring":
      return (
        <circle
          cx={w * 0.34}
          cy={h * 0.56}
          r={unit * 0.24}
          fill="none"
          stroke={color}
          strokeWidth={unit * 0.09}
        />
      );
    case "diagonal":
      return <path d={`M0 ${h}L${w} ${h * 0.25}V${h}Z`} fill={color} />;
    default:
      return (
        <>
          <rect x={w * 0.14} y={h * 0.2} width={unit * 0.3} height={unit * 0.3} fill={color} />
          <rect x={w * 0.52} y={h * 0.5} width={unit * 0.3} height={unit * 0.3} fill={color} />
        </>
      );
  }
}

export interface PhotoArtworkProps extends Omit<ComponentProps<"svg">, "children"> {
  /** The library item whose placeholder is drawn. */
  photo: Photo;
  /**
   * Quarter turns to the left, as Rotate makes them.
   * @default 0
   */
  turns?: number;
  /**
   * Fills a box of another shape and is cropped by it, as the album's thumbnail in the
   * sidebar is; otherwise the drawing has the picture's own shape.
   * @default false
   */
  cropped?: boolean;
  /**
   * Draws the larger version of the picture, as the picture opened on its own does.
   * @default false
   */
  large?: boolean;
}

/**
 * The picture of a library item, in its proportions: its generated photograph, or, without one,
 * a flat grey with one simple shape. It is decorative: the element around it names the picture.
 */
export function PhotoArtwork({
  photo,
  turns = 0,
  cropped = false,
  large = false,
  ...props
}: PhotoArtworkProps) {
  const scale = 160 / Math.max(photo.width, photo.height);
  const w = Math.round(photo.width * scale);
  const h = Math.round(photo.height * scale);
  const quarter = ((turns % 4) + 4) % 4;
  const src = (large ? artOf(`${photo.id}-large`) : undefined) ?? artOf(photo.id);
  const [fill, color] = GREYS[(Number(photo.id.replace(/\D/g, "")) || 0) % GREYS.length] as [
    string,
    string,
  ];
  // A quarter turn to the left takes the point (x, y) of the w by h drawing to (y, w - x).
  const transform = [
    undefined,
    `translate(0 ${w}) rotate(-90)`,
    `rotate(180 ${w / 2} ${h / 2})`,
    `translate(${h} 0) rotate(90)`,
  ][quarter];
  return (
    <svg
      viewBox={quarter % 2 ? `0 0 ${h} ${w}` : `0 0 ${w} ${h}`}
      preserveAspectRatio={cropped ? "xMidYMid slice" : "none"}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g transform={transform}>
        <rect width={w} height={h} fill={fill} />
        {src ? (
          <image href={src} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
        ) : (
          shapeOf(photo.shape, w, h, color)
        )}
      </g>
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.25 } as const;
const round = { ...stroke, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/* The template glyphs of the sidebar, in its 18 pt icon box. */
const SOURCE_GLYPHS: Record<Exclude<PhotosSourceIcon, "thumbnail">, ReactNode> = {
  photos: (
    <>
      <path {...stroke} d="M4.5 3.5h-3v8h2" />
      <rect {...stroke} x="4.5" y="5.5" width="12" height="9" rx="1" />
      <path d="M5.5 13.5l3-3.5 2.5 2.5 1.5-1.5 3 2.5z" fill="currentColor" />
    </>
  ),
  memories: (
    <>
      <circle {...stroke} cx="9.5" cy="9" r="6.5" />
      <path d="M8 6v6l5-3z" fill="currentColor" />
      <path {...round} d="M1.5 9h2" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="5" r="3.5" fill="currentColor" />
      <path d="M1.5 16a7.5 6.5 0 0 1 15 0z" fill="currentColor" />
    </>
  ),
  places: (
    <>
      <circle cx="9" cy="4" r="2.75" fill="currentColor" />
      <path {...round} d="M9 6.5v7" />
      <path
        {...round}
        d="M5.5 11.5c-2.5.5-4 1.25-4 2.25 0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5c0-1-1.5-1.75-4-2.25"
      />
    </>
  ),
  recents: (
    <>
      <path {...round} d="M6 5.5H2.5v10.5h13V5.5H12" />
      <path {...round} d="M9 1.5v9.5M5.75 8L9 11.25 12.25 8" />
    </>
  ),
  imports: (
    <>
      <path {...stroke} d="M3.5 3.5h-2v9h2" />
      <path {...stroke} d="M3.5 6.5h3l1-1.5h4l1 1.5h4v9h-13z" />
      <circle {...stroke} cx="10" cy="11" r="2.5" />
    </>
  ),
  activity: (
    <path
      {...round}
      d="M5 14.5a3.5 3.5 0 0 1-.5-6.95A4.75 4.75 0 0 1 13.6 6.3 4.1 4.1 0 0 1 13.5 14.5z"
    />
  ),
  stack: (
    <>
      <rect {...stroke} x="1.5" y="6.5" width="15" height="10" rx="1.5" />
      <path {...round} d="M3.5 4.25h11M5.5 2h7" />
    </>
  ),
  gear: (
    <>
      <circle {...stroke} cx="9" cy="9" r="4.5" />
      <circle {...stroke} cx="9" cy="9" r="1.5" />
      <path
        {...round}
        d="M9 1.5v3M9 13.5v3M1.5 9h3M13.5 9h3M3.7 3.7l2.1 2.1M12.2 12.2l2.1 2.1M3.7 14.3l2.1-2.1M12.2 5.8l2.1-2.1"
      />
    </>
  ),
};

/** A template glyph of the sidebar, drawn in the row's tint. */
export function SourceGlyph({ name }: { name: Exclude<PhotosSourceIcon, "thumbnail"> }) {
  return (
    <svg
      className="mac-photos-source-icon"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
    >
      {SOURCE_GLYPHS[name]}
    </svg>
  );
}

/** The two ends of the zoom slider: a small and a large picture frame. */
export function ZoomGlyph({ large = false }: { large?: boolean }) {
  const [width, height] = large ? [12, 10] : [9, 7];
  return (
    <svg
      className="mac-photos-zoom-glyph"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <rect x=".5" y=".5" width={width - 1} height={height - 1} fill="none" stroke="currentColor" />
      <path
        d={
          large
            ? "M3 8a3 2.6 0 0 1 6 0zM6 2.25a1.5 1.5 0 1 0 0 3 1.5 1.5 0 1 0 0-3z"
            : "M2.5 5.5a2 1.6 0 0 1 4 0zM4.5 1.75a1 1 0 1 0 0 2 1 1 0 1 0 0-2z"
        }
        fill="currentColor"
      />
    </svg>
  );
}

const HEART =
  "M7.5 12.25C4.5 10 1 7.5 1 4.4 1 2.5 2.4 1 4.2 1c1.3 0 2.5.75 3.3 2 .8-1.25 2-2 3.3-2C12.6 1 14 2.5 14 4.4c0 3.1-3.5 5.6-6.5 7.85z";

/** Favorite: a heart, outlined, and filled once the pictures are favorites. */
export function HeartGlyph({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="15" height="13.5" viewBox="0 0 15 13.5" aria-hidden="true" focusable="false">
      <path
        d={HEART}
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The heart on the thumbnail of a favorite, 12 pt wide. */
export function FavoriteBadge() {
  return (
    <svg
      className="mac-photos-favorite"
      width="12"
      height="11"
      viewBox="0 0 15 13.5"
      aria-hidden="true"
      focusable="false"
    >
      <path d={HEART} fill="currentColor" />
    </svg>
  );
}

/** Rotate: a sheet and an arrow that turns to the left over it. */
export function RotateGlyph() {
  return (
    <svg width="15" height="15.5" viewBox="0 0 15 15.5" aria-hidden="true" focusable="false">
      <rect
        x=".6"
        y="7"
        width="8.5"
        height="7.9"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path
        d="M7.5 3.4h1.75a4.9 4.9 0 0 1 4.9 4.9v.95"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path d="M8 .4v6L4.6 3.4z" fill="currentColor" />
    </svg>
  );
}

/* The services of the Share menu: plain line drawings in the menu's 16 pt image box. */
const SERVICE_GLYPHS = {
  mail: "M1.5 3.5h13v9h-13zM1.5 4l6.5 5 6.5-5",
  messages:
    "M8 2.5c3.6 0 6.5 2.2 6.5 5s-2.9 5-6.5 5c-.7 0-1.4-.1-2-.25L3 14l.6-2.6C2.3 10.45 1.5 9.05 1.5 7.5c0-2.8 2.9-5 6.5-5z",
  notes: "M3.5 1.5h9v13h-9zM5.5 5h5M5.5 7.5h5M5.5 10h3",
} as const;

/** A service of the Share menu. */
export type PhotosService = keyof typeof SERVICE_GLYPHS;

/** The glyph of a Share service. */
export function ServiceGlyph({ name }: { name: PhotosService }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d={SERVICE_GLYPHS[name]} {...round} strokeWidth="1" />
    </svg>
  );
}
