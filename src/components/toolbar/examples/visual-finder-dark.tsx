import VisualFinder from "./visual-finder";

/**
 * Visual comparison target: the whole chrome of the key Finder window in Dark Aqua.
 *
 * Reference crop x=112 y=76 w=1998 h=110 (999 x 55 pt). The capture's window is wider than
 * the Aqua one and its view switcher starts at 137 pt, so the space after Forward is 62 pt;
 * every other distance is the same: group 255, action 309, share 363, tags 409, search field
 * 668 (323 wide, ending 8 pt from the right edge). The placeholder starts 23 pt into the field,
 * where typed text does, not at the 27 pt of the Aqua capture.
 */
export default function VisualFinderDark() {
  return <VisualFinder width={999} space={62} textInset={23} />;
}
