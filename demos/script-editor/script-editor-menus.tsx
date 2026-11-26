"use client";

import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import type { DesktopDragItem } from "../desktop/desktop-drag";
import { requestHelp } from "../desktop/desktop-help";
import { FileShareItems } from "../desktop/desktop-share-link";
import { type DocumentTabs, DocumentTabViewItems } from "../textedit/textedit-tabs";
import type { RecentScript } from "./script-editor-draft";

/*
 * Script Editor's File, Script and View menus for the desktop's menu bar, and their key
 * equivalents. File > New is the desktop's own row (the descriptor's `newWindowTitle`), since each
 * script has a window of its own.
 */

export type ScriptEditorCommand =
  | "open"
  | "dictionary"
  | "save"
  | "duplicate"
  | "rename"
  | "move"
  | "revert"
  | "previous-save"
  | "browse-versions"
  | "export"
  | "print"
  | "record"
  | "stop"
  | "run"
  | "compile"
  | "bundle"
  | "accessory"
  | "customize-toolbar"
  | "description"
  | "result"
  | "log"
  | "library"
  | "history"
  | "complete";

const KEY_EQUIVALENTS: Readonly<Partial<Record<ScriptEditorCommand, string>>> = {
  open: "command+o",
  dictionary: "shift+command+o",
  save: "command+s",
  duplicate: "shift+command+s",
  print: "command+p",
  record: "shift+command+r",
  stop: "command+.",
  run: "command+r",
  compile: "command+k",
  bundle: "command+0",
  accessory: "option+command+0",
  description: "command+1",
  result: "command+2",
  log: "command+3",
  library: "shift+command+l",
  history: "option+command+l",
  complete: "option+escape",
};

/** The command whose key equivalent `event` is. */
export function commandOfKey(event: KeyboardEvent): ScriptEditorCommand | undefined {
  for (const [command, key] of Object.entries(KEY_EQUIVALENTS)) {
    if (matchesMenuKeyEquivalent(event, key)) return command as ScriptEditorCommand;
  }
  return undefined;
}

/** The commands of the File menu: only a window with a server has them. */
export const FILE_COMMANDS: ReadonlySet<ScriptEditorCommand> = new Set([
  "open",
  "dictionary",
  "save",
  "duplicate",
  "rename",
  "move",
  "revert",
  "previous-save",
  "browse-versions",
  "export",
  "library",
  "history",
]);

/** Why File > Revert To > Previous Save is dimmed. */
export const NO_PREVIOUS_SAVE = "No earlier save of this script is kept.";
/** Why File > Page Setup is dimmed. */
export const NO_PAGE_SETUP = "The browser’s print dialog sets the page.";
/** Why Export's Application format is dimmed. */
export const NO_APPLICATION =
  "An application made here could not run: a script runs only inside Script Editor on this desktop.";
/** Why Export's Run Only is dimmed. */
export const NO_RUN_ONLY =
  "A script here is kept as its text, with no compiled form to leave its source out of.";

/** Why Stop is dimmed during a run. */
export const NO_STOP_REASON = "A run on the server can’t be stopped: it ends within 5 seconds";

interface CommandItemsProps {
  enabled: Readonly<Record<ScriptEditorCommand, boolean>>;
  onCommand: (command: ScriptEditorCommand) => void;
}

function CommandItem({
  command,
  enabled,
  onCommand,
  children,
}: CommandItemsProps & { command: ScriptEditorCommand; children: string }) {
  return (
    <MenuItem
      disabled={!enabled[command]}
      keyEquivalent={KEY_EQUIVALENTS[command]}
      onClick={() => onCommand(command)}
    >
      {children}
    </MenuItem>
  );
}

