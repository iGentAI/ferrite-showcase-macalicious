import { TokenField } from "macalicious/token-field";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;
const width = { width: 200 } as const;

/** Every state side by side. Focus is pinned with the `data-force` preview attribute. */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(2, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Tokens</span>
        <TokenField aria-label="Tokens" defaultValue={["Work", "Travel"]} style={width} />
      </div>
      <div style={cell}>
        <span style={caption}>Placeholder</span>
        <TokenField aria-label="Placeholder" placeholder="Add tags" style={width} />
      </div>
      <div style={cell}>
        <span style={caption}>Focused</span>
        <TokenField aria-label="Focused" defaultValue={["Work"]} data-force="focus" style={width} />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <TokenField
          aria-label="Disabled"
          defaultValue={["Work", "Travel"]}
          disabled
          style={width}
        />
      </div>
      <div style={cell}>
        <span style={caption}>Wrapping</span>
        <TokenField
          aria-label="Wrapping"
          defaultValue={["Work", "Travel", "Family", "Receipts", "Photos"]}
          style={width}
        />
      </div>
      <div style={cell}>
        <span style={caption}>With menu chevrons</span>
        <TokenField
          aria-label="With menus"
          tokenMenu
          defaultValue={["Work", "Travel"]}
          style={width}
        />
      </div>
    </div>
  );
}
