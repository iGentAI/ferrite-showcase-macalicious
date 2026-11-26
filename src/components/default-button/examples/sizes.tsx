import { DefaultButton } from "macalicious/default-button";

export default function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <DefaultButton>Regular</DefaultButton>
      <DefaultButton size="small">Small</DefaultButton>
      <DefaultButton size="mini">Mini</DefaultButton>
    </div>
  );
}
