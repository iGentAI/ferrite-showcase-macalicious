import { BevelButton } from "macalicious/bevel-button";

function Square() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M0 0h12v12H0z" fill="currentColor" />
    </svg>
  );
}

/**
 * Fixture for the rounded variant, which no reference screenshot shows (the Print dialog's
 * buttons are square). `bevel-button.visual.json` checks that its corners are cut and that the
 * rest of the bezel is the measured square one.
 *
 * 54 x 54 pt: 8 pt of page on every side. One 38 x 38 pt button, x and y 8 to 46, with a 1 pt
 * border and the control radius.
 */
export default function VisualRounded() {
  return (
    <div style={{ display: "flex", padding: 8 }}>
      <BevelButton variant="rounded" aria-label="Rounded">
        <Square />
      </BevelButton>
    </div>
  );
}
