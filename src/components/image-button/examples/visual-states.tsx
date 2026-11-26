import { ImageButton } from "macalicious/image-button";

function Block() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
      <path d="M0 0h32v32H0z" fill="#6aa6d8" />
    </svg>
  );
}

/**
 * Fixture for the states no reference screenshot shows (pressed, keyboard focus, disabled, a
 * window that is not key). `image-button.visual.json` puts it into each state with real input
 * and checks the pixels the spec expects.
 *
 * 112 x 58 pt: 8 pt of page on every side. Two image-only buttons, each a 32 pt block of one
 * colour (#6aa6d8) inside 5 pt of clear space: the first image is x 13 to 45, the disabled one
 * x 67 to 99, both y 13 to 45.
 */
export default function VisualStates() {
  return (
    <div style={{ display: "flex", gap: 12, padding: 8 }}>
      <ImageButton id="image" aria-label="Block">
        <Block />
      </ImageButton>
      <ImageButton aria-label="Block, disabled" disabled>
        <Block />
      </ImageButton>
    </div>
  );
}
