import { FullScreenWindow } from "macalicious/full-screen-window";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";

/**
 * Visual comparison target: the revealed bars of the full-screen Photos window, between the
 * title and the trailing toolbar items, where the bar is empty.
 *
 * Reference crop x=1800 y=0 w=700 h=200 (350 x 100 pt) of the Full-Screen-App captures: the
 * menu bar from 0 to 22 pt, the 38 pt title-hidden bar from 22 to 60 pt, the bars' shadow on
 * the content below, and the content, which is blank here. The menu bar is the screen's and
 * shows the desktop picture through its material, so it is masked; its slot here is a flat
 * stand-in. The window is 1680 x 1050 pt and the crop starts 900 pt from its left edge.
 */
export default function VisualRevealed() {
  return (
    <div style={{ position: "relative", width: 350, height: 100, overflow: "hidden" }}>
      <FullScreenWindow
        revealed
        aria-label="Albums"
        width={1680}
        height={1050}
        style={{ position: "absolute", left: -900, top: 0 }}
        menuBar={<div style={{ background: "light-dark(#bfe0f3, #181e33)" }} />}
        titleBar={<TitleBar variant="title-hidden" />}
      >
        <WindowBody style={{ background: "light-dark(#ffffff, #1e1f22)" }} />
      </FullScreenWindow>
    </div>
  );
}
