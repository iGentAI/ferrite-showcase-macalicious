/*
 * Stand-in artwork, drawn for this demo. Apple's artwork is not reproduced. The glyphs of the
 * buttons are original line drawings that say what the button does. A contact's picture, the
 * icons of the Preferences panes and the folder in a pop-up button are abstract placeholders:
 * a plain shape in one neutral colour, the same for each, which stands where the picture
 * would be and depicts nothing. The comparisons mask them. Each is drawn in `currentColor`;
 * the class it carries gives it a colour from the demo's tokens (messages.css).
 */

const GLYPHS = {
  // A sheet with a pencil across its corner: start a new conversation.
  compose: "M9.5 3.5H3.5v11h11V8.5M16 2l-7 7l-.6 2.6l2.6-.6l7-7z",
  // A cross: delete a conversation from its row.
  remove: "M5 5l8 8M13 5l-8 8",
  // A crescent: Do Not Disturb.
  moon: "M14.5 11.5A6.5 6.5 0 0 1 6.5 3.5a6.5 6.5 0 1 0 8 8z",
  // A square: stop recording.
  stop: "M5 5h8v8H5z",
} as const;

/** One line glyph on an 18 pt grid, drawn in `currentColor`. Decorative. */
export function MessagesGlyph({ name, size = 18 }: { name: keyof typeof GLYPHS; size?: number }) {
  return (
    <svg
      className="mac-messages-glyph"
      viewBox="0 0 18 18"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={GLYPHS[name]} />
    </svg>
  );
}

/** The 18 pt face of the emoji button: a ring, two eyes and a smile. Decorative. */
export function EmojiGlyph() {
  return (
    <svg
      className="mac-messages-glyph"
      viewBox="0 0 18 18"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="9" cy="9" r="8.25" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="6.25" cy="7" r="1" fill="currentColor" />
      <circle cx="11.75" cy="7" r="1" fill="currentColor" />
      <path d="M4.5 10h9a4.5 4.5 0 0 1-9 0z" fill="currentColor" />
    </svg>
  );
}

/** The bars of the audio-message button, tallest in the middle. Decorative. */
export function AudioGlyph() {
  return (
    <svg
      className="mac-messages-glyph"
      viewBox="0 0 18 18"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.5 8.25v1.5M4.5 6.5v5M7.5 3.5v11M10.5 5v8M13.5 6.5v5M16.5 8.25v1.5" />
    </svg>
  );
}

/* Generated contact pictures, one per conversation id: original painterly portraits of the
   demo's invented people (and an emblem for the ferry company). */
const PICTURES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./art/*.webp", { eager: true, query: "?url", import: "default" }),
  ).map(([file, url]) => [file.slice("./art/".length, -".webp".length), url]),
);

/**
 * A contact's picture, 48 pt across in a conversation's row: the generated portrait for the
 * conversation's id, or a plain disc when there is none. Decorative; the row names the person.
 */
export function Avatar({ size = 48, id }: { size?: number; id?: string }) {
  // Only the table's own entries: an id such as "constructor" names no picture, not the
  // object's inherited function.
  const url = id && Object.hasOwn(PICTURES, id) ? PICTURES[id] : undefined;
  if (url) {
    return (
      <img
        className="mac-messages-avatar"
        src={url}
        alt=""
        width={size}
        height={size}
        draggable={false}
        style={{ borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  return (
    <svg
      className="mac-messages-avatar mac-messages-placeholder"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="24" fill="currentColor" />
    </svg>
  );
}

/** Initials for a person with no picture: of the first and the last word of the name. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

function PersonDisc({ name, image }: { name: string; image?: string }) {
  return image ? (
    <img className="mac-messages-person" src={image} alt="" draggable={false} />
  ) : (
    <span className="mac-messages-person mac-messages-monogram" aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

/**
 * A conversation's picture when it knows who is in it: the person's contact picture or monogram, or
 * the first three people's, overlapping, for a group. Decorative; the row names them.
 */
export function PeoplePicture({ people }: { people: readonly { name: string; image?: string }[] }) {
  const shown = people.slice(0, 3);
  return (
    <span className="mac-messages-avatar mac-messages-people" data-count={shown.length}>
      {shown.map((person) => (
        <PersonDisc key={person.name} name={person.name} image={person.image} />
      ))}
    </span>
  );
}

/** The 16 pt placeholder before the title of the folder pop-up button: a plain square. */
export function FolderIcon() {
  return (
    <svg
      className="mac-messages-folder mac-messages-placeholder"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

/**
 * The 32 pt placeholder for the icon of a Preferences toolbar item: a plain rounded square,
 * the same for every pane. The item's title says which pane it is.
 */
export function PaneIcon() {
  return (
    <svg
      className="mac-messages-pane-icon mac-messages-placeholder"
      width="32"
      height="32"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="26" height="26" rx="6" fill="currentColor" />
    </svg>
  );
}
