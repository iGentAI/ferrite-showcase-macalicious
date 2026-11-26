import { CircularSlider } from "macalicious/circular-slider";

export default function Basic() {
  return <CircularSlider aria-label="Rotation" max={360} defaultValue={45} />;
}
