import { Label } from "macalicious/label";
import { useState } from "react";
import { Automator } from "../automator";

/**
 * Pick a category, type in the search field, double-click an action to add it to the
 * workflow, then Run. The line under the window stands for the host: it is told of the
 * workflow's steps, and Media asks it for a media browser.
 */
export default function Basic() {
  const [status, setStatus] = useState("Double-click an action to add it to the workflow.");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <Automator
        width="100%"
        height={620}
        style={{ maxWidth: 1000 }}
        onWorkflowChange={(ids) =>
          setStatus(
            ids.length === 0
              ? "The workflow is empty."
              : `The workflow has ${ids.length} ${ids.length === 1 ? "step" : "steps"}: ${ids.join(", ")}.`,
          )
        }
        onShowMedia={() => setStatus("Media: the host would open its media browser.")}
      />
      <Label color="secondary" role="status">
        {status}
      </Label>
    </div>
  );
}
