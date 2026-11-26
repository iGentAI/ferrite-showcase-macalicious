import { CatalinaDesktop } from "../desktop";

/**
 * The desktop with every demo application in its Dock. Click a tile to open the application
 * as a window; drag it by its title bar, resize it at its edges, and use its three buttons.
 */
export default function Basic() {
  return <CatalinaDesktop style={{ height: 720 }} />;
}
