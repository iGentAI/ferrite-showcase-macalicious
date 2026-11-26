import { PushButton } from "macalicious/push-button";
import { useState } from "react";

const WINDOWS = ["Documents", "Downloads"] as const;

const surface = {
  width: 220,
  padding: "var(--mac-space-window-margin)",
  borderRadius: "var(--mac-radius-window)",
  background: "var(--mac-color-window-background)",
  color: "var(--mac-color-label)",
  font: "var(--mac-font-body)",
} as const;

/**
 * The smallest window manager: one piece of state, the name of the key window. Pressing
 * anywhere in a window makes it key and the other inactive. Only the two `data-window-state`
 * attributes change; no control re-renders because of its own state.
 */
export default function KeyWindow() {
  const [key, setKey] = useState<(typeof WINDOWS)[number]>("Documents");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
      {WINDOWS.map((name) => (
        <section
          key={name}
          aria-label={name}
          data-window-state={name === key ? "key" : "inactive"}
          onPointerDownCapture={() => setKey(name)}
          onFocusCapture={() => setKey(name)}
          style={{
            ...surface,
            boxShadow:
              name === key ? "var(--mac-shadow-window)" : "var(--mac-shadow-window-inactive)",
          }}
        >
          <p style={{ margin: "0 0 16px", font: "var(--mac-font-headline)" }}>{name}</p>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--mac-space-control-gap)",
            }}
          >
            <PushButton>Cancel</PushButton>
            <PushButton variant="primary">Open</PushButton>
          </div>
        </section>
      ))}
    </div>
  );
}
