import { PlaceholderPicture } from "../placeholder";

/*
 * The picture of the built-in display: a placeholder on the 197 x 120 pt frame of the pane, in
 * place of Apple's artwork.
 */

/** The picture of the display the pane configures. Decorative. */
export function DisplayArtwork() {
  return <PlaceholderPicture width={197} height={120} />;
}
