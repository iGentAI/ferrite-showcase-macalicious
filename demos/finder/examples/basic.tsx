import { Finder } from "../finder";

/**
 * Pick a place in the sidebar, open folders with a double click, go back, switch between the
 * four views, open a second tab from the Action menu, type in the search field.
 */
export default function Basic() {
  return <Finder material="opaque" width="100%" height={560} style={{ maxWidth: 1080 }} />;
}
