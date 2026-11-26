import { LevelIndicator } from "macalicious/level-indicator";

/**
 * Visual check target for the editable indicator, which no screenshot shows: a rating of five
 * stars at (10, 10) pt, 77 x 13 pt, starting at 2, and ten capacity segments at (10, 35) pt,
 * 180 x 12 pt, starting at 3. Star k begins 16 (k - 1) pt and segment k 18.2 (k - 1) pt from
 * the left of its row. The comparisons click a star and a segment, or use the keyboard, and
 * then read the colours of the stars and segments on either side of the new value.
 */
export default function VisualEditable() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
        boxSizing: "border-box",
        width: 200,
        height: 70,
        padding: 10,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <LevelIndicator variant="rating" editable defaultValue={2} max={5} aria-label="Rating" />
      <LevelIndicator
        variant="discrete"
        editable
        defaultValue={3}
        max={10}
        aria-label="Capacity"
        style={{ width: 180 }}
      />
    </div>
  );
}
