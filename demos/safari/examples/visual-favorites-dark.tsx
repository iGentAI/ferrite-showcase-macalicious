import { Safari } from "../safari";
import { SafariStage } from "../safari-stage";

/**
 * Visual comparison target: the start page with the Bookmarks sidebar open, as captured in Dark appearance. The stage is the
 * capture's own size, shadow margins included, with the 1254 x 903 pt window where the capture
 * has it.
 */
export default function VisualFavoritesDark() {
  return (
    <SafariStage capture="dark">
      <Safari width={1254} height={903} defaultTabs={[""]} defaultSidebarOpen />
    </SafariStage>
  );
}
