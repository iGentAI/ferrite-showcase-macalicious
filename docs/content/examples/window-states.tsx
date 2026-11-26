import { PushButton } from "macalicious/push-button";

const WINDOWS = [
  { state: "key", title: "Key window", note: "Receives the keyboard." },
  { state: "main", title: "Main window", note: "In front, while a panel is key." },
  { state: "inactive", title: "Inactive window", note: "Behind another window." },
] as const;

/**
 * The same content in the three window states. The only difference between the three surfaces
 * is `data-window-state` on the surface (and the smaller shadow token of an inactive window);
 * the buttons read the attribute from their ancestor and are not told anything.
 */
export default function WindowStates() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
      {WINDOWS.map(({ state, title, note }) => (
        <section
          key={state}
          aria-label={title}
          data-window-state={state}
          style={{
            width: 220,
            padding: "var(--mac-space-window-margin)",
            borderRadius: "var(--mac-radius-window)",
            background: "var(--mac-color-window-background)",
            boxShadow:
              state === "inactive"
                ? "var(--mac-shadow-window-inactive)"
                : "var(--mac-shadow-window)",
            color: "var(--mac-color-label)",
            font: "var(--mac-font-body)",
          }}
        >
          <p style={{ margin: 0, font: "var(--mac-font-headline)" }}>{title}</p>
          <p style={{ margin: "4px 0 16px", color: "var(--mac-color-label-secondary)" }}>{note}</p>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "var(--mac-space-control-gap)",
            }}
          >
            <PushButton>Cancel</PushButton>
            <PushButton variant="primary">Go</PushButton>
          </div>
        </section>
      ))}
    </div>
  );
}
