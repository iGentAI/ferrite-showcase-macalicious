import { Label } from "macalicious/label";
import { useState } from "react";
import { DiskUtility } from "../disk-utility";

/**
 * Select a disk, a container or a volume in the sidebar: the detail pane and the toolbar
 * follow. The line under the window reports the selection to the host.
 */
export default function Basic() {
  const [selected, setSelected] = useState<string | null>("macintosh-ssd");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <DiskUtility
        width="100%"
        height={571}
        style={{ maxWidth: 926 }}
        onSelectionChange={setSelected}
      />
      <Label color="secondary" role="status">
        Selected: {selected ?? "nothing"}
      </Label>
    </div>
  );
}
