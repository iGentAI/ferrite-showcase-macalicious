import { Segment, SegmentedControl } from "macalicious/segmented-control";

/**
 * Visual comparison target: the tab strip of System Preferences, Sound, which AppKit draws as
 * a rounded select-one segmented control with the first segment selected. It is the only
 * screenshot of a selected segment.
 *
 * Reference crop (2x pixels) x=544 y=184 w=472 h=58, i.e. 236 x 29 pt. The strip's edge is at
 * x=553..1008, y=193..232 (228 x 20 pt), so the control's box starts 4 pt from the crop's left
 * and top. The accent fill runs to x=769, white from x=770 to the divider at x=900..901: the
 * segments are 107, 65 and 53 pt with the selected one covering the divider beside it. The
 * strip straddles the top edge of the pane's box, at y=212: window colour above, box fill
 * below. The box is not drawn behind the strip: in Dark Aqua the translucent bezel shows the
 * window colour over its whole height (#636465 from y=196 to y=231), so the first background
 * layer paints the window colour there.
 */
export default function VisualTabs() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 236,
        height: 29,
        padding: "4px 0 0 4px",
        background:
          "linear-gradient(light-dark(#ececec, #2f3031), light-dark(#ececec, #2f3031)) 5px 5px / 227px 19px no-repeat, linear-gradient(light-dark(#ececec, #2f3031) 14px, light-dark(#d5d5d5, #434445) 14px, light-dark(#d5d5d5, #434445) 14.5px, light-dark(#e3e3e3, #363637) 14.5px)",
      }}
    >
      <SegmentedControl aria-label="Sound" distribution="fit" defaultValue={["effects"]}>
        <Segment value="effects" style={{ width: 107 }}>
          Sound Effects
        </Segment>
        <Segment value="output" style={{ width: 65 }}>
          Output
        </Segment>
        <Segment value="input" style={{ width: 53 }}>
          Input
        </Segment>
      </SegmentedControl>
    </div>
  );
}
