import type { DictionaryEntry } from "./dictionary-data";

/*
 * The Apple scope on the desktop. Apple's own dictionary cannot ship and has no public source, so
 * these are short entries written for this desktop, for the words people look up about a Mac.
 */
const TERMS: readonly (readonly [word: string, text: string])[] = [
  [
    "AirDrop",
    "A way of sending files between nearby Apple devices over Wi-Fi and Bluetooth, with no network or cable to set up.",
  ],
  [
    "AirPlay",
    "A way of sending sound, video or a screen from one device to a speaker or television on the same network.",
  ],
  [
    "AirPods",
    "Wireless earphones made by Apple, which pair with a person's devices through their iCloud account.",
  ],
  ["Apple ID", "The account a person signs in with to use Apple's services across their devices."],
  ["Apple Music", "Apple's paid streaming music service, which appears in the Music app on a Mac."],
  [
    "Apple Pay",
    "A way of paying with a device in shops and online, using a card kept in its wallet.",
  ],
  ["Apple Watch", "A wristwatch made by Apple, which runs watchOS and works with an iPhone."],
  [
    "App Store",
    "The app on a Mac, and on other Apple devices, from which software is found, bought and updated.",
  ],
  [
    "Aqua",
    "The name of the look of the Mac's interface, first shown in 2000, in which controls resemble glossy water.",
  ],
  [
    "Catalina",
    "macOS 10.15, released in October 2019, named for an island off the coast of California.",
  ],
  [
    "Command key",
    "The Mac keyboard's key marked with a looped square, which is held down with others to give commands.",
  ],
  [
    "Continuity",
    "The features that let a Mac, iPhone and iPad work together, such as taking a call on one or copying on one and pasting on another.",
  ],
  [
    "Dark Mode",
    "A setting that gives the Mac's windows and controls a dark appearance, chosen in General preferences.",
  ],
  [
    "Dock",
    "The row of icons along an edge of a Mac's screen, which opens apps, folders and documents.",
  ],
  ["FaceTime", "Apple's app and service for video and audio calls between its devices."],
  ["Finder", "The Mac's app for finding and arranging files, and the one that is always open."],
  [
    "Gatekeeper",
    "The part of macOS that checks that an app comes from a known developer before it first opens.",
  ],
  [
    "iCloud",
    "Apple's online service for keeping a person's documents, photos and settings the same on all their devices.",
  ],
  ["iMac", "Apple's desktop computer that has the computer itself built into the display."],
  [
    "iMessage",
    "Apple's service for sending messages over the internet between its devices, which the Messages app uses.",
  ],
  ["iOS", "The operating system of the iPhone."],
  ["iPad", "Apple's tablet computer, which has a touch screen and runs iPadOS."],
  ["iPhone", "Apple's smartphone, first sold in 2007, which runs iOS."],
  ["iPod", "Apple's family of portable music players, first sold in 2001."],
  [
    "iTunes",
    "Apple's former app for music, films and syncing devices, which macOS Catalina replaced with Music, TV, Podcasts and the Finder.",
  ],
  ["Keychain", "The place on a Mac where passwords and other secrets are kept in encrypted form."],
  ["Mac", "Short for Macintosh: Apple's line of personal computers, which run macOS."],
  ["MacBook", "Apple's line of portable Mac computers."],
  ["macOS", "The operating system of the Mac."],
  [
    "Mission Control",
    "The Mac's view of every open window, full-screen app and desktop space at once.",
  ],
  [
    "Retina display",
    "Apple's name for a screen with pixels so fine that, at a normal distance, the eye cannot pick them out.",
  ],
  ["Safari", "Apple's web browser."],
  ["Sidecar", "A feature of macOS Catalina that uses an iPad as a second display for a Mac."],
  ["Siri", "Apple's voice assistant, which answers spoken questions and carries out requests."],
  [
    "Spotlight",
    "The Mac's search, which finds files, apps and answers from a field opened by Command-Space.",
  ],
  [
    "Time Machine",
    "The Mac's feature for backing up files to another disk and going back to earlier versions of them.",
  ],
  [
    "Touch Bar",
    "A narrow touch screen above the keyboard of some MacBook Pro computers, which changes with the app in use.",
  ],
  ["Touch ID", "Apple's fingerprint sensor, used to unlock a device and approve purchases."],
  ["tvOS", "The operating system of Apple TV."],
  ["watchOS", "The operating system of Apple Watch."],
];

const BY_WORD = new Map(TERMS.map(([word, text]) => [word.toLowerCase(), { word, text }]));

/** The terms whose words begin with what is typed; none for an empty field. */
export function appleTermsFor(typed: string | null | undefined): string[] {
  const start = typed?.trim().toLowerCase();
  if (!start) return [];
  return TERMS.filter(([word]) => word.toLowerCase().startsWith(start)).map(([word]) => word);
}

/**
 * An entry with the Apple scope's paragraph for its word, when there is one. The word stands in the
 * spelling of the entry, and the paragraph takes the place of a word no other source knows or is
 * still being asked about.
 */
export function withAppleTerm(entry: DictionaryEntry): DictionaryEntry {
  const term = BY_WORD.get(entry.word.toLowerCase());
  if (!term) return entry;
  const { status: _status, ...rest } = entry;
  return { ...rest, apple: term.text };
}
