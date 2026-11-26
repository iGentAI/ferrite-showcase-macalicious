import { requestDesktopEffects } from "../desktop/desktop-effects";
import {
  childrenOf,
  type Drive,
  type DriveEntry,
  entryOf,
  homeFolders,
  loadDrive,
  pathOf,
  readFile,
  runOps,
  uploadFile,
} from "../desktop/desktop-files";
import { sessionFetch } from "../desktop/desktop-server";
import { type ArchiveFile, zipBlob } from "../finder/finder-archive";
import { findAction, formatDuration } from "./automator-data";
import {
  type DraftStep,
  type FileItem,
  handedOn,
  itemText,
  type LogRow,
  logRows,
  type ParamDraft,
  type RunItem,
  type RunLog,
  type RunOutcome,
  type ServerAction,
  type ServerParam,
  type StepLog,
} from "./automator-server";

/*
 * What the served Automator does in the page rather than on the server: the actions that ask the
 * person something or need the browser, the rest of the real library as rows that say why they do
 * not run, the variables, and a run that goes through the server in parts with those in between.
 */

const param = (name: string, kind: string, summary = "", required = false): ServerParam => ({
  name,
  kind,
  required,
  summary,
});

const pageAction = (
  id: string,
  title: string,
  app: string,
  summary: string,
  takes_input: boolean,
  writes: boolean,
  params: ServerParam[] = [],
): ServerAction => ({
  name: `page.${id}`,
  title,
  app,
  summary,
  takes_input,
  writes,
  params,
});

export const LOOP = "page.loop";
const LOOP_ASK = "Ask to Continue";
const LOOP_TIMES = "Loop Automatically";
/** How many times a Loop goes round at most, whatever it says: a run must end. */
const MOST_LOOPS = 100;

const FOLDERS = "choice:Desktop|Documents|Downloads|Movies|Music|Pictures";
const whereTo = (summary: string) => param("to", "text", summary, true);

