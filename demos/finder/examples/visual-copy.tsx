import { FinderCopyProgress } from "../finder-dialogs";
import { ignore, MOVIE } from "../finder-dialogs-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Copy.png, the window with 8 pt of its
 * shadow on every side (crop x=96 y=60 w=830 h=170, 415 x 85 pt; the frame is 399 x 69 pt at
 * 8, 8), as the key window, 192.9 MB into a copy of 6 GB. The movie's icon is Apple's artwork:
 * the demo's document stands in for it and the masked comparison leaves it out.
 */
export default function VisualCopy() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 415,
        height: 85,
        background: "#ffffff",
      }}
    >
      <FinderCopyProgress
        items={[MOVIE]}
        destination="Desktop"
        copied={192_900_000}
        total={6_000_000_000}
        remaining={180}
        onStop={ignore}
        style={{ position: "absolute", top: 8, left: 8 }}
      />
    </div>
  );
}
