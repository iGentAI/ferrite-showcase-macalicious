import { StorePillButton } from "macalicious/store-pill-button";

export default function Basic() {
  return (
    <div style={{ display: "flex", gap: 20, paddingBottom: 16 }}>
      <StorePillButton caption="In-App Purchases">Get</StorePillButton>
      <StorePillButton>$14.99</StorePillButton>
    </div>
  );
}
