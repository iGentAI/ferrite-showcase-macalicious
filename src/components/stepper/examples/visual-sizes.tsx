import { Stepper } from "macalicious/stepper";

/**
 * Fixture for the small and mini sizes, which no reference screenshot shows.
 *
 * 66 x 38 pt, 8 pt of window background around and between three steppers aligned at the top:
 * regular (box x 8 to 21, 22 pt high), small (x 29 to 40, 19 pt high) and mini (x 48 to 58,
 * 16 pt high).
 */
export default function VisualSizes() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: 8,
        lineHeight: 0,
        background: "light-dark(#ececec, #2f3032)",
      }}
    >
      <Stepper aria-label="Regular" />
      <Stepper aria-label="Small" size="small" />
      <Stepper aria-label="Mini" size="mini" />
    </div>
  );
}
