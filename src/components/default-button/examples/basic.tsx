import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";

export default function Basic() {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <PushButton>Cancel</PushButton>
      <DefaultButton>Go</DefaultButton>
    </div>
  );
}
