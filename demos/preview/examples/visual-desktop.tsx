import { Preview } from "../preview";
import { desktopPicture } from "../preview-data";

/**
 * The top of an image window: the title bar with its toolbar, and the first 9 pt of the
 * picture under it. The Preview screenshots show a desktop picture, which is not reproduced,
 * and it covers more of the window than a comparison may mask; so the comparisons take the
 * 64 pt strip that holds everything else the captures show.
 */
export function DesktopStrip({ width }: { width: number }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", width, height: 64 }}>
      <Preview
        document={desktopPicture}
        width={width}
        height={width === 899 ? 675 : 828}
        style={{ position: "absolute", left: 0, top: 0 }}
      />
    </div>
  );
}

/**
 * Visual comparison target for 10-15-Catalina-Light-Preview.png, an 899 x 675 pt window:
 * reference crop (2x pixels) x=112 y=76 w=1798 h=128.
 */
export default function VisualDesktop() {
  return <DesktopStrip width={899} />;
}
