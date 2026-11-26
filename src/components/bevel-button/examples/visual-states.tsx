import { BevelButton, BevelButtonGroup } from "macalicious/bevel-button";

function Square() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M0 0h12v12H0z" fill="currentColor" />
    </svg>
  );
}

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, disabled, a
 * window that is not key) and for the change on a real click. `bevel-button.visual.json` puts
 * it into each state with real input and checks the pixels the spec expects.
 *
 * 154 x 54 pt: 8 pt of page on every side, so the focus ring is inside the capture. Three
 * 38 x 38 pt buttons 12 pt apart: off (x 8 to 46), on (x 58 to 96) and disabled (x 108 to 146),
 * all y 8 to 46 with a 1 pt border. Each holds a 12 pt square at its centre.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", padding: 8 }}>
      <BevelButtonGroup aria-label="Fixture" defaultValue={["on"]}>
        <BevelButton id="off" value="off" aria-label="Off">
          <Square />
        </BevelButton>
        <BevelButton value="on" aria-label="On">
          <Square />
        </BevelButton>
        <BevelButton value="disabled" aria-label="Disabled" disabled>
          <Square />
        </BevelButton>
      </BevelButtonGroup>
    </div>
  );
}
