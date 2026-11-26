import { AppStore } from "../app-store";

/**
 * Choose a section in the sidebar, type in the search field, press an offer button and confirm
 * it, open a collection with See All, or sign in. Nothing is bought or downloaded: the offer
 * buttons only run through the store's sequence.
 */
export default function Basic() {
  return <AppStore width="100%" height={640} style={{ maxWidth: 1246 }} />;
}
