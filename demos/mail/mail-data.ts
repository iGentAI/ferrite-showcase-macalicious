/** A mailbox every person has. Junk, Trash and Archive are listed only while they hold a message. */
export type StandardMailboxId =
  | "inbox"
  | "drafts"
  | "outbox"
  | "sent"
  | "junk"
  | "trash"
  | "archive";

/** The id of a mailbox the person made. */
export type OwnMailboxId = `box-${string}`;

/** The id of a Smart Mailbox (`mail-smart.ts`), which lists messages and holds none. */
export type SmartMailboxId = `smart-${string}`;

/** A mailbox of the demo. */
export type MailboxId = StandardMailboxId | OwnMailboxId | SmartMailboxId;

/** A mailbox the person made, listed under On My Mac. */
export interface OwnMailbox {
  id: OwnMailboxId;
  name: string;
}

/** Whether `id` is a mailbox the person made. */
export const isOwnMailbox = (id: string): id is OwnMailboxId => id.startsWith("box-");

/** Whether `id` is a Smart Mailbox. */
export const isSmartMailbox = (id: string): id is SmartMailboxId => id.startsWith("smart-");

/** The seven flag colours of Mail, which are the tag colours of the library's `TagDot`. */
export type MailFlag = "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "gray";

/** A message's priority, when it is not normal. */
export type MailPriority = "low" | "high";

/** The mailbox of an address: the last `<…>`, as the server reads it, or the address; lower case. */
export const addressKey = (address: string) =>
  (/<([^<>]+)>\s*$/.exec(address)?.[1] ?? address).trim().toLowerCase();

/** One simulated message. Nothing is sent or received. */
export interface MailMessage {
  /** Unique among the messages. */
  id: string;
  /** The mailbox that holds the message. */
  mailbox: MailboxId;
  /** The sender's name. */
  from: string;
  /** The recipients' names. */
  to: readonly string[];
  /** The subject line. */
  subject: string;
  /** The date as the message list shows it: "9/29/19". */
  date: string;
  /** The date as the message's header shows it: "September 29, 2019 at 6:24 PM". */
  received: string;
  /** A number that orders the messages by date; larger is more recent. */
  time: number;
  /** The text, paragraphs separated by an empty line. */
  body: string;
  /** Not read yet: counted in the mailbox's badge until the message is selected. */
  unread?: boolean;
  /** The flag's colour, when the message is flagged. */
  flag?: MailFlag;
  /** The conversation is muted. */
  muted?: boolean;
  /** New in the Inbox: the person's rules have not run on it yet (server mail only). */
  rulesPending?: boolean;
  /**
   * The sender's address, when it differs from the name shown (a desktop served by its Ferrite
   * application: `Martin Klein <martin@macalicious>`). Reply writes to it.
   */
  fromAddress?: string;
  /** The recipients' addresses, in the order of `to`, for Reply All. */
  toAddresses?: readonly string[];
  /** The Cc recipients' addresses, which Reply All copies and an opened draft shows. */
  cc?: readonly string[];
  /** Those written to unseen, on a message of one's own that names them. */
  bcc?: readonly string[];
  /** Where a reply goes in place of the sender. */
  replyTo?: string;
  /** A priority other than normal. */
  priority?: MailPriority;
  /** The message's styled text (HTML), when it has one: an opened draft shows it. */
  html?: string;
  /** How many files came with the message. */
  attachmentCount?: number;
}

/** What the New Message window holds. */
export interface MailDraft {
  /** Made plain text: a draft reopened with no styled text stays so. */
  plain?: boolean;
  /** The names in the To field. */
  to: readonly string[];
  /** The names in the Cc field. */
  cc: readonly string[];
  /** The names in the Bcc field. */
  bcc?: readonly string[];
  /** What the Reply-To field says. */
  replyTo?: string;
  /** What the Priority field says, when it is not normal. */
  priority?: MailPriority;
  /** The subject line. */
  subject: string;
  /**
   * The text of the message as plain text, its lines separated by line breaks: what the viewer
   * shows and a reply quotes.
   */
  body: string;
  /**
   * The same text with its styles, as the message's editor holds it (HTML): fonts, sizes,
   * colours, bold, italic, underline, strikethrough and alignment. A New Message window opened
   * with it shows it in place of `body`, rebuilt with `richTextFromHtml` so that nothing in it
   * runs or loads; `onSend` gives it with every message. Render it the same way.
   */
  html?: string;
}

