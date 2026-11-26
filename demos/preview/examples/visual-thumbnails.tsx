import { Preview } from "../preview";

/**
 * The window as it opens, at a fixed size, for the checks of preview.visual.json that choose
 * a thumbnail in a real browser: 1147 x 762 pt, the frame of the Aqua capture without the
 * find bar's 31 pt, so that the document's view is as large as in the capture.
 */
export default function VisualThumbnails() {
  return <Preview height={762} />;
}
