import { LockButton } from "macalicious/lock-button";
import { useState } from "react";

/**
 * Fixture for the states no reference screenshot shows (unlocked, pressed, keyboard focus,
 * disabled, a window that is not key). `lock-button.visual.json` puts it into each state with
 * real input and checks pixels of the padlock.
 *
 * 276 x 83 pt: 8 pt of page on every side. Two locks, one above the other: the first padlock's
 * 22 x 27.5 pt box starts at x 8, y 8, the disabled one's at x 8, y 47.5. A click on the first
 * unlocks it. In the locked padlock the left leg of the shackle covers x 11 to 13 from y 16.5
 * down to the body; unlocked, it ends at y 16.
 */
export default function VisualStates() {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
        width: 260,
        padding: 8,
      }}
    >
      <LockButton
        id="lock"
        state={unlocked ? "unlocked" : "locked"}
        onClick={() => setUnlocked(!unlocked)}
      />
      <LockButton disabled />
    </div>
  );
}
