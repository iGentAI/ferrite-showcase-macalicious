/**
 * What Notifications says of one application, read from the settings: the pane writes these keys, and
 * the desktop's banners and Notification Center follow them.
 */

/** The applications of the served desktop that send notifications, by name. */
export const NOTIFYING_APPS: readonly (readonly [id: string, name: string])[] = [
  ["calendar", "Calendar"],
  ["chess", "Chess"],
  ["facetime", "FaceTime"],
  ["finder", "Finder"],
  ["mail", "Mail"],
  ["messages", "Messages"],
  ["reminders", "Reminders"],
];

/** `banners` and `alerts` override how the app sends an item; `default` leaves it as sent. */
export type AlertStyle = "default" | "none" | "banners" | "alerts";

export interface NotificationRule {
  allow: boolean;
  style: AlertStyle;
  center: boolean;
  sound: boolean;
}

export const ruleKey = (app: string, name: keyof NotificationRule) =>
  `notifications.app.${app}.${name}`;

/** The rule of an application; what was never set allows everything, as a new Mac does. */
export function ruleOf(values: Readonly<Record<string, unknown>>, app: string): NotificationRule {
  const style = values[ruleKey(app, "style")];
  return {
    allow: values[ruleKey(app, "allow")] !== false,
    style: style === "none" || style === "banners" || style === "alerts" ? style : "default",
    center: values[ruleKey(app, "center")] !== false,
    sound: values[ruleKey(app, "sound")] !== false,
  };
}

/** A list row's second line. */
export function ruleSummary(rule: NotificationRule): string {
  if (!rule.allow) return "Off";
  const parts = [
    rule.sound ? "Sounds" : null,
    rule.style === "alerts" ? "Alerts" : rule.style === "banners" ? "Banners" : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(", ") : rule.center ? "Notification Center" : "Silent";
}

/** What a newly arrived item becomes on screen: nothing, or the item with its kind decided. */
export function bannerFor<Item extends { alert?: boolean }>(
  item: Item,
  rule: NotificationRule,
): Item | null {
  if (!rule.allow || rule.style === "none") return null;
  return rule.style === "default" ? item : { ...item, alert: rule.style === "alerts" };
}

/** A second call from the same person within this long is a repeated call, in milliseconds. */
const REPEATED_CALL_MS = 3 * 60_000;

const lastCalls = new Map<string, number>();

/** Forget the calls, when the person's session ends: they are that account's. */
export function clearRepeatedCalls(): void {
  lastCalls.clear();
}

/**
 * Whether a notification rings through Do Not Disturb: it is a FaceTime call, the only thing that
 * app notifies, and the settings allow calls from everyone, or this person's second call within
 * three minutes. Each call is asked about as it arrives, Do Not Disturb on or not, and remembered by
 * its caller's name as the notification gives it, for as long as the page stays open: a call that
 * has stopped ringing leaves the inbox.
 */
export function callRingsThrough(
  item: { app: string; title: string; at_ms: number },
  values: Readonly<Record<string, unknown>>,
): boolean {
  if (item.app !== "facetime") return false;
  const last = lastCalls.get(item.title);
  if (last === undefined || item.at_ms >= last) lastCalls.set(item.title, item.at_ms);
  if (values["notifications.allowCalls"] === true) return true;
  if (values["notifications.allowRepeatedCalls"] !== true || last === undefined) return false;
  const since = item.at_ms - last;
  return since >= 0 && since <= REPEATED_CALL_MS;
}

export type SortOrder = "Recents" | "Recents by App" | "Manually by App";

/**
 * Notification Center's groups, from items newest first. Recents keeps arrival order, so an app
 * returns as a new group whenever another came between; Recents by App holds each app together in
 * the order of its newest item; Manually by App is the order of the pane's list.
 */
export function groupsFor<Item extends { app: string }>(
  items: readonly Item[],
  order: unknown,
): [string, Item[]][] {
  if (order === "Recents") {
    const runs: [string, Item[]][] = [];
    for (const item of items) {
      const last = runs[runs.length - 1];
      if (last?.[0] === item.app) last[1].push(item);
      else runs.push([item.app, [item]]);
    }
    return runs;
  }
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const group = groups.get(item.app);
    if (group) group.push(item);
    else groups.set(item.app, [item]);
  }
  if (order !== "Manually by App") return [...groups];
  const place = (app: string) => {
    const at = NOTIFYING_APPS.findIndex(([id]) => id === app);
    return at < 0 ? NOTIFYING_APPS.length : at;
  };
  return [...groups].sort(([a], [b]) => place(a) - place(b));
}
