import { Label } from "macalicious/label";
import { useState } from "react";
import { NetworkUtility } from "../network-utility";

/**
 * The window opened on a tool: enter an address and press Return or the button. The line
 * under the window reports what `onRun` was called with.
 */
export default function Tools() {
  const [last, setLast] = useState("No tool has run yet.");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <NetworkUtility
        defaultTab="ping"
        onRun={(tool, input, output) =>
          setLast(`${tool} ran for “${input}” and printed ${output.split("\n").length} lines.`)
        }
      />
      <Label color="secondary" role="status">
        {last}
      </Label>
    </div>
  );
}
