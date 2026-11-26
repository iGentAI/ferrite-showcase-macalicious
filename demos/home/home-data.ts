/*
 * The homes of the demo. The first is the home of the reference screenshots: its eleven
 * favourite accessories, their states and its five favourite scenes are read from
 * 10-15-Catalina-Light-Home.png. The accessories that are not favourites, what each scene sets
 * and the second home are invented, chosen so that the status lines computed from them are the
 * ones the screenshot shows.
 */

/** What an accessory is: it picks the glyph and the words for its state. */
export type HomeAccessoryKind =
  | "light"
  | "lamp"
  | "outlet"
  | "tv"
  | "speaker"
  | "garage-door"
  | "blinds"
  | "sensor";

export interface HomeAccessory {
  /** Unique among the accessories of every home. */
  id: string;
  /** The room it is in: the first line of its tile. */
  room: string;
  /** Its name: the second line of its tile. */
  name: string;
  /** What it is. */
  kind: HomeAccessoryKind;
  /** Whether it is on: a light lit, a player playing, a door open. A sensor is never on. */
  on: boolean;
  /** Whether its tile is among the Favorite Accessories of the Home tab. */
  favorite?: boolean;
  /** A dimmable light's brightness in percent: its state line while it is on. */
  brightness?: number;
  /** A light's colour as `#rrggbb`: its tile's tint while it is on. */
  color?: string;
  /** How far open blinds are in percent, from 1, while they are on (open). */
  position?: number;
  /** A sensor's state line, such as "4 Sensors". */
  detail?: string;
  /** A humidity sensor's reading in percent, for the status lines. */
  humidity?: number;
  /** A speaker whose microphone is switched off: a badge on its glyph. */
  muted?: boolean;
}

export interface HomeScene {
  /** Unique among the scenes of every home. */
  id: string;
  /** The scene's name: the title of its tile. */
  name: string;
  /** The glyph on its tile. */
  icon: "house" | "house-person";
  /** The state the scene puts each accessory in, by accessory id. */
  sets: Readonly<Record<string, boolean>>;
}

/** What sets an automation off. Location triggers are left out: a page has no such signal. */
export type HomeTrigger =
  /** A time of day, `HH:MM` on a 24-hour clock in the browser's time zone. */
  | { kind: "time"; at: string }
  /** An accessory of the home being turned on or off. */
  | { kind: "accessory"; accessory: string; on: boolean };

export interface HomeAutomation {
  /** Unique among the automations of every home. */
  id: string;
  name: string;
  trigger: HomeTrigger;
  /** The id of the scene of its home it runs. */
  scene: string;
  /** Whether it runs when its trigger comes. */
  enabled: boolean;
  /** When it last ran, in milliseconds since the epoch. */
  lastRun?: number;
}

/** The pictures behind a home's tiles, stand-ins for the app's photographs. */
export const WALLPAPERS = [
  { id: "lagoon", title: "Lagoon" },
  { id: "dusk", title: "Dusk" },
  { id: "forest", title: "Forest" },
] as const;

export type HomeWallpaper = (typeof WALLPAPERS)[number]["id"];

export interface HomeDefinition {
  /** Unique among the homes. */
  id: string;
  /** The home's name: the title of the Home tab and its entry in the toolbar's menu. */
  name: string;
  /** The rooms, in the order the Rooms tab lists them. */
  rooms: readonly string[];
  /** Every accessory of the home. */
  accessories: readonly HomeAccessory[];
  /** The favourite scenes of the Home tab. */
  scenes: readonly HomeScene[];
  /** What runs by itself; none when absent. */
  automations?: readonly HomeAutomation[];
  /** The picture behind the tiles; `lagoon` when absent. */
  wallpaper?: HomeWallpaper;
}

