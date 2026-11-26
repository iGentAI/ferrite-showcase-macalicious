import { QuickTimePlayer } from "../quicktime-player";

/**
 * Press Play, or the space bar with the window focused: the time code runs, the playhead
 * moves, and after three seconds without the pointer moving the title bar and the controller
 * fade until it moves again. Drag the timeline, step the speed with the rewind and
 * fast-forward buttons, change the volume, open the Share menu, or float the picture.
 */
export default function Basic() {
  return (
    <QuickTimePlayer
      width="100%"
      height="auto"
      defaultPosition="00:03:16:12"
      style={{ minWidth: 480, maxWidth: 1470, aspectRatio: "1470 / 827" }}
    />
  );
}
