import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { useState } from "react";

/** Select-one: the value is an array with the one selected segment, as in Base UI. */
export default function Basic() {
  const [view, setView] = useState(["week"]);
  return (
    <SegmentedControl aria-label="Calendar view" value={view} onValueChange={setView}>
      <Segment value="day">Day</Segment>
      <Segment value="week">Week</Segment>
      <Segment value="month">Month</Segment>
      <Segment value="year">Year</Segment>
    </SegmentedControl>
  );
}
