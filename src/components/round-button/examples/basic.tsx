import { RoundButton } from "macalicious/round-button";
import { SystemImage } from "macalicious/system-image";

export default function Basic() {
  return (
    <RoundButton aria-label="Add">
      <SystemImage name="add" />
    </RoundButton>
  );
}
