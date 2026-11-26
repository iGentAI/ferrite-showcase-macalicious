import { Label } from "macalicious/label";

export default function Basic() {
  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "start" }}>
      <Label textStyle="emphasized">Your Mac is up to date</Label>
      <Label>Automatically keep my Mac up to date</Label>
      <Label textStyle="small" color="secondary">
        Last checked: Today at 10:47 AM
      </Label>
    </div>
  );
}
