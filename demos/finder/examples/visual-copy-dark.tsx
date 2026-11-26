import { FinderCopyProgress } from "../finder-dialogs";
import { ignore, MOVIE } from "../finder-dialogs-visual";

/**
 * Visual comparison target: 10-15-Catalina-Dark-Finder-Copy.png, cropped as visual-copy: the
 * same copy further along, 494.9 MB of 6 GB. The window background is the capture's #2e3235,
 * the dark window colour tinted by the desktop picture that was behind it.
 */
export default function VisualCopyDark() {
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
        copied={494_900_000}
        total={6_000_000_000}
        remaining={120}
        onStop={ignore}
        style={{ position: "absolute", top: 8, left: 8, background: "#2e3235" }}
      />
    </div>
  );
}