/** An empty New Message window. */
export const EMPTY_DRAFT: MailDraft & { html?: undefined } = {
  to: [],
  cc: [],
  subject: "",
  body: "",
};

/** A message with its people by their addresses, as with Use Smart Addresses off. */
export const showingAddresses = (message: MailMessage): MailMessage => ({
  ...message,
  from: message.fromAddress ?? message.from,
  to: message.toAddresses ?? message.to,
});

/** The mailboxes in the order of the sidebar, with whether an empty one is still listed. */
export const MAILBOXES: readonly { id: StandardMailboxId; name: string; always: boolean }[] = [
  { id: "inbox", name: "Inbox", always: true },
  { id: "drafts", name: "Drafts", always: true },
  { id: "sent", name: "Sent", always: true },
  { id: "junk", name: "Junk", always: false },
  { id: "trash", name: "Trash", always: false },
  { id: "archive", name: "Archive", always: false },
];

/**
 * The sidebar's rows: the mailboxes, and the Outbox while a message waits in it. Nothing is moved
 * or copied into the Outbox, and no rule names it, so `MAILBOXES` leaves it out.
 */
export const SIDEBAR_MAILBOXES: typeof MAILBOXES = [
  ...MAILBOXES.slice(0, 2),
  { id: "outbox", name: "Outbox", always: false },
  ...MAILBOXES.slice(2),
];

/** The name of a mailbox, among those the person made. */
export const mailboxName = (
  id: MailboxId,
  own: readonly { readonly id: MailboxId; readonly name: string }[] = [],
) => [...SIDEBAR_MAILBOXES, ...own].find((mailbox) => mailbox.id === id)?.name ?? "that mailbox";

export const FLAGS: readonly MailFlag[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
];

/** The owner of the simulated account: the sender of what the demo "sends". */
export const ME = "Robin Vega";

/** Invented people the address fields complete. */
export const CONTACTS: readonly string[] = [
  "Ada Moreno",
  "Felix Okafor",
  "Harbor Ferry Company",
  "Ines Lindqvist",
  "Jonas Petit",
  "Mara Castellanos",
  "Otis Brandt",
  "The Lighthouse Bookshop",
];

