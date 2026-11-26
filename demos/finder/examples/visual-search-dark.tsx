import { VisualWindow } from "../finder-visual";

/**
 * Visual comparison target: 10-15-Catalina-Dark-Finder-Search.png, the 956 x 696 pt frame
 * (crop x=112 y=76 w=1912 h=1392): as visual-search with five results. The capture's field is
 * focused and holds a NAME token before the text; the library's toolbar search field has no
 * tokens, so the field here holds the text alone.
 */
export default function VisualSearchDark() {
  return <VisualWindow width={956} height={696} defaultTabs={["/"]} defaultQuery="Aqua" />;
}
