import { LockButton } from "macalicious/lock-button";
import { useEffect, useState } from "react";

/**
 * The lock only shows a state; the application decides what unlocks it. This sketch stands in
 * for the password dialog with a one-second wait. While locked, the setting it guards is
 * disabled.
 */
export default function Authorization() {
  const [state, setState] = useState<"locked" | "authenticating" | "unlocked">("locked");

  useEffect(() => {
    if (state !== "authenticating") return;
    const timer = setTimeout(() => setState("unlocked"), 1000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div style={{ display: "grid", gap: 16, font: "var(--mac-font-body)" }}>
      <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" disabled={state !== "unlocked"} />
        Set date and time automatically
      </label>
      <LockButton
        state={state}
        onClick={() => setState(state === "locked" ? "authenticating" : "locked")}
      />
    </div>
  );
}
