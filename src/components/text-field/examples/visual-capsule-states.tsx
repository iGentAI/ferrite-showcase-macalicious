import { TextField } from "macalicious/text-field";

/**
 * Visual comparison target: the capsule bezel enabled and disabled, side by side on the fill of
 * Messages' bar (#f0f0f0, Dark Aqua #292929). No capture shows a disabled capsule: the
 * comparisons check that it keeps the capsule's fill and takes the disabled edge of every text
 * field, as the square and rounded bezels do.
 *
 * 308 x 40 pt: each capsule is 140 x 24 pt, 8 pt from the edges and 12 pt apart, so the enabled
 * one spans x 8..148 and the disabled one x 160..300, both y 8..32.
 */
export default function VisualCapsuleStates() {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        boxSizing: "border-box",
        width: 308,
        height: 40,
        padding: 8,
        background: "light-dark(#f0f0f0, #292929)",
      }}
    >
      <TextField bezel="capsule" aria-label="Message" style={{ width: 140 }} />
      <TextField bezel="capsule" aria-label="Message, disabled" disabled style={{ width: 140 }} />
    </div>
  );
}
