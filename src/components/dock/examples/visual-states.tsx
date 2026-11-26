import { Dock, DockItem } from "macalicious/dock";

/**
 * State checks (no reference screenshot): three tiles on a 260 by 170 pt desktop of a flat
 * mid grey, so that every colour can be computed from the tokens. The first tile is a
 * running application, and the last carries a child, a red square that stands for a badge.
 * The Dock asks for magnification, which the checks run with reduced
 * motion, where it must not move anything.
 */
export default function VisualStates() {
  return (
    <div style={{ position: "relative", width: 260, height: 170, background: "#808080" }}>
      <Dock magnification={96}>
        {["Files", "Mail", "Notes"].map((label) => (
          <DockItem
            key={label}
            label={label}
            running={label === "Files"}
            icon={
              <span style={{ width: 52, height: 52, borderRadius: 12, background: "#3366cc" }} />
            }
          >
            {label === "Notes" ? (
              <span style={{ width: 16, height: 16, background: "#ff0000" }} />
            ) : null}
          </DockItem>
        ))}
      </Dock>
    </div>
  );
}
