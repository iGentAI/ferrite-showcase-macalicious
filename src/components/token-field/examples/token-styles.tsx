import { TokenField } from "macalicious/token-field";

const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

const STYLES = ["rounded", "squared", "plain-squared", "none"] as const;

/** The four token styles. Only the rounded style appears in the reference screenshots. */
export default function TokenStyles() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 260px",
        gap: "10px 12px",
        alignItems: "center",
      }}
    >
      {STYLES.map((tokenStyle) => (
        <div key={tokenStyle} style={{ display: "contents" }}>
          <span style={caption}>{tokenStyle}</span>
          <TokenField
            aria-label={`${tokenStyle} tokens`}
            tokenStyle={tokenStyle}
            defaultValue={["Work", "Travel"]}
            style={{ width: "100%" }}
          />
        </div>
      ))}
    </div>
  );
}
