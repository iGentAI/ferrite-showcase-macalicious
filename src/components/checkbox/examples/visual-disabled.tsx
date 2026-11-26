import { Checkbox } from "macalicious/checkbox";

/**
 * Visual comparison target: the two disabled checkboxes of System Preferences > Security and
 * Privacy (the pane is locked), off above on, without their titles.
 *
 * Reference crop (2x pixels) x=320 y=400 w=44 h=88, i.e. 22 x 44 pt. The boxes are 4 pt from the
 * crop's left and top edges and 22 pt apart. They sit on a group box, #e3e3e3 in Aqua and
 * #363637 in Dark Aqua.
 */
export default function VisualDisabled() {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        alignContent: "start",
        justifyItems: "start",
        boxSizing: "border-box",
        width: 22,
        height: 44,
        padding: "4px 0 0 4px",
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <Checkbox disabled aria-label="Require password after sleep or screen saver begins" />
      <Checkbox disabled defaultChecked aria-label="Show a message when the screen is locked" />
    </div>
  );
}