export function ScriptEditorFileItems({
  recents,
  onOpenRecent,
  onClearRecents,
  saved,
  templates,
  canUseTemplate,
  onTemplate,
  shareItems,
  previousSave,
  ...commands
}: CommandItemsProps & {
  /** When the version File > Revert To > Previous Save goes back to was written, as shown. */
  previousSave?: string | undefined;
  recents: readonly RecentScript[];
  onOpenRecent: (script: RecentScript) => void;
  onClearRecents: () => void;
  /** Whether the script has a file: Save then writes into it without asking. */
  saved: boolean;
  templates: readonly { name: string }[];
  /** Whether the window can take a template: not over unsaved changes. */
  canUseTemplate: boolean;
  onTemplate: (name: string) => void;
  /** The script as a file, for the Share menu: the text in the window, saved or not. */
  shareItems: readonly DesktopDragItem[];
}) {
  return (
    <>
      <Submenu disabled={!canUseTemplate}>
        <SubmenuTrigger>New from Template</SubmenuTrigger>
        <SubmenuPopup aria-label="New from Template">
          {templates.map((template) => (
            <MenuItem key={template.name} onClick={() => onTemplate(template.name)}>
              {template.name}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <CommandItem command="open" {...commands}>
        Open…
      </CommandItem>
      <Submenu disabled={!commands.enabled.open || recents.length === 0}>
        <SubmenuTrigger>Open Recent</SubmenuTrigger>
        <SubmenuPopup aria-label="Open Recent">
          {recents.map((script) => (
            <MenuItem key={script.id} onClick={() => onOpenRecent(script)}>
              {script.name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onClick={onClearRecents}>Clear Menu</MenuItem>
        </SubmenuPopup>
      </Submenu>
      <CommandItem command="dictionary" {...commands}>
        Open Dictionary…
      </CommandItem>
      <MenuSeparator />
      <CommandItem command="save" {...commands}>
        {saved ? "Save" : "Save…"}
      </CommandItem>
      <CommandItem command="duplicate" {...commands}>
        Duplicate
      </CommandItem>
      <CommandItem command="rename" {...commands}>
        Rename…
      </CommandItem>
      <CommandItem command="move" {...commands}>
        Move To…
      </CommandItem>
      <Submenu disabled={!commands.enabled.revert && !commands.enabled["browse-versions"]}>
        <SubmenuTrigger>Revert To</SubmenuTrigger>
        <SubmenuPopup aria-label="Revert To">
          <CommandItem command="revert" {...commands}>
            Last Saved
          </CommandItem>
          <MenuItem
            disabled={!commands.enabled["previous-save"]}
            title={previousSave ?? NO_PREVIOUS_SAVE}
            data-reason={previousSave ? undefined : NO_PREVIOUS_SAVE}
            onClick={() => commands.onCommand("previous-save")}
          >
            Previous Save
          </MenuItem>
          <CommandItem command="browse-versions" {...commands}>
            Browse All Versions…
          </CommandItem>
        </SubmenuPopup>
      </Submenu>
      <CommandItem command="export" {...commands}>
        Export…
      </CommandItem>
      <Submenu>
        <SubmenuTrigger>Share</SubmenuTrigger>
        <SubmenuPopup aria-label="Share">
          <FileShareItems items={shareItems} from="script-editor" />
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="shift+command+p"
        disabled
        title={NO_PAGE_SETUP}
        data-reason={NO_PAGE_SETUP}
      >
        Page Setup…
      </MenuItem>
      <CommandItem command="print" {...commands}>
        Print…
      </CommandItem>
    </>
  );
}

/** The Help menu's rows: each opens Help Viewer on a search. */
export function ScriptEditorHelpItems() {
  return (
    <>
      <MenuItem onClick={() => requestHelp("Script Editor")}>Script Editor Help</MenuItem>
      <MenuItem onClick={() => requestHelp("AppleScript")}>AppleScript Help</MenuItem>
    </>
  );
}

/** The Window menu's rows of Script Editor's own. */
export function ScriptEditorWindowItems(commands: CommandItemsProps) {
  return (
    <>
      <CommandItem command="library" {...commands}>
        Library
      </CommandItem>
      <CommandItem command="history" {...commands}>
        Log History
      </CommandItem>
      <MenuSeparator />
    </>
  );
}

/** Edit's rows of Script Editor's own, after Select All. */
export function ScriptEditorEditExtras({
  canPasteReply,
  onPasteReply,
  canComplete,
  onComplete,
}: {
  canPasteReply: boolean;
  onPasteReply: () => void;
  canComplete: boolean;
  onComplete: () => void;
}) {
  return (
    <>
      <MenuSeparator />
      <MenuItem disabled={!canPasteReply} onClick={onPasteReply}>
        Paste Reply
      </MenuItem>
      <MenuItem
        disabled={!canComplete}
        keyEquivalent={KEY_EQUIVALENTS.complete}
        onClick={onComplete}
      >
        Complete
      </MenuItem>
    </>
  );
}

export function ScriptEditorScriptItems({
  running,
  ...commands
}: CommandItemsProps & { running: boolean }) {
  return (
    <>
      <CommandItem command="record" {...commands}>
        Record
      </CommandItem>
      <CommandItem command="stop" {...commands}>
        Stop
      </CommandItem>
      {running ? <MenuItem disabled>{NO_STOP_REASON}</MenuItem> : null}
      <CommandItem command="run" {...commands}>
        Run
      </CommandItem>
      <CommandItem command="compile" {...commands}>
        Compile
      </CommandItem>
    </>
  );
}

export function ScriptEditorViewItems({
  bundle,
  accessory,
  view,
  tabs,
  ...commands
}: CommandItemsProps & {
  bundle: boolean;
  accessory: boolean;
  view: string;
  tabs?: DocumentTabs;
}) {
  return (
    <>
      <CommandItem command="bundle" {...commands}>
        {bundle ? "Hide Bundle Contents" : "Show Bundle Contents"}
      </CommandItem>
      <CommandItem command="accessory" {...commands}>
        {accessory ? "Hide Accessory View" : "Show Accessory View"}
      </CommandItem>
      <MenuSeparator />
      <MenuRadioGroup
        value={accessory ? view : ""}
        onValueChange={(next) => commands.onCommand(next as ScriptEditorCommand)}
      >
        <MenuRadioItem value="description" keyEquivalent={KEY_EQUIVALENTS.description}>
          Description
        </MenuRadioItem>
        <MenuRadioItem value="result" keyEquivalent={KEY_EQUIVALENTS.result}>
          Result
        </MenuRadioItem>
        <MenuRadioItem value="log" keyEquivalent={KEY_EQUIVALENTS.log}>
          Log
        </MenuRadioItem>
      </MenuRadioGroup>
      <MenuSeparator />
      <CommandItem command="customize-toolbar" {...commands}>
        Customize Toolbar…
      </CommandItem>
      {tabs ? <DocumentTabViewItems tabs={tabs} /> : null}
    </>
  );
}
