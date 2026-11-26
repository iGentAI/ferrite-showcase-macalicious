import { ComboBox, ComboBoxItem } from "macalicious/combo-box";

const FONTS = ["American Typewriter", "Avenir", "Baskerville", "Futura", "Gill Sans", "Helvetica"];

/**
 * A list that follows the text: with `items` and `mode="list"` it opens while typing and
 * shows only the items that contain what was typed. AppKit's combo box does not do this.
 */
export default function Filtering() {
  return (
    <ComboBox aria-label="Font" mode="list" items={FONTS} placeholder="Font">
      {(font) => <ComboBoxItem key={font}>{font}</ComboBoxItem>}
    </ComboBox>
  );
}
