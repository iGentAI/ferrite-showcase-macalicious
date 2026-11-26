import { SafariTab, SafariTabBar } from "macalicious/safari-tab-bar";

const noop = () => {};

/**
 * Visual comparison target: the tab bar of the inactive Safari window behind the Picture in
 * Picture video, in both appearances (the comparison sets the window state).
 *
 * Reference crop (2x pixels) 940 x 25 pt, starting one point inside the 1254 pt window: x=318
 * y=180 in the light capture, x=346 y=154 in the dark one. The crop ends before the shadow of
 * the video, which covers the rest of the bar. Two tabs, the second selected: the first is
 * 626 pt wide and the second 602 pt, which is what centres its title where the capture has it.
 */
export default function VisualInactive() {
  return (
    <div style={{ width: 940, height: 25, overflow: "hidden" }}>
      <SafariTabBar
        aria-label="Tabs"
        defaultValue="video"
        onNewTab={noop}
        style={{ width: 1254, marginLeft: -1 }}
      >
        <SafariTab value="events" style={{ flex: "none", width: 626 }}>
          Relay FM for St. Jude - Events for St. Jude
        </SafariTab>
        <SafariTab value="video" style={{ flex: "none", width: 602 }}>
          Live Unboxing of a Graphite iMac - YouTube
        </SafariTab>
      </SafariTabBar>
    </div>
  );
}
