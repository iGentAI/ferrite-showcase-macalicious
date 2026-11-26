import { DesktopStack } from "macalicious/desktop-stack";

/**
 * The open "PDF Documents" stack of the Desktop-Stacks captures, crop 3160,732,140,128: tile
 * centre 34.5 pt from the crop's left edge and 31.5 pt from its top.
 */
export default function VisualOpen() {
  return (
    <div
      style={{
        position: "relative",
        width: 70,
        height: 64,
        overflow: "hidden",
        background: "light-dark(#87a5bc, #1d3c62)",
      }}
    >
      <DesktopStack
        label="PDF Documents"
        defaultOpen
        // Whole points for the layout, the half point as a transform: a browser snaps a
        // layout position to device pixels at 1x and a transform it does not.
        style={{ position: "absolute", left: -24, top: -1, transform: "translate(0.5px, 0.5px)" }}
      />
    </div>
  );
}
