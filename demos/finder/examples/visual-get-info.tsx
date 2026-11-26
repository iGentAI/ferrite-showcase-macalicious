import { changeNode, createFileSystem, HOME } from "../finder-data";
import { FinderInfo } from "../finder-info";

const PATH = `${HOME}/Documents/Aqua and Bondi.pdf`;

/**
 * The document with the dates of the capture and a thousand times its size. The capture's
 * 111,631,362 bytes are "111.6 MB" in Finder, which wraps the Size row to a second line; the
 * demo's `formatSize` writes them "112 MB", which fits on one, and the window would be 14 pt
 * shorter than the capture. The longer number wraps the row as the capture does. The text is
 * masked.
 */
const root = changeNode(createFileSystem(), PATH, (node) => ({
  ...node,
  size: 111_631_362_000,
  modified: "2018-07-14 18:52",
  opened: "2018-09-21 10:14",
}));

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Get-Info.png and its Dark counterpart,
 * the 265 x 844 pt frame of the Info window (crop x=112 y=76 w=530 h=1688), over the capture's
 * transparent margin (matte white). The same example serves both appearances: the two captures
 * have the same size and differ only in the Last opened date. The capture's checkboxes are
 * enabled, as in a Finder whose file system keeps those settings, so the example is given a
 * handler for them (`onFlagChange`); without one the window dims them, as the desktop's does.
 */
export default function VisualGetInfo() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 265,
        height: 844,
        background: "#ffffff",
      }}
    >
      <FinderInfo
        root={root}
        path={PATH}
        onFlagChange={() => {}}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
