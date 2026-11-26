/**
 * The catalogue of the App Store demo. The Discover page follows the layout and lengths of the
 * reference screenshot (reference/spec/apps/app-store.md), but its apps and its featured app
 * are invented stand-ins of the same genre and price for the real products the capture shows,
 * so that no product name, icon or artwork of the store is reproduced. Every other story,
 * collection and app is invented for the demo too.
 */

/** The rows of the sidebar, in order. */
export type AppStoreSection =
  | "discover"
  | "arcade"
  | "create"
  | "work"
  | "play"
  | "develop"
  | "categories"
  | "updates";

/** The sidebar as the reference screenshots show it. */
export const SECTIONS: readonly { id: AppStoreSection; name: string }[] = [
  { id: "discover", name: "Discover" },
  { id: "arcade", name: "Arcade" },
  { id: "create", name: "Create" },
  { id: "work", name: "Work" },
  { id: "play", name: "Play" },
  { id: "develop", name: "Develop" },
  { id: "categories", name: "Categories" },
  { id: "updates", name: "Updates" },
];

/** Whether a string names a row of the sidebar. */
export const isSection = (value: string): value is AppStoreSection =>
  SECTIONS.some((section) => section.id === value);

/** A system colour by the name of its token, `--mac-color-system-<name>`. */
export type AppStoreColor =
  | "blue"
  | "brown"
  | "gray"
  | "green"
  | "indigo"
  | "orange"
  | "pink"
  | "purple"
  | "red"
  | "teal"
  | "yellow";

/** The glyphs the stand-in app icons are drawn with. */
export type AppStoreGlyph =
  | "bolt"
  | "brackets"
  | "brush"
  | "chart"
  | "column"
  | "dice"
  | "film"
  | "flag"
  | "flame"
  | "grid"
  | "house"
  | "leaf"
  | "note"
  | "pen"
  | "shield"
  | "star"
  | "wave";

/** The abstract placeholders that stand for the round artwork of a story. */
export type AppStoreArtwork = "arcs" | "bars" | "orbits" | "tiles";

export interface AppStoreApp {
  /** Identifies the app in the catalogue. */
  id: string;
  /** The app's name. */
  title: string;
  /** The line under the name. */
  subtitle: string;
  /** The category the app is listed in. */
  category: string;
  /** The title of its offer button: `Get`, a price, or `Update` for an installed app. */
  offer: string;
  /** Whether the offer carries the `In-App Purchases` caption. */
  inAppPurchases?: boolean;
  /** The glyph of its stand-in icon. */
  glyph: AppStoreGlyph;
  /** The two system colours of its stand-in icon. */
  colors: readonly [AppStoreColor, AppStoreColor];
}

export interface AppStoreStory {
  /** Identifies the story on its page. */
  id: string;
  /** The short line over the title, shown in capitals. */
  eyebrow: string;
  /** The story's title. */
  title: string;
  /** One or two lines under the title. */
  body: string;
  /** The drawing in its round artwork; the hero of a page draws its own picture. */
  artwork: AppStoreArtwork;
}

export interface AppStoreCollection {
  /** Identifies the collection in the catalogue. */
  id: string;
  /** The header of the collection. */
  title: string;
  /** The `id`s of its apps, in the order they are listed: row by row. */
  apps: readonly string[];
  /** How many apps are listed until See All is chosen. Without it, all of them. */
  shown?: number;
}

export interface AppStorePage {
  /** The large story across the top of the page. */
  hero?: Omit<AppStoreStory, "artwork">;
  /** The two stories under it. */
  stories: readonly AppStoreStory[];
  /** The collections of apps, from the top. */
  collections: readonly AppStoreCollection[];
}

const app = (
  id: string,
  title: string,
  subtitle: string,
  category: string,
  offer: string,
  glyph: AppStoreGlyph,
  colors: readonly [AppStoreColor, AppStoreColor],
  inAppPurchases = false,
): AppStoreApp => ({ id, title, subtitle, category, offer, inAppPurchases, glyph, colors });

