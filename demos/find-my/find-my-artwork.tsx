import { useId } from "react";
import type { FindMyDeviceKind, FindMyPoint } from "./find-my-data";

/*
 * Every drawing here is original artwork and an abstract placeholder. The reference captures
 * show Apple's map tiles with their roads, shields and place names, Apple's avatar silhouette
 * and Apple's glyphs: none of them is reproduced, and none is imitated. The drawings stand
 * where those pictures are and depict nothing; apart from the measured land colour of the map
 * and the measured blue of the current location's dot, no outline and no colour of them comes
 * from the captures. Their fills are the demo's tokens (find-my.tokens.css), so that both
 * appearances have them.
 */

/** What the placeholder map is, for assistive technology. */
export const MAP_DESCRIPTION =
  "Abstract placeholder for a map: bands, a disc and two blocks on flat land";

/** The size of the tile the placeholder map repeats, in points at zoom level 0. */
const TILE = { width: 560, height: 420 };

export interface MapDrawingProps {
  /** The point of the map at the middle of the view. */
  center: FindMyPoint;
  /** The factor the map is drawn at. */
  scale: number;
  /** The direction that is up, in degrees clockwise from north. */
  heading: number;
  /** Where the dot of the current location is. */
  location: FindMyPoint;
}

/**
 * The placeholder map: one tile of two wide and two narrow bands, a disc, two blocks, a
 * stripe and two short bars, repeated in every direction, so that every part of the map and
 * every zoom level shows the same abstract drawing. It is a 2 pt square at the middle of the
 * view whose contents overflow; the element around it clips it and names it.
 *
 * The stylesheet recolours the tile by the map's type: the satellite view darkens the ground
 * and hides the bands and the bars, the hybrid view lays them over the dark ground. The dot
 * of the current location has a halo, which the stylesheet shows while the location is shared.
 */
export function MapDrawing({ center, scale, heading, location }: MapDrawingProps) {
  // Pattern ids are shared by a page; two maps on it must not use each other's.
  const id = useId().replace(/[^\w-]/g, "");
  const place = `rotate(${-heading}) scale(${scale}) translate(${-center.x} ${-center.y})`;
  return (
    <svg
      className="mac-find-my-art"
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
          <rect className="mac-find-my-art-stripe" x="430" width="34" height={TILE.height} />
          <circle className="mac-find-my-art-disc" cx="150" cy="300" r="58" />
          <rect className="mac-find-my-art-block" x="250" y="90" width="70" height="46" rx="4" />
          <rect className="mac-find-my-art-block" x="40" y="40" width="38" height="38" rx="4" />
          <rect className="mac-find-my-art-band" y="190" width={TILE.width} height="10" />
          <rect className="mac-find-my-art-band" x="210" width="10" height={TILE.height} />
          <rect className="mac-find-my-art-band" y="370" width={TILE.width} height="5" />
          <rect className="mac-find-my-art-band" x="360" width="5" height={TILE.height} />
          <rect className="mac-find-my-art-bar" x="250" y="160" width="44" height="5" rx="2.5" />
          <rect className="mac-find-my-art-bar" x="100" y="215" width="60" height="5" rx="2.5" />
        </pattern>
      </defs>
      <rect x="-4000" y="-4000" width="8000" height="8000" fill={`url(#${id})`} />
      <g transform={place}>
        <circle className="mac-find-my-art-halo" cx={location.x} cy={location.y} r={24 / scale} />
        {/* A 12 pt disc in a 2 pt ring: the ring is a stroke about a radius of 7 pt. */}
        <circle
          className="mac-find-my-art-location"
          cx={location.x}
          cy={location.y}
          r={7 / scale}
          vectorEffect="non-scaling-stroke"
        />
      </g>
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

/**
 * The glyph of "Share My Location", 13 pt: a disc with a plus on it. The plus has the colour
 * of the sidebar behind the button, so it reads as cut out.
 */
export function ShareGlyph() {
  return (
    <svg
      className="mac-find-my-share-glyph"
      width="13"
      height="13"
      viewBox="0 0 13 13"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6.5" cy="6.5" r="6.5" fill="currentColor" />
      <path className="mac-find-my-share-plus" d="M6.5 3.25v6.5M3.25 6.5h6.5" />
    </svg>
  );
}

/**
 * A device's glyph, 15 pt, drawn in the colour of the text around it: an outline with a foot
 * for a laptop, a tall one for a phone, a wide one for a tablet. They stand for a kind of
 * device and picture no product.
 */
export function DeviceGlyph({ kind }: { kind: FindMyDeviceKind }) {
  return (
    <svg
      className="mac-find-my-device-glyph"
      width="15"
      height="15"
      viewBox="0 0 15 15"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {kind === "laptop" ? <path d="M3 3.5h9v6H3zM1.5 11.5h12" /> : null}
      {kind === "phone" ? <rect x="4.75" y="2" width="5.5" height="11" rx="1.25" /> : null}
      {kind === "tablet" ? <rect x="2" y="3.5" width="11" height="8" rx="1.25" /> : null}
    </svg>
  );
}
