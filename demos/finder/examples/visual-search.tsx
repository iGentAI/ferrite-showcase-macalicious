import { VisualWindow, withSecondPdf } from "../finder-visual";

/**
 * Visual comparison target: 10-15-Catalina-Light-Finder-Search.png, the 1129 x 714 pt frame
 * (crop x=112 y=76 w=2258 h=1428): a search of the startup disk for “Aqua” with six results,
 * the scope bar above them and the empty path bar below.
 */
export default function VisualSearch() {
  return (
    <VisualWindow
      width={1129}
      height={714}
      fileSystem={withSecondPdf()}
      defaultTabs={["/"]}
      defaultQuery="Aqua"
    />
  );
}
