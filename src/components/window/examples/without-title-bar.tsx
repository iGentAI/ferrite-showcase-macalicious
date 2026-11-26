import { windowDragRegion } from "macalicious/lib/window-drag-region";
import { Window } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useState } from "react";

/**
 * A window without a title bar, as App Store, Reminders and Messages have: the sidebar reaches
 * the top edge and the window controls float over it. `topHighlight` draws the two rows a
 * title bar would draw there, and `windowDragRegion` makes the strip that holds the controls
 * the surface a window manager moves the window by.
 */
export default function WithoutTitleBar() {
  const [presses, setPresses] = useState(0);
  return (
    <div style={{ padding: "24px 48px 64px" }}>
      <Window
        topHighlight
        aria-label="Lists"
        width={360}
        height={160}
        style={{ flexDirection: "row" }}
      >
        <div
          style={{
            position: "relative",
            width: 140,
            background: "var(--mac-material-sidebar-opaque)",
            borderInlineEnd: "1px solid var(--mac-color-separator)",
          }}
        >
          <div style={{ height: 38 }} {...windowDragRegion(() => setPresses((count) => count + 1))}>
            <WindowControls style={{ position: "absolute", top: 13, left: 13 }} />
          </div>
        </div>
        <div style={{ flex: 1, padding: 20, background: "var(--mac-color-control-background)" }}>
          Presses on the strip over the sidebar: {presses}
        </div>
      </Window>
    </div>
  );
}
