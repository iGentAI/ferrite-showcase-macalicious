import { VisualWindow } from "../finder-visual";

/**
 * Visual comparison target: 10-15-Catalina-Dark-Applications-Utilities.png, the 1115 x 734 pt
 * frame (crop x=112 y=76 w=2230 h=1468).
 */
export default function VisualUtilitiesDark() {
  return <VisualWindow width={1115} height={734} defaultTabs={["/Applications/Utilities"]} />;
}
