import { PushButton } from "macalicious/push-button";

/**
 * Fixture for the mini size, which no reference screenshot shows: a 60 x 15 pt button and
 * nothing else, so the capture is the button's own box. `push-button.visual.json` checks its
 * size and bezel.
 */
export default function VisualMiniButton() {
  return (
    <PushButton size="mini" style={{ width: 60, display: "flex" }}>
      Mini
    </PushButton>
  );
}
