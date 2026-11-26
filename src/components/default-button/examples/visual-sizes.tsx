import { DefaultButton } from "macalicious/default-button";

/**
 * Fixture for the small and mini sizes, which no reference screenshot shows on a default
 * button. `default-button.visual.json` checks that each keeps the accent bezel at its own
 * height.
 *
 * 148 x 34 pt: 8 pt of page on every side. The small button's box is x 8 to 68 and y 8 to 26
 * (a 17 pt bezel), the mini one's x 80 to 140 and y 8 to 23 (a 14 pt bezel).
 */
export default function VisualSizes() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 8, height: 18 }}>
      <DefaultButton size="small" style={{ width: 60 }}>
        Go
      </DefaultButton>
      <DefaultButton size="mini" style={{ width: 60 }}>
        Go
      </DefaultButton>
    </div>
  );
}
