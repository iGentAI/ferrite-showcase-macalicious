import { PageControl } from "macalicious/page-control";

/**
 * Visual comparison target: the effects pager in Photo Booth's bottom bar, second of three
 * pages current. Reference crop (2x pixels) x=668 y=1112 w=328 h=56, i.e. 164 x 28 pt, with
 * the 156 x 20 pt control 4 pt from the left and from the top, on the bar's colour.
 */
export default function VisualPhotoBooth() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 164,
        height: 28,
        padding: "4px 0 0 4px",
        background: "light-dark(#e7e6e5, #2b2c2d)",
      }}
    >
      <PageControl count={3} page={1} aria-label="Effects pages" style={{ display: "flex" }} />
    </div>
  );
}
