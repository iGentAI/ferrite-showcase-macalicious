import { QuickLookCapture } from "../finder-panels-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Quick-Look-Markup.png, the panel's
 * 892 x 547 pt material frame (crop x=1480 y=90 w=1784 h=1094) in Markup mode. The comparisons
 * take the 38 pt bar of it, as for visual-quick-look.
 */
export default function VisualQuickLookMarkup() {
  return <QuickLookCapture appearance="light" markup />;
}
