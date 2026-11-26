import { FinderReplace } from "../finder-dialogs";
import { AT_CAPTURE, CaptureStage, ignore, MOVIE } from "../finder-dialogs-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Copy-Replace.png and its Dark
 * counterpart, the whole capture with the window's shadow (1022 x 424 px, 511 x 212 pt; the
 * alert's frame is 399 x 100 pt at 56, 38). The movie's icon is Apple's artwork: the demo's
 * document stands in for it, with the library's caution badge, and the comparisons mask it.
 * The capture's item was being moved; the demo copies, and its message says so.
 */
export default function VisualCopyReplace() {
  return (
    <CaptureStage width={511} height={212} darkWindow="#303235">
      {(stage) => (
        <FinderReplace
          item={MOVIE}
          onKeepBoth={ignore}
          onStop={ignore}
          onReplace={ignore}
          container={stage}
          style={AT_CAPTURE}
        />
      )}
    </CaptureStage>
  );
}
