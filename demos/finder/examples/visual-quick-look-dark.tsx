import { QuickLookCapture } from "../finder-panels-visual";

/**
 * Visual comparison target: 10-15-Catalina-Dark-Finder-Quick-Look.png, the panel's 1103 x 603 pt
 * material frame (crop x=964 y=118 w=2206 h=1206) of the full-display capture. The comparisons
 * take the 38 pt bar of it, as for visual-quick-look.
 */
export default function VisualQuickLookDark() {
  return <QuickLookCapture appearance="dark" />;
}
