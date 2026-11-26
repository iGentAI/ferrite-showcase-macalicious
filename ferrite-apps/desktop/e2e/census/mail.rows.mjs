// Mail's census rows (round 3, R6). Each row: id, window (window_or_state; `menu:<title>` for menu-bar items), role,
// name (plain text, or /regex/ for one kind of repeated control), how (how it is reached), expected, persists, and
// for a control that is visibly unavailable `cell: "unavailable:<reason>"` with `dimmed: true`. Verified by
// e2e/mail-census-journey.mjs; matched to R8's crawl by role and name (campaign/round3/r8/census-matching.md).

import { chromeRows, commonRows } from "../r6-common.mjs";

/** The reason Markup and Photo Browser show where files can be attached (demos/mail/mail-compose.tsx MARKUP_UNAVAILABLE). */
export const MARKUP =
  "Not available yet: attach a picture with Attach, or drag it here from Finder.";
/** The reason Include Original Message shows (demos/mail/mail-compose.tsx INCLUDE_ORIGINAL_UNAVAILABLE). */
export const INCLUDE_ORIGINAL =
  "There is no original message to take out or put back: this is a new message, a forward or a saved draft.";
/** The refusal a send to an outside address shows (demos/mail/mail-live.tsx). */
/** Why Drafts is never a destination of Move to… (demos/mail/mail.tsx MOVE_TO_DRAFTS_UNAVAILABLE). */
export const MOVE_TO_DRAFTS =
  "Only a draft you save is kept in Drafts: a message cannot be moved there.";
/** Why a draft cannot be archived, filed as junk or moved but to the Trash (demos/mail/mail.tsx DRAFT_MOVE_UNAVAILABLE). */
export const DRAFT_MOVE = "A draft can only be deleted: send it, or move it to the Trash.";
export const OUTSIDE =
  /This desktop delivers mail only to its own accounts \(name@macalicious\); it has no internet mail provider for/;

const V = "Mail viewer window";
const C = "New Message window";
const P = "Mail Preferences window";
const row = (id, window, role, name, how, expected, extra = {}) => ({
  id: `mail.${id}`,
  window,
  role,
  name,
  how,
  expected,
  ...extra,
});
const self = (id, menuName, text) =>
  row(
    id,
    `menu:${menuName}`,
    "menuitem",
    text,
    `menu bar ${menuName} (mouse)`,
    "dimmed; its own text is the reason",
    { cell: `unavailable:${text}`, dimmed: true, selfReason: true },
  );

/** Mail Preferences > General pop-ups and the option each step chooses (demos/mail/mail-data.ts GENERAL_CHOICES). */
export const PREF_CHOICES = [
  ["Default email reader:", "Mail"],
  ["Check for new messages:", "Every 5 minutes"],
  ["New messages sound:", "Glass"],
  ["Dock unread count:", "All Mailboxes"],
  ["New message notifications:", "VIPs"],
  ["Downloads folder:", "Desktop"],
  ["Remove unedited downloads:", "Never"],
];
/** Mail Preferences checkboxes by pane (GENERAL_CHECKS, SEARCH_CHECKS, OTHER_PANES). */
export const PREF_CHECKS = [
  ["General", "Play sounds for other mail actions"],
  ["General", "Archive or delete muted messages"],
  ["General", "Add invitations to Calendar automatically"],
  ["General", "Automatically try sending later if outgoing server is unavailable"],
  ["General", "Prefer opening messages in split view when in full screen"],
  ["General", "Trash"],
  ["General", "Junk"],
  ["General", "Encrypted Messages"],
  ["Accounts", "Enable this account"],
  ["Accounts", "Download attachments automatically"],
  ["Accounts", "Send large attachments with Mail Drop"],
  ["Junk Mail", "Enable junk mail filtering"],
  ["Junk Mail", "Exempt senders who are in my Contacts"],
  ["Junk Mail", "Exempt senders I have written to before"],
  ["Junk Mail", "Trust junk mail headers in messages"],
  ["Fonts & Colors", "Use fixed-width font for plain text messages"],
  ["Fonts & Colors", "Color quoted text"],
  ["Viewing", "Show most recent message at the top"],
  ["Viewing", "Show To/Cc label in the message list"],
  ["Viewing", "Show contact photos in the message list"],
  ["Viewing", "Load remote content in messages"],
  ["Viewing", "Use Smart Addresses"],
  ["Composing", "Check spelling as I type"],
  ["Composing", "Automatically Cc myself"],
  ["Composing", "When sending to a group, show all member addresses"],
  ["Composing", "Quote the text of the original message"],
  ["Signatures", "Place signature above quoted text"],
  ["Signatures", "Always match my default message font (Helvetica 12)"],
];

