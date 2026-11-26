import { Label } from "macalicious/label";
import { useState } from "react";
import { SystemInformation } from "../system-information";

/**
 * Select a category in the outline, collapse a group with its triangle, and open Software >
 * Applications for a report that is a sortable table. The line under the window reports what
 * the window tells its host about the selection.
 */
export default function Basic() {
  const [selected, setSelected] = useState("hardware");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <SystemInformation
        width="100%"
        height={520}
        style={{ maxWidth: 751 }}
        selectedId={selected}
        onSelectedIdChange={setSelected}
      />
      <Label color="secondary" role="status">
        Selected category: {selected}
      </Label>
    </div>
  );
}
