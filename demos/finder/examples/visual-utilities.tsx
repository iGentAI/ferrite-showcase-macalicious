import { VisualWindow, withoutExternalDisk } from "../finder-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Applications-Utilities.png, the 1080 x 756 pt
 * frame (crop x=112 y=76 w=2160 h=1512): the Utilities folder in icon view.
 */
export default function VisualUtilities() {
  return (
    <VisualWindow
      width={1080}
      height={756}
      fileSystem={withoutExternalDisk()}
      defaultTabs={["/Applications/Utilities"]}
    />
  );
}
