import { HOME } from "../finder-data";
import { VisualWindow, withoutExternalDisk } from "../finder-visual";

/**
 * Visual comparison target: 10-15-Catalina-Dark-Finder-Gallery-View.png, the 1272 x 773 pt
 * frame (crop x=112 y=76 w=2544 h=1546): as visual-gallery, without the external disk.
 */
export default function VisualGalleryDark() {
  return (
    <VisualWindow
      width={1272}
      height={773}
      fileSystem={withoutExternalDisk()}
      defaultTabs={[`${HOME}/Downloads`]}
      defaultView="gallery"
      defaultSelection={[`${HOME}/Downloads/10-9.jpg`]}
    />
  );
}
