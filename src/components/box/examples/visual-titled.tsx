import { Box } from "macalicious/box";

/**
 * Visual comparison target: the start of the titled box “Interface Information” in Network
 * Utility, whose window background is itself tinted (#e3e3e3 in Aqua, #363638 in Dark Aqua).
 * Reference crop (2x pixels) x=162 y=336 w=100 h=60, i.e. 50 x 30 pt: the box starts 5 pt from
 * the left and its top edge is 17 pt down; the title's baseline is 3 pt above that edge.
 */
export default function VisualTitled() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 50,
        height: 30,
        background: "light-dark(#e3e3e3, #363638)",
      }}
    >
      <Box
        title="Interface Information"
        style={{ position: "absolute", left: 5, top: 1.5, width: 300, height: 100 }}
      />
    </div>
  );
}
