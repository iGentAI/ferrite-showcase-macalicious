/**
 * TextEdit's data: the document of the reference captures, the files the Open and Save panels
 * list, the places of their sidebar and the choices of the format bar. Nothing here is read
 * from a disk: a page has no file system, so the folders are made up around the five files that
 * the Open dialog of the captures shows.
 */

import { FONT_FAMILIES } from "macalicious/lib/rich-text";

/** A document as the app holds it between the editor's sessions: its name and its lines. */
export interface TextEditDocument {
  /** The name in the title bar and in the Save panel. */
  name: string;
  /** Rich text, with the format bar and the ruler, or plain text in the fixed-pitch font. */
  format: "rich" | "plain";
  /** The paragraphs, top to bottom. An empty string is an empty line. */
  lines: readonly string[];
  /**
   * A rich text document's paragraphs as the browser held them when it was saved, with
   * their character and paragraph formats; `lines` is their text. A document without it is
   * shown from its lines, unformatted.
   */
  content?: DocumentFragment;
  /** The ruler of a rich text document: its indents and tab stops, in points. */
  ruler?: TextEditRuler;
  /** A rich text document's File > Show Properties: only what has text is here. */
  properties?: TextEditProperties;
}

/** The fields of File > Show Properties, each kept in an RTF file's `\info`. */
export const PROPERTY_FIELDS = [
  { key: "author", label: "Author:" },
  { key: "organization", label: "Organization:" },
  { key: "copyright", label: "Copyright:" },
  { key: "title", label: "Title:" },
  { key: "subject", label: "Subject:" },
  { key: "keywords", label: "Keywords:" },
  { key: "comment", label: "Comment:" },
] as const;

export type TextEditProperties = Partial<Record<(typeof PROPERTY_FIELDS)[number]["key"], string>>;

/** The most characters of a property, as the server takes it. */
export const MOST_PROPERTY_CHARS = 1000;

/**
 * Properties as they are kept, from a person or a file: one line of no more than the most, and only
 * those with text. None at all is `undefined`.
 */
