import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

/**
 * Visual comparison target: the "Sidebar icon size" pop-up button of the General preference
 * pane in Dark Aqua, where the pane lays it out 8 pt wider than in Aqua.
 *
 * Reference crop (2x pixels) x=604 y=468 w=332 h=60, i.e. 166 x 30 pt. The bezel's outline is at
 * x 613 to 926 and y 477 to 516, so its alignment box is 158 pt wide and starts 4 pt from the
 * crop's left edge and 4 pt from its top.
 */
export default function VisualGeneralDark() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 166,
        height: 30,
        padding: "4px 0 0 4px",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <PopUpButton defaultValue="medium" aria-label="Sidebar icon size" style={{ width: 158 }}>
        <PopUpButtonItem value="small">Small</PopUpButtonItem>
        <PopUpButtonItem value="medium">Medium</PopUpButtonItem>
        <PopUpButtonItem value="large">Large</PopUpButtonItem>
      </PopUpButton>
    </div>
  );
}
