import { ColorPanel } from "macalicious/color-panel";

/** The panel opened on the pencils, as `defaultMode` or `mode` chooses the picker. */
export default function Pencils() {
  return <ColorPanel defaultMode="pencils" defaultValue="#ff2600" />;
}
