import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";

const noop = () => {};

/**
 * Fixture for the states no reference screenshot shows (pointer over a tab, keyboard focus,
 * an inactive window), to put into each state by hand or from a script with real input.
 * `window-tab-bar.visual.json` does not compare it: its four comparisons are of the Finder
 * Home bar, and these states are provisional.
 *
 * 400 x 25 pt. The selected tab is x 0 to 187.5, the divider x 187.5 to 188.5, the second tab
 * x 188.5 to 376 and the new-tab cell x 376 to 400. Both titles are centred in their tabs, so
 * the pixels are read near the tabs' leading edges.
 */
export default function VisualStateTabs() {
  return (
    <WindowTabBar aria-label="Folders" defaultValue="one" onNewTab={noop} style={{ width: 400 }}>
      <WindowTab id="one" value="one">
        One
      </WindowTab>
      <WindowTab id="two" value="two">
        Two
      </WindowTab>
    </WindowTabBar>
  );
}
