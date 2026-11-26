import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { useState } from "react";

/** Controlled: the selected tab lives in the parent. The third tab is disabled. */
export default function Controlled() {
  const [tab, setTab] = useState("firewall");
  return (
    <div style={{ display: "grid", gap: 8, width: 460, font: "var(--mac-font-body)" }}>
      <TabView value={tab} onValueChange={setTab}>
        <TabViewList aria-label="Security & Privacy">
          <TabViewTab value="general">General</TabViewTab>
          <TabViewTab value="filevault">FileVault</TabViewTab>
          <TabViewTab value="firewall">Firewall</TabViewTab>
          <TabViewTab value="privacy" disabled>
            Privacy
          </TabViewTab>
        </TabViewList>
        <TabViewPanel value="general">A login password has been set for this user.</TabViewPanel>
        <TabViewPanel value="filevault">FileVault secures the data on your disk.</TabViewPanel>
        <TabViewPanel value="firewall">Firewall: Off</TabViewPanel>
        <TabViewPanel value="privacy">Privacy</TabViewPanel>
      </TabView>
      <span aria-live="polite">Selected: {tab}</span>
    </div>
  );
}
