import { CapsuleSegment, CapsuleSegmentedControl } from "macalicious/capsule-segmented-control";

/**
 * Every state side by side. Pressed and keyboard focus are transient, so this gallery pins
 * them with the `data-force` preview attribute.
 */
export default function States() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <CapsuleSegmentedControl aria-label="Selected and normal" defaultValue={["a"]}>
        <CapsuleSegment value="a">Selected</CapsuleSegment>
        <CapsuleSegment value="b">Normal</CapsuleSegment>
      </CapsuleSegmentedControl>
      <CapsuleSegmentedControl aria-label="Pressed and focused" defaultValue={["a"]}>
        <CapsuleSegment value="a">Selected</CapsuleSegment>
        <CapsuleSegment value="b" data-force="pressed">
          Pressed
        </CapsuleSegment>
        <CapsuleSegment value="c" data-force="focus">
          Focused
        </CapsuleSegment>
      </CapsuleSegmentedControl>
      <CapsuleSegmentedControl aria-label="Disabled" defaultValue={["a"]} disabled>
        <CapsuleSegment value="a">Selected</CapsuleSegment>
        <CapsuleSegment value="b">Disabled</CapsuleSegment>
      </CapsuleSegmentedControl>
    </div>
  );
}
