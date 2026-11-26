import { ListView, ListViewRowLeading } from "macalicious/list-view";

const reminders = ["Bondi", "Blueberry", "Strawberry", "Grape", "Lime", "Tangerine"];

const renderRow = (index: number) => (
  <>
    <ListViewRowLeading>
      {/* The completion circle: 18 pt with a 1 pt ring, 17 pt from the edge and 7 pt from
          the row's top, which is 1 pt right of and half a point above the gutter's centre. */}
      <span
        style={{
          boxSizing: "border-box",
          width: 18,
          height: 18,
          margin: "-1px 0 0 2px",
          border: "1px solid var(--mac-color-label-secondary)",
          borderRadius: "50%",
        }}
      />
    </ListViewRowLeading>
    {reminders[index]}
  </>
);

/**
 * Visual comparison target: the reminders of 10-15-Catalina-Light-Reminders.png and
 * 10-15-Catalina-Dark-Reminders.png. Reference crop (2x pixels) x=674 y=264 w=800 h=408: the
 * leading 400 pt of the first six 34 pt rows, each with its completion circle in the gutter
 * and a separator from 50 pt. Nothing is selected.
 */
export default function VisualReminders() {
  return (
    <ListView
      aria-label="Reminders"
      count={reminders.length}
      rowHeight={34}
      separator="inset"
      separatorInset={50}
      selectionMode="none"
      renderRow={renderRow}
      style={{ width: 400, height: 204, background: "var(--mac-color-control-background-tinted)" }}
    />
  );
}