/** The home of the reference screenshots. */
export const defaultHome: HomeDefinition = {
  id: "home",
  name: "Home",
  rooms: ["Front", "Master", "Den", "Garage", "Studio", "Kitchen"],
  accessories: [
    // The eleven favourites, in the order of the screenshot.
    { id: "front-light", room: "Front", name: "Light", kind: "light", on: false, favorite: true },
    {
      id: "front-turtle",
      room: "Front",
      name: "Turtle",
      kind: "outlet",
      on: false,
      favorite: true,
    },
    {
      id: "master-corner",
      room: "Master",
      name: "Corner Light",
      kind: "light",
      on: true,
      favorite: true,
    },
    { id: "den-light", room: "Den", name: "Light", kind: "light", on: false, favorite: true },
    { id: "den-tv", room: "Den", name: "Apple TV", kind: "tv", on: true, favorite: true },
    {
      id: "garage-door",
      room: "Garage",
      name: "Door",
      kind: "garage-door",
      on: false,
      favorite: true,
    },
    {
      id: "studio-work",
      room: "Studio",
      name: "Work",
      kind: "lamp",
      on: true,
      favorite: true,
      brightness: 100,
    },
    {
      id: "studio-humidity",
      room: "Studio",
      name: "Humidity Sensor",
      kind: "sensor",
      on: false,
      favorite: true,
      detail: "4 Sensors",
      humidity: 47,
    },
    {
      id: "master-homepod",
      room: "Master",
      name: "Bedroom HomePod",
      kind: "speaker",
      on: false,
      favorite: true,
    },
    {
      id: "kitchen-homepod",
      room: "Kitchen",
      name: "HomePod",
      kind: "speaker",
      on: false,
      favorite: true,
    },
    {
      id: "studio-homepod",
      room: "Studio",
      name: "HomePod",
      kind: "speaker",
      on: false,
      favorite: true,
      muted: true,
    },
    // Not favourites: shown in their rooms only. Four of them are lit, which with the two lit
    // favourites makes the six lights of the screenshot's first status line.
    { id: "front-porch", room: "Front", name: "Porch", kind: "light", on: true },
    { id: "den-floor-lamp", room: "Den", name: "Floor Lamp", kind: "light", on: true },
    { id: "studio-key", room: "Studio", name: "Key Light", kind: "light", on: true },
    { id: "studio-fill", room: "Studio", name: "Fill Light", kind: "light", on: true },
    { id: "studio-backdrop", room: "Studio", name: "Backdrop", kind: "light", on: false },
    { id: "kitchen-counter", room: "Kitchen", name: "Counter", kind: "light", on: false },
  ],
  scenes: [
    {
      id: "street-on",
      name: "Street On",
      icon: "house",
      sets: { "front-light": true, "front-porch": true },
    },
    {
      id: "street-off",
      name: "Street Off",
      icon: "house",
      sets: { "front-light": false, "front-porch": false },
    },
    {
      id: "studio-on",
      name: "Studio On",
      icon: "house-person",
      sets: { "studio-work": true, "studio-key": true, "studio-fill": true },
    },
    {
      id: "studio-off",
      name: "Studio Off",
      icon: "house-person",
      sets: {
        "studio-work": false,
        "studio-key": false,
        "studio-fill": false,
        "studio-backdrop": false,
      },
    },
    {
      id: "recording",
      name: "Recording",
      icon: "house",
      sets: {
        "studio-work": true,
        "studio-key": true,
        "studio-fill": true,
        "studio-backdrop": true,
        "studio-homepod": false,
        "den-tv": false,
      },
    },
  ],
};

/** A second home, so that the toolbar's menu has something to switch to. */
export const cabinHome: HomeDefinition = {
  id: "cabin",
  name: "Cabin",
  rooms: ["Living Room", "Loft"],
  accessories: [
    {
      id: "cabin-lamp",
      room: "Living Room",
      name: "Lamp",
      kind: "light",
      on: false,
      favorite: true,
    },
    {
      id: "cabin-homepod",
      room: "Living Room",
      name: "HomePod",
      kind: "speaker",
      on: false,
      favorite: true,
    },
    { id: "cabin-loft", room: "Loft", name: "Light", kind: "light", on: true, favorite: true },
    { id: "cabin-outlet", room: "Loft", name: "Heater", kind: "outlet", on: false },
  ],
  scenes: [
    {
      id: "cabin-arrive",
      name: "Arrive",
      icon: "house-person",
      sets: { "cabin-lamp": true, "cabin-loft": true },
    },
    {
      id: "cabin-leave",
      name: "Leave",
      icon: "house",
      sets: {
        "cabin-lamp": false,
        "cabin-loft": false,
        "cabin-homepod": false,
        "cabin-outlet": false,
      },
    },
  ],
};

