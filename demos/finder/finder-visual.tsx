import { Finder, type FinderProps } from "./finder";
import { addNode, createFileSystem, type FinderNode, removeNode } from "./finder-data";

/** The demo's file system without the external disk, as in the captures that lack its row. */
export function withoutExternalDisk(): FinderNode {
  return removeNode(createFileSystem(), "/Volumes/Macintosh HD");
}

/** The same, with the second “Aqua and Bondi.pdf” the Aqua search capture finds. */
export function withSecondPdf(): FinderNode {
  return addNode(withoutExternalDisk(), "/Users/Shared", {
    name: "Aqua and Bondi.pdf",
    kind: "pdf",
    size: 31_700_000,
    modified: "2019-06-03 08:31",
  });
}

export interface VisualWindowProps extends FinderProps {
  /** The frame of the captured window, in points. */
  width: number;
  height: number;
}

/**
 * A Finder window as a reference capture shows it: the whole frame over the capture's
 * transparent margin (matte white), with the opaque sidebar surface and, as in every capture,
 * neither path bar nor status bar.
 */
export function VisualWindow({ width, height, ...props }: VisualWindowProps) {
  return (
    <div style={{ position: "relative", overflow: "hidden", width, height, background: "#ffffff" }}>
      <Finder
        material="opaque"
        defaultPathBar={false}
        defaultStatusBar={false}
        {...props}
        style={{ position: "absolute", inset: 0 }}
      />
    </div>
  );
}