export const FLAG_COLORS = ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Gray"];
export const MAILBOX_NAMES = ["Inbox", "Drafts", "Sent", "Junk", "Trash", "Archive"];

export const ROWS = [
  ...commonRows("mail", "Mail", {
    prefs: "window",
    windowItem: "Mail",
  }),
  ...chromeRows("mail", "viewer", V),
  ...chromeRows("mail", "compose", C),
  self("menu.format-none", "Format", "This demo has no Format commands"),

  // The viewer's toolbar.
  row(
    "viewer.get-mail",
    V,
    "button",
    "Get Mail",
    "toolbar Get Mail (mouse) in the open Inbox",
    "mail another account sent appears in the open Inbox, unread, without a reload",
    { persists: "restart" },
  ),
  row(
    "viewer.new-message",
    V,
    "button",
    "New Message",
    "toolbar New Message (mouse)",
    "a New Message window opens",
  ),
  row(
    "viewer.archive",
    V,
    "button",
    "Archive",
    "select a message, toolbar Archive",
    "it moves to Archive, which appears in the sidebar",
    { persists: "restart" },
  ),
  row(
    "viewer.delete",
    V,
    "button",
    "Delete",
    "select a message, toolbar Delete",
    "it moves to the Trash, which appears in the sidebar",
    { persists: "restart" },
  ),
  row(
    "trash.erase",
    `${V}, Trash mailbox`,
    "button",
    "Delete",
    "in the Trash, select a message, toolbar Delete",
    "the message is erased from the server",
    { persists: "restart" },
  ),
  row(
    "viewer.junk",
    V,
    "button",
    "Junk",
    "select a message, toolbar Junk",
    "it moves to Junk, which appears in the sidebar",
    { persists: "restart" },
  ),
  row(
    "viewer.reply",
    V,
    "button",
    "Reply",
    "select a received message, toolbar Reply, Send",
    "a reply addressed to the sender, quoting the original, reaches the sender",
  ),
  row(
    "viewer.reply-all",
    V,
    "button",
    "Reply All",
    "select a message with Cc, toolbar Reply All, Send",
    "addressed to the sender with the other recipients in Cc and not to oneself; reaches both",
  ),
  row(
    "viewer.forward",
    V,
    "button",
    "Forward",
    "select a message, toolbar Forward, add a recipient, Send",
    "the forward (Fwd:) reaches the recipient",
  ),
  row(
    "viewer.flag",
    V,
    "button",
    "Flag",
    "select a message, toolbar Flag",
    "the row shows a red flag; the button becomes Clear Flag",
    { persists: "restart" },
  ),
  row(
    "viewer.clear-flag",
    V,
    "button",
    "Clear Flag",
    "select a flagged message, toolbar Clear Flag",
    "the flag goes; the button becomes Flag",
  ),
  row(
    "viewer.flag-color",
    V,
    "button",
    "Flag Color",
    "select a message, toolbar Flag Color pull-down",
    "a menu of the seven flag colours and Clear Flag opens",
  ),
  ...FLAG_COLORS.map((color) =>
    row(
      `flag-menu.${color.toLowerCase()}`,
      "Flag Color pull-down",
      "menuitem",
      color,
      `Flag Color > ${color}`,
      `the row shows a ${color.toLowerCase()} flag`,
      { persists: color === "Purple" ? "restart" : "none" },
    ),
  ),
  row(
    "flag-menu.clear",
    "Flag Color pull-down",
    "menuitem",
    "Clear Flag",
    "Flag Color > Clear Flag",
    "the flag goes",
  ),
  row(
    "viewer.mute",
    V,
    "button",
    "Mute",
    "select a message, toolbar Mute; again",
    "the row shows Muted; again unmutes",
    { persists: "restart" },
  ),
  row(
    "viewer.move-to",
    V,
    "button",
    "Move to…",
    "select a message, toolbar Move to… pull-down",
    "a menu of the mailboxes opens, the current one dimmed",
  ),
  ...MAILBOX_NAMES.map((box) =>
    box === "Drafts"
      ? row(
          "move-menu.drafts",
          "Move to… pull-down",
          "menuitem",
          box,
          "Move to… (hover Drafts)",
          "dimmed, with the reason shown: only a draft you save is kept in Drafts",
          {
            cell: `unavailable:${MOVE_TO_DRAFTS}`,
            dimmed: true,
          },
        )
      : row(
          `move-menu.${box.toLowerCase()}`,
          "Move to… pull-down",
          "menuitem",
          box,
          `Move to… > ${box}`,
          `the message moves to ${box}; the current mailbox is dimmed`,
          {
            persists: "restart",
            notes:
              "after the restart every message of the account is in the mailbox it was moved to, by id",
          },
        ),
  ),
  row(
    "drafts.moves-dimmed",
    `${V}, a draft selected`,
    "flow",
    "Archive, Junk and Move to… for a draft",
    "select a draft; hover Archive, Junk and Move to… > Inbox",
    "each dimmed with the reason: a draft can only be deleted; Delete moves it to the Trash",
  ),
  row(
    "viewer.search",
    V,
    "searchbox",
    "Search",
    "type words of a message's text",
    "the title says Searching All Mailboxes and the list holds only the matches, Trash and Junk as the preferences say",
  ),
  row(
    "viewer.mailboxes",
    V,
    "button",
    "Mailboxes",
    "toolbar Mailboxes, twice",
    "the mailbox sidebar hides, then shows",
  ),
  row(
    "viewer.sort",
    V,
    "button",
    "/Sort by (Date|From|Subject)/",
    "the list's sort pop-up (mouse)",
    "a menu of Date, From and Subject opens",
    { notes: "the sort pop-up, named by its current order" },
  ),
  ...["Date", "From", "Subject"].map((sort) =>
    row(
      `sort-menu.${sort.toLowerCase()}`,
      "Sort pop-up",
      "menuitemradio",
      sort,
      `sort pop-up > ${sort}`,
      `the list is ordered by ${sort.toLowerCase()} and the pop-up says Sort by ${sort}`,
    ),
  ),
  row(
    "viewer.filter-unread",
    V,
    "button",
    "Filter: Unread",
    "the list's filter button, twice",
    "only unread messages are listed; again, all",
  ),
  ...["Inbox", "Drafts", "Sent"].map((box) =>
    row(
      `favorites.${box.toLowerCase()}`,
      `${V} favourites bar`,
      "radio",
      box,
      `favourites bar ${box} (mouse)`,
      `${box} is shown and the title names it`,
    ),
  ),
  ...MAILBOX_NAMES.map((box) =>
    row(
      `sidebar.${box.toLowerCase()}`,
      `${V} sidebar`,
      "treeitem",
      box,
      `sidebar ${box} (mouse)`,
      `${box} is shown and the title names it with its count`,
      {
        notes: ["Junk", "Trash", "Archive"].includes(box) ? "listed while it holds mail" : "",
        persists: ["Junk", "Trash", "Archive"].includes(box) ? "restart" : "none",
      },
    ),
  ),
  row(
    "viewer.splitter",
    V,
    "splitter",
    "Resize mailbox list",
    "drag the divider 40 px right (mouse)",
    "the sidebar widens by 40 px",
  ),
  row(
    "list.message",
    `${V} message list`,
    "option",
    "/.+ (Unread )?.+/",
    "click a message in the list",
    "the message opens in the reader; an unread message is marked read",
    { notes: "message list row (revised from the snapshot)" },
  ),
  row(
    "list.load-more",
    `${V} message list`,
    "button",
    "Load More",
    "with more than two pages of mail, Load More",
    "the older messages are listed and search finds them",
  ),
  row(
    "list.open-draft",
    `${V} Drafts`,
    "gesture",
    "double-click a draft",
    "double-click a draft in Drafts",
    "the draft opens in a New Message window and can be sent",
  ),
  row(
    "reader.details",
    `${V} reader`,
    "button",
    "Details",
    "reader header Details",
    "the To line shows; the button becomes Hide",
  ),
  row(
    "reader.hide",
    `${V} reader`,
    "button",
    "Hide",
    "reader header Hide",
    "the short header returns",
  ),
  row(
    "reader.link",
    `${V} reader`,
    "link",
    "/https?:\\/\\/[^\\s]+/",
    "click a web address in a message",
    "Safari opens the address; the desktop page stays",
    { notes: "a web address in a message's text" },
  ),

  // The New Message window.
  row(
    "compose.to",
    C,
    "combobox",
    "To:",
    "type an account name, Enter",
    "a recipient token; an outside address is refused with the reason when sending",
  ),
  row(
    "compose.cc",
    C,
    "combobox",
    "Cc:",
    "type an account name, Enter",
    "a Cc token; the Cc recipient receives the message",
  ),
  row(
    "compose.subject",
    C,
    "textbox",
    "Subject:",
    "type",
    "the subject is sent and titles the window",
  ),
  row(
    "compose.message",
    C,
    "textbox",
    "Message",
    "type",
    "the text is sent (text editing is R4's mail-compose census)",
  ),
  row(
    "compose.send",
    C,
    "button",
    "Send",
    "Send (mouse)",
    "dimmed without a recipient; sends and closes the window",
  ),
  row(
    "compose.header-fields",
    C,
    "button",
    "Header Fields",
    "Header Fields pull-down",
    "a menu with Cc Address Field opens",
  ),
  row(
    "compose.cc-field",
    "Header Fields pull-down",
    "menuitemcheckbox",
    "Cc Address Field",
    "Header Fields > Cc Address Field, twice",
    "the Cc field hides, then shows; dimmed while Cc holds a recipient",
  ),
  row(
    "compose.include-original",
    C,
    "button",
    "Include Original Message",
    "hover",
    "dimmed, with the reason shown",
    { cell: `unavailable:${INCLUDE_ORIGINAL}`, dimmed: true },
  ),
  row(
    "compose.attach",
    C,
    "button",
    "Attach",
    "read",
    "enabled: a served Mail keeps a message's files",
  ),
  row("compose.markup", C, "button", "Markup", "hover", "dimmed, with the reason shown", {
    cell: `unavailable:${MARKUP}`,
    dimmed: true,
  }),
  row(
    "compose.photo-browser",
    C,
    "button",
    "Photo Browser",
    "hover",
    "dimmed, with the reason shown",
    { cell: `unavailable:${MARKUP}`, dimmed: true },
  ),
  row("compose.emoji", C, "button", "Emoji", "Emoji pull-down", "a menu of emoji opens"),
  row(
    "compose.emoji-item",
    "Emoji pull-down",
    "menuitem",
    "/\\S+ [A-Z][a-z]+( [A-Z][a-z]+)*/",
    "Emoji > an emoji (first, middle, last)",
    "the emoji is typed where the insertion point is",
    { notes: "Emoji menu item" },
  ),
  row(
    "compose.format-bar",
    C,
    "button",
    "Show Format Bar",
    "Show Format Bar, twice (a toggle)",
    "pressed: the Format bar shows; again: unpressed and it hides (formatting is R4's mail-compose census)",
  ),
  row(
    "compose.dont-save",
    `${C}, draft not saved`,
    "button",
    "Don’t Save",
    "close the window while the server cannot be reached, Don’t Save, close",
    "the notice says closing discards the message; closing discards it",
  ),

  // Flows across accounts and the server.
  row(
    "flow.outside-refused",
    C,
    "flow",
    "send to an outside address",
    "To: someone@example.org, Send",
    "refused with the reason shown; the window stays open with the message",
  ),
  row(
    "flow.unknown-refused",
    C,
    "flow",
    "send to an unknown account",
    "To: an account name nobody has, Send",
    "refused: No account on this desktop is called …",
  ),
  row(
    "flow.between-accounts",
    "two accounts",
    "flow",
    "send between accounts",
    "A sends to B with C in Cc",
    "B and C receive it; A's Sent holds it",
    { persists: "restart" },
  ),
  row(
    "flow.draft-saved",
    C,
    "flow",
    "close saves a draft",
    "close a New Message window with text",
    "the draft is kept in Drafts",
    { persists: "restart" },
  ),
  row(
    "flow.draft-idempotency",
    C,
    "flow",
    "draft save retried with its idempotency key",
    "close while the save's answer is lost, then close again",
    "one draft is stored, both saves carrying the same idempotency key; sent once",
    { persists: "restart" },
  ),
  row(
    "flow.isolation",
    "second account",
    "flow",
    "per-account mail",
    "another account's Mail and API",
    "sees none of the first account's mail",
  ),
  // The Preferences window (Mail > Preferences…): eight panes as tabs, pop-ups, checkboxes and the Help button.
  // Settings take effect at once and last while Mail is open (they are not stored on the server).
  ...[
    ["General", "general"],
    ["Accounts", "accounts"],
    ["Junk Mail", "junk"],
    ["Fonts & Colors", "fonts"],
    ["Viewing", "viewing"],
    ["Composing", "composing"],
    ["Signatures", "signatures"],
    ["Rules", "rules"],
  ].map(([name, slug]) =>
    row(
      `prefs.tab-${slug}`,
      P,
      "tab",
      name,
      `Preferences toolbar ${name} (mouse)`,
      `the ${name} pane shows and the tab is selected`,
    ),
  ),
  ...PREF_CHOICES.map(([label, option]) =>
    row(
      `prefs.${label
        .toLowerCase()
        .replace(/[^a-z]+/g, "-")
        .replace(/-$/, "")}`,
      `${P}, General`,
      "combobox",
      label,
      `pop-up ${label} > ${option}`,
      `the pop-up shows ${option}`,
    ),
  ),
  ...PREF_CHECKS.map(([pane, label]) =>
    row(
      `prefs.check-${label
        .toLowerCase()
        .replace(/[^a-z]+/g, "-")
        .replace(/^-|-$/g, "")}`,
      `${P}, ${pane}`,
      "checkbox",
      label,
      `click ${label}, twice`,
      "checked flips, then flips back",
    ),
  ),
  row(
    "prefs.search-trash-effect",
    `${P}, General`,
    "flow",
    "When searching all mailboxes, include results from: Trash",
    "untick Trash, search for a message in the Trash; tick it again",
    "the Trash's message is left out of the results, then found",
  ),
  row("prefs.help", P, "button", "Help", "hover the Help button", "dimmed, with the reason shown", {
    cell: "unavailable:Mail Help is not available: this desktop has no help book for Mail.",
    dimmed: true,
  }),
];

/** The Preferences window's rows are added from the first snapshot of it (see the suite's PREFS section). */
export const PREFS_WINDOW = P;
