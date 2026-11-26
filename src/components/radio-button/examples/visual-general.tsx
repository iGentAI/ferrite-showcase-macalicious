import { RadioButton, RadioGroup } from "macalicious/radio-button";

/**
 * Visual comparison target: the first two "Show scroll bars" radio buttons of System
 * Preferences > General, on above off, without their titles.
 *
 * Reference crop (2x pixels) x=1474 y=872 w=44 h=88, i.e. 22 x 44 pt, in the Theme-Light and
 * Theme-Dark accent screenshots. The on circle is 3 pt from the crop's left and top edges; the
 * off circle is 20 pt below it: this pane sets its rows 20 pt apart, not the group's 22 pt, so
 * the example overrides the gap. The top of the third circle, "Always", is inside the crop. The dark captures' window background is #303032 because
 * Catalina tints dark windows with the desktop picture; with the graphite accent the tint is
 * off and it is #323232 (see visual-general-graphite).
 */
export default function VisualGeneral() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 22,
        height: 44,
        padding: "3px 0 0 3px",
        overflow: "hidden",
        background: "light-dark(#ececec, #303032)",
      }}
    >
      <RadioGroup defaultValue="automatic" aria-label="Show scroll bars" style={{ gap: 4 }}>
        <RadioButton value="automatic" aria-label="Automatically based on mouse or trackpad" />
        <RadioButton value="scrolling" aria-label="When scrolling" />
        <RadioButton value="always" aria-label="Always" />
      </RadioGroup>
    </div>
  );
}
