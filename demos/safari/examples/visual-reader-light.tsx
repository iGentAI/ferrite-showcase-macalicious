import { Safari } from "../safari";
import { SafariStage } from "../safari-stage";

/**
 * Visual comparison target: the third tab in Reader, as captured in Light appearance. The stage is the
 * capture's own size, shadow margins included, with the 1324 x 940 pt window where the capture
 * has it.
 */
export default function VisualReaderLight() {
  return (
    <SafariStage capture="light">
      <Safari width={1324} height={940} defaultActiveTab={2} defaultReader />
    </SafariStage>
  );
}
