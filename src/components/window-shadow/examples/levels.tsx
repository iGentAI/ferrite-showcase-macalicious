import { WindowShadow } from "macalicious/window-shadow";

const surface = {
  width: 120,
  height: 72,
  display: "grid",
  placeItems: "center",
  background: "var(--mac-color-window-background)",
  font: "var(--mac-font-control-small)",
} as const;

const levels = ["window", "panel", "menu", "popover", "banner", "none"] as const;

/** Every level, and the window level in an inactive window. */
export default function Levels() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 56, padding: "24px 48px 72px" }}>
      {levels.map((level) => (
        <WindowShadow key={level} level={level} style={surface}>
          {level}
        </WindowShadow>
      ))}
      <WindowShadow data-window-state="inactive" style={surface}>
        window, inactive
      </WindowShadow>
    </div>
  );
}
