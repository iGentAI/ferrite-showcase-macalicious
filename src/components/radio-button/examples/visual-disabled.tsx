import { RadioButton, RadioGroup } from "macalicious/radio-button";

/**
 * Visual comparison target: the two disabled radio buttons of System Preferences > Security and
 * Privacy (the pane is locked), off above on, without their titles.
 *
 * Reference crop (2x pixels) x=320 y=770 w=48 h=92, i.e. 24 x 46 pt. The circles are 4 pt from
 * the crop's left and top edges and 22 pt apart. They sit on a group box, #e3e3e3 in Aqua and
 * #363637 in Dark Aqua.
 */
export default function VisualDisabled() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 24,
        height: 46,
        padding: "4px 0 0 4px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <RadioGroup disabled defaultValue="anywhere" aria-label="Allow apps downloaded from">
        <RadioButton value="store" aria-label="App Store" />
        <RadioButton value="anywhere" aria-label="App Store and identified developers" />
      </RadioGroup>
    </div>
  );
}
