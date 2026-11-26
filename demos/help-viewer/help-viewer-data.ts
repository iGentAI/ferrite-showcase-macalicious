/*
 * The Help Viewer demo's data: the table of contents, the page of every topic and the index
 * that the search reads. Nothing is fetched and nothing is random.
 *
 * From the reference captures (reference/spec/apps/help-viewer.md): the window's title, the
 * twelve entries of the table of contents, the strings of the welcome page, the eight topics
 * that the two searches for "File" list with their descriptions, the order each capture lists
 * them in, and the number of results, 558. Everything else is invented, generic and short: the
 * topics inside each section, the text of every page, and the topics of other applications'
 * guides that bring the index to the captured count.
 */

/** The title of the window, which is the guide's. */
export const GUIDE_TITLE = "macOS User Guide";

/** The id of the page the viewer opens on. */
export const WELCOME = "welcome";

/** The strings of the welcome page, as captured. */
export const welcome = {
  title: GUIDE_TITLE,
  subtitle: "for macOS 10.15",
  contents: "Table of Contents",
  heading: "Do more on the desktop",
  text: "With macOS, you can easily organize and customize your desktop—and get work done without ever opening an app.",
} as const;

/** One page of help. */
export interface HelpTopic {
  /** Identifies the topic: in the history, in the table of contents and in a search ranking. */
  id: string;
  title: string;
  /** One or two sentences: the description under the title in a list of search results. */
  summary: string;
  /** The rest of the page: paragraphs after the summary. */
  body: readonly string[];
  /** The section of the guide, or the other guide, that the topic belongs to. */
  source: string;
}

/** An entry of the table of contents: a page of its own and, in a section, its topics. */
export interface HelpSection {
  id: string;
  title: string;
  /** What the section's own page says above the list of its topics. */
  summary: string;
  /** The topics a disclosure triangle shows. An entry without them has no triangle. */
  topics?: readonly HelpTopic[];
}

/** A title as an id: lower case, with everything but letters and digits as one hyphen. */
const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** A section with its topics, each given as title, summary and the paragraphs after it. */
function section(
  title: string,
  summary: string,
  topics?: readonly (readonly [title: string, summary: string, ...body: string[]])[],
): HelpSection {
  return {
    id: slug(title),
    title,
    summary,
    topics: topics?.map(([name, text, ...body]) => ({
      id: slug(name),
      title: name,
      summary: text,
      body,
      source: title,
    })),
  };
}

/**
 * The table of contents after Welcome, in the captured order. The titles of the eleven entries
 * are the capture's; the last two have no disclosure triangle there. The eight topics whose
 * titles end in "on Mac" or "on a Mac?" or name FileVault are the search results of the two
 * search captures, with the captured descriptions; one of those is cut after "take" in both
 * captures and is kept as it is shown.
 */
