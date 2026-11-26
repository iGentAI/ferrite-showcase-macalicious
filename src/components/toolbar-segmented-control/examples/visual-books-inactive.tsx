import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";

/**
 * Visual comparison target: the section switcher of the Books toolbar in a window that is not
 * active, with its first segment selected. The comparison sets the window state.
 *
 * Reference crop (2x pixels) x=921 y=103 w=786 h=66, that is 393 x 33 pt of the bar (#f6f6f6,
 * Dark Aqua #2b2d2f). The control's fill is 382 x 22 pt and starts 5.5 pt from the crop's left
 * and top (x 932..1695, y 114..157): segments of 127, 128 and 127 pt, the second with its
 * divider in its last point (x 1440..1441). The titles are set in the fallback font off Apple
 * platforms; the comparisons mask them.
 *
 * `disabled` lets `visual-books-inactive-disabled` reuse the control for the check that a
 * disabled selection keeps its provisional half-strength fill in an inactive window.
 */
export default function VisualBooksInactive({ disabled = false }) {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 393,
        height: 33,
        padding: "5.5px 0 0 5.5px",
        lineHeight: 0,
        background: "light-dark(#f6f6f6, #2b2d2f)",
      }}
    >
      <ToolbarSegmentedControl defaultValue={["library"]} disabled={disabled} aria-label="Section">
        <ToolbarSegment value="library" style={{ width: 127 }}>
          Library
        </ToolbarSegment>
        <ToolbarSegment value="store" style={{ width: 128 }}>
          Book Store
        </ToolbarSegment>
        <ToolbarSegment value="audiobooks" style={{ width: 127 }}>
          Audiobook Store
        </ToolbarSegment>
      </ToolbarSegmentedControl>
    </div>
  );
}
