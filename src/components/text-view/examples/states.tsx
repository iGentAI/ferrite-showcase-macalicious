import { TextView } from "macalicious/text-view";

const cell = { display: "grid", gap: 6 } as const;
const pane = { width: 200, height: 48 } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** States and variants side by side. */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 20px" }}
    >
      <div style={cell}>
        <span style={caption}>Editable</span>
        <div style={pane}>
          <TextView aria-label="Editable" defaultValue="The quick brown fox" />
        </div>
      </div>
      <div style={cell}>
        <span style={caption}>Placeholder</span>
        <div style={pane}>
          <TextView aria-label="Placeholder" placeholder="Type a note" />
        </div>
      </div>
      <div style={cell}>
        <span style={caption}>Read-only</span>
        <div style={pane}>
          <TextView aria-label="Read-only" readOnly defaultValue="The quick brown fox" />
        </div>
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <div style={pane}>
          <TextView aria-label="Disabled" disabled defaultValue="The quick brown fox" />
        </div>
      </div>
      <div style={cell}>
        <span style={caption}>Fixed pitch</span>
        <div style={pane}>
          <TextView aria-label="Fixed pitch" monospace defaultValue={"default\t0\nerror\t2"} />
        </div>
      </div>
      <div style={cell}>
        <span style={caption}>Custom background</span>
        <div style={pane}>
          <TextView
            aria-label="Sticky note"
            defaultValue="Call the lab"
            style={{
              // A Stickies note is yellow in both appearances, with black text.
              ["--mac-text-view-background" as string]: "#fef49c",
              color: "#000000",
              caretColor: "#000000",
            }}
          />
        </div>
      </div>
    </div>
  );
}
