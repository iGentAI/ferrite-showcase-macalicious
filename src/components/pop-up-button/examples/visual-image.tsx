import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

const chip = <span style={{ width: 24, height: 12, background: "#b3d6ff" }} />;

/**
 * Fixture for a button that shows its item's image: a colour chip as in the Highlight color
 * pop-up button of the General preference pane, here without an edge of its own so that its
 * first pixel is its colour.
 *
 * 166 x 37 pt, 8 pt of page on every side. The button's box is x 8 to 158 and y 8 to 29. The
 * chip starts 8.5 pt from the box's edge, a point before the title's text would: x 16.5 to
 * 40.5, y 12.5 to 24.5.
 */
export default function VisualImage() {
  return (
    <div style={{ display: "flex", padding: 8 }}>
      <PopUpButton defaultValue="blue" aria-label="Highlight color" style={{ width: 150 }}>
        <PopUpButtonItem value="blue" image={chip}>
          Blue
        </PopUpButtonItem>
        <PopUpButtonItem value="purple">Purple</PopUpButtonItem>
      </PopUpButton>
    </div>
  );
}