/** The demo's messages: invented senders and invented text. */
export const MESSAGES: readonly MailMessage[] = [
  {
    id: "ferry",
    mailbox: "inbox",
    from: "Harbor Ferry Company",
    to: [ME],
    subject: "Your crossing to the island is confirmed",
    date: "9/29/19",
    received: "September 29, 2019 at 6:24 PM",
    time: 20190929.1824,
    body: "Dear Robin Vega,\n\nYour booking for the 8:40 AM crossing on Saturday is confirmed: two foot passengers and one bicycle. Boarding closes ten minutes before departure, and the ticket office on the pier opens at 7:30 AM.\n\nThe forecast is for a calm sea and a clear view of the cliffs on the way out. Bring a jacket for the upper deck.\n\nSafe travels,\nHarbor Ferry Company",
  },
  {
    id: "bookshop",
    mailbox: "inbox",
    from: "The Lighthouse Bookshop",
    to: [ME],
    subject: "The atlas you ordered has arrived",
    date: "9/27/19",
    received: "September 27, 2019 at 11:02 AM",
    time: 20190927.1102,
    unread: true,
    body: "Hello Robin,\n\nThe coastal atlas you asked us to order came in with this morning's delivery. We will keep it behind the counter for two weeks.\n\nWe are open until six on weekdays and until four on Saturday.\n\nThe Lighthouse Bookshop",
  },
  {
    id: "hike",
    mailbox: "inbox",
    from: "Ines Lindqvist",
    to: [ME, "Jonas Petit"],
    subject: "Saturday: north trail or the lighthouse loop?",
    date: "9/26/19",
    received: "September 26, 2019 at 8:15 PM",
    time: 20190926.2015,
    unread: true,
    flag: "orange",
    body: "Hi both,\n\nIf the first ferry runs on time we reach the island before ten. The north trail is longer but has the better views; the lighthouse loop gets us back in time for the four o'clock boat with an hour to spare.\n\nI will bring the map and the coffee. Jonas, can you bring the binoculars?\n\nInes",
  },
  {
    id: "photos",
    mailbox: "inbox",
    from: "Otis Brandt",
    to: [ME],
    subject: "Photos from the harbor",
    date: "9/21/19",
    received: "September 21, 2019 at 3:40 PM",
    time: 20190921.154,
    body: "Robin,\n\nI finally sorted the photos from last weekend. The one of the fishing boats at sunrise came out better than I hoped. I will print it for you.\n\nOtis",
  },
  {
    id: "draft-thanks",
    mailbox: "drafts",
    from: ME,
    to: ["Otis Brandt"],
    subject: "Thank you for the print",
    date: "9/28/19",
    received: "September 28, 2019 at 9:05 AM",
    time: 20190928.0905,
    body: "Otis,\n\nThe print arrived yesterday and it is already on the wall above the desk.",
  },
  {
    id: "sent-binoculars",
    mailbox: "sent",
    from: ME,
    to: ["Ines Lindqvist", "Jonas Petit"],
    subject: "Re: Saturday: north trail or the lighthouse loop?",
    date: "9/26/19",
    received: "September 26, 2019 at 9:31 PM",
    time: 20190926.2131,
    body: "The north trail, if the weather holds. I have booked the 8:40 crossing for the three of us.\n\nRobin",
  },
  {
    id: "trash-newsletter",
    mailbox: "trash",
    from: "Mara Castellanos",
    to: [ME],
    subject: "Tide tables for October",
    date: "9/20/19",
    received: "September 20, 2019 at 7:00 AM",
    time: 20190920.07,
    body: "Robin,\n\nAttached are the tide tables you asked about. The lowest tide of the month is on the fourteenth.\n\nMara",
  },
];

/** The settings of the Preferences window that are checkboxes or choices. */
export type MailSettings = Readonly<Record<string, boolean | string>>;

/** One choice of the General pane, shown in Mail as a pop-up button. */
export interface MailChoice {
  id: string;
  label: string;
  options: readonly string[];
  /** Width of the control in points, as measured in the capture. */
  width: number;
  /** A stand-in icon before the first option's title, where Mail shows one. */
  icon?: "app" | "folder";
}

export const GENERAL_CHOICES: readonly MailChoice[] = [
  { id: "reader", label: "Default email reader:", options: ["Mail"], width: 223, icon: "app" },
  {
    id: "check",
    label: "Check for new messages:",
    options: ["Automatically", "Every minute", "Every 5 minutes", "Every hour", "Manually"],
    width: 223,
  },
  {
    id: "sound",
    label: "New messages sound:",
    options: ["New Messages Sound", "Glass", "Ping", "Pop", "None"],
    width: 223,
  },
  {
    id: "dock",
    label: "Dock unread count:",
    options: ["Inbox Only", "Today", "All Mailboxes"],
    width: 223,
  },
  {
    id: "notifications",
    label: "New message notifications:",
    options: ["Inbox Only", "VIPs", "Contacts", "All Mailboxes"],
    width: 223,
  },
  {
    id: "downloads",
    label: "Downloads folder:",
    options: ["Downloads", "Desktop"],
    width: 120,
    icon: "folder",
  },
  {
    id: "remove",
    label: "Remove unedited downloads:",
    options: ["After Message is Deleted", "When Mail Quits", "Never"],
    width: 223,
  },
];

