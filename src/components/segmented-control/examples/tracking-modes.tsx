import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { SystemImage } from "macalicious/system-image";
import { useState } from "react";

const row = { display: "flex", gap: 12, alignItems: "center" } as const;
const caption = {
  width: 76,
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * The three tracking modes. Select-one behaves like radio buttons, select-any like
 * checkboxes, and momentary segments are plain buttons that report clicks.
 */
export default function TrackingModes() {
  const [alignment, setAlignment] = useState(["left"]);
  const [styles, setStyles] = useState(["bold"]);
  const [count, setCount] = useState(3);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={row}>
        <span style={caption}>Select one</span>
        <SegmentedControl aria-label="Alignment" value={alignment} onValueChange={setAlignment}>
          <Segment value="left">Left</Segment>
          <Segment value="center">Center</Segment>
          <Segment value="right">Right</Segment>
        </SegmentedControl>
      </div>
      <div style={row}>
        <span style={caption}>Select any</span>
        <SegmentedControl
          aria-label="Text style"
          trackingMode="select-any"
          value={styles}
          onValueChange={setStyles}
        >
          <Segment value="bold">Bold</Segment>
          <Segment value="italic">Italic</Segment>
          <Segment value="underline">Underline</Segment>
        </SegmentedControl>
      </div>
      <div style={row}>
        <span style={caption}>Momentary</span>
        <SegmentedControl aria-label="Folders" trackingMode="momentary" distribution="fit">
          <Segment
            aria-label="Add folder"
            style={{ width: 24 }}
            onClick={() => setCount(count + 1)}
          >
            <SystemImage name="add" />
          </Segment>
          <Segment
            aria-label="Remove folder"
            style={{ width: 24 }}
            disabled={count === 0}
            onClick={() => setCount(count - 1)}
          >
            <SystemImage name="remove" />
          </Segment>
        </SegmentedControl>
        <span aria-live="polite">{count} folders</span>
      </div>
    </div>
  );
}
