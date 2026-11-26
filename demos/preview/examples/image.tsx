import { Preview } from "../preview";
import { desktopPicture } from "../preview-data";

/**
 * An image document, as in the Preview screenshots: the picture fills the window, the sidebar
 * is hidden and the Highlight button is unavailable. The picture is an abstract placeholder.
 */
export default function Image() {
  return <Preview document={desktopPicture} width="100%" height={520} style={{ maxWidth: 899 }} />;
}
