import { HudWindow } from "macalicious/hud-window";
import { Slider } from "macalicious/slider";

export default function Basic() {
  return (
    <HudWindow title="Adjust" onClose={() => {}} style={{ width: 220 }}>
      <Slider aria-label="Exposure" defaultValue={60} />
    </HudWindow>
  );
}
