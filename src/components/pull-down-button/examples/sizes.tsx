import { MenuItem } from "macalicious/menu-item";
import { PullDownButton } from "macalicious/pull-down-button";
import { SystemImage } from "macalicious/system-image";

/** The three control sizes, and an Action button: an image in place of the title. */
export default function Sizes() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <PullDownButton key={size} size={size} title="Actions">
          <MenuItem>Duplicate</MenuItem>
          <MenuItem>Rename…</MenuItem>
        </PullDownButton>
      ))}
      <PullDownButton image={<SystemImage name="action" />} aria-label="Action">
        <MenuItem>Duplicate</MenuItem>
        <MenuItem>Rename…</MenuItem>
      </PullDownButton>
    </div>
  );
}
