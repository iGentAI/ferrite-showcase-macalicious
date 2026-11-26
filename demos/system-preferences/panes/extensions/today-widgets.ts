import { readIds } from "../../../desktop/desktop-personal";

/** The widgets of Notification Center's Today, in the order they start. */
export const TODAY_WIDGETS = [
  { id: "calendar", name: "Calendar" },
  { id: "reminders", name: "Reminders" },
  { id: "stocks", name: "Stocks" },
  { id: "weather", name: "Weather" },
  { id: "world-clock", name: "World Clock" },
  { id: "calculator", name: "Calculator" },
] as const;

/** The ids of the widgets in the order the person put them, in the desktop's settings. */
export const TODAY_ORDER = "extensions.todayOrder";
/** The ids of the widgets the person turned off. */
export const TODAY_OFF = "extensions.todayOff";
/** The ones off for a person who never chose, as on a Mac. */
export const TODAY_STARTS_OFF: readonly string[] = ["calculator"];

export const readTodayIds = readIds;

/** Every widget, in the person's order, with whether it is on; one the order does not name comes last. */
export function todayWidgets(order: readonly string[], off: readonly string[]) {
  const place = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? order.length : index;
  };
  return [...TODAY_WIDGETS]
    .sort((a, b) => place(a.id) - place(b.id))
    .map((widget) => ({ ...widget, on: !off.includes(widget.id) }));
}

/** The order after moving `id` to `index`. */
export function movedTo(ids: readonly string[], id: string, index: number): readonly string[] {
  const rest = ids.filter((other) => other !== id);
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}
