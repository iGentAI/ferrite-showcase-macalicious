import { MapButton } from "macalicious/map-controls";

function LocationGlyph() {
  return (
    <svg viewBox="0 0 15 15" width="15" height="15" aria-hidden="true" focusable="false">
      <path
        d="M12.5 2.5 2.5 6.8 7 8l1.2 4.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Visual comparison target: the button of Find My that shows the current location, a rounded
 * button. Its glyph is a stand-in drawing and is masked in the comparison.
 *
 * Reference crop (2x pixels) x=2141 y=1445 w=78 h=54 in the Aqua capture and x=2097 y=1421 in
 * the Dark Aqua one (39 x 27 pt): the 34.5 x 21 pt button starts 1.8 pt from the left and
 * 1.9 pt from the top. In the screenshots the button lies over the corner of a forest: the 25 pt on
 * the left are park green down to 23.5 pt, the rest is land.
 */
export default function VisualLocate() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 39,
        height: 27,
        padding: "1.9px 0 0 1.8px",
        background:
          "linear-gradient(light-dark(#d7eacc, #253938), light-dark(#d7eacc, #253938)) 0 0 / 25px 23.5px no-repeat light-dark(#f9f5ed, #2b2d2f)",
      }}
    >
      <MapButton variant="rounded" aria-label="Show current location">
        <LocationGlyph />
      </MapButton>
    </div>
  );
}
