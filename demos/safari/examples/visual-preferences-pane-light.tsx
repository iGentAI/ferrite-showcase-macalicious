import { SafariPreferences } from "../safari-preferences";
import { SafariStage } from "../safari-stage";

/**
 * Visual comparison target: the whole of Safari's preferences window on its General pane, at
 * the height its pane gives it, as the Aqua capture has it: with a page in the browser, so
 * that Set to Current Page is enabled.
 */
export default function VisualPreferencesPaneLight() {
  return (
    <SafariStage capture="preferences">
      <SafariPreferences animated={false} currentPage="https://fieldnotes.example/about" />
    </SafariStage>
  );
}
