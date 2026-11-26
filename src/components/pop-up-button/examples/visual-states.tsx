import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

/**
 * Fixture for the states no reference screenshot shows (keyboard focus, a window that is not
 * key, the mini size). `pop-up-button.visual.json` puts it into each state with real input and
 * checks the pixels it expects.
 *
 * 196 x 37 pt: 8 pt of page on every side, so the focus ring is inside the capture. The regular
 * button's box is x 8 to 108 and y 8 to 29; its bezel is inset by half a point and the fill by
 * another half; the cap's fill is x 91.5 to 107.5. The mini button's box is x 120 to 188 and
 * y 8 to 23.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", alignItems: "start", gap: 12, padding: 8 }}>
      <PopUpButton id="size" defaultValue="medium" aria-label="Size" style={{ width: 100 }}>
        <PopUpButtonItem value="small">Small</PopUpButtonItem>
        <PopUpButtonItem value="medium">Medium</PopUpButtonItem>
        <PopUpButtonItem value="large">Large</PopUpButtonItem>
      </PopUpButton>
      <PopUpButton size="mini" defaultValue="a" aria-label="Mini" style={{ width: 68 }}>
        <PopUpButtonItem value="a">Mini</PopUpButtonItem>
      </PopUpButton>
    </div>
  );
}
