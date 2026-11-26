import { StorePillButton } from "macalicious/store-pill-button";

/**
 * Fixture for the downloading state, which no reference screenshot shows: a 21 pt ring a
 * quarter filled, around the 6 pt stop square, with 8 pt of page on every side (37 x 37 pt).
 * The square's centre is at 18.5, 18.5.
 */
export default function VisualProgress() {
  return (
    <div style={{ display: "flex", padding: 8, background: "light-dark(#ffffff, #1e1f22)" }}>
      <StorePillButton progress={0.25}>Stop</StorePillButton>
    </div>
  );
}
