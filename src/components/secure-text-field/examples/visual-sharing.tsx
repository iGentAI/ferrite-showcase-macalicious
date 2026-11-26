import { SecureTextField } from "macalicious/secure-text-field";

/**
 * Visual comparison target: the bezel of a secure text field, at the place and size of the
 * Computer Name text field of System Preferences > Sharing. No screenshot shows a secure field,
 * and AppKit draws its bezel with the text field's cell, so the plain field's crop measures it.
 *
 * Reference crop (2x pixels) x=424 y=198 w=928 h=50: the field's edge is 2.5 pt from the crop's
 * left and top, 459 x 20 pt. The screenshot's text is masked in the comparison.
 */
export default function VisualSharing() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 464,
        height: 25,
        padding: "2.5px 0 0 2.5px",
        lineHeight: 0,
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <SecureTextField aria-label="Password" style={{ width: 459 }} />
    </div>
  );
}
