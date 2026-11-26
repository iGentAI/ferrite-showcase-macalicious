/** The kinds of result: each is a group of the list, named in its header band. */
export type SpotlightCategory =
  | "applications"
  | "developer"
  | "definition"
  | "images"
  | "folders"
  | "documents";

/**
 * The groups in the order the list shows them. Developer comes before Definition, Images,
 * Folders and Documents as in the Dark Aqua capture, whose Mac has developer files; the Aqua
 * capture's has none and starts at Definition. No capture shows Applications: first is where
 * Spotlight's preferences list them.
 */
export const CATEGORIES: readonly { id: SpotlightCategory; label: string }[] = [
  { id: "applications", label: "Applications" },
  { id: "developer", label: "Developer" },
  { id: "definition", label: "Definition" },
  { id: "images", label: "Images" },
  { id: "folders", label: "Folders" },
  { id: "documents", label: "Documents" },
];

/** The most results one group shows: both captures stop at five. */
export const MAX_PER_CATEGORY = 5;

/** A piece of a definition: text, or a phrase that is looked up when it is chosen. */
export type SpotlightDefinitionPart = string | { see: string };

/** What the preview pane shows for a result. */
export type SpotlightPreview =
  /** A dictionary entry: the name as its headword over this text. */
  | { type: "definition"; text: readonly SpotlightDefinitionPart[] }
  /** The text of a file, in the fixed-pitch font. */
  | { type: "text"; text: string }
  /** A picture, shown as a placeholder of its proportions, over its facts. */
  | { type: "image"; pixels: { width: number; height: number } }
  /** A folder, an application or a document that has no text to show: its icon and facts. */
  | { type: "summary" };

/** One thing the index knows. */
export interface SpotlightItem {
  /** Identifies the item: names are not unique (the captures list "page.txt" twice). */
  id: string;
  /** The name shown in the list, the completion and the preview. */
  name: string;
  category: SpotlightCategory;
  /** The kind as the Finder would name it: "Folder", "PNG image". */
  kind: string;
  /**
   * Words the index found inside the item, searched together with the name. Spotlight
   * searches contents and metadata, which is why "catalina.md" is found for "OS X".
   */
  contents?: string;
  /** Facts under a summary or a picture, as label and value: Version, Size, Modified. */
  details?: readonly (readonly [label: string, value: string])[];
  preview: SpotlightPreview;
}

/** The results of one category, in the index's order. */
export interface SpotlightResultGroup {
  category: SpotlightCategory;
  label: string;
  results: readonly SpotlightItem[];
}

/*
 * The words of a text, in lower case and without accents, for searching. A word is a run of
 * letters and digits in any script. Each word is indexed whole and in its parts: a capital
 * after a small letter and a change between letters and digits begin a part, so "macOS" is
 * found by "macos" and by "os", "iPadOS" by "ipados" and "os", and "600x600" by "x".
 * Accents are dropped from Latin, Greek and Cyrillic letters on both sides, so "cafe" finds
 * "Café" as Spotlight does; the marks of other scripts are kept, since there a vowel sign or a
 * virama is part of the spelling ("कल" is not "काला"), and they belong to the word they are in.
 */
const words = (text: string) =>
  text
    .normalize("NFD")
    .replace(/([\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}])\p{M}+/gu, "$1")
    .normalize("NFC")
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
    .flatMap((word) => {
      const parts = word
        .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2")
        .replace(/(\p{L})(\p{N})/gu, "$1 $2")
        .replace(/(\p{N})(\p{L})/gu, "$1 $2")
        .split(" ");
      return parts.length > 1 ? [word, ...parts] : [word];
    })
    .map((word) => word.toLowerCase());

/**
 * The items a query finds, grouped by category in the order of `CATEGORIES`, at most
 * `MAX_PER_CATEGORY` to a group, each group in the index's order. An item is found when every
 * word of the query begins a word of its name or its contents. An empty query finds nothing.
 */
