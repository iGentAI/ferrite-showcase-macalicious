import { ImageWell } from "macalicious/image-well";

/**
 * Fixture for the states no reference screenshot shows (empty, selected, drop target, a window
 * that is not key). `image-well.visual.json` focuses it with real input and checks the pixels
 * it expects. A drag cannot be performed by the runner, so the second well pins the drop
 * highlight with `data-force`.
 *
 * 120 x 64 pt, 8 pt of window background around and between two empty wells of 48 x 48 pt:
 * the first at x 8 to 56, the drop target at x 64 to 112, both y 8 to 56. The ring is 2 pt.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: 8,
        background: "light-dark(#ececec, #2f3032)",
      }}
    >
      <ImageWell aria-label="Empty" />
      <ImageWell aria-label="Drop target" data-force="drag-over" />
    </div>
  );
}
