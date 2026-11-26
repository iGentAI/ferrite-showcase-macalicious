/** One icon of the Show All grid, or one of the two buttons of the account header. */
export interface CatalogueEntry {
  /** The pane's id: its folder under `panes/` and the name of its blueprint. */
  id: string;
  /** The pane's name: the window title while it is open, and what search matches. */
  name: string;
  /** The caption under the icon, one string per line, broken as Catalina breaks it. */
  caption: readonly string[];
}

const entry = (id: string, name: string, ...caption: string[]): CatalogueEntry => ({
  id,
  name,
  caption: caption.length > 0 ? caption : [name],
});

/** The two buttons at the trailing edge of the account header. */
export const ACCOUNT_PANES: readonly CatalogueEntry[] = [
  entry("apple-id", "Apple ID"),
  entry("family-sharing", "Family Sharing", "Family", "Sharing"),
];

/**
 * The grid, in the order and with the line breaks of System-Preferences-0: two bands of two
 * rows of eight; the last row has seven.
 */
export const GRID_BANDS: readonly (readonly CatalogueEntry[])[] = [
  [
    entry("general", "General"),
    entry("desktop-and-screen-saver", "Desktop & Screen Saver", "Desktop &", "Screen Saver"),
    entry("dock", "Dock"),
    entry("mission-control", "Mission Control", "Mission", "Control"),
    entry("siri", "Siri"),
    entry("spotlight", "Spotlight"),
    entry("language-and-region", "Language & Region", "Language", "& Region"),
    entry("notifications", "Notifications"),
    entry("internet-accounts", "Internet Accounts", "Internet", "Accounts"),
    entry("wallet-and-apple-pay", "Wallet & Apple Pay", "Wallet &", "Apple Pay"),
    entry("touch-id", "Touch ID"),
    entry("users-and-groups", "Users & Groups", "Users &", "Groups"),
    entry("accessibility", "Accessibility"),
    entry("screen-time", "Screen Time"),
    entry("extensions", "Extensions"),
    entry("security-and-privacy", "Security & Privacy", "Security", "& Privacy"),
  ],
  [
    entry("software-update", "Software Update", "Software", "Update"),
    entry("network", "Network"),
    entry("bluetooth", "Bluetooth"),
    entry("sound", "Sound"),
    entry("printers-and-scanners", "Printers & Scanners", "Printers &", "Scanners"),
    entry("keyboard", "Keyboard"),
    entry("trackpad", "Trackpad"),
    entry("mouse", "Mouse"),
    entry("displays", "Displays"),
    entry("sidecar", "Sidecar"),
    entry("energy-saver", "Energy Saver", "Energy", "Saver"),
    entry("date-and-time", "Date & Time"),
    entry("sharing", "Sharing"),
    entry("time-machine", "Time Machine", "Time", "Machine"),
    entry("startup-disk", "Startup Disk", "Startup", "Disk"),
  ],
];

/** Every pane of the window by id: the grid's thirty-one and the account header's two. */
export const CATALOGUE: ReadonlyMap<string, CatalogueEntry> = new Map(
  [...ACCOUNT_PANES, ...GRID_BANDS.flat()].map((item) => [item.id, item]),
);
