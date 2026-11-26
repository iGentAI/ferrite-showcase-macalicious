import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

/**
 * Visual comparison target: the disabled "Change picture" pop-up button of the Desktop & Screen
 * Saver preference pane, inside a box (#e3e3e3 in Aqua, #363637 in Dark Aqua).
 *
 * Reference crop (2x pixels) x=766 y=1030 w=432 h=60, i.e. 216 x 30 pt. The bezel's edges are at
 * x 775 to 1188 and y 1039 to 1078, so its alignment box is 208 pt wide and starts 4 pt from the
 * crop's left edge and 4 pt from its top.
 */
export default function VisualDisabled() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 216,
        height: 30,
        padding: "4px 0 0 4px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <PopUpButton disabled defaultValue="30" aria-label="Change picture" style={{ width: 208 }}>
        <PopUpButtonItem value="30">Every 30 minutes</PopUpButtonItem>
        <PopUpButtonItem value="60">Every hour</PopUpButtonItem>
      </PopUpButton>
    </div>
  );
}
