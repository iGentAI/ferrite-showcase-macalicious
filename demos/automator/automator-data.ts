/*
 * Automator's library and the logic of a workflow, with no interface in it: the categories, the
 * actions and the variables; what a category lists and what a search leaves of it; and the
 * workflow as a state that events move, so that a run is the same every time.
 *
 * The 34 actions the reference screenshots list carry the names Automator gives them; their
 * descriptions, except Activate Fonts', and every other action and variable are invented.
 */

/** The two libraries the switch above the lists chooses between. */
export type AutomatorLibraryKind = "actions" | "variables";

/** The tint of a placeholder icon: which category something belongs to, and nothing more. */
export type AutomatorTint =
  | "neutral"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "indigo"
  | "purple"
  | "pink"
  | "brown";

/** A row of the Library outline. */
export interface AutomatorCategory {
  /** Identifies the category: in the selection and in an item's `category`. */
  id: string;
  /** The row's title. */
  name: string;
  /** The tint of its placeholder icon. */
  tint: AutomatorTint;
  /** The categories inside this one. */
  children?: readonly AutomatorCategory[];
}

/** What the two kinds of library item share. */
export interface AutomatorItem {
  /** Identifies the item: the name in lower case, words joined by hyphens. */
  id: string;
  /** The name the list shows. */
  name: string;
  /** Id of the category that lists it. */
  category: string;
  /** What the description pane says about it. */
  description: string;
}

/** An action: one step a workflow can take. */
export interface AutomatorAction extends AutomatorItem {
  /** What the action takes from the step before it. */
  input: string;
  /** What it hands to the next step. */
  result: string;
  /** The action's version. */
  version: string;
}

/** A variable: a value a workflow can store and use. */
export interface AutomatorVariable extends AutomatorItem {
  /** The value it stands for, as the Variables list shows it. */
  value: string;
}

/** One library: its outline, its items, and the groups that are not categories. */
export interface AutomatorLibrary<Item extends AutomatorItem = AutomatorItem> {
  /** Id of the row that lists everything. An id that names no row stands for this one. */
  root: string;
  /** The outline's top-level rows. */
  categories: readonly AutomatorCategory[];
  /** Every item, in order of name. */
  items: readonly Item[];
  /** Rows that list chosen items whatever their category: row id to item ids. */
  groups: Readonly<Record<string, readonly string[]>>;
}

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* Names are ordered as Automator's list is: letter case does not count ("Ask For Servers"
   stands between "Ask for Photos" and "Ask for Songs"). Code units, so the order is the same
   in every locale. */
