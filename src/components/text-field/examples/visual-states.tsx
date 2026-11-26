import { TextField } from "macalicious/text-field";

/**
 * Fixture for the states no reference screenshot shows on a plain text field (keyboard focus,
 * disabled, a window that is not key). `text-field.visual.json` puts it into each state with
 * real input and checks the pixels it expects.
 *
 * 316 x 36 pt: 8 pt of page on every side, so the focus ring is inside the capture. The first
 * field's edge is x 8 to 148, the disabled field's x 168 to 308, both y 8 to 28.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 20, padding: 8, lineHeight: 0 }}>
      <TextField id="enabled" aria-label="Enabled" style={{ width: 140 }} />
      <TextField id="disabled" aria-label="Disabled" disabled style={{ width: 140 }} />
    </div>
  );
}