/** The actions this page carries out itself. */
export const PAGE_ACTIONS: readonly ServerAction[] = [
  pageAction(
    "ask-confirmation",
    "Ask for Confirmation",
    "utilities",
    "Asks whether the workflow should go on, and stops it on Cancel. Its input goes on unchanged.",
    true,
    false,
    [param("title", "text", "The question"), param("message", "text", "More about it")],
  ),
  pageAction(
    "ask-text",
    "Ask for Text",
    "text",
    "Asks for a line of text and hands the answer on.",
    false,
    false,
    [
      param("question", "text", "What to ask"),
      param("default", "text", "The answer at first"),
      param("require an answer", "boolean"),
    ],
  ),
  pageAction(
    "choose-list",
    "Choose from List",
    "utilities",
    "Shows the input as a list and hands on the items chosen.",
    true,
    false,
    [param("prompt", "text", "What to ask"), param("allow several", "boolean")],
  ),
  pageAction(
    "copy-clipboard",
    "Copy to Clipboard",
    "utilities",
    "Puts the input on the Clipboard, a line for each item, and hands it on.",
    true,
    false,
  ),
  pageAction(
    "get-variable",
    "Get Value of Variable",
    "utilities",
    "Adds what a variable holds to the input.",
    true,
    false,
    [param("variable", "text", "Its name", true)],
  ),
  pageAction(
    "set-variable",
    "Set Value of Variable",
    "utilities",
    "Keeps the input in a variable for the rest of the run, and hands it on.",
    true,
    false,
    [param("variable", "text", "Its name", true)],
  ),
  pageAction(
    "loop",
    "Loop",
    "utilities",
    "Goes back to the first action, as often as it says or for as long as you say so.",
    true,
    false,
    [
      param("mode", `choice:${LOOP_ASK}|${LOOP_TIMES}`, "How it goes on", true),
      param("times", "number", "How many times in all"),
      param("use the results as input", "boolean"),
    ],
  ),
  pageAction(
    "csv-sql",
    "Convert CSV to SQL",
    "developer",
    "Turns comma-separated lines into statements that fill a table, one statement for each line.",
    true,
    false,
    [
      param("table", "text", "The table's name", true),
      param("first line names the columns", "boolean"),
    ],
  ),
  pageAction(
    "display-webpages",
    "Display Webpages",
    "internet",
    "Opens the addresses in the input, or the one it names, as tabs of a new Safari window.",
    true,
    false,
    [param("address", "text", "https://…")],
  ),
  pageAction(
    "specified-finder-items",
    "Get Specified Finder Items",
    "files",
    "Hands on the files and folders it names, a path for each line. Drop them here from Finder.",
    true,
    false,
    [param("paths", "code", "Documents/Notes.txt")],
  ),
  pageAction(
    "ask-finder-items",
    "Ask for Finder Items",
    "files",
    "Shows the Open dialog and adds the file chosen to the input.",
    true,
    false,
    [param("start at", FOLDERS, "The folder it shows first", true)],
  ),
  pageAction(
    "ask-movies",
    "Ask for Movies",
    "movies",
    "Shows the Open dialog on your Movies folder, or the list of every movie on your drive, and adds the movies chosen to the input.",
    true,
    false,
    [param("show", "choice:Open Dialog|Media List", "", true)],
  ),
  pageAction(
    "ask-photos",
    "Ask for Photos",
    "photos",
    "Shows the Open dialog on your Pictures folder, or the list of every picture on your drive, which holds Photos' files, and adds the pictures chosen to the input.",
    true,
    false,
    [param("show", "choice:Open Dialog|Media List", "", true)],
  ),
  pageAction(
    "ask-songs",
    "Ask for Songs",
    "music",
    "Shows the Open dialog on your Music folder, or the list of every song on your drive, which holds Music's files, and adds the songs chosen to the input.",
    true,
    false,
    [param("show", "choice:Open Dialog|Media List", "", true)],
  ),
  pageAction(
    "copy-finder-items",
    "Copy Finder Items",
    "files",
    "Copies the files and folders in the input to a folder and hands on the copies.",
    true,
    true,
    [whereTo("The folder, such as Documents/Copies"), param("replace", "boolean")],
  ),
  pageAction(
    "move-finder-items",
    "Move Finder Items",
    "files",
    "Moves the files and folders in the input to a folder and hands them on.",
    true,
    true,
    [whereTo("The folder, such as Documents/Done"), param("replace", "boolean")],
  ),
  pageAction(
    "rename-finder-items",
    "Rename Finder Items",
    "files",
    "Changes the names of the files and folders in the input, keeping each one's extension.",
    true,
    true,
    [
      param(
        "change",
        "choice:Add Text|Replace Text|Make Upper Case|Make Lower Case|Make Sequential",
        "",
        true,
      ),
      param("text", "text", "The text to add, to find, or the new name"),
      param("with", "text", "What replaces the text"),
    ],
  ),
  pageAction(
    "new-folder",
    "New Folder",
    "files",
    "Makes a folder, moves the files and folders in the input into it, and hands them on.",
    true,
    true,
    [
      param("name", "text", "Its name", true),
      param("where", "text", "Inside which folder (default Desktop)"),
    ],
  ),
  pageAction(
    "create-archive",
    "Create Archive",
    "files",
    "Packs the files and folders in the input into a zip archive and hands the archive on.",
    true,
    true,
    [
      param("name", "text", "Archive", true),
      param("where", "text", "Inside which folder (default Desktop)"),
    ],
  ),
  pageAction(
    "combine-text-files",
    "Combine Text Files",
    "text",
    "Joins the text of the files in the input into one text.",
    true,
    false,
  ),
  pageAction(
    "new-mail",
    "New Mail Message",
    "mail",
    "Makes a message in Mail's Drafts. Files in the input are attached, and text in the input is its message unless it says one itself.",
    true,
    true,
    [
      param("to", "text", "Account names, separated by commas"),
      param("cc", "text", "Account names, separated by commas"),
      param("subject", "text", "The subject"),
      param("message", "text", "The message"),
    ],
  ),
  pageAction(
    "add-attachments",
    "Add Attachments to Front Message",
    "mail",
    "Attaches the files in the input to the message the last New Mail Message of this run made.",
    true,
    true,
  ),
  pageAction(
    "send-outgoing",
    "Send Outgoing Messages",
    "mail",
    "Sends the messages this run's New Mail Message steps made, and hands on their subjects.",
    false,
    true,
  ),
  pageAction(
    "find-mail",
    "Find Mail Items",
    "mail",
    "Finds the messages that hold the text, in every mailbox or one, and hands on each one's subject and sender.",
    false,
    false,
    [
      param("contains", "text", "Words in the message's subject, sender or start"),
      param("mailbox", "choice:Any Mailbox|Inbox|Drafts|Sent|Junk|Trash|Archive", "", true),
    ],
  ),
  pageAction(
    "selected-mail",
    "Get Selected Mail Items",
    "mail",
    "Hands on what is selected in Mail: each message's subject and sender.",
    false,
    false,
  ),
  pageAction(
    "import-photos",
    "Import Files into Photos",
    "photos",
    "Imports a copy of the pictures and movies in the input into the Photos library and hands on the copies.",
    true,
    true,
    [param("album", "text", "An album to add them to")],
  ),
  pageAction(
    "selected-finder",
    "Get Selected Finder Items",
    "finder",
    "Hands on the items selected in Finder.",
    false,
    false,
  ),
  pageAction(
    "selected-photos",
    "Get Selected Photos Items",
    "photos",
    "Hands on the files of the photos selected in Photos.",
    false,
    false,
  ),
  pageAction(
    "new-album",
    "New Photo Album",
    "photos",
    "Makes an album in Photos, with the photos in the input in it.",
    true,
    true,
    [param("name", "text", "The album's name", true)],
  ),
  pageAction(
    "add-to-album",
    "Add to Album",
    "photos",
    "Adds the photos in the input to an album of Photos. Each must be in the library already.",
    true,
    true,
    [param("album", "text", "The album's name", true)],
  ),
  pageAction(
    "add-playlist",
    "Add Songs to Playlist",
    "music",
    "Adds the songs in the input to a playlist of Music, which it makes if there is none of that name. A song not yet in the library joins it.",
    true,
    true,
    [param("playlist", "text", "The playlist's name", true)],
  ),
  pageAction(
    "change-image-type",
    "Change Type of Images",
    "photos",
    "Changes each image in the input to another type. The new file takes the original's place and the original goes to the Trash, unless the checkbox is cleared. It hands on the new files.",
    true,
    true,
    [
      param("to", "choice:PNG|JPEG|BMP|TIFF", "The type", true),
      { ...param("put the originals in the Trash", "boolean"), on: true },
    ],
  ),
  pageAction(
    "apply-sql",
    "Apply SQL",
    "developer",
    "Runs SQL on a SQLite database file of your drive and writes the changed file back. The input is the statements when SQL is empty, and otherwise the values of its ? marks, once for each item. It hands on each row the SQL returns as text.",
    true,
    true,
    [
      param("database", "text", "Documents/Data.sqlite", true),
      param("SQL", "code", "SELECT * FROM notes WHERE title = ?"),
      param("result as", "choice:Text|Comma Separated", "", true),
    ],
  ),
  pageAction(
    "banner",
    "Create Banner Image from Text",
    "photos",
    "Draws text, its own or the input's, as a PNG image on your drive.",
    true,
    true,
    [
      param("text", "text", "The words"),
      param("size", "number", "72"),
      param("colour", "choice:Black|White|Red|Blue|Green", "", true),
      param("background", "choice:White|Black|Yellow|Transparent", "", true),
      param("name", "text", "Banner"),
      param("where", "text", "Inside which folder (default Desktop)"),
    ],
  ),
  pageAction(
    "annotate-movie",
    "Create Annotated Movie File",
    "movies",
    "Saves a copy of each QuickTime or MP4 movie in the input with a title, an author, a description and a copyright, and hands on the copies.",
    true,
    true,
    [
      param("title", "text", "The movie's title"),
      param("author", "text", "Who made it"),
      param("description", "text", "What it shows"),
      param("copyright", "text", "Its copyright line"),
      param("where", "text", "Inside which folder (default Desktop)"),
    ],
  ),
  pageAction(
    "extract-pdf-text",
    "Extract PDF Text",
    "pdfs",
    "Saves the text of each PDF document in the input as a text file, and hands on the files.",
    true,
    true,
    [param("where", "text", "Inside which folder (default Desktop)")],
  ),
  pageAction(
    "combine-pdf",
    "Combine PDF Pages",
    "pdfs",
    "Makes one PDF document of every page of the PDF documents in the input, in their order.",
    true,
    true,
    [
      param("name", "text", "Combined"),
      param("where", "text", "Inside which folder (default Desktop)"),
    ],
  ),
  pageAction(
    "split-pdf",
    "Split PDF",
    "pdfs",
    "Makes one PDF document of each page of the PDF documents in the input.",
    true,
    true,
    [param("where", "text", "Inside which folder (default Desktop)")],
  ),
  pageAction(
    "add-grid-pdf",
    "Add Grid to PDF Documents",
    "pdfs",
    "Saves a copy of each PDF document in the input with a grid drawn over every page, and hands on the copies.",
    true,
    true,
    [
      param("spacing", "number", "36"),
      param("colour", "choice:Gray|Black|Red|Blue", "", true),
      param("where", "text", "Inside which folder (default Desktop)"),
    ],
  ),
  pageAction(
    "watermark-pdf",
    "Watermark PDF Documents",
    "pdfs",
    "Saves a copy of each PDF document in the input with a picture from your drive on every page, and hands on the copies.",
    true,
    true,
    [
      param("picture", "text", "Pictures/Logo.png", true),
      param("opacity", "number", "50"),
      param("scale", "number", "100"),
      param("angle", "number", "0"),
      param("x", "number", "Centred"),
      param("y", "number", "Centred"),
      param("draw under the page", "boolean"),
      param("where", "text", "Inside which folder (default Desktop)"),
    ],
  ),
  pageAction(
    "quartz-filter-pdf",
    "Apply Quartz Filter to PDF Documents",
    "pdfs",
    "Saves a copy of each PDF document in the input through a filter, a tone or a size reduction, and hands on the copies. The text stays text.",
    true,
    true,
    [
      param(
        "filter",
        "choice:Black & White|Blue Tone|Gray Tone|Lightness Decrease|Lightness Increase|Reduce File Size|Sepia Tone",
        "",
        true,
      ),
      param("where", "text", "Inside which folder (default Desktop)"),
    ],
  ),
  pageAction(
    "compress-pdf",
    "Compress Images in PDF Documents",
    "pdfs",
    "Saves a copy of each PDF document in the input with its pictures kept as JPEGs, where that makes them smaller, and hands on the copies.",
    true,
    true,
    [
      param("quality", "choice:Low|Medium|High", "", true),
      param("where", "text", "Inside which folder (default Desktop)"),
    ],
  ),
  pageAction(
    "encrypt-pdf",
    "Encrypt PDF Documents",
    "pdfs",
    "Asks for a password and saves a copy of each PDF document in the input that opens only with it. The password is not kept in the workflow.",
    true,
    true,
    [param("where", "text", "Inside which folder (default Desktop)")],
  ),
  pageAction(
    "add-font-library",
    "Add to Font Library",
    "fonts",
    "Adds the font files in the input to Font Book, on your drive in Documents/Fonts, and hands them on. A file that fails Font Book's checks fails the step.",
    true,
    true,
  ),
  pageAction(
    "activate-fonts",
    "Activate Fonts",
    "fonts",
    "Turns on the fonts in the input that are turned off in Font Book, and hands them on. A file Font Book does not hold fails the step.",
    true,
    true,
  ),
  pageAction(
    "current-webpage",
    "Get Current Webpage from Safari",
    "internet",
    "Hands on the address of the tab Safari last showed, as Safari keeps it. A private window keeps none.",
    false,
    false,
  ),
  pageAction(
    "webpage-text",
    "Get Text from Webpage",
    "internet",
    "Hands on the text of the pages at the addresses in the input. It reads the sites Safari opens here; another site fails the step and says so.",
    true,
    false,
  ),
  pageAction(
    "download-urls",
    "Download URLs",
    "internet",
    "Saves the files at the addresses in the input to a folder. It reaches the sites Safari opens here, up to 1 MB a file.",
    true,
    true,
    [param("where", "text", "Inside which folder (default Downloads)")],
  ),
];