/** The checkboxes of the General pane under the choices, in the capture's order. */
export const GENERAL_CHECKS: readonly [id: string, label: string][] = [
  ["archiveMuted", "Archive or delete muted messages"],
  ["invitations", "Add invitations to Calendar automatically"],
  ["sendLater", "Automatically try sending later if outgoing server is unavailable"],
  ["splitView", "Prefer opening messages in split view when in full screen"],
];

/** "When searching all mailboxes, include results from:". The first two change the search. */
export const SEARCH_CHECKS: readonly [id: string, label: string][] = [
  ["searchTrash", "Trash"],
  ["searchJunk", "Junk"],
  ["searchEncrypted", "Encrypted Messages"],
];

/** Why Junk Mail's Trust check is dimmed. */
const NO_JUNK_HEADERS =
  "Mail here comes only from this desktop's accounts, and no outside server adds junk mail headers to it.";
/** Why Accounts' checks are dimmed. */
const ONE_ACCOUNT = "This desktop gives each person one account, which is always on.";
const NO_MAIL_DROP =
  "Every file here stays on this desktop's server, up to 10 MB: there is no iCloud to send a larger one through.";

/**
 * The panes without a reference screenshot. A check with a third item shows dimmed, saying why it
 * means nothing on this desktop.
 */
export const OTHER_PANES: readonly {
  value: string;
  label: string;
  checks: readonly (readonly [id: string, label: string, why?: string])[];
}[] = [
  {
    value: "accounts",
    label: "Accounts",
    checks: [
      ["accountEnabled", "Enable this account", ONE_ACCOUNT],
      ["sendLargeAttachments", "Send large attachments with Mail Drop", NO_MAIL_DROP],
    ],
  },
  {
    value: "junk",
    label: "Junk Mail",
    checks: [
      ["junkFilter", "Enable junk mail filtering"],
      ["junkContacts", "Exempt senders who are in my Contacts"],
      ["junkPrevious", "Exempt senders I have written to before"],
      ["junkTrust", "Trust junk mail headers in messages", NO_JUNK_HEADERS],
    ],
  },
  {
    value: "fonts",
    label: "Fonts & Colors",
    checks: [
      ["fixedWidth", "Use fixed-width font for plain text messages"],
      ["colorQuotes", "Color quoted text"],
    ],
  },
  {
    value: "viewing",
    label: "Viewing",
    checks: [
      ["classicLayout", "Use classic layout"],
      ["recentFirst", "Show most recent message at the top"],
      ["showToCc", "Show To/Cc label in the message list"],
      ["contactPhotos", "Show contact photos in the message list"],
      [
        "remoteContent",
        "Load remote content in messages",
        "Messages on this desktop carry no remote content: nothing in them loads from outside.",
      ],
      ["smartAddresses", "Use Smart Addresses"],
    ],
  },
  {
    value: "composing",
    label: "Composing",
    checks: [
      ["spelling", "Check spelling as I type"],
      ["ccMyself", "Automatically Cc myself"],
      [
        "groupMembers",
        "When sending to a group, show all member addresses",
        "The address fields here complete people, not groups.",
      ],
      ["quoteOriginal", "Quote the text of the original message"],
    ],
  },
  {
    value: "signatures",
    label: "Signatures",
    checks: [["signatureAbove", "Place signature above quoted text"]],
  },
  {
    value: "rules",
    label: "Rules",
    checks: [],
  },
];

/** The settings as the General pane shows them in the capture. */
export const DEFAULT_SETTINGS: MailSettings = {
  reader: "Mail",
  check: "Automatically",
  sound: "New Messages Sound",
  dock: "Inbox Only",
  notifications: "Inbox Only",
  downloads: "Downloads",
  remove: "After Message is Deleted",
  playSounds: true,
  archiveMuted: false,
  invitations: false,
  sendLater: false,
  splitView: true,
  searchTrash: true,
  searchJunk: false,
  searchEncrypted: false,
  accountEnabled: true,
  junkFilter: true,
  junkContacts: true,
  junkPrevious: true,
  colorQuotes: true,
  recentFirst: true,
  smartAddresses: true,
  spelling: true,
  quoteOriginal: true,
  signatureAbove: true,
};
