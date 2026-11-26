import { SafariTab, SafariTabBar } from "macalicious/safari-tab-bar";

const noop = () => {};

/**
 * Fixture for the close button, which no reference screenshot shows: two tabs that can be
 * closed. `safari-tab-bar.visual.json` moves the pointer over each and checks the cross.
 *
 * 400 x 25 pt, laid out as `visual-state-tabs`: the selected tab is x 0 to 187 and the second
 * tab x 188 to 375. A close button is the 14 pt square 5 pt inside its tab's leading edge and
 * top; its cross is the 8 pt square in the middle of that, so the two strokes meet 12 pt from
 * the tab's edge and from the top.
 */
export default function VisualStateClosable() {
  return (
    <SafariTabBar aria-label="Tabs" defaultValue="one" onNewTab={noop} style={{ width: 400 }}>
      <SafariTab id="one" value="one" onClose={noop}>
        One
      </SafariTab>
      <SafariTab id="two" value="two" onClose={noop}>
        Two
      </SafariTab>
    </SafariTabBar>
  );
}