const NO_COMPOSITIONS =
  "It plays a Quartz Composer composition, a program that only macOS can run; a web page has nothing to play one with.";
const NO_COLORSYNC =
  "It needs the colour profiles macOS keeps and ColorSync's engine to apply them; a web page has neither.";
const NO_TOOLS = "It runs Apple's developer tools, and a web page cannot start a program.";
const NO_NETWORK = "A web page cannot see or connect to file servers on your network.";

const DIMMED: readonly (readonly [string, string, string, string?])[] = [
  ["Apply ColorSync Profile to Images", "photos", NO_COLORSYNC],
  ["Apply Quartz Composition Filter to Image Files", "photos", NO_COMPOSITIONS],
  ["Convert Quartz Compositions to QuickTime Movies", "movies", NO_COMPOSITIONS],
  ["Apple Versioning Tool", "developer", NO_TOOLS],
  ["Create Package", "developer", NO_TOOLS],
  ["Ask For Servers", "files", NO_NETWORK],
  ["Connect to Servers", "files", NO_NETWORK],
  ["Burn a Disc", "utilities", "A web page cannot reach a disc drive."],
  [
    "Watch Me Do",
    "utilities",
    "A web page cannot see what you do in other applications, which is what it repeats.",
  ],
];

const slugOf = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The rest of Automator's library: listed where it belongs, dimmed, each with why it does not run. */
export const DIMMED_ACTIONS: readonly ServerAction[] = DIMMED.map(
  ([title, app, reason, summary]) => ({
    name: `dimmed.${slugOf(title)}`,
    title,
    app,
    summary: summary ?? findAction(slugOf(title))?.description ?? "",
    takes_input: false,
    writes: false,
    params: [],
    reason,
  }),
);

