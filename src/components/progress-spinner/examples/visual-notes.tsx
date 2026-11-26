import { ProgressSpinner } from "macalicious/progress-spinner";

/**
 * Visual comparison target: the small spinner beside “iCloud” in Notes' sidebar (Aqua).
 * Reference crop (2x pixels) x=207 y=158 w=48 h=44, i.e. 24 x 22 pt with the 16 pt spinner at
 * (4, 4) pt (a selected row begins just below). The capture caught the frame whose head is at
 * 9 o'clock; the example shows a stopped spinner, whose head is at 12 o'clock, turned by three
 * quarters. The spinner is in a sidebar there, where Aqua draws it fainter; the wrapper carries
 * the sidebar's `data-material` and has no box of its own.
 */
export default function VisualNotes() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 24,
        height: 22,
        padding: "4px 4px 0",
        background: "light-dark(#e6e7e7, #303031)",
      }}
    >
      <div data-material="translucent" style={{ display: "contents" }}>
        <ProgressSpinner
          size="small"
          animating={false}
          displayedWhenStopped
          aria-label="Loading"
          style={{ display: "block", rotate: "270deg" }}
        />
      </div>
    </div>
  );
}
