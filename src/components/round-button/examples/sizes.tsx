import { RoundButton } from "macalicious/round-button";

export default function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <RoundButton aria-label="Information, regular">i</RoundButton>
      <RoundButton size="small" aria-label="Information, small">
        i
      </RoundButton>
      <RoundButton size="mini" aria-label="Information, mini">
        i
      </RoundButton>
    </div>
  );
}
