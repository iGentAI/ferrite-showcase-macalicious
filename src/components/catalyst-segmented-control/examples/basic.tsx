import { CatalystSegment, CatalystSegmentedControl } from "macalicious/catalyst-segmented-control";

/** The People and Devices switch of Find My: two segments, the first selected. */
export default function Basic() {
  return (
    <CatalystSegmentedControl aria-label="List" defaultValue="people" style={{ width: 246.5 }}>
      <CatalystSegment value="people">People</CatalystSegment>
      <CatalystSegment value="devices">Devices</CatalystSegment>
    </CatalystSegmentedControl>
  );
}
