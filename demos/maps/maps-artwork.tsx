import { type ComponentProps, useId } from "react";
import type { MapsPoint } from "./maps-data";

/*
 * Every drawing here is original artwork and an abstract placeholder. The reference captures
 * show Apple's map tiles, three photographs of a third party, the Wikipedia wordmark and
 * Apple's pin, weather and button glyphs: none of them is reproduced, and none is imitated.
 * The drawings stand where those pictures are and depict nothing; apart from the measured
 * land colour of the map, no outline and no colour of them comes from the captures. Their
 * fills are the demo's tokens (maps.tokens.css), so that both appearances have them.
 */

/** What the placeholder map is, for assistive technology. */
export const MAP_DESCRIPTION =
  "Abstract placeholder for a map: bands, a disc and a block on flat land";

/** What a placeholder photograph is, for assistive technology. */
export const PHOTO_DESCRIPTION = "Abstract placeholder for a photograph";

/** The size of the tile the placeholder map repeats, in points at zoom level 0. */
const TILE = { width: 480, height: 360 };

export interface MapDrawingProps {
  /** The point of the map at the middle of the view. */
  center: MapsPoint;
  /** The factor the map is drawn at. */
  scale: number;
  /** A route to draw, from its first point to its second, or none. */
  route?: readonly [MapsPoint, MapsPoint] | null;
  /** Where the dot of the current location is. */
  location: MapsPoint;
}

/**
 * The placeholder map: one tile of two wide and two narrow bands, a disc, a block and a
 * stripe, repeated in every direction, so that every region and every zoom level shows the
 * same abstract drawing. It is a 2 pt square at the middle of the view whose contents
 * overflow; the element around it clips it and names it.
 *
 * A transit map adds two coloured lines with a dot where they cross, traffic colours a
 * stretch of one band, the 3D map gives the block a raised side, and a route is an elbow
 * from the current location to the place. The
 * stylesheet shows and hides those by the map's attributes.
 */
export function MapDrawing({ center, scale, route, location }: MapDrawingProps) {
  // Pattern ids are shared by a page; two maps on it must not use each other's.
  const id = useId().replace(/[^\w-]/g, "");
  const place = `scale(${scale}) translate(${-center.x} ${-center.y})`;
  return (
    <svg
      className="mac-maps-art"
      width="2"
      height="2"
      viewBox="-1 -1 2 2"
      overflow="visible"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={id}
          patternUnits="userSpaceOnUse"
          width={TILE.width}
          height={TILE.height}
          patternTransform={place}
        >
          <rect className="mac-maps-art-stripe" x="388" width="18" height={TILE.height} />
          <circle className="mac-maps-art-disc" cx="214" cy="150" r="46" />
          <rect className="mac-maps-art-block-side" x="318" y="264" width="44" height="62" rx="3" />
          <rect className="mac-maps-art-block" x="318" y="258" width="44" height="62" rx="3" />
          <rect className="mac-maps-art-band" y="52" width={TILE.width} height="9" />
          <rect className="mac-maps-art-band" x="92" width="9" height={TILE.height} />
          <rect className="mac-maps-art-band" y="226" width={TILE.width} height="5" />
          <rect className="mac-maps-art-band" x="292" width="5" height={TILE.height} />
          <rect className="mac-maps-art-traffic" x="120" y="54" width="150" height="5" />
          <g className="mac-maps-art-transit">
            <rect
              className="mac-maps-art-line"
              data-line="a"
              y="300"
              width={TILE.width}
              height="4"
            />
            <rect
              className="mac-maps-art-line"
              data-line="b"
              x="176"
              width="4"
              height={TILE.height}
            />
            <circle className="mac-maps-art-station" cx="178" cy="302" r="5" />
          </g>
        </pattern>
      </defs>
      <rect x="-4000" y="-4000" width="8000" height="8000" fill={`url(#${id})`} />
      <g transform={place}>
        {route ? (
          <path
            className="mac-maps-art-route"
            d={`M${route[0].x} ${route[0].y}H${route[1].x}V${route[1].y}`}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <circle
          className="mac-maps-art-location"
          cx={location.x}
          cy={location.y}
          r={7 / scale}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}

/**
 * The pin of the selected place, 28 by 42 pt: a ball on a stem over a ground mark. The stem's
 * foot, at 14, 38, is the place; the ball's middle is 30 pt above it.
 */
export function Pin() {
  return (
    <svg
      className="mac-maps-pin-art"
      width="28"
      height="42"
      viewBox="0 0 28 42"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse className="mac-maps-pin-ground" cx="14" cy="38" rx="9" ry="3.25" />
      <path className="mac-maps-pin-stem" d="M14 14v24" />
      <circle className="mac-maps-pin-ball" cx="14" cy="8" r="6.75" />
    </svg>
  );
}

/** The weather's mark, 16 pt: a plain disc. It stands for any weather and shows none. */
export function WeatherGlyph() {
  return (
    <svg
      className="mac-maps-weather-glyph"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="5.5" />
    </svg>
  );
}

export interface PhotoPlaceholderProps extends ComponentProps<"svg"> {
  /** Which of the three drawings: they differ so that the cells of the mosaic do. */
  variant: 0 | 1 | 2;
}

/**
 * A placeholder photograph: a flat panel with a disc, a bar or a triangle. It fills the cell
 * it is given and is cropped to it; the image view around it names it.
 */
export function PhotoPlaceholder({ variant, ...props }: PhotoPlaceholderProps) {
  return (
    <svg
      viewBox="0 0 96 64"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect className="mac-maps-photo-panel" width="96" height="64" />
      {variant === 0 ? <circle className="mac-maps-photo-mark" cx="48" cy="32" r="12" /> : null}
      {variant === 1 ? (
        <rect className="mac-maps-photo-mark" x="28" y="26" width="40" height="12" rx="2" />
      ) : null}
      {variant === 2 ? <path className="mac-maps-photo-mark" d="M48 20L64 44H32Z" /> : null}
    </svg>
  );
}

/** The location button's glyph, 14 pt: an arrowhead pointing up and to the right. */
export function LocationGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path
        d="M12 2L2.2 6.3l4.4 1.1 1.1 4.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The Favorite button's glyph, 15 by 13 pt: a heart, outlined or filled. */
export function HeartGlyph({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="15" height="13" viewBox="0 0 15 13" aria-hidden="true" focusable="false">
      <path
        d="M7.5 12C3.6 9.3 1 7.2 1 4.5 1 2.6 2.4 1.2 4.2 1.2c1.3 0 2.5.7 3.3 1.9.8-1.2 2-1.9 3.3-1.9C12.6 1.2 14 2.6 14 4.5c0 2.7-2.6 4.8-6.5 7.5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The card's Share button glyph, 12 by 15 pt: a tray with an arrow leaving it upwards. */
export function ShareGlyph() {
  return (
    <svg width="12" height="15" viewBox="0 0 12 15" aria-hidden="true" focusable="false">
      <path
        d="M3.8 5.5H1.5v8.5h9V5.5H8.2M6 9.5V1.2M3.6 3.4L6 1l2.4 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A stand-in for a sharing service's icon, 16 pt: a rounded square in one of three tones. */
export function ServiceIcon({ tone }: { tone: 0 | 1 | 2 }) {
  return (
    <svg
      className="mac-maps-service"
      data-tone={tone}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="14" height="14" rx="3.5" />
    </svg>
  );
}
