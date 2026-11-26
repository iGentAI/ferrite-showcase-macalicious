import { PageControl } from "macalicious/page-control";

/**
 * Visual comparison target: Launchpad's page dots, first of two pages current. Reference crop
 * (2x pixels) x=1642 y=1820 w=72 h=32, i.e. 36 x 16 pt, with the 28 x 8 pt row of dots 4 pt
 * from the left and from the top. Behind the dots Launchpad shows the blurred desktop picture;
 * the example paints the crop's average colour instead, so the backdrop differs by a few
 * levels across the crop.
 */
export default function VisualLaunchpad() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 36,
        height: 16,
        padding: "4px 0 0 4px",
        background: "light-dark(#1a2b3a, #111c2c)",
      }}
    >
      <PageControl
        variant="overlay"
        count={2}
        page={0}
        aria-label="Launchpad pages"
        style={{ display: "flex", height: 8 }}
      />
    </div>
  );
}
