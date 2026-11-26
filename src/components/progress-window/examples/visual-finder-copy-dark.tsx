import {
  ProgressWindow,
  ProgressWindowItem,
  ProgressWindowName,
} from "macalicious/progress-window";
import { WindowControls } from "macalicious/window-controls";

/** A stand-in for the QuickTime document icon, which is Apple artwork: a plain page. */
function DocumentIcon() {
  return (
    <svg width="23" height="31" viewBox="0 0 23 31" aria-hidden="true">
      <path d="M.5.5h15l7 7v23H.5z" fill="#fcfcfc" stroke="#b4b4b4" />
      <path d="M15.5.5v7h7" fill="#e4e4e4" stroke="#b4b4b4" />
    </svg>
  );
}

/**
 * Visual comparison target: Finder's Copy window in the Dark Aqua capture, which is further
 * along than the Aqua one, with 8 pt of its shadow on every side.
 *
 * Reference crop (2x pixels) x=96 y=60 w=830 h=170, i.e. 415 x 85 pt, matted with white. The
 * frame is 399 x 69 pt at 8, 8. The bar is at 8%: its fill ends at x=274, 48.5 of the bar's 614
 * device pixels. The window background is the capture's #2e3235, the dark window colour tinted
 * by the desktop picture behind it.
 */
export default function VisualFinderCopyDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 415,
        height: 85,
        overflow: "hidden",
        background: "white",
      }}
    >
      <ProgressWindow
        controls={<WindowControls closeDisabled zoomDisabled />}
        style={{ position: "absolute", left: 8, top: 8, background: "#2e3235" }}
      >
        <ProgressWindowItem
          icon={<DocumentIcon />}
          title={
            <>
              Copying “
              <ProgressWindowName tail={13}>
                Pippin - Apple's Failed Game Console.mov
              </ProgressWindowName>
              ” to “Desktop”
            </>
          }
          status="494.9 MB of 6 GB - About 2 minutes"
          value={(48.5 / 614) * 100}
          onStop={() => {}}
        />
      </ProgressWindow>
    </div>
  );
}
