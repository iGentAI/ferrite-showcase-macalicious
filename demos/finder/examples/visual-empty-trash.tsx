import { FinderEmptyTrash } from "../finder-dialogs";
import { AT_CAPTURE, CaptureStage, ignore } from "../finder-dialogs-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Empty-Trash.png and its Dark
 * counterpart, the whole capture with the window's shadow (1064 x 526 px, 532 x 263 pt; the
 * alert's frame is 420 x 151 pt at 56, 38). The Trash icon is Apple's artwork: the demo's
 * folder stands in for it and the comparisons mask it.
 */
export default function VisualEmptyTrash() {
  return (
    <CaptureStage width={532} height={263} darkWindow="#303031">
      {(stage) => (
        <FinderEmptyTrash
          open
          onOpenChange={ignore}
          onEmpty={ignore}
          container={stage}
          style={AT_CAPTURE}
        />
      )}
    </CaptureStage>
  );
}
