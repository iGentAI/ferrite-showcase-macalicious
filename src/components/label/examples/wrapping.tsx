import { Label } from "macalicious/label";

/** One line, ending with an ellipsis, and a wrapping paragraph. */
export default function Wrapping() {
  return (
    <div style={{ display: "grid", gap: 8, width: 240 }}>
      <Label truncate title="Printopia-D1FBAAFB-AirPrint on the second floor">
        Printopia-D1FBAAFB-AirPrint on the second floor
      </Label>
      <Label textStyle="small" color="secondary" render={<p />}>
        Banners and alerts will be hidden and notification sounds will be silenced.
      </Label>
    </div>
  );
}
