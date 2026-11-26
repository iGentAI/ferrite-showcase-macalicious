import { Reminders } from "../reminders";

/**
 * Choose a list or a tile, click a circle to complete a reminder, press the plus to add one,
 * double-click a reminder to change its text, and type in the search field.
 */
export default function Basic() {
  return <Reminders material="opaque" width="100%" height={624} style={{ maxWidth: 768 }} />;
}