/** Every app of the demo. The first nine are the lockups of the reference screenshot. */
export const APPS: readonly AppStoreApp[] = [
  app(
    "cozy-corners",
    "Cozy Corners",
    "Your home is your puzzle",
    "Games",
    "Get",
    "house",
    ["teal", "blue"],
    true,
  ),
  app("launchwell", "Launchwell", "Visual launcher and organizer", "Utilities", "$14.99", "grid", [
    "gray",
    "indigo",
  ]),
  app(
    "margin-notes",
    "Margin Notes",
    "Clean notes on monitor side",
    "Productivity",
    "$19.99",
    "note",
    ["indigo", "blue"],
  ),
  app(
    "rainroom-lite",
    "Rainroom Lite",
    "Calm meditation nature sounds",
    "Health & Fitness",
    "Get",
    "wave",
    ["teal", "green"],
  ),
  app(
    "banners-nine-rivers",
    "Banners of the Nine Rivers",
    "An era of legendary conquest",
    "Games",
    "$49.99",
    "flag",
    ["red", "brown"],
    true,
  ),
  app(
    "dynasties-of-dawn",
    "Dynasties of Dawn",
    "Build. Conquer. Inspire.",
    "Games",
    "$59.99",
    "column",
    ["orange", "red"],
    true,
  ),
  app("longhand", "Longhand", "The ultimate writing app", "Productivity", "Get", "pen", [
    "yellow",
    "orange",
  ]),
  app("draftreel", "Draftreel", "Productivity", "Productivity", "$89.99", "film", [
    "gray",
    "brown",
  ]),
  app("ember-covenant", "Ember Covenant", "Definitive Edition", "Games", "$44.99", "flame", [
    "purple",
    "indigo",
  ]),
  // Listed after See All: invented.
  app("tile-garden", "Tile Garden", "Grow a quiet mosaic", "Games", "Get", "leaf", [
    "green",
    "teal",
  ]),
  app("daybook", "Daybook", "A journal for one line a day", "Lifestyle", "$4.99", "note", [
    "orange",
    "pink",
  ]),
  app(
    "skyline-weather",
    "Skyline Weather",
    "Forecasts over your city",
    "Weather",
    "Get",
    "bolt",
    ["blue", "indigo"],
    true,
  ),
  // Arcade
  app("lantern-drift", "Lantern Drift", "Sail the night river", "Games", "Get", "flame", [
    "orange",
    "purple",
  ]),
  app("tiny-harbors", "Tiny Harbors", "Build a port in a bottle", "Games", "Get", "house", [
    "teal",
    "indigo",
  ]),
  app("orbit-golf", "Orbit Golf", "Eighteen holes, zero gravity", "Games", "Get", "star", [
    "indigo",
    "purple",
  ]),
  app("paper-knights", "Paper Knights", "Fold, march, conquer", "Games", "Get", "shield", [
    "red",
    "orange",
  ]),
  app("mossy-trails", "Mossy Trails", "A walk that never ends", "Games", "Get", "leaf", [
    "green",
    "brown",
  ]),
  app("pixel-regatta", "Pixel Regatta", "Race the trade winds", "Games", "Get", "flag", [
    "blue",
    "teal",
  ]),
  // Create
  app(
    "inkwell-studio",
    "Inkwell Studio",
    "Brushes that feel like ink",
    "Graphics & Design",
    "$29.99",
    "brush",
    ["pink", "purple"],
  ),
  app(
    "chromatica",
    "Chromatica",
    "Colour grading for photos",
    "Photo & Video",
    "Get",
    "grid",
    ["yellow", "pink"],
    true,
  ),
  app("loopsmith", "Loopsmith", "Beats, bars and loops", "Music", "$19.99", "wave", [
    "purple",
    "blue",
  ]),
  app("framecraft", "Framecraft", "Cut a film in an afternoon", "Photo & Video", "$49.99", "film", [
    "indigo",
    "gray",
  ]),
  app(
    "glyphworks",
    "Glyphworks",
    "Design your own typeface",
    "Graphics & Design",
    "$39.99",
    "pen",
    ["gray", "blue"],
  ),
  app(
    "clay-sketch",
    "Clay Sketch",
    "Sculpt in three dimensions",
    "Graphics & Design",
    "Get",
    "star",
    ["brown", "orange"],
    true,
  ),
  // Work
  app("ledgerly", "Ledgerly", "Invoices without the fuss", "Business", "Get", "chart", [
    "green",
    "blue",
  ]),
  app("meeting-tide", "Meeting Tide", "Agendas that end on time", "Business", "$9.99", "wave", [
    "blue",
    "teal",
  ]),
  app(
    "taskfield",
    "Taskfield",
    "Plan the week in rows",
    "Productivity",
    "Get",
    "grid",
    ["orange", "yellow"],
    true,
  ),
  app("docket", "Docket", "Scan, sign and send", "Business", "$14.99", "note", ["red", "pink"]),
  app("sheetwise", "Sheetwise", "Spreadsheets that explain", "Productivity", "$24.99", "column", [
    "green",
    "teal",
  ]),
  app("mailroom-pro", "Mailroom Pro", "Sort a full inbox fast", "Productivity", "Get", "flag", [
    "indigo",
    "blue",
  ]),
  // Play
  app("castle-circuit", "Castle Circuit", "Karts on the ramparts", "Games", "$6.99", "shield", [
    "purple",
    "pink",
  ]),
  app("dune-racers", "Dune Racers", "Outrun the sandstorm", "Games", "Get", "bolt", [
    "orange",
    "red",
  ]),
  app("word-orchard", "Word Orchard", "Pick letters, grow words", "Games", "Get", "leaf", [
    "green",
    "yellow",
  ]),
  app(
    "starfall-tactics",
    "Starfall Tactics",
    "Command a small fleet",
    "Games",
    "$12.99",
    "star",
    ["indigo", "teal"],
    true,
  ),
  app("puzzle-pier", "Puzzle Pier", "A hundred harbour riddles", "Games", "$2.99", "dice", [
    "teal",
    "blue",
  ]),
  app("goal-rush", "Goal Rush", "Five-a-side in five minutes", "Games", "Get", "flag", [
    "red",
    "orange",
  ]),
  // Develop
  app(
    "branchline",
    "Branchline",
    "A calm client for version control",
    "Developer Tools",
    "$59.99",
    "brackets",
    ["indigo", "purple"],
  ),
  app(
    "regex-garden",
    "Regex Garden",
    "Grow patterns step by step",
    "Developer Tools",
    "Get",
    "leaf",
    ["green", "indigo"],
  ),
  app(
    "packet-peek",
    "Packet Peek",
    "See what your app sends",
    "Developer Tools",
    "$34.99",
    "wave",
    ["gray", "teal"],
  ),
  app(
    "schema-loom",
    "Schema Loom",
    "Draw a database, get the SQL",
    "Developer Tools",
    "$19.99",
    "grid",
    ["blue", "gray"],
  ),
  app(
    "hex-lantern",
    "Hex Lantern",
    "A binary editor with a map",
    "Developer Tools",
    "Get",
    "bolt",
    ["yellow", "brown"],
  ),
  app(
    "build-barn",
    "Build Barn",
    "Watch every build in one place",
    "Developer Tools",
    "$9.99",
    "house",
    ["red", "gray"],
  ),
  // Updates: apps that count as installed.
  app(
    "harbor-notes",
    "Harbor Notes",
    "Version 3.2: faster search",
    "Productivity",
    "Update",
    "note",
    ["blue", "teal"],
  ),
  app(
    "pocket-atlas",
    "Pocket Atlas",
    "Version 8.0: offline regions",
    "Navigation",
    "Update",
    "flag",
    ["green", "blue"],
  ),
  app(
    "tempo-trainer",
    "Tempo Trainer",
    "Version 1.9: new metronome sounds",
    "Music",
    "Update",
    "wave",
    ["pink", "orange"],
  ),
  app("kiln", "Kiln", "Updated yesterday: bug fixes", "Graphics & Design", "Open", "flame", [
    "orange",
    "brown",
  ]),
  app("quill-reader", "Quill Reader", "Updated last week: new fonts", "Books", "Open", "pen", [
    "brown",
    "yellow",
  ]),
  app(
    "ridge-timer",
    "Ridge Timer",
    "Updated last week: lap export",
    "Health & Fitness",
    "Open",
    "bolt",
    ["red", "pink"],
  ),
];

