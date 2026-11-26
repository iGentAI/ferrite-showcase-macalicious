import { PushButton } from "macalicious/push-button";

export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <div key={size} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <PushButton size={size}>Cancel</PushButton>
          <PushButton size={size} variant="primary">
            Save
          </PushButton>
          <PushButton size={size} disabled>
            Revert
          </PushButton>
        </div>
      ))}
    </div>
  );
}
