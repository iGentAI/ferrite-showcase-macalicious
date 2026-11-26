import type {
  HomeAccessory,
  HomeAutomation,
  HomeDefinition,
  HomeScene,
  HomeTrigger,
} from "./home-data";
import { applyScene } from "./home-data";

/** `list` with the item `id` moved to just before the item `before`. */
export function moved<T extends { id: string }>(
  list: readonly T[],
  id: string,
  before: string,
): readonly T[] {
  const item = list.find((each) => each.id === id);
  if (!item || id === before) return list;
  const rest = list.filter((each) => each.id !== id);
  const at = rest.findIndex((each) => each.id === before);
  return at < 0 ? list : [...rest.slice(0, at), item, ...rest.slice(at)];
}

/** The rooms with `room` moved to just before `before`. */
export function movedRoom(rooms: readonly string[], room: string, before: string): string[] {
  const rest = rooms.filter((each) => each !== room);
  const at = rest.indexOf(before);
  return at < 0 || room === before ? [...rooms] : [...rest.slice(0, at), room, ...rest.slice(at)];
}

/** The home with a room called something else; its accessories go with it. */
export function renameRoom(home: HomeDefinition, from: string, to: string): HomeDefinition {
  return {
    ...home,
    rooms: home.rooms.map((room) => (room === from ? to : room)),
    accessories: home.accessories.map((accessory) =>
      accessory.room === from ? { ...accessory, room: to } : accessory,
    ),
  };
}

/**
 * The home without a room. As in Home, what was in it stays in the home: it moves to the first
 * room left. The last room cannot go, since an accessory has to be in one.
 */
export function removeRoom(home: HomeDefinition, room: string): HomeDefinition {
  const rooms = home.rooms.filter((each) => each !== room);
  const heir = rooms[0];
  if (heir === undefined) return home;
  return {
    ...home,
    rooms,
    accessories: home.accessories.map((accessory) =>
      accessory.room === room ? { ...accessory, room: heir } : accessory,
    ),
  };
}

/** The home without an accessory, and without what named it: a scene's setting, a trigger. */
export function removeAccessory(home: HomeDefinition, id: string): HomeDefinition {
  return {
    ...home,
    accessories: home.accessories.filter((accessory) => accessory.id !== id),
    scenes: home.scenes.map((scene) => ({
      ...scene,
      sets: Object.fromEntries(Object.entries(scene.sets).filter(([key]) => key !== id)),
    })),
    automations: (home.automations ?? []).filter(
      ({ trigger }) => !(trigger.kind === "accessory" && trigger.accessory === id),
    ),
  };
}

/** The tiles from `from` to `to`, in the order they stand, for Shift-click. */
export function rangeOf(order: readonly string[], from: string, to: string): string[] {
  const start = order.indexOf(from);
  const end = order.indexOf(to);
  if (start < 0 || end < 0) return [to];
  return order.slice(Math.min(start, end), Math.max(start, end) + 1);
}

/** The home without a scene, and without the automations that ran it. */
export function removeScene(home: HomeDefinition, id: string): HomeDefinition {
  return {
    ...home,
    scenes: home.scenes.filter((scene) => scene.id !== id),
    automations: (home.automations ?? []).filter((automation) => automation.scene !== id),
  };
}

/** The trigger in words, as the Automation tab lists it. */
export function triggerText(trigger: HomeTrigger, accessories: readonly HomeAccessory[]): string {
  if (trigger.kind === "time") return `At ${trigger.at}`;
  const named = accessories.find((accessory) => accessory.id === trigger.accessory);
  return `When ${named ? `${named.room} ${named.name}` : "an accessory"} turns ${trigger.on ? "on" : "off"}`;
}

const MINUTE = 60_000;
const twoDigits = (value: number) => String(value).padStart(2, "0");

/** The automations whose time of day is `now`, unless they ran in this minute. */
export function dueAutomations(home: HomeDefinition, now: Date): HomeAutomation[] {
  const at = `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;
  return (home.automations ?? []).filter(
    (automation) =>
      automation.enabled &&
      automation.trigger.kind === "time" &&
      automation.trigger.at === at &&
      Math.floor((automation.lastRun ?? 0) / MINUTE) !== Math.floor(now.getTime() / MINUTE),
  );
}

/** The automations an accessory turning on or off sets off. */
export function triggeredBy(home: HomeDefinition, id: string, on: boolean): HomeAutomation[] {
  return (home.automations ?? []).filter(
    ({ enabled, trigger }) =>
      enabled && trigger.kind === "accessory" && trigger.accessory === id && trigger.on === on,
  );
}

/** The home after running `automations`: their scenes applied, each marked as run at `at`. */
export function runAutomations(
  home: HomeDefinition,
  automations: readonly HomeAutomation[],
  at: number,
): HomeDefinition {
  const scenes = automations
    .map((automation) => home.scenes.find((scene) => scene.id === automation.scene))
    .filter((scene): scene is HomeScene => scene !== undefined);
  return {
    ...home,
    accessories: scenes.reduce<readonly HomeAccessory[]>(
      (accessories, scene) => applyScene(scene, accessories),
      home.accessories,
    ),
    automations: (home.automations ?? []).map((automation) =>
      automations.some((ran) => ran.id === automation.id)
        ? { ...automation, lastRun: at }
        : automation,
    ),
  };
}
