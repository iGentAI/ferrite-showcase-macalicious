import { DatePicker } from "macalicious/date-picker";

export default function Basic() {
  return <DatePicker aria-label="Date and time" defaultValue={new Date(2019, 9, 3, 10, 56, 59)} />;
}
