import { Photos } from "../photos";

/**
 * Click a picture and try Favorite and Rotate, drag the zoom slider, type "disc" in the
 * search field, choose Favorites under "Showing", and double-click a picture to open it:
 * Back returns to the album. The pictures are abstract placeholders.
 */
export default function Basic() {
  return <Photos width="100%" height={560} style={{ maxWidth: 1200 }} />;
}
