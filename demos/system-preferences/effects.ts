/**
 * What the desktop does with each pane's settings. Every setting of a pane is kept for the person's
 * account on a desktop served by the Ferrite application (`storage.ts`) and shown again when the
 * pane opens, but the desktop acts on only a few of them. So that no control looks as if it did
 * something it does not, the window says under each pane which of its settings take effect here
 * and that the rest change nothing (`SystemPreferences`).
 *
 * The names are the controls' own labels as the panes show them. A pane that is not listed has no
 * setting the desktop acts on.
 */
export const PANE_EFFECTS: Readonly<Record<string, readonly string[]>> = {
  // The page's theme (`macalicious/lib/appearance`), the Apple menu's Recent Items, and what
  // `setting-effects.ts` puts on the page.
  general: [
    "Appearance",
    "Accent color",
    "Highlight color",
    "Recent items",
    "Sidebar icon size",
    "Automatically hide and show the menu bar",
    "Show scroll bars",
    "Click in the scroll bar to",
    "Ask to keep changes when closing documents",
    "Close windows when quitting an app",
    "Use font smoothing when available",
  ],
  // The desktop's Dock (`desktop-personal.ts`), and what `setting-effects.ts` puts on the page.
  dock: [
    "Size",
    "Magnification",
    "Position on screen",
    "Automatically hide and show the Dock",
    "Minimize windows using",
    "Double-click a window’s title bar to",
    "Show indicators for open applications",
    "Prefer tabs when opening documents",
  ],
  // The screen saver asks for the password (`panes/desktop-and-screen-saver/screen-saver.ts`).
  "security-and-privacy": ["Require password", "the lock message", "the Advanced settings"],
  // `panes/accessibility/page-accessibility.ts`.
  accessibility: [
    "Display",
    "Speech",
    "Audio",
    "Zoom",
    "Captions",
    "Show Accessibility status in menu bar",
  ],
  // The desktop's Share menus (`desktop-share-link.tsx`) and Notification Center's Today.
  extensions: ["the Share Menu", "Today"],
  // The desktop picture (`panes/desktop-and-screen-saver/stored-picture.ts`) and the screen saver
  // (`panes/desktop-and-screen-saver/screen-saver.ts`).
  "desktop-and-screen-saver": [
    "the desktop picture",
    "its Dynamic, Light or Dark setting",
    "Change picture",
    "the screen saver",
  ],
};

/** Height of the note under a pane, in points: two lines of small text with their padding. */
export const EFFECTS_NOTE_HEIGHT = 44;

const listed = (names: readonly string[]) =>
  names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** A pane's own note, where a list of what takes effect would not tell the person enough. */
const PANE_OWN_NOTE: Readonly<Record<string, string>> = {
  general:
    "On this desktop these settings take effect. Ask to keep changes is TextEdit's, whose documents have files; Close windows brings back the windows, as each application keeps its own contents.",
  dock: "On this desktop these settings take effect. Prefer tabs is for Terminal: Finder and Safari have settings of their own, and the other applications have no tabs.",
  siri: "Enable Ask Siri, Listen for “Hey Siri”, Language, Siri Voice, Voice Feedback and Show Siri in menu bar take effect here. Hey Siri listens only while this page is open; your browser's recognizer may send what it hears to its maker.",
  sound:
    "On this desktop these settings govern what the desktop itself plays. A web page cannot reach your computer's sound device or volume.",
  keyboard:
    "On this desktop the Text tab, Dictation's On, Off and Language, and the viewers' check box take effect. The dimmed settings are your computer's, which a web page cannot read or change.",
  mouse:
    "On this desktop only Scroll direction takes effect. The dimmed settings are your computer's, which a web page cannot read or change.",
  trackpad: "The dimmed settings are your computer's, which a web page cannot read or change.",
  "mission-control":
    "On this desktop the shortcuts, Hot Corners and Group windows by application take effect. The dimmed settings are what this desktop always does.",
  "language-and-region":
    "On this desktop Region and Calendar write the examples and Today's date, and First day of week and 24-Hour Time take effect. The dimmed settings say why.",
  spotlight:
    "On this desktop Search Results and Privacy take effect. There are no suggestions to allow, as the dimmed setting says.",
  notifications:
    "On this desktop From, When the display is sleeping, the two call settings, each application's settings and the sort order take effect. The dimmed settings say why.",
};

/** The note under the pane `pane`: which of its settings take effect on this desktop. */
export function effectsNote(pane: string): string {
  const own = PANE_OWN_NOTE[pane];
  if (own) return own;
  const names = PANE_EFFECTS[pane];
  if (!names || names.length === 0) {
    return "This pane's settings are kept for your account, but change nothing on this desktop.";
  }
  return `On this desktop only ${listed(names)} ${names.length === 1 ? "takes" : "take"} effect. This pane's other settings are kept for your account, but change nothing here.`;
}
