import { Label } from "macalicious/label";
import { useState } from "react";
import { CatalinaLaunchpad } from "../launchpad";

/**
 * The stage with its Dock. Click Launchpad, the second tile, to show Launchpad over the
 * desktop; type to search, use the page dots or the arrow keys, open the folder "Other", and
 * choose an application. The line under the stage reports what the demo tells its host.
 */
export default function Basic() {
  const [last, setLast] = useState("nothing yet");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <CatalinaLaunchpad onLaunch={(app) => setLast(app.name)} />
      <Label color="secondary" role="status">
        Last launched: {last}
      </Label>
    </div>
  );
}
