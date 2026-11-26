import { LevelIndicator } from "macalicious/level-indicator";

const cell = { display: "grid", gap: 6 } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/**
 * Warning and critical levels. In the top row high values are the problem (a disk that fills
 * up); in the middle row the critical value is below the warning value, so low values are (a
 * battery that runs down). The bottom row is tiered: each part of the fill keeps the colour of
 * the level it lies in.
 */
export default function Levels() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 140px)", gap: "16px 20px" }}>
      {[40, 75, 95].map((value) => (
        <div key={value} style={cell}>
          <span style={caption}>Disk, {value}% used</span>
          <LevelIndicator
            value={value}
            warningValue={70}
            criticalValue={90}
            aria-label={`Disk, ${value} percent used`}
          />
        </div>
      ))}
      {[8, 3, 1].map((value) => (
        <div key={value} style={cell}>
          <span style={caption}>Battery, {value} of 10</span>
          <LevelIndicator
            variant="discrete"
            value={value}
            max={10}
            warningValue={3}
            criticalValue={1}
            aria-label={`Battery, ${value} of 10`}
          />
        </div>
      ))}
      <div style={cell}>
        <span style={caption}>Tiered, 95% used</span>
        <LevelIndicator
          tiered
          value={95}
          warningValue={70}
          criticalValue={90}
          aria-label="Disk, 95 percent used, tiered"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Tiered, 10 of 10</span>
        <LevelIndicator
          variant="discrete"
          tiered
          value={10}
          max={10}
          warningValue={7}
          criticalValue={9}
          aria-label="Signal, 10 of 10, tiered"
        />
      </div>
      <div style={cell}>
        <span style={caption}>Tiered battery, 8 of 10</span>
        <LevelIndicator
          variant="discrete"
          tiered
          value={8}
          max={10}
          warningValue={3}
          criticalValue={1}
          aria-label="Battery, 8 of 10, tiered"
        />
      </div>
    </div>
  );
}
