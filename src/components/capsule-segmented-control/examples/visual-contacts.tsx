import { CapsuleSegment, CapsuleSegmentedControl } from "macalicious/capsule-segmented-control";

/**
 * Visual comparison target: the Info / Picture control of a Contacts card being edited.
 *
 * Reference crop (2x pixels) x=1160 y=236 w=450 h=60, that is 225 x 30 pt of the card (#ffffff;
 * the Dark Aqua card is #1e1f20, where no capture shows the control). The control is 215 x 20 pt,
 * 5 pt from the crop's left and top (outline x 1170..1599, y 246..285), with Info selected.
 */
export default function VisualContacts() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 225,
        height: 30,
        padding: 5,
        lineHeight: 0,
        background: "light-dark(#ffffff, #1e1f20)",
      }}
    >
      <CapsuleSegmentedControl aria-label="Card" defaultValue={["info"]} style={{ width: 215 }}>
        <CapsuleSegment value="info">Info</CapsuleSegment>
        <CapsuleSegment value="picture">Picture</CapsuleSegment>
      </CapsuleSegmentedControl>
    </div>
  );
}
