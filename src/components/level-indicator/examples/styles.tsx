import { LevelIndicator } from "macalicious/level-indicator";

const cell = { display: "grid", gap: 6 } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** The five styles. */
export default function Styles() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 200px)", gap: "16px 28px" }}>
      <div style={cell}>
        <span style={caption}>Continuous capacity</span>
        <LevelIndicator value={45} aria-label="Continuous, 45 percent" />
      </div>
      <div style={cell}>
        <span style={caption}>Discrete capacity</span>
        <LevelIndicator variant="discrete" value={6} max={10} aria-label="Discrete, 6 of 10" />
      </div>
      <div style={cell}>
        <span style={caption}>Rating</span>
        <div>
          <LevelIndicator
            variant="rating"
            value={3}
            max={5}
            aria-label="Rating"
            getAriaValueText={(_, value) => `${value} of 5 stars`}
          />
        </div>
      </div>
      <div style={cell}>
        <span style={caption}>Relevancy</span>
        <LevelIndicator
          variant="relevancy"
          value={70}
          aria-label="Relevance"
          style={{ width: 60 }}
        />
      </div>
      <div style={{ ...cell, gridColumn: "1 / -1" }}>
        <span style={caption}>Storage (Disk Utility)</span>
        <LevelIndicator variant="storage" value={31} aria-label="Used space, 31 percent" />
      </div>
    </div>
  );
}
