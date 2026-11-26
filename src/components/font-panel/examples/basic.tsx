import { FontPanel } from "macalicious/font-panel";
import { FONT_FAMILIES } from "macalicious/lib/rich-text";

export default function Basic() {
  return <FontPanel families={FONT_FAMILIES} />;
}
