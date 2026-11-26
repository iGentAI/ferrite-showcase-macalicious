import { Preview } from "../preview";

/**
 * Visual comparison target for 10-15-Catalina-Light-Preview-Search.png: the whole window,
 * 1147 x 793 pt, with a word in the search field, the find bar, the seven pages found in the
 * sidebar and the first of them, page 9, from its top. Reference crop (2x pixels) x=112 y=76
 * w=2294 h=1586. The booklet is the demo's own, so every text differs from the capture's.
 */
export default function VisualSearch() {
  return <Preview defaultQuery="pilot" defaultPage={9} />;
}
