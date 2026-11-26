import { CalendarWeekGrid, type CalendarWeekGridEvent } from "macalicious/calendar-week-grid";
import { Label } from "macalicious/label";
import { useState } from "react";

const events: CalendarWeekGridEvent[] = [
  {
    id: "standup",
    title: "Stand-up",
    start: new Date(2019, 9, 2, 9),
    end: new Date(2019, 9, 2, 9, 30),
    color: "light-dark(#30b94d, #32d74b)",
  },
  {
    id: "screenshots",
    title: "Make Catalina Screenshots",
    start: new Date(2019, 9, 3, 14),
    end: new Date(2019, 9, 3, 16, 45),
    color: "light-dark(#c157d9, #cc74e1)",
  },
];

/**
 * The selection is controlled, and a double click or Return on an event reports it: Calendar
 * opens the event's popover there.
 */
export default function Controlled() {
  const [selected, setSelected] = useState<string | null>(null);
  const [opened, setOpened] = useState("Double-click an event, or press Return on it.");
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <CalendarWeekGrid
        start={new Date(2019, 8, 29)}
        events={events}
        value={selected}
        onValueChange={setSelected}
        onEventAction={(event) => setOpened(`Opened “${event.title}”.`)}
        style={{ width: "100%", maxWidth: 760, height: 360 }}
      />
      <Label color="secondary" role="status">
        {selected ? `Selected: ${selected}.` : "Nothing selected."} {opened}
      </Label>
    </div>
  );
}
