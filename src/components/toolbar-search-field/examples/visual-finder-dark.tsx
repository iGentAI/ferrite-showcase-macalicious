import VisualFinder from "./visual-finder";

/**
 * Visual comparison target: the empty search field of the key Finder window in Dark Aqua.
 *
 * The same field as `visual-finder`; in the dark capture the placeholder starts 23 pt from the
 * fill's edge, where typed text does, not at the 27 pt of the light capture.
 */
export default function VisualFinderDark() {
  return <VisualFinder textInset={23} />;
}
