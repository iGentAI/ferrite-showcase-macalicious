import { Preview } from "../preview";

/**
 * A PDF: choose a thumbnail to go to its page, scroll the document, zoom, rotate, and type in
 * the search field to list the pages that hold a word (try “pilot”). The booklet is invented
 * and is set from its text; nothing is opened or saved.
 */
export default function Basic() {
  return <Preview width="100%" height={620} style={{ maxWidth: 1147 }} />;
}