const byName = (a: AutomatorItem, b: AutomatorItem) => {
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

const action = (
  name: string,
  category: string,
  input: string,
  result: string,
  description: string,
  version = "1.0",
): AutomatorAction => ({ id: slug(name), name, category, input, result, description, version });

const variable = (
  name: string,
  category: string,
  value: string,
  description: string,
): AutomatorVariable => ({ id: slug(name), name, category, value, description });

const FILES = "Files/Folders";
const IMAGES = "Image files";
const PDFS = "PDF files";
const TEXT = "Text";
const ANYTHING = "Anything";
const NOTHING = "Nothing";

/** The actions outline: Library with Automator's thirteen categories, and two groups. */
export const actionCategories: readonly AutomatorCategory[] = [
  {
    id: "library",
    name: "Library",
    tint: "neutral",
    children: [
      { id: "calendar", name: "Calendar", tint: "red" },
      { id: "contacts", name: "Contacts", tint: "brown" },
      { id: "developer", name: "Developer", tint: "neutral" },
      { id: "files", name: "Files & Folders", tint: "blue" },
      { id: "fonts", name: "Fonts", tint: "neutral" },
      { id: "internet", name: "Internet", tint: "indigo" },
      { id: "mail", name: "Mail", tint: "teal" },
      { id: "movies", name: "Movies", tint: "blue" },
      { id: "music", name: "Music", tint: "pink" },
      { id: "pdfs", name: "PDFs", tint: "orange" },
      { id: "photos", name: "Photos", tint: "yellow" },
      { id: "text", name: "Text", tint: "green" },
      { id: "utilities", name: "Utilities", tint: "neutral" },
    ],
  },
  { id: "most-used", name: "Most Used", tint: "purple" },
  { id: "recently-added", name: "Recently Added", tint: "purple" },
];

/**
 * Every action, in order of name. The first 34 are the ones the reference screenshots list,
 * under the names Automator gives them: the capture cuts four of them in the middle to fit its
 * column ("Apply Quartz Co…ter to Image Files"); the names here are whole.
 */
export const defaultActions: readonly AutomatorAction[] = [
  action(
    "Activate Fonts",
    "fonts",
    "Font Book typeface",
    "Font Book typeface",
    "This action activates the fonts passed from the previous action.",
    "5.0",
  ),
  action(
    "Add Attachments to Front Message",
    "mail",
    FILES,
    "Mail messages",
    "This action attaches the files passed from the previous action to the frontmost message.",
    "2.1",
  ),
  action(
    "Add Grid to PDF Documents",
    "pdfs",
    PDFS,
    PDFS,
    "This action draws a measuring grid over every page of the PDF documents passed to it.",
    "1.2",
  ),
  action(
    "Add Songs to Playlist",
    "music",
    "Music songs",
    "Music songs",
    "This action adds the songs passed from the previous action to a playlist.",
    "3.0",
  ),
  action(
    "Add to Album",
    "photos",
    "Photos media items",
    "Photos media items",
    "This action adds the photos and videos passed from the previous action to an album.",
    "1.1",
  ),
  action(
    "Add to Font Library",
    "fonts",
    "Font files",
    "Font Book typeface",
    "This action installs the font files passed from the previous action in a font library.",
    "5.0",
  ),
  action(
    "Apple Versioning Tool",
    "developer",
    FILES,
    FILES,
    "This action sets or raises the version number of the project it is passed.",
    "1.3",
  ),
  action(
    "Apply ColorSync Profile to Images",
    "photos",
    IMAGES,
    IMAGES,
    "This action applies a colour profile to the images passed from the previous action.",
    "1.2",
  ),
  action(
    "Apply Quartz Composition Filter to Image Files",
    "photos",
    IMAGES,
    IMAGES,
    "This action renders the images passed to it through a composition used as a filter.",
    "1.4",
  ),
  action(
    "Apply Quartz Filter to PDF Documents",
    "pdfs",
    PDFS,
    PDFS,
    "This action applies a filter, such as a tone or a size reduction, to PDF documents.",
    "1.2",
  ),
  action(
    "Apply SQL",
    "developer",
    TEXT,
    TEXT,
    "This action runs the statements passed from the previous action against a database file, and passes on the rows they return.",
    "1.0",
  ),
  action(
    "Ask for Confirmation",
    "utilities",
    ANYTHING,
    ANYTHING,
    "This action asks whether the workflow should go on, and stops it when the answer is no.",
    "1.3",
  ),
  action(
    "Ask for Finder Items",
    "files",
    FILES,
    FILES,
    "This action lets the person running the workflow choose files or folders.",
    "1.3",
  ),
  action(
    "Ask for Movies",
    "movies",
    NOTHING,
    "Movie files",
    "This action lets the person running the workflow choose movies.",
    "1.2",
  ),
  action(
    "Ask for Photos",
    "photos",
    NOTHING,
    "Photos media items",
    "This action lets the person running the workflow choose photos.",
    "1.2",
  ),
  action(
    "Ask For Servers",
    "files",
    NOTHING,
    "URLs",
    "This action lets the person running the workflow choose servers on the network.",
    "1.1",
  ),
  action(
    "Ask for Songs",
    "music",
    NOTHING,
    "Music songs",
    "This action lets the person running the workflow choose songs.",
    "1.2",
  ),
  action(
    "Ask for Text",
    "text",
    TEXT,
    TEXT,
    "This action asks for a line of text and passes the answer to the next action.",
    "1.2",
  ),
  action(
    "Burn a Disc",
    "utilities",
    FILES,
    FILES,
    "This action writes the files passed from the previous action to a recordable disc.",
    "1.1",
  ),
  action(
    "Change System Appearance",
    "utilities",
    ANYTHING,
    ANYTHING,
    "This action switches the system between the light and the dark appearance.",
    "1.0",
  ),
  action(
    "Change Type of Images",
    "photos",
    IMAGES,
    IMAGES,
    "This action converts the images passed from the previous action to another format.",
    "1.2",
  ),
  action(
    "Choose from List",
    "utilities",
    ANYTHING,
    ANYTHING,
    "This action shows what it is passed as a list and passes on the chosen items.",
    "1.1",
  ),
  action(
    "Combine PDF Pages",
    "pdfs",
    PDFS,
    PDFS,
    "This action joins the PDF documents passed from the previous action into one document.",
    "1.2",
  ),
  action(
    "Combine Text Files",
    "text",
    "Text files",
    TEXT,
    "This action joins the text of the files passed from the previous action.",
    "1.1",
  ),
  action(
    "Compress Images in PDF Documents",
    "pdfs",
    PDFS,
    PDFS,
    "This action makes PDF documents smaller by compressing the images in them.",
    "1.2",
  ),
  action(
    "Connect to Servers",
    "files",
    "URLs",
    FILES,
    "This action connects to the servers passed from the previous action.",
    "1.1",
  ),
  action(
    "Convert CSV to SQL",
    "developer",
    TEXT,
    TEXT,
    "This action turns comma-separated values into statements that fill a database table.",
    "1.0",
  ),
  action(
    "Convert Quartz Compositions to QuickTime Movies",
    "movies",
    FILES,
    "Movie files",
    "This action renders the compositions passed from the previous action as movies.",
    "1.3",
  ),
  action(
    "Copy Finder Items",
    "files",
    FILES,
    FILES,
    "This action copies the files and folders passed from the previous action to a folder.",
    "1.3",
  ),
  action(
    "Copy to Clipboard",
    "utilities",
    ANYTHING,
    ANYTHING,
    "This action puts what the previous action passes on the Clipboard.",
    "1.1",
  ),
  action(
    "Create Annotated Movie File",
    "movies",
    "Movie files",
    "Movie files",
    "This action saves a movie with a title, a description and other annotations.",
    "1.2",
  ),
  action(
    "Create Archive",
    "files",
    FILES,
    FILES,
    "This action compresses the files and folders passed from the previous action.",
    "1.3",
  ),
  action(
    "Create Banner Image from Text",
    "photos",
    TEXT,
    IMAGES,
    "This action sets the text passed from the previous action as a banner image.",
    "1.1",
  ),
  action(
    "Create Package",
    "developer",
    FILES,
    FILES,
    "This action builds an installer package from the files passed to it.",
    "1.2",
  ),
  // Invented: what follows the capture's last row, with something for every category.
  action(
    "Crop Images",
    "photos",
    IMAGES,
    IMAGES,
    "This action crops the images passed from the previous action to a size.",
  ),
  action(
    "Delete Calendar Events",
    "calendar",
    "Calendar events",
    NOTHING,
    "This action deletes the events passed from the previous action.",
  ),
  action(
    "Display Notification",
    "utilities",
    ANYTHING,
    ANYTHING,
    "This action shows a notification with a title and a message.",
  ),
  action(
    "Display Webpages",
    "internet",
    "URLs",
    "URLs",
    "This action opens the addresses passed from the previous action in the web browser.",
  ),
  action(
    "Download URLs",
    "internet",
    "URLs",
    FILES,
    "This action downloads what the addresses passed from the previous action point to.",
  ),
  action(
    "Find Calendar Items",
    "calendar",
    "Calendar items",
    "Calendar items",
    "This action finds the calendars, events or reminders that match its conditions.",
  ),
  action(
    "Find Contacts Items",
    "contacts",
    "Contacts items",
    "Contacts items",
    "This action finds the people or groups that match its conditions.",
  ),
  action(
    "Get Contact Information",
    "contacts",
    "Contacts people",
    TEXT,
    "This action collects chosen details of the people passed from the previous action.",
  ),
  action(
    "Get Current Webpage from Browser",
    "internet",
    NOTHING,
    "URLs",
    "This action passes on the address of the page shown in the frontmost browser window.",
  ),
  action(
    "Get Selected Finder Items",
    "files",
    NOTHING,
    FILES,
    "This action passes on the files and folders selected in the frontmost Finder window.",
  ),
  action(
    "Get Specified Text",
    "text",
    NOTHING,
    TEXT,
    "This action passes the text typed into it to the next action.",
  ),
  action(
    "New Calendar Events",
    "calendar",
    TEXT,
    "Calendar events",
    "This action adds an event to a calendar.",
  ),
  action(
    "New Mail Message",
    "mail",
    ANYTHING,
    "Mail messages",
    "This action starts a message addressed and titled as the action says.",
  ),
  action(
    "Open Finder Items",
    "files",
    FILES,
    FILES,
    "This action opens the files passed from the previous action.",
  ),
  action(
    "Pause",
    "utilities",
    ANYTHING,
    ANYTHING,
    "This action waits for a time before the workflow goes on.",
  ),
  action(
    "Play Movies",
    "movies",
    "Movie files",
    "Movie files",
    "This action plays the movies passed from the previous action.",
  ),
  action(
    "Rename Finder Items",
    "files",
    FILES,
    FILES,
    "This action changes the names of the files and folders passed to it.",
  ),
  action(
    "Run Shell Script",
    "utilities",
    TEXT,
    TEXT,
    "This action runs a shell script with what the previous action passes as its input.",
  ),
  action(
    "Send Birthday Greetings",
    "mail",
    "Contacts people",
    "Mail messages",
    "This action writes a greeting to the people whose birthday is today.",
  ),
  action(
    "Speak Text",
    "text",
    TEXT,
    TEXT,
    "This action reads the text passed from the previous action aloud.",
  ),
  action(
    "Take Screenshot",
    "utilities",
    NOTHING,
    IMAGES,
    "This action takes a picture of the screen.",
  ),
  action(
    "Watch Me Do",
    "utilities",
    ANYTHING,
    ANYTHING,
    "This action repeats what was done while Record was on.",
  ),
  action(
    "Watermark PDF Documents",
    "pdfs",
    PDFS,
    PDFS,
    "This action draws an image over every page of the PDF documents passed to it.",
  ),
].sort(byName);

/** The action Record adds to the workflow when a recording ends. */
export const RECORDED_ACTION_ID = "watch-me-do";

/** The actions library: the outline, the catalogue and the two groups. */
export const actionLibrary: AutomatorLibrary<AutomatorAction> = {
  root: "library",
  categories: actionCategories,
  items: defaultActions,
  groups: {
    "most-used": [
      "ask-for-finder-items",
      "copy-finder-items",
      "get-selected-finder-items",
      "rename-finder-items",
      "run-shell-script",
    ],
    "recently-added": ["change-system-appearance", "display-notification", "take-screenshot"],
  },
};

/** The variables library. Invented: no screenshot shows it. */
export const variableLibrary: AutomatorLibrary<AutomatorVariable> = {
  root: "variables",
  categories: [
    {
      id: "variables",
      name: "Variables",
      tint: "neutral",
      children: [
        { id: "date-time", name: "Date & Time", tint: "red" },
        { id: "locations", name: "Locations", tint: "blue" },
        { id: "system", name: "System", tint: "neutral" },
        { id: "text-data", name: "Text & Data", tint: "green" },
        { id: "user", name: "User", tint: "brown" },
      ],
    },
  ],
  items: [
    variable("Current day", "date-time", "Thursday", "The name of the day the workflow runs on."),
    variable(
      "Current month",
      "date-time",
      "October",
      "The name of the month the workflow runs in.",
    ),
    variable("Current time", "date-time", "9:41 AM", "The time at which the workflow runs."),
    variable("Today's date", "date-time", "10/3/19", "The date on which the workflow runs."),
    variable(
      "Applications",
      "locations",
      "/Applications",
      "The folder that holds the applications.",
    ),
    variable("Desktop", "locations", "~/Desktop", "The Desktop folder of the person logged in."),
    variable(
      "Documents",
      "locations",
      "~/Documents",
      "The Documents folder of the person logged in.",
    ),
    variable(
      "Downloads",
      "locations",
      "~/Downloads",
      "The Downloads folder of the person logged in.",
    ),
    variable("Home", "locations", "~", "The home folder of the person logged in."),
    variable("Computer name", "system", "MacBook Pro", "The name the computer has on the network."),
    variable("Operating system version", "system", "10.15", "The version of macOS in use."),
    variable("New text", "text-data", "Text", "Text typed once and used wherever it is needed."),
    variable("Random number", "text-data", "42", "A number chosen anew for each run."),
    variable("Storage", "text-data", "Empty", "Keeps what one action passes until a later one."),
    variable("Full name", "user", "Sam Rivers", "The name of the person logged in."),
    variable("Short name", "user", "sam", "The account name of the person logged in."),
  ].sort(byName),
  groups: {},
};

/** The library the switch names. */
export function libraryOf(kind: AutomatorLibraryKind): AutomatorLibrary {
  return kind === "variables" ? variableLibrary : actionLibrary;
}

/**
 * The row of a library's outline with this id, and its parent. An id that names no row stands
 * for the root, here and so everywhere a category is asked for.
 */
export function findCategory(
  library: AutomatorLibrary,
  id: string | undefined,
): { category: AutomatorCategory; parent: AutomatorCategory | undefined } {
  let root: AutomatorCategory | undefined;
  for (const top of library.categories) {
    if (top.id === id) return { category: top, parent: undefined };
    if (top.id === library.root) root = top;
    for (const child of top.children ?? []) {
      if (child.id === id) return { category: child, parent: top };
    }
  }
  const fallback = root ?? library.categories[0];
  if (!fallback) throw new Error("A library needs at least one category.");
  return { category: fallback, parent: undefined };
}

/**
 * The tint of the category an item belongs to, in its own library: a step keeps its action's
 * tint whichever library the window shows.
 */
export function tintOf(library: AutomatorLibrary, item: AutomatorItem): AutomatorTint {
  return findCategory(library, item.category).category.tint;
}

/**
 * What a row of the outline lists, in order of name: the root everything, a group its chosen
 * items, a category its own; of those, the items whose name contains the search text, in any
 * letter case. Text that is only spaces searches for nothing.
 */
export function listItems<Item extends AutomatorItem>(
  library: AutomatorLibrary<Item>,
  categoryId: string | undefined,
  query = "",
): readonly Item[] {
  const { category } = findCategory(library, categoryId);
  const group = library.groups[category.id];
  const wanted = query.trim().toLowerCase();
  return library.items.filter(
    (item) =>
      (category.id === library.root ||
        (group ? group.includes(item.id) : item.category === category.id)) &&
      (wanted === "" || item.name.toLowerCase().includes(wanted)),
  );
}

const actionsById = new Map(defaultActions.map((entry) => [entry.id, entry]));
const variablesById = new Map(variableLibrary.items.map((entry) => [entry.id, entry]));

/** The action with this id, if the catalogue has one. */
export function findAction(id: string | undefined): AutomatorAction | undefined {
  return id === undefined ? undefined : actionsById.get(id);
}

/** The variable with this id, if the catalogue has one. */
export function findVariable(id: string | undefined): AutomatorVariable | undefined {
  return id === undefined ? undefined : variablesById.get(id);
}

/**
 * How long an action takes when a workflow runs it, in milliseconds. Nothing is run and
 * nothing is timed: the time is 25 ms for each character of the action's name, so a run logs
 * the same durations every time.
 */
export function durationOf(entry: AutomatorAction): number {
  return entry.name.length * 25;
}

/** A duration as the Log's second column shows it: seconds to three places. */
export function formatDuration(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(3)} seconds`;
}

/** One step of a workflow: an action, and a key that tells two steps of one action apart. */
export interface AutomatorStep {
  /** Unique among the steps a workflow ever had. */
  key: number;
  /** Id of the step's action. */
  actionId: string;
}

/** One row of the Log. */
export interface AutomatorLogEntry {
  /** Unique among the rows of a workflow's log. */
  key: number;
  /** What happened. */
  text: string;
  /** How long it took, in milliseconds. */
  duration: number;
}

/**
 * A workflow and where its run stands. `status` is `"running"` while Run goes from step to
 * step, `"paused"` between two steps of a run that Step takes one at a time, and `"idle"`
 * otherwise. `cursor` is the index of the step that runs next; after a run that finished it is
 * the number of steps, and after a run that was stopped it stays where the run stopped, so
 * every step that ran counts as done until the next run. `run` counts the runs that started.
 */
export interface AutomatorWorkflow {
  steps: readonly AutomatorStep[];
  /** Ids of the workflow's variables, in the order they were added. */
  variables: readonly string[];
  log: readonly AutomatorLogEntry[];
  status: "idle" | "running" | "paused";
  cursor: number;
  /** The number of runs that have started; a new run starts a new log. */
  run: number;
  /** Milliseconds the steps of the current run have taken so far. */
  elapsed: number;
  /** Whether Record is on. */
  recording: boolean;
  /** The key the next step or log row gets. */
  nextKey: number;
}

/** What can happen to a workflow. */
export type AutomatorEvent =
  /** Append a step for an action. An id that names no action changes nothing. */
  | { type: "add"; actionId: string }
  /** Take a step out. */
  | { type: "remove"; key: number }
  /** Take every step out. */
  | { type: "clear" }
  /** Add a variable, once. An id that names no variable changes nothing. */
  | { type: "add-variable"; id: string }
  /** Start a run, or go on with a paused one. `instant` finishes it at once. */
  | { type: "run"; instant?: boolean }
  /** Run the next step of a run that Run started. */
  | { type: "advance" }
  /** Run every step that is left of a run that Run started. */
  | { type: "finish" }
  /** Run one step and pause. */
  | { type: "step" }
  /** Stop the run, or end the recording. */
  | { type: "stop" }
  /** Start a recording, or end it. */
  | { type: "record" };

/** A workflow with a step for each of these actions; ids that name no action are left out. */
export function createWorkflow(actionIds: readonly string[] = []): AutomatorWorkflow {
  const steps = actionIds
    .filter((id) => actionsById.has(id))
    .map((actionId, key): AutomatorStep => ({ key, actionId }));
  return {
    steps,
    variables: [],
    log: [],
    status: "idle",
    cursor: 0,
    run: 0,
    elapsed: 0,
    recording: false,
    nextKey: steps.length,
  };
}

const logged = (state: AutomatorWorkflow, text: string, duration: number): AutomatorWorkflow => ({
  ...state,
  log: [...state.log, { key: state.nextKey, text, duration }],
  nextKey: state.nextKey + 1,
});

const appended = (state: AutomatorWorkflow, actionId: string): AutomatorWorkflow => ({
  ...state,
  steps: [...state.steps, { key: state.nextKey, actionId }],
  nextKey: state.nextKey + 1,
});

/* Run the step at the cursor: a row for it and, after the last step, a row for the run. */
function runStep(state: AutomatorWorkflow, pause: boolean): AutomatorWorkflow {
  const step = state.steps[state.cursor];
  const entry = findAction(step?.actionId);
  if (!entry) return { ...state, status: "idle", cursor: 0 };
  const duration = durationOf(entry);
  const elapsed = state.elapsed + duration;
  const cursor = state.cursor + 1;
  const next = logged({ ...state, cursor, elapsed }, `${entry.name} completed`, duration);
  if (cursor < state.steps.length) return { ...next, status: pause ? "paused" : "running" };
  return logged({ ...next, status: "idle" }, "Workflow completed", elapsed);
}

/* The end of a run before its last step: the steps that ran keep their mark. */
const stopped = (state: AutomatorWorkflow): AutomatorWorkflow =>
  logged({ ...state, status: "idle" }, "Workflow stopped", state.elapsed);

/* The start of a run: an empty log, the first step next. */
const fresh = (state: AutomatorWorkflow): AutomatorWorkflow => ({
  ...state,
  log: [],
  cursor: 0,
  run: state.run + 1,
  elapsed: 0,
});

/** Whether Run and Step can start: there is a step, nothing is running and Record is off. */
export function canRun(state: AutomatorWorkflow): boolean {
  return state.steps.length > 0 && state.status !== "running" && !state.recording;
}

/** Whether Stop has something to stop: a run in progress, or a recording. */
export function canStop(state: AutomatorWorkflow): boolean {
  return state.status !== "idle" || state.recording;
}

/** Whether a step has run, is running or is still to run: for the mark beside its number. */
export function stepState(state: AutomatorWorkflow, index: number): "done" | "running" | "pending" {
  if (index < state.cursor) return "done";
  return index === state.cursor && state.status === "running" ? "running" : "pending";
}

/** The workflow after an event. An event that does not apply returns the same workflow. */
export function reduceWorkflow(state: AutomatorWorkflow, event: AutomatorEvent): AutomatorWorkflow {
  switch (event.type) {
    case "add":
      return actionsById.has(event.actionId) ? appended(state, event.actionId) : state;
    case "remove":
    case "clear": {
      const index =
        event.type === "remove" ? state.steps.findIndex((step) => step.key === event.key) : 0;
      if (index < 0 || state.steps.length === 0) return state;
      const steps = event.type === "remove" ? state.steps.filter((_, at) => at !== index) : [];
      // The cursor stays on the step it was on. A run with no step left to take is over.
      const cursor = Math.min(
        event.type === "remove" && index < state.cursor ? state.cursor - 1 : state.cursor,
        steps.length,
      );
      const next = { ...state, steps, cursor };
      return state.status !== "idle" && cursor >= steps.length ? stopped(next) : next;
    }
    case "add-variable":
      return variablesById.has(event.id) && !state.variables.includes(event.id)
        ? { ...state, variables: [...state.variables, event.id] }
        : state;
    case "run": {
      if (!canRun(state)) return state;
      let next: AutomatorWorkflow = {
        ...(state.status === "paused" ? state : fresh(state)),
        status: "running",
      };
      while (event.instant && next.status === "running") next = runStep(next, false);
      return next;
    }
    case "advance":
      return state.status === "running" ? runStep(state, false) : state;
    case "finish": {
      let next = state;
      while (next.status === "running") next = runStep(next, false);
      return next;
    }
    case "step":
      return canRun(state)
        ? runStep(state.status === "paused" ? state : fresh(state), true)
        : state;
    case "stop":
      if (state.recording) return appended({ ...state, recording: false }, RECORDED_ACTION_ID);
      return state.status === "idle" ? state : stopped(state);
    case "record":
      if (state.recording) return appended({ ...state, recording: false }, RECORDED_ACTION_ID);
      return state.status === "idle" ? { ...state, recording: true } : state;
  }
}