export function cleanProperties(value: TextEditProperties): TextEditProperties | undefined {
  const clean: TextEditProperties = {};
  for (const { key } of PROPERTY_FIELDS) {
    const text = [...(value[key] ?? "").replace(/\p{Cc}+/gu, " ").trim()]
      .slice(0, MOST_PROPERTY_CHARS)
      .join("");
    if (text) clean[key] = text;
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

/** Properties as compared: the same text whatever order its fields were sent in. */
export const propertiesKey = (value: TextEditProperties | undefined) =>
  JSON.stringify(PROPERTY_FIELDS.map(({ key }) => value?.[key] ?? ""));

/** The settings of the ruler: the three indents and the tab stops. */
export interface TextEditRuler {
  /** The first line's indent, from the ruler's origin. */
  first: number;
  /** The other lines' indent, from the ruler's origin. */
  head: number;
  /** The trailing indent, from the end of the text container. */
  tail: number;
  /** The tab stops, from the ruler's origin. */
  tabStops: readonly number[];
}

/** A file or a folder in a place of the panels. */
export interface TextEditFile {
  /** Unique among all files of all places. */
  id: string;
  /** The name the browser shows. */
  name: string;
  /**
   * A document TextEdit opens, a folder, or a file of another application, which is listed
   * but cannot be opened.
   */
  kind: "document" | "folder" | "other";
  /** What Finder says of the file under its name in the preview column. */
  detail?: string;
  /** The rows under "Information" in the preview column: a label and its value. */
  information?: readonly (readonly [label: string, value: string])[];
  /** The text of a document. */
  document?: TextEditDocument;
  /** The content of a folder. */
  children?: readonly TextEditFile[];
}

/** A place of the sidebar: a folder, a disk, iCloud or a tag. */
export interface TextEditPlace {
  /** Unique among the places: the value of the sidebar's row and of the location button. */
  id: string;
  /** The row's title. */
  label: string;
  /** The sidebar section the row is in. */
  section: "Favorites" | "iCloud" | "Locations" | "Tags";
  /** Which stand-in glyph the row has, or the colour of a tag's dot (`none` for no colour). */
  glyph:
    | "recents"
    | "applications"
    | "desktop"
    | "documents"
    | "downloads"
    | "cloud"
    | "drive"
    | "computer"
    | "network"
    | "blue"
    | "orange"
    | "gray"
    | "green"
    | "none";
  /** The band over the browser while the place is shown ("Shared Folder"). */
  header?: string;
  /** What the place holds at first. */
  files: readonly TextEditFile[];
}

/** The document of the reference captures: "512 Pixels", one line of Helvetica 12. */
export const defaultDocument: TextEditDocument = {
  name: "512 Pixels",
  format: "rich",
  lines: ["Here's to the crazy ones..."],
};

/** A new document, as File > New makes it. */
export const untitledDocument: TextEditDocument = { name: "Untitled", format: "rich", lines: [""] };

const DOCUMENTS: readonly TextEditFile[] = [
  {
    id: "512-pixels",
    name: "512 Pixels",
    kind: "document",
    detail: "Rich Text Document - 264 bytes",
    information: [
      ["Created", "Tuesday, May 15, 2018 at 3:55 PM"],
      ["Modified", "Monday, May 28, 2018 at 3:12 PM"],
      ["Last opened", "Today, 10:51 AM"],
    ],
    document: defaultDocument,
  },
  { id: "aqua-and-bondi", name: "Aqua and Bondi.pdf", kind: "other", detail: "PDF document" },
  {
    id: "aqua-review",
    name: "Aqua_and_Bo…review.ibooks",
    kind: "other",
    detail: "Apple Books document",
  },
  {
    id: "desktop-stacks",
    name: "For Desktop Stacks",
    kind: "folder",
    children: [
      {
        id: "read-me",
        name: "Read Me.txt",
        kind: "document",
        detail: "Plain Text Document - 96 bytes",
        document: {
          name: "Read Me.txt",
          format: "plain",
          lines: [
            "Files in this folder are sorted into stacks on the desktop.",
            "",
            "Group them by kind, by date or by tag.",
          ],
        },
      },
      {
        id: "packing-list",
        name: "Packing List",
        kind: "document",
        detail: "Rich Text Document - 181 bytes",
        document: {
          name: "Packing List",
          format: "rich",
          lines: ["Packing list", "Passport", "Charger", "Walking shoes"],
        },
      },
    ],
  },
  {
    id: "field-guide",
    name: "iPhone Field Guide.ibooks",
    kind: "other",
    detail: "Apple Books document",
  },
];

const TEXTEDIT_CLOUD: readonly TextEditFile[] = [
  {
    id: "shopping",
    name: "Shopping.txt",
    kind: "document",
    detail: "Plain Text Document - 24 bytes",
    document: { name: "Shopping.txt", format: "plain", lines: ["Milk", "Bread", "Apples"] },
  },
];

/** The places of the reference captures' sidebar, with the folders made up behind them. */
export const defaultPlaces: readonly TextEditPlace[] = [
  { id: "recents", label: "Recents", section: "Favorites", glyph: "recents", files: [] },
  {
    id: "applications",
    label: "Applications",
    section: "Favorites",
    glyph: "applications",
    files: [],
  },
  { id: "desktop", label: "Desktop", section: "Favorites", glyph: "desktop", files: [] },
  {
    id: "documents",
    label: "Documents",
    section: "Favorites",
    glyph: "documents",
    header: "Shared Folder",
    files: DOCUMENTS,
  },
  { id: "downloads", label: "Downloads", section: "Favorites", glyph: "downloads", files: [] },
  {
    id: "textedit",
    label: "TextEdit",
    section: "iCloud",
    glyph: "applications",
    files: TEXTEDIT_CLOUD,
  },
  {
    id: "icloud",
    label: "iCloud Drive",
    section: "iCloud",
    glyph: "cloud",
    files: [{ id: "cloud-textedit", name: "TextEdit", kind: "folder", children: TEXTEDIT_CLOUD }],
  },
  { id: "backup", label: "Time Machine", section: "Locations", glyph: "drive", files: [] },
  { id: "computer", label: "ismhpro", section: "Locations", glyph: "computer", files: [] },
  { id: "network", label: "Network", section: "Locations", glyph: "network", files: [] },
  { id: "tag-blue", label: "Blue", section: "Tags", glyph: "blue", files: [] },
  { id: "tag-work", label: "Work", section: "Tags", glyph: "none", files: [] },
  { id: "tag-orange", label: "Orange", section: "Tags", glyph: "orange", files: [] },
  { id: "tag-gray", label: "Gray", section: "Tags", glyph: "gray", files: [] },
  { id: "tag-green", label: "Green", section: "Tags", glyph: "green", files: [] },
  { id: "tag-home", label: "Home", section: "Tags", glyph: "none", files: [] },
];

/** The sections of the sidebar, in the captures' order. */
export const SECTIONS = ["Favorites", "iCloud", "Locations", "Tags"] as const;

/** The place both panels open on. */
export const DEFAULT_PLACE = "documents";

/** The folder at the end of `folders`, a chain of folder ids from the place's own files. */
export function listFolder(
  place: TextEditPlace | undefined,
  folders: readonly string[],
): readonly TextEditFile[] {
  let files = place?.files ?? [];
  for (const id of folders) {
    files = files.find((file) => file.id === id)?.children ?? [];
  }
  return files;
}

/** Every file of a place, folders' contents included, whose name contains `query`. */
export function searchPlace(place: TextEditPlace | undefined, query: string): TextEditFile[] {
  const wanted = query.trim().toLowerCase();
  const seen = new Set<string>();
  const found: TextEditFile[] = [];
  const walk = (files: readonly TextEditFile[]) => {
    for (const file of files) {
      if (seen.has(file.id)) continue;
      seen.add(file.id);
      if (file.kind !== "folder" && file.name.toLowerCase().includes(wanted)) found.push(file);
      if (file.children) walk(file.children);
    }
  };
  walk(place?.files ?? []);
  return found;
}

/**
 * The places with `file` added to, or replaced in, the folder at the end of `folders` (a chain
 * of folder ids) of the place `placeId`: the place's own files when the chain is empty.
 */
export function withFile(
  places: readonly TextEditPlace[],
  placeId: string,
  folders: readonly string[],
  file: TextEditFile,
): TextEditPlace[] {
  const put = (files: readonly TextEditFile[], path: readonly string[]): TextEditFile[] => {
    const [next, ...rest] = path;
    return next === undefined
      ? [...files.filter((other) => other.name !== file.name), file]
      : files.map((other) =>
          other.id === next ? { ...other, children: put(other.children ?? [], rest) } : other,
        );
  };
  return places.map((place) =>
    place.id === placeId ? { ...place, files: put(place.files, folders) } : place,
  );
}

/** The places with a new, empty folder in the folder at the end of `folders` of a place. */
export function withFolder(
  places: readonly TextEditPlace[],
  placeId: string,
  folders: readonly string[],
): TextEditPlace[] {
  const taken = new Set<string>();
  const collect = (files: readonly TextEditFile[]) => {
    for (const file of files) {
      taken.add(file.id);
      if (file.children) collect(file.children);
    }
  };
  for (const place of places) collect(place.files);
  let count = 1;
  while (taken.has(`folder-${count}`)) count += 1;
  const add = (files: readonly TextEditFile[], path: readonly string[]): TextEditFile[] => {
    const [next, ...rest] = path;
    if (next !== undefined) {
      return files.map((file) =>
        file.id === next ? { ...file, children: add(file.children ?? [], rest) } : file,
      );
    }
    const names = new Set(files.map((file) => file.name));
    let name = "untitled folder";
    for (let copy = 2; names.has(name); copy += 1) name = `untitled folder ${copy}`;
    return [...files, { id: `folder-${count}`, name, kind: "folder", children: [] }];
  };
  return places.map((place) =>
    place.id === placeId ? { ...place, files: add(place.files, folders) } : place,
  );
}

/**
 * The font families of the format bar and the Fonts panel: the name shown and the CSS family it
 * sets. They are the families of Catalina that `macalicious/lib/rich-text` lists, Helvetica
 * among them.
 */
export const FONTS: readonly { value: string; family: string }[] = FONT_FAMILIES.map((font) => ({
  value: font.name,
  family: font.css,
}));

/** The sizes of the format bar's size menu, in points: AppKit's list. */
export const SIZES = [9, 10, 11, 12, 13, 14, 18, 24, 36, 48, 64, 72, 96] as const;

/** The line spacings of the format bar, as multiples of the line height. */
export const SPACINGS = ["1.0", "1.2", "1.5", "2.0"] as const;

/** The list styles of the format bar's list menu. */
export const LISTS = [
  { value: "none", label: "None" },
  { value: "disc", label: "• Bullet" },
  { value: "circle", label: "◦ Circle" },
  { value: "square", label: "▪ Square" },
  { value: "hyphen", label: "– Hyphen" },
  { value: "decimal", label: "1. 2. 3." },
  { value: "alpha", label: "a. b. c." },
  { value: "alphaupper", label: "A. B. C." },
  { value: "roman", label: "i. ii. iii." },
  { value: "romanupper", label: "I. II. III." },
] as const;

/** The list styles that count, and so can start at a number. */
export const COUNTED_LISTS: ReadonlySet<string> = new Set([
  "decimal",
  "alpha",
  "alphaupper",
  "roman",
  "romanupper",
]);

/** The colours of the highlight menu: a name and the colour laid behind the text. */
export const HIGHLIGHTS = [
  { value: "yellow", label: "Yellow", color: "#ffea00" },
  { value: "green", label: "Green", color: "#7dff78" },
  { value: "blue", label: "Blue", color: "#7ad0ff" },
  { value: "pink", label: "Pink", color: "#ff9ccd" },
  { value: "purple", label: "Purple", color: "#d7a6ff" },
] as const;

/** The file formats of the Save panel's File Format button. */
export const FILE_FORMATS = [
  { value: "rtf", label: "Rich Text Document", format: "rich" },
  { value: "txt", label: "Plain Text", format: "plain" },
] as const;

/** Lines of the document that fit on one printed page at 12 pt with 1 inch margins. */
export const LINES_PER_PAGE = 46;
