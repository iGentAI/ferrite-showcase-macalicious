import { Label } from "macalicious/label";
import { useState } from "react";
import { ForceQuit } from "../force-quit";

/**
 * Select an application and choose Force Quit, press Return, or double-click a row: the window
 * asks in a sheet before the application leaves the list. Finder is relaunched and stays. The
 * line under the window reports what the window tells its host.
 */
export default function Basic() {
  const [last, setLast] = useState("nothing yet");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <ForceQuit
        defaultApplications={[
          { id: "mail", name: "Mail" },
          { id: "safari", name: "Safari" },
          { id: "preview", name: "Preview", notResponding: true },
          { id: "finder", name: "Finder", relaunches: true },
        ]}
        onForceQuit={(application) =>
          setLast(`${application.relaunches ? "relaunched" : "quit"} ${application.name}`)
        }
      />
      <Label color="secondary" role="status">
        Last force quit: {last}
      </Label>
    </div>
  );
}
