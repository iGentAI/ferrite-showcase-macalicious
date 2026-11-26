import { ListView } from "macalicious/list-view";

const names = [
  ["", "Apple Inc."],
  ["Stephen ", "Hackett"],
];

// Contacts sets the name it sorts by (the last name, a company's name) in semibold.
const renderRow = (index: number) => (
  <span>
    {names[index]?.[0]}
    <b style={{ fontWeight: 600 }}>{names[index]?.[1]}</b>
  </span>
);

/**
 * Visual comparison target: the name list of Contacts, 10-15-Catalina-Light-Contacts.png
 * (crop x=482 y=142 w=376 h=144, 2x pixels) and 10-15-Catalina-Dark-Contacts.png (x=508 y=162
 * w=376 h=144): the 188 pt wide pane with its first two 24 pt rows and 24 pt below them. The
 * second row is selected, in grey because the list does not have focus. The state checks
 * click and focus this list.
 */
export default function VisualContacts() {
  return (
    <ListView
      aria-label="Contacts"
      count={names.length}
      separatorInset={29}
      defaultValue={[1]}
      renderRow={renderRow}
      style={{ width: 188, height: 72, background: "light-dark(#ffffff, #1e1f20)" }}
    />
  );
}
