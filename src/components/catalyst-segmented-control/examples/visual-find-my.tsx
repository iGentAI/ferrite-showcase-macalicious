import { CatalystSegment, CatalystSegmentedControl } from "macalicious/catalyst-segmented-control";

/**
 * Visual comparison target: the People and Devices switch at the top of Find My's sidebar,
 * 260 x 40 pt from 1 pt inside the window's leading edge and 30 pt under its top edge: the
 * sidebar's fill, the 246.5 x 24.5 pt track 7.5 pt from the window's edge and 7 pt down, the
 * pill of the selected first segment and the two titles.
 *
 * Reference crop (2x pixels) w=520 h=80: x=114 y=136 in the Aqua capture, x=70 y=112 in the
 * Dark Aqua one. The background is the sidebar's colour in those captures.
 */
export default function VisualFindMy() {
  return (
    <div
      style={{
        position: "relative",
        width: 260,
        height: 40,
        background: "light-dark(#f8f7f5, #1f2021)",
      }}
    >
      <CatalystSegmentedControl
        aria-label="List"
        defaultValue="people"
        style={{ position: "absolute", left: 6.5, top: 7, width: 246.5 }}
      >
        <CatalystSegment value="people">People</CatalystSegment>
        <CatalystSegment value="devices">Devices</CatalystSegment>
      </CatalystSegmentedControl>
    </div>
  );
}
