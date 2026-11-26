import { Checkbox } from "macalicious/checkbox";

/**
 * Visual comparison target: as visual-general, for the graphite accent in Dark Aqua. Graphite
 * switches off Catalina's wallpaper tinting, so the window background is the untinted #323232.
 */
export default function VisualGeneralGraphite() {
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        alignContent: "start",
        justifyItems: "start",
        boxSizing: "border-box",
        width: 20,
        height: 44,
        padding: "5px 0 0 3px",
        background: "light-dark(#ececec, #323232)",
      }}
    >
      <Checkbox aria-label="Ask to keep changes when closing documents" />
      <Checkbox defaultChecked aria-label="Close windows when quitting an app" />
    </div>
  );
}
