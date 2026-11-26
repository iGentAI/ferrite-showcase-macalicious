import { SecureTextField } from "macalicious/secure-text-field";

const cell = { display: "grid", gap: 6, justifyItems: "start" } as const;
const caption = {
  font: "var(--mac-font-label)",
  color: "var(--mac-color-label-secondary)",
} as const;

/** States and sizes. Focus is pinned with the `data-force` preview attribute. */
export default function States() {
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, max-content)", gap: "16px 28px" }}
    >
      <div style={cell}>
        <span style={caption}>Bullets</span>
        <SecureTextField aria-label="Bullets" defaultValue="catalina" />
      </div>
      <div style={cell}>
        <span style={caption}>Placeholder</span>
        <SecureTextField aria-label="Placeholder" placeholder="Required" />
      </div>
      <div style={cell}>
        <span style={caption}>Focused</span>
        <SecureTextField aria-label="Focused" defaultValue="catalina" data-force="focus" />
      </div>
      <div style={cell}>
        <span style={caption}>Disabled</span>
        <SecureTextField aria-label="Disabled" defaultValue="catalina" disabled />
      </div>
      <div style={cell}>
        <span style={caption}>Nothing echoed</span>
        <SecureTextField aria-label="Nothing echoed" echo="none" defaultValue="catalina" />
      </div>
      <div style={cell}>
        <span style={caption}>Small and mini</span>
        <SecureTextField aria-label="Small" size="small" defaultValue="catalina" />
        <SecureTextField aria-label="Mini" size="mini" defaultValue="catalina" />
      </div>
    </div>
  );
}
