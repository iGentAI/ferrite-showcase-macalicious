import { useEffect, useState } from "react";
import { readBoolean, useDesktopValue } from "../../../desktop/desktop-personal";
import { outputLevel } from "../sound/alert-sounds";
import "./menu-clock.css";

/** The Clock tab's settings. 24-hour is the setting of Language & Region, as on a Mac. */
export const CLOCK_SHOW_KEY = "date-and-time.clockShow";
export const CLOCK_ANALOG_KEY = "date-and-time.clockAnalog";
export const CLOCK_SECONDS_KEY = "date-and-time.clockSeconds";
export const CLOCK_FLASH_KEY = "date-and-time.clockFlash";
export const CLOCK_HOUR24_KEY = "language-and-region.twentyFourHourTime";
export const CLOCK_AM_PM_KEY = "date-and-time.clockAmPm";
export const CLOCK_WEEKDAY_KEY = "date-and-time.clockWeekday";
export const CLOCK_DATE_KEY = "date-and-time.clockDate";
export const CLOCK_ANNOUNCE_KEY = "date-and-time.clockAnnounce";
export const CLOCK_ANNOUNCE_EVERY_KEY = "date-and-time.clockAnnounceEvery";

/** Announce the time's choices, with the minutes between announcements. */
export const ANNOUNCE_EVERY: Readonly<Record<string, number>> = {
  "On the hour": 60,
  "On the half hour": 30,
  "On the quarter hour": 15,
};

export interface ClockFormat {
  seconds: boolean;
  /** The separators go out in every other second. */
  flash: boolean;
  hour24: boolean;
  amPm: boolean;
  weekday: boolean;
  date: boolean;
}

/** The clock's text: "Thu 10:07 AM" unless the format says otherwise. */
export function menuClockText(when: Date, format: ClockFormat): string {
  const time = when.toLocaleTimeString("en-US", {
    hour: format.hour24 ? "2-digit" : "numeric",
    minute: "2-digit",
    second: format.seconds ? "2-digit" : undefined,
    hourCycle: format.hour24 ? "h23" : "h12",
  });
  const marked = format.amPm ? time : time.replace(/\s*[AP]M$/, "");
  const lit = !format.flash || when.getSeconds() % 2 === 0;
  return [
    format.weekday ? when.toLocaleDateString("en-US", { weekday: "short" }) : "",
    format.date ? when.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
    lit ? marked : marked.replaceAll(":", " "),
  ]
    .filter(Boolean)
    .join(" ");
}

/** What is said at `when`, if that is a time the choice announces. */
export function announcementAt(when: Date, everyMinutes: number): string | null {
  if (when.getMinutes() % everyMinutes !== 0) return null;
  const said = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `It's ${said}`;
}

const readText = (stored: unknown) => (typeof stored === "string" ? stored : undefined);

/** Announce the time, in the browser's own voice under Output volume and Mute. */
function useTimeAnnouncements(on: boolean, every: number) {
  useEffect(() => {
    if (!on || typeof speechSynthesis === "undefined") return;
    let said = -1;
    const timer = setInterval(() => {
      const now = new Date();
      const minute = Math.floor(now.getTime() / 60_000);
      const words = minute === said ? null : announcementAt(now, every);
      if (!words) return;
      said = minute;
      const speech = new SpeechSynthesisUtterance(words);
      speech.volume = outputLevel();
      speechSynthesis.speak(speech);
    }, 5_000);
    return () => clearInterval(timer);
  }, [on, every]);
}

/** Whether the browser has a voice to speak with; voices can arrive after the page has loaded. */
export function useHasVoice(): boolean {
  const [has, setHas] = useState(
    () => typeof speechSynthesis !== "undefined" && speechSynthesis.getVoices().length > 0,
  );
  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const speech = speechSynthesis;
    const listen = () => setHas(speech.getVoices().length > 0);
    listen();
    speech.addEventListener("voiceschanged", listen);
    return () => speech.removeEventListener("voiceschanged", listen);
  }, []);
  return has;
}

/** Whether the Clock tab says Analog. */
export const useAnalogMenuClock = () => useDesktopValue(CLOCK_ANALOG_KEY, readBoolean, false);

/**
 * The menu bar clock's text, following the Clock tab: the pinned text, or the time, read after mount
 * and every half minute, or every second when seconds or the separators' flash show it. Until the
 * page has mounted it shows the time of the Desktop screenshot.
 */
export function useMenuClock(pinned: string | undefined): string {
  const [text, setText] = useState("Thu 10:07 AM");
  const shown = useDesktopValue(CLOCK_SHOW_KEY, readBoolean, true);
  const analog = useAnalogMenuClock();
  const seconds = useDesktopValue(CLOCK_SECONDS_KEY, readBoolean, false);
  const flash = useDesktopValue(CLOCK_FLASH_KEY, readBoolean, false);
  const hour24 = useDesktopValue(CLOCK_HOUR24_KEY, readBoolean, false);
  const amPm = useDesktopValue(CLOCK_AM_PM_KEY, readBoolean, true);
  const weekday = useDesktopValue(CLOCK_WEEKDAY_KEY, readBoolean, true);
  const date = useDesktopValue(CLOCK_DATE_KEY, readBoolean, false);
  const announce = useDesktopValue(CLOCK_ANNOUNCE_KEY, readBoolean, false);
  const every = useDesktopValue(CLOCK_ANNOUNCE_EVERY_KEY, readText, "On the hour");
  useTimeAnnouncements(announce, ANNOUNCE_EVERY[every] ?? 60);
  useEffect(() => {
    if (pinned !== undefined) return;
    const format = { seconds, flash, hour24, amPm, weekday, date };
    const tick = () => setText(menuClockText(new Date(), format));
    tick();
    const timer = setInterval(tick, seconds || flash ? 1_000 : 30_000);
    return () => clearInterval(timer);
  }, [pinned, seconds, flash, hour24, amPm, weekday, date]);
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-mac-menu-clock-hidden", !shown);
    root.toggleAttribute("data-mac-menu-clock-wide", analog || seconds || date);
    return () => {
      root.removeAttribute("data-mac-menu-clock-hidden");
      root.removeAttribute("data-mac-menu-clock-wide");
    };
  }, [shown, analog, seconds, date]);
  return pinned ?? text;
}
