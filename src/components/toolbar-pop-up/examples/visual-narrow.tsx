import { PopUpButtonItem } from "macalicious/pop-up-button";
import { ToolbarPopUp } from "macalicious/toolbar-pop-up";

/**
 * Fixture for a pop-up narrower than its title: the title is cut with an ellipsis before the
 * chevron. `toolbar-pop-up.visual.json` checks the pixels it expects.
 *
 * 80 x 26 pt: the button is 76 pt wide, 2 pt from each edge, over the toolbar's gradient.
 */
export default function VisualNarrow() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 80,
        height: 26,
        padding: 2,
        background: "linear-gradient(light-dark(#dbdbdb, #3b3c3d), light-dark(#cecece, #343536))",
      }}
    >
      <ToolbarPopUp defaultValue="long" aria-label="Font" style={{ width: 76 }}>
        <PopUpButtonItem value="long">HHHHHHHHHHHHHHHH</PopUpButtonItem>
        <PopUpButtonItem value="short">H</PopUpButtonItem>
      </ToolbarPopUp>
    </div>
  );
}
