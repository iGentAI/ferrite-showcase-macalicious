import VisualBooksInactive from "./visual-books-inactive";

/**
 * State check target: the Books section switcher disabled, in an inactive window. No capture
 * shows it. A disabled selected segment keeps the provisional look, the key window's selected
 * fill at half strength, and does not take the measured grey of an enabled selection.
 */
export default function VisualBooksInactiveDisabled() {
  return <VisualBooksInactive disabled />;
}