export function search(items: readonly SpotlightItem[], query: string): SpotlightResultGroup[] {
  const terms = words(query);
  if (terms.length === 0) return [];
  const found = items.filter((item) => {
    const known = words(`${item.name} ${item.contents ?? ""}`);
    return terms.every((term) => known.some((word) => word.startsWith(term)));
  });
  return CATEGORIES.map(({ id, label }) => ({
    category: id,
    label,
    results: found.filter((item) => item.category === id).slice(0, MAX_PER_CATEGORY),
  })).filter((group) => group.results.length > 0);
}

/** The top hit: the first result of the first group, which is selected when the list changes. */
export const topHitOf = (groups: readonly SpotlightResultGroup[]): SpotlightItem | undefined =>
  groups[0]?.results[0];

const file = (
  kind: string,
  size: string,
  modified: string,
): Pick<SpotlightItem, "kind" | "details"> => ({
  kind,
  details: [
    ["Size", size],
    ["Modified", modified],
  ],
});

const application = (
  id: string,
  name: string,
  version: string,
  size: string,
  contents?: string,
): SpotlightItem => ({
  id,
  name,
  category: "applications",
  kind: "Application",
  contents,
  details: [
    ["Version", version],
    ["Size", size],
    ["Modified", "October 7, 2019"],
  ],
  preview: { type: "summary" },
});

/*
 * Names, groups and their order are the captures'. Everything else is the demo's own: the
 * text of every entry and file (the captures' entry and file are Apple's and are not
 * reproduced), every size, date and dimension, and the end of the two names that the captures
 * cut off with an ellipsis.
 */
const applications: readonly SpotlightItem[] = [
  application("calculator", "Calculator", "10.15", "6.2 MB"),
  application("calendar", "Calendar", "11.0", "21.4 MB"),
  application("dictionary", "Dictionary", "2.3.0", "14.8 MB"),
  application("safari", "Safari", "13.0", "24.7 MB", "web browser"),
  application("system-preferences", "System Preferences", "14.0", "2.9 MB", "settings"),
  application("textedit", "TextEdit", "1.15", "5.6 MB"),
];

const definitions: readonly SpotlightItem[] = [
  {
    id: "define-macos",
    name: "macOS",
    category: "definition",
    kind: "Dictionary",
    contents: "Mac OS X",
    // The demo's own wording, of the length of the Aqua capture's entry and with the same
    // cross-reference; the capture's text is the Dictionary's and is not reproduced.
    preview: {
      type: "definition",
      text: [
        "The system software that Mac computers run. It first shipped in 2001 under the name Mac OS X, which was later shortened to OS X. See also ",
        { see: "Classic Mac OS" },
        ".",
      ],
    },
  },
  {
    id: "define-classic-mac-os",
    name: "Classic Mac OS",
    category: "definition",
    kind: "Dictionary",
    preview: {
      type: "definition",
      text: [
        "The operating systems that Mac computers ran from 1984 until 2001, when a new system took their place. See also ",
        { see: "macOS" },
        ".",
      ],
    },
  },
  {
    id: "define-spotlight",
    name: "Spotlight",
    category: "definition",
    kind: "Dictionary",
    preview: {
      type: "definition",
      text: [
        "The search of a Mac. It opens from the magnifying glass in the menu bar and finds applications, documents, pictures and definitions while you type. See also ",
        { see: "macOS" },
        ".",
      ],
    },
  },
  {
    id: "define-aqua",
    name: "Aqua",
    category: "definition",
    kind: "Dictionary",
    preview: {
      type: "definition",
      text: [
        "The look of windows, menus and controls on a Mac, in a light and a dark appearance. See also ",
        { see: "macOS" },
        ".",
      ],
    },
  },
];

const image = (
  id: string,
  name: string,
  kind: string,
  width: number,
  height: number,
  size: string,
  contents?: string,
): SpotlightItem => ({
  id,
  name,
  category: "images",
  kind,
  contents,
  details: [
    ["Dimensions", `${width} × ${height}`],
    ["Size", size],
    ["Modified", "June 3, 2019"],
  ],
  preview: { type: "image", pixels: { width, height } },
});

