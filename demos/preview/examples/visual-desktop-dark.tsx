import { DesktopStrip } from "./visual-desktop";

/**
 * Visual comparison target for 10-15-Catalina-Dark-Preview.png, a 1272 x 828 pt window:
 * reference crop (2x pixels) x=112 y=76 w=2544 h=128.
 */
export default function VisualDesktopDark() {
  return <DesktopStrip width={1272} />;
}
