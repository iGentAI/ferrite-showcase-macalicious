import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import type { ReactNode } from "react";
import { useOptionKey } from "../desktop/desktop-dock";
import { requestHelp } from "../desktop/desktop-help";
import type { FinderView } from "./finder-data";

/**
 * Finder's menu bar rows, over what its window carries out. The window makes the commands afresh on
 * each render (`finder.tsx`), so a row acts on the window as it is, and the same commands answer the
 * keys (`finderMenuKeys`). Nothing here holds state.
 */

/** A command: whether it can run now, and running it. */
export interface FinderCommand {
  enabled: boolean;
  run: () => void;
}

/** A place of the Go menu. */
export interface FinderGoPlace {
  label: string;
  keyEquivalent: string;
  /** Why it is dimmed, when this window has no such place. */
  reason?: string;
  run: () => void;
}

/** What the menus show and do. */
export interface FinderMenuCommands {
  /** Whether the window shows the person's drive. */
  drive: boolean;
  newFolder: FinderCommand;
  newFolderWithSelection: FinderCommand;
  newSmartFolder: FinderCommand;
  upload: FinderCommand;
  newTab: FinderCommand;
  open: FinderCommand;
  /** The applications that open the selected file, each opening it there. */
  openWith: readonly { id: string; name: string; open: () => void; always: () => void }[];
  getInfo: FinderCommand;
  quickLook: FinderCommand;
  quickLookTitle: string;
  duplicate: FinderCommand;
  /** Compress “item”, or Compress N Items. */
  compress: FinderCommand;
  compressTitle: string;
  makeAlias: FinderCommand;
  showOriginal: FinderCommand;
  addToSidebar: FinderCommand;
  addToDock: FinderCommand;
  print: FinderCommand;
  rename: FinderCommand;
  /** Rename, or Rename N Items… with several selected. */
  renameTitle: string;
  download: FinderCommand;
  trash: FinderCommand;
  putBack: FinderCommand;
  find: FinderCommand;
  /** A row for each tag, for what is selected. */
  tagRows: ReactNode;
  copy: FinderCommand;
  copyTitle: string;
  showClipboard: FinderCommand;
  /** The items selected, full screen. */
  slideshow: FinderCommand;
  slideshowTitle: string;
  clipboardShown: boolean;
  paste: FinderCommand;
  pasteTitle: string;
  moveHere: FinderCommand;
  moveHereTitle: string;
  selectAll: FinderCommand;
  deselectAll: FinderCommand;
  undo: FinderCommand;
  undoTitle: string;
  redo: FinderCommand;
  redoTitle: string;
  view: FinderView;
  setView: (view: FinderView) => void;
  views: readonly { view: FinderView; label: string }[];
  sort: string;
  setSort: (column: string) => void;
  sorts: readonly { column: string; label: string }[];
  /** The section the items are grouped by, `none` for none. */
  group: string;
  setGroup: (column: string) => void;
  groups: readonly { column: string; label: string }[];
  /** Use Groups: only the icon and list views have sections. */
  toggleGroups: FinderCommand;
  sidebarShown: boolean;
  toggleSidebar: FinderCommand;
  pathBarShown: boolean;
  togglePathBar: FinderCommand;
  statusBarShown: boolean;
  toggleStatusBar: FinderCommand;
  /** Icon view has a grid to clean up. */
  iconsShown: boolean;
  toolbarShown: boolean;
  toggleToolbar: FinderCommand;
  customizeToolbar: FinderCommand;
  tabBarShown: boolean;
  toggleTabBar: FinderCommand;
  previewShown: boolean;
  togglePreview: FinderCommand;
  viewOptions: FinderCommand;
  viewOptionsShown: boolean;
  back: FinderCommand;
  forward: FinderCommand;
  enclosing: FinderCommand;
  places: readonly FinderGoPlace[];
  goToFolder: FinderCommand;
  /** The folders visited, newest first. */
  recentFolders: readonly { path: string; name: string; go: () => void }[];
  /** The Smart Folders kept, each of which runs from Go's menu whether or not the sidebar has it. */
  savedSearches: readonly { id: string; name: string; run: () => void }[];
  clearRecentFolders: () => void;
  selectStartupDisk: FinderCommand;
  /** Why Option's Library row is dimmed, when this tree has no such folder. */
  library: { reason?: string; run: () => void };
  showHidden: FinderCommand;
  /** Show Inspector, or Hide Inspector while it shows. */
  inspector: FinderCommand;
  inspectorShown: boolean;
  /** Info about several items together. */
  summaryInfo: FinderCommand;
  closeTab: FinderCommand;
  nextTab: FinderCommand;
  previousTab: FinderCommand;
  moveTabToWindow: FinderCommand;
  mergeAllWindows: FinderCommand;
  showAllTabs: FinderCommand;
  allTabsShown: boolean;
  connect: FinderCommand;
  emptyTrash: FinderCommand;
  /** Empties the Trash without asking. */
  emptyTrashNow: FinderCommand;
}

