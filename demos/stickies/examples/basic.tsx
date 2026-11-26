import { Stickies } from "../stickies";

/**
 * Stickies with the two notes of the reference screenshots on a small desktop. Type in a note,
 * drag it by its title bar, collapse it with the box at the right or a double click on the
 * bar, and use the menus: File makes and closes notes, Font styles the selected text and shows
 * the Fonts and Colors panels, Color changes the front note.
 */
export default function Basic() {
  return <Stickies style={{ width: "100%", height: 420 }} />;
}
