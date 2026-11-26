import { Segment, SegmentedControl } from "macalicious/segmented-control";

export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <div key={size} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <SegmentedControl aria-label={`View, ${size}`} size={size} defaultValue={["list"]}>
            <Segment value="icons">Icons</Segment>
            <Segment value="list">List</Segment>
            <Segment value="columns">Columns</Segment>
          </SegmentedControl>
          <SegmentedControl
            aria-label={`Sort, ${size}`}
            size={size}
            variant="separated"
            distribution="fit"
            defaultValue={["name"]}
          >
            <Segment value="name">Name</Segment>
            <Segment value="date">Date Modified</Segment>
          </SegmentedControl>
        </div>
      ))}
    </div>
  );
}