const UNDO_REASON = "Only the drive’s changes can be undone.";
const CUT_REASON = "Finder cuts only text. Copy an item, then Move Item Here.";
export const EJECT_REASON = "The drive has no disks to eject.";
export const CLEAN_REASON = "Icons here always keep to the grid.";
const UNSORTED_REASON = "Icons here always keep an order: they cannot be left where they are put.";
const ADDED_REASON = "The drive does not keep when an item arrived in its folder.";
const BURN_REASON = "A browser cannot write to a disc.";
const PROGRESS_REASON = "A copy or an upload shows its progress in the window while it runs.";

/** Go's Library row: there only while Option is held, as on a Mac. */
function GoLibraryRow({ library }: { library: FinderMenuCommands["library"] }) {
  const option = useOptionKey();
  if (!option) return null;
  return (
    <MenuItem
      disabled={library.reason !== undefined}
      title={library.reason}
      data-reason={library.reason}
      onClick={library.run}
    >
      Library
    </MenuItem>
  );
}

/** The Window menu's rows that are Finder's own. */
export function finderWindowRows(c: FinderMenuCommands) {
  return (
    <>
      <MenuItem disabled title={PROGRESS_REASON} data-reason={PROGRESS_REASON}>
        Show Progress Window
      </MenuItem>
      <MenuSeparator />
      <Row command={c.previousTab} keyEquivalent="shift+command+[">
        Show Previous Tab
      </Row>
      <Row command={c.nextTab} keyEquivalent="shift+command+]">
        Show Next Tab
      </Row>
      <Row command={c.moveTabToWindow}>Move Tab to New Window</Row>
      <Row command={c.mergeAllWindows}>Merge All Windows</Row>
    </>
  );
}

export function Row({
  command,
  keyEquivalent,
  children,
}: {
  command: FinderCommand;
  keyEquivalent?: string;
  children: string;
}) {
  return (
    <MenuItem keyEquivalent={keyEquivalent} disabled={!command.enabled} onClick={command.run}>
      {children}
    </MenuItem>
  );
}