export const isPageAction = (name: string) => name.startsWith("page.");

/** Whether a run of these steps must go in parts, with the page acting in between. */
export const needsParts = (steps: readonly DraftStep[]) =>
  steps.some((step) => isPageAction(step.action) || (step.enabled && step.showWhenRun === true));

/* --------------------------------------------------------------------------- variables */

/** A variable of the library, whose value is read when a workflow runs. */
export interface LibraryVariable {
  title: string;
  category: string;
  summary: string;
  value: (now: Date) => string;
}

const place = (name: string): LibraryVariable => ({
  title: name,
  category: "var-locations",
  summary: `The ${name} folder of your drive.`,
  value: () => name,
});
const on = (now: Date, options: Intl.DateTimeFormatOptions) => now.toLocaleString("en-US", options);

/** What the variables of the User category read: the signed-in account, as Mail's route gives it. */
const account = { fullName: "", shortName: "", address: "" };

/** Read the account for the User category. A page that cannot read it leaves them empty. */
export async function loadAccountVariables(): Promise<void> {
  try {
    const response = await sessionFetch("/api/mail/me", {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return;
    const me = (await response.json()) as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    account.fullName = text(me.full_name);
    account.shortName = text(me.name);
    account.address = text(me.address);
  } catch {
    return;
  }
}

const userVariable = (title: string, summary: string, read: () => string): LibraryVariable => ({
  title,
  category: "var-user",
  summary,
  value: read,
});

export const LIBRARY_VARIABLES: readonly LibraryVariable[] = [
  {
    title: "Current day",
    category: "var-date-time",
    summary: "The name of the day the workflow runs on.",
    value: (now) => on(now, { weekday: "long" }),
  },
  {
    title: "Current month",
    category: "var-date-time",
    summary: "The name of the month the workflow runs in.",
    value: (now) => on(now, { month: "long" }),
  },
  {
    title: "Current time",
    category: "var-date-time",
    summary: "The time at which the workflow runs.",
    value: (now) => on(now, { hour: "numeric", minute: "2-digit" }),
  },
  {
    title: "Today's date",
    category: "var-date-time",
    summary: "The date on which the workflow runs.",
    value: (now) => on(now, { year: "2-digit", month: "numeric", day: "numeric" }),
  },
  place("Desktop"),
  place("Documents"),
  place("Downloads"),
  place("Movies"),
  place("Music"),
  place("Pictures"),
  {
    title: "Operating system version",
    category: "var-system",
    summary: "The version of macOS this desktop shows.",
    value: () => "10.15",
  },
  {
    title: "New text",
    category: "var-text-data",
    summary: "Text typed once and used wherever it is needed: type it in the Variables pane.",
    value: () => "",
  },
  {
    title: "Random number",
    category: "var-text-data",
    summary: "A number from 0 to 99, chosen anew each time it is read.",
    value: () => String(Math.floor(Math.random() * 100)),
  },
  {
    title: "Storage",
    category: "var-text-data",
    summary: "Empty until Set Value of Variable keeps something in it.",
    value: () => "",
  },
  userVariable("Full name", "Your full name on this desktop.", () => account.fullName),
  userVariable("Short name", "The name you sign in with.", () => account.shortName),
  userVariable("Email address", "Your address in Mail.", () => account.address),
];

/** The variables as rows of the library's list: `name` is the variable's title with a prefix. */
export const VARIABLE_ROWS: readonly ServerAction[] = LIBRARY_VARIABLES.map((entry) => ({
  name: `variable.${entry.title}`,
  title: entry.title,
  app: entry.category,
  summary: entry.summary,
  takes_input: false,
  writes: false,
  params: [],
}));

/** A variable of a workflow: what the Variables pane lists. */
export interface WorkflowVariable {
  name: string;
  value: string;
}

/** Each workflow's variables, by its id. */
/** Where the person's workflow variables are kept among their desktop values. */
export const VARIABLES = "automator.variables";

export type KeptVariables = Readonly<Record<string, readonly WorkflowVariable[]>>;

const isVariable = (value: unknown): value is WorkflowVariable =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as WorkflowVariable).name === "string" &&
  typeof (value as WorkflowVariable).value === "string";

export function readKeptVariables(stored: unknown): KeptVariables | undefined {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return undefined;
  const kept: Record<string, readonly WorkflowVariable[]> = {};
  for (const [id, list] of Object.entries(stored)) {
    if (Array.isArray(list)) kept[id] = list.filter(isVariable);
  }
  return kept;
}

/** What a setting writes to name a variable. */
export const variableToken = (name: string) => `{{${name}}}`;

/** What a variable holds now: what a run kept in it, the workflow's value, then the library's. */
export function variableValues(
  name: string,
  running: ReadonlyMap<string, readonly string[]>,
  own: readonly WorkflowVariable[],
  now: Date,
): readonly string[] | undefined {
  const kept = running.get(name);
  if (kept) return kept;
  const mine = own.find((entry) => entry.name === name);
  if (mine?.value) return [mine.value];
  const known = LIBRARY_VARIABLES.find((entry) => entry.title === name);
  if (known) return [known.value(now)];
  return mine ? [""] : undefined;
}

/** A step with each `{{name}}` in its text settings replaced; a name no variable has stays as typed. */
export function withVariables(
  step: DraftStep,
  action: ServerAction | undefined,
  read: (name: string) => readonly string[] | undefined,
): DraftStep {
  const params: Record<string, ParamDraft> = {};
  let changed = false;
  for (const [name, value] of Object.entries(step.params)) {
    const kind = action?.params.find((each) => each.name === name)?.kind;
    if (typeof value !== "string" || kind === "code" || name === "variable") {
      params[name] = value;
      continue;
    }
    params[name] = value.replace(/\{\{([^{}]+)\}\}/g, (whole, variable: string) => {
      const values = read(variable);
      if (!values) return whole;
      changed = true;
      return values.join("\n");
    });
  }
  return changed ? { ...step, params } : step;
}

/* ------------------------------------------------------------------------- page actions */

/** Why a page action failed, in a sentence for the log. */
export class PageFailure extends Error {}

/** What the window offers the person during a run. */
export type PageQuestion =
  | { kind: "confirm"; title: string; message: string; confirm: string; cancel: string }
  | { kind: "text"; question: string; value: string; required: boolean; secret?: boolean }
  | { kind: "choose"; prompt: string; options: readonly string[]; several: boolean }
  | { kind: "file"; folder: string; accept: FileKind }
  | { kind: "media"; accept: FileKind };

export type FileKind = "any" | "movie" | "photo" | "song";

/** The answer: `null` is Cancel. */
export type PageAnswer = { text: string } | { chosen: string[] } | { files: DriveEntry[] } | true;

export interface PageHost {
  ask: (question: PageQuestion) => Promise<PageAnswer | null>;
  /** What the variables hold in this run, which Set Value of Variable changes. */
  running: Map<string, readonly string[]>;
  read: (name: string) => readonly string[] | undefined;
  /**
   * The desktop session the run began in (`UploadOptions.session`): what its actions write goes to
   * that person's drive or is refused. Absent, the page's as each write starts.
   */
  session?: string | null;
}

/** Whether a drive file is of `kind`: by its media type, or its extension when it has none. */
export function fileIsKind(entry: { name: string; type?: string; kind: string }, kind: FileKind) {
  if (entry.kind !== "file") return false;
  if (kind === "any") return true;
  const types = { movie: "video/", photo: "image/", song: "audio/" } as const;
  const extensions = {
    movie: /\.(mov|mp4|m4v|webm)$/i,
    photo: /\.(jpe?g|png|gif|heic|tiff?|webp)$/i,
    song: /\.(mp3|m4a|aac|wav|aiff?|flac|ogg)$/i,
  } as const;
  return entry.type?.startsWith(types[kind]) || extensions[kind].test(entry.name);
}

/** The files of a kind anywhere on the drive but the Trash: what the Media Browser lists. */
export function mediaOnDrive(drive: Drive, kind: FileKind): FileItem[] {
  const found: FileItem[] = [];
  const walk = (entries: readonly DriveEntry[]) => {
    for (const entry of entries) {
      if (entry.kind === "folder") walk(childrenOf(drive, entry.id));
      else if (fileIsKind(entry, kind)) found.push(fileItemOf(drive, entry));
    }
  };
  walk(homeFolders(drive));
  return found.sort((one, two) => one.name.localeCompare(two.name));
}

/** The drive's item at `path`: `Documents/Notes.txt`, with or without a leading `~/` or `/`. */
export function entryAtPath(drive: Drive, path: string): DriveEntry | undefined {
  const names = path
    .replace(/^~?\/+/, "")
    .split("/")
    .filter(Boolean);
  let list = homeFolders(drive);
  let found: DriveEntry | undefined;
  for (const name of names) {
    found = list.find((entry) => entry.name === name);
    if (!found) return undefined;
    list = childrenOf(drive, found.id);
  }
  return found;
}

const pathText = (drive: Drive, id: string) =>
  pathOf(drive, id)
    .map((entry) => entry.name)
    .join("/");

export const fileItemOf = (drive: Drive, entry: DriveEntry): FileItem => {
  const path = pathText(drive, entry.id);
  return { kind: "file", id: entry.id, name: entry.name, path, text: path };
};

export function entriesOf(drive: Drive, items: readonly RunItem[]): DriveEntry[] {
  return items.map((item) => {
    const entry =
      typeof item === "string" ? entryAtPath(drive, item.trim()) : entryOf(drive, item.id);
    if (!entry) throw new PageFailure(`“${itemText(item)}” is not on your drive.`);
    return entry;
  });
}

export function folderAt(drive: Drive, path: string): DriveEntry {
  if (path === "") throw new PageFailure("It needs the folder's path.");
  const folder = entryAtPath(drive, path);
  if (folder?.kind !== "folder")
    throw new PageFailure(`There is no folder “${path}” on your drive.`);
  return folder;
}

export const stringOf = (value: ParamDraft | undefined) =>
  typeof value === "string" ? value.trim() : "";

const split = (name: string) => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
};

