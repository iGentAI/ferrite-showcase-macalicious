"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { TextField } from "macalicious/text-field";
import { useId, useState } from "react";
import { AIRDROP_REASON } from "../desktop/desktop-share-link";
import { offersSpeechRecognition } from "../desktop/desktop-speech";
import { whenMenusClosed } from "../notes/notes-menus";
import type { Workflow, WorkflowKind } from "./automator-server";

/*
 * The served Automator's rows in the desktop's menu bar. Edit's rows act on the selected steps, and
 * on the text instead while a text field has the keyboard, as its keys do.
 */

/** Why Stop is dimmed, Record, and the rows below. */
export const SERVER_RUNS =
  "The server runs a workflow as a whole, within its time limit, so Run cannot be stopped part-way. Stop ends a run started with Step, between its actions.";
export const NO_RECORD =
  "A web page cannot see what you do in other applications, which is what recording watches.";
const NO_IMPORT =
  "The library is the desktop's own actions: a web page cannot load an action bundle into it.";

export type EditCommand = "undo" | "redo" | "cut" | "copy" | "paste" | "delete";

/** What decides the rows: they are built again only when one of these changes. */
export interface AutomatorMenuState {
  busy: boolean;
  hasSaved: boolean;
  canRevert: boolean;
  /** Whether the workflow in the window was saved, so that it has versions to browse. */
  canBrowseVersions: boolean;
  inText: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  steps: number;
  chosen: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  anyEnabled: boolean;
  anyCollapsed: boolean;
  anyExpanded: boolean;
  /** The Action menu's three parts of the selected steps. */
  ignoringInput: boolean;
  canIgnoreInput: boolean;
  resultsOpen: boolean;
  optionsOpen: boolean;
  libraryShown: boolean;
  logShown: boolean;
  toolbarShown: boolean;
  canRun: boolean;
  canStep: boolean;
  canStop: boolean;
  /** The saved workflows opened last, newest first. */
  recents: readonly { id: string; name: string }[];
  hasSteps: boolean;
}

/** What the rows do, read when one is chosen. */
export interface AutomatorCommands {
  newWorkflow: () => void;
  chooseType: () => void;
  convertType: () => void;
  open: () => void;
  save: () => void;
  duplicate: () => void;
  rename: () => void;
  revert: () => void;
  browseVersions: () => void;
  edit: (command: EditCommand) => void;
  selectAll: () => void;
  searchLibrary: () => void;
  toggleLibrary: () => void;
  toggleLog: () => void;
  toggleVariables: () => void;
  toggleToolbar: () => void;
  run: () => void;
  step: () => void;
  stop: () => void;
  renameStep: () => void;
  customizeToolbar: () => void;
  showMedia: () => void;
  exportFile: () => void;
  moveTo: () => void;
  toggleEnabled: () => void;
  removeChosen: () => void;
  collapse: (collapsed: boolean) => void;
  ignoreInput: (ignore: boolean) => void;
  showResults: (shown: boolean) => void;
  showOptions: (shown: boolean) => void;
  move: (by: -1 | 1) => void;
  openRecent: (id: string) => void;
  clearRecents: () => void;
  print: () => void;
  /** File > Share > Mail: the workflow as a file, in a New Message. */
  shareMail: () => void;
  speak: () => void;
}

const Reason = ({ children }: { children: string }) => (
  <MenuItem disabled className="mac-desktop-shell-menu-reason">
    {children}
  </MenuItem>
);

/** A row a web page cannot carry out, with its reason in the row under it and as its description. */
function DimmedRow({
  children,
  reason,
  keyEquivalent,
}: {
  children: string;
  reason: string;
  keyEquivalent?: string;
}) {
  const id = useId();
  return (
    <>
      <MenuItem disabled keyEquivalent={keyEquivalent} title={reason} aria-describedby={id}>
        {children}
      </MenuItem>
      <MenuItem disabled id={id} className="mac-desktop-shell-menu-reason">
        {reason}
      </MenuItem>
    </>
  );
}

