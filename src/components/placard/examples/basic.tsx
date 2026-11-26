import { Placard, PlacardButton } from "macalicious/placard";

export default function Basic() {
  return (
    <Placard aria-label="View">
      <PlacardButton popUp>100%</PlacardButton>
    </Placard>
  );
}
