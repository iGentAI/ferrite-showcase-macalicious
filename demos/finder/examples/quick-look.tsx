import { useState } from "react";
import { changeNode, createFileSystem, HOME } from "../finder-data";
import { FinderQuickLook } from "../finder-quick-look";

/**
 * Quick Look of a picture. Rotate Left turns it; the Markup button swaps the title for the
 * Markup tools: draw on the picture with the pointer, add a shape or a text, pick a colour,
 * then press Done. The line under the panel says what Open and Share were asked to do.
 */
export default function QuickLook() {
  const [root, setRoot] = useState(createFileSystem);
  const [markup, setMarkup] = useState(false);
  const [said, setSaid] = useState("Nothing opened or shared yet.");
  return (
    <div style={{ padding: 24, background: "#6f8fae" }}>
      <FinderQuickLook
        root={root}
        path={`${HOME}/Downloads/10-9.jpg`}
        width="100%"
        style={{ maxWidth: 760 }}
        markup={markup}
        onMarkupChange={setMarkup}
        onRotate={(path) =>
          setRoot((current) =>
            changeNode(current, path, (node) => ({
              ...node,
              rotation: ((node.rotation ?? 0) + 1) % 4,
            })),
          )
        }
        onOpen={(_path, node) => setSaid(`Opened ${node.name} with Preview.`)}
        onShare={(destination, paths) =>
          setSaid(`Shared ${paths.length} item with ${destination}.`)
        }
      />
      <p
        role="status"
        style={{ margin: "12px 0 0", color: "#ffffff", font: "var(--mac-font-body)" }}
      >
        {said}
      </p>
    </div>
  );
}
