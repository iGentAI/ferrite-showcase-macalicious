import { Safari } from "../safari";

/** A new window: the start page with its Favorites, and the Bookmarks sidebar open. */
export default function Favorites() {
  return <Safari width={1100} height={640} defaultTabs={[""]} defaultSidebarOpen />;
}
