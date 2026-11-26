import { ImageView } from "macalicious/image-view";

// Stand-in artwork drawn for this check: two solid rectangles with a natural size.
const svg = (width: number, height: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}"/></svg>`,
  )}`;

/**
 * Visual check target for the default scaling of a template image, which no screenshot can
 * show: two 64 x 64 pt views, 10 pt apart, in a 158 x 84 pt box with 10 pt of padding. The
 * first holds a 16 x 16 pt template, which must stay 16 pt (x 34..50, y 34..50) and not grow
 * to fill the view; the second a 128 x 64 pt template, which must shrink to 64 x 32 pt
 * (x 84..148, y 26..58). Both are drawn in the label colour.
 */
export default function VisualTemplateScaling() {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        boxSizing: "border-box",
        width: 158,
        height: 84,
        padding: 10,
        background: "light-dark(#ececec, #2f3031)",
        color: "var(--mac-color-label)",
      }}
    >
      <ImageView src={svg(16, 16)} template width={64} height={64} />
      <ImageView src={svg(128, 64)} template width={64} height={64} />
    </div>
  );
}
