import { RadioButton, RadioGroup } from "macalicious/radio-button";

/**
 * Visual comparison target: the horizontal "Voice Feedback" pair of System Preferences > Siri,
 * On (selected) and Off, with their titles, to check the title position.
 *
 * Reference crop (2x pixels) x=945 y=554 w=220 h=44, i.e. 110 x 22 pt, with the first circle
 * 4 pt from the crop's left edge and 3 pt from its top, on a group box (#e3e3e3 in Aqua,
 * #363637 in Dark Aqua). The second circle starts 45 pt after the first: 10 pt after the end of
 * "On" in San Francisco. The example gives the first button that width instead of relying on
 * the gap, so that the circles stay in place when the titles are set in the fallback font.
 */
export default function VisualSiri() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 110,
        height: 22,
        padding: "3px 0 0 4px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <RadioGroup
        orientation="horizontal"
        defaultValue="on"
        aria-label="Voice Feedback"
        style={{ gap: 0 }}
      >
        <RadioButton value="on" style={{ width: 45 }}>
          On
        </RadioButton>
        <RadioButton value="off">Off</RadioButton>
      </RadioGroup>
    </div>
  );
}