const images: readonly SpotlightItem[] = [
  // The captures show "19 Apple_iPadOS_Paste-Feature_06…"; what follows is the demo's.
  image(
    "image-ipados",
    "19 Apple_iPadOS_Paste-Feature_060319.jpg",
    "JPEG image",
    1960,
    1470,
    "412 KB",
    "OS X",
  ),
  image("image-oscar", "Oscar_Circle-thumb600x600.png", "PNG image", 600, 600, "88 KB"),
  image("image-versions", "OS X Versions.psd", "Adobe Photoshop document", 2880, 1800, "36.1 MB"),
  image("image-mavericks", "09-OS-X-Mavericks.jpg", "JPEG image", 2560, 1600, "1.2 MB"),
  image("image-yosemite", "10-OS-X-Yosemite.jpg", "JPEG image", 2560, 1600, "1.4 MB"),
  image("image-screen-shot", "Screen Shot 2019-10-07.png", "PNG image", 3360, 2100, "2.8 MB"),
];

const folder = (id: string, name: string, items: string): SpotlightItem => ({
  id,
  name,
  category: "folders",
  kind: "Folder",
  details: [
    ["Contains", items],
    ["Modified", "September 30, 2019"],
  ],
  preview: { type: "summary" },
});

const folders: readonly SpotlightItem[] = [
  folder("folder-os-x", "OS X", "14 items"),
  folder("folder-documents", "Documents", "52 items"),
  folder("folder-downloads", "Downloads", "9 items"),
  folder("folder-screenshots", "Screenshots", "340 items"),
];

const documents: readonly SpotlightItem[] = [
  {
    id: "document-catalina",
    name: "catalina.md",
    category: "documents",
    ...file("Markdown document", "2 KB", "October 7, 2019"),
    contents: "OS X macOS review notes",
    preview: {
      type: "text",
      text: [
        "# macOS Catalina",
        "",
        "Notes for the 10.15 review.",
        "",
        "- The sixteenth release of what began as Mac OS X and was later OS X.",
        "- Music, Podcasts and TV take the place of iTunes.",
        "- Sidecar turns an iPad into a second display.",
        "- Screenshots: light and dark, every window that changed.",
        "",
      ].join("\n"),
    },
  },
  {
    id: "document-page-mavericks",
    name: "page.txt",
    category: "documents",
    ...file("Plain text document", "1 KB", "October 22, 2013"),
    contents: "OS X Mavericks",
    preview: {
      type: "text",
      text: "title: OS X Mavericks\nlayout: gallery\n\nScreenshots of OS X 10.9, taken on the day it shipped.\n",
    },
  },
  {
    id: "document-page-yosemite",
    name: "page.txt",
    category: "documents",
    ...file("Plain text document", "1 KB", "October 16, 2014"),
    contents: "OS X Yosemite",
    preview: {
      type: "text",
      text: "title: OS X Yosemite\nlayout: gallery\n\nScreenshots of OS X 10.10, taken on the day it shipped.\n",
    },
  },
  {
    id: "document-outline",
    name: "OS X calendars - SH outline.txt",
    category: "documents",
    ...file("Plain text document", "3 KB", "August 12, 2019"),
    preview: {
      type: "text",
      text: [
        "OS X calendars: outline",
        "",
        "1. Where the calendar came from",
        "2. What each release changed",
        "3. Subscriptions and shared calendars",
        "4. What is still missing",
        "",
      ].join("\n"),
    },
  },
  {
    id: "document-guest-recording",
    name: "Guest Recording - OS X.pages",
    category: "documents",
    ...file("Pages document", "184 KB", "May 20, 2019"),
    preview: { type: "summary" },
  },
  {
    id: "document-budget",
    name: "Budget 2019.numbers",
    category: "documents",
    ...file("Numbers spreadsheet", "96 KB", "January 14, 2019"),
    preview: { type: "summary" },
  },
];

