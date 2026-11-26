import { Slider } from "macalicious/slider";

export default function Basic() {
  return <Slider aria-label="Volume" defaultValue={40} style={{ width: 200 }} />;
}
