import { Contacts } from "./contacts";
import { ContactsPreferences } from "./contacts-preferences";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks), open it at `defaultSize`, keep it at least `minSize`, and
 * show `menus` in the menu bar while it is the front application.
 */
export const contactsApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "contacts",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Contacts",
  /** The app as a window. */
  component: Contacts,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 938, height: 438 },
  /** The smallest frame at which the three panes and a card's bar keep their room. */
  minSize: { width: 780, height: 320 },
  /** The window can be resized, and its zoom button enters full screen. */
  resizable: true,
  /** Finder opens vCard files here: a double-click on a `.vcf`. */
  opens: (file: { name: string; type?: string }) =>
    /vcard/i.test(file.type ?? "") || /\.(vcf|vcard)$/i.test(file.name),
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Contacts", "File", "Edit", "View", "Card", "Window", "Help"],
  /** A card opens in a window of its own: a desktop gives it `DesktopWindow`. */
  windows: true,
  /** Contacts > Preferences: a window of its own. */
  preferences: { component: ContactsPreferences, defaultSize: { width: 480, height: 220 } },
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = contactsApp;

export type { ContactsProps } from "./contacts";
export type { ContactActionDetail } from "./contacts-card";
export type {
  Contact,
  ContactAction,
  ContactField,
  ContactGroupId,
  ContactService,
} from "./contacts-data";
