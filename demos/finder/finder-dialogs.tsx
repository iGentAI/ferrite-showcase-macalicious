"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
  type AlertPopupProps,
} from "macalicious/alert";
import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { ComboBox, ComboBoxItem } from "macalicious/combo-box";
import { DefaultButton } from "macalicious/default-button";
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogPopup,
  type DialogPopupProps,
} from "macalicious/dialog";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { cn } from "macalicious/lib/cn";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import {
  NotificationAlert,
  NotificationAlertClose,
  type NotificationAlertProps,
} from "macalicious/notification-alert";
import {
  ProgressWindow,
  ProgressWindowItem,
  ProgressWindowName,
  type ProgressWindowProps,
} from "macalicious/progress-window";
import { PushButton } from "macalicious/push-button";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { SystemImage } from "macalicious/system-image";
import { TextField } from "macalicious/text-field";
import { WindowControls } from "macalicious/window-controls";
import { type CSSProperties, type FocusEventHandler, useId, useState } from "react";
import { ItemIcon } from "./finder-artwork";
import type { FinderNode } from "./finder-data";
import "./finder.tokens.css";
import "./finder-dialogs.css";

/*
 * The windows Finder puts up for a moment: the Empty Trash and Replace alerts, the Go to Folder
 * and Connect to Server dialogs, the Copy progress window and the notification about a disk
 * that was not ejected. Each is the library's component with Finder's words and the demo's
 * stand-in icons in it; each takes what it shows as props and reports the answer through
 * callbacks, so the Finder window and an example can both put one up.
 */

/** Where an alert or a dialog goes: the library puts it over the page by itself. */
interface Placement {
  /** The element the window is rendered into; the document body by default. */
  container?: AlertPopupProps["container"];
  /** Style of the window: `top`, `left` and `margin` place it. */
  style?: CSSProperties;
  /**
   * Where the keyboard focus goes once the window closes: the library's `finalFocus`, passed
   * on. An element, a ref, or a function that returns one, or `false` to leave the focus where
   * it is. Without it the library gives the focus back to the element that had it, or to the
   * first control of that element when it is not a tab stop.
   */
  finalFocus?: AlertPopupProps["finalFocus"];
}

/** The stand-ins for the icons of the Trash and of Finder itself: the demo's own drawings. */
const TRASH_ICON: FinderNode = { name: "Trash", kind: "folder" };
const FINDER_ICON: FinderNode = { name: "Finder", kind: "application" };

export interface FinderEmptyTrashProps extends Placement {
  /** Whether the alert is shown. */
  open: boolean;
  /** Called with `false` when the alert is answered or dismissed with Escape. */
  onOpenChange: (open: boolean) => void;
  /** Called by Empty Trash, the default button, before the alert closes. */
  onEmpty: () => void;
}

