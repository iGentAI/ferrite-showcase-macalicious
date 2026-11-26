import { useState } from "react";
import { changeNode, createFileSystem, HOME } from "../finder-data";
import { FinderInfo } from "../finder-info";

/**
 * Finder's Get Info window for a document. Type a tag and press Return, choose another
 * application under Open with and press Change All, click the lock and add or remove a group.
 */
export default function GetInfo() {
  const [root, setRoot] = useState(createFileSystem);
  return (
    <FinderInfo
      root={root}
      path={`${HOME}/Documents/Aqua and Bondi.pdf`}
      onTagsChange={(path, tags) =>
        setRoot((current) => changeNode(current, path, (node) => ({ ...node, tags })))
      }
    />
  );
}
