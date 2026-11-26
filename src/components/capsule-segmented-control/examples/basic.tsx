import { CapsuleSegment, CapsuleSegmentedControl } from "macalicious/capsule-segmented-control";

export default function Basic() {
  return (
    <CapsuleSegmentedControl aria-label="Card" defaultValue={["info"]} style={{ width: 215 }}>
      <CapsuleSegment value="info">Info</CapsuleSegment>
      <CapsuleSegment value="picture">Picture</CapsuleSegment>
    </CapsuleSegmentedControl>
  );
}
