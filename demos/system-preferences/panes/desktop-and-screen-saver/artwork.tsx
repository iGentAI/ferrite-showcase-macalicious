import { useId } from "react";
import {
  DESKTOP_PICTURE_EVENT,
  type DesktopPictureDetail,
  showDesktopPicture,
} from "../../../desktop/desktop-personal";
import { DESKTOP_COLORS, DESKTOP_PICTURES, DYNAMIC_DESKTOPS } from "./pictures";

/*
 * The pane's pictures. Every desktop picture is an original generated photograph, not Apple's:
 * a small one for the gallery and the preview in art/ (<id>.webp for a still, <id>-day.webp
 * and <id>-night.webp for a dynamic desktop), and a large one for the desktop itself in
 * art/full/. Catalina's large pictures are the desktop demo's own. The visual comparisons mask
 * every picture. The folder icon and the colour wheel are original drawings.
 */

const fileName = (path: string, folder: string) => path.slice(folder.length, -".webp".length);

const THUMBNAILS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./art/*.webp", { eager: true, query: "?url", import: "default" }),
  ).map(([path, url]) => [fileName(path, "./art/"), url]),
);

const FULL: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./art/full/*.webp", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([path, url]) => [fileName(path, "./art/full/"), url]),
);

const DYNAMIC = new Set(DYNAMIC_DESKTOPS.map((picture) => picture.id));
const COLORS = new Map(DESKTOP_COLORS.map((picture) => [picture.id, picture.color]));
const KNOWN = new Set([
  ...DYNAMIC,
  ...DESKTOP_PICTURES.map((picture) => picture.id),
  ...COLORS.keys(),
]);

/** A picture of one colour, for the desktop's picture layers. */
const colorPicture = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="${color}"/></svg>`)}`;

export type { DesktopPictureDetail };
/** The name of the window event that tells a hosting desktop which picture to show. */
export { DESKTOP_PICTURE_EVENT };

/** Whether `picture` is the id of one of the pane's own pictures. */
export const isBuiltInPicture = (picture: string): boolean => KNOWN.has(picture);

/**
 * What the desktop is told of one of the pane's pictures: the large picture for day (Aqua) and
 * for night (Dark Aqua), and which of the two a look keeps to. A dynamic desktop set to Dynamic
 * changes with the browser's clock (`time`); a still keeps to its picture. Catalina's own large
 * pictures are the desktop demo's, so for it the desktop is told the look alone.
 */
export function builtInPictureDetail(
  picture: string,
  mode: "dynamic" | "light" | "dark",
): DesktopPictureDetail | undefined {
  if (!KNOWN.has(picture)) return undefined;
  const color = COLORS.get(picture);
  if (color) {
    const url = colorPicture(color);
    return { day: url, night: url, look: "auto" };
  }
  if (!DYNAMIC.has(picture)) return { day: FULL[picture], night: FULL[picture], look: "auto" };
  return {
    day: FULL[`${picture}-day`],
    night: FULL[`${picture}-night`],
    look: mode === "light" ? "day" : mode === "dark" ? "night" : "time",
  };
}

/**
 * Tell a desktop that hosts this pane about the chosen picture. Nothing listens outside the
 * desktop demo, so in the pane on its own this does nothing visible.
 */
export function announceDesktopPicture(picture: string, mode: "dynamic" | "light" | "dark") {
  const detail = builtInPictureDetail(picture, mode);
  if (detail) showDesktopPicture({ ...detail, source: "system-preferences" });
}

export interface PictureArtworkProps {
  /** The id of a picture of pictures.ts. */
  picture: string;
  /**
   * Which still of a dynamic desktop is shown: `split` is the day picture on the left half and
   * the night picture on the right, as the gallery shows it. A still picture has one look.
   * @default "split"
   */
  look?: "split" | "day" | "night";
  /** Width in points; the gallery's 91 by default. The picture fills the box, cropped. */
  width?: number;
  /** Height in points; the gallery's 60.5 by default. */
  height?: number;
}

/** A desktop picture, small. Decorative: its button or the label beside it names it. */
export function PictureArtwork({
  picture,
  look = "split",
  width = 91,
  height = 60.5,
}: PictureArtworkProps) {
  if (!KNOWN.has(picture)) return null;
  const color = COLORS.get(picture);
  if (color) {
    return (
      <span aria-hidden="true" style={{ display: "block", width, height, background: color }} />
    );
  }
  const dynamic = DYNAMIC.has(picture);
  const fill = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  } as const;
  const day = dynamic ? THUMBNAILS[`${picture}-day`] : THUMBNAILS[picture];
  const night = dynamic ? THUMBNAILS[`${picture}-night`] : undefined;
  return (
    <span
      aria-hidden="true"
      style={{ position: "relative", display: "block", width, height, overflow: "hidden" }}
    >
      <img src={dynamic && look === "night" ? night : day} alt="" draggable={false} style={fill} />
      {dynamic && look === "split" ? (
        <img
          src={night}
          alt=""
          draggable={false}
          style={{ ...fill, clipPath: "inset(0 0 0 50%)" }}
        />
      ) : null}
    </span>
  );
}

/** The folder of the source list: a blue folder with a tab, 15 x 12.5 pt. */
export function FolderIcon() {
  return (
    <svg width="15" height="12.5" viewBox="0 0 15 12.5" aria-hidden="true" focusable="false">
      <path
        d="M0 1.5A1.5 1.5 0 0 1 1.5 0h3.6l1.5 1.6h6.9A1.5 1.5 0 0 1 15 3.1V11a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 0 11z"
        fill="#5db8f2"
      />
      <path d="M0 3.8h15V11a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 0 11z" fill="#7fd0fb" />
    </svg>
  );
}

const WHEEL = ["#ff5f57", "#ffbd2e", "#d8e84a", "#5fd97a", "#4fb6f5", "#b07af0"];

/**
 * The colour wheel of the source list: six sectors under a pale centre, 13 pt across, in a box
 * as wide as the folder so that the names of both rows start at one place.
 */
export function ColorsIcon() {
  const fade = useId();
  return (
    <svg width="15" height="13" viewBox="-7.6 -6.5 15 13" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={fade}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {WHEEL.map((color, index) => {
        const from = (index * Math.PI) / 3;
        const to = ((index + 1) * Math.PI) / 3;
        const point = (angle: number) =>
          `${(6.5 * Math.cos(angle)).toFixed(2)} ${(6.5 * Math.sin(angle)).toFixed(2)}`;
        return (
          <path key={color} d={`M0 0L${point(from)}A6.5 6.5 0 0 1 ${point(to)}z`} fill={color} />
        );
      })}
      <circle r="6.5" fill={`url(#${fade})`} />
    </svg>
  );
}

/** The plus of the button that adds a folder, 11 pt across, in the button's text colour. */
export function PlusGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" focusable="false">
      <path d="M0 5h11v1H0zM5 0h1v11H5z" fill="currentColor" />
    </svg>
  );
}

/** The minus of the button that removes a folder. */
export function MinusGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" focusable="false">
      <path d="M0 5h11v1H0z" fill="currentColor" />
    </svg>
  );
}