/** The homes the demo opens with; the first is the one shown. */
export const defaultHomes: readonly HomeDefinition[] = [defaultHome, cabinHome];

/**
 * The home a person starts from on the served desktop, as a new Home does: one room, nothing in
 * it, since no accessory exists to be found here.
 */
export const emptyHome: HomeDefinition = {
  id: "my-home",
  name: "My Home",
  rooms: ["Default Room"],
  accessories: [],
  scenes: [],
};

/** Whether an accessory gives light: these are counted by the first status line. */
export const isLight = (accessory: HomeAccessory) =>
  accessory.kind === "light" || accessory.kind === "lamp";

/** Whether a click on the accessory's tile switches it. A sensor only reports. */
export const isSwitchable = (accessory: HomeAccessory) => accessory.kind !== "sensor";

/** The last line of an accessory's tile: its state in words. */
export function accessoryStatus(accessory: HomeAccessory): string {
  switch (accessory.kind) {
    case "sensor":
      return accessory.detail ?? "";
    case "tv":
    case "speaker":
      return accessory.on ? "Playing" : "Paused";
    case "garage-door":
      return accessory.on ? "Open" : "Closed";
    case "blinds":
      if (!accessory.on) return "Closed";
      return accessory.position === undefined || accessory.position === 100
        ? "Open"
        : `${accessory.position}% Open`;
    default:
      if (!accessory.on) return "Off";
      return accessory.brightness === undefined ? "On" : `${accessory.brightness}%`;
  }
}

/** A scene is in effect while every accessory it sets is in the state it sets. */
export function sceneIsActive(scene: HomeScene, accessories: readonly HomeAccessory[]): boolean {
  const states = Object.entries(scene.sets);
  return (
    states.length > 0 &&
    states.every(([id, on]) => accessories.find((accessory) => accessory.id === id)?.on === on)
  );
}

/** The accessories as a scene leaves them. */
export function applyScene(
  scene: HomeScene,
  accessories: readonly HomeAccessory[],
): HomeAccessory[] {
  return accessories.map((accessory) => {
    const on = scene.sets[accessory.id];
    return on === undefined || on === accessory.on ? accessory : { ...accessory, on };
  });
}

const sentence = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;

/**
 * What Home says under its title: how many lights are on, what the sensors read, the rooms
 * whose every light is on, and what is playing, open or switched on. With a `room` the lines
 * are about that room alone and leave its name out.
 */
export function statusLines(accessories: readonly HomeAccessory[], room?: string): string[] {
  const shown =
    room === undefined ? accessories : accessories.filter((accessory) => accessory.room === room);
  const place = (accessory: HomeAccessory) => (room === undefined ? `${accessory.room} ` : "");
  const lines: string[] = [];

  const lights = shown.filter(isLight);
  const lit = lights.filter((light) => light.on).length;
  if (lit > 0) lines.push(lit === 1 ? "1 light on." : `${lit} lights on.`);

  for (const accessory of shown) {
    if (accessory.humidity !== undefined) {
      lines.push(sentence(`${place(accessory)}humidity ${accessory.humidity}%`));
    }
  }

  if (room === undefined) {
    for (const name of new Set(lights.map((light) => light.room))) {
      const inRoom = lights.filter((light) => light.room === name);
      if (inRoom.every((light) => light.on)) {
        lines.push(`${name} ${inRoom.length === 1 ? "light" : "lights"} on.`);
      }
    }
  }

  for (const accessory of shown) {
    if (!accessory.on) continue;
    const subject = `${place(accessory)}${accessory.name}`;
    if (accessory.kind === "tv" || accessory.kind === "speaker") {
      lines.push(sentence(`${subject} playing`));
    } else if (accessory.kind === "garage-door" || accessory.kind === "blinds") {
      lines.push(sentence(`${subject} open`));
    } else if (accessory.kind === "outlet") lines.push(sentence(`${subject} on`));
  }
  // Two accessories of one name in one room would say the same thing twice.
  return [...new Set(lines)];
}