/** An item's new name, its extension kept. */
export function renamed(
  name: string,
  at: number,
  change: string,
  text: string,
  replacement: string,
): string {
  const [stem = "", extension = ""] = split(name);
  if (change === "Add Text") return `${stem}${text}${extension}`;
  if (change === "Replace Text") return `${stem.split(text).join(replacement)}${extension}`;
  if (change === "Make Upper Case") return `${stem.toUpperCase()}${extension}`;
  if (change === "Make Lower Case") return `${stem.toLowerCase()}${extension}`;
  return `${text || stem}${at + 1}${extension}`;
}

/** One comma-separated line as its fields; a field in double quotes may hold commas. */
export function csvFields(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let at = 0; at < line.length; at += 1) {
    const char = line[at];
    if (quoted && char === '"' && line[at + 1] === '"') {
      field += '"';
      at += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      fields.push(field);
      field = "";
    } else field += char;
  }
  fields.push(field);
  return fields;
}

/** The statements that fill `table` with these comma-separated lines. */
export function csvToSql(lines: readonly string[], table: string, header: boolean): string[] {
  const rows = lines
    .flatMap((line) => line.split(/\r?\n/))
    .filter((line) => line.trim() !== "")
    .map(csvFields);
  const columns = header ? rows.shift() : undefined;
  const named = columns ? ` (${columns.map((name) => name.trim()).join(", ")})` : "";
  const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
  return rows.map((row) => `INSERT INTO ${table}${named} VALUES (${row.map(quote).join(", ")});`);
}

