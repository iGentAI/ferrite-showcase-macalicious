import {
  ListView,
  ListViewRowDetail,
  ListViewRowLeading,
  ListViewRowTitle,
  ListViewRowTrailing,
} from "macalicious/list-view";

const names = ["Amelia Chen", "Ben Okafor", "Carla Diaz", "Dmitri Petrov", "Elena Rossi"];
const tasks = ["Water the plants", "Book the train", "Call the bank", "Renew passport"];
const notes = [
  { title: "Shopping", date: "3:55 PM", snippet: "Milk, bread" },
  { title: "Packing list", date: "7/15/18", snippet: "Passport" },
  { title: "Garden", date: "7/14/18", snippet: "Tomatoes" },
];

const name = (index: number) => <ListViewRowTitle>{names[index]}</ListViewRowTitle>;

const task = (index: number) => (
  <>
    <ListViewRowLeading>
      {/* Stand-in for the completion circle of Reminders. */}
      <span
        style={{
          boxSizing: "border-box",
          width: 18,
          height: 18,
          border: "1px solid var(--mac-color-label-secondary)",
          borderRadius: "50%",
        }}
      />
    </ListViewRowLeading>
    {tasks[index]}
  </>
);

const note = (index: number) => (
  <>
    <ListViewRowTitle>{notes[index]?.title}</ListViewRowTitle>
    <ListViewRowDetail lead={notes[index]?.date}>{notes[index]?.snippet}</ListViewRowDetail>
    <ListViewRowTrailing>
      {/* Stand-in thumbnail. */}
      <span style={{ width: 41, height: 41, background: "var(--mac-color-label-tertiary)" }} />
    </ListViewRowTrailing>
  </>
);

const size = { width: 170, height: 136 };

/**
 * From the left: one-line rows with the grey selection of a list without focus; the same
 * list with the accent selection it has while focused (pinned here with `data-force`);
 * 34 pt rows with a leading accessory and separators from 50 pt; and two-line rows with a
 * trailing accessory in an inactive window, where the selection stays grey.
 */
export default function Variants() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <ListView
        aria-label="Contacts"
        count={names.length}
        defaultValue={[1]}
        renderRow={name}
        style={size}
      />
      <ListView
        aria-label="Contacts, focused"
        data-force="focus"
        count={names.length}
        defaultValue={[1]}
        renderRow={name}
        style={size}
      />
      <ListView
        aria-label="Reminders"
        count={tasks.length}
        rowHeight={34}
        separator="inset"
        separatorInset={50}
        selectionMode="none"
        renderRow={task}
        style={size}
      />
      <div data-window-state="inactive">
        <ListView
          aria-label="Notes"
          data-force="focus"
          count={notes.length}
          rowHeight={56}
          separator="inset"
          defaultValue={[0]}
          renderRow={note}
          style={size}
        />
      </div>
    </div>
  );
}
