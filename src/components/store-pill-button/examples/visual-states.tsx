import { StorePillButton } from "macalicious/store-pill-button";

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, a window that
 * is not key, the filled variant). `store-pill-button.visual.json` puts it into each state
 * with real input and checks the pixels it expects.
 *
 * 178 x 37 pt on the App Store's page colour: 8 pt of page on every side, so the focus ring is
 * inside the capture. The tinted capsule's box is x 8 to 74, the filled one's x 86 to 170,
 * both y 8 to 29.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: 8,
        background: "light-dark(#ffffff, #1e1f22)",
      }}
    >
      <StorePillButton id="tinted">Get</StorePillButton>
      <StorePillButton id="filled" variant="filled" style={{ width: 84 }}>
        Install
      </StorePillButton>
    </div>
  );
}
