import { Ruler } from "macalicious/ruler";

/** A decorative ruler with the markers of a new TextEdit document. */
export default function Basic() {
  return (
    <Ruler
      style={{ width: 400 }}
      markers={[
        { type: "first-line-indent", position: 0 },
        { type: "head-indent", position: 0 },
        { type: "left", position: 72 },
        { type: "left", position: 144 },
        { type: "left", position: 216 },
        { type: "left", position: 288 },
        { type: "tail-indent", position: 390 },
      ]}
    />
  );
}
