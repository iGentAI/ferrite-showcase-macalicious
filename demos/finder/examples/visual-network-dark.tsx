import { createFileSystem, NETWORK, removeNode } from "../finder-data";
import { VisualWindow } from "../finder-visual";

/**
 * Visual comparison target: 10-15-Catalina-Dark-Finder-Network.png, the 999 x 709 pt frame
 * (crop x=112 y=76 w=1998 h=1418): as visual-network with three computers on the network and
 * the sidebar at the capture's 133 pt.
 */
export default function VisualNetworkDark() {
  return (
    <VisualWindow
      width={999}
      height={709}
      fileSystem={removeNode(createFileSystem(), `${NETWORK}/brn30055c475bce`)}
      sidebarWidth={133}
      defaultTabs={[NETWORK]}
      defaultView="columns"
      defaultColumns={[`${NETWORK}/Castle`]}
      onShareScreen={() => {}}
    />
  );
}
