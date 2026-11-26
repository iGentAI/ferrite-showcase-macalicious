import { Safari } from "../safari";
import { SafariStage } from "../safari-stage";

/**
 * Visual comparison target: the Tab Overview, as captured in Dark appearance. The stage is the
 * capture's own size, shadow margins included, with the 1254 x 903 pt window where the capture
 * has it.
 */
export default function VisualTabOverviewDark() {
  return (
    <SafariStage capture="dark">
      <Safari width={1254} height={903} defaultTabOverview />
    </SafariStage>
  );
}
