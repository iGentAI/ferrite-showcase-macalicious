import { DesktopStack } from "macalicious/desktop-stack";

/**
 * The closed "Images" stack of the Desktop-Stacks captures, crop 3160,508,140,128: tile centre
 * 34.5 pt from the crop's left edge and 31.5 pt from its top. The backdrop follows the
 * picture there; the label is below the crop; the thumbnail is a flat stand-in for the
 * photograph.
 */
export default function VisualClosed() {
  return (
    <div
      style={{
        position: "relative",
        width: 70,
        height: 64,
        overflow: "hidden",
        background: "linear-gradient(light-dark(#c2dcf0, #13325a), light-dark(#dce3ec, #1c3963))",
      }}
    >
      <DesktopStack
        label="Images"
        thumbnail={<div style={{ background: "#7d8fa3" }} />}
        // Whole points for the layout, the half point as a transform: a browser snaps a
        // layout position to device pixels at 1x and a transform it does not.
        style={{ position: "absolute", left: -24, top: -1, transform: "translate(0.5px, 0.5px)" }}
      />
    </div>
  );
}
