/** One folder of the account shown in the sidebar. */
export interface NotesFolder {
  /** Identifies the folder; unique among the folders. */
  id: string;
  /** The folder's name, as the sidebar shows it. */
  name: string;
  /** The `id` of the folder that holds this one; absent at the top of the sidebar. */
  parent?: string;
  /** The folder belongs to the On My Mac account, which the sidebar lists on its own. */
  local?: boolean;
}

/** A file attached to a note: its bytes are on the server (`notes-files.tsx`). */
export interface NoteFile {
  id: string;
  name: string;
  /** Its media type; empty when it is not known. */
  type: string;
  /** Bytes. */
  size: number;
}

/** A locked note's text as the server keeps it (`notes-lock.ts`). */
export interface SealedNote {
  /** The note's revision, which the server owns: a save names the one it was made on. */
  rev: number;
  kdf: { name: string; iterations: number; salt: string };
  iv: string;
  ciphertext: string;
  /** What the person wrote to remind them of the password. */
  hint?: string;
}

/** One note. Its first line is its title, as in Notes. */
export interface NotesNote {
  /** Identifies the note; unique among the notes. */
  id: string;
  /** The `id` of the folder that holds the note. */
  folder: string;
  /** The note's text, one entry per line. The first line is the title. */
  lines: string[];
  /**
   * The note's text with its formats, as the editor holds it (its HTML) without its pictures:
   * bold, fonts, colours, alignment, headings and tables. Absent for a note whose text is plain
   * lines, which `lines` then shows alone. The note list and the search read `lines`.
   */
  html?: string;
  /** The short date in the note list: a time for today, else a day ("9/20/18"). */
  date: string;
  /** The date line above the note's text ("October 3, 2019 at 3:55 PM"). */
  edited: string;
  /**
   * A picture in the note: `"screenshot"` is the stand-in for the embedded screenshot of the
   * reference capture, `"photo"` a stand-in photograph. The note list shows a thumbnail of it.
   */
  attachment?: "screenshot" | "photo";
  /** The first picture the user added to the note, as a URL: the note list's thumbnail. */
  picture?: string;
  /** The files attached to the note, in the order they stand at its end. */
  files?: NoteFile[];
  /** A locked note has no text here: its text is in `sealed`, which only its password opens. */
  locked?: boolean;
  /** A locked note's text, encrypted in the page; the server keeps nothing else of it. */
  sealed?: SealedNote;
  /** A pinned note stands first in its folder, under the Pinned heading. */
  pinned?: boolean;
  /** When the note was made, as an ISO date; absent for an older note. */
  created?: string;
  /**
   * When the note went to Recently Deleted, as an ISO date. It stays there for
   * `KEEP_DELETED_DAYS`; `folder` is still where Recover puts it.
   */
  deleted?: string;
}

/** The folder every account has. It cannot be deleted. */
export const DEFAULT_FOLDER = "notes";

/** The first folder of the On My Mac account, made when the account is turned on. */
export const ON_MY_MAC_FOLDER: NotesFolder = { id: "on-my-mac", name: "Notes", local: true };

/** The sidebar's row for the notes that were deleted: not a folder of the document. */
export const RECENTLY_DELETED = "recently-deleted";

/**
 * The folder a window gives the notes shared with other accounts (`notes-shared.ts`): not a folder
 * of the document, and a note in it is not of the person's own document.
 */
export const SHARED_FOLDER = "shared-with-people";

/** How long a deleted note stays in Recently Deleted. */
export const KEEP_DELETED_DAYS = 30;

/** Whether a note in Recently Deleted has been there longer than it stays. */
export function deletedExpired(note: NotesNote, now: number): boolean {
  if (note.deleted === undefined) return false;
  return now - Date.parse(note.deleted) > KEEP_DELETED_DAYS * 24 * 60 * 60 * 1000;
}

/** View > Sort By: what orders the notes of a folder. */
export type NotesSort = "edited" | "created" | "title";

/** When a note was made: `created`, or for an older note the date line it shows. */
export function createdTime(note: NotesNote): number {
  const time = Date.parse(note.created ?? note.edited.replace(" at ", " "));
  return Number.isNaN(time) ? 0 : time;
}

/**
 * The notes in the order `sort` asks for, the pinned ones first. An edit moves a note to the front
 * of the notes (`notes.tsx`), so that order is already by date edited.
 */
