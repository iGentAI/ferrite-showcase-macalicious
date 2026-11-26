import { Label } from "macalicious/label";

const row = (top: number) =>
  ({ position: "absolute", top, left: 0, width: 58.5, whiteSpace: "nowrap" }) as const;
const value = (top: number) => ({ position: "absolute", top, left: 67 }) as const;

/**
 * Visual comparison target: the printer details of System Preferences > Printers & Scanners.
 *
 * Reference crop (2x pixels) x=720 y=450 w=220 h=130, i.e. 110 x 65 pt on the pane's box. The
 * form labels are 11 pt bold in the tertiary label colour, right-aligned, on a 22 pt pitch;
 * the values are 11 pt regular. The Kind value runs past the crop and is clipped.
 */
export default function VisualPrinterDetails() {
  return (
    <div
      style={{
        position: "relative",
        width: 110,
        height: 65,
        overflow: "hidden",
        background: "light-dark(#e2e2e2, #363637)",
      }}
    >
      <Label textStyle="small-emphasized" color="tertiary" align="end" style={row(3.5)}>
        Location:
      </Label>
      <Label textStyle="small" style={value(3.5)}>
        Castle
      </Label>
      <Label textStyle="small-emphasized" color="tertiary" align="end" style={row(25.5)}>
        Kind:
      </Label>
      <Label textStyle="small" style={{ ...value(25.5), whiteSpace: "nowrap" }}>
        Printopia-D1FBAAFB-AirPrint
      </Label>
      <Label textStyle="small-emphasized" color="tertiary" align="end" style={row(47.5)}>
        Status:
      </Label>
      <Label textStyle="small" style={value(47.5)}>
        Idle
      </Label>
    </div>
  );
}
