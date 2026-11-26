import { Switch } from "macalicious/switch";

export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      {(["regular", "small", "mini"] as const).map((size) => (
        <div key={size} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Switch size={size} aria-label={`${size}, off`} />
          <Switch size={size} aria-label={`${size}, on`} defaultChecked />
          <Switch size={size} aria-label={`${size}, disabled`} defaultChecked disabled />
        </div>
      ))}
    </div>
  );
}
