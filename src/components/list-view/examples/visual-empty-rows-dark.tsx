import { ListView } from "macalicious/list-view";
import type { CSSProperties } from "react";

const renderRow = () => null;

/**
 * Visual comparison target: the empty rows under the one conversation of
 * 10-15-Catalina-Dark-Messages.png. Reference crop (2x pixels) x=1240 y=334 w=56 h=640: a
 * 28 pt strip of the conversation list right of the Preferences window, from the selected
 * row's bottom edge down five empty 64 pt rows, each ending in a 1 pt line (y 460, 588, 716,
 * 844 and 972). The strip is the trailing end of the lines, which start 20 pt from the list's
 * edge under the Preferences window. Measured: the list's vibrant surface there, #2b2d30 on
 * average, and the line, black at 6.0% over it in all five rows.
 */
export default function VisualEmptyRowsDark() {
  return (
    <ListView
      aria-label="Conversations"
      count={0}
      rowHeight={64}
      emptyRows="separator"
      selectionMode="none"
      renderRow={renderRow}
      style={
        {
          width: 28,
          height: 320,
          background: "#2b2d30",
          "--mac-list-view-separator": "rgb(0 0 0 / 0.06)",
          "--mac-list-view-separator-inset": "0px",
        } as CSSProperties
      }
    />
  );
}
