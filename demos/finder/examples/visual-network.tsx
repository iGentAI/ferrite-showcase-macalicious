import { NETWORK } from "../finder-data";
import { VisualWindow } from "../finder-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Network.png, the 926 x 711 pt frame
 * (crop x=112 y=76 w=1852 h=1422): Network in column view with Castle selected and its
 * connection panel. Share Screen is given a handler so that it is drawn enabled.
 */
export default function VisualNetwork() {
  return (
    <VisualWindow
      width={926}
      height={711}
      defaultTabs={[NETWORK]}
      defaultView="columns"
      defaultColumns={[`${NETWORK}/Castle`]}
      onShareScreen={() => {}}
    />
  );
}
