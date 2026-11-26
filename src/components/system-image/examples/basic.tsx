import { SystemImage } from "macalicious/system-image";

export default function Basic() {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <SystemImage name="add" />
      <SystemImage name="remove" />
      <SystemImage name="action" />
      <SystemImage name="share" aria-label="Share" />
    </div>
  );
}