const BY_ID = new Map(APPS.map((item) => [item.id, item]));

/** The apps with these `id`s, in that order; an `id` the catalogue does not hold is skipped. */
export const appsOf = (ids: readonly string[]): AppStoreApp[] =>
  ids.flatMap((id) => BY_ID.get(id) ?? []);

const story = (
  id: string,
  eyebrow: string,
  title: string,
  body: string,
  artwork: AppStoreArtwork,
): AppStoreStory => ({ id, eyebrow, title, body, artwork });

/** The pages of the six sections that are a page of stories and collections. */
export const PAGES: Readonly<
  Record<Exclude<AppStoreSection, "categories" | "updates">, AppStorePage>
> = {
  discover: {
    hero: {
      id: "photo-extensions",
      eyebrow: "Get Started",
      title: "Extensions for Fast Photo Edits",
      // The capture shows only the start of each line (“Make multistep tweaks w” and
      // “window”): the rest is the demo's.
      body: "Make multistep tweaks without leaving your Photos window.",
    },
    stories: [
      story(
        "act-fast",
        "Collection",
        "Act Fast!",
        "These games push your reaction time to the limit.",
        "arcs",
      ),
      story(
        "print-a-photo-project",
        "Featured App",
        "Print a Photo Project",
        "Create a book, calendar, or card with Paperleaf Photos.",
        "bars",
      ),
    ],
    collections: [
      {
        id: "we-love",
        title: "Apps and Games We Love Right Now",
        shown: 9,
        apps: [
          "cozy-corners",
          "launchwell",
          "margin-notes",
          "rainroom-lite",
          "banners-nine-rivers",
          "dynasties-of-dawn",
          "longhand",
          "draftreel",
          "ember-covenant",
          "tile-garden",
          "daybook",
          "skyline-weather",
        ],
      },
    ],
  },
  arcade: {
    stories: [
      story(
        "one-subscription",
        "New This Week",
        "Set Sail at Dusk",
        "Lantern Drift turns a river into a slow, glowing race.",
        "orbits",
      ),
      story(
        "play-together",
        "Collection",
        "Games for the Sofa",
        "Pass the controller: these are better with company.",
        "tiles",
      ),
    ],
    collections: [
      {
        id: "new-arcade-games",
        title: "New Arcade Games",
        apps: [
          "lantern-drift",
          "tiny-harbors",
          "orbit-golf",
          "paper-knights",
          "mossy-trails",
          "pixel-regatta",
        ],
      },
    ],
  },
  create: {
    stories: [
      story(
        "draw-anything",
        "Featured App",
        "Draw Anything",
        "Inkwell Studio gives every brush a little weight.",
        "tiles",
      ),
      story(
        "edit-like-a-pro",
        "How To",
        "Grade a Photo in a Minute",
        "Three sliders in Chromatica do most of the work.",
        "bars",
      ),
    ],
    collections: [
      {
        id: "creative-essentials",
        title: "Essential Creative Apps",
        apps: [
          "inkwell-studio",
          "chromatica",
          "loopsmith",
          "framecraft",
          "glyphworks",
          "clay-sketch",
        ],
      },
    ],
  },
  work: {
    stories: [
      story(
        "stay-on-task",
        "Collection",
        "Stay on Task",
        "Planners and timers for a week that holds together.",
        "orbits",
      ),
      story(
        "paperwork",
        "Featured App",
        "Paperwork, Done",
        "Docket scans, signs and sends before the kettle boils.",
        "bars",
      ),
    ],
    collections: [
      {
        id: "get-more-done",
        title: "Get More Done",
        apps: ["ledgerly", "meeting-tide", "taskfield", "docket", "sheetwise", "mailroom-pro"],
      },
    ],
  },
  play: {
    stories: [
      story(
        "weekend-quests",
        "Collection",
        "Weekend Quests",
        "Long campaigns for a short holiday.",
        "arcs",
      ),
      story(
        "quick-rounds",
        "Editors' Choice",
        "Five-Minute Rounds",
        "Goal Rush fits a whole match into a coffee break.",
        "tiles",
      ),
    ],
    collections: [
      {
        id: "games-we-are-playing",
        title: "Games We Are Playing",
        apps: [
          "castle-circuit",
          "dune-racers",
          "word-orchard",
          "starfall-tactics",
          "puzzle-pier",
          "goal-rush",
        ],
      },
    ],
  },
  develop: {
    stories: [
      story(
        "ship-faster",
        "Collection",
        "Ship Faster",
        "Tools that take the waiting out of a release.",
        "orbits",
      ),
      story(
        "see-the-wire",
        "Featured App",
        "See the Wire",
        "Packet Peek shows every request your app makes.",
        "arcs",
      ),
    ],
    collections: [
      {
        id: "developer-essentials",
        title: "Developer Essentials",
        apps: [
          "branchline",
          "regex-garden",
          "packet-peek",
          "schema-loom",
          "hex-lantern",
          "build-barn",
        ],
      },
    ],
  },
};

