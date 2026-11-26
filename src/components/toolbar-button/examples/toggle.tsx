import { SystemImage } from "macalicious/system-image";
import { ToolbarButton } from "macalicious/toolbar-button";
import { useState } from "react";

/** A toggle keeps the dark "on" bezel while it is pressed, like Safari's sidebar button. */
export default function ToggleExample() {
  const [shown, setShown] = useState(true);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <ToolbarButton aria-label="Show Sidebar" pressed={shown} onPressedChange={setShown}>
        <SystemImage name="sidebar" />
      </ToolbarButton>
      <span>The sidebar is {shown ? "shown" : "hidden"}.</span>
    </div>
  );
}
