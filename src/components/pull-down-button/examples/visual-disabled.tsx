import { MenuItem } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";

/**
 * Visual comparison target: the disabled "No Devices" pull-down button of the Sidecar
 * preference pane, on the window background: the cap is not tinted.
 *
 * Aqua: the bezel's edges are at x 375 to 576 and y 618 to 657 of the screenshot, a 102 pt box;
 * crop (2x pixels) x=366 y=609 w=220 h=60. Dark Aqua: outline at x 373 to 576, a 103 pt box; crop
 * x=364 y=609 w=222 h=60. The box starts 4 pt from the crop's left and top.
 */
export default function VisualDisabled() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: "calc(110px + 1px * var(--mac-appearance-dark))",
        height: 30,
        padding: "4px 0 0 4px",
        background: "light-dark(#ececec, #303031)",
      }}
    >
      <PullDownButton
        disabled
        title="No Devices"
        style={{ width: "calc(102px + 1px * var(--mac-appearance-dark))" }}
      >
        <MenuItem>Disconnect</MenuItem>
      </PullDownButton>
    </div>
  );
}