/** The Updates page: what waits for an update, and what was updated lately. */
export const UPDATES: readonly AppStoreCollection[] = [
  { id: "pending", title: "Pending", apps: ["harbor-notes", "pocket-atlas", "tempo-trainer"] },
  {
    id: "updated-recently",
    title: "Updated Recently",
    apps: ["kiln", "quill-reader", "ridge-timer"],
  },
];

/** The categories of the catalogue, by name, each with the glyph of its row. */
export const CATEGORIES: readonly { name: string; glyph: AppStoreGlyph; color: AppStoreColor }[] = [
  { name: "Books", glyph: "pen", color: "brown" },
  { name: "Business", glyph: "chart", color: "green" },
  { name: "Developer Tools", glyph: "brackets", color: "indigo" },
  { name: "Games", glyph: "dice", color: "red" },
  { name: "Graphics & Design", glyph: "brush", color: "pink" },
  { name: "Health & Fitness", glyph: "bolt", color: "orange" },
  { name: "Lifestyle", glyph: "leaf", color: "teal" },
  { name: "Music", glyph: "wave", color: "purple" },
  { name: "Navigation", glyph: "flag", color: "blue" },
  { name: "Photo & Video", glyph: "film", color: "gray" },
  { name: "Productivity", glyph: "note", color: "yellow" },
  { name: "Utilities", glyph: "grid", color: "indigo" },
  { name: "Weather", glyph: "bolt", color: "teal" },
];

