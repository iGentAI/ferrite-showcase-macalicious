import { ReferenceDesktop } from "../desktop-reference";

/**
 * The whole screen of the Dark Aqua Desktop and Apple-Menu screenshots, 1680 by 1050 pt, with
 * the capture's clock. The box over its top left corner is the crop of the Apple menu
 * comparison: 235 by 300 pt, the left end of the menu bar and the open menu under it.
 */
export default function VisualDark() {
  return (
    <div style={{ position: "relative", width: 1680, height: 1050 }}>
      <ReferenceDesktop clock="Thu 4:10 PM" />
      <div
        data-crop="apple-menu"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 235,
          height: 300,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
