import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

const chip = (
  <span
    style={{
      boxSizing: "border-box",
      width: 24,
      height: 12,
      border: "0.5px solid rgb(0 0 0 / 0.25)",
      background: "var(--mac-highlight)",
    }}
  />
);

/**
 * Visual comparison target: the "Highlight color" pop-up button of the General preference pane
 * in the accent screenshots (Theme-Light-<Accent>, Theme-Dark-<Accent>): a colour chip and a
 * title, and the cap in each of the eight accents. `pop-up-button.visual.json` renders it once
 * per accent and masks the title, which names the accent.
 *
 * Reference crop (2x pixels) x=1470 y=652 w=316 h=60, i.e. 158 x 30 pt. The bezel's edges are at
 * x 1479 to 1776 and y 661 to 700, so its alignment box is 150 pt wide and starts 4 pt from the
 * crop's left edge and 4 pt from its top. The chip starts at x 1496, 8.5 pt from the edge.
 */
export default function VisualAccent() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 158,
        height: 30,
        padding: "4px 0 0 4px",
        background: "light-dark(#ececec, #303032)",
      }}
    >
      <PopUpButton defaultValue="accent" aria-label="Highlight color" style={{ width: 150 }}>
        <PopUpButtonItem value="accent" image={chip}>
          Blue
        </PopUpButtonItem>
        <PopUpButtonItem value="other">Other…</PopUpButtonItem>
      </PopUpButton>
    </div>
  );
}
