import { Safari } from "../safari";
import { SafariStage } from "../safari-stage";

/**
 * Visual comparison target: the toolbar and the tab bar of the window with three tabs, as captured in Light appearance. The stage is the
 * capture's own size, shadow margins included, with the 1324 x 940 pt window where the capture
 * has it.
 */
export default function VisualWindowLight() {
  return (
    <SafariStage capture="light" height={113}>
      <Safari width={1324} height={940} />
    </SafariStage>
  );
}
