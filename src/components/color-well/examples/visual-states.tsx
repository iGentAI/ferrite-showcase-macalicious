import { ColorWell } from "macalicious/color-well";

/**
 * Fixture for the states no reference screenshot shows (active, keyboard focus, a window that
 * is not key, disabled, no bezel) and for the standard well, which is not in a screenshot
 * either. `color-well.visual.json` puts it into each state with real input and checks the
 * pixels it expects.
 *
 * 164 x 39 pt, 8 pt of window background around and between three standard wells of
 * 44 x 23 pt: `#first` at x 8 to 52, a disabled one at x 60 to 104 and one without a bezel at
 * x 112 to 156, all y 8 to 31. The bezel is a 3 pt band, the frame 1 pt, so the colour of the
 * first well starts at x 12, y 12.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: 8,
        background: "light-dark(#ececec, #2f3032)",
      }}
    >
      <ColorWell id="first" aria-label="First" defaultValue="#ff0000" />
      <ColorWell aria-label="Disabled" disabled defaultValue="#ff0000" />
      <ColorWell aria-label="Without a bezel" bordered={false} defaultValue="#ff0000" />
    </div>
  );
}
