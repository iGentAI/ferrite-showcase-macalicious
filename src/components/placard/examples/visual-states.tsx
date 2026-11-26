import { Placard, PlacardButton } from "macalicious/placard";

/**
 * Fixture for the pixel checks in `placard.visual.json`: no screenshot shows a placard, so the
 * checks hold it to the values the spec infers.
 *
 * A 200 x 60 pt box of the window background. The regular placard is 120 x 15 pt at 10, 10: a
 * 50 pt button from x 10, then a second one after a hairline at x 60, and the strip's trailing
 * hairline at x 129.5. The small placard is 80 x 11 pt at 10, 35.
 */
export default function VisualStates() {
  return (
    <div style={{ position: "relative", width: 200, height: 60 }}>
      <Placard aria-label="View" style={{ position: "absolute", left: 10, top: 10, width: 120 }}>
        <PlacardButton popUp style={{ width: 50 }}>
          100%
        </PlacardButton>
        <PlacardButton style={{ flex: 1 }}>Fit</PlacardButton>
      </Placard>
      <Placard
        size="small"
        aria-label="Small view"
        style={{ position: "absolute", left: 10, top: 35, width: 80 }}
      >
        <PlacardButton popUp style={{ flex: 1 }}>
          100%
        </PlacardButton>
      </Placard>
    </div>
  );
}