export function sortNotes(notes: readonly NotesNote[], sort: NotesSort): NotesNote[] {
  const ordered = [...notes];
  if (sort === "created") ordered.sort((a, b) => createdTime(b) - createdTime(a));
  if (sort === "title") {
    ordered.sort((a, b) => summarize(a).title.localeCompare(summarize(b).title));
  }
  return [
    ...ordered.filter((note) => note.pinned === true),
    ...ordered.filter((note) => note.pinned !== true),
  ];
}

/** A folder and every folder inside it, as ids. */
export function folderWithChildren(folders: readonly NotesFolder[], id: string): Set<string> {
  const found = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const folder of folders) {
      if (folder.parent !== undefined && found.has(folder.parent) && !found.has(folder.id)) {
        found.add(folder.id);
        grew = true;
      }
    }
  }
  return found;
}

/** The folders of the reference screenshots. */
export const defaultFolders: NotesFolder[] = [{ id: DEFAULT_FOLDER, name: "Notes" }];

/** The five notes of the reference screenshots, newest first. */
export const defaultNotes: NotesNote[] = [
  {
    id: "catalina",
    folder: DEFAULT_FOLDER,
    lines: ["Catalina Notes is just about the same as before, but adds a Gallery View.", ""],
    date: "3:55 PM",
    edited: "October 3, 2019 at 3:55 PM",
    attachment: "screenshot",
  },
  {
    id: "orange",
    folder: DEFAULT_FOLDER,
    lines: ["All computers should be orange", "It’s true."],
    date: "9/20/18",
    edited: "September 20, 2018 at 10:12 AM",
  },
  {
    id: "selfies",
    folder: DEFAULT_FOLDER,
    lines: ["Are these what the kids call selfies?", ""],
    date: "7/15/18",
    edited: "July 15, 2018 at 4:41 PM",
    attachment: "photo",
  },
  {
    id: "yosemite",
    folder: DEFAULT_FOLDER,
    lines: ["This is a note in Yosemite", "It’s kinda nice in here."],
    date: "7/14/18",
    edited: "July 14, 2018 at 9:03 AM",
  },
  {
    id: "mavericks",
    folder: DEFAULT_FOLDER,
    lines: ["This is a note in Mavericks.", "Here is an image:"],
    date: "6/13/18",
    edited: "June 13, 2018 at 2:27 PM",
  },
];

/** The longest title the note list takes from a first line; the rest opens the snippet. */
const TITLE_LENGTH = 68;

/** What the note list calls a locked note that isn't open: it knows nothing else of it. */
export const LOCKED_TITLE = "Locked Note";

/**
 * What the note list shows for a note: its title and the snippet under it.
 *
 * The title is the first line that has text. Notes cuts a long first line at a word and lets
 * the rest open the snippet, which is why the reference capture shows "View." under a title
 * that ends in "Gallery". Without more text the snippet names the attachment, or says that
 * there is none.
 */
export function summarize(note: NotesNote): { title: string; snippet: string } {
  if (note.sealed) return { title: LOCKED_TITLE, snippet: "Locked" };
  const lines = note.lines.map((line) => line.trim()).filter(Boolean);
  let title = lines[0] ?? "New Note";
  let rest = lines[1] ?? "";
  if (title.length > TITLE_LENGTH) {
    const cut = title.lastIndexOf(" ", TITLE_LENGTH);
    if (cut > 0) {
      rest = title.slice(cut + 1);
      title = title.slice(0, cut);
    }
  }
  if (rest) return { title, snippet: rest };
  const files = note.files ?? [];
  if (files.length > 0) {
    const pictures = files.filter((file) => file.type.startsWith("image/")).length;
    if (pictures === files.length) {
      return { title, snippet: pictures === 1 ? "1 photo" : `${pictures} photos` };
    }
    return {
      title,
      snippet: files.length === 1 ? (files[0]?.name ?? "") : `${files.length} attachments`,
    };
  }
  return { title, snippet: note.attachment ? "1 photo" : "No additional text" };
}

/** Whether a note's text contains the search text, whatever the letter case. */
export function matches(note: NotesNote, query: string): boolean {
  return note.lines.join("\n").toLowerCase().includes(query.trim().toLowerCase());
}

const DAY = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/** The two dates of a note edited at `when`: the list's time and the editor's date line. */
export function stamp(when: Date): Pick<NotesNote, "date" | "edited"> {
  // Intl separates the time from "PM" with a narrow no-break space; Catalina uses a space.
  const time = TIME.format(when).replace(/\s/g, " ");
  return { date: time, edited: `${DAY.format(when)} at ${time}` };
}
