import { Safari } from "../safari";
import { SafariStage } from "../safari-stage";

/**
 * Visual comparison target: the toolbar and the tab bar of the window with three tabs, as captured in Dark appearance. The stage is the
 * capture's own size, shadow margins included, with the 1254 x 903 pt window where the capture
 * has it.
 */
export default function VisualWindowDark() {
  return (
    <SafariStage capture="dark" height={113}>
      <Safari width={1254} height={903} />
    </SafariStage>
  );
}
