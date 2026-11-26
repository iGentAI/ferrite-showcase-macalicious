import type { StickyNoteProps } from "macalicious/sticky-note";

/** One of the six colours of Stickies' Color menu. */
export type StickiesColor = NonNullable<StickyNoteProps["color"]>;

/** A note as the app opens it. */
export interface StickiesNoteData {
  /** Identifies the note; also its window's id in the window manager. */
  id: string;
  /** The note colour. */
  color: StickiesColor;
  /** The text the note opens with. Its first line is the note's title and is set in bold. */
  text: string;
  /** Where the note opens on the desktop and how large, in points. */
  frame: { x: number; y: number; width: number; height: number };
  /** Opens collapsed to its title bar. */
  collapsed?: boolean;
  /** Opens see-through. */
  translucent?: boolean;
}

/** The Color menu, in its order. */
export const STICKIES_COLORS: readonly { value: StickiesColor; label: string }[] = [
  { value: "yellow", label: "Yellow" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "pink", label: "Pink" },
  { value: "purple", label: "Purple" },
  { value: "gray", label: "Gray" },
];

/** The size a new note opens at (provisional: no capture shows a new note). */
export const NEW_NOTE_SIZE = { width: 300, height: 200 };

/** A note's title: the first line of its text that is not blank. */
export function titleOf(text: string): string {
  return (
    text
      .split("\n")
      .find((line) => line.trim() !== "")
      ?.trim() ?? ""
  );
}

/** Window > Arrange By: what the notes are put in order of. */
export type StickiesArrangement = "color" | "content" | "date";

/**
 * The notes in the order Arrange By puts them, the last one in front: by the Color menu's order,
 * by their titles, or as they were made (the saved list keeps a new note last, and no note keeps a
 * date).
 */
export function arrangedNotes<T extends { color: string; text: string }>(
  notes: readonly T[],
  by: StickiesArrangement,
): T[] {
  if (by === "date") return [...notes];
  const rank = (note: T) => STICKIES_COLORS.findIndex(({ value }) => value === note.color);
  return [...notes].sort((a, b) =>
    by === "color"
      ? rank(a) - rank(b)
      : titleOf(a.text).localeCompare(titleOf(b.text), undefined, { sensitivity: "base" }),
  );
}

/** The height a cascade leaves below a note's top for its title bar to stay on the desktop. */
const CASCADE_TITLE_ROOM = 40;
/** How far down a cascade goes when the desktop's height is not known. */
const CASCADE_DEFAULT_STEPS = 20;

/**
 * Where Arrange By puts the note at `index`: down and to the right, starting again further right
 * when the next step would take its title bar off a desktop `height` tall.
 */
export function cascadePlace(
  index: number,
  height: number,
  insets: { left: number; top: number },
  step: number,
): { x: number; y: number } {
  const room = height - insets.top - 8 - CASCADE_TITLE_ROOM;
  const steps = height > 0 ? Math.max(1, Math.floor(room / step) + 1) : CASCADE_DEFAULT_STEPS;
  const down = index % steps;
  const over = Math.floor(index / steps);
  return {
    x: insets.left + 16 + down * step + over * step * 3,
    y: insets.top + 8 + down * step,
  };
}

const WELCOME = `Make a note of it!

Stickies lets you keep notes (like these) on your desktop. Use a Stickies note to jot down reminders, lists, or other information. You can also use notes to store frequently used text or graphics.

• To close this note, click the close button.

• To collapse this note, double click the title bar.

Your current notes appear when you open Stickies.
`;

const CUSTOMIZE = `It’s easy to customize your notes!

Make your notes stand out and get noticed.

• Format text using different fonts and font sizes.
• Add emphasis with bold and italic text styles or color.
• Include graphics.

Stickies has lots of other great features, including a spell checker, import and export features, and other ways to arrange and customize your notes. Plus, you can use Services to make a Sticky Note with text selected in any app.

Look in Help to find out more about using Stickies.
`;

/**
 * The two notes Stickies opens with, as in the reference captures: the blue note behind, the
 * yellow one 21 pt to its right and 22 pt below it, in front. The sizes are the captured ones;
 * the pair is moved towards the top-left corner (the captures have it at 48, 281 on a
 * 1680 x 1050 pt screen) so that it fits a small desktop. The later note is in front.
 */
export const defaultStickies: readonly StickiesNoteData[] = [
  {
    id: "customize",
    color: "blue",
    text: CUSTOMIZE,
    frame: { x: 28, y: 44, width: 355, height: 268 },
  },
  {
    id: "welcome",
    color: "yellow",
    text: WELCOME,
    frame: { x: 49, y: 66, width: 352, height: 260 },
  },
];
