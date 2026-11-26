import { onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { useEffect } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { AIRDROP, COMPUTER, HOME, RECENTS } from "../finder/finder-data";
import {
  type FinderCommand,
  type FinderGoPlace,
  type FinderMenuCommands,
  finderEditRows,
  finderGoRows,
  finderHelpRows,
} from "../finder/finder-menus";
import { showInFinder } from "../finder/finder-open";

const OFF: FinderCommand = { enabled: false, run: () => {} };

const place = (label: string, keyEquivalent: string, where: string): FinderGoPlace => ({
  label,
  keyEquivalent,
  run: () => showInFinder({ place: where }),
});
const absent = (label: string, keyEquivalent: string, what: string): FinderGoPlace => ({
  label,
  keyEquivalent,
  reason: `The drive has no ${what}.`,
  run: () => {},
});
const PLACES: readonly FinderGoPlace[] = [
  place("Recents", "shift+command+f", RECENTS),
  place("Documents", "shift+command+o", `${HOME}/Documents`),
  place("Desktop", "shift+command+d", `${HOME}/Desktop`),
  place("Downloads", "option+command+l", `${HOME}/Downloads`),
  place("Home", "shift+command+h", HOME),
  place("Computer", "shift+command+c", COMPUTER),
  place("AirDrop", "shift+command+r", AIRDROP),
  absent("Network", "shift+command+k", "network"),
  absent("iCloud Drive", "shift+command+i", "iCloud Drive"),
  place("Utilities", "shift+command+u", "/Applications/Utilities"),
];

/**
 * What Finder's menus do with this window in front: About This Mac belongs to no application of its
 * own, and Finder with no window has nothing selected to act on, so Edit is dimmed and Go opens a
 * Finder window where it is asked to. The Go menu's Applications is the desktop's own submenu.
 */
const COMMANDS: FinderMenuCommands = {
  drive: true,
  newFolder: OFF,
  newFolderWithSelection: OFF,
  newSmartFolder: OFF,
  upload: OFF,
  newTab: OFF,
  open: OFF,
  openWith: [],
  getInfo: OFF,
  quickLook: OFF,
  quickLookTitle: "Quick Look",
  duplicate: OFF,
  compress: OFF,
  compressTitle: "Compress",
  makeAlias: OFF,
  showOriginal: OFF,
  addToSidebar: OFF,
  addToDock: OFF,
  print: OFF,
  rename: OFF,
  renameTitle: "Rename",
  download: OFF,
  trash: OFF,
  putBack: OFF,
  find: OFF,
  tagRows: null,
  copy: OFF,
  copyTitle: "Copy",
  showClipboard: OFF,
  slideshow: OFF,
  slideshowTitle: "Slideshow",
  clipboardShown: false,
  paste: OFF,
  pasteTitle: "Paste",
  moveHere: OFF,
  moveHereTitle: "Move Item Here",
  selectAll: OFF,
  deselectAll: OFF,
  undo: OFF,
  undoTitle: "Undo",
  redo: OFF,
  redoTitle: "Redo",
  view: "icons",
  setView: () => {},
  views: [],
  sort: "none",
  setSort: () => {},
  sorts: [],
  group: "none",
  setGroup: () => {},
  groups: [],
  toggleGroups: OFF,
  sidebarShown: false,
  toggleSidebar: OFF,
  pathBarShown: false,
  togglePathBar: OFF,
  statusBarShown: false,
  toggleStatusBar: OFF,
  iconsShown: false,
  toolbarShown: false,
  toggleToolbar: OFF,
  customizeToolbar: OFF,
  tabBarShown: false,
  toggleTabBar: OFF,
  previewShown: false,
  togglePreview: OFF,
  viewOptions: OFF,
  viewOptionsShown: false,
  back: OFF,
  forward: OFF,
  enclosing: OFF,
  places: PLACES,
  goToFolder: { enabled: true, run: () => showInFinder({ show: "go-to-folder" }) },
  recentFolders: [],
  savedSearches: [],
  clearRecentFolders: () => {},
  selectStartupDisk: { enabled: true, run: () => showInFinder({ place: COMPUTER }) },
  library: { reason: "The drive has no Library folder.", run: () => {} },
  showHidden: OFF,
  inspector: OFF,
  inspectorShown: false,
  summaryInfo: OFF,
  closeTab: OFF,
  nextTab: OFF,
  previousTab: OFF,
  moveTabToWindow: OFF,
  mergeAllWindows: OFF,
  showAllTabs: OFF,
  allTabsShown: false,
  connect: OFF,
  emptyTrash: OFF,
  emptyTrashNow: OFF,
};

const GO_KEYS = Object.fromEntries(
  PLACES.filter((each) => each.reason === undefined).map((each) => [each.keyEquivalent, each.run]),
);

/** Finder's own Edit, Go and Help rows while About This Mac is in front, and Go's keys while key. */
export function useAboutThisMacMenus(isKey: boolean) {
  useDesktopAppMenu("about-this-mac", "Edit", finderEditRows(COMMANDS));
  useDesktopAppMenu("about-this-mac", "Go", finderGoRows(COMMANDS));
  useDesktopAppMenu("about-this-mac", "Help", finderHelpRows());
  useEffect(() => {
    if (!isKey) return;
    return onMenuKeyEquivalents(window, GO_KEYS);
  }, [isKey]);
}
