"use client";

import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { EmptyState } from "macalicious/empty-state";
import { windowDragRegion } from "macalicious/lib/window-drag-region";
import { ListView } from "macalicious/list-view";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { SearchField } from "macalicious/search-field";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { SystemImage } from "macalicious/system-image";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import {
  type ComponentType,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import { useTextTools } from "../calendar/calendar-text-tools";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { type DesktopDragItem, filesOfDrag, registerDropTarget } from "../desktop/desktop-drag";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { useMainWindowItem } from "../desktop/desktop-main-window";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { openUrl } from "../desktop/desktop-open-url";
import {
  changeDesktopValue,
  desktopValuesLoaded,
  subscribeDesktopValues,
  useDesktopValue,
} from "../desktop/desktop-personal";
import {
  type AddressRequest,
  askToReach,
  onAddressRequest,
  takeAddressRequests,
} from "../desktop/desktop-reach";
import {
  CHANGED_ELSEWHERE,
  onSaveFailure,
  servedByDesktopApp,
  serverDocument,
  useServerState,
} from "../desktop/desktop-server";
import { AIRDROP_REASON, copyText } from "../desktop/desktop-share-link";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import { lookUp, lookUpWord } from "../dictionary/dictionary-desktop";
import { saveToDownloads } from "../mail/mail-attachments";
import { MAIL_VIPS } from "../mail/mail-saved";
import { readMailVips } from "../mail/mail-vips";
import { askMapsSearch } from "../maps/maps-open";
import { requestPane } from "../system-preferences/pane-request";
import { printDocument } from "../textedit/textedit-drive";
import {
  ARCHIVE_TYPE,
  archiveFileName,
  archiveText,
  type ContactsArchive,
} from "./contacts-archive";
import { type ContactActionDetail, ContactCard } from "./contacts-card";
import { ContactCardWindow } from "./contacts-card-window";
import {
  ADD_FIELDS,
  type AddableField,
  type Contact,
  type ContactAction,
  type ContactGroup,
  type ContactGroupId,
  type ContactNameOrder,
  type ContactService,
  type ContactSort,
  displayName,
  displayNameIn,
  fieldsOfValue,
  GROUPS,
  inGroup,
  defaultContacts as initialContacts,
  inSmartGroup,
  isEmailValue,
  listNameParts,
  matches,
  namesOf,
  SERVICES,
  type SmartGroup,
  sortContacts,
  tidy,
  withField,
  withMyCard,
  withThisAsMine,
} from "./contacts-data";
import {
  ContactPictureCommands,
  ContactsCommands,
  type ContactsCommandsHandle,
  type ContactsNotice,
  ContactsNoticeAlert,
  download,
  importWithNotice,
  PICTURES_NOT_IMPORTED,
  readVCardFiles,
  SHARE_APPS,
  shareCard,
  useCardPictures,
  useDesktopAccount,
  useVCardWriter,
  vCardFiles,
} from "./contacts-desktop";
import { cardDragItems, followCardDrag, vCardLanding } from "./contacts-drag";
import {
  addToGroup,
  CARDS_DRAG,
  CONTACTS_GROUPS_HIDDEN,
  CONTACTS_LAYOUT,
  type ContactsLayout,
  draggedCards,
  groupFileName,
  MAX_GROUP_NAME,
  MAX_GROUPS,
  nextGroupName,
  readContactsLayout,
  removeFromGroups,
  sortGroups,
} from "./contacts-groups";
import {
  type Duplicates,
  findDuplicates,
  mergeCards,
  withKeeperInGroups,
  withMergedCard,
  withoutRepeats,
} from "./contacts-merge";
import { blobOfDataUrl, newPictureVersion, pictureFromBlob } from "./contacts-picture";
import { ContactPictureEditor } from "./contacts-picture-editor";
import {
  CONTACTS_ACCOUNTS_OFF,
  CONTACTS_CARD_CHOSEN,
  CONTACTS_DEFAULT_ACCOUNT,
  CONTACTS_GROUP_SHOWN,
  CONTACTS_NAME_ORDER,
  CONTACTS_SORT,
  CONTACTS_TEMPLATE,
  cardPrintLines,
  NO_ACCOUNTS_OFF,
  readAccountsOff,
  readContactSort,
  readDefaultAccount,
  readTemplate,
  readText,
} from "./contacts-print";
import {
  CONTACTS_CARDS_URL,
  CONTACTS_GROUPS_URL,
  CONTACTS_SMART_GROUPS_URL,
  cardsFromServer,
  cardsReadable,
  cardsToServer,
  deletePicture,
  groupsFromServer,
  groupsReadable,
  groupsToServer,
  loadPictures,
  MAX_IMAGE_CHARS,
  savePicture,
  smartGroupsFromServer,
  smartGroupsReadable,
  smartGroupsToServer,
} from "./contacts-server";
import { ContactsTextRows } from "./contacts-text-rows";
import type { ImportedCard } from "./contacts-vcard";
import { cardsToVCard, parseVCards, VCARD_TYPE, vCardFileName } from "./contacts-vcard";
import "./contacts.tokens.css";
import "./contacts.css";

/*
 * No library control is restyled here. The three `style` objects below set a custom property
 * that the component itself documents as a hook, and nothing else:
 *
 *   --mac-sidebar-section-gap       src/components/sidebar/sidebar.mdx, Spacing: "set them in
 *                                   `style` on the `Sidebar`"; the space above a section.
 *                                   Contacts' headers follow the row above after 5 pt, where
 *                                   the default is 9 pt.
 *   --mac-split-view-divider-color  src/components/split-view/split-view.mdx: "Set it on the
 *                                   split view"; the measured line between the panes.
 *   --mac-search-field-height       src/components/search-field/search-field.mdx, API: the
 *                                   field's height "for a window that draws it a point taller
 *                                   or shorter"; the captured field is 21 pt.
 *
 * The rows of the groups are the sidebar's own: Contacts sets their text 20 pt from the edge,
 * and the library's row without an icon sets it 18 pt in. The sidebar has no hook for that,
 * so the demo takes the library's row (contacts.mdx, Fidelity).
 */
const GROUPS_STYLE = { "--mac-sidebar-section-gap": "5px" } as CSSProperties;
const SPLIT = {
  "--mac-split-view-divider-color": "var(--mac-contacts-divider)",
} as CSSProperties;
const SEARCH = { "--mac-search-field-height": "21px" } as CSSProperties;

const isGroup = (value: string): value is ContactGroupId =>
  GROUPS.some((group) => group.id === value);

/** The sidebar value of a smart group: its id after this prefix. */
const SMART = "smart:";

/** The sidebar value of a group of the person's own: its id after this prefix. */
const GROUP = "group:";

const readBoolean = (stored: unknown) => (typeof stored === "boolean" ? stored : undefined);

/**
 * A choice of the View menu: kept with the person's settings on a served desktop, the window's own
 * elsewhere.
 */
function useViewChoice<T>(
  served: boolean,
  key: string,
  read: (stored: unknown) => T | undefined,
  initial: T,
): [T, (next: T) => void] {
  const [own, setOwn] = useState(initial);
  const kept = useDesktopValue<T | undefined>(key, read, undefined);
  const set = useCallback(
    (next: T) => {
      setOwn(next);
      if (served) changeDesktopValue(key, next);
    },
    [served, key],
  );
  return [served ? (kept ?? own) : own, set];
}

/** A group's name while it is typed: Return or leaving the field keeps it, Escape does not. */
function GroupNameField({
  name,
  onDone,
}: {
  name: string;
  /** Called once, with what was typed or `null` for Escape. */
  onDone: (typed: string | null) => void;
}) {
  const finished = useRef(false);
  const end = (typed: string | null) => {
    if (finished.current) return;
    finished.current = true;
    onDone(typed);
  };
  return (
    <input
      className="mac-contacts-group-name"
      aria-label="Group name"
      defaultValue={name}
      maxLength={MAX_GROUP_NAME}
      // biome-ignore lint/a11y/noAutofocus: naming a group starts with its text selected, as in a Mac's outline
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") end(event.currentTarget.value);
        else if (event.key === "Escape") end(null);
      }}
      onBlur={(event) => end(event.currentTarget.value)}
    />
  );
}

/** The most cards the desktop keeps for a person (the module's `MAX_CARDS`). */
const MAX_CARDS = 1000;

/** The most smart groups the desktop keeps for a person (the module's `MAX_SMART_GROUPS`). */
const MAX_SMART_GROUPS = 50;

/** An id no other card or group has: letters, digits and `-`, as the server takes it. */
const uniqueId = (prefix: string) =>
  `${prefix}-${
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }`;

/** The card without its picture's version. */
const withoutImage = ({ image: _image, ...card }: Contact): Contact => card;

/** How many changes Edit > Undo can go back. */
const MAX_UNDO_STEPS = 50;
/** Why Add to > VIPs is dimmed: Mail's VIPs are known by their addresses. */
const NOT_AN_EMAIL = "Mail keeps its VIPs by their email addresses, and this is not one.";
/** The fields a new card starts with beyond the usual ones, until Preferences > Template says. */
const NO_TEMPLATE: readonly AddableField[] = [];
/** How long a menu holds the keyboard after a choice (`menu.css`: it fades for 0.25 s). */
const MENU_FADE_MS = 300;

/** A change Edit > Undo can take back, or Redo make again: what was there at that point. */
interface ContactsStep {
  label: string;
  cards: readonly Contact[];
  groups: readonly ContactGroup[];
}

export interface ContactsProps extends Omit<WindowProps, "children"> {
  /**
   * The cards the window starts with, each with an `id` of its own. Nothing is stored: they
   * last as long as the component is mounted. An empty list shows "No Cards" and no card.
   * @default the eight cards of `defaultContacts`
   */
  defaultContacts?: readonly Contact[];
  /**
   * The group shown at first: `"all"`, `"icloud"` or `"mac"`. A group without cards shows
   * "No Cards"; the plus adds one to it.
   * @default "all"
   */
  defaultGroup?: ContactGroupId;
  /**
   * The `id` of the card shown at first. A card the starting group does not hold gives the
   * first one of that group, which is then the chosen card, and an empty list none.
   * @default "stephen-hackett"
   */
  defaultContact?: string;
  /**
   * Whether the card is shown or being edited at first. Without a card there is nothing to
   * edit, and the window shows "No Card Selected" either way.
   * @default "view"
   */
  defaultMode?: "view" | "edit";
  /**
   * The services set up on the Mac. A button under a card's name is available when its
   * service is set up and the card has a number or an address for it; with an empty list all
   * four are dimmed.
   * @default all four: message, call, video and mail
   */
  services?: readonly ContactService[];
  /**
   * Called with the `id` of the card the user chooses in the list, with a click or the arrow
   * keys. It is not called for the card the window shows by itself: the first of a list that
   * does not hold the chosen one, or a card that was just added.
   */
  onContactChange?: (id: string) => void;
  /**
   * Called when a card's button, a field's badge, a command of a label's menu or a service
   * of the share menu is chosen. The demo sends, calls and opens nothing itself.
   */
  onAction?: (action: ContactAction, detail: ContactActionDetail) => void;
  /**
   * The sidebar's surface: the vibrant material, for a window over a desktop, or the same
   * surface as captured over a neutral window.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /** Called when the close button is activated. */
  onClose?: WindowControlsProps["onClose"];
  /** Called when the minimize button is activated. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** Called when the zoom button is activated. */
  onZoom?: WindowControlsProps["onZoom"];
  /** What the zoom button does, as on `WindowControls`. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** Disable the minimize button. */
  minimizeDisabled?: boolean;
  /** Disable the zoom button. */
  zoomDisabled?: boolean;
  /** Further props for the `WindowControls`. */
  controlsProps?: WindowControlsProps;
  /**
   * Called when the primary pointer button goes down on the strip over the groups or on the
   * strip around the search field, not on a control in them. Contacts has no title bar: these
   * are its drag region, and a window manager starts moving the window here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  /** Called when the drag region is double-clicked: macOS zooms or minimizes the window. */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
  /** Given by a desktop: renders a card in a window of its own. */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
}

