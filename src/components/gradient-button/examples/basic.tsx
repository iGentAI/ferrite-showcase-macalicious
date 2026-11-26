import { GradientButton, GradientButtonGroup } from "macalicious/gradient-button";

export default function Basic() {
  return (
    <GradientButtonGroup aria-label="Accounts">
      <GradientButton glyph="add" aria-label="Add an account" />
      <GradientButton glyph="remove" aria-label="Remove the account" />
    </GradientButtonGroup>
  );
}
