import { ComboBox, ComboBoxItem } from "macalicious/combo-box";

/**
 * Fixture for the states no reference screenshot shows (at rest without the keyboard, the
 * focus ring around the button, a pressed button, a window that is not key).
 * `combo-box.visual.json` puts it into each state with real input and checks the pixels it
 * expects.
 *
 * 316 x 36 pt: 8 pt of page on every side, so the focus ring is inside the capture. The first
 * control's edge is x 8 to 148, the disabled one's x 168 to 308, both y 8 to 28; the buttons
 * are the last 17.5 pt of each, x 130.5 to 148 and x 290.5 to 308.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 20, padding: 8, lineHeight: 0 }}>
      <ComboBox id="enabled" aria-label="Enabled" style={{ width: 140 }}>
        <ComboBoxItem>One</ComboBoxItem>
        <ComboBoxItem>Two</ComboBoxItem>
      </ComboBox>
      <ComboBox id="disabled" aria-label="Disabled" disabled style={{ width: 140 }}>
        <ComboBoxItem>One</ComboBoxItem>
      </ComboBox>
    </div>
  );
}
