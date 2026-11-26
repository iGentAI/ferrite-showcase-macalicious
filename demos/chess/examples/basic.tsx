import { Chess } from "../chess";

/**
 * Click a piece of the side to move, then one of the marked squares; or move through the
 * board with the arrow keys and pick up and put down with Return or the space bar. The title
 * follows the game. Both sides are moved here: there is no computer opponent.
 */
export default function Basic() {
  return <Chess width="100%" height={702} style={{ minWidth: 420, maxWidth: 971 }} />;
}
