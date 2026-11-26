import { Dock, DockItem } from "macalicious/dock";

/**
 * State check (no reference screenshot): the Dock on the left edge of a 120 by 170 pt
 * desktop of a flat mid grey, with two tiles, the first a running application.
 */
export default function VisualLeft() {
  return (
    <div style={{ position: "relative", width: 120, height: 170, background: "#808080" }}>
      <Dock position="left">
        {["Files", "Mail"].map((label) => (
          <DockItem
            key={label}
            label={label}
            running={label === "Files"}
            icon={
              <span style={{ width: 52, height: 52, borderRadius: 12, background: "#3366cc" }} />
            }
          />
        ))}
      </Dock>
    </div>
  );
}
