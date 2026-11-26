import { SafariTab, SafariTabBar } from "macalicious/safari-tab-bar";

const noop = () => {};

/**
 * Visual comparison target: the tab bar of the key Safari window, Aqua.
 *
 * Reference crop (2x pixels) x=114 y=152 w=2644 h=50, i.e. 1322 x 25 pt. The window is
 * 1324 pt wide and its edge highlight covers the first and the last half point of the bar, so
 * the bar starts one point before the crop and is clipped by the frame.
 *
 * The capture caught the tabs at 445, 432 and 420 pt (the component lays tabs out at equal
 * widths), so the widths are pinned to the screenshot's. The titles are the ones in the
 * screenshot.
 */
export default function VisualSafariLight() {
  return (
    <div style={{ width: 1322, height: 25, overflow: "hidden" }}>
      <SafariTabBar
        aria-label="Tabs"
        defaultValue="about"
        onNewTab={noop}
        style={{ width: 1324, marginLeft: -1 }}
      >
        <SafariTab value="google" style={{ flex: "none", width: 445 }}>
          Google
        </SafariTab>
        <SafariTab value="about" style={{ flex: "none", width: 432 }}>
          About – 512 Pixels
        </SafariTab>
        <SafariTab value="relay" style={{ flex: "none", width: 420 }}>
          Relay FM
        </SafariTab>
      </SafariTabBar>
    </div>
  );
}
