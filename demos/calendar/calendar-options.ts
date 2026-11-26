import { useDesktopSetting } from "../desktop/desktop-personal";
import { dayAt } from "./calendar-data";

/*
 * What Calendar's module does not keep among its settings: the alternate calendar and the Advanced
 * pane's view options. They go with the person's desktop settings, which both of Calendar's windows
 * read and either may change.
 */

export const ALTERNATE_CALENDARS = [
  { id: "chinese", name: "Chinese" },
  { id: "hebrew", name: "Hebrew" },
  { id: "islamic", name: "Islamic" },
] as const;
export type AlternateCalendar = (typeof ALTERNATE_CALENDARS)[number]["id"];

const readAlternate = (stored: unknown) =>
  ALTERNATE_CALENDARS.find(({ id }) => id === stored)?.id as AlternateCalendar | undefined;
const readOn = (stored: unknown) => (typeof stored === "boolean" ? stored : undefined);

export const useAlternateCalendar = () =>
  useDesktopSetting<AlternateCalendar>("calendar.alternateCalendar", readAlternate, "chinese");
/** Whether it shows: as View or Preferences last set it, at first as the stored preference says. */
export const useAlternateShown = (preference: boolean) =>
  useDesktopSetting("calendar.alternateShown", readOn, preference);
export const useWeekNumbers = () => useDesktopSetting("calendar.weekNumbers", readOn, false);
export const useYearEvents = () => useDesktopSetting("calendar.yearEvents", readOn, true);
export const useSeparateEvents = () => useDesktopSetting("calendar.separateEvents", readOn, false);

const CHINESE_TENS = ["初", "十", "廿", "三"];
const CHINESE_ONES = ["十", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** A day of a lunar month as Chinese calendars write it: 初五, 十五, 廿一, 三十. */
function chineseDay(day: number): string {
  if (day === 10) return "初十";
  if (day === 20) return "二十";
  if (day === 30) return "三十";
  return `${CHINESE_TENS[Math.floor(day / 10)]}${CHINESE_ONES[day % 10]}`;
}

const LOCALES: Record<AlternateCalendar, string> = {
  chinese: "zh-u-ca-chinese",
  hebrew: "en-US-u-ca-hebrew",
  islamic: "en-US-u-ca-islamic-civil",
};

/** `date` in another calendar: "九月初五" shows its month only on the month's first day. */
export function alternateDate(date: Date, calendar: AlternateCalendar): string {
  const format = new Intl.DateTimeFormat(LOCALES[calendar], { month: "long", day: "numeric" });
  if (calendar !== "chinese") return format.format(date);
  const parts = format.formatToParts(date);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return day === 1 ? (parts.find((part) => part.type === "month")?.value ?? "") : chineseDay(day);
}

/** The number of the week `date` is in: the week that holds January 1 is the first. */
export function weekNumber(date: Date, weekStartsOn: number): number {
  const last = dayAt(date, 6 - ((date.getDay() - weekStartsOn + 7) % 7));
  const first = new Date(last.getFullYear(), 0, 1);
  const start = dayAt(first, -((first.getDay() - weekStartsOn + 7) % 7));
  return Math.round((last.getTime() - start.getTime()) / (7 * 864e5) - 6 / 7) + 1;
}
