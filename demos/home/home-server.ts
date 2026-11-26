import {
  type HomeAccessory,
  type HomeAccessoryKind,
  type HomeAutomation,
  type HomeDefinition,
  type HomeScene,
  WALLPAPERS,
} from "./home-data";

/**
 * Home's homes as its module of the `macalicious-desktop` Ferrite application keeps them
 * (`ferrite-apps/desktop/src/apps/home`): `GET` and `PUT` of `{ homes }`, each home in the shape
 * of `home-data.ts`. The accessories are simulated: the module stores the document and talks to
 * no device.
 */
export const HOME_HOMES_URL = "/api/home/homes";

/** The module's limits per home; the window offers no addition past them. */
export const HOME_LIMITS = {
  homes: 10,
  rooms: 50,
  accessories: 200,
  scenes: 100,
  automations: 100,
} as const;

const KINDS: readonly HomeAccessoryKind[] = [
  "light",
  "lamp",
  "outlet",
  "tv",
  "speaker",
  "garage-door",
  "blinds",
  "sensor",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");
const optional = (value: unknown, type: "boolean" | "number" | "string") =>
  value === undefined || typeof value === type;

const isAccessory = (value: unknown): value is HomeAccessory =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.room === "string" &&
  typeof value.name === "string" &&
  KINDS.includes(value.kind as HomeAccessoryKind) &&
  typeof value.on === "boolean" &&
  optional(value.favorite, "boolean") &&
  optional(value.brightness, "number") &&
  optional(value.color, "string") &&
  optional(value.position, "number") &&
  optional(value.detail, "string") &&
  optional(value.humidity, "number") &&
  optional(value.muted, "boolean");

const isScene = (value: unknown): value is HomeScene =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  (value.icon === "house" || value.icon === "house-person") &&
  isRecord(value.sets) &&
  Object.values(value.sets).every((on) => typeof on === "boolean");

const isTrigger = (value: unknown) =>
  isRecord(value) &&
  ((value.kind === "time" && typeof value.at === "string") ||
    (value.kind === "accessory" &&
      typeof value.accessory === "string" &&
      typeof value.on === "boolean"));

const isAutomation = (value: unknown): value is HomeAutomation =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.scene === "string" &&
  typeof value.enabled === "boolean" &&
  optional(value.lastRun, "number") &&
  isTrigger(value.trigger);

const isHome = (value: unknown): value is HomeDefinition =>
  isRecord(value) &&
  (value.automations === undefined ||
    (Array.isArray(value.automations) && value.automations.every(isAutomation))) &&
  (value.wallpaper === undefined || WALLPAPERS.some(({ id }) => id === value.wallpaper)) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  isStrings(value.rooms) &&
  Array.isArray(value.accessories) &&
  value.accessories.every(isAccessory) &&
  Array.isArray(value.scenes) &&
  value.scenes.every(isScene);

/**
 * Whether a `GET` reply is one Home can read: a list of homes in the window's shape, or `null`
 * before the session has saved. Anything else is stored data that must not be saved over.
 */
export function homesReadable(reply: unknown): boolean {
  const homes = isRecord(reply) ? reply.homes : undefined;
  return homes === null || (Array.isArray(homes) && homes.every(isHome));
}

/** The homes of a `GET` reply, or `undefined` when it holds none Home can show. */
export function homesFromServer(reply: unknown): HomeDefinition[] | undefined {
  if (!homesReadable(reply)) return undefined;
  const homes = (reply as { homes: HomeDefinition[] | null }).homes;
  return homes && homes.length > 0 ? homes : undefined;
}

/** The `PUT` body for the window's homes: only the fields the module keeps. */
export function homesToServer(homes: readonly HomeDefinition[]) {
  return {
    homes: homes.map(({ id, name, rooms, accessories, scenes, automations, wallpaper }) => ({
      id,
      name,
      wallpaper,
      automations,
      rooms: [...rooms],
      accessories: accessories.map(
        ({
          id,
          room,
          name,
          kind,
          on,
          favorite,
          brightness,
          color,
          position,
          detail,
          humidity,
          muted,
        }) => ({
          id,
          room,
          name,
          kind,
          on,
          favorite,
          brightness,
          color,
          position,
          detail,
          humidity,
          muted,
        }),
      ),
      scenes: scenes.map(({ id, name, icon, sets }) => ({ id, name, icon, sets: { ...sets } })),
    })),
  };
}
