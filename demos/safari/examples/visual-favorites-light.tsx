import { Safari } from "../safari";
import { SafariStage } from "../safari-stage";

/**
 * Visual comparison target: the start page with the Bookmarks sidebar open, as captured in Light appearance. The stage is the
 * capture's own size, shadow margins included, with the 1324 x 940 pt window where the capture
 * has it.
 */
export default function VisualFavoritesLight() {
  return (
    <SafariStage capture="light">
      <Safari width={1324} height={940} defaultTabs={[""]} defaultSidebarOpen />
    </SafariStage>
  );
}
