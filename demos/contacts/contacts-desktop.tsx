"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PullDownButton } from "macalicious/pull-down-button";
import { PushButton } from "macalicious/push-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  type SheetPopupProps,
  SheetTitle,
} from "macalicious/sheet";
import { SystemImage } from "macalicious/system-image";
import { TextField } from "macalicious/text-field";
import {
  type ChangeEvent,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { type DriveEntry, readFile } from "../desktop/desktop-files";
import { useDesktopValue } from "../desktop/desktop-personal";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { shareFiles } from "../desktop/desktop-share-link";
import {
  DriveOpenPanel,
  DriveSavePanel,
  type DriveSaveTarget,
  saveToDrive,
} from "../finder/finder-file-dialogs";
import { onOpenFileRequest, takeOpenFileRequests } from "../finder/finder-open";
import { type ContactsArchive, isArchiveName, readArchive } from "./contacts-archive";
import {
  type Contact,
  conditionsOf,
  type DesktopAccount,
  SMART_FIELDS,
  type SmartCondition,
  type SmartField,
  type SmartGroup,
  type SmartTest,
  testsOf,
  withoutPrivateFields,
} from "./contacts-data";
import { isVCardFile } from "./contacts-drag";
import { isPictureFile, pictureFromBlob } from "./contacts-picture";
import {
  CONTACTS_PRIVATE_ME,
  CONTACTS_VCARD_ENCODING,
  CONTACTS_VCARD_FORMAT,
  CONTACTS_VCARD_NOTES,
  CONTACTS_VCARD_PHOTOS,
  readBooleanSetting,
  readVCardEncoding,
  readVCardFormat,
} from "./contacts-print";
import {
  ContactsServerError,
  fetchDesktopAccount,
  loadPictures,
  lookupDesktopUser,
  type StoredPicture,
} from "./contacts-server";
import {
  cardsToVCard,
  type ImportedCard,
  parseVCards,
  VCARD_TYPE,
  vCardFileName,
} from "./contacts-vcard";

/*
 * What Contacts does only on the desktop served by the `macalicious-desktop` Ferrite
 * application (`servedByDesktopApp()`): My Card from the signed-in account, cards for the
 * desktop's other people, vCard files from and to the computer and the person's drive, pictures,
 * and smart groups. Nothing here is rendered by the documentation's demo, its examples or the
 * visual comparisons. Every control is the library's; the sheets hang from the window's top edge,
 * as Contacts has no title bar, and the drive's Open panel stands over the page, as TextEdit's.
 */

/** What a notice says: the message and the line under it. */
export interface ContactsNotice {
  message: string;
  detail?: string;
}

/** The signed-in account, asked once when the window opens; `settled` once it has answered. */
export function useDesktopAccount(enabled: boolean): {
  account: DesktopAccount | null;
  settled: boolean;
} {
  const [state, setState] = useState<{ account: DesktopAccount | null; settled: boolean }>({
    account: null,
    settled: false,
  });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void fetchDesktopAccount().then((account) => {
      if (live) setState({ account, settled: true });
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return enabled ? state : { account: null, settled: true };
}

/**
 * The cards' pictures, loaded as the cards that name one are shown: `urlOf` gives a card's
 * picture once its version has loaded, `put` takes a picture just saved, and `load` reads the
 * pictures of `cards` (for an export), from what is loaded or from the server.
 */
export function useCardPictures(enabled: boolean, contacts: readonly Contact[]) {
  const [shown, setShown] = useState<ReadonlyMap<string, StoredPicture>>(() => new Map());
  // The card and version pairs asked for already: each is asked once.
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (!enabled) return;
    const wanted = contacts.filter(
      (card) =>
        card.image !== undefined &&
        shown.get(card.id)?.version !== card.image &&
        !asked.current.has(`${card.id}\u0000${card.image}`),
    );
    if (wanted.length === 0) return;
    for (const card of wanted) asked.current.add(`${card.id}\u0000${card.image}`);
    void loadPictures(wanted.map((card) => card.id)).then(
      (found) =>
        setShown((now) => {
          const next = new Map(now);
          for (const [id, picture] of Object.entries(found)) next.set(id, picture);
          return next;
        }),
      // A picture that cannot be read leaves the monogram.
      () => {},
    );
  }, [enabled, contacts, shown]);
  const urlOf = useCallback(
    (contact: Contact | null): string | undefined => {
      if (!contact?.image) return undefined;
      const picture = shown.get(contact.id);
      return picture?.version === contact.image ? picture.image : undefined;
    },
    [shown],
  );
  const put = useCallback((id: string, picture: StoredPicture) => {
    setShown((now) => new Map(now).set(id, picture));
  }, []);
  return { urlOf, put };
}

/** The vCard files of a file list, or a drop: by type or by name. */
export const vCardFiles = (files: Iterable<File>): File[] => [...files].filter(isVCardFile);

/** The cards of vCard files, read in the browser. */
export async function readVCardFiles(files: readonly Blob[]): Promise<ImportedCard[]> {
  const cards: ImportedCard[] = [];
  for (const file of files) cards.push(...parseVCards(await file.text()));
  return cards;
}

/** What the person is told of a `PHOTO` that a card cannot keep: `parseVCards` reads JPEG and PNG. */
export const PICTURES_NOT_IMPORTED = "Pictures that are not JPEG or PNG were left out.";

/**
 * Add the cards of a vCard file through `add`, which resolves with the number it added (a
 * desktop user already in Contacts is not added twice), and tell the person what happened.
 */
export async function importWithNotice(
  cards: readonly ImportedCard[],
  from: string,
  add: (cards: readonly ImportedCard[]) => Promise<number>,
  notify: (notice: ContactsNotice) => void,
): Promise<void> {
  if (cards.length === 0) {
    notify({ message: `No cards were found in “${from}”.` });
    return;
  }
  try {
    const added = await add(cards);
    const details = [
      added < cards.length
        ? `${cards.length - added} of the cards in “${from}” were already in Contacts.`
        : "",
      cards.some((each) => each.hadPhoto && !each.photo) ? PICTURES_NOT_IMPORTED : "",
    ].filter(Boolean);
    notify({
      message: added === 1 ? "1 card was imported." : `${added} cards were imported.`,
      detail: details.length > 0 ? details.join(" ") : undefined,
    });
  } catch (error) {
    notify({ message: "The cards could not be imported.", detail: sentence(error, "") });
  }
}

/** What a refusal of the server says to the person. */
function sentence(error: unknown, fallback: string): string {
  if (error instanceof ContactsServerError) {
    return error.status === 0 ? "The desktop could not be reached. Try again." : error.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Hand `text` to the browser as a download named `name`. */
export function download(text: string, name: string, type = VCARD_TYPE) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // The browser has taken the address well before then.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Writes cards as vCard text, with their notes and pictures as Preferences > vCard says. A picture
 * that cannot be read leaves its card without one, and the person is told.
 */
export function useVCardWriter(onNotice: (notice: ContactsNotice) => void) {
  const notes = useDesktopValue(CONTACTS_VCARD_NOTES, readBooleanSetting, true);
  const photos = useDesktopValue(CONTACTS_VCARD_PHOTOS, readBooleanSetting, true);
  const format = useDesktopValue(CONTACTS_VCARD_FORMAT, readVCardFormat, "3.0");
  const encoding = useDesktopValue(CONTACTS_VCARD_ENCODING, readVCardEncoding, "utf-8");
  const privateMe = useDesktopValue(CONTACTS_PRIVATE_ME, readBooleanSetting, false);
  return async (cards: readonly Contact[]): Promise<string> => {
    const framed = cards.filter((card) => card.image);
    let pictures: Record<string, StoredPicture> = {};
    if (photos && servedByDesktopApp() && framed.length > 0) {
      try {
        pictures = await loadPictures(framed.map(({ id }) => id));
      } catch {
        onNotice({ message: "The pictures could not be read, so they were left out." });
      }
    }
    return cardsToVCard(
      cards.map((contact) => {
        const shared = privateMe ? withoutPrivateFields(contact) : contact;
        return {
          contact: notes ? shared : { ...shared, note: undefined },
          photo: pictures[contact.id]?.image,
        };
      }),
      format,
      encoding,
    );
  };
}

/** The application each row of a Share menu sends a card to. */
export const SHARE_APPS: Readonly<Record<string, string>> = {
  Mail: "mail",
  Messages: "messages",
  Notes: "notes",
};

/**
 * Share a card with an application, as a `.vcf` file that is on no drive: what takes it keeps a
 * copy. Whether the application took it.
 */
export function shareCard(
  app: string,
  contact: Contact,
  write: (cards: readonly Contact[]) => Promise<string>,
): boolean {
  const shared = shareFiles(
    app,
    [
      {
        id: `vcard-${contact.id}`,
        name: vCardFileName([contact]),
        kind: "file",
        type: VCARD_TYPE,
        bytes: async () => new Blob([await write([contact])], { type: VCARD_TYPE }),
      },
    ],
    "contacts",
  );
  return shared !== null;
}

/** The page's body once mounted: where the drive's Open panel stands. */
function useHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host;
}

/** The drive's Open panel, over the page. */
function DriveOpenLayer({
  accept,
  defaultFolder,
  onOpen,
  onCancel,
}: {
  accept: (entry: DriveEntry) => boolean;
  defaultFolder: string;
  onOpen: (entry: DriveEntry) => void;
  onCancel: () => void;
}) {
  const host = useHost();
  if (!host) return null;
  return createPortal(
    <div className="mac-contacts-panel-layer">
      <DriveOpenPanel
        accept={accept}
        defaultFolder={defaultFolder}
        onOpen={onOpen}
        onCancel={onCancel}
      />
    </div>,
    host,
  );
}

export interface ContactsCommandsProps {
  /** Every card of the window, for Export All and Save All. */
  contacts: readonly Contact[];
  /** The card shown, for Export Card and Save Card; `null` when none is. */
  current: Contact | null;
  /** The names selected together, when there are several: Export and Save take them. */
  selectedCards: readonly Contact[];
  /** The signed-in account, whose own name is not added as a desktop user. */
  account: DesktopAccount | null;
  /** The smart group shown, which the menu offers to delete; `null` for an account's group. */
  smartGroup: SmartGroup | null;
  /** Invites the person of the card shown to a game of Chess, or `null` when no account is on it. */
  onInviteToChess: (() => void) | null;
  /** What the sheets hang from: the window's top edge. */
  anchor: SheetPopupProps["anchor"];
  /** Called with the account Add Desktop User found: the window adds its card, or shows it. */
  onAddUser: (user: { name: string; fullName: string }) => void;
  /** Called with the cards of a vCard file; resolves with the number of cards added. */
  onImport: (cards: readonly ImportedCard[]) => Promise<number>;
  /** Called with an archive chosen in File > Import, and the name of its file. */
  onArchive: (archive: ContactsArchive, from: string) => void;
  /** Called with a new smart group's name and rule. */
  onAddSmartGroup: (group: Omit<SmartGroup, "id">) => void;
  /** Called to delete the smart group shown. */
  onDeleteSmartGroup: (id: string) => void;
  /** Called with what a smart group is to be, once edited. */
  onChangeSmartGroup: (id: string, group: Omit<SmartGroup, "id">) => void;
  /** Called with what the person is to be told: an import's result, a failure. */
  onNotice: (notice: ContactsNotice) => void;
  /** Whether the window's cards have loaded: a file opened from Finder waits for them. */
  ready: boolean;
  /** What the menu bar's File menu asks of these commands. */
  handle?: Ref<ContactsCommandsHandle>;
}

/** What the menu bar asks of the commands pull-down. */
export interface ContactsCommandsHandle {
  newSmartGroup: () => void;
  editSmartGroup: (group: SmartGroup) => void;
  importFile: () => void;
  exportShown: () => void;
  exportAll: () => void;
}

/**
 * The commands Contacts has on the desktop, in a pull-down button with the `action` image in
 * the card's bar: Add Desktop User…, New Smart Group… and Delete Smart Group, Import vCard…
 * from the computer or the drive, and the shown card or every card as a vCard, downloaded or
 * saved to the drive.
 */
export function ContactsCommands({
  contacts,
  current,
  selectedCards,
  account,
  smartGroup,
  anchor,
  onAddUser,
  onImport,
  onArchive,
  onAddSmartGroup,
  onDeleteSmartGroup,
  onChangeSmartGroup,
  onNotice,
  ready,
  handle,
  onInviteToChess,
}: ContactsCommandsProps) {
  const [sheet, setSheet] = useState<"user" | "group" | null>(null);
  const [editingGroup, setEditingGroup] = useState<SmartGroup | null>(null);
  const [saving, setSaving] = useState<readonly Contact[] | null>(null);
  const [opening, setOpening] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const shownCards = selectedCards.length > 1 ? selectedCards : current ? [current] : [];

  const importCards = (cards: readonly ImportedCard[], from: string) =>
    importWithNotice(cards, from, onImport, onNotice);

  const chosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const chosenFiles = [...(input.files ?? [])];
    const files = vCardFiles(chosenFiles);
    const archives = chosenFiles.filter((file) => isArchiveName(file.name));
    const names = chosenFiles.map((file) => file.name).join(", ");
    input.value = "";
    const [archiveFile] = archives;
    if (archiveFile) {
      const archive = readArchive(await archiveFile.text());
      if (archive) onArchive(archive, archiveFile.name);
      else onNotice({ message: `“${archiveFile.name}” is not a Contacts archive.` });
      return;
    }
    if (files.length === 0) {
      if (names) onNotice({ message: `“${names}” is not a vCard file.` });
      return;
    }
    await importCards(await readVCardFiles(files), files.map((file) => file.name).join(", "));
  };

  const fromDrive = async (entry: Pick<DriveEntry, "id" | "name">) => {
    setOpening(false);
    try {
      await importCards(await readVCardFiles([await readFile(entry.id)]), entry.name);
    } catch (error) {
      onNotice({ message: `“${entry.name}” could not be read.`, detail: sentence(error, "") });
    }
  };

  // A vCard file opened from Finder, also one that waited for this window to open. It waits for the
  // cards, which would otherwise replace the ones it adds when they arrive.
  const openedFile = useRef(fromDrive);
  openedFile.current = fromDrive;
  useEffect(() => {
    if (!ready) return;
    for (const request of takeOpenFileRequests("contacts")) void openedFile.current(request);
    return onOpenFileRequest("contacts", (request) => void openedFile.current(request));
  }, [ready]);

  const writeVCard = useVCardWriter(onNotice);

  const exportCards = async (cards: readonly Contact[]) => {
    try {
      download(await writeVCard(cards), vCardFileName(cards));
    } catch (error) {
      onNotice({
        message: "The vCard could not be made.",
        detail: sentence(error, ""),
      });
    }
  };

  const saveCards = async (target: DriveSaveTarget) => {
    const cards = saving ?? [];
    setSaving(null);
    try {
      const text = await writeVCard(cards);
      await saveToDrive(target, new Blob([text], { type: VCARD_TYPE }));
    } catch (error) {
      onNotice({
        message: `“${target.name}” could not be saved.`,
        detail: sentence(error, ""),
      });
    }
  };

  useImperativeHandle(handle, () => ({
    newSmartGroup: () => {
      setEditingGroup(null);
      setSheet("group");
    },
    editSmartGroup: (group) => {
      setEditingGroup(group);
      setSheet("group");
    },
    importFile: () => fileInput.current?.click(),
    exportShown: () => void exportCards(shownCards),
    exportAll: () => void exportCards(contacts),
  }));

  return (
    <>
      <PullDownButton
        aria-label="Contacts commands"
        image={<SystemImage name="action" />}
        className="mac-contacts-commands"
      >
        <MenuItem onClick={() => setSheet("user")}>Add Desktop User…</MenuItem>
        <MenuItem
          disabled={!onInviteToChess}
          title={onInviteToChess ? undefined : "This card has no account on this desktop."}
          onClick={() => onInviteToChess?.()}
        >
          Invite to Chess…
        </MenuItem>
        <MenuItem
          onClick={() => {
            setEditingGroup(null);
            setSheet("group");
          }}
        >
          New Smart Group…
        </MenuItem>
        {smartGroup ? (
          <MenuItem
            onClick={() => {
              setEditingGroup(smartGroup);
              setSheet("group");
            }}
          >
            Edit Smart Group “{smartGroup.name}”…
          </MenuItem>
        ) : null}
        {smartGroup ? (
          <MenuItem onClick={() => onDeleteSmartGroup(smartGroup.id)}>
            Delete Smart Group “{smartGroup.name}”
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuItem onClick={() => fileInput.current?.click()}>Import vCard…</MenuItem>
        <MenuItem onClick={() => setOpening(true)}>Import vCard from Drive…</MenuItem>
        <MenuSeparator />
        <MenuItem disabled={current === null} onClick={() => void exportCards(shownCards)}>
          {selectedCards.length > 1
            ? `Export ${selectedCards.length} Cards as vCard`
            : "Export Card as vCard"}
        </MenuItem>
        <MenuItem disabled={contacts.length === 0} onClick={() => void exportCards(contacts)}>
          Export All Cards as vCard
        </MenuItem>
        <MenuItem disabled={current === null} onClick={() => setSaving(shownCards)}>
          {selectedCards.length > 1
            ? `Save ${selectedCards.length} Cards to Drive…`
            : "Save Card to Drive…"}
        </MenuItem>
        <MenuItem disabled={contacts.length === 0} onClick={() => setSaving(contacts)}>
          Save All Cards to Drive…
        </MenuItem>
      </PullDownButton>
      <input
        ref={fileInput}
        type="file"
        accept=".vcf,.vcard,.abbu,text/vcard,text/x-vcard"
        multiple
        hidden
        aria-label="vCard file"
        onChange={(event) => void chosen(event)}
      />
      <AddUserSheet
        open={sheet === "user"}
        anchor={anchor}
        account={account}
        onClose={() => setSheet(null)}
        onFound={(user) => {
          setSheet(null);
          onAddUser(user);
        }}
      />
      <SmartGroupSheet
        open={sheet === "group"}
        group={editingGroup}
        anchor={anchor}
        onClose={() => setSheet(null)}
        onSave={(group) => {
          setSheet(null);
          if (editingGroup) onChangeSmartGroup(editingGroup.id, group);
          else onAddSmartGroup(group);
        }}
      />
      <Sheet open={saving !== null} onOpenChange={(open) => open || setSaving(null)}>
        <SheetPopup anchor={anchor} width={640} aria-label="Save">
          {saving ? (
            <DriveSavePanel
              defaultName={vCardFileName(saving)}
              defaultFolder="documents"
              defaultExpanded
              onSave={(target) => void saveCards(target)}
              onCancel={() => setSaving(null)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      {opening ? (
        <DriveOpenLayer
          accept={isVCardFile}
          defaultFolder="documents"
          onOpen={(entry) => void fromDrive(entry)}
          onCancel={() => setOpening(false)}
        />
      ) : null}
    </>
  );
}

/** Add Desktop User…: an account name, looked up on the desktop. */
function AddUserSheet({
  open,
  anchor,
  account,
  onClose,
  onFound,
}: {
  open: boolean;
  anchor: SheetPopupProps["anchor"];
  account: DesktopAccount | null;
  onClose: () => void;
  onFound: (user: { name: string; fullName: string }) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName("");
    setError(null);
  }, [open]);

  const add = async () => {
    const typed = name.trim().toLowerCase();
    if (!typed || busy) return;
    if (account && !account.guest && typed === account.name) {
      setError("That is your own account: it is on My Card.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onFound(await lookupDesktopUser(typed));
    } catch (failure) {
      setError(
        failure instanceof ContactsServerError && failure.status === 404
          ? `No one on this desktop has the account name “${typed}”.`
          : failure instanceof ContactsServerError && failure.status === 401
            ? "Sign in to add the people of this desktop."
            : sentence(failure, "The account could not be looked up."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>Add a Desktop User</SheetTitle>
        <SheetDescription>
          Type the account name of someone who signs in to this desktop. Their card takes the name
          of their account, and Messages and Mail reach them from it.
        </SheetDescription>
        <div className="mac-contacts-sheet-form">
          <Label className="mac-contacts-sheet-label">Account Name:</Label>
          <TextField
            aria-label="Account Name"
            placeholder="martin"
            value={name}
            autoComplete="off"
            spellCheck={false}
            onValueChange={(value) => {
              setName(value);
              setError(null);
            }}
          />
        </div>
        {error ? (
          <p role="alert" className="mac-contacts-sheet-error">
            {error}
          </p>
        ) : null}
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={busy || name.trim() === ""} onClick={() => void add()}>
            Add
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** The most conditions a smart group holds. */
const MAX_RULES = 20;

/** New Smart Group… and Edit Smart Group…: a name and the rules a card must meet. */
function SmartGroupSheet({
  open,
  group,
  anchor,
  onClose,
  onSave,
}: {
  open: boolean;
  /** The group being edited; a new one otherwise. */
  group: SmartGroup | null;
  anchor: SheetPopupProps["anchor"];
  onClose: () => void;
  onSave: (group: Omit<SmartGroup, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [any, setAny] = useState(false);
  const [rules, setRules] = useState<readonly SmartCondition[]>([]);
  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setAny(group?.any === true);
    setRules(group ? conditionsOf(group) : [{ field: "user", test: "yes", value: "" }]);
  }, [open, group]);
  const needsText = (rule: SmartCondition) => rule.field !== "user";
  const ready =
    name.trim() !== "" &&
    rules.length > 0 &&
    rules.every((rule) => !needsText(rule) || rule.value.trim() !== "");
  const change = (at: number, next: Partial<SmartCondition>) =>
    setRules((all) => all.map((rule, index) => (index === at ? { ...rule, ...next } : rule)));
  const save = () => {
    if (!ready) return;
    onSave({
      name: name.trim(),
      rule: "rules",
      conditions: rules.map((rule) => ({ ...rule, value: rule.value.trim() })),
      ...(any ? { any: true } : {}),
    });
  };
  return (
    <Sheet open={open} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={620}>
        <SheetTitle>{group ? "Edit Smart Group" : "New Smart Group"}</SheetTitle>
        <SheetDescription>
          A smart group lists the cards its rules choose, and keeps up as the cards change.
        </SheetDescription>
        <div className="mac-contacts-sheet-form">
          <Label className="mac-contacts-sheet-label">Smart Group Name:</Label>
          <TextField aria-label="Smart Group Name" value={name} onValueChange={setName} />
          <Label className="mac-contacts-sheet-label">Contains cards which match:</Label>
          <PopUpButton
            aria-label="Match"
            value={any ? "any" : "all"}
            onValueChange={(value) => setAny(value === "any")}
          >
            <PopUpButtonItem value="all">all of the following</PopUpButtonItem>
            <PopUpButtonItem value="any">any of the following</PopUpButtonItem>
          </PopUpButton>
        </div>
        <ul className="mac-contacts-rules" aria-label="Rules">
          {rules.map((rule, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a rule has no identity but its place
            <li key={index} className="mac-contacts-rule">
              <PopUpButton
                aria-label={`Rule ${index + 1} field`}
                value={rule.field}
                onValueChange={(value) => {
                  const field = value as SmartField;
                  const [first] = testsOf(field);
                  change(index, {
                    field,
                    test: first?.[0] ?? "contains",
                    value: field === "user" ? "" : rule.value,
                  });
                }}
              >
                {SMART_FIELDS.map(([field, label]) => (
                  <PopUpButtonItem key={field} value={field}>
                    {label}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
              <PopUpButton
                aria-label={`Rule ${index + 1} test`}
                value={rule.test}
                onValueChange={(value) => change(index, { test: value as SmartTest })}
              >
                {testsOf(rule.field).map(([test, label]) => (
                  <PopUpButtonItem key={test} value={test}>
                    {label}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
              {needsText(rule) ? (
                <TextField
                  aria-label={`Rule ${index + 1} value`}
                  className="mac-contacts-rule-value"
                  value={rule.value}
                  onValueChange={(value) => change(index, { value })}
                />
              ) : (
                <span className="mac-contacts-rule-value" />
              )}
              <PushButton
                size="small"
                aria-label={`Remove rule ${index + 1}`}
                disabled={rules.length === 1}
                onClick={() => setRules((all) => all.filter((_, at) => at !== index))}
              >
                −
              </PushButton>
              <PushButton
                size="small"
                aria-label={`Add a rule after rule ${index + 1}`}
                disabled={rules.length >= MAX_RULES}
                onClick={() =>
                  setRules((all) => [
                    ...all.slice(0, index + 1),
                    { field: "name", test: "contains", value: "" },
                    ...all.slice(index + 1),
                  ])
                }
              >
                +
              </PushButton>
            </li>
          ))}
        </ul>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={!ready} onClick={save}>
            OK
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/**
 * The Picture pane's commands on the desktop: a picture from the computer or from the drive
 * (where Photo Booth keeps its pictures, in Pictures), made a 256-pixel JPEG in the browser,
 * and Remove Picture.
 */
export function ContactPictureCommands({
  hasPicture,
  onPicture,
  onRemove,
  onNotice,
}: {
  /** Whether the card has a picture of its own, which Remove Picture removes. */
  hasPicture: boolean;
  /** Called with the picture chosen, a JPEG `data:` URL, and what it was made from; resolves once it is kept. */
  onPicture: (url: string, source: Blob) => Promise<void>;
  /** Called by Remove Picture; resolves once it is gone. */
  onRemove: () => Promise<void>;
  /** Called with what the person is to be told when a picture cannot be used. */
  onNotice: (notice: ContactsNotice) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const use = async (blob: Blob, name: string) => {
    setBusy(true);
    try {
      await onPicture(await pictureFromBlob(blob), blob);
    } catch (error) {
      onNotice({
        message: `“${name}” could not be used as the card’s picture.`,
        detail: sentence(error, "It is not a picture this browser can read."),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mac-contacts-picture-commands">
      <PushButton disabled={busy} onClick={() => fileInput.current?.click()}>
        Choose Picture…
      </PushButton>
      <PushButton disabled={busy} onClick={() => setOpening(true)}>
        Choose from Drive…
      </PushButton>
      <PushButton
        disabled={busy || !hasPicture}
        onClick={() => {
          setBusy(true);
          void onRemove()
            .catch((error) =>
              onNotice({
                message: "The picture could not be removed.",
                detail: sentence(error, ""),
              }),
            )
            .finally(() => setBusy(false));
        }}
      >
        Remove Picture
      </PushButton>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        aria-label="Picture file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void use(file, file.name);
        }}
      />
      {opening ? (
        <DriveOpenLayer
          accept={(entry) => isPictureFile(entry.type, entry.name)}
          defaultFolder="pictures"
          onOpen={(entry) => {
            setOpening(false);
            setBusy(true);
            void readFile(entry.id).then(
              (blob) => use(blob, entry.name),
              (error) => {
                setBusy(false);
                onNotice({
                  message: `“${entry.name}” could not be read.`,
                  detail: sentence(error, ""),
                });
              },
            );
          }}
          onCancel={() => setOpening(false)}
        />
      ) : null}
    </div>
  );
}

/** The alert that tells the person what an import did, or what failed. */
export function ContactsNoticeAlert({
  notice,
  onClose,
}: {
  notice: ContactsNotice | null;
  onClose: () => void;
}) {
  return (
    <Alert open={notice !== null} onOpenChange={(open) => open || onClose()}>
      <AlertPopup>
        <AlertMessage>{notice?.message}</AlertMessage>
        {notice?.detail ? <AlertInformativeText>{notice.detail}</AlertInformativeText> : null}
        <AlertButtons>
          <AlertClose render={<DefaultButton />}>OK</AlertClose>
        </AlertButtons>
      </AlertPopup>
    </Alert>
  );
}
