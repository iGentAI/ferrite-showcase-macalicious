import { HOME } from "../finder-data";
import { VisualWindow } from "../finder-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Gallery-View.png, the 1234 x 785 pt
 * frame (crop x=112 y=76 w=2468 h=1570): Downloads in gallery view with the ninth picture
 * selected and the Preview pane.
 */
export default function VisualGallery() {
  return (
    <VisualWindow
      width={1234}
      height={785}
      defaultTabs={[`${HOME}/Downloads`]}
      defaultView="gallery"
      defaultSelection={[`${HOME}/Downloads/10-9.jpg`]}
    />
  );
}
