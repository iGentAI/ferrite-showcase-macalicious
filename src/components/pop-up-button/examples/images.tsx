import { PopUpButton, PopUpButtonItem, PopUpButtonSeparator } from "macalicious/pop-up-button";

const chip = (color: string) => (
  <span
    style={{
      boxSizing: "border-box",
      width: 24,
      height: 12,
      border: "0.5px solid rgb(0 0 0 / 0.25)",
      background: color,
    }}
  />
);

/**
 * Items with an image: here the colour chips of the Highlight color pop-up button of the
 * General preference pane. The selected item's image is shown in the button as well.
 */
export default function Images() {
  return (
    <PopUpButton defaultValue="blue" aria-label="Highlight color" style={{ width: 150 }}>
      <PopUpButtonItem value="blue" image={chip("#b3d6ff")}>
        Blue
      </PopUpButtonItem>
      <PopUpButtonItem value="purple" image={chip("#dfc5df")}>
        Purple
      </PopUpButtonItem>
      <PopUpButtonItem value="green" image={chip("#c1ebb2")}>
        Green
      </PopUpButtonItem>
      <PopUpButtonSeparator />
      <PopUpButtonItem value="other" disabled>
        Other…
      </PopUpButtonItem>
    </PopUpButton>
  );
}
