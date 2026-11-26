import { GradientButton, GradientButtonGroup } from "macalicious/gradient-button";
import { useState } from "react";

/** A gradient button that stays on: `aria-pressed` holds the state and draws it. */
export default function ToggleButton() {
  const [on, setOn] = useState(true);
  return (
    <GradientButtonGroup aria-label="View options">
      <GradientButton aria-pressed={on} aria-label="Show hidden items" onClick={() => setOn(!on)}>
        <svg viewBox="0 0 13 11" width="13" height="11" aria-hidden="true" focusable="false">
          <path
            d="M1 5.5C2.6 3 4.4 1.8 6.5 1.8S10.4 3 12 5.5C10.4 8 8.6 9.2 6.5 9.2S2.6 8 1 5.5z"
            fill="none"
            stroke="currentColor"
          />
          <circle cx="6.5" cy="5.5" r="1.8" fill="currentColor" />
        </svg>
      </GradientButton>
      <GradientButton glyph="action" aria-label="More actions" />
    </GradientButtonGroup>
  );
}
