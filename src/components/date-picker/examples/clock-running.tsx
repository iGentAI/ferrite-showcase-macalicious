import { DatePickerClock } from "macalicious/date-picker";
import { useEffect, useState } from "react";

/**
 * A clock that runs. It starts at a fixed time, so the server and the browser render the
 * same thing, and reads the real clock only once it is mounted.
 */
export default function ClockRunning() {
  const [now, setNow] = useState(new Date(2019, 9, 3, 10, 56, 59));
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return <DatePickerClock value={now} />;
}
