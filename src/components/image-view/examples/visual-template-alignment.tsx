import { ImageView } from "macalicious/image-view";
import type { CSSProperties } from "react";

// Stand-in artwork drawn for this check: solid rectangles with a natural size.
const svg = (width: number, height: number, filled = width) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${filled}" height="${height}"/></svg>`,
  )}`;

const SQUARE = svg(16, 16);
const WIDE = svg(128, 64);
// 128 x 64 pt with only its leading half filled, so that a crop shows which part it is.
const HALF = svg(128, 64, 64);

const place = (align: string, justify: string) =>
  ({ "--mac-image-view-align": align, "--mac-image-view-justify": justify }) as CSSProperties;

/**
 * Visual check target for the alignment of a template image that is scaled down or shown at
 * its own size, which no screenshot can show: four 64 x 64 pt views, 10 pt apart, in a
 * 306 x 84 pt box with 10 pt of padding.
 *
 * 1. A 16 pt template in the top leading corner (x 10..26, y 10..26).
 * 2. A 16 pt template in the bottom trailing corner (x 132..148, y 58..74).
 * 3. A 128 x 64 pt template, scaled down to 64 x 32 pt, at the bottom (x 158..222, y 42..74).
 * 4. A 128 x 64 pt template at its own size, larger than the view, aligned to its leading
 *    edge: the view (x 232..296) shows the filled leading half and none of the empty rest.
 *    Centred, its trailing half would be empty.
 */
export default function VisualTemplateAlignment() {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        boxSizing: "border-box",
        width: 306,
        height: 84,
        padding: 10,
        background: "light-dark(#ececec, #2f3031)",
        color: "var(--mac-color-label)",
      }}
    >
      <ImageView src={SQUARE} template width={64} height={64} style={place("start", "start")} />
      <ImageView src={SQUARE} template width={64} height={64} style={place("end", "end")} />
      <ImageView src={WIDE} template width={64} height={64} style={place("end", "center")} />
      <ImageView
        src={HALF}
        template
        scaling="none"
        width={64}
        height={64}
        style={place("center", "start")}
      />
    </div>
  );
}
