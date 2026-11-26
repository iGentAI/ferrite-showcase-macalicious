import { StatusDot } from "macalicious/status-dot";

const STATUSES = ["available", "partially-available", "unavailable", "none"] as const;

/** Regular (10 pt) above, small (6 pt) below. A dot without text beside it needs a name. */
export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {(["regular", "small"] as const).map((size) => (
        <div key={size} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {STATUSES.map((status) => (
            <StatusDot
              key={status}
              status={status}
              size={size}
              aria-label={status.replace("-", " ")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
