import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";

const noop = () => {};

/**
 * Visual comparison target: the tab bar of the Finder Home window, Dark Aqua.
 *
 * Reference crop (2x pixels) x=114 y=186 w=2144 h=50, i.e. 1072 x 25 pt. The window is
 * 1074 pt wide and its inner border covers the first and the last point of the bar, so the
 * bar is shifted by one point and clipped by the frame.
 *
 * The capture caught the tabs at 361, 349 and 338 pt (the component lays tabs out at equal
 * widths), so the widths are pinned to the screenshot's.
 */
export default function VisualFinderHomeDark() {
  return (
    <div style={{ width: 1072, height: 25, overflow: "hidden" }}>
      <WindowTabBar
        aria-label="Folders"
        defaultValue="shackett"
        onNewTab={noop}
        style={{ width: 1074, marginLeft: -1 }}
      >
        <WindowTab value="recents" style={{ flex: "none", width: 361 }}>
          Recents
        </WindowTab>
        <WindowTab value="shackett" style={{ flex: "none", width: 349 }}>
          shackett
        </WindowTab>
        <WindowTab value="documents" style={{ flex: "none", width: 338 }}>
          Documents
        </WindowTab>
      </WindowTabBar>
    </div>
  );
}
