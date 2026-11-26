import { SafariTab, SafariTabBar } from "macalicious/safari-tab-bar";

const noop = () => {};

/**
 * Fixture for the states no reference screenshot shows (pointer over a tab, keyboard focus,
 * the pressed new-tab button, forced colours). `safari-tab-bar.visual.json` puts it into each
 * state with real input and checks the pixels it expects.
 *
 * 400 x 25 pt. The selected tab is x 0 to 187, the divider x 187 to 188, the second tab x 188
 * to 375, the divider x 375 to 376 and the new-tab cell x 376 to 400. Both titles are centred
 * in their tabs, so the pixels are read near the tabs' leading edges.
 */
export default function VisualStateTabs() {
  return (
    <SafariTabBar aria-label="Tabs" defaultValue="one" onNewTab={noop} style={{ width: 400 }}>
      <SafariTab id="one" value="one">
        One
      </SafariTab>
      <SafariTab id="two" value="two">
        Two
      </SafariTab>
    </SafariTabBar>
  );
}
