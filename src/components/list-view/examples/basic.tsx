import { ListView, ListViewRowDetail, ListViewRowTitle } from "macalicious/list-view";

const notes = [
  { title: "Shopping", date: "3:55 PM", snippet: "Milk, bread, apples" },
  { title: "All computers should be orange", date: "9/20/18", snippet: "It’s true." },
  { title: "Packing list", date: "7/15/18", snippet: "Passport, charger" },
  { title: "Ideas for the garden", date: "7/14/18", snippet: "Tomatoes along the fence" },
  { title: "Meeting notes", date: "6/13/18", snippet: "Move the release to June" },
  { title: "Books to read", date: "5/2/18", snippet: "Start with the short one" },
];

const renderRow = (index: number) => (
  <>
    <ListViewRowTitle>{notes[index]?.title}</ListViewRowTitle>
    <ListViewRowDetail lead={notes[index]?.date}>{notes[index]?.snippet}</ListViewRowDetail>
  </>
);

/** Click a note, or focus the list and use the arrow keys or type the start of a title. */
export default function Basic() {
  return (
    <ListView
      aria-label="Notes"
      count={notes.length}
      rowHeight={56}
      separator="inset"
      defaultValue={[0]}
      renderRow={renderRow}
      getRowLabel={(index) => notes[index]?.title ?? ""}
      style={{ width: 248, height: 224 }}
    />
  );
}
