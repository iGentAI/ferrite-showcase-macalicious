import { SystemImage } from "macalicious/system-image";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

function Glass({ plus = false }: { plus?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" />
      <path
        d={plus ? "M9.5 9.5l3.5 3.5M4 6h4M6 4v4" : "M9.5 9.5l3.5 3.5M4 6h4"}
        stroke="currentColor"
      />
    </svg>
  );
}

/** The three styles and the three tracking modes. */
export default function Variants() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, max-content)",
        gap: "16px 28px",
        padding: 12,
        background: "var(--mac-material-titlebar)",
      }}
    >
      <div style={cell}>
        <span style={caption}>Joined, select one</span>
        <ToolbarSegmentedControl defaultValue={["map"]} aria-label="Map type">
          <ToolbarSegment value="map">Map</ToolbarSegment>
          <ToolbarSegment value="transit">Transit</ToolbarSegment>
          <ToolbarSegment value="satellite">Satellite</ToolbarSegment>
        </ToolbarSegmentedControl>
      </div>
      <div style={cell}>
        <span style={caption}>Joined, select any</span>
        <ToolbarSegmentedControl
          tracking="select-any"
          defaultValue={["bold", "underline"]}
          aria-label="Text style"
        >
          <ToolbarSegment value="bold" aria-label="Bold">
            <b>B</b>
          </ToolbarSegment>
          <ToolbarSegment value="italic" aria-label="Italic">
            <i>I</i>
          </ToolbarSegment>
          <ToolbarSegment value="underline" aria-label="Underline">
            <u>U</u>
          </ToolbarSegment>
        </ToolbarSegmentedControl>
      </div>
      <div style={cell}>
        <span style={caption}>Joined, one segment disabled</span>
        <ToolbarSegmentedControl defaultValue={["day"]} aria-label="Calendar view">
          <ToolbarSegment value="day">Day</ToolbarSegment>
          <ToolbarSegment value="week" disabled>
            Week
          </ToolbarSegment>
          <ToolbarSegment value="month">Month</ToolbarSegment>
        </ToolbarSegmentedControl>
      </div>
      <div style={cell}>
        <span style={caption}>Navigation, momentary</span>
        <ToolbarSegmentedControl variant="navigation" tracking="momentary" aria-label="History">
          <ToolbarSegment aria-label="Back">
            <SystemImage name="go-back" />
          </ToolbarSegment>
          <ToolbarSegment aria-label="Forward" disabled>
            <SystemImage name="go-forward" />
          </ToolbarSegment>
        </ToolbarSegmentedControl>
      </div>
      <div style={cell}>
        <span style={caption}>Separated, momentary</span>
        <ToolbarSegmentedControl variant="separated" tracking="momentary" aria-label="Zoom">
          <ToolbarSegment aria-label="Zoom Out" style={{ width: 38 }}>
            <Glass />
          </ToolbarSegment>
          <ToolbarSegment aria-label="Zoom In" style={{ width: 36 }}>
            <Glass plus />
          </ToolbarSegment>
        </ToolbarSegmentedControl>
      </div>
      <div
        style={{ ...cell, background: "var(--mac-material-titlebar-inactive)" }}
        data-window-state="inactive"
      >
        <span style={caption}>Inactive window</span>
        <ToolbarSegmentedControl defaultValue={["week"]} aria-label="Calendar view">
          <ToolbarSegment value="day">Day</ToolbarSegment>
          <ToolbarSegment value="week">Week</ToolbarSegment>
          <ToolbarSegment value="month">Month</ToolbarSegment>
        </ToolbarSegmentedControl>
      </div>
    </div>
  );
}
