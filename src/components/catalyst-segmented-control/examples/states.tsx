import { CatalystSegment, CatalystSegmentedControl } from "macalicious/catalyst-segmented-control";
import type { CSSProperties } from "react";

const caption: CSSProperties = { font: "var(--mac-font-control-small)" };

/** The states of the control; keyboard focus is pinned for the gallery. */
export default function States() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto",
        gap: "10px 16px",
        alignItems: "center",
        justifyContent: "start",
      }}
    >
      <span style={caption}>Normal</span>
      <CatalystSegmentedControl aria-label="Normal" defaultValue="a" style={{ width: 200 }}>
        <CatalystSegment value="a">People</CatalystSegment>
        <CatalystSegment value="b">Devices</CatalystSegment>
        <CatalystSegment value="c">Items</CatalystSegment>
      </CatalystSegmentedControl>
      <span style={caption}>Keyboard focus</span>
      <CatalystSegmentedControl aria-label="Focused" defaultValue="b" style={{ width: 200 }}>
        <CatalystSegment value="a">People</CatalystSegment>
        <CatalystSegment value="b" data-force="focus">
          Devices
        </CatalystSegment>
        <CatalystSegment value="c">Items</CatalystSegment>
      </CatalystSegmentedControl>
      <span style={caption}>One segment disabled</span>
      <CatalystSegmentedControl
        aria-label="Partly disabled"
        defaultValue="a"
        style={{ width: 200 }}
      >
        <CatalystSegment value="a">People</CatalystSegment>
        <CatalystSegment value="b">Devices</CatalystSegment>
        <CatalystSegment value="c" disabled>
          Items
        </CatalystSegment>
      </CatalystSegmentedControl>
      <span style={caption}>Disabled</span>
      <CatalystSegmentedControl
        aria-label="Disabled"
        defaultValue="a"
        disabled
        style={{ width: 200 }}
      >
        <CatalystSegment value="a">People</CatalystSegment>
        <CatalystSegment value="b">Devices</CatalystSegment>
        <CatalystSegment value="c">Items</CatalystSegment>
      </CatalystSegmentedControl>
    </div>
  );
}