async function archiveFiles(drive: Drive, entries: readonly DriveEntry[]): Promise<ArchiveFile[]> {
  const files: ArchiveFile[] = [];
  const walk = async (entry: DriveEntry, under: string) => {
    const path = `${under}${entry.name}`;
    const modified = new Date(entry.modified_ms);
    if (entry.kind === "folder") {
      files.push({ path: `${path}/`, modified });
      for (const child of childrenOf(drive, entry.id)) await walk(child, `${path}/`);
    } else files.push({ path, modified, blob: await readFile(entry.id) });
  };
  for (const entry of entries) await walk(entry, "");
  return files;
}

const CANCELED = "You canceled it.";

const httpAddress = (text: string) => {
  try {
    const { protocol, href } = new URL(text);
    return protocol === "http:" || protocol === "https:" ? href : null;
  } catch {
    return null;
  }
};

async function askForFile(
  items: readonly RunItem[],
  host: PageHost,
  folder: string,
  accept: FileKind,
  show = "",
): Promise<RunItem[]> {
  if (show === "Media List") {
    const chosen = await host.ask({ kind: "media", accept });
    if (chosen === null || chosen === true || !("chosen" in chosen)) {
      throw new PageFailure(CANCELED);
    }
    const drive = await loadDrive();
    return [...items, ...entriesOf(drive, chosen.chosen).map((entry) => fileItemOf(drive, entry))];
  }
  const answer = await host.ask({ kind: "file", folder, accept });
  if (answer === null || answer === true || !("files" in answer)) throw new PageFailure(CANCELED);
  const drive = await loadDrive();
  return [...items, ...answer.files.map((entry) => fileItemOf(drive, entry))];
}

/** Carry out one page action on `items`; the items it hands on. Throws `PageFailure`. */
export async function runPageAction(
  name: string,
  params: Readonly<Record<string, ParamDraft>>,
  items: readonly RunItem[],
  host: PageHost,
): Promise<RunItem[]> {
  const value = (key: string) => stringOf(params[key]);
  const texts = items.map(itemText);
  switch (name) {
    case "page.ask-confirmation": {
      const answer = await host.ask({
        kind: "confirm",
        title: value("title") || "Do you want to continue?",
        message: value("message"),
        confirm: "OK",
        cancel: "Cancel",
      });
      if (answer === null) throw new PageFailure(CANCELED);
      return [...items];
    }
    case "page.ask-text": {
      const answer = await host.ask({
        kind: "text",
        question: value("question") || "Enter text:",
        value: typeof params.default === "string" ? params.default : "",
        required: params["require an answer"] === true,
      });
      if (answer === null || answer === true || !("text" in answer))
        throw new PageFailure(CANCELED);
      return [answer.text];
    }
    case "page.choose-list": {
      if (items.length === 0) throw new PageFailure("It was given nothing to choose from.");
      const answer = await host.ask({
        kind: "choose",
        prompt: value("prompt") || "Choose from the list:",
        options: texts,
        several: params["allow several"] === true,
      });
      if (answer === null || answer === true || !("chosen" in answer)) {
        throw new PageFailure(CANCELED);
      }
      return items.filter((item) => answer.chosen.includes(itemText(item)));
    }
    case "page.copy-clipboard":
      try {
        await navigator.clipboard.writeText(texts.join("\n"));
      } catch {
        throw new PageFailure("The browser kept this page from writing to the Clipboard.");
      }
      return [...items];
    case "page.get-variable": {
      const values = host.read(value("variable"));
      if (!values) throw new PageFailure(`There is no variable “${value("variable")}”.`);
      return [...items, ...values];
    }
    case "page.set-variable":
      if (!value("variable")) throw new PageFailure("It needs the variable's name.");
      host.running.set(value("variable"), texts);
      return [...items];
    case "page.csv-sql":
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value("table"))) {
        throw new PageFailure("The table's name must be letters, digits or underscores.");
      }
      return csvToSql(texts, value("table"), params["first line names the columns"] === true);
    case "page.display-webpages": {
      const wanted = value("address") ? [...texts, value("address")] : texts;
      if (wanted.length === 0) throw new PageFailure("It was given no address.");
      const addresses = wanted.map((text) => {
        const address = httpAddress(text);
        if (!address) throw new PageFailure(`“${text}” is not a web address.`);
        return address;
      });
      requestDesktopEffects([
        {
          newWindow: "safari",
          opening: {
            isPrivate: false,
            seeds: addresses.map((address) => ({ history: [address], index: 0 })),
          },
        },
      ]);
      return addresses;
    }
    case "page.specified-finder-items": {
      const paths = (typeof params.paths === "string" ? params.paths : "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const drive = await loadDrive();
      return [...items, ...entriesOf(drive, paths).map((entry) => fileItemOf(drive, entry))];
    }
    case "page.ask-finder-items":
      return askForFile(items, host, value("start at").toLowerCase() || "documents", "any");
    case "page.ask-movies":
      return askForFile(items, host, "movies", "movie", value("show"));
    case "page.ask-photos":
      return askForFile(items, host, "pictures", "photo", value("show"));
    case "page.ask-songs":
      return askForFile(items, host, "music", "song", value("show"));
    case "page.copy-finder-items":
    case "page.move-finder-items": {
      const drive = await loadDrive();
      const entries = entriesOf(drive, items);
      const parent = folderAt(drive, value("to")).id;
      const existing = params.replace === true ? ("replace" as const) : ("rename" as const);
      if (name === "page.move-finder-items") {
        const after = await runOps(
          entries.map(({ id }) => ({ op: "move" as const, id, parent, existing })),
          undefined,
          host.session,
        );
        return entries.flatMap(({ id }) => {
          const moved = entryOf(after, id);
          return moved ? [fileItemOf(after, moved)] : [];
        });
      }
      const after = await runOps(
        entries.map(({ id }) => ({ op: "copy" as const, id, parent, existing })),
        undefined,
        host.session,
      );
      return (after.created ?? []).flatMap((id) => {
        const copy = entryOf(after, id);
        return copy && copy.parent === parent ? [fileItemOf(after, copy)] : [];
      });
    }
    case "page.rename-finder-items": {
      const drive = await loadDrive();
      const entries = entriesOf(drive, items);
      const ops = entries.map((entry, at) => ({
        op: "rename" as const,
        id: entry.id,
        name: renamed(
          entry.name,
          at,
          value("change"),
          typeof params.text === "string" ? params.text : "",
          typeof params.with === "string" ? params.with : "",
        ),
      }));
      const after = await runOps(ops, undefined, host.session);
      return entries.flatMap(({ id }) => {
        const entry = entryOf(after, id);
        return entry ? [fileItemOf(after, entry)] : [];
      });
    }
    case "page.new-folder": {
      const drive = await loadDrive();
      const entries = entriesOf(drive, items);
      const parent = folderAt(drive, value("where") || "Desktop").id;
      const made = await runOps(
        [{ op: "mkdir", parent, name: value("name") || "untitled folder", existing: "rename" }],
        undefined,
        host.session,
      );
      const folder = made.created?.[0];
      if (!folder) throw new PageFailure("The server did not say which folder it made.");
      if (entries.length === 0) {
        const entry = entryOf(made, folder);
        return entry ? [fileItemOf(made, entry)] : [];
      }
      const after = await runOps(
        entries.map(({ id }) => ({ op: "move", id, parent: folder })),
        undefined,
        host.session,
      );
      return entries.flatMap(({ id }) => {
        const entry = entryOf(after, id);
        return entry ? [fileItemOf(after, entry)] : [];
      });
    }
    case "page.create-archive": {
      const drive = await loadDrive();
      const entries = entriesOf(drive, items);
      if (entries.length === 0) throw new PageFailure("It was given nothing to pack.");
      const parent = folderAt(drive, value("where") || "Desktop").id;
      const blob = await zipBlob(await archiveFiles(drive, entries));
      const base = value("name") || "Archive";
      const entry = await uploadFile(blob, parent, {
        name: base.endsWith(".zip") ? base : `${base}.zip`,
        existing: "rename",
        session: host.session,
      });
      return [fileItemOf(await loadDrive(), entry)];
    }
    case "page.combine-text-files": {
      const drive = await loadDrive();
      const entries = entriesOf(drive, items);
      if (entries.length === 0) throw new PageFailure("It was given no files.");
      const parts = await Promise.all(
        entries.map(async (entry) => {
          if (entry.kind !== "file") throw new PageFailure(`“${entry.name}” is not a file.`);
          return (await readFile(entry.id)).text();
        }),
      );
      return [parts.join("\n")];
    }
    default: {
      const { runAppAction } = await import("./automator-page-apps");
      return runAppAction(name, params, items, host);
    }
  }
}