/** File's rows, above the desktop's New Finder Window and Close Window. */
export function finderFileRows(c: FinderMenuCommands) {
  return (
    <>
      <Row command={c.newFolder} keyEquivalent="shift+command+n">
        New Folder
      </Row>
      <Row command={c.newFolderWithSelection} keyEquivalent="control+command+n">
        New Folder with Selection
      </Row>
      <Row command={c.newSmartFolder} keyEquivalent="option+command+n">
        New Smart Folder
      </Row>
      {c.drive ? <Row command={c.upload}>Upload Files…</Row> : null}
      <Row command={c.newTab}>New Tab</Row>
      <MenuSeparator />
      <Row command={c.open} keyEquivalent="command+o">
        Open
      </Row>
      <Submenu>
        <SubmenuTrigger disabled={c.openWith.length === 0}>Open With</SubmenuTrigger>
        <SubmenuPopup>
          {c.openWith.map(({ id, name, open }, index) => (
            <MenuItem key={id} onClick={open}>
              {index === 0 ? `${name} (default)` : name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger>Always Open With</SubmenuTrigger>
            <SubmenuPopup>
              {c.openWith.map(({ id, name, always }) => (
                <MenuItem key={id} onClick={always}>
                  {name}
                </MenuItem>
              ))}
            </SubmenuPopup>
          </Submenu>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <Row command={c.getInfo} keyEquivalent="command+i">
        Get Info
      </Row>
      <Row command={c.summaryInfo} keyEquivalent="control+command+i">
        Show Summary Info
      </Row>
      <Row command={c.inspector} keyEquivalent="option+command+i">
        {c.inspectorShown ? "Hide Inspector" : "Show Inspector"}
      </Row>
      <Row command={c.quickLook} keyEquivalent="command+y">
        {c.quickLookTitle}
      </Row>
      {c.drive ? (
        <Row command={c.slideshow} keyEquivalent="option+command+y">
          {c.slideshowTitle}
        </Row>
      ) : null}
      {c.drive ? (
        <>
          <Row command={c.duplicate} keyEquivalent="command+d">
            Duplicate
          </Row>
          <Row command={c.makeAlias} keyEquivalent="control+command+a">
            Make Alias
          </Row>
          <Row command={c.showOriginal} keyEquivalent="command+r">
            Show Original
          </Row>
          <Row command={c.addToSidebar} keyEquivalent="control+command+t">
            Add to Sidebar
          </Row>
          <Row command={c.addToDock} keyEquivalent="control+shift+command+t">
            Add to Dock
          </Row>
          <Row command={c.compress}>{c.compressTitle}</Row>
          <Row command={c.print} keyEquivalent="command+p">
            Print
          </Row>
          <Row command={c.rename}>{c.renameTitle}</Row>
          <Row command={c.download}>Download</Row>
          <MenuSeparator />
          {c.putBack.enabled ? (
            <Row command={c.putBack} keyEquivalent="command+delete">
              Put Back
            </Row>
          ) : (
            <Row command={c.trash} keyEquivalent="command+delete">
              Move to Trash
            </Row>
          )}
          <MenuItem
            keyEquivalent="command+e"
            disabled
            title={EJECT_REASON}
            data-reason={EJECT_REASON}
          >
            Eject
          </MenuItem>
          <MenuItem disabled title={BURN_REASON} data-reason={BURN_REASON}>
            Burn to Disc…
          </MenuItem>
        </>
      ) : null}
      <MenuSeparator />
      <Row command={c.find} keyEquivalent="command+f">
        Find
      </Row>
      {c.drive ? (
        <>
          <MenuSeparator />
          <Row command={c.getInfo}>Tags…</Row>
          {c.tagRows}
        </>
      ) : null}
      {c.closeTab.enabled ? (
        <>
          <MenuSeparator />
          <Row command={c.closeTab} keyEquivalent="command+w">
            Close Tab
          </Row>
        </>
      ) : null}
    </>
  );
}

/** Edit's rows. */
export function finderEditRows(c: FinderMenuCommands) {
  return (
    <>
      {c.drive ? (
        <>
          <Row command={c.undo} keyEquivalent="command+z">
            {c.undoTitle}
          </Row>
          <Row command={c.redo} keyEquivalent="shift+command+z">
            {c.redoTitle}
          </Row>
        </>
      ) : (
        <>
          <MenuItem
            keyEquivalent="command+z"
            disabled
            title={UNDO_REASON}
            data-reason={UNDO_REASON}
          >
            Undo
          </MenuItem>
          <MenuItem
            keyEquivalent="shift+command+z"
            disabled
            title={UNDO_REASON}
            data-reason={UNDO_REASON}
          >
            Redo
          </MenuItem>
        </>
      )}
      <MenuSeparator />
      <MenuItem keyEquivalent="command+x" disabled title={CUT_REASON} data-reason={CUT_REASON}>
        Cut
      </MenuItem>
      <Row command={c.copy} keyEquivalent="command+c">
        {c.copyTitle}
      </Row>
      <Row command={c.paste} keyEquivalent="command+v">
        {c.pasteTitle}
      </Row>
      {c.drive ? (
        <Row command={c.moveHere} keyEquivalent="option+command+v">
          {c.moveHereTitle}
        </Row>
      ) : null}
      <Row command={c.selectAll} keyEquivalent="command+a">
        Select All
      </Row>
      <Row command={c.deselectAll} keyEquivalent="option+command+a">
        Deselect All
      </Row>
      {c.drive ? (
        <>
          <MenuSeparator />
          <Row command={c.showClipboard}>
            {c.clipboardShown ? "Hide Clipboard" : "Show Clipboard"}
          </Row>
        </>
      ) : null}
    </>
  );
}

/** View's rows, above the desktop's Enter Full Screen. */
export function finderViewRows(c: FinderMenuCommands) {
  return (
    <>
      <MenuRadioGroup value={c.view} onValueChange={(view) => c.setView(view as FinderView)}>
        {c.views.map(({ view, label }, index) => (
          <MenuRadioItem key={view} value={view} keyEquivalent={`command+${index + 1}`}>
            as {label}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuCheckboxItem
        keyEquivalent="control+command+0"
        checked={c.group !== "none"}
        disabled={!c.toggleGroups.enabled}
        onCheckedChange={c.toggleGroups.run}
      >
        Use Groups
      </MenuCheckboxItem>
      {c.group !== "none" ? (
        <Submenu>
          <SubmenuTrigger disabled={!c.toggleGroups.enabled}>Group By</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup value={c.group} onValueChange={(column) => c.setGroup(String(column))}>
              {c.groups.map(({ column, label }) => (
                <MenuRadioItem key={column} value={column}>
                  {label}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
      ) : null}
      <Submenu>
        <SubmenuTrigger>Sort By</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup value={c.sort} onValueChange={(column) => c.setSort(String(column))}>
            {c.sorts.map(({ column, label }) => (
              <MenuRadioItem key={column} value={column}>
                {label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuItem disabled title={ADDED_REASON} data-reason={ADDED_REASON}>
            Date Added
          </MenuItem>
          <MenuSeparator />
          <MenuItem disabled title={UNSORTED_REASON} data-reason={UNSORTED_REASON}>
            None
          </MenuItem>
          <MenuItem disabled title={CLEAN_REASON} data-reason={CLEAN_REASON}>
            Snap to Grid
          </MenuItem>
        </SubmenuPopup>
      </Submenu>
      <MenuItem disabled title={CLEAN_REASON} data-reason={CLEAN_REASON}>
        Clean Up
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={!c.iconsShown}>Clean Up By</SubmenuTrigger>
        <SubmenuPopup>
          {c.sorts.map(({ column, label }) => (
            <MenuItem key={column} onClick={() => c.setSort(column)}>
              {label}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuCheckboxItem
        keyEquivalent="option+command+s"
        checked={c.sidebarShown}
        onCheckedChange={c.toggleSidebar.run}
      >
        Sidebar
      </MenuCheckboxItem>
      <MenuCheckboxItem
        keyEquivalent="shift+command+p"
        checked={c.previewShown}
        disabled={!c.togglePreview.enabled}
        onCheckedChange={c.togglePreview.run}
      >
        Preview
      </MenuCheckboxItem>
      <MenuCheckboxItem
        keyEquivalent="shift+command+t"
        checked={c.tabBarShown}
        disabled={!c.toggleTabBar.enabled}
        onCheckedChange={c.toggleTabBar.run}
      >
        Tab Bar
      </MenuCheckboxItem>
      <Row command={c.showAllTabs} keyEquivalent="shift+command+\">
        {c.allTabsShown ? "Exit Tab Overview" : "Show All Tabs"}
      </Row>
      <MenuCheckboxItem
        keyEquivalent="option+command+p"
        checked={c.pathBarShown}
        onCheckedChange={c.togglePathBar.run}
      >
        Path Bar
      </MenuCheckboxItem>
      <MenuCheckboxItem
        keyEquivalent="command+/"
        checked={c.statusBarShown}
        onCheckedChange={c.toggleStatusBar.run}
      >
        Status Bar
      </MenuCheckboxItem>
      <MenuCheckboxItem
        keyEquivalent="option+command+t"
        checked={c.toolbarShown}
        onCheckedChange={c.toggleToolbar.run}
      >
        Toolbar
      </MenuCheckboxItem>
      <Row command={c.customizeToolbar}>Customize Toolbar…</Row>
      <MenuSeparator />
      <Row command={c.viewOptions} keyEquivalent="command+j">
        {c.viewOptionsShown ? "Hide View Options" : "Show View Options"}
      </Row>
    </>
  );
}

/** Go's rows, above the desktop's Applications. */
export function finderGoRows(c: FinderMenuCommands) {
  return (
    <>
      <Row command={c.back} keyEquivalent="command+[">
        Back
      </Row>
      <Row command={c.forward} keyEquivalent="command+]">
        Forward
      </Row>
      <Row command={c.enclosing} keyEquivalent="command+up">
        Enclosing Folder
      </Row>
      <Row command={c.selectStartupDisk} keyEquivalent="shift+command+up">
        Select Startup Disk
      </Row>
      <GoLibraryRow library={c.library} />
      <MenuSeparator />
      {c.places.map(({ label, keyEquivalent, reason, run }) => (
        <MenuItem
          key={label}
          keyEquivalent={keyEquivalent}
          disabled={reason !== undefined}
          title={reason}
          data-reason={reason}
          onClick={run}
        >
          {label}
        </MenuItem>
      ))}
      <MenuSeparator />
      <Row command={c.goToFolder} keyEquivalent="shift+command+g">
        Go to Folder…
      </Row>
      <Submenu>
        <SubmenuTrigger disabled={c.recentFolders.length === 0}>Recent Folders</SubmenuTrigger>
        <SubmenuPopup>
          {c.recentFolders.map(({ path, name, go }) => (
            <MenuItem key={path} onClick={go}>
              {name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onClick={c.clearRecentFolders}>Clear Menu</MenuItem>
        </SubmenuPopup>
      </Submenu>
      <Submenu>
        <SubmenuTrigger disabled={c.savedSearches.length === 0}>Saved Searches</SubmenuTrigger>
        <SubmenuPopup>
          {c.savedSearches.map(({ id, name, run }) => (
            <MenuItem key={id} onClick={run}>
              {name}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <Row command={c.connect} keyEquivalent="command+k">
        Connect to Server…
      </Row>
    </>
  );
}

/** Help's rows, each opening the Help Viewer pages written for this desktop. */
export function finderHelpRows() {
  return (
    <>
      <MenuItem onClick={() => requestHelp("Finder")}>Finder Help</MenuItem>
      <MenuItem onClick={() => requestHelp("macOS")}>macOS Help</MenuItem>
      <MenuItem onClick={() => requestHelp("What’s New")}>See What’s New in macOS</MenuItem>
      <MenuItem onClick={() => requestHelp("Tips")}>Tips for Your Mac</MenuItem>
    </>
  );
}

/** Finder menu's own row: with Option held, it empties the Trash without asking. */
function EmptyTrashRow({ c }: { c: FinderMenuCommands }) {
  const option = useOptionKey();
  return option ? (
    <Row command={c.emptyTrashNow} keyEquivalent="option+shift+command+delete">
      Empty Trash
    </Row>
  ) : (
    <Row command={c.emptyTrash} keyEquivalent="shift+command+delete">
      Empty Trash…
    </Row>
  );
}

export function finderAppRows(c: FinderMenuCommands) {
  return <EmptyTrashRow c={c} />;
}

/**
 * The keys of the rows above that the window does not already answer. A key is the command's even
 * while its row is dimmed, as in a Mac's menu bar.
 */
export function finderMenuKeys(
  c: FinderMenuCommands,
): readonly (readonly [string, FinderCommand])[] {
  return [
    ["option+shift+command+delete", c.emptyTrashNow],
    ["shift+command+n", c.newFolder],
    ["control+command+n", c.newFolderWithSelection],
    ["option+command+n", c.newSmartFolder],
    ["command+o", c.open],
    ["command+a", c.selectAll],
    ["option+command+a", c.deselectAll],
    ["control+command+a", c.makeAlias],
    ["command+r", c.showOriginal],
    ["control+command+t", c.addToSidebar],
    ["control+shift+command+t", c.addToDock],
    ["command+p", c.print],
    ["command+z", c.undo],
    ["shift+command+z", c.redo],
    ["option+command+s", c.toggleSidebar],
    ["option+command+p", c.togglePathBar],
    ["command+/", c.toggleStatusBar],
    ["option+command+t", c.toggleToolbar],
    ["shift+command+t", c.toggleTabBar],
    ["shift+command+p", c.togglePreview],
    ["command+j", c.viewOptions],
    ["option+command+y", c.slideshow],
    ["command+y", c.quickLook],
    ["control+command+0", c.toggleGroups],
    ["shift+command+up", c.selectStartupDisk],
    ["shift+command+.", c.showHidden],
    ["option+command+i", c.inspector],
    ["control+command+i", c.summaryInfo],
    ["shift+command+[", c.previousTab],
    ["shift+command+]", c.nextTab],
    ["shift+command+\\", c.showAllTabs],
    ...(c.closeTab.enabled ? [["command+w", c.closeTab] as const] : []),
    ...c.places.map(
      ({ keyEquivalent, reason, run }) =>
        [keyEquivalent, { enabled: reason === undefined, run }] as const,
    ),
  ];
}
