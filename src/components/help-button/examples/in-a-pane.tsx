import { HelpButton } from "macalicious/help-button";
import { PushButton } from "macalicious/push-button";

/** The foot of a preference pane: a push button, then the help button 12 pt to its right. */
export default function InAPane() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, width: 320 }}>
      <PushButton>Advanced…</PushButton>
      <HelpButton label="Bluetooth help" />
    </div>
  );
}