/* -------------------------------------------------------------------------- run in parts */

const ending = (text: string) => text.replace(/[.\s]+$/, "");

/** The log's row for a run that got no log back. */
export function unansweredRow(outcome: { error: string; uncertain: boolean }): LogRow {
  return outcome.uncertain
    ? {
        key: "uncertain",
        text: `It is not known whether the workflow ran: ${ending(outcome.error)}. Look in Runs before running it again.`,
        duration: "",
        failed: true,
      }
    : {
        key: "refused",
        text: `The workflow did not run: ${ending(outcome.error)}.`,
        duration: "",
        failed: true,
      };
}

export type PartMark = "done" | "running" | "failed";

/** How far a run in parts has come. */
export interface PartsProgress {
  rows: LogRow[];
  marks: Record<number, PartMark>;
  results: Record<number, StepLog>;
  ms: number;
  /** What the next step would be handed. */
  items: readonly RunItem[];
  ok: boolean;
  /** Whether a Stop or a Cancel ended it. */
  ended?: boolean;
}

export interface PartsHost extends PageHost {
  name: (step: DraftStep) => string;
  action: (step: DraftStep) => ServerAction | undefined;
  /** Run these steps on the server with `items` in front. */
  server: (steps: readonly DraftStep[], items: readonly RunItem[]) => Promise<RunOutcome>;
  /** Show a step's settings before it runs; the settings for this run, or `null` for Cancel. */
  show: (step: DraftStep) => Promise<DraftStep | null>;
  stopped: () => boolean;
  progress: (progress: PartsProgress) => void;
  /** Step runs each action once, so a Loop only says so. */
  once?: boolean;
}

const pageLog = (
  step: DraftStep,
  title: string,
  items: readonly RunItem[],
  ms: number,
): StepLog => ({
  action: step.action,
  title,
  status: "completed",
  items: items.length,
  preview: items.slice(0, 5).map((item) => itemText(item).slice(0, 200)),
  ms,
});

const rowsOfStep = (log: StepLog, key: string): LogRow[] =>
  logRows({
    id: key,
    workflow: "",
    name: "",
    trigger: "manual",
    started: 0,
    ms: 0,
    ok: true,
    steps: [log],
    output: [],
  }).filter((row) => !row.key.endsWith(":end"));

/**
 * Run `steps` from `start`: what the server can do in one request goes in one, and the page does
 * its own actions between them. Items cross from a request to the page as the server's log shows
 * them, so a step that needs more than the log holds (5 items, 200 characters each) is not run.
 */
