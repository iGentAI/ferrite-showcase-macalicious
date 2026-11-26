import { SafariTab, SafariTabBar } from "macalicious/safari-tab-bar";

const noop = () => {};

/**
 * Visual comparison target: the tab bar of the key Safari window, Dark Aqua.
 *
 * Reference crop (2x pixels) x=114 y=152 w=2504 h=50, i.e. 1252 x 25 pt. The window is
 * 1254 pt wide and its edge covers the first and the last point of the bar, so the bar starts
 * one point before the crop and is clipped by the frame. The capture caught the tabs at 421,
 * 409 and 397 pt, so the widths are pinned to the screenshot's.
 */
export default function VisualSafariDark() {
  return (
    <div style={{ width: 1252, height: 25, overflow: "hidden" }}>
      <SafariTabBar
        aria-label="Tabs"
        defaultValue="about"
        onNewTab={noop}
        style={{ width: 1254, marginLeft: -1 }}
      >
        <SafariTab value="google" style={{ flex: "none", width: 421 }}>
          Google
        </SafariTab>
        <SafariTab value="about" style={{ flex: "none", width: 409 }}>
          About – 512 Pixels
        </SafariTab>
        <SafariTab value="relay" style={{ flex: "none", width: 397 }}>
          Relay FM
        </SafariTab>
      </SafariTabBar>
    </div>
  );
}
