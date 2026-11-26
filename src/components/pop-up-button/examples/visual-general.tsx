import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

/**
 * Visual comparison target: the "Sidebar icon size" pop-up button of the General preference
 * pane in Aqua, a regular pop-up button on the window background.
 *
 * Reference crop (2x pixels) x=604 y=468 w=316 h=60, i.e. 158 x 30 pt. The bezel's edges are at
 * x 613 to 910 and y 477 to 516, so its alignment box is 150 pt wide and starts 4 pt from the
 * crop's left edge and 4 pt from its top.
 */
export default function VisualGeneral() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 158,
        height: 30,
        padding: "4px 0 0 4px",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <PopUpButton defaultValue="medium" aria-label="Sidebar icon size" style={{ width: 150 }}>
        <PopUpButtonItem value="small">Small</PopUpButtonItem>
        <PopUpButtonItem value="medium">Medium</PopUpButtonItem>
        <PopUpButtonItem value="large">Large</PopUpButtonItem>
      </PopUpButton>
    </div>
  );
}
