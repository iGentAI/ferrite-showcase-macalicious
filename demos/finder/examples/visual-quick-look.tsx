import { QuickLookCapture } from "../finder-panels-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Quick-Look.png, the panel's 892 x 547 pt
 * material frame (crop x=1480 y=90 w=1784 h=1094) of the full-display capture. The comparisons
 * take the 38 pt bar of it: under the bar is the desktop picture of the capture, for which the
 * demo has a gradient.
 */
export default function VisualQuickLook() {
  return <QuickLookCapture appearance="light" />;
}
