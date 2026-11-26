import { SafariPreferences } from "../safari-preferences";
import { SafariStage } from "../safari-stage";

/**
 * Visual comparison target: the title bar and toolbar of Safari's preferences window, the
 * first 124 pt of its capture (the 78 pt bar and 8 pt of the pane under it).
 */
export default function VisualPreferences() {
  return (
    <SafariStage capture="preferences" height={124}>
      <SafariPreferences height={508} animated={false} />
    </SafariStage>
  );
}
