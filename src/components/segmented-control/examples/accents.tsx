import { ACCENTS } from "macalicious/lib/appearance";
import { Segment, SegmentedControl } from "macalicious/segmented-control";

/** The selected segment follows the accent colour: set `data-accent` on any ancestor. */
export default function Accents() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {ACCENTS.map((accent) => (
        <span key={accent} data-accent={accent}>
          <SegmentedControl aria-label={`Accent ${accent}`} defaultValue={["on"]}>
            <Segment value="on" style={{ textTransform: "capitalize" }}>
              {accent}
            </Segment>
            <Segment value="off">Off</Segment>
          </SegmentedControl>
        </span>
      ))}
    </div>
  );
}
