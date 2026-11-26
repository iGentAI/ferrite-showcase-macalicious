import { Dictation } from "macalicious/dictation";

const cell = { display: "grid", gap: 8, justifyItems: "center" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * The level, the three pointer settings and the two transient states of Done, which this
 * gallery pins with the `data-force` preview attribute.
 */
export default function States() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, max-content)",
        gap: "20px 36px",
        padding: 16,
      }}
    >
      <div style={cell}>
        <Dictation aria-label="Dictation, silent" />
        <span style={caption}>Level 0</span>
      </div>
      <div style={cell}>
        <Dictation aria-label="Dictation, half level" level={0.5} />
        <span style={caption}>Level 0.5</span>
      </div>
      <div style={cell}>
        <Dictation aria-label="Dictation, full level" level={1} />
        <span style={caption}>Level 1</span>
      </div>
      <div style={cell}>
        <Dictation aria-label="Dictation, pointer left" pointer="left" level={0.25} />
        <span style={caption}>Pointer left</span>
      </div>
      <div style={cell}>
        <Dictation aria-label="Dictation, no pointer" pointer="none" level={0.25} />
        <span style={caption}>No pointer</span>
      </div>
      <div style={cell}>
        <Dictation aria-label="Dictation, Done pressed" data-force="pressed" level={0.25} />
        <span style={caption}>Done pressed</span>
      </div>
      <div style={cell}>
        <Dictation aria-label="Dictation, Done focused" data-force="focus" level={0.25} />
        <span style={caption}>Keyboard focus</span>
      </div>
      <div style={cell} data-window-state="inactive">
        <Dictation aria-label="Dictation, inactive window" data-force="focus" level={0.25} />
        <span style={caption}>Inactive window</span>
      </div>
    </div>
  );
}
