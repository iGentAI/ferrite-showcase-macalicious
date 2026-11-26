import { Label } from "macalicious/label";
import { useState } from "react";
import { Console } from "../console";
import { defaultSelectedId } from "../console-data";

/**
 * Pick a source in the sidebar, click a heading to sort, type in the search field, switch the
 * scope, select a row. The line under the window stands for the service that Share hands the
 * selected message to.
 */
export default function Basic() {
  const [shared, setShared] = useState("Select a message and choose a service from Share.");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <Console
        width="100%"
        height={500}
        style={{ maxWidth: 1000 }}
        defaultSelectedId={defaultSelectedId}
        onShare={(message, service) =>
          setShared(`${service}: ${message.process} at ${message.time}, “${message.message}”`)
        }
      />
      <Label color="secondary" role="status">
        {shared}
      </Label>
    </div>
  );
}
