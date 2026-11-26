import { Stepper } from "macalicious/stepper";

/**
 * Visual comparison target: the disabled stepper beside the date field of the Date & Time
 * preference pane (the pane is locked to "Set date and time automatically").
 *
 * Reference crop (2x pixels) x=634 y=388 w=38 h=58, that is 19 x 29 pt. The bezel's outline
 * runs x 641 to 664 and y 395 to 436: the same place in the crop as in `visual-pane`.
 */
export default function VisualPaneDisabled() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 19,
        height: 29,
        padding: "3px 0 0 3px",
        lineHeight: 0,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <Stepper aria-label="Date" disabled />
    </div>
  );
}
