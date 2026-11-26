import { FullScreenWindow } from "macalicious/full-screen-window";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";

/**
 * Visual comparison target: a full-screen window with the menu bar hidden, its bar at the
 * very top of the screen, where the bar is empty.
 *
 * Reference crop x=1740 y=0 w=300 h=100 (150 x 50 pt) of the Split-Screen-Apps captures: the
 * active tile, 928 pt wide from x=752 pt, between its sidebar button and its address field.
 * The 38 pt bar starts at the top edge, with no menu bar above it and no shadow under it; the
 * 12 pt below are the web page's header, one flat colour in both appearances. The crop starts
 * 118 pt from the tile's left edge.
 */
export default function VisualTop() {
  return (
    <div style={{ position: "relative", width: 150, height: 50, overflow: "hidden" }}>
      <FullScreenWindow
        aria-label="Browser"
        width={928}
        height={1050}
        style={{ position: "absolute", left: -118, top: 0 }}
        menuBar={<div style={{ background: "#808080" }} />}
        titleBar={<TitleBar variant="title-hidden" />}
      >
        <WindowBody style={{ background: "#333f48" }} />
      </FullScreenWindow>
    </div>
  );
}