export const sections: readonly HelpSection[] = [
  section("Basics", "What is on the screen when your Mac starts, and how to find your way.", [
    [
      "Get to know the desktop",
      "The menu bar is at the top of the screen and the Dock is at the bottom. Your windows are in between.",
      "Click the desktop to work with it, or click a window to bring that window to the front.",
    ],
    [
      "Use the Dock",
      "Keep the apps you use most in the Dock and open one with a click.",
      "Drag an app into the Dock to keep it there. Drag it out again to remove it.",
    ],
    [
      "Find things with Spotlight",
      "Search for apps, documents and answers from anywhere on your Mac.",
      "Click the magnifying glass in the menu bar, then type what you are looking for.",
    ],
  ]),
  section("Apps", "Open the apps that come with your Mac, work in their windows and quit them.", [
    [
      "Open apps",
      "Open an app from the Dock, from Launchpad or with Spotlight.",
      "An app that is open has a dot under its icon in the Dock.",
    ],
    [
      "Work with app windows",
      "Move, resize, minimize and close the windows of an app.",
      "Drag a window by its title bar to move it, or drag an edge to change its size.",
    ],
    [
      "Quit apps",
      "Quit an app when you have finished working in it.",
      "Choose Quit from the app’s menu in the menu bar. The app asks about work that is not saved.",
    ],
  ]),
  section("Customize your Mac", "Make the desktop and the windows look the way you like.", [
    [
      "Change the desktop picture",
      "Choose a picture or a colour for the desktop in System Preferences.",
      "Open Desktop & Screen Saver, then click a picture on the right.",
    ],
    [
      "Use a light or dark appearance",
      "Choose a light appearance, a dark one, or one that follows the time of day.",
      "Open General preferences, then click an appearance at the top.",
    ],
    [
      "Choose an accent color",
      "Pick the colour of buttons, menus and selected items.",
      "Open General preferences, then click one of the eight colours.",
    ],
  ]),
  section("Files and folders", "Keep your work in folders, open it, move it and share it.", [
    [
      "Organize your work in folders",
      "Create folders in the Finder and drag your work into them.",
      "Choose New Folder in the Finder, type a name, then press Return.",
    ],
    [
      "Choose an app to open a file on Mac",
      "In the Finder on your Mac, select a specific app to open a file.",
      "Hold the Control key and click the item, then choose an app from the Open With menu.",
    ],
    [
      "If you can’t move or copy a file or folder on Mac",
      "In the Finder on your Mac, check the permissions setting for the file or folder you can’t move or copy.",
      "Select the item, choose Get Info, then look under Sharing & Permissions.",
    ],
    [
      "If you don’t have permission to open a file or folder on Mac",
      "In the Finder on your Mac, you may be able to change the permissions setting to open the file or folder.",
      "If the setting cannot be changed, ask the owner of the item or an administrator of the Mac.",
    ],
    [
      "Share a document as a PDF file on Mac",
      "On your Mac, share a document as a PDF file using Mail, Messages, iCloud Drive, and more.",
      "Choose Print, click the PDF button, then choose where to send the document.",
    ],
  ]),
  section("Apple ID and iCloud", "One account for your documents, pictures and purchases.", [
    [
      "Sign in with your Apple ID",
      "Use one account for the App Store, iCloud and the other services.",
      "Open System Preferences, click Sign In, then enter your Apple ID and password.",
    ],
    [
      "Keep documents in iCloud Drive",
      "Store documents in iCloud Drive and open them on every device you use.",
      "Drag a document to iCloud Drive in the Finder sidebar.",
    ],
  ]),
  section("Use Apple devices together", "Start on one device and carry on with another.", [
    [
      "Hand off work between devices",
      "Start a message or a note on one device and finish it on another.",
      "When a device is near, the app you were using appears at the end of the Dock.",
    ],
    [
      "Copy on one device and paste on another",
      "Copy text or a picture on one device, then paste it on a device nearby.",
      "Both devices are signed in with the same Apple ID and have Bluetooth turned on.",
    ],
  ]),
  section("Music, books, news, and more", "Listen, read and watch with the apps on your Mac.", [
    [
      "Listen to music",
      "Play the songs in your library in the Music app.",
      "Select a song, then click the Play button at the top of the window.",
    ],
    [
      "Read books",
      "Open a book from your library and turn its pages.",
      "Swipe left or right on the trackpad, or press the arrow keys.",
    ],
  ]),
  section("Privacy and security", "Protect the information on your Mac and choose who sees it.", [
    [
      "Choose a strong password",
      "A password that is long and not a word is hard to guess.",
      "Change your password in Users & Groups preferences.",
    ],
    [
      "Change FileVault preferences on Mac",
      "Use FileVault to protect the information on your Mac by encrypting it.",
      "Open Security & Privacy preferences, then click FileVault.",
    ],
    [
      "Encrypt Mac data with FileVault",
      "Use FileVault to encrypt the data on your Mac to keep it secure.",
      "Encryption happens in the background while you work, and only while the Mac is awake.",
    ],
    [
      "How does FileVault encryption work on a Mac?",
      "When you encrypt your information using FileVault, your data remains secure if your Mac is stolen, lost, or accessed without your permission.",
      "Your login password unlocks the disk each time the Mac starts.",
    ],
    [
      "Turn off FileVault encryption on Mac",
      "When you turn off FileVault on your Mac, your data is decrypted. Depending on how much data you have, decryption may take",
      "a while. You can keep working while the disk is decrypted.",
    ],
  ]),
  section("Mac hardware", "The trackpad, the keyboard and what you connect to your Mac.", [
    [
      "Use the trackpad",
      "Click, scroll and zoom with one or more fingers.",
      "Slide two fingers up or down to scroll. Pinch with two fingers to zoom.",
    ],
    [
      "Connect a display",
      "Use a second display to make the desktop larger.",
      "Connect the display, then arrange it in Displays preferences.",
    ],
  ]),
  section(
    "Resources for your Mac",
    "Where to look for the specifications, the warranty and the service options of your Mac.",
  ),
  section(
    "Resources for your Apple devices",
    "Where to look for the guides of the other devices you use with your Mac.",
  ),
];

/** The search of both search captures, and the number of results both report for it. */
export const CAPTURED_QUERY = "File";
export const CAPTURED_COUNT = 558;

/** How many results are listed before "Show all": the six of the captures. */
export const RESULTS_SHOWN = 6;

/** The topics of the guide itself, in the order of the table of contents. */
const guideTopics: readonly HelpTopic[] = sections.flatMap(({ topics }) => topics ?? []);

/** Whether a topic's title or summary contains the text, whatever its case. */
export const mentions = (topic: HelpTopic, text: string) =>
  topic.title.toLowerCase().includes(text) || topic.summary.toLowerCase().includes(text);

