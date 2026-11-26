import { SecureTextField } from "macalicious/secure-text-field";

/**
 * Fixture for the pixel checks in `secure-text-field.visual.json`: no screenshot shows a
 * standard secure text field, so the checks hold it to the values the spec infers from the
 * text field.
 *
 * 316 x 36 pt: 8 pt of page on every side. The first field's edge is x 8 to 148, the disabled
 * field's x 168 to 308, both y 8 to 28.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 20, padding: 8, lineHeight: 0 }}>
      <SecureTextField id="enabled" aria-label="Enabled" style={{ width: 140 }} />
      <SecureTextField id="disabled" aria-label="Disabled" disabled style={{ width: 140 }} />
    </div>
  );
}
