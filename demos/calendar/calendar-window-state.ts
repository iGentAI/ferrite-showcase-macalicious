import type { CalendarView } from "./calendar-data";
import { isKnownZone } from "./calendar-recurrence";

/*
 * What a Calendar window shows, kept in this browser per account: the view, the date, the calendars
 * unticked, whether the list is shown and whether the Inspector is. It is a convenience, not the person's data: a browser that
 * cannot store it opens the window as new.
 */

export interface CalendarWindowState {
  view: CalendarView;
  /** The day shown, as epoch ms. */
  date: number;
  hidden: readonly string[];
  listShown: boolean;
  /** Set while the Inspector is shown. */
  inspector?: boolean;
  /** The zone the toolbar's menu shows the window in, when it is not the browser's. */
  zone?: string;
}

const VIEWS: readonly unknown[] = ["day", "week", "month", "year"];
const keyOf = (me: string) => `macalicious.calendar.window.${me}`;

/** What the account's last window showed; `null` when nothing readable is kept. */
export function readWindowState(me: string): CalendarWindowState | null {
  try {
    const kept = JSON.parse(window.localStorage.getItem(keyOf(me)) ?? "null") as Partial<
      Record<keyof CalendarWindowState, unknown>
    > | null;
    if (!kept || !VIEWS.includes(kept.view)) return null;
    if (typeof kept.date !== "number" || !Number.isFinite(new Date(kept.date).getTime()))
      return null;
    if (!Array.isArray(kept.hidden) || !kept.hidden.every((id) => typeof id === "string"))
      return null;
    if (typeof kept.listShown !== "boolean") return null;
    return {
      view: kept.view as CalendarView,
      date: kept.date,
      hidden: kept.hidden,
      listShown: kept.listShown,
      ...(kept.inspector === true ? { inspector: true } : {}),
      ...(typeof kept.zone === "string" && isKnownZone(kept.zone) ? { zone: kept.zone } : {}),
    };
  } catch {
    return null;
  }
}

export function writeWindowState(me: string, state: CalendarWindowState): void {
  try {
    window.localStorage.setItem(keyOf(me), JSON.stringify(state));
  } catch {
    // The next window opens as new.
  }
}
