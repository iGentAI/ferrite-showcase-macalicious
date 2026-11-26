import { Label } from "macalicious/label";
import { useState } from "react";
import { AboutThisMac } from "../about-this-mac";
import type { AboutThisMacTab } from "../about-this-mac-data";

/**
 * Choose a tab in the title bar, or press a button or a link in a pane. The line under the
 * window reports what the window tells its host: the tab that is shown and the last command.
 */
export default function Basic() {
  const [tab, setTab] = useState<AboutThisMacTab>("overview");
  const [command, setCommand] = useState("none");
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start", overflowX: "auto" }}>
      <AboutThisMac
        tab={tab}
        onTabChange={setTab}
        onSystemReport={() => setCommand("System Report")}
        onSoftwareUpdate={() => setCommand("Software Update")}
        onDisplaysPreferences={() => setCommand("Displays Preferences")}
        onManageStorage={() => setCommand("Manage Storage")}
        onLink={(id) => setCommand(`link ${id}`)}
      />
      <Label color="secondary" role="status">
        Tab: {tab}. Last command: {command}.
      </Label>
    </div>
  );
}
