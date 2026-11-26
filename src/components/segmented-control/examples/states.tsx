import { Segment, SegmentedControl } from "macalicious/segmented-control";
import type { ReactNode } from "react";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function Pair({
  label,
  first,
  disabled,
  windowState,
}: {
  label: string;
  first?: { "data-force"?: string; disabled?: boolean };
  disabled?: boolean;
  windowState?: string;
}): ReactNode {
  return (
    <div style={cell} data-window-state={windowState}>
      <span style={caption}>{label}</span>
      {(["rounded", "separated"] as const).map((variant) => (
        <SegmentedControl
          key={variant}
          aria-label={`${label}, ${variant}`}
          variant={variant}
          defaultValue={["two"]}
          disabled={disabled}
        >
          <Segment value="one" {...first}>
            One
          </Segment>
          <Segment value="two">Two</Segment>
          <Segment value="three">Three</Segment>
        </SegmentedControl>
      ))}
    </div>
  );
}

/**
 * Every state, in the rounded and the separated style; "Two" is selected throughout. Pressed
 * and focused are transient, so this gallery pins them on "One" with the `data-force` preview
 * attribute.
 */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(2, max-content)", gap: "16px 28px" }}
    >
      <Pair label="Normal and selected" />
      <Pair label="Pressed" first={{ "data-force": "pressed" }} />
      <Pair label="Keyboard focus" first={{ "data-force": "focus" }} />
      <Pair label="One segment disabled" first={{ disabled: true }} />
      <Pair label="Disabled" disabled />
      <Pair label="Main window, not key" windowState="main" />
      <Pair label="Inactive window" windowState="inactive" />
      <Pair
        label="Pressed, inactive window"
        windowState="inactive"
        first={{ "data-force": "pressed" }}
      />
    </div>
  );
}