export async function runInParts(
  steps: readonly DraftStep[],
  start: readonly RunItem[],
  host: PartsHost,
): Promise<PartsProgress> {
  const state: PartsProgress = { rows: [], marks: {}, results: {}, ms: 0, items: start, ok: true };
  let loops = 0;
  let turn = 0;
  let at = 0;
  const fail = (key: number, log: StepLog) => {
    state.ok = false;
    state.marks[key] = "failed";
    state.results[key] = log;
    state.rows.push(...rowsOfStep(log, `page:${turn}:${key}`));
  };
  while (at < steps.length) {
    turn += 1;
    const step = steps[at] as DraftStep;
    const name = host.name(step);
    if (host.stopped()) {
      state.rows.push({ key: `stopped:${turn}`, text: `Stopped before ${name}`, duration: "" });
      state.ended = true;
      return state;
    }
    const showing = step.enabled && step.showWhenRun === true;
    if (!isPageAction(step.action) && !showing) {
      let end = at;
      while (
        end < steps.length &&
        !isPageAction((steps[end] as DraftStep).action) &&
        !((steps[end] as DraftStep).enabled && (steps[end] as DraftStep).showWhenRun)
      ) {
        end += 1;
      }
      if (!(await serverPart(steps.slice(at, end), steps[end], state, host, turn))) return state;
      at = end;
      continue;
    }
    if (!step.enabled) {
      state.rows.push({ key: `page:${turn}:${step.key}`, text: `${name} skipped`, duration: "" });
      at += 1;
      continue;
    }
    state.marks[step.key] = "running";
    host.progress(state);
    let current: DraftStep = step;
    if (showing) {
      const edited = await host.show(step);
      if (!edited) {
        fail(step.key, {
          action: step.action,
          title: name,
          status: "failed",
          message: CANCELED,
          items: 0,
          preview: [],
          ms: 0,
        });
        return state;
      }
      current = edited;
    }
    if (!isPageAction(current.action)) {
      const taken = { ...current, showWhenRun: false };
      if (!(await serverPart([taken], steps[at + 1], state, host, turn))) return state;
      at += 1;
      continue;
    }
    const began = Date.now();
    const given = current.ignoreInput ? [] : state.items;
    if (current.action === LOOP) {
      const again = host.once ? false : await loopsAgain(current, loops, host);
      const log = pageLog(current, name, state.items, Date.now() - began);
      state.ms += log.ms;
      state.marks[step.key] = "done";
      state.results[step.key] = log;
      state.rows.push(...rowsOfStep(log, `page:${turn}:${step.key}`));
      if (again) {
        loops += 1;
        if (current.params["use the results as input"] !== true) state.items = start;
        at = 0;
        continue;
      }
      at += 1;
      continue;
    }
    try {
      const expanded = withVariables(current, host.action(current), host.read);
      const next = await runPageAction(current.action, expanded.params, given, host);
      const log = pageLog(current, name, next, Date.now() - began);
      state.items = next;
      state.ms += log.ms;
      state.marks[step.key] = "done";
      state.results[step.key] = log;
      state.rows.push(...rowsOfStep(log, `page:${turn}:${step.key}`));
      host.progress(state);
    } catch (error) {
      fail(step.key, {
        action: step.action,
        title: name,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
        items: 0,
        preview: [],
        ms: Date.now() - began,
      });
      state.ms += Date.now() - began;
      return state;
    }
    at += 1;
  }
  return state;
}

async function loopsAgain(step: DraftStep, loops: number, host: PartsHost): Promise<boolean> {
  if (loops + 1 >= MOST_LOOPS) return false;
  if (step.params.mode === LOOP_TIMES) {
    const times = Number(step.params.times);
    return loops + 1 < (Number.isFinite(times) && times > 0 ? times : 1);
  }
  const answer = await host.ask({
    kind: "confirm",
    title: "Do you want to go round again?",
    message: `The workflow has run ${loops + 1 === 1 ? "once" : `${loops + 1} times`}.`,
    confirm: "Continue",
    cancel: "Stop",
  });
  return answer !== null;
}

/** One request; whether the run goes on after it. */
async function serverPart(
  part: readonly DraftStep[],
  following: DraftStep | undefined,
  state: PartsProgress,
  host: PartsHost,
  turn: number,
): Promise<boolean> {
  for (const step of part) if (step.enabled) state.marks[step.key] = "running";
  host.progress(state);
  const outcome = await host.server(part, state.items);
  for (const step of part) delete state.marks[step.key];
  if (!outcome.ok) {
    state.ok = false;
    state.rows.push({ ...unansweredRow(outcome), key: `unanswered:${turn}` });
    return false;
  }
  const run = namedRun(outcome.run, part, state.items.length > 0);
  run.steps.forEach((log, index) => {
    const key = part[index]?.key;
    if (key === undefined) return;
    state.results[key] = log;
    if (log.status === "completed") state.marks[key] = "done";
    else if (log.status === "failed") state.marks[key] = "failed";
  });
  state.ms += outcome.run.ms;
  state.rows.push(
    ...logRows(run).filter((row) => !row.key.endsWith(":end") && !row.key.endsWith(":output")),
  );
  if (!run.ok) {
    state.ok = false;
    return false;
  }
  const last = [...run.steps].reverse().find((log) => log.status === "completed");
  if (!last) return true;
  const { items, whole } = handedOn(last);
  const takesItems = following && host.action(following)?.takes_input && !following.ignoreInput;
  if (!whole && takesItems) {
    state.ok = false;
    state.ended = true;
    state.rows.push({
      key: `${run.id}:cut`,
      text: `Stopped before ${host.name(following)}: the server's log holds only the first 5 items, of up to 200 characters, and the page could hand on no more.`,
      duration: "",
      failed: true,
    });
    return false;
  }
  state.items = items;
  return true;
}

const namedRun = (run: RunLog, part: readonly DraftStep[], carried: boolean): RunLog => {
  const steps = carried ? run.steps.slice(1) : run.steps;
  return {
    ...run,
    steps: steps.map((log, index) => {
      const label = part[index]?.label;
      return label ? { ...log, title: label } : log;
    }),
  };
};

/** The log's last rows of a whole run in parts: what it gave, and how it ended. */
export function endRows(progress: PartsProgress, tag = "parts"): LogRow[] {
  const output = progress.ok ? progress.items.slice(0, 5).map(itemText) : [];
  return [
    ...(output.length > 0
      ? [
          {
            key: `${tag}:output`,
            text: `Output: ${output.map((text) => text.replace(/\s+/g, " ").trim()).join(", ")}`,
            duration: "",
          },
        ]
      : []),
    {
      key: `${tag}:end`,
      text: `Workflow ${progress.ok ? "completed" : "failed"}`,
      duration: formatDuration(progress.ms),
      failed: !progress.ok,
    },
  ];
}

/** The drive's item for each of `dragged`, as the paths a Get Specified Finder Items step holds. */
export function pathsOfDrag(
  drive: Drive,
  dragged: readonly { id: string; name: string }[],
): string {
  return dragged.map(({ id, name }) => pathText(drive, id) || name).join("\n");
}
