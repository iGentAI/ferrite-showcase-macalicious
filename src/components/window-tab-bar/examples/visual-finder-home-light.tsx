import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";

const noop = () => {};

/**
 * Visual comparison target: the tab bar of the Finder Home window, Aqua.
 *
 * Reference crop (2x pixels) x=114 y=186 w=2206 h=50, i.e. 1103 x 25 pt. The window is
 * 1105 pt wide and its edge highlight covers the first and the last point of the bar, so the
 * bar is shifted by one point and clipped by the frame.
 *
 * The capture caught the tabs at 371, 360 and 348 pt (the component lays tabs out at equal
 * widths), so the widths are pinned to the screenshot's.
 */
export default function VisualFinderHomeLight() {
  return (
    <div style={{ width: 1103, height: 25, overflow: "hidden" }}>
      <WindowTabBar
        aria-label="Folders"
        defaultValue="shackett"
        onNewTab={noop}
        style={{ width: 1105, marginLeft: -1 }}
      >
        <WindowTab value="recents" style={{ flex: "none", width: 371 }}>
          Recents
        </WindowTab>
        <WindowTab value="shackett" style={{ flex: "none", width: 360 }}>
          shackett
        </WindowTab>
        <WindowTab value="documents" style={{ flex: "none", width: 348 }}>
          Documents
        </WindowTab>
      </WindowTabBar>
    </div>
  );
}