/** Finder's Empty Trash alert: Cancel, or Empty Trash, which Return activates. */
export function FinderEmptyTrash({
  open,
  onOpenChange,
  onEmpty,
  container,
  style,
  finalFocus,
}: FinderEmptyTrashProps) {
  return (
    <Alert open={open} onOpenChange={onOpenChange}>
      <AlertPopup
        icon={<ItemIcon node={TRASH_ICON} size={64} />}
        container={container}
        style={style}
        finalFocus={finalFocus}
      >
        <AlertMessage>
          Are you sure you want to permanently erase the items in the Trash?
        </AlertMessage>
        <AlertInformativeText>You can’t undo this action.</AlertInformativeText>
        <AlertButtons>
          <AlertClose>Cancel</AlertClose>
          {/* The measured width, 113 pt between the bezel's edges, as the least. */}
          <AlertClose render={<DefaultButton />} style={{ minWidth: 114 }} onClick={onEmpty}>
            Empty Trash
          </AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

export interface FinderDeleteNowProps extends Placement {
  /** How the items are named: one item's name, or how many there are. `null` hides the alert. */
  subject: string | null;
  /** Called with `false` when the alert is answered or dismissed with Escape. */
  onOpenChange: (open: boolean) => void;
  /** Called by Delete, before the alert closes. */
  onDelete: () => void;
}

/** Delete Immediately's alert: nothing is erased until the person answers Delete. */
export function FinderDeleteNow({
  subject,
  onOpenChange,
  onDelete,
  container,
  style,
  finalFocus,
}: FinderDeleteNowProps) {
  return (
    <Alert open={subject !== null} onOpenChange={onOpenChange}>
      <AlertPopup
        icon={<ItemIcon node={TRASH_ICON} size={64} />}
        container={container}
        style={style}
        finalFocus={finalFocus}
      >
        <AlertMessage>Are you sure you want to delete {subject}?</AlertMessage>
        <AlertInformativeText>You can’t undo this action.</AlertInformativeText>
        <AlertButtons>
          <AlertClose>Cancel</AlertClose>
          <AlertClose render={<DefaultButton />} onClick={onDelete}>
            Delete
          </AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

export interface FinderReplaceProps extends Placement {
  /** The item being copied that the folder already has one of; `null` closes the alert. */
  item: FinderNode | null;
  /** The item is being moved, not copied. */
  moving?: boolean;
  /** Called by Keep Both: the copy goes beside the item, under another name. */
  onKeepBoth: () => void;
  /** Called by Stop, and by Escape: nothing is copied. */
  onStop: () => void;
  /** Called by Replace: the copy takes the item's place. */
  onReplace: () => void;
}

/**
 * Finder's alert for a copy that meets an item of the same name: the library's compact alert
 * with the caution badge on the item's icon and three buttons, none of them the default.
 */
export function FinderReplace({
  item,
  moving,
  onKeepBoth,
  onStop,
  onReplace,
  container,
  style,
  finalFocus,
}: FinderReplaceProps) {
  return (
    <Alert
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onStop();
      }}
    >
      <AlertPopup
        size="small"
        alertStyle="critical"
        icon={item ? <ItemIcon node={item} size={32} /> : undefined}
        controls={<WindowControls closeDisabled zoomDisabled zoomRole="zoom" />}
        container={container}
        style={style}
        finalFocus={finalFocus}
      >
        <AlertMessage>
          An item named “{item?.name}” already exists in this location. Do you want to replace it
          with the one you’re {moving ? "moving" : "copying"}?
        </AlertMessage>
        <AlertButtons>
          {/* Push buttons, not AlertClose: the next item in the way keeps the alert open. */}
          <PushButton size="small" onClick={onKeepBoth}>
            Keep Both
          </PushButton>
          <PushButton size="small" onClick={onStop}>
            Stop
          </PushButton>
          <PushButton size="small" onClick={onReplace}>
            Replace
          </PushButton>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

export interface FinderConnectionFailedProps extends Placement {
  /** The address that no computer answers to; `null` closes the alert. */
  address: string | null;
  /** Called when the alert is answered or dismissed. */
  onClose: () => void;
  /**
   * Why the host cannot reach the address, as the host knows it: the Finder served by Ferrite passes
   * `CONNECT_REASON` (a web page cannot open a connection to a file server). Without it the alert says what
   * macOS says, as captured.
   */
  reason?: string;
}

/** What Connect to Server can reach: a web page cannot open a connection to a file server. */
export const CONNECT_REASON =
  "A web page can’t connect to file servers on your network: Connect reaches only the servers this Mac shows.";

/** What macOS's alert says when no server answers to the address: the captured words. */
const CONNECTION_FAILED_TEXT =
  "The server may not exist or it is unavailable at this time. Check the server name or IP address, check your network connection, and then try again.";

/** The alert Connect to Server ends in when no server it can reach has the address. */
export function FinderConnectionFailed({
  address,
  onClose,
  reason,
  container,
  style,
  finalFocus,
}: FinderConnectionFailedProps) {
  return (
    <Alert
      open={address !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertPopup
        icon={<ItemIcon node={FINDER_ICON} size={64} />}
        container={container}
        style={style}
        finalFocus={finalFocus}
      >
        <AlertMessage>There was a problem connecting to the server “{address}”.</AlertMessage>
        <AlertInformativeText>{reason ?? CONNECTION_FAILED_TEXT}</AlertInformativeText>
        <AlertButtons>
          <AlertClose render={<DefaultButton />}>OK</AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

export interface FinderGoToFolderProps extends Placement {
  /** Whether the dialog is shown. */
  open: boolean;
  /** Called with `false` when the dialog is dismissed: Cancel, Escape, or a path that was found. */
  onOpenChange: (open: boolean) => void;
  /**
   * The paths the combo box offers, the most recent first. The first is in the field when the
   * dialog opens.
   */
  folders: readonly string[];
  /**
   * Called by Go, the default button, with the text of the field. Return `false` when the path
   * leads nowhere: the dialog then stays open and says so.
   */
  onGo: (path: string) => boolean;
}

/** Finder's Go to Folder dialog: a combo box for the path, Cancel and Go. */
export function FinderGoToFolder({
  open,
  onOpenChange,
  folders,
  onGo,
  container,
  style,
  finalFocus,
}: FinderGoToFolderProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        title="Go to Folder"
        width={429}
        container={container}
        style={style}
        finalFocus={finalFocus}
      >
        <GoToFolder folders={folders} onGo={onGo} onDone={() => onOpenChange(false)} />
      </DialogPopup>
    </Dialog>
  );
}

/** The dialog's content, which starts afresh each time the dialog opens. */
function GoToFolder({
  folders,
  onGo,
  onDone,
}: Pick<FinderGoToFolderProps, "folders" | "onGo"> & { onDone: () => void }) {
  const id = useId();
  const [path, setPath] = useState(folders[0] ?? "");
  const [missing, setMissing] = useState(false);
  return (
    <>
      <Label id={`${id}-label`}>Go to the folder:</Label>
      <ComboBox
        aria-labelledby={`${id}-label`}
        aria-describedby={missing ? `${id}-missing` : undefined}
        className="mac-finder-go-path"
        value={path}
        onValueChange={(text) => {
          setPath(text);
          setMissing(false);
        }}
      >
        {folders.map((folder) => (
          <ComboBoxItem key={folder}>{folder}</ComboBoxItem>
        ))}
      </ComboBox>
      {missing && (
        <Label
          id={`${id}-missing`}
          role="alert"
          textStyle="small"
          className="mac-finder-go-missing"
          style={{ display: "block" }}
        >
          The folder can’t be found.
        </Label>
      )}
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton onClick={() => (onGo(path) ? onDone() : setMissing(true))}>Go</DefaultButton>
      </DialogActions>
    </>
  );
}

export interface FinderSaveSearchProps extends Placement {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the name, which is never empty, and whether it goes in the sidebar. Whether it was kept; the dialog closes if so. */
  onSave: (name: string, addToSidebar: boolean) => boolean;
}

/** The sheet the scope bar's Save opens: what the Smart Folder is called. */
export function FinderSaveSearch({
  open,
  onOpenChange,
  onSave,
  container,
  style,
  finalFocus,
}: FinderSaveSearchProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        title="Save Search"
        width={429}
        container={container}
        style={style}
        finalFocus={finalFocus}
      >
        <SaveSearch onSave={onSave} onDone={() => onOpenChange(false)} />
      </DialogPopup>
    </Dialog>
  );
}

function SaveSearch({
  onSave,
  onDone,
}: Pick<FinderSaveSearchProps, "onSave"> & { onDone: () => void }) {
  const id = useId();
  const [name, setName] = useState("Untitled");
  const [addToSidebar, setAddToSidebar] = useState(true);
  const kept = name.trim();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (kept !== "" && onSave(kept, addToSidebar)) onDone();
      }}
    >
      <Label id={`${id}-label`}>Save As:</Label>
      <TextField
        aria-labelledby={`${id}-label`}
        value={name}
        onValueChange={(text: string) => setName(text)}
      />
      <Checkbox checked={addToSidebar} onCheckedChange={setAddToSidebar}>
        Add To Sidebar
      </Checkbox>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton type="submit" disabled={kept === ""}>
          Save
        </DefaultButton>
      </DialogActions>
    </form>
  );
}

export interface FinderConnectToServerProps extends Placement {
  /** Whether the dialog is shown. */
  open: boolean;
  /** Called with `false` when the dialog is closed: its close button, Escape, or a button. */
  onOpenChange: (open: boolean) => void;
  /** The addresses the combo box offers. */
  servers: readonly string[];
  /** The address in the field when the dialog opens. */
  defaultAddress?: string;
  /** The addresses of the Favorite Servers list. */
  favorites: readonly string[];
  /** Called with the new list when the add or the remove button changes it. */
  onFavoritesChange: (favorites: string[]) => void;
  /**
   * Called by Connect, the default button, and by a double click or Return on a favorite, with
   * the address. The dialog closes.
   */
  onConnect: (address: string) => void;
  /** Called by Browse. The dialog closes. */
  onBrowse: () => void;
  /** Called by the help button, which is disabled without it. */
  onHelp?: () => void;
  /**
   * What the host cannot connect to, shown as a note over the address field: the Finder served by Ferrite passes
   * `CONNECT_REASON`. Without it the dialog is drawn as captured.
   */
  unreachableReason?: string;
  /** Called when the focus comes into the dialog: it is a window of its own. */
  onFocusCapture?: FocusEventHandler<HTMLDivElement>;
  /**
   * The window state the dialog is drawn in. It is modeless, so it stays open while another
   * window has the keyboard: pass `"inactive"` then, and its title bar, window controls and
   * default button lose their key look.
   * @default "key"
   */
  state?: DialogPopupProps["state"];
}

/**
 * Finder's Connect to Server dialog: a modeless dialog with window controls, a combo box for
 * the address, the list of favorite servers with its add, remove and Action buttons, a help
 * button, Browse and Connect.
 */
export function FinderConnectToServer({
  open,
  onOpenChange,
  container,
  style,
  finalFocus,
  onFocusCapture,
  state,
  ...content
}: FinderConnectToServerProps) {
  const close = () => onOpenChange(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPopup
        title="Connect to Server"
        width={486}
        controls={<WindowControls zoomDisabled zoomRole="zoom" onClose={close} />}
        container={container}
        style={style}
        state={state}
        finalFocus={finalFocus}
        onFocusCapture={onFocusCapture}
      >
        <ConnectToServer {...content} onDone={close} />
      </DialogPopup>
    </Dialog>
  );
}

/** The dialog's content, which starts afresh each time the dialog opens. */
function ConnectToServer({
  servers,
  defaultAddress = "",
  favorites,
  onFavoritesChange,
  onConnect,
  onBrowse,
  onHelp,
  unreachableReason,
  onDone,
}: Omit<
  FinderConnectToServerProps,
  "open" | "onOpenChange" | keyof Placement | "onFocusCapture" | "state"
> & {
  onDone: () => void;
}) {
  const id = useId();
  const [address, setAddress] = useState(defaultAddress);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const typed = address.trim();
  const addable = typed !== "" && !favorites.includes(typed);
  // What is selected in the list as it now is: a favorite that was removed is not.
  const chosen = selected.filter((favorite) => favorites.includes(favorite));
  const add = () => onFavoritesChange([...favorites, typed]);
  const remove = () =>
    onFavoritesChange(favorites.filter((favorite) => !chosen.includes(favorite)));
  const connect = (to: string) => {
    onDone();
    onConnect(to);
  };
  return (
    <>
      {unreachableReason ? <p className="mac-finder-connect-note">{unreachableReason}</p> : null}
      <ComboBox
        aria-label="Server Address"
        className="mac-finder-connect-address"
        value={address}
        onValueChange={setAddress}
      >
        {servers.map((server) => (
          <ComboBoxItem key={server}>{server}</ComboBoxItem>
        ))}
      </ComboBox>
      <Label
        id={`${id}-favorites`}
        textStyle="small"
        className="mac-finder-connect-label"
        style={{ display: "block" }}
      >
        Favorite Servers:
      </Label>
      <BorderedList className="mac-finder-connect-favorites">
        <BorderedListRows
          aria-labelledby={`${id}-favorites`}
          rowHeight={19}
          alternatingRows
          value={chosen}
          onValueChange={(value) => {
            setSelected(value);
            // A favorite that is selected is the address the buttons act on.
            if (value[0] !== undefined) setAddress(value[0]);
          }}
          onRowAction={connect}
        >
          {favorites.map((favorite) => (
            <BorderedListRow key={favorite} value={favorite} title={favorite} />
          ))}
        </BorderedListRows>
      </BorderedList>
      <DialogActions
        // The row stands 8.5 pt under the list. Its buttons are as wide as their titles and at
        // least as wide as measured: 72 and 79 pt between their bezels' edges.
        style={{ marginTop: 8, "--mac-dialog-button-min-width": "0px" } as CSSProperties}
        leading={
          <>
            <SegmentedControl
              aria-label="Favorite servers"
              trackingMode="momentary"
              distribution="fit"
            >
              <Segment
                aria-label="Add to Favorites"
                className="mac-finder-connect-edit"
                disabled={!addable}
                onClick={add}
              >
                <SystemImage name="add" />
              </Segment>
              <Segment
                aria-label="Remove from Favorites"
                className="mac-finder-connect-edit"
                disabled={chosen.length === 0}
                onClick={remove}
              >
                <SystemImage name="remove" />
              </Segment>
              <Menu>
                <MenuTrigger
                  render={<Segment aria-label="Action" className="mac-finder-connect-action" />}
                >
                  <SystemImage name="action" scale={14 / 13} />
                  <SystemImage name="chevron-down" />
                </MenuTrigger>
                <MenuPopup sideOffset={4}>
                  <MenuItem disabled={!addable} onClick={add}>
                    Add to Favorites
                  </MenuItem>
                  <MenuItem disabled={chosen.length === 0} onClick={remove}>
                    Remove from Favorites
                  </MenuItem>
                </MenuPopup>
              </Menu>
            </SegmentedControl>
            <HelpButton disabled={!onHelp} onClick={onHelp} />
          </>
        }
      >
        <PushButton
          style={{ minWidth: 73 }}
          onClick={() => {
            onDone();
            onBrowse();
          }}
        >
          Browse
        </PushButton>
        <DefaultButton
          style={{ minWidth: 80 }}
          disabled={typed === ""}
          onClick={() => connect(typed)}
        >
          Connect
        </DefaultButton>
      </DialogActions>
    </>
  );
}

/** A size the way Finder's progress window writes it: `192.9 MB`, `6 GB`, `Zero KB`. */
function amount(bytes: number): string {
  if (bytes <= 0) return "Zero KB";
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(1).replace(/\.0$/, "")} ${units[unit]}`;
}

/** The time a copy still takes, in the unit Finder rounds it to. */
function duration(seconds: number): string {
  const [count, unit] =
    seconds >= 60
      ? [Math.round(seconds / 60), "minute"]
      : [Math.max(1, Math.ceil(seconds)), "second"];
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

export interface FinderCopyProgressProps extends Omit<ProgressWindowProps, "children"> {
  /** The items being copied. One is named in the title; several are counted. */
  items: readonly FinderNode[];
  /** The name of the folder they are copied to. */
  destination: string;
  /** Bytes copied so far. */
  copied: number;
  /** Bytes to copy in all. */
  total: number;
  /** Seconds the copy still takes. */
  remaining: number;
  /** Called by the stop button. */
  onStop: () => void;
  /**
   * What is being done, as the title says it: `Copying`, or `Uploading` and `Downloading` for
   * the person's drive.
   * @default "Copying"
   */
  verb?: string;
}

/**
 * Finder's Copy window: the library's progress window with one item, whose icon is the
 * stand-in of the first item copied. Its close and zoom buttons are disabled, as in Finder:
 * the window goes when the copy is done or stopped.
 */
export function FinderCopyProgress({
  items,
  destination,
  copied,
  total,
  remaining,
  onStop,
  verb = "Copying",
  className,
  ...props
}: FinderCopyProgressProps) {
  const [first] = items;
  return (
    <ProgressWindow
      aria-label={verb === "Copying" ? "Copy" : verb}
      controls={<WindowControls closeDisabled zoomDisabled zoomRole="zoom" />}
      className={cn("mac-finder-copy", className)}
      {...props}
    >
      <ProgressWindowItem
        icon={first ? <ItemIcon node={first} size={32} /> : undefined}
        title={
          first && items.length === 1 ? (
            <>
              {verb} “<ProgressWindowName tail={13}>{first.name}</ProgressWindowName>” to “
              {destination}”
            </>
          ) : (
            `${verb} ${items.length} items to “${destination}”`
          )
        }
        status={`${amount(copied)} of ${amount(total)} - About ${duration(remaining)}`}
        value={total > 0 ? Math.min((copied / total) * 100, 100) : null}
        onStop={onStop}
      />
    </ProgressWindow>
  );
}

export interface FinderDriveAlertProps extends Placement {
  /** What went wrong, in the drive's own words; `null` closes the alert. */
  message: string | null;
  /** Called when the alert is answered or dismissed. */
  onClose: () => void;
}

/** The alert a change to the person's drive ends in when the drive refuses it or cannot be
 * reached. */
export function FinderDriveAlert({
  message,
  onClose,
  container,
  style,
  finalFocus,
}: FinderDriveAlertProps) {
  return (
    <Alert
      open={message !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertPopup
        icon={<ItemIcon node={FINDER_ICON} size={64} />}
        container={container}
        style={style}
        finalFocus={finalFocus}
      >
        <AlertMessage>The operation can’t be completed.</AlertMessage>
        <AlertInformativeText>{message}</AlertInformativeText>
        <AlertButtons>
          <AlertClose render={<DefaultButton />}>OK</AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

/** Asks before a rename changes a name's extension: the file may then open differently. */
export function FinderExtensionWarning({
  change,
  onKeep,
  onUse,
  finalFocus,
}: Placement & {
  change: { was: string; now: string } | null;
  onKeep: () => void;
  onUse: () => void;
}) {
  return (
    <Alert
      open={change !== null}
      onOpenChange={(open) => {
        if (!open) onKeep();
      }}
    >
      <AlertPopup icon={<ItemIcon node={FINDER_ICON} size={64} />} finalFocus={finalFocus}>
        <AlertMessage>
          {`Are you sure you want to change the extension from “.${change?.was}” to “.${change?.now}”?`}
        </AlertMessage>
        <AlertInformativeText>
          If you make this change, your document may open in a different application.
        </AlertInformativeText>
        <AlertButtons>
          <AlertClose onClick={onUse}>{`Use .${change?.now}`}</AlertClose>
          <AlertClose render={<DefaultButton />}>{`Keep .${change?.was}`}</AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}

export interface FinderEjectWarningProps
  extends Omit<NotificationAlertProps, "title" | "icon" | "actions" | "children"> {
  /** The name of the disk that was disconnected without being ejected. */
  disk: string;
}

/**
 * The notification macOS posts for Finder when a disk goes without having been ejected: the
 * library's alert-style notification with a Close button, which calls `onDismiss`.
 */
export function FinderEjectWarning({ disk, ...props }: FinderEjectWarningProps) {
  return (
    <NotificationAlert
      title="Disk Not Ejected Properly"
      icon={<ItemIcon node={FINDER_ICON} size={32} />}
      actions={<NotificationAlertClose>Close</NotificationAlertClose>}
      {...props}
    >
      Eject “{disk}” before disconnecting or turning it off.
    </NotificationAlert>
  );
}