/**
 * Contacts, as in macOS 10.15 Catalina: a sidebar of groups with the window controls over
 * it, a searchable list of names, and the chosen card, which is shown with its buttons and
 * its fields or edited in place.
 *
 * The root is the library's `Window` and takes every one of its props, so a page or a window
 * manager places it (`style`, `width`, `height`, `ref`), tells it whether it is key (`state`)
 * and hears its window controls and its drag region through the callbacks. Nothing is stored
 * beyond the component's life, except on a desktop served by the `macalicious-desktop`
 * Ferrite application: there the signed-in person's cards, pictures and smart groups are saved
 * after every change and loaded again when the window opens, the person's own card is made from
 * their account, and the bar has the commands that add the desktop's other people and read and
 * write vCard files.
 */
export function Contacts({
  defaultContacts = initialContacts,
  defaultGroup = "all",
  defaultContact = "stephen-hackett",
  defaultMode = "view",
  services = SERVICES,
  onContactChange,
  onAction,
  material = "translucent",
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  DesktopWindow,
  state = "key",
  width = 938,
  height = 438,
  className,
  onKeyDown,
  ...props
}: ContactsProps) {
  const [contacts, setContacts] = useState(defaultContacts);
  // The card Delete Card asks about, while its alert is open.
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const [deletingMany, setDeletingMany] = useState<readonly Contact[] | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchAsked = useRef(false);
  useEffect(() => {
    if (!searchAsked.current || !searchInput.current) return;
    searchAsked.current = false;
    searchInput.current.focus();
  });
  const [group, setGroup] = useState<string>(defaultGroup);
  const [query, setQuery] = useState("");
  const served = servedByDesktopApp();
  // View > Sort By, kept with the person's settings on a served desktop; a window's own elsewhere.
  const [sortBy, setSortBy] = useViewChoice<ContactSort>(
    served,
    CONTACTS_SORT,
    readContactSort,
    "last",
  );
  const [nameOrder, setNameOrder] = useViewChoice<ContactNameOrder>(
    served,
    CONTACTS_NAME_ORDER,
    readContactSort,
    "first",
  );
  const [groupsHidden, setGroupsHidden] = useViewChoice(
    served,
    CONTACTS_GROUPS_HIDDEN,
    readBoolean,
    false,
  );
  const [layout, setLayout] = useViewChoice<ContactsLayout>(
    served,
    CONTACTS_LAYOUT,
    readContactsLayout,
    "list",
  );
  const listShown = layout === "list";
  const groupsShown = listShown && !groupsHidden;
  // The panes keep their widths while they are hidden.
  const [sidebarWidth, setSidebarWidth] = useState(223);
  const [listWidth, setListWidth] = useState(188);
  // The chosen card starts as the card that is shown: the one asked for, or the first of the
  // starting group when that group does not hold it. A window that opens in edit mode edits
  // the card it shows, so that card has to be the chosen one: it then stays the card shown
  // when a new name moves it in the list.
  const [duplicates, setDuplicates] = useState<Duplicates | null>(null);
  const [selected, setSelected] = useState<string | null>(() => {
    const listed = sortContacts(
      defaultContacts.filter((contact) => inGroup(contact, defaultGroup)),
    );
    return (listed.find((contact) => contact.id === defaultContact) ?? listed[0])?.id ?? null;
  });
  // A card another application asks for (Spotlight): in All Contacts, where every card shows.
  const openAsked = useRef(false);
  useOpenItemRequests("contacts", ({ id }) => {
    openAsked.current = true;
    setGroup("all");
    setSelected(id);
  });
  const [editing, setEditing] = useState(defaultMode === "edit");
  // The card that was just added: its first name takes the focus.
  const [added, setAdded] = useState<string | null>(null);
  const serial = useRef(0);

  // Served by the desktop's Ferrite application: the signed-in person's saved cards replace the
  // starting ones, and every change is saved, as Contacts saves as you type. The account is
  // asked first, so that a person who has saved nothing starts with only their own card, made
  // from it. Until the first loads settle the window's content is inert, so no change is made
  // that a load would replace.
  const desktop = useDesktopAccount(served);
  const [smartGroups, setSmartGroups] = useState<readonly SmartGroup[]>([]);
  const [ownGroups, setOwnGroups] = useState<readonly ContactGroup[]>([]);
  // The sidebar value of the group whose name is being typed.
  const [renaming, setRenaming] = useState<string | null>(null);
  // The sidebar value of the row whose contextual menu is open or last was.
  const [menuGroup, setMenuGroup] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null);
  // The group the dragged cards are over.
  const [dropGroup, setDropGroup] = useState<string | null>(null);
  // The field Card > Add Field just added: it takes the focus when the card shows it.
  const [addedField, setAddedField] = useState<AddableField | null>(null);
  useEffect(() => {
    if (addedField) setAddedField(null);
  }, [addedField]);
  const [notice, setNotice] = useState<ContactsNotice | null>(null);
  const writeVCard = useVCardWriter(setNotice);
  const template = useDesktopValue(CONTACTS_TEMPLATE, readTemplate, NO_TEMPLATE);
  const mailVips = useDesktopValue(MAIL_VIPS, readMailVips, undefined);
  // Add to > VIPs: Mail's own list, which it reads as it changes.
  const addMailVip = (address: string) => {
    const known = address.trim().toLowerCase();
    if (mailVips?.some((vip) => vip.address === known)) return;
    const name = current ? displayName(current) : known;
    changeDesktopValue(MAIL_VIPS, [...(mailVips ?? []), { address: known, name: name || known }]);
  };
  // An archive chosen in File > Import, while its alert asks.
  const [replacing, setReplacing] = useState<{ archive: ContactsArchive; from: string } | null>(
    null,
  );
  // A save the server did not keep (an import's too) is said, not passed over.
  useEffect(() => {
    if (!served) return;
    return onSaveFailure((failure) => {
      if (failure.url === CONTACTS_GROUPS_URL) {
        setNotice(
          failure.reason === CHANGED_ELSEWHERE
            ? {
                message: "A change to your groups was not kept.",
                detail:
                  "They were changed in another window or browser first, and that version is kept.",
              }
            : {
                message: "Your groups could not be saved.",
                detail: `${failure.reason} The next change sends every group again.`,
              },
        );
        return;
      }
      if (failure.url !== CONTACTS_CARDS_URL) return;
      // A change another window or browser made first wins: the window shows that version.
      setNotice(
        failure.reason === CHANGED_ELSEWHERE
          ? {
              message: "A change to your cards was not kept.",
              detail:
                "They were changed in another window or browser first, and that version is kept.",
            }
          : {
              message: "Your cards could not be saved.",
              detail: `${failure.reason} The next change sends every card again.`,
            },
      );
    });
  }, [served]);

  // The group shown: a smart group that is gone (deleted in another window) shows All Contacts.
  const smartGroup = group.startsWith(SMART)
    ? (smartGroups.find((each) => SMART + each.id === group) ?? null)
    : null;
  const ownGroup = group.startsWith(GROUP)
    ? (ownGroups.find((each) => GROUP + each.id === group) ?? null)
    : null;
  const accountsOff = useDesktopValue(CONTACTS_ACCOUNTS_OFF, readAccountsOff, NO_ACCOUNTS_OFF);
  const defaultAccount = useDesktopValue(CONTACTS_DEFAULT_ACCOUNT, readDefaultAccount, "icloud");
  const shown =
    (group.startsWith(SMART) && !smartGroup) ||
    (group.startsWith(GROUP) && !ownGroup) ||
    accountsOff.includes(group as Contact["account"])
      ? "all"
      : group;
  // Where a new card goes: the account shown, else the default one while it is on.
  const newCardAccount: Contact["account"] =
    shown === "mac" || shown === "icloud"
      ? shown
      : accountsOff.includes(defaultAccount)
        ? defaultAccount === "mac"
          ? "icloud"
          : "mac"
        : defaultAccount;
  const holds = useCallback(
    (contact: Contact, where: string) => {
      if (accountsOff.includes(contact.account)) return false;
      if (where.startsWith(GROUP)) {
        const own = ownGroups.find((each) => GROUP + each.id === where);
        return own ? own.members.includes(contact.id) : inGroup(contact, "all");
      }
      if (!where.startsWith(SMART)) return inGroup(contact, where as ContactGroupId);
      const rule = smartGroups.find((each) => SMART + each.id === where);
      return rule ? inSmartGroup(contact, rule) : inGroup(contact, "all");
    },
    [smartGroups, ownGroups, accountsOff],
  );

  const cardsLoading = useServerState({
    url: CONTACTS_CARDS_URL,
    enabled: served && desktop.settled,
    value: contacts,
    onLoad: (stored) => {
      if (!cardsReadable(stored)) return false;
      const saved = cardsFromServer(stored);
      const { account } = desktop;
      // A signed-in person who has saved nothing starts with their own card only; saved cards
      // without one get it, unless they already fill the address book (then they are kept as
      // they are: none is dropped, and nothing past the limit is made).
      const mine = saved && account ? withMyCard(saved, account) : undefined;
      const next = saved
        ? mine && mine.length <= MAX_CARDS
          ? mine
          : saved
        : account
          ? withMyCard([], account)
          : undefined;
      if (!next) return;
      setContacts(next);
      // The chosen card is one of the saved cards of the group shown, or else its first: so a
      // window that opens in edit mode edits a card it has chosen, which stays the card shown
      // when a new name moves it in the list.
      const listed = sortContacts(next.filter((contact) => holds(contact, shown)));
      setSelected((chosen) =>
        listed.some((contact) => contact.id === chosen) ? chosen : (listed[0]?.id ?? null),
      );
    },
    toBody: cardsToServer,
  });
  const groupsLoading = useServerState({
    url: CONTACTS_SMART_GROUPS_URL,
    enabled: served,
    value: smartGroups,
    onLoad: (stored) => {
      if (!smartGroupsReadable(stored)) return false;
      const saved = smartGroupsFromServer(stored);
      if (saved) setSmartGroups(saved);
    },
    toBody: smartGroupsToServer,
  });
  const ownGroupsLoading = useServerState({
    url: CONTACTS_GROUPS_URL,
    enabled: served,
    value: ownGroups,
    onLoad: (stored) => {
      if (!groupsReadable(stored)) return false;
      const saved = groupsFromServer(stored);
      if (saved) setOwnGroups(saved);
    },
    toBody: groupsToServer,
  });
  const loading = cardsLoading || groupsLoading || ownGroupsLoading || !desktop.settled;
  const pictures = useCardPictures(served && !loading, contacts);
  // The cards as they are now, for the steps of an import or an addition that wait on the server.
  const latest = useRef(contacts);
  useEffect(() => {
    latest.current = contacts;
  });
  // Edit > Undo and Redo: the cards and the groups' members as they were before each change, while
  // the window lives. Text being typed has its own, the field's.
  const [undoStack, setUndoStack] = useState<readonly ContactsStep[]>([]);
  const [redoStack, setRedoStack] = useState<readonly ContactsStep[]>([]);
  const groupsNow = useRef(ownGroups);
  groupsNow.current = ownGroups;
  // The card being edited as it was when the edit began. Steps are made from it, so typing not yet
  // finished is in none of them, and the whole edit is one step of its own.
  const editBegan = useRef<Contact | null>(null);
  // The same for each card being edited in a window of its own.
  const windowEditBegan = useRef(new Map<string, Contact>());
  const stepNow = (label: string): ContactsStep => ({
    label,
    cards: latest.current.map((card) =>
      card.id === editBegan.current?.id
        ? editBegan.current
        : (windowEditBegan.current.get(card.id) ?? card),
    ),
    groups: groupsNow.current,
  });
  const remember = (label: string) => {
    const step = stepNow(label);
    setUndoStack((steps) => [...steps.slice(1 - MAX_UNDO_STEPS), step]);
    setRedoStack([]);
  };
  // The field a card is being edited in, which a menu's Undo or Redo is for: the menu takes the
  // keyboard until it has faded out, and the field takes it back only then.
  const lastField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const textTools = useTextTools("contacts", "mac-contacts-floating-panel", () => null);
  const inLastField = (command: "undo" | "redo") => {
    const field = lastField.current;
    if (!field) return;
    setTimeout(() => {
      if (!field.isConnected || !document.hasFocus()) return;
      field.focus();
      if (document.activeElement === field) document.execCommand(command);
    }, MENU_FADE_MS);
  };
  const restore = ({ cards, groups }: ContactsStep) => {
    setEditing(false);
    setAdded(null);
    // A picture is kept beside the cards and has no history: a card stays as the server has it now,
    // and one that had gone has none. A card still being edited in its own window keeps what was typed:
    // its edit becomes a step of its own when it ends.
    setContacts(
      cards.map(({ image: _was, ...card }) => {
        const now = latest.current.find((each) => each.id === card.id);
        if (now && windowEditBegan.current.has(card.id)) return now;
        return now?.image ? { ...card, image: now.image } : card;
      }),
    );
    setOwnGroups((now) =>
      now.map((group) => {
        const was = groups.find((each) => each.id === group.id);
        return was ? { ...group, members: was.members } : group;
      }),
    );
    setSelected((chosen) => (cards.some((card) => card.id === chosen) ? chosen : null));
  };
  const undo = () => {
    const step = undoStack.at(-1);
    if (!step) return;
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack([...redoStack, stepNow(step.label)]);
    restore(step);
  };
  const redo = () => {
    const step = redoStack.at(-1);
    if (!step) return;
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack([...undoStack, stepNow(step.label)]);
    restore(step);
  };

  const searching = query.trim() !== "";
  // The cards of the group that hold the searched text. The card being edited stays listed
  // whatever is typed in it: a search that found it by a name must not take the card away
  // while that name is changed, or while an edit stops it matching the smart group shown.
  const visible = useMemo(
    () =>
      sortContacts(
        contacts.filter(
          (contact) =>
            (editing && contact.id === selected) ||
            (holds(contact, shown) && matches(contact, query)),
        ),
        sortBy,
      ),
    [contacts, holds, shown, query, editing, selected, sortBy],
  );
  // The card shown: the chosen one while the list holds it, and else the list's first.
  const current = visible.find((contact) => contact.id === selected) ?? visible[0] ?? null;
  const currentId = current?.id ?? null;
  // Names selected beside the card shown; while there are any the card pane says how many.
  const [alsoChosen, setAlsoChosen] = useState<readonly string[]>([]);
  const chosenCards = useMemo(
    () =>
      alsoChosen.length === 0
        ? []
        : visible.filter((contact) => contact.id === currentId || alsoChosen.includes(contact.id)),
    [visible, alsoChosen, currentId],
  );
  const several = chosenCards.length > 1;
  const selectedNow = useRef(currentId);
  selectedNow.current = currentId;
  const visibleNow = useRef(visible);
  visibleNow.current = visible;

  // The group shown and the card chosen, kept with the person's settings. They are read back once,
  // when the cards and the settings are both there, and written only after that, so a window that
  // has not read them yet does not replace them with what it starts on.
  const valuesLoaded = useSyncExternalStore(
    subscribeDesktopValues,
    desktopValuesLoaded,
    () => false,
  );
  const keptGroup = useDesktopValue(CONTACTS_GROUP_SHOWN, readText, undefined);
  const keptCard = useDesktopValue(CONTACTS_CARD_CHOSEN, readText, undefined);
  const [placeRead, setPlaceRead] = useState(false);
  useEffect(() => {
    if (!served || loading || !valuesLoaded || placeRead) return;
    setPlaceRead(true);
    if (openAsked.current) return;
    if (keptGroup) setGroup(keptGroup);
    if (keptCard) setSelected(keptCard);
  }, [served, loading, valuesLoaded, placeRead, keptGroup, keptCard]);
  useEffect(() => {
    if (!placeRead) return;
    changeDesktopValue(CONTACTS_GROUP_SHOWN, shown);
    if (currentId !== null) changeDesktopValue(CONTACTS_CARD_CHOSEN, currentId);
  }, [placeRead, shown, currentId]);

  // Ends an edit: the card keeps what was typed, without the fields left empty.
  const finish = () => {
    if (!editing) return;
    setEditing(false);
    setAdded(null);
    const began = editBegan.current;
    if (began) {
      const now = latest.current.find((contact) => contact.id === began.id);
      if (now && JSON.stringify(tidy(began)) !== JSON.stringify(tidy(now))) remember("Edit Card");
    }
    editBegan.current = null;
    if (currentId !== null) {
      setContacts((now) =>
        now.map((contact) => (contact.id === currentId ? tidy(contact) : contact)),
      );
    }
  };

  // Done. A search that no longer finds the card as it was left is cleared, or the card that
  // was just edited would not be listed.
  const done = () => {
    finish();
    if (editing && current !== null && !matches(tidy(current), query)) setQuery("");
  };

  // Edit. The card shown becomes the chosen one, also when it is only the first of a list
  // that does not hold the card chosen before: it is the one that stays listed.
  const edit = () => {
    if (currentId === null) return;
    // One edit of a card at a time: its window's ends here.
    endWindowEdit(currentId);
    setSelected(currentId);
    editBegan.current = latest.current.find((contact) => contact.id === currentId) ?? null;
    setEditing(true);
  };

  // A card chosen in the list. The card shown may be the first of the list and not the chosen
  // one (after a search, or in another group): choosing it makes it the chosen one, so it
  // stays when the list changes again.
  const choose = (id: string) => {
    setAlsoChosen([]);
    if (id === selected && id === currentId) return;
    if (id !== currentId) finish();
    setSelected(id);
    onContactChange?.(id);
  };

  const show = (next: string) => {
    const known =
      isGroup(next) ||
      smartGroups.some((each) => SMART + each.id === next) ||
      ownGroups.some((each) => GROUP + each.id === next);
    if (!known || next === shown) return;
    setAlsoChosen([]);
    finish();
    setGroup(next);
  };

  const search = (text: string) => {
    setAlsoChosen([]);
    finish();
    setQuery(text);
  };

  // A new card goes to the account that is shown, and from All Contacts or a smart group to
  // iCloud, which then shows All Contacts; from a group of the person's own to iCloud and into
  // that group. A search is cleared first, or the card, which has no name yet, would not be listed.
  const add = (seed?: Partial<Contact>) => {
    setAlsoChosen([]);
    // The served desktop keeps at most `MAX_CARDS`: a card past it could never be saved.
    if (served && contacts.length >= MAX_CARDS) {
      setNotice({ message: `Contacts keeps at most ${MAX_CARDS} cards.` });
      return;
    }
    finish();
    let id: string;
    do {
      serial.current += 1;
      id = `new-${serial.current}`;
    } while (contacts.some((contact) => contact.id === id));
    const contact = template.reduce<Contact>((card, field) => withField(card, field), {
      id,
      account: newCardAccount,
      first: "",
      last: "",
      ...seed,
    });
    if (shown.startsWith(SMART)) setGroup("all");
    if (ownGroup) setOwnGroups((now) => addToGroup(now, ownGroup.id, [id]));
    remember("New Card");
    setContacts((now) => [...now, contact]);
    setQuery("");
    setSelected(id);
    setAdded(id);
    setEditing(true);
  };

  // Card > Discard Changes: the card as it was when the edit began, keeping the picture it has now,
  // which is on the server already. A card just made has nothing to go back to, so it goes, with its
  // New Card step.
  const discard = () => {
    if (!editing || current === null) return;
    const { id, image } = current;
    const began = editBegan.current;
    editBegan.current = null;
    setEditing(false);
    setAdded(null);
    if (added === id) {
      const left = visibleNow.current.filter((contact) => contact.id !== id);
      setUndoStack((steps) => steps.slice(0, -1));
      setSelected(left[0]?.id ?? null);
      setContacts((now) => now.filter((contact) => contact.id !== id));
      setOwnGroups((now) => removeFromGroups(now, [id]));
      if (served && image) {
        void deletePicture(id, image).catch(() =>
          setNotice({ message: "The picture of the discarded card could not be removed." }),
        );
      }
      return;
    }
    if (!began) return;
    const asBegan = withoutImage(began);
    setContacts((now) =>
      now.map((contact) =>
        contact.id === id
          ? { ...asBegan, ...(contact.image ? { image: contact.image } : {}) }
          : contact,
      ),
    );
  };

  // Card > Make This My Card.
  const makeMine = () => {
    if (currentId === null) return;
    finish();
    remember("Make This My Card");
    setContacts((now) => withThisAsMine(now, currentId));
  };

  // Card > Reorder Last Name Before First: the two names change places.
  const reorderNames = () => {
    if (current === null) return;
    if (!editing) remember("Reorder Names");
    change({ ...current, first: current.last, last: current.first });
  };

  const shareWith = (app: string, title: string, card: Contact) => {
    if (!shareCard(app, card, writeVCard)) {
      setNotice({ message: `${title} could not take the card.` });
    }
  };

  // File > Export > Contacts Archive.
  const exportArchive = async () => {
    try {
      const framed = latest.current.filter((card) => card.image).map(({ id }) => id);
      const stored = framed.length > 0 ? await loadPictures(framed) : {};
      download(
        archiveText({
          cards: latest.current,
          groups: ownGroups,
          smartGroups,
          pictures: stored,
        }),
        archiveFileName(new Date()),
        ARCHIVE_TYPE,
      );
    } catch (error) {
      setNotice({
        message: "The archive could not be made.",
        detail: error instanceof Error ? error.message : undefined,
      });
    }
  };

  // An archive takes the place of everything: the pictures go up first, so a failure leaves the cards
  // as they were, and the history of what was replaced is forgotten.
  const replaceWithArchive = async ({
    cards,
    groups,
    smartGroups: rules,
    pictures: stored,
  }: ContactsArchive) => {
    const { account } = desktop;
    const named = cards.map((card) =>
      card.image && stored[card.id]?.version !== card.image ? withoutImage(card) : card,
    );
    const next = account ? withMyCard(named, account) : named;
    if (next.length > MAX_CARDS) {
      setNotice({ message: `Contacts keeps at most ${MAX_CARDS} cards.` });
      return;
    }
    finish();
    const kept = next.flatMap((card) => {
      const picture = card.image ? stored[card.id] : undefined;
      return picture ? [{ id: card.id, picture }] : [];
    });
    try {
      for (const { id, picture } of kept) await savePicture(id, picture.version, picture.image);
    } catch (error) {
      setNotice({
        message: "The archive was not restored, because a picture could not be kept.",
        detail: error instanceof Error ? error.message : undefined,
      });
      return;
    }
    const before = latest.current;
    for (const { id, picture } of kept) pictures.put(id, picture);
    latest.current = next;
    setUndoStack([]);
    setRedoStack([]);
    setAlsoChosen([]);
    setQuery("");
    setGroup("all");
    setSelected(sortContacts(next, sortBy)[0]?.id ?? null);
    setContacts(next);
    setOwnGroups(groups);
    setSmartGroups(rules);
    const framed = new Set(next.flatMap((card) => (card.image ? [card.id] : [])));
    const stale = before.filter((card) => card.image && !framed.has(card.id));
    const removed = await Promise.allSettled(
      stale.map((card) => deletePicture(card.id, card.image)),
    );
    if (removed.some((result) => result.status === "rejected")) {
      setNotice({ message: "Some pictures of the cards that were replaced could not be removed." });
    }
  };

  // Show a card that was just added or found, in the group shown when it holds the card.
  const reveal = (card: Contact) => {
    setQuery("");
    if (!holds(card, shown)) setGroup("all");
    setSelected(card.id);
  };

  // Add Desktop User… found an account: its card, or the card already made for it.
  const addDesktopUser = ({ name, fullName }: { name: string; fullName: string }) => {
    const existing = latest.current.find((card) => card.user === name);
    if (existing) {
      finish();
      reveal(existing);
      return;
    }
    if (served && latest.current.length >= MAX_CARDS) {
      setNotice({ message: `Contacts keeps at most ${MAX_CARDS} cards.` });
      return;
    }
    finish();
    const card: Contact = {
      id: uniqueId("c"),
      account: shown === "mac" ? "mac" : "icloud",
      ...namesOf(fullName),
      user: name,
    };
    remember("Add Card");
    setContacts((now) => [...now, card]);
    reveal(card);
  };

  // Mail's Add Sender to Contacts: kept until the cards are read, so it finds a card already there.
  const addUserNow = useRef(addDesktopUser);
  addUserNow.current = addDesktopUser;
  useEffect(() => {
    if (!served || loading) return;
    const take = ({ to, name }: AddressRequest) => addUserNow.current({ name: to, fullName: name });
    for (const request of takeAddressRequests("contacts")) take(request);
    return onAddressRequest("contacts", take);
  }, [served, loading]);

  // A picture for card `id`: kept on the server first, then named by the card.
  const storePicture = async (id: string, url: string) => {
    const version = newPictureVersion();
    await savePicture(id, version, url);
    pictures.put(id, { version, image: url });
    setContacts((now) =>
      now.map((contact) => (contact.id === id ? { ...contact, image: version } : contact)),
    );
    return version;
  };
  const keepPicture = async (id: string, url: string) => {
    await storePicture(id, url);
  };

  // What a card's picture was made from, while this window has it: framing it anew starts from all
  // of it, not from the square kept on the server.
  const pictureSources = useRef(new Map<string, Blob>());
  const [framingPicture, setFramingPicture] = useState<{ id: string; source: Blob } | null>(null);
  const framePicture = (contact: Contact) => {
    const url = pictures.urlOf(contact);
    const source = pictureSources.current.get(contact.id) ?? (url ? blobOfDataUrl(url) : undefined);
    if (source) setFramingPicture({ id: contact.id, source });
  };

  // A picture for card `id`, from a file chosen or dropped.
  const takePictureFile = (id: string, file: File) => {
    void pictureFromBlob(file)
      .then((url) => {
        pictureSources.current.set(id, file);
        return keepPicture(id, url);
      })
      .catch(() =>
        setNotice({
          message: `\u201c${file.name}\u201d could not be used as the card's picture.`,
        }),
      );
  };

  // The picture goes from the server first; only then does the card stop naming it, and only
  // if it still names the same one (a picture chosen meanwhile stays). A failed deletion leaves
  // the card as it was.
  const removePicture = async (id: string) => {
    const before = latest.current.find((contact) => contact.id === id)?.image;
    await deletePicture(id, before);
    setContacts((now) =>
      now.map((contact) =>
        contact.id === id && contact.image === before ? withoutImage(contact) : contact,
      ),
    );
  };

  // Each picture goes from the server first: a card its picture could not leave stays, with it, and
  // the person is told. The rest then go in one step, which Undo takes back from the cards as they
  // are by then, so nothing changed meanwhile is lost. The card after them in the list is shown next.
  const deleteCards = async (cards: readonly Contact[], label: string) => {
    const gone = new Set<string>();
    for (const card of cards) {
      if (served && card.image) {
        try {
          await deletePicture(card.id, card.image);
        } catch {
          setNotice({
            message: `\u201c${displayName(card)}\u201d could not be deleted.`,
            detail: "Its picture could not be removed. Try again in a moment.",
          });
          continue;
        }
      }
      gone.add(card.id);
    }
    if (gone.size === 0) return;
    remember(label);
    // The window may have moved on while the pictures went: another card stays as it is.
    if (gone.has(selectedNow.current ?? "")) {
      const list = visibleNow.current;
      const at = list.findIndex((contact) => contact.id === selectedNow.current);
      const next =
        list.slice(at + 1).find((contact) => !gone.has(contact.id)) ??
        list.slice(0, Math.max(at, 0)).findLast((contact) => !gone.has(contact.id)) ??
        null;
      setEditing(false);
      setSelected(next?.id ?? null);
    }
    setContacts((now) => now.filter((contact) => !gone.has(contact.id)));
    setOwnGroups((now) => removeFromGroups(now, [...gone]));
  };

  // The cards are one document on the server, so the merged card and the removal of the others are
  // stored in one write. The groups are another, written first with the card that stays beside the
  // others, whose ids stay: an id that names no card is ignored when a group is read, so no failure
  // can take a card out of a group.
  // A card goes only when all it holds fits on the card that stays; otherwise nothing changes.
  // One picture stays. A card that has none takes the picture of a card that goes, kept anew under its
  // own id; any other picture goes to Downloads, since a merged card holds one and Undo cannot bring a
  // picture back. A picture that cannot be moved stops the merge, before anything is lost; only then
  // do the cards that go lose theirs, and so an Undo gives them back without one.
  // Answers whether the cards were merged.
  const merge = async (cards: readonly Contact[]) => {
    const refuse = (named: Contact) => {
      setNotice({
        message: `The cards of \u201c${displayName(named)}\u201d were not merged.`,
        detail:
          "Together they hold more than one card can: 50 entries of a kind, or a note of 5,000 characters.",
      });
      return false;
    };
    const { card, left } = mergeCards(cards.map((each) => tidy(each)));
    if (left.length > 0) return refuse(card);
    const going = cards.filter((each) => each.id !== card.id);
    const gone = new Set(going.map(({ id }) => id));
    flushSync(() => setOwnGroups((now) => withKeeperInGroups(now, card.id, gone)));
    if (served) await serverDocument(CONTACTS_GROUPS_URL).idle();
    // The cards as they are after that wait: what was edited meanwhile goes in the merge too. Cards that
    // no longer fit together, or are gone, stay as they are.
    const now = cards.flatMap(({ id }) => latest.current.find((each) => each.id === id) ?? []);
    if (now.length !== cards.length) return false;
    const merged = mergeCards(now.map((each) => tidy(each)));
    if (merged.left.length > 0) return refuse(merged.card);
    if (merged.card.id !== card.id) return false;
    let image = merged.card.image ?? (served ? undefined : merged.picture?.image);
    const saved: string[] = [];
    const giving = [...(merged.picture ? [merged.picture] : []), ...merged.spare];
    if (served) {
      try {
        if (merged.picture) {
          const url = pictures.urlOf(merged.picture);
          if (!url) throw new Error("not read");
          image = await storePicture(card.id, url);
        }
        for (const each of merged.spare) {
          const url = pictures.urlOf(each);
          if (!url) throw new Error("not read");
          const blob = blobOfDataUrl(url);
          const kind = blob.type === "image/png" ? "png" : "jpg";
          const entry = await saveToDownloads(blob, `${displayName(each)} picture.${kind}`);
          saved.push(entry.name);
        }
      } catch {
        setNotice({
          message: `The cards of \u201c${displayName(merged.card)}\u201d were not merged.`,
          detail: "A picture could not be moved. Nothing was lost. Try again in a moment.",
        });
        return false;
      }
      await Promise.allSettled(giving.map((each) => deletePicture(each.id, each.image)));
    }
    const given = new Set(giving.map(({ id }) => id));
    setContacts((list) => list.map((each) => (given.has(each.id) ? withoutImage(each) : each)));
    setOwnGroups((list) => withKeeperInGroups(list, card.id, gone));
    remember("Merge Cards");
    setContacts((list) =>
      withMergedCard(list, image ? { ...merged.card, image } : merged.card, gone),
    );
    if (saved.length > 0) {
      setNotice({
        message: `A card keeps one picture, so ${saved.join(", ")} went to Downloads.`,
      });
    }
    if (gone.has(selectedNow.current ?? "")) {
      setEditing(false);
      setSelected(card.id);
    }
    return true;
  };
  const mergeDuplicates = async () => {
    finish();
    // As the cards are now, not as they were when the alert asked.
    const found = findDuplicates(latest.current.map((each) => tidy(each)));
    for (const set of found.sets) await merge(set);
    for (const { id } of found.entries) {
      const card = latest.current.find((each) => each.id === id);
      if (card) change(withoutRepeats(tidy(card)));
    }
  };

  // Each picture a vCard file holds goes to its new card. It does not hold up the import, which says
  // what it did; one that cannot be kept leaves the monogram and is said afterwards.
  const keepImportedPictures = async (taken: readonly { id: string; photo: string }[]) => {
    let lost = 0;
    for (const { id, photo } of taken) {
      try {
        await keepPicture(
          id,
          photo.length <= MAX_IMAGE_CHARS ? photo : await pictureFromBlob(blobOfDataUrl(photo)),
        );
      } catch {
        lost += 1;
      }
    }
    if (lost > 0) {
      setNotice({
        message: lost === 1 ? "A picture was not kept." : `${lost} pictures were not kept.`,
        detail: "Their cards were added, with a monogram in place of the picture.",
      });
    }
  };

  // The cards of a vCard file, added to the account shown (iCloud from All Contacts). A desktop
  // user already in Contacts is not added again, nor the person's own card (an export of My
  // Card read back). Resolves with the number of cards added.
  // Imports run one after another, each checking the cards the one before left (`latest` is
  // brought up to date at once), so two together can neither pass the limit nor add one desktop
  // user twice.
  const imports = useRef<Promise<unknown>>(Promise.resolve());
  const importCards = (imported: readonly ImportedCard[], label = "Import"): Promise<number> => {
    const run = imports.current.then(
      () => importNow(imported, label),
      () => importNow(imported, label),
    );
    imports.current = run.catch(() => {});
    return run;
  };
  const importNow = async (imported: readonly ImportedCard[], label: string): Promise<number> => {
    const now = latest.current;
    const own = desktop.account && !desktop.account.guest ? desktop.account.name : undefined;
    const users = new Set(now.flatMap((card) => (card.user ? [card.user] : [])));
    if (own) users.add(own);
    const fresh: Contact[] = [];
    const photos: { id: string; photo: string }[] = [];
    for (const { card, photo } of imported) {
      const { user } = card;
      if (user && users.has(user)) continue;
      if (user) users.add(user);
      const account: Contact["account"] = newCardAccount;
      const id = uniqueId("c");
      fresh.push({ ...card, id, account });
      if (photo) photos.push({ id, photo });
    }
    if (now.length + fresh.length > MAX_CARDS) {
      throw new Error(`Contacts keeps at most ${MAX_CARDS} cards.`);
    }
    const [first] = fresh;
    if (!first) return 0;
    finish();
    remember(label);
    latest.current = [...latest.current, ...fresh];
    setContacts((list) => [...list, ...fresh]);
    reveal(first);
    if (served && photos.length > 0) void keepImportedPictures(photos);
    return fresh.length;
  };

  // Cards on the clipboard, as Copy and Cut put them there. The new card is shown, which says all
  // there is to say; the person is told only of what was left out.
  const pasteCards = async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setNotice({
        message: "The clipboard could not be read.",
        detail: "Allow this page to read the clipboard, then try again.",
      });
      return;
    }
    const cards = parseVCards(text);
    if (cards.length === 0) {
      setNotice({ message: "The clipboard holds no cards." });
      return;
    }
    try {
      const added = await importCards(cards, "Paste");
      const left = cards.length - added;
      const details = [
        left > 0 ? `${left} of the cards on the clipboard were already in Contacts.` : "",
        cards.some((each) => each.hadPhoto && !(served && each.photo)) ? PICTURES_NOT_IMPORTED : "",
      ].filter(Boolean);
      if (details.length > 0) {
        setNotice({
          message: added === 1 ? "1 card was pasted." : `${added} cards were pasted.`,
          detail: details.join(" "),
        });
      }
    } catch (error) {
      setNotice({
        message: "The cards could not be pasted.",
        detail: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const addSmartGroup = (rule: Omit<SmartGroup, "id">) => {
    if (smartGroups.length >= MAX_SMART_GROUPS) {
      setNotice({ message: `Contacts keeps at most ${MAX_SMART_GROUPS} smart groups.` });
      return;
    }
    const id = uniqueId("g");
    finish();
    setSmartGroups((now) => [...now, { id, ...rule }]);
    setGroup(SMART + id);
  };

  const changeSmartGroup = (id: string, next: Omit<SmartGroup, "id">) => {
    finish();
    setSmartGroups((now) => now.map((each) => (each.id === id ? { id, ...next } : each)));
    setGroup(SMART + id);
  };

  // A new group, with the cards `members`, is shown with its name ready to be typed.
  const newGroup = (members: readonly string[]) => {
    if (ownGroups.length >= MAX_GROUPS) {
      setNotice({ message: `Contacts keeps at most ${MAX_GROUPS} groups.` });
      return;
    }
    const id = uniqueId("g");
    finish();
    setOwnGroups((now) => [...now, { id, name: nextGroupName(now), members }]);
    setLayout("list");
    setGroupsHidden(false);
    if (members.length === 0) setAlsoChosen([]);
    setGroup(GROUP + id);
    setRenaming(GROUP + id);
  };

  const removeFromShownGroup = () => {
    if (!ownGroup) return;
    const going = several ? chosenCards : current ? [current] : [];
    if (going.length === 0) return;
    finish();
    setAlsoChosen([]);
    setOwnGroups((now) =>
      removeFromGroups(
        now,
        going.map(({ id }) => id),
        ownGroup.id,
      ),
    );
  };

  const groupNamed = (value: string | null): string | null => {
    if (value === null) return null;
    return (
      ownGroups.find((each) => GROUP + each.id === value)?.name ??
      smartGroups.find((each) => SMART + each.id === value)?.name ??
      GROUPS.find((each) => each.id === value)?.name ??
      null
    );
  };

  const endRename = (value: string, typed: string | null) => {
    setRenaming(null);
    const name = typed?.trim();
    if (!name) return;
    setOwnGroups((now) =>
      now.map((each) => (GROUP + each.id === value ? { ...each, name } : each)),
    );
    setSmartGroups((now) =>
      now.map((each) => (SMART + each.id === value ? { ...each, name } : each)),
    );
  };

  const deleteGroup = (value: string) => {
    if (shown === value) {
      finish();
      setAlsoChosen([]);
      setGroup("all");
    }
    setOwnGroups((now) => now.filter((each) => GROUP + each.id !== value));
    setSmartGroups((now) => now.filter((each) => SMART + each.id !== value));
  };

  // Everything the row holds, as one vCard file named after it.
  const exportGroup = (value: string) => {
    const cards = contacts.filter((contact) => holds(contact, value));
    if (cards.length === 0) return;
    void writeVCard(cards).then((text) =>
      download(text, groupFileName(groupNamed(value) ?? "Contacts")),
    );
  };

  // Cards dragged from the list: the whole selection when the row is in it.
  const dragCards = (event: DragEvent<HTMLElement>) => {
    const row = (event.target as Element).closest<HTMLElement>("[data-index]");
    const card = visible[Number(row?.dataset.index ?? -1)];
    if (!card) return;
    const cards = chosenCards.some(({ id }) => id === card.id) ? chosenCards : [card];
    event.dataTransfer.setData(CARDS_DRAG, JSON.stringify(cards.map(({ id }) => id)));
    event.dataTransfer.setData("text/plain", cards.map(displayName).join("\n"));
    // The names also leave as a vCard: text for a target in the page that reads it, and a file for
    // Chromium's drag off the browser. Without their pictures, which a drag cannot wait for.
    const text = cardsToVCard(cards.map((contact) => ({ contact })));
    event.dataTransfer.setData(VCARD_TYPE, text);
    const fileName = vCardFileName(cards);
    event.dataTransfer.setData(
      "DownloadURL",
      `${VCARD_TYPE}:${fileName}:data:${VCARD_TYPE};charset=utf-8,${encodeURIComponent(text)}`,
    );
    event.dataTransfer.effectAllowed = "copy";
    followCardDrag(cardDragItems(cards, text, fileName));
  };

  const groupDropProps = (each: ContactGroup) => {
    const value = GROUP + each.id;
    return {
      "data-drop-target": dropGroup === value ? "" : undefined,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!event.dataTransfer.types.includes(CARDS_DRAG)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDropGroup(value);
      },
      onDragLeave: () => setDropGroup(null),
      onDrop: (event: DragEvent<HTMLElement>) => {
        setDropGroup(null);
        const ids = draggedCards(event.dataTransfer.getData(CARDS_DRAG));
        if (ids.length === 0) return;
        event.preventDefault();
        setOwnGroups((now) => addToGroup(now, each.id, ids));
      },
    };
  };

  // Card > Add Field: the card is edited with the field among its rows, and the keyboard in it.
  const addField = (field: AddableField) => {
    if (!current || several) return;
    setSelected(current.id);
    if (!editing) editBegan.current = current;
    setEditing(true);
    setContacts((now) =>
      now.map((contact) => (contact.id === current.id ? withField(contact, field) : contact)),
    );
    setAddedField(field);
  };

  // A vCard file dropped on the list of names is imported, on the desktop.
  const dragOver = (event: DragEvent<HTMLDivElement>) => {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    const files = vCardFiles(event.dataTransfer.files);
    if (files.length === 0) return;
    event.preventDefault();
    const from = files.map((file) => file.name).join(", ");
    void readVCardFiles(files).then((cards) =>
      importWithNotice(cards, from, importCards, setNotice),
    );
  };

  // The sheets hang from the window's top edge: Contacts has no title bar to hang them from.
  const splitRef = useRef<HTMLDivElement>(null);
  const sheetAnchor = useMemo(
    () => () => {
      const element = splitRef.current;
      if (!element) return null;
      return {
        contextElement: element,
        getBoundingClientRect: () => {
          const box = element.getBoundingClientRect();
          return {
            x: box.left,
            y: box.top,
            left: box.left,
            top: box.top,
            right: box.right,
            bottom: box.top,
            width: box.width,
            height: 0,
          };
        },
      };
    },
    [],
  );

  const change = useCallback((next: Contact) => {
    setContacts((now) => now.map((contact) => (contact.id === next.id ? next : contact)));
  }, []);

  // Card > Open in New Window and a double click on a name: the cards in windows of their own.
  const [cardWindows, setCardWindows] = useState<readonly string[]>([]);
  const selectedBeforePress = useRef<readonly string[]>([]);
  const [cardWindowAsked, setCardWindowAsked] = useState<{ id: string; serial: number } | null>(
    null,
  );
  const openCardWindows = (ids: readonly string[]) => {
    setCardWindows((open) => [...open, ...ids.filter((id) => !open.includes(id))]);
    const last = ids.at(-1);
    if (last !== undefined) {
      setCardWindowAsked((asked) => ({ id: last, serial: (asked?.serial ?? 0) + 1 }));
    }
  };
  const [cardsEditedInWindows, setCardsEditedInWindows] = useState<readonly string[]>([]);
  // A card that is gone takes its window and its edit with it, and an Undo does not open it again.
  useEffect(() => {
    const exists = (id: string) => contacts.some((contact) => contact.id === id);
    const keep = (open: readonly string[]) => {
      const left = open.filter(exists);
      return left.length === open.length ? open : left;
    };
    setCardWindows(keep);
    setCardsEditedInWindows(keep);
    for (const id of windowEditBegan.current.keys()) {
      if (!exists(id)) windowEditBegan.current.delete(id);
    }
  }, [contacts]);
  const beginWindowEdit = (id: string) => {
    // One edit of a card at a time: the main window's ends here.
    if (id === currentId) finish();
    const card = latest.current.find((contact) => contact.id === id);
    if (!card) return;
    windowEditBegan.current.set(id, card);
    setCardsEditedInWindows((now) => [...now, id]);
  };
  const endWindowEdit = (id: string) => {
    const began = windowEditBegan.current.get(id);
    if (!began) return;
    const now = latest.current.find((contact) => contact.id === id);
    if (now && JSON.stringify(tidy(began)) !== JSON.stringify(tidy(now))) remember("Edit Card");
    windowEditBegan.current.delete(id);
    setCardsEditedInWindows((list) => list.filter((each) => each !== id));
    setContacts((list) => list.map((contact) => (contact.id === id ? tidy(contact) : contact)));
  };

  const renderRow = useCallback(
    (index: number) => {
      const contact = visible[index];
      if (!contact) return null;
      const [before, bold, after] = listNameParts(contact, sortBy, nameOrder);
      return (
        <span className="mac-contacts-entry">
          {before}
          <b className="mac-contacts-sort">{bold || "No Name"}</b>
          {after}
          {contact.me ? (
            <span className="mac-contacts-me">
              {/* The library's `user` image, at the 11 pt of the captured mark. */}
              <SystemImage name="user" width={11} height={11} />
              <span className="mac-contacts-hidden">, my card</span>
            </span>
          ) : null}
        </span>
      );
    },
    [visible, nameOrder, sortBy],
  );
  const getRowId = useCallback((index: number) => visible[index]?.id ?? index, [visible]);
  const getRowLabel = useCallback(
    (index: number) => {
      const contact = visible[index];
      if (!contact) return "";
      // The row's name is its label, so the mark of the user's own card is said here.
      return contact.me
        ? `${displayNameIn(contact, nameOrder)}, my card`
        : displayNameIn(contact, nameOrder);
    },
    [visible, nameOrder],
  );

  // Served by the desktop, the card's buttons reach the person through Messages, Mail or FaceTime.
  const act = (action: ContactAction, detail: ContactActionDetail) => {
    onAction?.(action, detail);
    if (!served || !detail.value) return;
    const name = displayName(detail.contact);
    const to = detail.value;
    if (action === "message") askToReach({ app: "messages", to, name });
    else if (action === "mail") askToReach({ app: "mail", to, name });
    else if (action === "video" || action === "call") {
      askToReach({
        app: "facetime",
        to: detail.contact.user ?? to,
        name,
        kind: action === "video" ? "video" : "audio",
      });
    } else if (action === "open") openUrl(to, "contacts");
    else if (action === "map") {
      askMapsSearch(to);
    } else if (action === "copy-label") void copyText(to);
    else if (action === "share") {
      const app = SHARE_APPS[to];
      if (app) shareWith(app, to, detail.contact);
    }
  };

  // The window has no title bar: the two strips are its drag regions, through the library's
  // helper (window.mdx, "Without a title bar").
  const dragRegion = windowDragRegion<HTMLDivElement>(
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
  );

  const groupName =
    ownGroup?.name ??
    smartGroup?.name ??
    GROUPS.find((item) => item.id === shown)?.name ??
    "Contacts";

  // The menu bar's Card and File menus: Edit Card and New Card, as the window's Edit and add
  // buttons. The rows change only with what they show; the commands are read when one is chosen.
  const commandsHandle = useRef<ContactsCommandsHandle>(null);
  const pictureInput = useRef<HTMLInputElement>(null);
  const cardCommands = useRef({
    edit,
    add,
    undo: () => {},
    redo: () => {},
    askDelete: () => {},
    step: (_by: 1 | -1) => {},
    find: () => {},
    goToMine: () => {},
    lookForDuplicates: () => {},
    mergeSelected: () => {},
    toggleCompany: () => {},
    choosePicture: () => {},
    editPicture: () => {},
    clearPicture: () => {},
    smartGroupFromSearch: () => {},
    print: () => {},
    openInWindows: () => {},
    copy: () => {},
    cut: () => {},
    paste: () => {},
    discard: () => {},
    makeMine: () => {},
    reorderNames: () => {},
    shareMine: (_app: string, _title: string) => {},
    exportArchive: () => {},
    cardText: (): string => "",
    selectAll: () => {},
    newGroup: (_fromSelection: boolean) => {},
    removeFromGroup: () => {},
    renameGroup: () => {},
    askDeleteGroup: () => {},
    toggleGroups: () => {},
    addField: (_field: AddableField) => {},
  });
  // The person's own card stays: the desktop makes it again from the account.
  const canDeleteCard = current !== null && !current.me;
  const canDeleteChosen = several ? chosenCards.some((card) => !card.me) : canDeleteCard;
  cardCommands.current = {
    edit,
    add,
    undo: () => {
      if (editing) inLastField("undo");
      else undo();
    },
    redo: () => {
      if (editing) inLastField("redo");
      else redo();
    },
    askDelete: () => {
      if (several) {
        const going = chosenCards.filter((card) => !card.me);
        if (going.length > 0) setDeletingMany(going);
        return;
      }
      if (canDeleteCard) setDeleting(current);
    },
    selectAll: () => {
      finish();
      setAlsoChosen(visible.filter((contact) => contact.id !== currentId).map(({ id }) => id));
    },
    step: (by) => {
      const at = visible.findIndex((contact) => contact.id === currentId);
      const next = visible[at + by];
      if (next) choose(next.id);
    },
    // The search field is in the list: Card Only shows the list, which is focused once it is there.
    find: () => {
      if (listShown) searchInput.current?.focus();
      else {
        searchAsked.current = true;
        setLayout("list");
      }
    },
    newGroup: (fromSelection) => {
      const cards = several ? chosenCards : current ? [current] : [];
      newGroup(fromSelection ? cards.map(({ id }) => id) : []);
    },
    removeFromGroup: removeFromShownGroup,
    renameGroup: () => {
      if (ownGroup || smartGroup) {
        setLayout("list");
        setGroupsHidden(false);
        setRenaming(shown);
      }
    },
    askDeleteGroup: () => {
      if (ownGroup || smartGroup) setDeletingGroup(shown);
    },
    toggleGroups: () => {
      if (groupsShown) setGroupsHidden(true);
      else {
        setLayout("list");
        setGroupsHidden(false);
      }
    },
    addField,
    goToMine: () => {
      const mine = contacts.find((contact) => contact.me);
      if (!mine) return;
      if (!holds(mine, shown)) show("all");
      setQuery("");
      choose(mine.id);
    },
    toggleCompany: () => {
      if (current) change({ ...current, isCompany: !current.isCompany || undefined });
    },
    choosePicture: () => pictureInput.current?.click(),
    editPicture: () => current && framePicture(current),
    clearPicture: () => {
      if (!current) return;
      void removePicture(current.id).catch(() =>
        setNotice({ message: "The picture could not be removed." }),
      );
    },
    smartGroupFromSearch: () => {
      const text = query.trim();
      if (text) addSmartGroup({ name: text, rule: "contains", text });
    },
    lookForDuplicates: () => {
      finish();
      setDuplicates(findDuplicates(contacts.map((each) => tidy(each))));
    },
    mergeSelected: () => {
      if (several) {
        finish();
        const cards = chosenCards;
        void merge(cards).then((merged) => {
          if (merged) setAlsoChosen([]);
        });
      }
    },
    openInWindows: () => {
      if (DesktopWindow === undefined || currentId === null) return;
      openCardWindows(several ? chosenCards.map(({ id }) => id) : [currentId]);
    },
    print: () => {
      if (current && !several) {
        printDocument({
          name: displayName(current),
          plain: false,
          lines: cardPrintLines(current),
        });
      }
    },
    copy: () => {
      if (several) {
        void copyText(cardsToVCard(chosenCards.map((contact) => ({ contact }))));
        return;
      }
      // Text selected on the card is what Copy copies; with none, the card.
      const text = window.getSelection()?.toString();
      if (text) void copyText(text);
      else if (current) void copyText(cardsToVCard([{ contact: current }]));
    },
    // Delete Card's cards, without its alert: they are on the clipboard, and Undo brings them back.
    // A picture does neither, so a card with one is asked about all the same.
    cut: () => {
      const going = (several ? chosenCards : current ? [current] : []).filter((card) => !card.me);
      const [first] = going;
      if (!first) return;
      void copyText(cardsToVCard(going.map((contact) => ({ contact })))).then((copied) => {
        if (!copied) {
          setNotice({ message: "The cards could not be put on the clipboard, so they stay." });
        } else if (!going.some((card) => card.image)) {
          void deleteCards(going, "Cut");
        } else if (going.length === 1) {
          setDeleting(first);
        } else {
          setDeletingMany(going);
        }
      });
    },
    paste: () => void pasteCards(),
    discard,
    makeMine,
    reorderNames,
    shareMine: (app, title) => {
      const mine = latest.current.find((contact) => contact.me);
      if (mine) shareWith(app, title, mine);
    },
    exportArchive: () => void exportArchive(),
    cardText: () => (current ? cardPrintLines(current).join(". ") : ""),
  };
  const hasMine = contacts.some((contact) => contact.me);
  const canEditCard = currentId !== null && !editing && !several;
  const canAddField = currentId !== null && !several;
  const canMakeMine = canAddField && current?.me !== true;
  const canShareMine = hasMine && served;
  const canReorder = canAddField && !!current?.first.trim() && !!current?.last.trim();
  const canOpenWindows = DesktopWindow !== undefined;
  const currentIsCompany = !!current?.isCompany;
  const currentHasPicture = !!current?.image;
  const inOwnGroup = ownGroup !== null;
  const namedGroupShown = ownGroup !== null || smartGroup !== null;
  const cardMenu = useMemo(
    () => (
      <>
        <MenuItem
          disabled={!canEditCard}
          keyEquivalent="command+l"
          onClick={() => cardCommands.current.edit()}
        >
          Edit Card
        </MenuItem>
        <MenuItem
          disabled={!editing}
          title={editing ? undefined : "Only a card being edited has changes to discard."}
          onClick={() => cardCommands.current.discard()}
        >
          Discard Changes
        </MenuItem>
        <Submenu>
          <SubmenuTrigger disabled={!canAddField}>Add Field</SubmenuTrigger>
          <SubmenuPopup>
            {ADD_FIELDS.map(({ field, title }) => (
              <MenuItem key={field} onClick={() => cardCommands.current.addField(field)}>
                {title}
              </MenuItem>
            ))}
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+]" onClick={() => cardCommands.current.step(1)}>
          Go to Next Card
        </MenuItem>
        <MenuItem keyEquivalent="command+[" onClick={() => cardCommands.current.step(-1)}>
          Go to Previous Card
        </MenuItem>
        <MenuItem
          disabled={!hasMine}
          title={hasMine ? undefined : "You have no card of your own."}
          onClick={() => cardCommands.current.goToMine()}
        >
          Go to My Card
        </MenuItem>
        <MenuItem
          disabled={!canMakeMine}
          title={canMakeMine ? undefined : "Choose one card that is not your own."}
          onClick={() => cardCommands.current.makeMine()}
        >
          Make This My Card
        </MenuItem>
        <Submenu>
          <SubmenuTrigger
            disabled={!canShareMine}
            title={canShareMine ? undefined : "Sign in to a desktop that has your card."}
          >
            Share My Card
          </SubmenuTrigger>
          <SubmenuPopup>
            {Object.entries(SHARE_APPS).map(([title, app]) => (
              <MenuItem key={app} onClick={() => cardCommands.current.shareMine(app, title)}>
                {title}
              </MenuItem>
            ))}
            <MenuItem disabled title={AIRDROP_REASON}>
              AirDrop
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuCheckboxItem
          disabled={!canAddField}
          checked={currentIsCompany}
          keyEquivalent="command+\\"
          onCheckedChange={() => cardCommands.current.toggleCompany()}
        >
          Mark as a Company
        </MenuCheckboxItem>
        <MenuItem disabled={!canReorder} onClick={() => cardCommands.current.reorderNames()}>
          Reorder Last Name Before First
        </MenuItem>
        <MenuItem
          disabled={!canAddField || !served}
          keyEquivalent="option+command+i"
          onClick={() => cardCommands.current.choosePicture()}
        >
          Choose Custom Image…
        </MenuItem>
        <MenuItem
          disabled={!canAddField || !currentHasPicture}
          onClick={() => cardCommands.current.editPicture()}
        >
          Edit Custom Image…
        </MenuItem>
        <MenuItem
          disabled={!canAddField || !currentHasPicture}
          onClick={() => cardCommands.current.clearPicture()}
        >
          Clear Custom Image
        </MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => cardCommands.current.lookForDuplicates()}>
          Look for Duplicates…
        </MenuItem>
        {canOpenWindows ? (
          <MenuItem
            disabled={currentId === null}
            keyEquivalent="command+i"
            onClick={() => cardCommands.current.openInWindows()}
          >
            Open in New Window
          </MenuItem>
        ) : null}
        <MenuItem
          disabled={!several}
          keyEquivalent="shift+command+\\"
          onClick={() => cardCommands.current.mergeSelected()}
        >
          Merge Selected Cards
        </MenuItem>
      </>
    ),
    [
      canEditCard,
      canAddField,
      editing,
      canMakeMine,
      canShareMine,
      canReorder,
      hasMine,
      several,
      served,
      currentIsCompany,
      currentHasPicture,
      currentId,
      canOpenWindows,
    ],
  );
  useDesktopAppMenu("contacts", "Card", cardMenu);
  const viewMenu = useMemo(
    () => (
      <>
        <MenuRadioGroup
          value={layout}
          onValueChange={(value) => setLayout(value as ContactsLayout)}
        >
          <MenuRadioItem value="card" keyEquivalent="command+2">
            Card Only
          </MenuRadioItem>
          <MenuRadioItem value="list" keyEquivalent="command+3">
            List and Card
          </MenuRadioItem>
        </MenuRadioGroup>
        <MenuItem keyEquivalent="command+1" onClick={() => cardCommands.current.toggleGroups()}>
          {groupsShown ? "Hide Groups" : "Show Groups"}
        </MenuItem>
        <MenuSeparator />
        <Submenu>
          <SubmenuTrigger>Sort By</SubmenuTrigger>
          <SubmenuPopup>
            <MenuRadioGroup
              value={sortBy}
              onValueChange={(value) => setSortBy(value as ContactSort)}
            >
              <MenuRadioItem value="first">First Name</MenuRadioItem>
              <MenuRadioItem value="last">Last Name</MenuRadioItem>
            </MenuRadioGroup>
          </SubmenuPopup>
        </Submenu>
        <MenuCheckboxItem
          checked={nameOrder === "last"}
          onCheckedChange={(on) => setNameOrder(on ? "last" : "first")}
        >
          Display Last Name Before First
        </MenuCheckboxItem>
      </>
    ),
    [sortBy, setSortBy, nameOrder, setNameOrder, layout, setLayout, groupsShown],
  );
  useDesktopAppMenu("contacts", "View", viewMenu);
  const newCardMenu = useMemo(
    () => (
      <>
        <MenuItem keyEquivalent="command+n" onClick={() => cardCommands.current.add()}>
          New Card
        </MenuItem>
        <MenuItem
          keyEquivalent="shift+command+n"
          onClick={() => cardCommands.current.newGroup(false)}
        >
          New Group
        </MenuItem>
        <MenuItem disabled={currentId === null} onClick={() => cardCommands.current.newGroup(true)}>
          New Group from Selection
        </MenuItem>
        <MenuItem
          disabled={!served}
          keyEquivalent="option+command+n"
          onClick={() => commandsHandle.current?.newSmartGroup()}
        >
          New Smart Group…
        </MenuItem>
        <MenuItem
          disabled={!served || query.trim() === ""}
          onClick={() => cardCommands.current.smartGroupFromSearch()}
        >
          New Smart Group from Current Search
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled
          keyEquivalent="command+s"
          title="Contacts saves every change as it is made."
        >
          Save
        </MenuItem>
        <MenuItem
          disabled={!served}
          keyEquivalent="command+o"
          onClick={() => commandsHandle.current?.importFile()}
        >
          Import…
        </MenuItem>
        <Submenu>
          <SubmenuTrigger disabled={!served}>Export</SubmenuTrigger>
          <SubmenuPopup>
            <MenuItem
              disabled={currentId === null}
              onClick={() => commandsHandle.current?.exportShown()}
            >
              Export vCard…
            </MenuItem>
            <MenuItem onClick={() => commandsHandle.current?.exportAll()}>
              Export All Cards as vCard…
            </MenuItem>
            <MenuItem onClick={() => cardCommands.current.exportArchive()}>
              Contacts Archive…
            </MenuItem>
          </SubmenuPopup>
        </Submenu>
        <MenuSeparator />
        <MenuItem disabled={currentId === null} onClick={() => cardCommands.current.print()}>
          Export as PDF…
        </MenuItem>
        <MenuItem
          disabled={currentId === null}
          keyEquivalent="command+p"
          onClick={() => cardCommands.current.print()}
        >
          Print…
        </MenuItem>
      </>
    ),
    [currentId, served, query],
  );
  useDesktopAppMenu("contacts", "File", newCardMenu);
  const dockMenu = useMemo(
    () => <MenuItem onClick={() => cardCommands.current.add()}>New Card</MenuItem>,
    [],
  );
  useDesktopAppMenu("contacts", "Dock", dockMenu);
  const undoLabel = undoStack.at(-1)?.label;
  const redoLabel = redoStack.at(-1)?.label;
  const editMenu = useMemo(
    () => (
      <>
        <MenuItem
          disabled={!editing && undoStack.length === 0}
          keyEquivalent="command+z"
          onClick={() => cardCommands.current.undo()}
        >
          {!editing && undoLabel ? `Undo ${undoLabel}` : "Undo"}
        </MenuItem>
        <MenuItem
          disabled={!editing && redoStack.length === 0}
          keyEquivalent="shift+command+z"
          onClick={() => cardCommands.current.redo()}
        >
          {!editing && redoLabel ? `Redo ${redoLabel}` : "Redo"}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          disabled={!canDeleteChosen || editing}
          title={
            editing ? "While a card is edited, Cut is the key's, on the text selected." : undefined
          }
          keyEquivalent="command+x"
          onClick={() => cardCommands.current.cut()}
        >
          Cut
        </MenuItem>
        <MenuItem
          disabled={currentId === null || editing}
          title={
            editing ? "While a card is edited, Copy is the key's, on the text selected." : undefined
          }
          keyEquivalent="command+c"
          onClick={() => cardCommands.current.copy()}
        >
          Copy
        </MenuItem>
        <MenuItem
          disabled={editing}
          title={editing ? "While a card is edited, Paste is the key's, in the field." : undefined}
          keyEquivalent="command+v"
          onClick={() => cardCommands.current.paste()}
        >
          Paste
        </MenuItem>
        <MenuItem disabled={!canDeleteChosen} onClick={() => cardCommands.current.askDelete()}>
          {several ? `Delete ${chosenCards.length} Cards` : "Delete Card"}
        </MenuItem>
        <MenuItem
          disabled={!inOwnGroup || currentId === null}
          onClick={() => cardCommands.current.removeFromGroup()}
        >
          Remove from Group
        </MenuItem>
        <MenuItem
          disabled={!smartGroup}
          onClick={() => smartGroup && commandsHandle.current?.editSmartGroup(smartGroup)}
        >
          Edit Smart Group…
        </MenuItem>
        <MenuItem disabled={!namedGroupShown} onClick={() => cardCommands.current.renameGroup()}>
          Rename Group
        </MenuItem>
        <MenuItem disabled={!namedGroupShown} onClick={() => cardCommands.current.askDeleteGroup()}>
          Delete Group
        </MenuItem>
        <MenuItem keyEquivalent="command+a" onClick={() => cardCommands.current.selectAll()}>
          Select All
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+f" onClick={() => cardCommands.current.find()}>
          Find
        </MenuItem>
        {textTools.spelling}
        <ContactsTextRows
          field={() => lastField.current}
          wholeCard={() => cardCommands.current.cardText()}
        />
      </>
    ),
    [
      canDeleteChosen,
      currentId,
      editing,
      several,
      chosenCards,
      inOwnGroup,
      namedGroupShown,
      smartGroup,
      undoStack.length,
      redoStack.length,
      undoLabel,
      redoLabel,
      textTools.spelling,
    ],
  );
  useDesktopAppMenu("contacts", "Edit", editMenu);
  const accountsMenu = useMemo(
    () => (
      <MenuItem
        onClick={() => {
          requestPane("internet-accounts");
          requestDesktopEffects([{ open: "system-preferences" }]);
        }}
      >
        Accounts…
      </MenuItem>
    ),
    [],
  );
  useDesktopAppMenu("contacts", "Contacts", accountsMenu);
  useMainWindowItem("contacts", "Contacts");
  const [splitElement, setSplitElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => setSplitElement(splitRef.current), []);
  // A vCard file dragged from Finder or the desktop anywhere onto the window.
  const takeVCards = useRef((_items: DesktopDragItem[]) => {});
  takeVCards.current = (items) => {
    const from = items.map((item) => item.name).join(", ");
    void filesOfDrag(items)
      .then(readVCardFiles)
      .then((cards) => importWithNotice(cards, from, importCards, setNotice))
      .catch(() => setNotice({ message: `“${from}” could not be read.` }));
  };
  useEffect(() => {
    if (!served || !splitElement) return;
    return registerDropTarget({
      element: splitElement,
      landing: (_hit, drag) =>
        vCardLanding(
          splitElement,
          drag,
          (items) => takeVCards.current(items),
          (message) => setNotice({ message }),
        ),
    });
  }, [served, splitElement]);
  useEffect(() => {
    if (!splitElement) return;
    const note = ({ target }: FocusEvent) => {
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        lastField.current = target;
      }
    };
    splitElement.addEventListener("focusin", note);
    return () => splitElement.removeEventListener("focusin", note);
  }, [splitElement]);
  useWindowKeys(splitElement, state === "key", [
    { equivalent: "command+z", notInText: true, run: () => cardCommands.current.undo() },
    { equivalent: "shift+command+z", notInText: true, run: () => cardCommands.current.redo() },
    { equivalent: "shift+command+\\", run: () => several && cardCommands.current.mergeSelected() },
    { equivalent: "command+\\", run: () => canAddField && cardCommands.current.toggleCompany() },
    {
      equivalent: "option+command+i",
      run: () => canAddField && served && cardCommands.current.choosePicture(),
    },
    {
      equivalent: "option+command+n",
      run: () => served && commandsHandle.current?.newSmartGroup(),
    },
    { equivalent: "command+o", run: () => served && commandsHandle.current?.importFile() },
    { equivalent: "command+n", run: () => cardCommands.current.add() },
    { equivalent: "shift+command+n", run: () => cardCommands.current.newGroup(false) },
    { equivalent: "command+1", run: () => cardCommands.current.toggleGroups() },
    { equivalent: "command+2", run: () => setLayout("card") },
    { equivalent: "command+3", run: () => setLayout("list") },
    { equivalent: "command+p", run: () => cardCommands.current.print() },
    { equivalent: "command+i", run: () => cardCommands.current.openInWindows() },
    {
      equivalent: "command+c",
      // While a card is edited, a field's own text is the browser's to copy, by its key.
      run: () => {
        if (!editing) cardCommands.current.copy();
      },
      notInText: true,
    },
    {
      equivalent: "command+x",
      run: () => {
        if (!editing) cardCommands.current.cut();
      },
      notInText: true,
    },
    {
      equivalent: "command+v",
      run: () => {
        if (!editing) cardCommands.current.paste();
      },
      notInText: true,
    },
    { equivalent: "command+l", run: () => canEditCard && cardCommands.current.edit() },
    {
      equivalent: "command+a",
      run: () => {
        if (!editing) cardCommands.current.selectAll();
      },
      notInText: true,
    },
    { equivalent: "command+f", run: () => cardCommands.current.find() },
    { equivalent: "command+]", run: () => cardCommands.current.step(1) },
    { equivalent: "command+[", run: () => cardCommands.current.step(-1) },
  ]);
  // The window controls lie over the first pane that is shown.
  const windowTop = (
    <div className="mac-contacts-top" {...dragRegion}>
      <WindowControls
        onClose={onClose}
        onMinimize={onMinimize}
        onZoom={onZoom}
        zoomRole={zoomRole}
        minimizeDisabled={minimizeDisabled}
        zoomDisabled={zoomDisabled}
        {...controlsProps}
        // After the spread: a class of the owner's is added to the one that places the
        // controls, and does not take its place.
        className={
          controlsProps?.className
            ? `mac-contacts-controls ${controlsProps.className}`
            : "mac-contacts-controls"
        }
      />
    </div>
  );
  const groupRow = (value: string, name: string, extra?: object) => (
    <SidebarItem
      key={value}
      value={value}
      data-contacts-group={value}
      onDoubleClick={() => setRenaming(value)}
      label={
        renaming === value ? (
          <GroupNameField name={name} onDone={(typed) => endRename(value, typed)} />
        ) : (
          name
        )
      }
      {...extra}
    />
  );
  const menuIsNamed =
    menuGroup !== null && (menuGroup.startsWith(GROUP) || menuGroup.startsWith(SMART));
  const commands = served ? (
    <ContactsCommands
      handle={commandsHandle}
      contacts={contacts}
      current={current}
      selectedCards={chosenCards}
      account={desktop.account}
      smartGroup={smartGroup}
      anchor={sheetAnchor}
      onAddUser={addDesktopUser}
      onImport={importCards}
      onArchive={(archive, from) => setReplacing({ archive, from })}
      onAddSmartGroup={addSmartGroup}
      onDeleteSmartGroup={(id) => setDeletingGroup(SMART + id)}
      onChangeSmartGroup={changeSmartGroup}
      onInviteToChess={
        current?.user && current.user !== desktop.account?.name
          ? () =>
              askToReach({
                app: "chess",
                to: current.user ?? "",
                name: displayName(current),
              })
          : null
      }
      onNotice={setNotice}
      ready={served && !loading}
    />
  ) : undefined;
  return (
    <Window
      {...textTools.handlers}
      aria-label="Contacts"
      state={state}
      width={width}
      height={height}
      className={className ? `mac-contacts ${className}` : "mac-contacts"}
      // No title bar draws the highlight rows along the top edge, so the window does: in Dark
      // Aqua the capture's top line is #707171 over #5d5e5e where the sides are #4b4c4d.
      topHighlight
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key !== "Delete" && event.key !== "Backspace") return;
        const target = event.target as HTMLElement;
        if (target.isContentEditable || target.matches("input, textarea, select")) return;
        // In the groups, the key is for the group shown.
        if (namedGroupShown && target.closest(".mac-contacts-sidebar")) {
          event.preventDefault();
          cardCommands.current.askDeleteGroup();
          return;
        }
        if (editing) return;
        event.preventDefault();
        cardCommands.current.askDelete();
      }}
      {...props}
    >
      <SplitView
        ref={splitRef}
        className="mac-contacts-split"
        style={SPLIT}
        inert={loading || undefined}
        aria-busy={loading || undefined}
      >
        {groupsShown ? (
          <>
            <SplitViewPane
              size={sidebarWidth}
              onSizeChange={setSidebarWidth}
              minSize={150}
              maxSize={320}
              className="mac-contacts-sidebar-pane"
            >
              {windowTop}
              <ContextualMenu>
                <ContextualMenuTrigger
                  className="mac-contacts-menu-area"
                  onContextMenu={(event) => {
                    const row = (event.target as Element).closest<HTMLElement>(
                      "[data-contacts-group]",
                    );
                    if (!row) {
                      event.preventBaseUIHandler();
                      return;
                    }
                    setMenuGroup(row.dataset.contactsGroup ?? null);
                  }}
                >
                  <Sidebar
                    aria-label="Groups"
                    className="mac-contacts-sidebar"
                    material={material}
                    style={GROUPS_STYLE}
                    value={shown}
                    onValueChange={show}
                  >
                    {/* Room for the window controls: the demo's own element before the first row,
                        17 pt, which with the tree's 5 pt puts that row 22 pt under the window's top.
                        The sidebar itself is not padded or restyled. */}
                    <div role="presentation" className="mac-contacts-controls-room" />
                    <SidebarItem value="all" data-contacts-group="all" label="All Contacts" />
                    {accountsOff.includes("icloud") ? null : (
                      <SidebarSection title="iCloud">
                        <SidebarItem
                          value="icloud"
                          data-contacts-group="icloud"
                          label="All iCloud"
                        />
                      </SidebarSection>
                    )}
                    {accountsOff.includes("mac") ? null : (
                      <SidebarSection title="On My Mac">
                        <SidebarItem value="mac" data-contacts-group="mac" label="All on My Mac" />
                      </SidebarSection>
                    )}
                    {ownGroups.length > 0 ? (
                      <SidebarSection title="Groups">
                        {sortGroups(ownGroups).map((each) =>
                          groupRow(GROUP + each.id, each.name, groupDropProps(each)),
                        )}
                      </SidebarSection>
                    ) : null}
                    {served && smartGroups.length > 0 ? (
                      <SidebarSection title="Smart Groups">
                        {smartGroups.map((each) => groupRow(SMART + each.id, each.name))}
                      </SidebarSection>
                    ) : null}
                  </Sidebar>
                </ContextualMenuTrigger>
                <ContextualMenuPopup aria-label="Group commands">
                  <MenuItem
                    disabled={!menuGroup?.startsWith(SMART)}
                    onClick={() => {
                      const group = smartGroups.find((each) => SMART + each.id === menuGroup);
                      if (group) commandsHandle.current?.editSmartGroup(group);
                    }}
                  >
                    Edit Smart Group…
                  </MenuItem>
                  <MenuItem
                    disabled={!menuIsNamed}
                    onClick={() => menuGroup && setRenaming(menuGroup)}
                  >
                    Rename Group
                  </MenuItem>
                  <MenuItem
                    disabled={!menuIsNamed}
                    onClick={() => menuGroup && setDeletingGroup(menuGroup)}
                  >
                    Delete Group
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    disabled={
                      menuGroup === null || !contacts.some((card) => holds(card, menuGroup))
                    }
                    onClick={() => menuGroup && exportGroup(menuGroup)}
                  >
                    Export Group…
                  </MenuItem>
                </ContextualMenuPopup>
              </ContextualMenu>
            </SplitViewPane>
            <SplitViewDivider aria-label="Resize the groups" />
          </>
        ) : null}
        {listShown ? (
          <>
            <SplitViewPane
              size={listWidth}
              onSizeChange={setListWidth}
              minSize={140}
              maxSize={320}
              className="mac-contacts-list-pane"
              onDragOver={served ? dragOver : undefined}
              onDrop={served ? drop : undefined}
            >
              {groupsShown ? null : windowTop}
              <div className="mac-contacts-search-strip" {...dragRegion}>
                <SearchField
                  className="mac-contacts-search"
                  style={SEARCH}
                  value={query}
                  inputRef={searchInput}
                  onValueChange={(next) => search(next)}
                />
              </div>
              {visible.length === 0 ? (
                <EmptyState role={searching ? "status" : undefined} className="mac-contacts-empty">
                  {searching ? "No Results" : "No Cards"}
                </EmptyState>
              ) : (
                <ContextualMenu>
                  <ContextualMenuTrigger
                    className="mac-contacts-menu-area"
                    onContextMenu={(event) => {
                      // The row under the pointer is what the commands act on, with the names
                      // selected beside it when it is one of them.
                      const row = (event.target as Element).closest<HTMLElement>("[data-index]");
                      const card = visible[Number(row?.dataset.index ?? -1)];
                      if (!card) return;
                      const chosen = several
                        ? chosenCards.some(({ id }) => id === card.id)
                        : card.id === currentId;
                      if (!chosen) choose(card.id);
                      // Names no longer listed are not chosen beside the one under the pointer.
                      else if (!several) setAlsoChosen([]);
                    }}
                    // The first press of a double click leaves one name selected: what was selected
                    // before it is what opens, when the name is among them.
                    onMouseDownCapture={(event) => {
                      if (event.detail === 1) {
                        selectedBeforePress.current = chosenCards.map(({ id }) => id);
                      }
                    }}
                    onDoubleClick={(event) => {
                      if (DesktopWindow === undefined) return;
                      const row = (event.target as Element).closest<HTMLElement>("[data-index]");
                      const card = visible[Number(row?.dataset.index ?? -1)];
                      if (!card) return;
                      const before = selectedBeforePress.current;
                      openCardWindows(before.includes(card.id) ? before : [card.id]);
                    }}
                  >
                    <ListView
                      className="mac-contacts-list"
                      aria-label={groupName}
                      count={visible.length}
                      rowHeight={24}
                      separatorInset={29}
                      renderRow={renderRow}
                      getRowId={getRowId}
                      getRowLabel={getRowLabel}
                      selectionMode="multiple"
                      rowDraggable
                      onDragStart={dragCards}
                      value={
                        chosenCards.length > 0
                          ? chosenCards.map(({ id }) => id)
                          : currentId === null
                            ? []
                            : [currentId]
                      }
                      onValueChange={(next) => {
                        const ids = next.filter((id): id is string => typeof id === "string");
                        const [first] = ids;
                        if (first === undefined) return;
                        // The card shown stays while it is among them, so its edit ends only on
                        // leaving.
                        const lead =
                          currentId !== null && ids.includes(currentId) ? currentId : first;
                        setAlsoChosen([]);
                        if (ids.length > 1) finish();
                        choose(lead);
                        setAlsoChosen(ids.filter((id) => id !== lead));
                      }}
                    />
                  </ContextualMenuTrigger>
                  <ContextualMenuPopup aria-label="Card commands">
                    {canOpenWindows ? (
                      <MenuItem onClick={() => cardCommands.current.openInWindows()}>
                        Open in New Window
                      </MenuItem>
                    ) : null}
                    <MenuItem disabled={!canEditCard} onClick={() => cardCommands.current.edit()}>
                      Edit Card
                    </MenuItem>
                    <MenuItem
                      disabled={several ? !chosenCards.some((card) => !card.me) : !canDeleteCard}
                      onClick={() => cardCommands.current.askDelete()}
                    >
                      {several ? `Delete ${chosenCards.length} Cards` : "Delete Card"}
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem onClick={() => cardCommands.current.newGroup(true)}>
                      New Group from Selection
                    </MenuItem>
                    {inOwnGroup ? (
                      <MenuItem onClick={() => cardCommands.current.removeFromGroup()}>
                        Remove from Group
                      </MenuItem>
                    ) : null}
                  </ContextualMenuPopup>
                </ContextualMenu>
              )}
            </SplitViewPane>
            <SplitViewDivider aria-label="Resize the list of names" />
          </>
        ) : null}
        <SplitViewPane minSize={420} className="mac-contacts-card">
          {listShown ? null : windowTop}
          {several ? (
            <>
              <EmptyState role="status" className="mac-contacts-empty">
                {chosenCards.length} Cards
              </EmptyState>
              {commands ? <div className="mac-contacts-several-bar">{commands}</div> : null}
            </>
          ) : (
            <ContactCard
              nameOrder={nameOrder}
              key={currentId}
              contact={current}
              editing={editing}
              focusName={added !== null && added === currentId}
              focusField={addedField}
              services={services}
              onChange={change}
              onEdit={edit}
              onDone={done}
              onAdd={() => add()}
              onAction={act}
              imageUrl={served ? pictures.urlOf(current) : undefined}
              pictureCommands={
                served && current ? (
                  <ContactPictureCommands
                    hasPicture={current.image !== undefined}
                    onPicture={(url, source) => {
                      pictureSources.current.set(current.id, source);
                      return keepPicture(current.id, url);
                    }}
                    onRemove={() => removePicture(current.id)}
                    onNotice={setNotice}
                  />
                ) : undefined
              }
              barCommands={commands}
              onEditPicture={served && current ? () => framePicture(current) : undefined}
              onPictureFile={
                served && current ? (file) => takePictureFile(current.id, file) : undefined
              }
              valueCommands={(text) => (
                <>
                  <MenuItem
                    onClick={() => {
                      setLayout("list");
                      search(text);
                    }}
                  >
                    Search in Contacts
                  </MenuItem>
                  <MenuItem
                    disabled={lookUpWord(text) === undefined}
                    title={
                      lookUpWord(text) === undefined
                        ? "Dictionary looks up words, and this is not one."
                        : undefined
                    }
                    onClick={() => lookUp(text)}
                  >
                    Look Up
                  </MenuItem>
                  <Submenu>
                    <SubmenuTrigger>Add to</SubmenuTrigger>
                    <SubmenuPopup>
                      <MenuItem onClick={() => add(fieldsOfValue(text))}>New Card</MenuItem>
                      <MenuItem
                        disabled={!isEmailValue(text)}
                        title={isEmailValue(text) ? undefined : NOT_AN_EMAIL}
                        onClick={() => addMailVip(text)}
                      >
                        VIPs
                      </MenuItem>
                    </SubmenuPopup>
                  </Submenu>
                </>
              )}
            />
          )}
        </SplitViewPane>
      </SplitView>
      <Alert open={deletingGroup !== null} onOpenChange={(open) => !open && setDeletingGroup(null)}>
        <AlertPopup>
          <AlertMessage>
            Are you sure you want to delete the group {"\u201c"}
            {groupNamed(deletingGroup)}
            {"\u201d"}?
          </AlertMessage>
          <AlertInformativeText>Its cards stay in All Contacts.</AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                if (deletingGroup) deleteGroup(deletingGroup);
              }}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={duplicates !== null} onOpenChange={(open) => !open && setDuplicates(null)}>
        <AlertPopup>
          {duplicates && duplicates.sets.length + duplicates.entries.length > 0 ? (
            <>
              <AlertMessage>
                Contacts found {duplicates.sets.flat().length} cards with the same name and{" "}
                {duplicates.entryCount} duplicate entries.
              </AlertMessage>
              <AlertInformativeText>
                Merging puts everything those cards hold on one card, and removes the entries a card
                holds twice. Edit &gt; Undo takes back each merge.
              </AlertInformativeText>
              <AlertButtons>
                <AlertClose>Cancel</AlertClose>
                <AlertClose
                  render={<DefaultButton />}
                  onClick={() => {
                    setAlsoChosen([]);
                    void mergeDuplicates();
                  }}
                >
                  Merge
                </AlertClose>
              </AlertButtons>
            </>
          ) : (
            <>
              <AlertMessage>Contacts found no duplicates.</AlertMessage>
              <AlertButtons>
                <AlertClose render={<DefaultButton />}>OK</AlertClose>
              </AlertButtons>
            </>
          )}
        </AlertPopup>
      </Alert>
      <Alert open={deletingMany !== null} onOpenChange={(open) => !open && setDeletingMany(null)}>
        <AlertPopup>
          <AlertMessage>
            Are you sure you want to delete these {deletingMany?.length ?? 0} cards?
          </AlertMessage>
          <AlertInformativeText>
            Edit &gt; Undo brings them back, without their pictures.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                const going = deletingMany ?? [];
                setAlsoChosen([]);
                void deleteCards(going, "Delete Cards");
              }}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertPopup>
          <AlertMessage>
            Are you sure you want to delete the card {"\u201c"}
            {deleting ? displayName(deleting) : ""}
            {"\u201d"}?
          </AlertMessage>
          <AlertInformativeText>
            Edit &gt; Undo brings it back, without its picture.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                if (deleting) void deleteCards([deleting], "Delete Card");
              }}
            >
              Delete
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <ContactsNoticeAlert notice={notice} onClose={() => setNotice(null)} />
      {textTools.panels}
      {framingPicture ? (
        <ContactPictureEditor
          key={framingPicture.id}
          source={framingPicture.source}
          anchor={sheetAnchor}
          onCancel={() => setFramingPicture(null)}
          onSave={(url) => {
            const { id } = framingPicture;
            setFramingPicture(null);
            void keepPicture(id, url).catch(() =>
              setNotice({ message: "The picture could not be kept." }),
            );
          }}
        />
      ) : null}
      <Alert open={replacing !== null} onOpenChange={(open) => !open && setReplacing(null)}>
        <AlertPopup>
          <AlertMessage>
            Are you sure you want to replace your contacts with {"\u201c"}
            {replacing?.from}
            {"\u201d"}?
          </AlertMessage>
          <AlertInformativeText>
            Every card and group here gives way to the archive&apos;s. This cannot be undone.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose>Cancel</AlertClose>
            <AlertClose
              render={<DefaultButton />}
              onClick={() => {
                if (replacing) void replaceWithArchive(replacing.archive);
              }}
            >
              Replace
            </AlertClose>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      {DesktopWindow
        ? cardWindows.flatMap((id) => {
            const card = contacts.find((contact) => contact.id === id);
            if (!card) return [];
            // However the window is closed, an edit in it ends as with Done.
            const closeCard = () => {
              endWindowEdit(id);
              setCardWindows((open) => open.filter((each) => each !== id));
            };
            return [
              <DesktopWindow
                key={id}
                id={`card-${id}`}
                title={displayNameIn(card, nameOrder)}
                defaultSize={{ width: 480, height: 520 }}
                minSize={{ width: 420, height: 280 }}
                onClose={closeCard}
                render={({
                  onClose: close,
                  onMinimize: minimize,
                  onZoom: zoom,
                  zoomRole: role,
                  minimizeDisabled: noMinimize,
                  zoomDisabled: noZoom,
                  onDragRegionPointerDown: move,
                  onDragRegionDoubleClick: zoomFromBar,
                  ...windowProps
                }) => (
                  <ContactCardWindow
                    {...windowProps}
                    contact={card}
                    editing={cardsEditedInWindows.includes(id)}
                    nameOrder={nameOrder}
                    services={services}
                    imageUrl={served ? pictures.urlOf(card) : undefined}
                    pictureCommands={
                      served ? (
                        <ContactPictureCommands
                          hasPicture={card.image !== undefined}
                          onPicture={(url) => keepPicture(card.id, url)}
                          onRemove={() => removePicture(card.id)}
                          onNotice={setNotice}
                        />
                      ) : undefined
                    }
                    onCardChange={change}
                    onPictureFile={served ? (file) => takePictureFile(card.id, file) : undefined}
                    onEditBegin={() => beginWindowEdit(id)}
                    onEditEnd={() => endWindowEdit(id)}
                    onAdd={() => add()}
                    onAction={act}
                    onPrint={() =>
                      printDocument({
                        name: displayName(card),
                        plain: false,
                        lines: cardPrintLines(card),
                      })
                    }
                    controlsProps={{
                      onClose: close,
                      onMinimize: minimize,
                      onZoom: zoom,
                      zoomRole: role,
                      minimizeDisabled: noMinimize,
                      zoomDisabled: noZoom,
                    }}
                    onDragRegionPointerDown={move}
                    onDragRegionDoubleClick={zoomFromBar}
                  />
                )}
              />,
            ];
          })
        : null}
      {DesktopWindow && cardWindowAsked ? (
        <BringForward
          key={cardWindowAsked.serial}
          windowId={`contacts:card-${cardWindowAsked.id}`}
        />
      ) : null}
      <input
        ref={pictureInput}
        type="file"
        accept="image/*"
        hidden
        aria-label="Picture file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file || !currentId) return;
          const id = currentId;
          takePictureFile(id, file);
        }}
      />
    </Window>
  );
}

/** Brings a window the desktop hosts forward once, when it is rendered. */
function BringForward({ windowId }: { windowId: string }) {
  const store = useWindowManagerStore();
  useEffect(() => store.commands.focus(windowId), [store, windowId]);
  return null;
}
