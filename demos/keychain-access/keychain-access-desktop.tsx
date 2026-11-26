import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { Dialog, DialogActions, DialogClose, DialogPopup } from "macalicious/dialog";
import { Label } from "macalicious/label";
import { matchesMenuKeyEquivalent, onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { SecureTextField } from "macalicious/secure-text-field";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { TextField } from "macalicious/text-field";
import { TextView } from "macalicious/text-view";
import { use, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { useDesktopDrop } from "../desktop/desktop-drag";
import { readFile } from "../desktop/desktop-files";
import { requestHelp } from "../desktop/desktop-help";
import { useDesktopSetting } from "../desktop/desktop-personal";
import {
  CHANGED_ELSEWHERE,
  onSaveFailure,
  reloadServerDocuments,
  servedByDesktopApp,
  sessionFetch,
  useServerState,
} from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { keepServerCopy } from "../desktop/document-merge";
import {
  KEYCHAIN_ITEM_DRAG,
  KeychainAccess,
  type KeychainAccessLayout,
  type KeychainAccessProps,
} from "./keychain-access";
import { PasswordAssistant, PasswordQuality } from "./keychain-access-assistant";
import {
  CATEGORIES,
  COLUMNS,
  describe as describeItem,
  KEYCHAINS,
  type KeychainAccessItem,
  type KeychainAccessKeychain,
} from "./keychain-access-data";
import {
  freshItemIds,
  MAX_KEYCHAIN_NAME_LENGTH,
  MAX_KEYCHAINS,
  useOtherKeychains,
} from "./keychain-access-others";
import {
  createVault,
  envelopeFromServer,
  envelopeOfFile,
  KEYCHAIN_VAULT_URL,
  localStamp,
  MAX_IMPORT_BYTES,
  MAX_SECRET_LENGTH,
  MIN_PASSWORD_LENGTH,
  type OpenVault,
  openWithKey,
  passwordKind,
  sealItems,
  sealVault,
  unlockVault,
  type VaultEnvelope,
  type VaultItem,
  vaultReadable,
  WrongPasswordError,
  withImported,
} from "./keychain-access-vault";
import { reportKeychainUnlocked } from "./keychain-status";

/** What the dialog over the window is asking for. */
type Ask =
  | { kind: "create" }
  /** A keychain beside “login”: its name and its own password. */
  | { kind: "new-keychain" }
  | { kind: "unlock"; keychain?: string }
  | { kind: "add" }
  | { kind: "add-note" }
  | { kind: "change-password"; keychain?: string }
  | { kind: "inspect"; item: VaultItem }
  /** Asks for a password of the file's own, as the items leave the keychain. */
  | { kind: "export"; items: readonly VaultItem[] }
  /** Asks for the password of a file chosen to import. */
  | { kind: "import"; name: string; envelope: VaultEnvelope }
  /** The keychain's lock settings. */
  | { kind: "settings" }
  /** Asks before the whole keychain goes: it cannot be brought back. */
  | { kind: "delete-keychain"; keychain?: string }
  /** Asks before the items go: a deleted item cannot be brought back. */
  | { kind: "delete"; ids: readonly string[]; names: readonly string[] }
  /** Says something the window could not do. */
  | { kind: "notice"; text: string }
  /** This window's change lost to another window's or browser's saved first; `mine` is it. */
  | { kind: "conflict"; mine: OpenVault; what: string };

const today = () => localStamp(new Date()).slice(0, 10);

/* A menu holds the keyboard until it has faded: a field is focused after that. */
const AFTER_MENU_MS = 300;

/** How long a move waits for “login” to be stored before it takes the items from where they were. */
const CONFIRM_TRIES = 25;
const CONFIRM_PAUSE_MS = 200;

/** The person locked the keychain while this work was under way: it stops, with nothing to say. */
class KeychainLockedError extends Error {}

interface ServedKeychainOptions {
  /** PBKDF2 iterations for a new keychain; tests pass the server's least. */
  iterations?: number;
}

function CreateForm({ onCreate, busy }: { onCreate: (password: string) => void; busy: boolean }) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [verify, setVerify] = useState("");
  const long = password.length >= MIN_PASSWORD_LENGTH;
  const same = password === verify;
  return (
    <>
      <Label render={<p />}>
        Choose a password for the “login” keychain. Keychain Access encrypts the keychain in this
        browser with it; the server keeps only the encrypted keychain and cannot recover the
        password.
      </Label>
      <div className="mac-keychain-access-form">
        <Label id={`${id}password`} align="end">
          New Password:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}password`}
          maxLength={MAX_SECRET_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <Label id={`${id}verify`} align="end">
          Verify:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}verify`}
          maxLength={MAX_SECRET_LENGTH}
          value={verify}
          onChange={(event) => setVerify(event.currentTarget.value)}
        />
      </div>
      <Label textStyle="small" color="secondary" role="status" render={<p />}>
        {!long
          ? `At least ${MIN_PASSWORD_LENGTH} characters.`
          : !same
            ? "The passwords do not match."
            : ""}
      </Label>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton disabled={!long || !same || busy} onClick={() => onCreate(password)}>
          Create
        </DefaultButton>
      </DialogActions>
    </>
  );
}

/** The name and the password of a keychain beside “login”. */
function NewKeychainForm({
  taken,
  onCreate,
  busy,
}: {
  taken: readonly string[];
  onCreate: (name: string, password: string) => void;
  busy: boolean;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [verify, setVerify] = useState("");
  const clean = name.trim();
  const free = !taken.some((each) => each.toLowerCase() === clean.toLowerCase());
  const long = password.length >= MIN_PASSWORD_LENGTH;
  const same = password === verify;
  return (
    <>
      <Label render={<p />}>
        A keychain has a password of its own. Its items are encrypted in this browser with it, and
        the server cannot recover the password. Its name is kept as you write it, so that the list
        can show it while it is locked.
      </Label>
      <div className="mac-keychain-access-form">
        <Label id={`${id}name`} align="end">
          Name:
        </Label>
        <TextField
          aria-labelledby={`${id}name`}
          maxLength={MAX_KEYCHAIN_NAME_LENGTH}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Label id={`${id}password`} align="end">
          New Password:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}password`}
          maxLength={MAX_SECRET_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <Label id={`${id}verify`} align="end">
          Verify Password:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}verify`}
          maxLength={MAX_SECRET_LENGTH}
          value={verify}
          onChange={(event) => setVerify(event.currentTarget.value)}
        />
      </div>
      <Label textStyle="small" color="secondary" role="status" render={<p />}>
        {!free
          ? `A keychain is already called “${clean}”.`
          : password && !long
            ? `The password needs at least ${MIN_PASSWORD_LENGTH} characters.`
            : verify && !same
              ? "The passwords do not match."
              : ""}
      </Label>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton
          disabled={busy || clean === "" || !free || !long || !same}
          onClick={() => onCreate(clean, password)}
        >
          Create
        </DefaultButton>
      </DialogActions>
    </>
  );
}

function UnlockForm({
  name = "login",
  onUnlock,
  busy,
  wrong,
}: {
  name?: string;
  onUnlock: (password: string) => void;
  busy: boolean;
  wrong: boolean;
}) {
  const id = useId();
  const [password, setPassword] = useState("");
  return (
    <>
      <Label render={<p />}>
        Keychain Access wants to use the “{name}” keychain. Enter the keychain password.
      </Label>
      <div className="mac-keychain-access-form">
        <Label id={`${id}password`} align="end">
          Password:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}password`}
          maxLength={MAX_SECRET_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
      </div>
      <Label textStyle="small" color="secondary" role="status" render={<p />}>
        {wrong ? "The password you entered is not correct." : busy ? "Unlocking…" : ""}
      </Label>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton disabled={!password || busy} onClick={() => onUnlock(password)}>
          Unlock
        </DefaultButton>
      </DialogActions>
    </>
  );
}

function ChangePasswordForm({
  onChange,
  busy,
  wrong,
}: {
  onChange: (current: string, next: string) => void;
  busy: boolean;
  wrong: boolean;
}) {
  const id = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [verify, setVerify] = useState("");
  const long = next.length >= MIN_PASSWORD_LENGTH;
  const same = next === verify;
  return (
    <>
      <div className="mac-keychain-access-form">
        <Label id={`${id}current`} align="end">
          Current Password:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}current`}
          maxLength={MAX_SECRET_LENGTH}
          value={current}
          onChange={(event) => setCurrent(event.currentTarget.value)}
        />
        <Label id={`${id}next`} align="end">
          New Password:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}next`}
          maxLength={MAX_SECRET_LENGTH}
          value={next}
          onChange={(event) => setNext(event.currentTarget.value)}
        />
        <Label id={`${id}verify`} align="end">
          Verify:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}verify`}
          maxLength={MAX_SECRET_LENGTH}
          value={verify}
          onChange={(event) => setVerify(event.currentTarget.value)}
        />
      </div>
      <Label textStyle="small" color="secondary" role="status" render={<p />}>
        {wrong
          ? "The current password is not correct."
          : !long
            ? `At least ${MIN_PASSWORD_LENGTH} characters.`
            : !same
              ? "The passwords do not match."
              : ""}
      </Label>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton
          disabled={!current || !long || !same || busy}
          onClick={() => onChange(current, next)}
        >
          OK
        </DefaultButton>
      </DialogActions>
    </>
  );
}

