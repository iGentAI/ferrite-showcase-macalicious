import { AppSwitcher, AppSwitcherItem } from "macalicious/app-switcher";

/**
 * Visual state target: five applications on a screen 300 pt wide, where the row at full size
 * would need 706 pt. The panel keeps 20 pt clear at both sides, so it is 260 pt wide, and the
 * five icons share what its padding and the gaps leave: 38.8 pt each. No screenshot shows it.
 */
export default function VisualCrowded() {
  return (
    <div style={{ position: "relative", width: 300, height: 120, background: "#808080" }}>
      <AppSwitcher defaultOpen>
        {["Notes", "Mail", "Terminal", "Music", "Photos"].map((name) => (
          <AppSwitcherItem
            key={name}
            value={name.toLowerCase()}
            icon={<div style={{ background: "#404040" }} />}
          >
            {name}
          </AppSwitcherItem>
        ))}
      </AppSwitcher>
    </div>
  );
}
