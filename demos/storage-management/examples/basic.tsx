import { Label } from "macalicious/label";
import { useState } from "react";
import { StorageManagement } from "../storage-management";

/**
 * Press a recommendation's button, or select a category and delete one of its files: its size
 * in the sidebar and the free space in the title follow. The line under the window reports
 * what the window tells its host.
 */
export default function Basic() {
  const [selected, setSelected] = useState("recommendations");
  const [last, setLast] = useState("nothing yet");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <StorageManagement
        material="opaque"
        width="100%"
        height={532}
        style={{ maxWidth: 801 }}
        selectedId={selected}
        onSelectedIdChange={setSelected}
        onRecommendation={(id) => setLast(`recommendation ${id}`)}
        onDelete={(file, category) => setLast(`deleted ${file.name} from ${category}`)}
      />
      <Label color="secondary" role="status">
        Selected: {selected}. Last report: {last}.
      </Label>
    </div>
  );
}