/*
 * The text of the file the Dark Aqua capture previews: a property list of the shape and the
 * line lengths the capture shows, so that the pane wraps it as captured. The content is the
 * demo's own; the capture's file is Apple's and its text is not reproduced.
 */
const ASSETS_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
  '<plist version="1.0">',
  "<dict>",
  "\t<key>AssetType</key>",
  "\t<string>example.assets.dictionaries.sampleDictionaryOSX</string>",
  "\t<key>Assets</key>",
  "\t<array>",
  "\t\t<dict>",
  "\t\t\t<key>Countries</key>",
  "\t\t\t<array>",
  "\t\t\t\t<string>US</string>",
  "\t\t\t</array>",
  "\t\t\t<key>DictionaryNotice</key>",
  "\t\t\t<string>Placeholder text of the demo, not a notice.</string>",
  "\t\t\t<key>DictionaryIdentifier</key>",
  "\t\t\t<string>example.dictionary.SampleDictionary</string>",
  "\t\t\t<key>DictionaryPackageDisplayName</key>",
  "\t\t\t<string>Sample Dictionary</string>",
  "\t\t\t<key>DictionaryPackageName</key>",
  "\t\t\t<string>Sample Dictionary.dictionary</string>",
  "\t\t</dict>",
  "\t</array>",
  "</dict>",
  "</plist>",
  "",
].join("\n");

const developer: readonly SpotlightItem[] = [
  {
    id: "developer-assets",
    name: "com_apple_MobileAsset_DictionaryServices_dictionaryOSX.xml",
    category: "developer",
    ...file("XML text", "3 KB", "September 30, 2019"),
    contents: "OS X",
    preview: { type: "text", text: ASSETS_XML },
  },
  // The capture shows the same cut-off name twice: a second copy, in another folder.
  {
    id: "developer-assets-copy",
    name: "com_apple_MobileAsset_DictionaryServices_dictionaryOSX.xml",
    category: "developer",
    ...file("XML text", "3 KB", "June 3, 2019"),
    contents: "OS X",
    preview: {
      type: "text",
      text: ASSETS_XML.replace("<string>US</string>", "<string>GB</string>"),
    },
  },
  {
    id: "developer-version",
    name: "version.xml",
    category: "developer",
    ...file("XML text", "1 KB", "September 30, 2019"),
    contents: "OS X",
    preview: {
      type: "text",
      text: '<?xml version="1.0" encoding="UTF-8"?>\n<version>\n\t<platform>OS X</platform>\n\t<build>19A583</build>\n</version>\n',
    },
  },
  {
    id: "developer-license",
    name: "license.html",
    category: "developer",
    ...file("HTML text", "4 KB", "September 30, 2019"),
    contents: "OS X",
    preview: {
      type: "text",
      text: "<!DOCTYPE html>\n<html>\n<head>\n\t<title>License</title>\n</head>\n<body>\n\t<h1>License</h1>\n\t<p>Terms for the sample code, for OS X and later.</p>\n</body>\n</html>\n",
    },
  },
  {
    id: "developer-license-copy",
    name: "license.html",
    category: "developer",
    ...file("HTML text", "4 KB", "June 3, 2019"),
    contents: "OS X",
    preview: {
      type: "text",
      text: "<!DOCTYPE html>\n<html>\n<head>\n\t<title>License</title>\n</head>\n<body>\n\t<h1>License</h1>\n\t<p>Terms for the documentation, for OS X and later.</p>\n</body>\n</html>\n",
    },
  },
];

/**
 * The index of the Aqua capture's Mac: applications, definitions, pictures, folders and
 * documents. "OS X" finds what that capture lists.
 */
export const defaultItems: readonly SpotlightItem[] = [
  ...applications,
  ...definitions,
  ...images,
  ...folders,
  ...documents,
];

/**
 * The index of the Dark Aqua capture's Mac: the same with a developer's files, which come
 * first, so "OS X" finds what that capture lists and its top hit is the XML file.
 */
export const developerItems: readonly SpotlightItem[] = [...developer, ...defaultItems];
