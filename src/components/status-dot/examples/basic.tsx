import { StatusDot } from "macalicious/status-dot";

const row = { display: "flex", alignItems: "center", gap: 6.5 } as const;

/** The dot is decorative here: the text beside it says the same thing. */
export default function Basic() {
  return (
    <div style={{ display: "grid", gap: 8, font: "var(--mac-font-body)" }}>
      <span style={row}>
        <StatusDot status="available" />
        Connected
      </span>
      <span style={row}>
        <StatusDot status="partially-available" />
        Self-Assigned IP
      </span>
      <span style={row}>
        <StatusDot status="unavailable" />
        Not Connected
      </span>
      <span style={row}>
        <StatusDot status="none" />
        Off
      </span>
    </div>
  );
}
