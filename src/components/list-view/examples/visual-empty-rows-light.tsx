import { ListView } from "macalicious/list-view";
import type { CSSProperties } from "react";

const renderRow = () => null;

/**
 * Visual comparison target: the one empty row of 10-15-Catalina-Light-Messages.png that
 * shows below the Preferences window. Reference crop (2x pixels) x=746 y=1078 w=540 h=32: the
 * whole width of the conversation list, from its leading edge to the divider, over the last
 * 16 pt of the seventh 64 pt row, which ends in its 1 pt line (y 1108). The line starts 20 pt
 * from the list's edge (x 786). Above y 1078 the Preferences window's shadow darkens the list.
 * Measured: the list's tinted surface, #b9bec0 on average, and the line, black at 5.8%; the
 * example draws it as Messages does, black at 6%, with the Dark Aqua figure.
 *
 * The list is three empty rows tall and shows the last 16 pt of its first one, so the line
 * falls where the capture's does.
 */
export default function VisualEmptyRowsLight() {
  return (
    <div style={{ width: 270, height: 16, overflow: "hidden" }}>
      <ListView
        aria-label="Conversations"
        count={0}
        rowHeight={64}
        emptyRows="separator"
        selectionMode="none"
        renderRow={renderRow}
        style={
          {
            width: 270,
            height: 192,
            marginTop: -48,
            background: "#b9bec0",
            "--mac-list-view-separator": "rgb(0 0 0 / 0.06)",
            "--mac-list-view-separator-inset": "20px",
          } as CSSProperties
        }
      />
    </div>
  );
}
