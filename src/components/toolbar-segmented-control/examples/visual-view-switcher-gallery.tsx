import VisualViewSwitcher from "./visual-view-switcher";

/**
 * Visual comparison target: the Finder view switcher of a main window that is not key (Finder
 * behind a Quick Look panel), with the gallery view selected. The comparison sets the window
 * state; the selected segment keeps the look it has in a key window.
 *
 * Reference crop 228 x 52 px, 2 pt left of and 2 pt above the control's fill: x=476 y=304 in
 * 10-15-Catalina-Light-Finder-Quick-Look.png (window interior from 142,258) and x=520 y=246
 * in the dark capture (window interior from 186,200).
 */
export default function VisualViewSwitcherGallery() {
  return <VisualViewSwitcher selected="gallery" />;
}