/** How many apps of the catalogue are listed in a category. */
export const categoryCount = (category: string): number =>
  APPS.filter((item) => item.category === category).length;

/**
 * Whether an app answers a search: its name, the line under it or its category contains the
 * text, whatever its case.
 */
export function appMatches(item: AppStoreApp, query: string): boolean {
  const text = query.trim().toLowerCase();
  return (
    text !== "" &&
    [item.title, item.subtitle, item.category].some((field) => field.toLowerCase().includes(text))
  );
}

/** What a click on an app's offer button leads to, after the offer itself. */
export type AppStoreOfferStep = "confirm" | "downloading" | "open";

/** Where an app's offer stands: the step, and the share of the download that has arrived. */
export interface AppStoreOffer {
  /** The step after the offer. */
  step: AppStoreOfferStep;
  /** Download progress from 0 to 1; read while the step is `"downloading"`. */
  progress: number;
}

/** Every app's offer that has moved on from where the catalogue has it, by app `id`. */
export type AppStoreOffers = Readonly<Record<string, AppStoreOffer>>;

/** What the offer button of an app does next. */
export type AppStoreOfferAction =
  | { type: "press"; app: AppStoreApp }
  | { type: "revert"; app: AppStoreApp }
  | { type: "remove"; app: AppStoreApp }
  | { type: "start"; apps: readonly AppStoreApp[] }
  | { type: "tick" };

/** The share of a download that arrives with every tick of the timer. */
export const DOWNLOAD_STEP = 0.1;
/** Milliseconds between two ticks of a download. */
export const DOWNLOAD_INTERVAL = 150;

/** The title of the button that confirms an offer: `Install` for a free app, else `Buy App`. */
export const confirmTitle = (item: AppStoreApp): string =>
  item.offer === "Get" ? "Install" : "Buy App";

/** Whether an app is installed: its download finished, or the catalogue lists it as `Open`. */
export const isInstalled = (item: AppStoreApp, offers: AppStoreOffers): boolean =>
  offers[item.id]?.step === "open" || (item.offer === "Open" && offers[item.id] === undefined);

/**
 * The purchase sequence, as the store runs it: an offer is confirmed (`Install`, `Buy App`),
 * then downloads, then the app can be opened. An update downloads at once. A press on a
 * download stops it and brings the offer back.
 */
export function reduceOffers(offers: AppStoreOffers, action: AppStoreOfferAction): AppStoreOffers {
  if (action.type === "tick") {
    let changed = false;
    const next: Record<string, AppStoreOffer> = {};
    for (const [id, offer] of Object.entries(offers)) {
      if (offer.step !== "downloading") {
        next[id] = offer;
        continue;
      }
      changed = true;
      // Rounded, so that ten steps of a tenth end at 1 and not just under it.
      const progress = Math.round((offer.progress + DOWNLOAD_STEP) * 100) / 100;
      next[id] = progress >= 1 ? { step: "open", progress: 1 } : { step: "downloading", progress };
    }
    return changed ? next : offers;
  }
  if (action.type === "start") {
    const next: Record<string, AppStoreOffer> = { ...offers };
    for (const item of action.apps) {
      if (item.offer !== "Open" && offers[item.id]?.step !== "open")
        next[item.id] =
          offers[item.id]?.step === "downloading"
            ? (offers[item.id] as AppStoreOffer)
            : { step: "downloading", progress: 0 };
    }
    return next;
  }
  const { app: item } = action;
  const current = offers[item.id];
  const without = () => {
    const { [item.id]: _, ...rest } = offers;
    return rest;
  };
  if (action.type === "revert") return current?.step === "confirm" ? without() : offers;
  // An app removed from the library (Launchpad's delete button, Uninstall) is offered again.
  if (action.type === "remove") return current === undefined ? offers : without();
  if (current?.step === "open" || item.offer === "Open") return offers;
  if (current?.step === "downloading") return without();
  if (current?.step === "confirm" || item.offer === "Update")
    return { ...offers, [item.id]: { step: "downloading", progress: 0 } };
  return { ...offers, [item.id]: { step: "confirm", progress: 0 } };
}
