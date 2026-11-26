import { BorderlessButton } from "macalicious/borderless-button";
import { Label } from "macalicious/label";

/**
 * Visual check target for the states no screenshot shows: one button in a 120 x 40 pt box of
 * the message pane's colour, 12 pt from its top and left, to be pressed and focused with real
 * input. The 6 pt square before the title is drawn in the button's ink (`currentColor`), so
 * that a pixel of it says which colour the button has.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 120,
        height: 40,
        padding: 12,
        background: "light-dark(#ffffff, #1e1f21)",
      }}
    >
      <Label>
        <BorderlessButton color="link" data-button="" style={{ gap: 4 }}>
          <span
            data-ink=""
            style={{ flex: "none", width: 6, height: 6, background: "currentColor" }}
          />
          Details
        </BorderlessButton>
      </Label>
    </div>
  );
}