/** The rows of each of Automator's menus. */
export function automatorMenuRows(state: AutomatorMenuState, now: () => AutomatorCommands) {
  const { chosen, inText } = state;
  return {
    file: (
      <>
        <MenuItem
          keyEquivalent="command+n"
          disabled={state.busy}
          onClick={() => now().chooseType()}
        >
          New
        </MenuItem>
        <MenuItem
          keyEquivalent="command+o"
          disabled={state.busy || !state.hasSaved}
          onClick={() => now().open()}
        >
          Open…
        </MenuItem>
        <Submenu>
          <SubmenuTrigger disabled={state.busy || state.recents.length === 0}>
            Open Recent
          </SubmenuTrigger>
          <SubmenuPopup>
            {state.recents.map((recent) => (
              <MenuItem key={recent.id} onClick={() => now().openRecent(recent.id)}>
                {recent.name}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem onClick={() => now().clearRecents()}>Clear Menu</MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+s" disabled={state.busy} onClick={() => now().save()}>
          Save
        </MenuItem>
        <MenuItem
          keyEquivalent="shift+command+s"
          disabled={state.busy}
          onClick={() => now().duplicate()}
        >
          Duplicate
        </MenuItem>
        <MenuItem onClick={() => now().rename()}>Rename…</MenuItem>
        <MenuItem disabled={state.busy} onClick={() => now().moveTo()}>
          Move To…
        </MenuItem>
        <Submenu>
          <SubmenuTrigger disabled={!state.canRevert && !state.canBrowseVersions}>
            Revert To
          </SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem disabled={!state.canRevert} onClick={() => now().revert()}>
              Last Saved
            </MenuItem>
            <MenuItem disabled={!state.canBrowseVersions} onClick={() => now().browseVersions()}>
              Browse All Versions…
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuItem disabled={state.busy} onClick={() => now().convertType()}>
          Convert To…
        </MenuItem>
        <MenuItem disabled={!state.hasSteps} onClick={() => now().exportFile()}>
          Export…
        </MenuItem>
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Share</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem disabled={!state.hasSteps} onClick={() => now().shareMail()}>
              Mail
            </MenuItem>
            <DimmedRow reason={AIRDROP_REASON}>AirDrop</DimmedRow>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+p"
          disabled={!state.hasSteps}
          onClick={() => now().print()}
        >
          Print…
        </MenuItem>
      </>
    ),
    edit: (
      <>
        <MenuItem
          keyEquivalent="command+z"
          disabled={!inText && !state.canUndo}
          onClick={() => now().edit("undo")}
        >
          Undo
        </MenuItem>
        <MenuItem
          keyEquivalent="shift+command+z"
          disabled={!inText && !state.canRedo}
          onClick={() => now().edit("redo")}
        >
          Redo
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+x"
          disabled={!inText && chosen === 0}
          onClick={() => now().edit("cut")}
        >
          Cut
        </MenuItem>
        <MenuItem
          keyEquivalent="command+c"
          disabled={!inText && chosen === 0}
          onClick={() => now().edit("copy")}
        >
          Copy
        </MenuItem>
        <MenuItem
          keyEquivalent="command+v"
          disabled={!inText && !state.canPaste}
          onClick={() => now().edit("paste")}
        >
          Paste
        </MenuItem>
        <MenuItem
          keyEquivalent="delete"
          disabled={!inText && chosen === 0}
          onClick={() => now().edit("delete")}
        >
          Delete
        </MenuItem>
        <MenuItem
          keyEquivalent="command+a"
          disabled={!inText && state.steps === 0}
          onClick={() => now().selectAll()}
        >
          Select All
        </MenuItem>
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Find</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem keyEquivalent="option+command+f" onClick={() => now().searchLibrary()}>
              Search Library
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
        <Submenu>
          <SubmenuTrigger>Speech</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem
              disabled={typeof speechSynthesis === "undefined"}
              onClick={() => now().speak()}
            >
              Start Speaking
            </MenuItem>
            <MenuItem
              disabled={typeof speechSynthesis === "undefined"}
              onClick={() => speechSynthesis.cancel()}
            >
              Stop Speaking
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
      </>
    ),
    view: (
      <>
        <MenuItem keyEquivalent="option+command+l" onClick={() => now().toggleLibrary()}>
          {state.libraryShown ? "Hide Library" : "Show Library"}
        </MenuItem>
        <MenuItem keyEquivalent="option+command+g" onClick={() => now().toggleLog()}>
          {state.logShown ? "Hide Log" : "Show Log"}
        </MenuItem>
        <MenuItem keyEquivalent="option+command+v" onClick={() => now().toggleVariables()}>
          Variables
        </MenuItem>
        <MenuItem onClick={() => now().showMedia()}>Media Browser</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => now().toggleToolbar()}>
          {state.toolbarShown ? "Hide Toolbar" : "Show Toolbar"}
        </MenuItem>
        <MenuItem onClick={() => now().customizeToolbar()}>Customize Toolbar…</MenuItem>
      </>
    ),
    workflow: (
      <>
        <MenuItem keyEquivalent="command+r" disabled={!state.canRun} onClick={() => now().run()}>
          Run
        </MenuItem>
        <MenuItem
          keyEquivalent="option+command+r"
          disabled={!state.canStep}
          onClick={() => now().step()}
        >
          Step
        </MenuItem>
        <MenuItem
          keyEquivalent="command+."
          disabled={!state.canStop}
          title={state.canStop ? undefined : SERVER_RUNS}
          onClick={() => now().stop()}
        >
          Stop
        </MenuItem>
        {state.canStop ? null : <Reason>{SERVER_RUNS}</Reason>}
        <DimmedRow keyEquivalent="shift+command+r" reason={NO_RECORD}>
          Record
        </DimmedRow>
        <MenuSeparator />
        <DimmedRow reason={NO_IMPORT}>Import Actions…</DimmedRow>
      </>
    ),
    action: (
      <>
        <MenuItem disabled={chosen === 0} onClick={() => now().toggleEnabled()}>
          {state.anyEnabled || chosen === 0 ? "Disable" : "Enable"}
        </MenuItem>
        <MenuItem disabled={chosen !== 1} onClick={() => now().renameStep()}>
          Rename Action…
        </MenuItem>
        <MenuItem disabled={chosen === 0} onClick={() => now().removeChosen()}>
          Delete
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled={!state.anyExpanded} onClick={() => now().collapse(true)}>
          Collapse
        </MenuItem>
        <MenuItem disabled={!state.anyCollapsed} onClick={() => now().collapse(false)}>
          Expand
        </MenuItem>
        <MenuSeparator />
        <MenuCheckboxItem
          checked={state.ignoringInput}
          disabled={!state.canIgnoreInput}
          onCheckedChange={(ignore) => now().ignoreInput(ignore)}
        >
          Ignore Input
        </MenuCheckboxItem>
        <MenuCheckboxItem
          checked={state.resultsOpen}
          disabled={chosen === 0}
          onCheckedChange={(shown) => now().showResults(shown)}
        >
          Results
        </MenuCheckboxItem>
        <MenuCheckboxItem
          checked={state.optionsOpen}
          disabled={chosen === 0}
          onCheckedChange={(shown) => now().showOptions(shown)}
        >
          Options
        </MenuCheckboxItem>
        <MenuSeparator />
        <MenuItem disabled={!state.canMoveUp} onClick={() => now().move(-1)}>
          Move Up
        </MenuItem>
        <MenuItem disabled={!state.canMoveDown} onClick={() => now().move(1)}>
          Move Down
        </MenuItem>
        {chosen === 0 ? <Reason>Select a step in the workflow</Reason> : null}
      </>
    ),
  };
}

/** Whether `target` is a field a person types in, whose keys are its own. */
export const isTextField = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement &&
  target.matches(
    'textarea, [contenteditable="true"], input:not([type="checkbox"], [type="radio"], [type="button"])',
  );

/**
 * An Edit command on the text in `field`, as the browser's own: run in the click, so that it counts
 * as the person's, and the keyboard goes back to the field once the menu has closed. A browser may
 * refuse a menu the clipboard, and `onRefused` hears of it.
 */
export function editText(field: HTMLElement, command: EditCommand, onRefused: () => void) {
  const { ownerDocument: document } = field;
  const giveBack = () => field.focus({ preventScroll: true });
  giveBack();
  if (command === "paste") {
    navigator.clipboard
      .readText()
      .then((text) => {
        giveBack();
        document.execCommand("insertText", false, text);
      })
      .catch(onRefused);
  } else document.execCommand(command);
  whenMenusClosed(document, giveBack);
}

/** The sheet of File > Open…: the saved workflows, of which the person opens one. */
export function OpenWorkflowSheet({
  open,
  anchor,
  workflows,
  onOpen,
  onCancel,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  workflows: readonly Workflow[];
  onOpen: (id: string) => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState<string | null>(null);
  const known = workflows.some((workflow) => workflow.id === choice) ? choice : null;
  return (
    <Sheet open={open} onOpenChange={(next) => next || onCancel()}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>Open a saved workflow</SheetTitle>
        <SheetDescription>It replaces the workflow in the window.</SheetDescription>
        <TableView
          aria-label="Saved workflows"
          className="mac-automator-open-list"
          columns={OPEN_COLUMN}
          header="none"
          rowCount={workflows.length}
          rowHeight={19}
          size="mini"
          getRowId={(row) => workflows[row]?.id ?? row}
          getRowLabel={(row) => workflows[row]?.name ?? ""}
          value={known ? [known] : []}
          onValueChange={(value) => {
            const id = value[0];
            setChoice(typeof id === "string" ? id : null);
          }}
          onRowAction={(row) => {
            const id = workflows[row]?.id;
            if (id) onOpen(id);
          }}
          renderCell={(row) => workflows[row]?.name ?? null}
        />
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={!known} onClick={() => known && onOpen(known)}>
            Open
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

const OPEN_COLUMN: readonly TableViewColumn[] = [{ id: "name" }];

/** Automator's document types: those this desktop can save, then why each other is dimmed. */
export const documentTypes = (): readonly { name: string; reason?: string }[] => [
  { name: "Workflow" },
  { name: "Application" },
  { name: "Quick Action" },
  {
    name: "Print Plugin",
    reason:
      "It runs on the PDF of what is being printed, and the browser's print dialog neither lists a plug-in nor gives a page that PDF.",
  },
  { name: "Folder Action" },
  { name: "Calendar Alarm" },
  {
    name: "Image Capture Plugin",
    reason:
      "Image Capture runs it on pictures from a camera or a scanner. This desktop has no Image Capture, and a web page cannot reach a scanner or the pictures kept on a camera.",
  },
  {
    name: "Dictation Command",
    reason: offersSpeechRecognition()
      ? undefined
      : "Dictation needs a speech service, which this browser does not have.",
  },
];

/** The workflow's kind a document type's name stands for, and what the Type pop-up calls it. */
export const kindOfType = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

/** File > New's and Convert To's sheet: the document types, of which the person chooses one. */
export function NewDocumentSheet({
  open,
  anchor,
  current = "workflow",
  onChoose,
  onCancel,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  /** The type chosen as it opens. */
  current?: WorkflowKind;
  onChoose: (kind: WorkflowKind) => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const types = documentTypes();
  const chosen =
    typed ?? types.find(({ name }) => kindOfType(name) === current)?.name ?? "Workflow";
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setTyped(null);
        onCancel();
      }}
    >
      <SheetPopup anchor={anchor} width={480}>
        <SheetTitle>Choose a type for your document:</SheetTitle>
        <RadioGroup
          value={chosen}
          onValueChange={(name) => setTyped(String(name))}
          aria-label="Document type"
        >
          {types.map(({ name, reason }) => (
            <div key={name} className="mac-automator-type">
              <RadioButton value={name} disabled={reason !== undefined} title={reason}>
                {name}
              </RadioButton>
              {reason ? <SheetDescription>{reason}</SheetDescription> : null}
            </div>
          ))}
        </RadioGroup>
        <SheetActions>
          <SheetClose>Close</SheetClose>
          <DefaultButton
            onClick={() => {
              setTyped(null);
              onChoose(kindOfType(chosen) as WorkflowKind);
            }}
          >
            Choose
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** Action > Rename Action…: what the workflow calls the step; empty goes back to the action's name. */
export function RenameStepSheet({
  step,
  anchor,
  onRename,
  onCancel,
}: {
  step: { name: string; label: string } | null;
  anchor: HTMLElement | null;
  onRename: (label: string) => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState<string | null>(null);
  const label = typed ?? step?.label ?? "";
  const finish = (act: () => void) => {
    setTyped(null);
    act();
  };
  return (
    <Sheet open={step !== null} onOpenChange={(next) => next || finish(onCancel)}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>Rename the action “{step?.name}”</SheetTitle>
        <SheetDescription>Leave it empty to go back to the action's own name.</SheetDescription>
        <TextField
          aria-label="Action name"
          value={label}
          onValueChange={(next) => setTyped(next)}
          onKeyDown={(event) => {
            if (event.key === "Enter") finish(() => onRename(label.trim()));
          }}
        />
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton onClick={() => finish(() => onRename(label.trim()))}>Rename</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** The toolbar's items, in the order they start in. */
export const TOOLBAR_ITEMS = [
  "Library",
  "Media",
  "Flexible Space",
  "Record",
  "Step",
  "Stop",
  "Run",
] as const;

/** The kept order: what is not an item goes, and an item it does not name stands at the end. */
export function toolbarInOrder(kept: readonly string[]): readonly string[] {
  const known = [...new Set(kept)].filter((item) =>
    (TOOLBAR_ITEMS as readonly string[]).includes(item),
  );
  return [...known, ...TOOLBAR_ITEMS.filter((item) => !known.includes(item))];
}

/** The order with the item standing at the place given, within the row. */
export function withToolbarItemAt(order: readonly string[], item: string, to: number) {
  const rest = order.filter((each) => each !== item);
  const at = Math.max(0, Math.min(to, rest.length));
  return [...rest.slice(0, at), item, ...rest.slice(at)];
}

const TOOLBAR_ITEM_DRAG = "application/x-macalicious-automator-toolbar-item";

/** View > Customize Toolbar…: which of the toolbar's items show, and in what order. */
export function CustomizeToolbarSheet({
  open,
  anchor,
  hidden,
  order,
  onChange,
  onOrderChange,
  onDone,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  hidden: readonly string[];
  order: readonly string[];
  onChange: (hidden: readonly string[]) => void;
  onOrderChange: (order: readonly string[]) => void;
  onDone: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => next || onDone()}>
      <SheetPopup anchor={anchor} width={360}>
        <SheetTitle>Choose the items the toolbar shows</SheetTitle>
        {order.map((item, at) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: the buttons in the row do by key what a drag does.
          <div
            key={item}
            draggable
            className="mac-automator-toolbar-row"
            onDragStart={(event) => event.dataTransfer.setData(TOOLBAR_ITEM_DRAG, item)}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(TOOLBAR_ITEM_DRAG)) event.preventDefault();
            }}
            onDrop={(event) => {
              const dragged = event.dataTransfer.getData(TOOLBAR_ITEM_DRAG);
              if (!dragged) return;
              event.preventDefault();
              onOrderChange(withToolbarItemAt(order, dragged, at));
            }}
          >
            <Checkbox
              className="mac-automator-toolbar-choice"
              checked={!hidden.includes(item)}
              onCheckedChange={(shown) =>
                onChange(shown ? hidden.filter((each) => each !== item) : [...hidden, item])
              }
            >
              {item}
            </Checkbox>
            <PushButton
              size="mini"
              aria-label={`Move ${item} Earlier`}
              disabled={at === 0}
              onClick={() => onOrderChange(withToolbarItemAt(order, item, at - 1))}
            >
              ◀
            </PushButton>
            <PushButton
              size="mini"
              aria-label={`Move ${item} Later`}
              disabled={at === order.length - 1}
              onClick={() => onOrderChange(withToolbarItemAt(order, item, at + 1))}
            >
              ▶
            </PushButton>
          </div>
        ))}
        <SheetActions>
          <PushButton
            onClick={() => {
              onChange([]);
              onOrderChange([...TOOLBAR_ITEMS]);
            }}
          >
            Use Default Set
          </PushButton>
          <DefaultButton onClick={onDone}>Done</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
