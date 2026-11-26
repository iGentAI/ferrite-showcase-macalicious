import { Dictionary } from "../dictionary";

/**
 * Type in the search field, choose a source in the bar under the toolbar, and pick a word in
 * the list. Try "d", "menu" or "aqua": the vocabulary is a few dozen words of the demo's own.
 */
export default function Basic() {
  return <Dictionary width="100%" height={520} style={{ maxWidth: 690 }} />;
}