function AddForm({
  onAdd,
  busy,
}: {
  onAdd: (item: { name: string; account: string; secret: string }) => void;
  busy: boolean;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [secret, setSecret] = useState("");
  const ready = name.trim() !== "" && secret !== "" && !busy;
  return (
    <>
      <Label render={<p />}>
        Enter a name for this keychain item. For an Internet password, enter its web address (for
        example, https://www.example.com).
      </Label>
      <div className="mac-keychain-access-form">
        <Label id={`${id}name`} align="end">
          Keychain Item Name:
        </Label>
        <TextField
          aria-labelledby={`${id}name`}
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Label id={`${id}account`} align="end">
          Account Name:
        </Label>
        <TextField
          aria-labelledby={`${id}account`}
          maxLength={200}
          value={account}
          onChange={(event) => setAccount(event.currentTarget.value)}
        />
        <Label id={`${id}secret`} align="end">
          Password:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}secret`}
          maxLength={MAX_SECRET_LENGTH}
          value={secret}
          onChange={(event) => setSecret(event.currentTarget.value)}
        />
        {secret !== "" ? <PasswordQuality password={secret} /> : null}
        <PasswordAssistant onUse={setSecret} />
      </div>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton
          disabled={!ready}
          onClick={() => onAdd({ name: name.trim(), account: account.trim(), secret })}
        >
          Add
        </DefaultButton>
      </DialogActions>
    </>
  );
}

function NoteForm({
  onAdd,
  busy,
}: {
  onAdd: (item: { name: string; secret: string }) => void;
  busy: boolean;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  return (
    <>
      <div className="mac-keychain-access-form">
        <Label id={`${id}name`} align="end">
          Keychain Item Name:
        </Label>
        <TextField
          aria-labelledby={`${id}name`}
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Label id={`${id}note`} align="end">
          Note:
        </Label>
        <TextView
          aria-labelledby={`${id}note`}
          rows={6}
          maxLength={MAX_SECRET_LENGTH}
          value={note}
          onValueChange={setNote}
        />
      </div>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton
          disabled={name.trim() === "" || note === "" || busy}
          onClick={() => onAdd({ name: name.trim(), secret: note })}
        >
          Add
        </DefaultButton>
      </DialogActions>
    </>
  );
}

function ImportForm({
  name,
  onImport,
  busy,
  wrong,
}: {
  name: string;
  onImport: (password: string) => void;
  busy: boolean;
  wrong: boolean;
}) {
  const id = useId();
  const [password, setPassword] = useState("");
  return (
    <>
      <Label render={<p />}>
        Enter the password of “{name}”. Its items are decrypted in this browser and added to the
        “login” keychain; this desktop's server never sees the file or the password.
      </Label>
      <div className="mac-keychain-access-form">
        <Label id={`${id}password`} align="end">
          File Password:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}password`}
          maxLength={MAX_SECRET_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
      </div>
      <Label textStyle="small" color="secondary" role="status" render={<p />}>
        {wrong ? "The password you entered is not correct." : busy ? "Importing…" : ""}
      </Label>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton disabled={!password || busy} onClick={() => onImport(password)}>
          Import
        </DefaultButton>
      </DialogActions>
    </>
  );
}

function SettingsForm({
  settings,
  onSave,
}: {
  settings: KeychainSettings;
  onSave: (settings: KeychainSettings) => void;
}) {
  const [after, setAfter] = useState(settings.lockAfterMinutes !== undefined);
  const [minutes, setMinutes] = useState(String(settings.lockAfterMinutes ?? 5));
  const [hidden, setHidden] = useState(settings.lockWhenHidden === true);
  const chosen = minutesOf(minutes);
  return (
    <>
      <div className="mac-keychain-access-lock-after">
        <Checkbox checked={after} onCheckedChange={setAfter}>
          Lock after
        </Checkbox>
        <TextField
          aria-label="Minutes of inactivity"
          inputMode="numeric"
          disabled={!after}
          value={minutes}
          onChange={(event) => setMinutes(event.currentTarget.value)}
        />
        <Label>minutes of inactivity</Label>
      </div>
      <Checkbox checked={hidden} onCheckedChange={setHidden}>
        Lock when this browser tab is hidden
      </Checkbox>
      <Label textStyle="small" color="secondary" render={<p />}>
        A web page cannot see the Mac go to sleep, so a hidden tab stands in for it. Inactivity
        means no click or key on this desktop.
      </Label>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton
          disabled={after && chosen === undefined}
          onClick={() =>
            onSave({
              lockAfterMinutes: after ? chosen : undefined,
              lockWhenHidden: hidden,
            })
          }
        >
          Save
        </DefaultButton>
      </DialogActions>
    </>
  );
}

function DeleteKeychainForm({
  name = "login",
  count,
  onDelete,
  busy,
}: {
  name?: string;
  count: number | undefined;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <>
      <Label render={<p />}>
        Are you sure you want to delete the “{name}” keychain
        {count === undefined ? "" : count === 1 ? " and its item" : ` and its ${count} items`}? It
        cannot be brought back, and the server cannot recover it.
      </Label>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton disabled={busy} onClick={onDelete}>
          Delete
        </DefaultButton>
      </DialogActions>
    </>
  );
}

function ExportForm({
  count,
  onExport,
  busy,
}: {
  count: number;
  onExport: (password: string) => void;
  busy: boolean;
}) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [verify, setVerify] = useState("");
  const longEnough = password.length >= MIN_PASSWORD_LENGTH;
  const same = password === verify;
  return (
    <>
      <Label render={<p />}>
        {count === 1 ? "The item" : `The ${count} items`} will be saved to your computer in a file
        encrypted with this password. Your browser downloads it; this desktop's server never sees
        the file or the password.
      </Label>
      <div className="mac-keychain-access-form">
        <Label id={`${id}password`} align="end">
          File Password:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}password`}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <Label id={`${id}verify`} align="end">
          Verify:
        </Label>
        <SecureTextField
          aria-labelledby={`${id}verify`}
          value={verify}
          onChange={(event) => setVerify(event.currentTarget.value)}
        />
        {password !== "" ? <PasswordQuality password={password} /> : null}
      </div>
      {password !== "" && !longEnough ? (
        <Label textStyle="small" render={<p />}>
          Use at least {MIN_PASSWORD_LENGTH} characters.
        </Label>
      ) : null}
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton disabled={!longEnough || !same || busy} onClick={() => onExport(password)}>
          Export
        </DefaultButton>
      </DialogActions>
    </>
  );
}

/** The attributes Info edits; the kind and the dates are not the person's to change. */
interface ItemChanges {
  name: string;
  account?: string;
  where?: string;
  comments?: string;
  secret: string;
}

function InspectForm({
  item,
  onDelete,
  onSave,
  busy,
}: {
  item: VaultItem;
  onDelete: () => void;
  onSave: (changes: ItemChanges) => void;
  busy: boolean;
}) {
  const id = useId();
  const note = item.kind === "secure note";
  const [shown, setShown] = useState(false);
  const [name, setName] = useState(item.name);
  const [account, setAccount] = useState(item.account ?? "");
  const [where, setWhere] = useState(item.where ?? "");
  const [comments, setComments] = useState(item.comments ?? "");
  const [secret, setSecret] = useState(item.secret);
  const changed =
    name !== item.name ||
    account !== (item.account ?? "") ||
    where !== (item.where ?? "") ||
    comments !== (item.comments ?? "") ||
    secret !== item.secret;
  const reveal = note ? "Show Note" : "Show Password";
  return (
    <>
      <TabView defaultValue="attributes">
        <TabViewList aria-label="Item">
          <TabViewTab value="attributes">Attributes</TabViewTab>
          <TabViewTab value="access">Access Control</TabViewTab>
        </TabViewList>
        <TabViewPanel value="access">
          <Label render={<p />}>
            No app on this desktop can read this item. It opens only here, in Keychain Access, with
            the keychain unlocked by your keychain password. There is no list of allowed
            applications to change, as the item is encrypted in your browser and the server keeps
            only the sealed keychain.
          </Label>
        </TabViewPanel>
        <TabViewPanel value="attributes">
          <Label render={<dl />} className="mac-keychain-access-form">
            {describeItem(item, today())
              .filter((line) => line.label === "Kind:" || line.label === "Modified:")
              .map((line) => (
                <div key={line.label} className="mac-keychain-access-detail">
                  <dt>{line.label}</dt>
                  <dd>{line.value}</dd>
                </div>
              ))}
          </Label>
          <div className="mac-keychain-access-form">
            <Label id={`${id}name`} align="end">
              Name:
            </Label>
            <TextField
              aria-labelledby={`${id}name`}
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
            {note ? null : (
              <>
                <Label id={`${id}account`} align="end">
                  Account:
                </Label>
                <TextField
                  aria-labelledby={`${id}account`}
                  maxLength={200}
                  value={account}
                  onChange={(event) => setAccount(event.currentTarget.value)}
                />
                <Label id={`${id}where`} align="end">
                  Where:
                </Label>
                <TextField
                  aria-labelledby={`${id}where`}
                  maxLength={200}
                  value={where}
                  onChange={(event) => setWhere(event.currentTarget.value)}
                />
              </>
            )}
            <Label id={`${id}comments`} align="end">
              Comments:
            </Label>
            <TextView
              aria-labelledby={`${id}comments`}
              rows={2}
              maxLength={2000}
              value={comments}
              onValueChange={setComments}
            />
            <Label id={`${id}secret`} align="end">
              {note ? "Note:" : "Password:"}
            </Label>
            {!shown ? (
              <PushButton onClick={() => setShown(true)}>{reveal}</PushButton>
            ) : note ? (
              <TextView
                aria-label="Note"
                rows={6}
                maxLength={MAX_SECRET_LENGTH}
                value={secret}
                onValueChange={setSecret}
              />
            ) : (
              <TextField
                aria-label="Password"
                maxLength={MAX_SECRET_LENGTH}
                value={secret}
                onChange={(event) => setSecret(event.currentTarget.value)}
              />
            )}
            {shown && !note ? <PasswordQuality password={secret} /> : null}
            {!note ? (
              <PasswordAssistant
                onUse={(password) => {
                  setSecret(password);
                  setShown(true);
                }}
              />
            ) : null}
          </div>
        </TabViewPanel>
      </TabView>
      <DialogActions
        leading={
          <PushButton disabled={busy} onClick={onDelete}>
            Delete
          </PushButton>
        }
      >
        <DialogClose>Done</DialogClose>
        <DefaultButton
          disabled={!changed || name.trim() === "" || secret === "" || busy}
          onClick={() =>
            onSave({
              name: name.trim(),
              account: account.trim() || undefined,
              where: where.trim() || undefined,
              comments: comments.trim() || undefined,
              secret,
            })
          }
        >
          Save Changes
        </DefaultButton>
      </DialogActions>
    </>
  );
}

function DeleteForm({
  names,
  onDelete,
  busy,
}: {
  names: readonly string[];
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <>
      <Label render={<p />}>
        {names.length === 1
          ? `Are you sure you want to delete “${names[0]}”?`
          : `Are you sure you want to delete these ${names.length} items?`}{" "}
        A deleted item cannot be brought back.
      </Label>
      <DialogActions>
        <DialogClose>Cancel</DialogClose>
        <DefaultButton disabled={busy} onClick={onDelete}>
          Delete
        </DefaultButton>
      </DialogActions>
    </>
  );
}

/**
 * This window's change was not saved: another window or browser saved the keychain first, and the
 * window now shows that keychain. The person keeps it, or saves this window's version over it.
 */
function ConflictForm({
  what,
  onKeepMine,
  busy,
}: {
  what: string;
  onKeepMine: () => void;
  busy: boolean;
}) {
  return (
    <>
      <Label render={<p />}>
        Another window or browser changed the “login” keychain first, so {what} was not saved. This
        window now shows the keychain as it was saved there.
      </Label>
      <Label textStyle="small" color="secondary" render={<p />}>
        Keep My Version saves this window’s keychain over it, replacing the other change.
      </Label>
      <DialogActions>
        <DialogClose>Use Saved Version</DialogClose>
        <DefaultButton disabled={busy} onClick={onKeepMine}>
          Keep My Version
        </DefaultButton>
      </DialogActions>
    </>
  );
}

const dialogTitles = (name: string): Record<Ask["kind"], string> => ({
  create: "New Keychain Password",
  "new-keychain": "New Keychain",
  unlock: `Unlock the “${name}” Keychain`,
  add: "New Password Item",
  "add-note": "New Secure Note Item",
  "change-password": `Change Password for Keychain “${name}”`,
  inspect: "",
  export: "Export Items",
  import: "Import Items",
  settings: `Keychain “${name}” Settings`,
  "delete-keychain": `Delete Keychain “${name}”`,
  delete: `Delete from the “${name}” Keychain`,
  notice: "Keychain Access",
  conflict: "Your Keychain Change Was Not Saved",
});

/** The window's layout, for the account: choices and sizes. No item's name or secret goes here. */
const LAYOUT_KEY = "keychain-access.layout";
const NO_LAYOUT: KeychainAccessLayout = {};
const size = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

/**
 * What is known of a stored layout: anything else in it is dropped, so no other value is kept. The
 * same stored value reads as the same object, as the table's rows and selection follow its sort.
 */
const layoutsRead = new WeakMap<object, KeychainAccessLayout>();
export function readLayout(stored: unknown): KeychainAccessLayout | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const known = layoutsRead.get(stored);
  if (known) return known;
  const layout = parseLayout(stored as Record<string, unknown>);
  layoutsRead.set(stored, layout);
  return layout;
}

function parseLayout(from: Record<string, unknown>): KeychainAccessLayout {
  const sort = from.sort as { column?: unknown; direction?: unknown } | undefined;
  const widths = Object.entries((from.widths ?? {}) as Record<string, unknown>).flatMap(
    ([column, width]) => {
      const known = COLUMNS.some((entry) => entry.id === column) ? size(width) : undefined;
      return known === undefined ? [] : [[column, known] as const];
    },
  );
  return {
    keychain:
      typeof from.keychain === "string" &&
      (KEYCHAINS.some((entry) => entry.id === from.keychain) ||
        /^keychain-[a-z0-9-]{1,40}$/.test(from.keychain))
        ? from.keychain
        : undefined,
    category: CATEGORIES.find((entry) => entry.id === from.category)?.id,
    sort:
      COLUMNS.some((entry) => entry.id === sort?.column) &&
      (sort?.direction === "ascending" || sort?.direction === "descending")
        ? ({ column: sort.column, direction: sort.direction } as KeychainAccessLayout["sort"])
        : undefined,
    widths: Object.fromEntries(widths),
    sourcesWidth: size(from.sourcesWidth),
    keychainsHeight: size(from.keychainsHeight),
    sourcesHidden: from.sourcesHidden === true,
    statusHidden: from.statusHidden === true,
  };
}

/** The keychain's lock settings, for the account. They say nothing of what it holds. */
export interface KeychainSettings {
  lockAfterMinutes?: number;
  lockWhenHidden?: boolean;
}
const SETTINGS_KEY = "keychain-access.settings";
const NO_SETTINGS: KeychainSettings = {};
/** A day is the longest wait the field takes. */
const MAX_LOCK_MINUTES = 1440;
function minutesOf(value: unknown): number | undefined {
  const minutes = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  return typeof minutes === "number" &&
    Number.isInteger(minutes) &&
    minutes >= 1 &&
    minutes <= MAX_LOCK_MINUTES
    ? minutes
    : undefined;
}
export function readSettings(stored: unknown): KeychainSettings | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { lockAfterMinutes, lockWhenHidden } = stored as Record<string, unknown>;
  return { lockAfterMinutes: minutesOf(lockAfterMinutes), lockWhenHidden: lockWhenHidden === true };
}

/** Why the commands of the Mac's own keychain files, certificates and tickets are dimmed here. */
const ONLY_LOGIN =
  "A web page cannot reach the Mac's keychain files, certificates or Kerberos tickets. Keychains you make here are kept beside “login”, and new items go to the one selected.";

/** Why Undo and Redo are dimmed. */
const NO_UNDO =
  "A change to the keychain is saved at once, and Delete asks first: Keychain Access keeps no history of it.";

const isField = (target: EventTarget | null) =>
  target instanceof HTMLElement && target.matches("input, textarea, [contenteditable='true']");

/** The status bar: the count, or why a keychain of the Mac has nothing here. */
export const statusLine = (keychain: KeychainAccessKeychain, count: number) =>
  keychain.id === "login" || keychain.id.startsWith("keychain-")
    ? `${count} ${count === 1 ? "item" : "items"}`
    : `A web page cannot read “${keychain.name}”. Only your own keychains are kept here.`;

export function ServedKeychainAccess({
  iterations,
  onAdd,
  onInspect,
  state: windowState = "key",
  ...props
}: KeychainAccessProps & ServedKeychainOptions) {
  // The stored envelope: what the server keeps and every window of the page shares.
  const [envelope, setEnvelope] = useState<VaultEnvelope | null>(null);
  // The stored keychain could not be read: nothing is offered that would save over it.
  const [unreadable, setUnreadable] = useState(false);
  const [vault, setVault] = useState<OpenVault>();
  const [ask, setAsk] = useState<Ask>();
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [failure, setFailure] = useState<string>();
  // The envelope this window last sealed or opened, so another window's save is told apart.
  const known = useRef<VaultEnvelope | null>(null);
  // The newest envelope the page holds, read after an await to see another window's save.
  const latest = useRef<VaultEnvelope | null>(envelope);
  latest.current = envelope;
  const asked = useRef(false);
  // The change this window sealed last, until another version of the keychain reaches the window:
  // a save another window or browser made first refuses it (`CHANGED_ELSEWHERE`, told right after
  // the page is shown their keychain), and the window then offers it back instead of dropping it.
  const pending = useRef<{ sealed: VaultEnvelope; vault?: OpenVault; what: string } | null>(null);

  // The keychains made beside “login”, and the one the window shows, if it is one of them.
  const others = useOtherKeychains(iterations);

  const loading = useServerState<VaultEnvelope | null>({
    url: KEYCHAIN_VAULT_URL,
    enabled: true,
    value: envelope,
    onLoad: (stored) => {
      if (!vaultReadable(stored)) {
        setUnreadable(true);
        return false;
      }
      setUnreadable(false);
      setEnvelope(envelopeFromServer(stored) ?? null);
    },
    toBody: (value) => ({ vault: value }),
    // The keychain is sealed whole: a change made on a keychain another window or browser has
    // replaced since cannot be merged into it, and gives way to it.
    merge: keepServerCopy,
  });

  // Once loaded, ask for the keychain password (or a new one) once, as the window opens.
  useEffect(() => {
    if (loading || asked.current || unreadable) return;
    asked.current = true;
    setAsk({ kind: envelope ? "unlock" : "create" });
  }, [loading, envelope, unreadable]);

  // This window's change lost to a keychain saved first elsewhere: say what was not saved, and
  // keep this window's version until the person chooses (`ConflictForm`). The channel reports the change
  // as not kept and then shows every window the saved keychain, in one go, so the change is
  // still `pending` here; a window whose change it was not has none.
  useEffect(
    () =>
      onSaveFailure((failure) => {
        if (failure.url !== KEYCHAIN_VAULT_URL || failure.reason !== CHANGED_ELSEWHERE) return;
        const lost = pending.current;
        if (!lost) return;
        pending.current = null;
        setFailure(undefined);
        setAsk(
          lost.vault
            ? { kind: "conflict", mine: lost.vault, what: lost.what }
            : {
                kind: "notice",
                text: `Another window or browser changed the “login” keychain first, so ${lost.what} was not saved.`,
              },
        );
      }),
    [],
  );
  // Another version of the keychain reached the window (saved over this window's, or this one's
  // refused and reported above): this window's last change is no longer the one in question.
  useEffect(() => {
    if (pending.current && envelope !== pending.current.sealed) pending.current = null;
  }, [envelope]);

  // How many times the person has locked, so that work begun before stops (`run`).
  const locks = useRef(0);

  // Lock: forget the key and the items, and close a dialog that shows or adds to them.
  const closeItemDialogs = () =>
    setAsk((current) =>
      current?.kind === "inspect" ||
      current?.kind === "add" ||
      current?.kind === "add-note" ||
      current?.kind === "change-password" ||
      current?.kind === "delete" ||
      current?.kind === "export" ||
      current?.kind === "import"
        ? undefined
        : current,
    );
  const lock = () => {
    setVault(undefined);
    closeItemDialogs();
  };

  // The person's Lock: the key and the items go, from dialogs too, and work under way stops before
  // it saves or shows anything. A change refused afterwards can only be reported, not offered back
  // (Keep My Version would need the key).
  const lockNow = () => {
    locks.current += 1;
    if (pending.current) pending.current = { ...pending.current, vault: undefined };
    lock();
    setAsk((current) =>
      current?.kind === "conflict"
        ? {
            kind: "notice",
            text: `Another window or browser changed the “login” keychain first, so ${current.what} was not saved.`,
          }
        : current,
    );
  };

  // Another window of the page saved the keychain: open its envelope with this window's key, or
  // lock when it is not the same keychain any more. The envelope counts as taken in only once
  // its items are applied, so an interrupted decryption is tried again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: lock only sets state.
  useEffect(() => {
    if (!vault || envelope === known.current) return;
    if (!envelope || envelope.kdf.salt !== vault.kdf.salt) {
      known.current = envelope;
      lock();
      return;
    }
    let live = true;
    openWithKey(envelope, vault.key)
      .then((items) => {
        if (!live) return;
        known.current = envelope;
        setVault((current) => current && { ...current, items });
        // An open Info dialog follows the item, and closes when the item is gone.
        setAsk((current) => {
          if (current?.kind !== "inspect") return current;
          const item = items.find((entry) => entry.id === current.item.id);
          return item ? { kind: "inspect", item } : undefined;
        });
      })
      .catch(() => {
        if (!live) return;
        known.current = envelope;
        lock();
      });
    return () => {
      live = false;
    };
  }, [envelope, vault]);

  /** Refuses a change built on a keychain another window has replaced since. */
  const ensureCurrent = (base: VaultEnvelope | null) => {
    if (latest.current !== base || known.current !== base) {
      throw new Error("Another window changed the keychain. Try again.");
    }
  };

  const store = async (
    next: OpenVault,
    base: VaultEnvelope | null,
    what: string,
    stillOpen: () => void,
  ) => {
    const sealed = await sealVault(next);
    stillOpen();
    ensureCurrent(base);
    known.current = sealed;
    pending.current = { sealed, vault: next, what };
    setVault(next);
    setEnvelope(sealed);
    return sealed;
  };

  /** Waits until the server holds this envelope of “login”: its channel saves after a render. */
  const storedOnServer = async (sealed: VaultEnvelope) => {
    for (let tries = 0; tries < CONFIRM_TRIES; tries += 1) {
      const reply = await sessionFetch(KEYCHAIN_VAULT_URL, { credentials: "same-origin" });
      const body = (await reply.json().catch(() => null)) as {
        vault?: VaultEnvelope | null;
      } | null;
      if (body?.vault?.ciphertext === sealed.ciphertext) return;
      await new Promise((resolve) => setTimeout(resolve, CONFIRM_PAUSE_MS));
    }
    throw new Error(
      "The “login” keychain could not be saved, so the items stayed where they were.",
    );
  };

  const run = (work: (stillOpen: () => void) => Promise<void>) => {
    const lockedAt = locks.current;
    setBusy(true);
    setFailure(undefined);
    work(() => {
      if (locks.current !== lockedAt) throw new KeychainLockedError();
    })
      .catch((error: unknown) => {
        if (error instanceof KeychainLockedError) return;
        if (error instanceof WrongPasswordError) setWrong(true);
        else setFailure(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setBusy(false));
  };

  const create = (password: string) =>
    run(async () => {
      const base = latest.current;
      if (base) throw new Error("Another window made a keychain. Unlock it instead.");
      const made = await createVault(password, iterations);
      if (latest.current !== base) {
        throw new Error("Another window made a keychain. Unlock it instead.");
      }
      known.current = made.envelope;
      pending.current = { sealed: made.envelope, vault: made.vault, what: "your new keychain" };
      setVault(made.vault);
      setEnvelope(made.envelope);
      setAsk(undefined);
    });
  const unlock = (password: string, keychain?: string) =>
    run(async () => {
      setWrong(false);
      if (keychain) {
        await others.unlock(keychain, password);
        setAsk(undefined);
        return;
      }
      if (!envelope) return;
      const opened = await unlockVault(envelope, password);
      known.current = envelope;
      setVault(opened);
      setAsk(undefined);
    });
  const createKeychain = (name: string, password: string) =>
    run(async () => {
      const id = await others.create(name, password);
      changeLayout({ keychain: id });
      setAsk(undefined);
    });
  const addItem = (item: Omit<VaultItem, "id" | "keychain" | "modified">) =>
    run(async (stillOpen) => {
      if (other) {
        const held = others.open[other.id]?.items;
        if (!held) return;
        stillOpen();
        const [id = ""] = freshItemIds(other.id, held, 1);
        await others.writeItems(other.id, [
          ...held,
          { ...item, id, keychain: other.id, modified: localStamp(new Date()) },
        ]);
        setAsk(undefined);
        return;
      }
      if (!vault) return;
      const base = latest.current;
      ensureCurrent(base);
      const taken = new Set(vault.items.map((entry) => entry.id));
      let n = vault.items.length + 1;
      while (taken.has(`login-${n}`)) n += 1;
      const whole: VaultItem = {
        ...item,
        id: `login-${n}`,
        keychain: "login",
        modified: localStamp(new Date()),
      };
      await store(
        { ...vault, items: [...vault.items, whole] },
        base,
        `adding “${item.name}”`,
        stillOpen,
      );
      setAsk(undefined);
    });
  const add = (entry: { name: string; account: string; secret: string }) =>
    addItem({
      name: entry.name,
      kind: passwordKind(entry.name),
      account: entry.account || undefined,
      where: entry.name,
      secret: entry.secret,
    });
  const addNote = (entry: { name: string; secret: string }) =>
    addItem({ name: entry.name, kind: "secure note", secret: entry.secret });
  const exportItems = (chosen: readonly VaultItem[], password: string) =>
    run(async () => {
      const envelope = await sealItems(chosen, password, iterations);
      const file = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = "Keychain Items.json";
      link.click();
      URL.revokeObjectURL(link.href);
      setAsk(undefined);
    });
  /** Reads a chosen or dropped file, and asks for its password when it is one of the exports. */
  const chooseImport = (name: string, read: () => Promise<Blob>) =>
    run(async (stillOpen) => {
      let text: string | undefined;
      try {
        const file = await read();
        if (file.size <= MAX_IMPORT_BYTES) text = await file.text();
      } catch {
        setAsk({ kind: "notice", text: `“${name}” could not be read.` });
        return;
      }
      stillOpen();
      const file = text === undefined ? undefined : envelopeOfFile(text);
      setWrong(false);
      setAsk(
        file
          ? { kind: "import", name, envelope: file }
          : {
              kind: "notice",
              text: `“${name}” is not a file Keychain Access exported. This window opens only the encrypted files it exports: a web page cannot read Apple’s keychain format.`,
            },
      );
    });
  const importItems = (file: VaultEnvelope, name: string, password: string) =>
    run(async (stillOpen) => {
      if (!vault) return;
      const base = latest.current;
      ensureCurrent(base);
      setWrong(false);
      const opened = await unlockVault(file, password);
      stillOpen();
      const { items, added, skipped } = withImported(vault.items, opened.items);
      if (added > 0) {
        await store({ ...vault, items }, base, `importing “${name}”`, stillOpen);
      }
      setAsk({
        kind: "notice",
        text: `Imported ${added} ${added === 1 ? "item" : "items"}.${
          skipped > 0
            ? ` ${skipped} ${skipped === 1 ? "was" : "were"} already in the keychain.`
            : ""
        }`,
      });
    });
  const deleteKeychain = (keychain?: string) =>
    run(async () => {
      if (keychain) {
        await others.remove(keychain);
        setAsk(undefined);
        return;
      }
      const reply = await sessionFetch(KEYCHAIN_VAULT_URL, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!reply.ok) throw new Error(`The server refused to delete it (HTTP ${reply.status}).`);
      // Work under way stops, and the window locks as the saved keychain goes.
      locks.current += 1;
      pending.current = null;
      reloadServerDocuments("keychain-access");
      setAsk(undefined);
    });
  const changePassword = (current: string, next: string, keychain?: string) =>
    run(async (stillOpen) => {
      setWrong(false);
      if (keychain) {
        await others.changePassword(keychain, current, next);
        setAsk(undefined);
        return;
      }
      if (!vault) return;
      const base = latest.current;
      if (!base) return;
      ensureCurrent(base);
      await unlockVault(base, current);
      const { vault: made } = await createVault(next, vault.kdf.iterations);
      // A window holding the old key sees a new salt, and locks.
      await store({ ...made, items: vault.items }, base, "your new keychain password", stillOpen);
      setAsk(undefined);
    });
  const saveItem = (id: string, changes: ItemChanges) =>
    run(async (stillOpen) => {
      const holder = holderOf(id);
      const held = holder && others.open[holder]?.items;
      if (holder && held) {
        const current = held.find((entry) => entry.id === id);
        if (!current) throw new Error("The item is no longer in the keychain.");
        const saved: VaultItem = { ...current, ...changes, modified: localStamp(new Date()) };
        stillOpen();
        await others.writeItems(
          holder,
          held.map((entry) => (entry.id === id ? saved : entry)),
        );
        setAsk({ kind: "inspect", item: saved });
        return;
      }
      if (!vault) return;
      const base = latest.current;
      ensureCurrent(base);
      const current = vault.items.find((entry) => entry.id === id);
      if (!current) throw new Error("The item is no longer in the keychain.");
      const saved: VaultItem = { ...current, ...changes, modified: localStamp(new Date()) };
      await store(
        { ...vault, items: vault.items.map((entry) => (entry.id === id ? saved : entry)) },
        base,
        `your changes to “${saved.name}”`,
        stillOpen,
      );
      setAsk({ kind: "inspect", item: saved });
    });
  const remove = (ids: readonly string[], names: readonly string[]) =>
    run(async (stillOpen) => {
      const holder = ids[0] === undefined ? undefined : holderOf(ids[0]);
      const held = holder && others.open[holder]?.items;
      if (holder && held) {
        stillOpen();
        await others.writeItems(
          holder,
          held.filter((entry) => !ids.includes(entry.id)),
        );
        setAsk(undefined);
        return;
      }
      if (!vault) return;
      const base = latest.current;
      ensureCurrent(base);
      await store(
        { ...vault, items: vault.items.filter((entry) => !ids.includes(entry.id)) },
        base,
        names.length === 1 ? `deleting “${names[0]}”` : `deleting ${names.length} items`,
        stillOpen,
      );
      setAsk(undefined);
    });
  /**
   * Moves items into another keychain, both of them unlocked. Each is stored there first, and only
   * then taken from where it was, so that a failure or a crash between the two leaves it in both
   * rather than in neither.
   */
  const moveItems = (ids: readonly string[], to: string) =>
    run(async (stillOpen) => {
      const moving = fullItems.filter((entry) => ids.includes(entry.id));
      const from = moving[0]?.keychain;
      const toName = keychainList.find((entry) => entry.id === to)?.name ?? to;
      if (!from || from === to) return;
      if (to !== "login" && !others.list.some((entry) => entry.id === to)) {
        setAsk({ kind: "notice", text: `A web page cannot keep items in “${toName}”.` });
        return;
      }
      const held = to === "login" ? vault?.items : others.open[to]?.items;
      if (!held) {
        setAsk({
          kind: "notice",
          text: `Unlock “${toName}” first: items can move only into an open keychain.`,
        });
        return;
      }
      const fresh = freshItemIds(to, held, moving.length);
      const arriving = moving.map((entry, at) => ({
        ...entry,
        id: fresh[at] ?? entry.id,
        keychain: to,
      }));
      stillOpen();
      if (to === "login" && vault) {
        const base = latest.current;
        ensureCurrent(base);
        const sealed = await store(
          { ...vault, items: [...held, ...arriving] },
          base,
          `moving ${moving.length === 1 ? `“${moving[0]?.name}”` : `${moving.length} items`}`,
          stillOpen,
        );
        await storedOnServer(sealed);
      } else {
        await others.writeItems(to, [...held, ...arriving]);
      }
      stillOpen();
      const moved = new Set(moving.map((entry) => entry.id));
      if (from === "login" && vault) {
        const base = latest.current;
        ensureCurrent(base);
        await store(
          { ...vault, items: vault.items.filter((entry) => !moved.has(entry.id)) },
          base,
          "moving items out",
          stillOpen,
        );
      } else {
        const left = others.open[from]?.items ?? [];
        await others.writeItems(
          from,
          left.filter((entry) => !moved.has(entry.id)),
        );
      }
    });
  /**
   * Keep My Version: this window's keychain, as it was when its change was refused, sealed again
   * and saved over the one saved elsewhere, which every window then shows.
   */
  const keepMine = (mine: OpenVault, what: string) =>
    run(async (stillOpen) => {
      const base = latest.current;
      const sealed = await sealVault(mine);
      stillOpen();
      if (latest.current !== base) {
        throw new Error("Another window changed the keychain. Try again.");
      }
      known.current = sealed;
      pending.current = { sealed, vault: mine, what };
      setVault(mine);
      setEnvelope(sealed);
      setAsk(undefined);
    });

  // The table shows names, kinds and dates; no secret or comment is ever put in it.
  const fullItems = useMemo(
    () => [...(vault?.items ?? []), ...Object.values(others.open).flatMap((one) => one.items)],
    [vault, others.open],
  );
  const items = useMemo(
    () => fullItems.map(({ secret: _secret, comments: _comments, ...item }) => item),
    [fullItems],
  );
  const holderOf = (id: string) =>
    Object.entries(others.open).find(([, one]) => one.items.some((entry) => entry.id === id))?.[0];

  // The menus and the keys act on what is selected, read when one is chosen.
  const [selected, setSelected] = useState<readonly KeychainAccessItem[]>([]);
  const [layout, setLayout] = useDesktopSetting<KeychainAccessLayout>(
    LAYOUT_KEY,
    readLayout,
    NO_LAYOUT,
  );
  const changeLayout = (change: KeychainAccessLayout) => setLayout({ ...layout, ...change });
  const keychainList = useMemo<readonly KeychainAccessKeychain[]>(
    () => [
      ...KEYCHAINS.slice(0, 1),
      ...others.list.map(({ id, name }) => ({ id, name, icon: "unlocked" as const })),
      ...KEYCHAINS.slice(1),
    ],
    [others.list],
  );
  const chosenKeychain = layout.keychain ?? props.defaultKeychain ?? "login";
  const selectedKeychain = keychainList.some((entry) => entry.id === chosenKeychain)
    ? chosenKeychain
    : "login";
  const other = others.list.find((entry) => entry.id === selectedKeychain);
  const otherOpen = other ? others.open[other.id] : undefined;
  const targetName = other?.name ?? "login";
  const shownLayout = useMemo(
    () => ({ ...layout, keychain: selectedKeychain }),
    [layout, selectedKeychain],
  );
  const lockedKeychains = useMemo(
    () =>
      new Set(
        keychainList
          .filter((entry) =>
            entry.id === "login"
              ? !vault
              : others.list.some((one) => one.id === entry.id) && !others.open[entry.id],
          )
          .map((entry) => entry.id),
      ),
    [keychainList, others.list, others.open, vault],
  );
  const [settings, setSettings] = useDesktopSetting<KeychainSettings>(
    SETTINGS_KEY,
    readSettings,
    NO_SETTINGS,
  );
  const importInput = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<() => void>(null);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const launch = use(DesktopWindowHostContext)?.launch;
  const one = selected.length === 1 ? selected[0] : undefined;
  // Whether the search field or the table had the keyboard last: a menu takes it while it is open.
  const lastInSearch = useRef(false);
  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const target = event.target as Element;
      if (target === searchRef.current) lastInSearch.current = true;
      else if (target.closest?.("[role='grid']")) lastInSearch.current = false;
    };
    window.addEventListener("focusin", onFocus);
    return () => window.removeEventListener("focusin", onFocus);
  }, []);
  // Runs once the menu that asked for it has let go of the keyboard.
  const inSearch = (work: (field: HTMLInputElement) => void) =>
    setTimeout(() => {
      const field = searchRef.current;
      if (!field) return;
      field.focus();
      work(field);
    }, AFTER_MENU_MS);
  const newItem = (kind: "add" | "add-note" = "add") => {
    if (unreadable) return;
    setWrong(false);
    if (other) {
      setAsk(otherOpen ? { kind } : { kind: "unlock", keychain: other.id });
      return;
    }
    setAsk({ kind: vault ? kind : envelope ? "unlock" : "create" });
  };
  const makeCommands = () => ({
    newItem,
    copy: () => {
      const field = searchRef.current;
      if (!lastInSearch.current) commands.current.copyNames();
      else if (field) {
        const chosen = field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
        if (chosen) void copyText(chosen);
      }
    },
    copyNames: () => {
      const names = selected.map((item) => item.name).join("\n");
      if (names) void copyText(names);
    },
    cut: () => {
      if (!lastInSearch.current) return;
      inSearch((field) => {
        const start = field.selectionStart ?? 0;
        const end = field.selectionEnd ?? 0;
        const chosen = field.value.slice(start, end);
        if (!chosen) return;
        // The words go only once they are on the clipboard, and only if the field still holds them.
        void copyText(chosen).then((copied) => {
          if (!copied || field.value.slice(start, end) !== chosen) return;
          field.focus();
          field.setSelectionRange(start, end);
          document.execCommand("delete");
        });
      });
    },
    paste: () => {
      if (!lastInSearch.current) return;
      void navigator.clipboard
        ?.readText()
        .then((text) => inSearch(() => document.execCommand("insertText", false, text)))
        .catch(() => {});
    },
    inspect: () => {
      const full = one && fullItems.find((entry) => entry.id === one.id);
      if (full) setAsk({ kind: "inspect", item: full });
    },
    copyPassword: () => {
      const full = one && fullItems.find((entry) => entry.id === one.id);
      if (!full) return;
      void copyText(full.secret).then((copied) => {
        if (!copied) setAsk({ kind: "notice", text: "The browser refused to use the clipboard." });
      });
    },
    askDelete: (items: readonly KeychainAccessItem[] = selected) => {
      if (items.length === 0) return;
      setAsk({
        kind: "delete",
        ids: items.map((item) => item.id),
        names: items.map((item) => item.name),
      });
    },
    askExport: () => {
      const chosen = fullItems.filter((entry) => selected.some((one) => one.id === entry.id));
      if (chosen.length > 0) setAsk({ kind: "export", items: chosen });
    },
    askChangePassword: () => {
      setWrong(false);
      setAsk({ kind: "change-password", keychain: other?.id });
    },
    askNewKeychain: () => {
      if (others.list.length < MAX_KEYCHAINS) setAsk({ kind: "new-keychain" });
    },
    toggleLock: () => {
      if (other) {
        if (otherOpen) {
          locks.current += 1;
          others.lock(other.id);
          closeItemDialogs();
        } else {
          setWrong(false);
          setAsk({ kind: "unlock", keychain: other.id });
        }
      } else if (vault) lockNow();
      else {
        setWrong(false);
        setAsk({ kind: envelope ? "unlock" : "create" });
      }
    },
    find: () => {
      searchRef.current?.focus();
      searchRef.current?.select();
    },
    changeLayout,
    lockAll: () => {
      if (vault) lockNow();
      if (Object.keys(others.open).length > 0) {
        locks.current += 1;
        others.lockAll();
        closeItemDialogs();
      }
    },
    chooseImportFile: () => importInput.current?.click(),
    askSettings: () => setAsk({ kind: "settings" }),
    askDeleteKeychain: () => setAsk({ kind: "delete-keychain", keychain: other?.id }),
    selectAll: () => {
      if (lastInSearch.current) inSearch((field) => field.select());
      else selectAllRef.current?.();
    },
    asking: ask !== undefined,
  });
  const commands = useRef(makeCommands());
  commands.current = makeCommands();
  const isKey = windowState === "key";
  useEffect(() => {
    if (!isKey) return;
    const whenFree = (command: () => void) => () => {
      if (!commands.current.asking) command();
    };
    return onMenuKeyEquivalents(window, {
      "command+n": whenFree(() => commands.current.newItem()),
      "shift+command+n": whenFree(() => commands.current.newItem("add-note")),
      "option+command+n": whenFree(() => commands.current.askNewKeychain()),
      "command+i": whenFree(() => commands.current.inspect()),
      "command+l": whenFree(() => commands.current.toggleLock()),
      "control+command+l": whenFree(() => commands.current.lockAll()),
      "shift+command+c": whenFree(() => commands.current.copyPassword()),
      "shift+command+e": whenFree(() => commands.current.askExport()),
      "shift+command+i": whenFree(() => commands.current.chooseImportFile()),
      "option+command+f": whenFree(() => commands.current.find()),
    });
  }, [isKey]);
  // Select All takes the key only where it would not select a field's text.
  useEffect(() => {
    if (!isKey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isField(event.target) || commands.current.asking) return;
      if (matchesMenuKeyEquivalent(event, "command+c")) {
        if (document.getSelection()?.toString()) return;
        event.preventDefault();
        commands.current.copyNames();
        return;
      }
      if (!matchesMenuKeyEquivalent(event, "command+a")) return;
      event.preventDefault();
      selectAllRef.current?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isKey]);
  const loginUnlocked = vault !== undefined;
  const unlocked = other ? otherOpen !== undefined : loginUnlocked;
  // Whether this window holds any key: what the menu bar's menu and the lock's timers follow.
  const anyOpen = loginUnlocked || Object.keys(others.open).length > 0;
  // The menu bar's keychain menu follows this window, which alone holds the key.
  useEffect(() => {
    if (!anyOpen) return;
    reportKeychainUnlocked({ lock: () => commands.current.lockAll() });
    return () => reportKeychainUnlocked(null);
  }, [anyOpen]);
  const canForget = other !== undefined || envelope !== null || unreadable;
  const { lockAfterMinutes, lockWhenHidden } = settings;
  // Lock after a set time. A click or key restarts the wait, and one that comes after the wait has
  // passed locks instead: a machine that slept holds its timers back.
  useEffect(() => {
    if (!anyOpen || lockAfterMinutes === undefined) return;
    const wait = lockAfterMinutes * 60_000;
    let last = Date.now();
    let timer = setTimeout(() => commands.current.lockAll(), wait);
    const active = () => {
      clearTimeout(timer);
      if (Date.now() - last >= wait) {
        commands.current.lockAll();
        return;
      }
      last = Date.now();
      timer = setTimeout(() => commands.current.lockAll(), wait);
    };
    window.addEventListener("pointerdown", active, true);
    window.addEventListener("keydown", active, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", active, true);
      window.removeEventListener("keydown", active, true);
    };
  }, [anyOpen, lockAfterMinutes]);
  useEffect(() => {
    if (!anyOpen || !lockWhenHidden) return;
    const onChange = () => {
      if (document.hidden) commands.current.lockAll();
    };
    // Unlocking may finish, or the setting be turned on, while the tab is already hidden.
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [anyOpen, lockWhenHidden]);
  const dropRef = useDesktopDrop<HTMLDivElement>({
    accepts: (item) =>
      loginUnlocked &&
      item.kind === "file" &&
      item.type !== KEYCHAIN_ITEM_DRAG &&
      /\.json$/i.test(item.name),
    refusal: () =>
      loginUnlocked
        ? "Keychain Access imports only the encrypted files it exports."
        : "Unlock the “login” keychain to import items.",
    sayRefusal: (text) => setAsk({ kind: "notice", text }),
    onDrop: ([file]) => {
      if (file) chooseImport(file.name, () => readFile(file.id));
    },
  });
  const canInspect = unlocked && one !== undefined;
  const canDelete = unlocked && selected.length > 0;
  const fileMenu = useMemo(
    () => (
      <>
        <MenuItem keyEquivalent="command+n" onClick={() => commands.current.newItem()}>
          New Password Item…
        </MenuItem>
        <MenuItem
          keyEquivalent="shift+command+n"
          onClick={() => commands.current.newItem("add-note")}
        >
          New Secure Note Item…
        </MenuItem>
        <MenuItem
          disabled={others.list.length >= MAX_KEYCHAINS}
          keyEquivalent="option+command+n"
          title={
            others.list.length >= MAX_KEYCHAINS
              ? `This desktop keeps at most ${MAX_KEYCHAINS} keychains beside “login”.`
              : undefined
          }
          onClick={() => commands.current.askNewKeychain()}
        >
          New Keychain…
        </MenuItem>
        <MenuItem disabled title={ONLY_LOGIN} data-reason={ONLY_LOGIN}>
          New Certificate Preference…
        </MenuItem>
        <MenuItem disabled title={ONLY_LOGIN} data-reason={ONLY_LOGIN}>
          New Identity Preference…
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="shift+command+i"
          disabled={!loginUnlocked}
          onClick={() => commands.current.chooseImportFile()}
        >
          Import Items…
        </MenuItem>
        <MenuItem
          keyEquivalent="shift+command+e"
          disabled={!canDelete}
          onClick={() => commands.current.askExport()}
        >
          Export Items…
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled
          keyEquivalent="shift+command+a"
          title={ONLY_LOGIN}
          data-reason={ONLY_LOGIN}
        >
          Add Keychain…
        </MenuItem>
        <MenuItem disabled={!canForget} onClick={() => commands.current.askDeleteKeychain()}>
          {`Delete Keychain “${targetName}”…`}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+i"
          disabled={!canInspect}
          onClick={() => commands.current.inspect()}
        >
          Get Info
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+l" onClick={() => commands.current.toggleLock()}>
          {unlocked ? `Lock Keychain “${targetName}”` : `Unlock Keychain “${targetName}”`}
        </MenuItem>
        <MenuItem
          keyEquivalent="control+command+l"
          disabled={!anyOpen}
          onClick={() => commands.current.lockAll()}
        >
          Lock All Keychains
        </MenuItem>
        <MenuItem disabled title={ONLY_LOGIN} data-reason={ONLY_LOGIN}>
          {`Make Keychain “${targetName}” Default`}
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled title={ONLY_LOGIN} data-reason={ONLY_LOGIN}>
          Certificate Assistant
        </MenuItem>
        <MenuItem disabled title={ONLY_LOGIN} data-reason={ONLY_LOGIN}>
          Ticket Viewer
        </MenuItem>
        <MenuSeparator />
      </>
    ),
    [canInspect, canDelete, canForget, unlocked, anyOpen, loginUnlocked, targetName, others.list],
  );
  useDesktopAppMenu("keychain-access", "File", fileMenu, titleBar);
  const editMenu = useMemo(
    () => (
      <>
        <MenuItem disabled keyEquivalent="command+z" title={NO_UNDO} data-reason={NO_UNDO}>
          Undo
        </MenuItem>
        <MenuItem disabled keyEquivalent="shift+command+z" title={NO_UNDO} data-reason={NO_UNDO}>
          Redo
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+x" onClick={() => commands.current.cut()}>
          Cut
        </MenuItem>
        <MenuItem keyEquivalent="command+c" onClick={() => commands.current.copy()}>
          Copy
        </MenuItem>
        <MenuItem keyEquivalent="command+v" onClick={() => commands.current.paste()}>
          Paste
        </MenuItem>
        <MenuItem disabled={!canDelete} onClick={() => commands.current.askDelete()}>
          Delete
        </MenuItem>
        <MenuItem
          keyEquivalent="command+a"
          disabled={!unlocked}
          onClick={() => commands.current.selectAll()}
        >
          Select All
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="shift+command+c"
          disabled={!canInspect}
          onClick={() => commands.current.copyPassword()}
        >
          Copy Password to Clipboard
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="option+command+f"
          onClick={() => {
            setTimeout(() => commands.current.find(), AFTER_MENU_MS);
          }}
        >
          Find
        </MenuItem>
        <MenuSeparator />
        <MenuItem disabled={!unlocked} onClick={() => commands.current.askChangePassword()}>
          {`Change Password for Keychain “${targetName}”…`}
        </MenuItem>
        <MenuItem onClick={() => commands.current.askSettings()}>
          {`Change Settings for Keychain “${targetName}”…`}
        </MenuItem>
      </>
    ),
    [canInspect, canDelete, unlocked, targetName],
  );
  useDesktopAppMenu("keychain-access", "Edit", editMenu, titleBar);
  const sourcesHidden = layout.sourcesHidden === true;
  const statusHidden = layout.statusHidden === true;
  const viewMenu = useMemo(
    () => (
      <>
        <MenuItem onClick={() => commands.current.changeLayout({ sourcesHidden: !sourcesHidden })}>
          {sourcesHidden ? "Show Keychains" : "Hide Keychains"}
        </MenuItem>
        <MenuItem onClick={() => commands.current.changeLayout({ statusHidden: !statusHidden })}>
          {statusHidden ? "Show Status Bar" : "Hide Status Bar"}
        </MenuItem>
        <MenuSeparator />
      </>
    ),
    [sourcesHidden, statusHidden],
  );
  useDesktopAppMenu("keychain-access", "View", viewMenu, titleBar);
  const helpMenu = useMemo(
    () =>
      launch ? (
        <MenuItem onClick={() => requestHelp("Keychain Access")}>Keychain Access Help</MenuItem>
      ) : null,
    [launch],
  );
  useDesktopAppMenu("keychain-access", "Help", helpMenu, titleBar);

  const askedName =
    ask && "keychain" in ask && ask.keychain
      ? others.list.find((entry) => entry.id === ask.keychain)?.name
      : undefined;
  const title =
    ask?.kind === "inspect"
      ? ask.item.name
      : ask
        ? dialogTitles(askedName ?? (ask.kind === "delete" ? targetName : "login"))[ask.kind]
        : "";
  const moveTargets = keychainList.filter(
    (entry) =>
      entry.id !== selectedKeychain &&
      (entry.id === "login" || others.list.some((one) => one.id === entry.id)),
  );
  return (
    <>
      <KeychainAccess
        {...props}
        state={windowState}
        searchRef={searchRef}
        titleBarRef={setTitleBar}
        bodyRef={dropRef}
        selectAllRef={selectAllRef}
        keychainMenu={(keychain) => {
          const login =
            keychain.id === "login" || others.list.some((entry) => entry.id === keychain.id);
          return (
            <>
              <MenuItem disabled={!login} onClick={() => commands.current.toggleLock()}>
                {`${unlocked ? "Lock" : "Unlock"} Keychain “${keychain.name}”`}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                disabled={!login || !unlocked}
                onClick={() => commands.current.askChangePassword()}
              >
                {`Change Password for Keychain “${keychain.name}”…`}
              </MenuItem>
              <MenuItem disabled={!login} onClick={() => commands.current.askSettings()}>
                {`Change Settings for Keychain “${keychain.name}”…`}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                disabled={!login || !canForget}
                onClick={() => commands.current.askDeleteKeychain()}
              >
                {`Delete Keychain “${keychain.name}”…`}
              </MenuItem>
            </>
          );
        }}
        layout={shownLayout}
        keychains={keychainList}
        lockedKeychains={lockedKeychains}
        onMoveItems={moveItems}
        onLayoutChange={changeLayout}
        statusText={statusLine}
        locked={!unlocked}
        onToggleLock={unreadable ? undefined : () => commands.current.toggleLock()}
        onSelectionChange={setSelected}
        onDeleteItems={(chosen) => commands.current.askDelete(chosen)}
        itemMenu={
          <>
            <MenuItem disabled={!canDelete} onClick={() => commands.current.copyNames()}>
              Copy
            </MenuItem>
            <MenuItem disabled={!canInspect} onClick={() => commands.current.copyPassword()}>
              Copy Password to Clipboard
            </MenuItem>
            <MenuItem disabled={!canInspect} onClick={() => commands.current.inspect()}>
              Get Info
            </MenuItem>
            <MenuItem disabled={!canDelete} onClick={() => commands.current.askExport()}>
              Export Items…
            </MenuItem>
            <MenuSeparator />
            <Submenu>
              <SubmenuTrigger disabled={!canDelete || moveTargets.length === 0}>
                Move to Keychain
              </SubmenuTrigger>
              <SubmenuPopup>
                {moveTargets.map((entry) => (
                  <MenuItem
                    key={entry.id}
                    onClick={() =>
                      moveItems(
                        selected.map((item) => item.id),
                        entry.id,
                      )
                    }
                  >
                    {entry.name}
                  </MenuItem>
                ))}
              </SubmenuPopup>
            </Submenu>
            <MenuSeparator />
            <MenuItem disabled={!canDelete} onClick={() => commands.current.askDelete()}>
              {selected.length > 1 ? `Delete ${selected.length} Items` : "Delete"}
            </MenuItem>
          </>
        }
        items={items}
        today={today()}
        inert={loading || undefined}
        aria-busy={loading || undefined}
        data-keychain-state={unlocked ? "unlocked" : envelope || other ? "locked" : "none"}
        onAdd={(keychain) => {
          onAdd?.(keychain);
          newItem();
        }}
        onInspect={(item) => {
          onInspect?.(item);
          const full = fullItems.find((entry) => entry.id === item.id);
          if (full) setAsk({ kind: "inspect", item: full });
        }}
      />
      <input
        ref={importInput}
        type="file"
        accept=".json,application/json"
        aria-label="Choose a file to import"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) chooseImport(file.name, async () => file);
        }}
      />
      <Dialog
        // Asked as the window opens, also when a reload restores it: the rest of the desktop stays usable.
        modal={ask?.kind !== "unlock" && ask?.kind !== "create"}
        open={ask !== undefined}
        onOpenChange={(open) => {
          if (!open) setAsk(undefined);
        }}
      >
        <DialogPopup title={title} width={420}>
          {ask?.kind === "create" ? <CreateForm onCreate={create} busy={busy} /> : null}
          {ask?.kind === "new-keychain" ? (
            <NewKeychainForm
              taken={["login", ...others.list.map((entry) => entry.name)]}
              onCreate={createKeychain}
              busy={busy}
            />
          ) : null}
          {ask?.kind === "unlock" ? (
            <UnlockForm
              name={askedName}
              onUnlock={(password) => unlock(password, ask.keychain)}
              busy={busy}
              wrong={wrong}
            />
          ) : null}
          {ask?.kind === "add" ? <AddForm onAdd={add} busy={busy} /> : null}
          {ask?.kind === "add-note" ? <NoteForm onAdd={addNote} busy={busy} /> : null}
          {ask?.kind === "change-password" ? (
            <ChangePasswordForm
              onChange={(current, next) => changePassword(current, next, ask.keychain)}
              busy={busy}
              wrong={wrong}
            />
          ) : null}
          {ask?.kind === "inspect" ? (
            <InspectForm
              key={`${ask.item.id} ${ask.item.modified}`}
              item={ask.item}
              busy={busy}
              onDelete={() => commands.current.askDelete([ask.item])}
              onSave={(changes) => saveItem(ask.item.id, changes)}
            />
          ) : null}
          {ask?.kind === "export" ? (
            <ExportForm
              count={ask.items.length}
              busy={busy}
              onExport={(password) => exportItems(ask.items, password)}
            />
          ) : null}
          {ask?.kind === "import" ? (
            <ImportForm
              name={ask.name}
              busy={busy}
              wrong={wrong}
              onImport={(password) => importItems(ask.envelope, ask.name, password)}
            />
          ) : null}
          {ask?.kind === "settings" ? (
            <SettingsForm
              settings={settings}
              onSave={(next) => {
                setSettings(next);
                setAsk(undefined);
              }}
            />
          ) : null}
          {ask?.kind === "delete-keychain" ? (
            <DeleteKeychainForm
              name={askedName}
              count={ask.keychain ? others.open[ask.keychain]?.items.length : vault?.items.length}
              busy={busy}
              onDelete={() => deleteKeychain(ask.keychain)}
            />
          ) : null}
          {ask?.kind === "delete" ? (
            <DeleteForm names={ask.names} busy={busy} onDelete={() => remove(ask.ids, ask.names)} />
          ) : null}
          {ask?.kind === "notice" ? (
            <>
              <Label render={<p />}>{ask.text}</Label>
              <DialogActions>
                <DialogClose render={<DefaultButton />}>OK</DialogClose>
              </DialogActions>
            </>
          ) : null}
          {ask?.kind === "conflict" ? (
            <ConflictForm
              what={ask.what}
              busy={busy}
              onKeepMine={() => keepMine(ask.mine, ask.what)}
            />
          ) : null}
          {failure ? (
            <Label textStyle="small" role="alert" render={<p />}>
              {failure}
            </Label>
          ) : null}
        </DialogPopup>
      </Dialog>
    </>
  );
}

/**
 * Keychain Access as the desktop shows it. When the `macalicious-desktop` Ferrite application
 * serves the desktop, the window holds the person's own “login” keychain: it asks for a keychain
 * password, encrypts the items in the browser (WebCrypto: PBKDF2 and AES-GCM) and keeps only the
 * encrypted keychain on the server. “+” adds a password item and the File menu a secure note; Info
 * edits an item, its comments and its password on request; the menus and a row's contextual menu copy a password and delete items,
 * after asking. Every other build shows the invented keychains, as `KeychainAccess` does.
 */
export function DesktopKeychainAccess(props: KeychainAccessProps) {
  return servedByDesktopApp() ? <ServedKeychainAccess {...props} /> : <KeychainAccess {...props} />;
}
