import { SafariPreferences } from "../safari-preferences";
import { SafariStage } from "../safari-stage";

/**
 * Visual comparison target: the whole of Safari's preferences window on its General pane, at
 * the height its pane gives it, as the Dark Aqua capture has it: without a page in the
 * browser, so that Set to Current Page is disabled.
 */
export default function VisualPreferencesPaneDark() {
  return (
    <SafariStage capture="preferences">
      <SafariPreferences animated={false} />
    </SafariStage>
  );
}
