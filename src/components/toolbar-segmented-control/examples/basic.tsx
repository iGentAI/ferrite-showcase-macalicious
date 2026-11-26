import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";

export default function Basic() {
  return (
    <ToolbarSegmentedControl defaultValue={["week"]} aria-label="Calendar view">
      <ToolbarSegment value="day">Day</ToolbarSegment>
      <ToolbarSegment value="week">Week</ToolbarSegment>
      <ToolbarSegment value="month">Month</ToolbarSegment>
      <ToolbarSegment value="year">Year</ToolbarSegment>
    </ToolbarSegmentedControl>
  );
}
