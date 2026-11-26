import { ToolbarButton } from "macalicious/toolbar-button";
import { useState } from "react";

/**
 * A disc with a letter cut out of it. The letter is drawn again over the hole and filled with
 * the button's `--mac-toolbar-button-glyph-mark`: nothing while the toggle is off; while it is
 * on and tinted, white in Aqua and still nothing in Dark Aqua, where the hole shows the bezel.
 */
function Info() {
  const letter =
    "M7.5 2.9a1.2 1.2 0 1 0 0 2.4a1.2 1.2 0 0 0 0-2.4zM5.7 6.4v1.1h1v3.1h-1v1.1h3.7v-1.1h-.9V6.4z";
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
      <path d={`M7.5 0a7.5 7.5 0 1 0 0 15a7.5 7.5 0 0 0 0-15z${letter}`} fill="currentColor" />
      <path d={letter} fill="var(--mac-toolbar-button-glyph-mark)" />
    </svg>
  );
}

/**
 * A toggle that shows it is on by its glyph, like Console's Info button: `pressedStyle="tint"`
 * keeps the plain bezel and colours the glyph.
 */
export default function Tint() {
  const [shown, setShown] = useState(true);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <ToolbarButton
        aria-label="Info"
        pressedStyle="tint"
        pressed={shown}
        onPressedChange={setShown}
        style={{ width: 44, padding: 0 }}
      >
        <Info />
      </ToolbarButton>
      <span>The info pane is {shown ? "shown" : "hidden"}.</span>
    </div>
  );
}
