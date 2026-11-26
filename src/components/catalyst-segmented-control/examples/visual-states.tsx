import { CatalystSegment, CatalystSegmentedControl } from "macalicious/catalyst-segmented-control";

/**
 * Fixture for what no screenshot shows: three segments without titles in a 240 pt control,
 * 10 pt inside a 260 x 45 pt box in the colour of Find My's sidebar. Segments are 80 pt wide.
 */
export default function VisualStates() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-start",
        width: 260,
        height: 45,
        padding: 10,
        background: "light-dark(#f8f7f5, #1f2021)",
      }}
    >
      <CatalystSegmentedControl aria-label="Range" defaultValue="day" style={{ width: 240 }}>
        <CatalystSegment data-segment="day" value="day" aria-label="Day" />
        <CatalystSegment data-segment="week" value="week" aria-label="Week" />
        <CatalystSegment data-segment="month" value="month" aria-label="Month" />
      </CatalystSegmentedControl>
    </div>
  );
}
