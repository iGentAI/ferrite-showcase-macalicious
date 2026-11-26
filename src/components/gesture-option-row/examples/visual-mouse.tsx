import { GestureOptionRow } from "macalicious/gesture-option-row";

/**
 * Visual comparison target: the three gestures of the Mouse pane's Point & Click tab.
 *
 * Reference crop (2x pixels) x=162 y=240 w=652 h=320, that is 326 x 160 pt of the tab view's
 * box (#e3e3e3 in Aqua, #363637 in Dark Aqua). The callout is the 311 x 53 pt shape at 5,5;
 * the rows are 50 pt apart from y 6.5; the checkboxes are at 15 and y 24, 74 and 124; titles
 * start at 40.5. Secondary click's second line is a borderless pull-down button in the
 * screenshot, which is another component: plain text stands in and the comparisons mask it.
 */
export default function VisualMouse() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 326,
        height: 160,
        padding: "6.5px 10px 0 5px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <GestureOptionRow
        title="Scroll direction: Natural"
        detail="Content tracks finger movement"
        defaultChecked
        highlighted
      />
      <GestureOptionRow id="secondary" title="Secondary click" detail="Click on right side" />
      <GestureOptionRow title="Smart zoom" detail="Double-tap with one finger" />
    </div>
  );
}
