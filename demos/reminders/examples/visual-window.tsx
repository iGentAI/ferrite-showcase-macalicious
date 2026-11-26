import { Reminders } from "../reminders";

/**
 * Visual comparison target: the whole Reminders window with the iMac Colors list shown, and
 * room at its right for the info popover, which extends past the window's edge. Reference
 * crop (2x pixels) x=112 y=76 w=2178 h=1248: the 768 x 624 pt frame and the 321 pt beside it,
 * over the capture's transparent margin: matte white in Aqua and black in Dark Aqua, where
 * the popover's translucent material would otherwise show a white page through it.
 */
export default function VisualWindow() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 1089,
        height: 624,
        background: "light-dark(#ffffff, #000000)",
      }}
    >
      <Reminders material="opaque" style={{ position: "absolute", inset: "0 auto 0 0" }} />
    </div>
  );
}