/*
 * "All Help" searches the guides of every application, and the captures count 558 results for
 * "File". The guide above holds a handful, so the index is brought to that count with invented
 * topics of other applications' guides, one per application and command: enough of them, in
 * this order, that a search for "File" finds exactly the captured number.
 */
const OTHER_APPS = [
  "Preview",
  "TextEdit",
  "Notes",
  "Mail",
  "Pages",
  "Numbers",
  "Keynote",
  "Photos",
  "Safari",
  "Calendar",
  "Contacts",
  "Reminders",
  "Music",
  "Podcasts",
  "Books",
  "Maps",
  "Messages",
  "Stickies",
  "Terminal",
  "Console",
  "Font Book",
  "Script Editor",
  "Automator",
  "Voice Memos",
  "Photo Booth",
  "QuickTime Player",
] as const;

const FILE_COMMANDS = [
  "Open",
  "Save",
  "Rename",
  "Duplicate",
  "Move",
  "Print",
  "Share",
  "Lock",
  "Export",
  "Import",
  "Attach",
  "Find",
  "Delete",
  "Restore",
  "Compress",
  "Tag",
  "Preview",
  "Close",
  "Revert",
  "Copy",
  "Protect",
  "Drag",
  "Browse",
] as const;

const otherTopics: readonly HelpTopic[] = (() => {
  const needed =
    CAPTURED_COUNT -
    guideTopics.filter((topic) => mentions(topic, CAPTURED_QUERY.toLowerCase())).length;
  const out: HelpTopic[] = [];
  for (const command of FILE_COMMANDS) {
    for (const app of OTHER_APPS) {
      if (out.length === needed) return out;
      const title = `${command} a file in ${app} on Mac`;
      out.push({
        id: slug(title),
        title,
        summary: `In ${app} on your Mac, use the ${command} command to work with a file.`,
        body: [
          `Select the item in ${app}, then choose ${command} from the menu bar or press its keyboard shortcut.`,
        ],
        source: `${app} Help`,
      });
    }
  }
  return out;
})();

/** Every topic the search reads: the guide's, then the other guides'. */
export const topics: readonly HelpTopic[] = [...guideTopics, ...otherTopics];

const byId = new Map(topics.map((topic) => [topic.id, topic]));

/** The topic with an id, if there is one. */
export const findTopic = (id: string): HelpTopic | undefined => byId.get(id);

/** The entry of the table of contents with an id, if there is one. */
export const findSection = (id: string): HelpSection | undefined =>
  sections.find((entry) => entry.id === id);

/** The section of the guide that holds a topic, if one does. */
export const sectionOf = (id: string): HelpSection | undefined =>
  sections.find(({ topics: inside }) => inside?.some((topic) => topic.id === id));

/** Whether an id names a page: Welcome, an entry of the table of contents or a topic. */
export const isPage = (id: string): boolean =>
  id === WELCOME || byId.has(id) || findSection(id) !== undefined;

/**
 * A ranking: the ids of the topics a search lists first, in order. The two search captures
 * list different topics for the same text, so each has its own; a topic that is not ranked
 * follows in the order of the index.
 */
export type HelpRanking = readonly string[];

const ranked = (...titles: string[]): HelpRanking => titles.map(slug);

/** The order of 10-15-Catalina-Light-Help-Search.png. */
export const lightRanking: HelpRanking = ranked(
  "Change FileVault preferences on Mac",
  "How does FileVault encryption work on a Mac?",
  "If you don’t have permission to open a file or folder on Mac",
  "Turn off FileVault encryption on Mac",
  "Share a document as a PDF file on Mac",
  "If you can’t move or copy a file or folder on Mac",
);

/** The order of 10-15-Catalina-Dark-Help-Search.png. */
export const darkRanking: HelpRanking = ranked(
  "If you can’t move or copy a file or folder on Mac",
  "Encrypt Mac data with FileVault",
  "Choose an app to open a file on Mac",
  "Share a document as a PDF file on Mac",
  "If you don’t have permission to open a file or folder on Mac",
  "Turn off FileVault encryption on Mac",
);

/**
 * The topics whose title or summary contains the text, whatever its case: the ranked ones
 * first, in the ranking's order, then the others in the order of the index. No text, or only
 * spaces, finds nothing.
 */
export function searchHelp(query: string, ranking: HelpRanking = lightRanking): HelpTopic[] {
  const text = query.trim().toLowerCase();
  if (text === "") return [];
  const place = (topic: HelpTopic) => {
    const at = ranking.indexOf(topic.id);
    return at < 0 ? ranking.length : at;
  };
  // The sort is stable, so topics of one place keep the order of the index.
  return topics.filter((topic) => mentions(topic, text)).sort((a, b) => place(a) - place(b));
}
