import { Label } from "macalicious/label";

const at = (left: number, top: number) => ({ position: "absolute", left, top }) as const;

/**
 * Visual comparison target: the Status row of System Preferences > Network.
 *
 * Reference crop (2x pixels) x=700 y=300 w=380 h=110, i.e. 190 x 55 pt, on the pane's box
 * (#e3e3e3, dark #353637). "Status:" is a right-aligned 13 pt form label whose colon ends
 * 58.5 pt from the crop's left edge; "Connected" is 13 pt bold; the two lines below are 11 pt on
 * a 14 pt pitch. The capture has a redacted network name after "connected to", so each line is
 * set on its own.
 */
export default function VisualNetworkStatus() {
  return (
    <div
      style={{
        position: "relative",
        width: 190,
        height: 55,
        background: "light-dark(#e3e3e3, #353637)",
      }}
    >
      <Label align="end" style={{ position: "absolute", right: 131, top: 3.5, width: 50 }}>
        Status:
      </Label>
      <Label textStyle="emphasized" style={at(65, 3.5)}>
        Connected
      </Label>
      <Label textStyle="small" style={{ ...at(65, 26), whiteSpace: "pre" }}>
        {"Wi-Fi is connected to\naddress 192.168.7.167."}
      </Label>
    </div>
  );
}
