import { HOME, RECENTS } from "../finder-data";
import { VisualWindow, withoutExternalDisk } from "../finder-visual";

/**
 * Visual comparison target: 10-15-Catalina-Dark-Finder-Home.png, the 1074 x 672 pt frame
 * (crop x=112 y=76 w=2148 h=1344): as visual-home, without the external disk.
 */
export default function VisualHomeDark() {
  return (
    <VisualWindow
      width={1074}
      height={672}
      fileSystem={withoutExternalDisk()}
      defaultTabs={[RECENTS, HOME, `${HOME}/Documents`]}
      defaultActiveTab={1}
      defaultIconSize={160}
    />
  );
}
