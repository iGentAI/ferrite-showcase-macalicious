import { Label } from "macalicious/label";
import { useState } from "react";
import { ActivityMonitor } from "../activity-monitor";

/**
 * Click a heading to sort, pick a view in the toolbar, type in the search field, select a row
 * and quit it. The line under the window stands for the inspector that Inspect, a double click
 * or Return opens in Activity Monitor.
 */
export default function Basic() {
  const [inspected, setInspected] = useState("Select a process and choose Inspect.");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <ActivityMonitor
        width="100%"
        height={520}
        style={{ maxWidth: 839 }}
        defaultSelectedPid={2026}
        onInspect={(process) =>
          setInspected(
            `${process.name} (${process.pid}): ${process.threads} threads, ${process.ports} ports.`,
          )
        }
      />
      <Label color="secondary" role="status">
        {inspected}
      </Label>
    </div>
  );
}
