import { Contacts } from "../contacts";

/**
 * Choose a group and a name, type in the search field, press Edit to change the card and
 * Done to keep it, press the plus to add a card, and click a field's label on a finished
 * card for its menu.
 */
export default function Basic() {
  return <Contacts material="opaque" width="100%" height={438} style={{ maxWidth: 938 }} />;
}
