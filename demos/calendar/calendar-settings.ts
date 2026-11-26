import { useState } from "react";
import { useDesktopValue } from "../desktop/desktop-personal";
import { useServerState } from "../desktop/desktop-server";
import type { CalendarSettings } from "./calendar-data";
import { CALENDAR_SETTINGS_URL, settingsFromServer, settingsToServer } from "./calendar-server";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const readFirstDay = (stored: unknown) => {
  const day = WEEKDAYS.indexOf(String(stored));
  return day < 0 ? undefined : day;
};

/**
 * The first day of the week System Preferences > Language & Region says: what the window shows until
 * the person saves Calendar preferences of their own, whose Start week on then wins.
 */
export const useSystemFirstDay = (): number =>
  useDesktopValue("language-and-region.firstDayOfWeek", readFirstDay, 0);

/**
 * The person's Calendar preferences as Calendar's module keeps them, for a window that shows
 * them without changing them (the main window): `null` until they are read, or while the person
 * has saved none. The Preferences window changes and saves them; every window of the document
 * is given each save, and a change made in another browser arrives with the desktop's reload of
 * the app's documents. This window never saves: its value changes only when it takes in what was
 * stored, and such a render is no change of its own (`useServerState`).
 */
export function useStoredSettings(enabled: boolean): CalendarSettings | null {
  const [stored, setStored] = useState<CalendarSettings | null>(null);
  useServerState<CalendarSettings | null>({
    url: CALENDAR_SETTINGS_URL,
    enabled,
    value: stored,
    onLoad: (reply) => {
      const read = settingsFromServer(reply);
      if (read === undefined) return false;
      setStored(read);
    },
    toBody: (value) => (value ? settingsToServer(value) : {}),
  });
  return stored;
}
