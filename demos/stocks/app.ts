import { DesktopStocks } from "./stocks-desktop";

/**
 * What a desktop page needs to list, launch and host the app: render `component` (its root is
 * the library's `Window`, and it takes that window's props together with the window controls'
 * and the drag region's callbacks, which are the props a managed window's `render` supplies),
 * open it at `defaultSize`, keep it at least `minSize`, and show `menus` in the menu bar while
 * it is the front application.
 */
export const stocksApp = {
  /** Identifies the app among the demos: the folder's name. */
  id: "stocks",
  /** The application's name: the title of its application menu and its Dock label. */
  name: "Stocks",
  /**
   * The app as a window: the demo's market, or real quotes, the person's watchlist and price
   * alerts when the desktop's Ferrite application serves it (`stocks-desktop.tsx`).
   */
  component: DesktopStocks,
  /** The frame the window opens at, in points: the reference capture's. */
  defaultSize: { width: 1148, height: 803 },
  /** The smallest frame: the 330 pt sidebar and a pane wide enough for two stories to a row. */
  minSize: { width: 700, height: 420 },
  /** The window can be resized: the news column stays centred in the pane and narrows with it. */
  resizable: true,
  /** Menu titles after the Apple menu; the first is the application menu. */
  menus: ["Stocks", "File", "Edit", "View", "Window", "Help"],
} as const;

/** The same descriptor under the name every demo's `app.ts` shares. */
export const app = stocksApp;

export type { StocksProps } from "./stocks";
export type {
  StockAlert,
  StockHistory,
  StockQuote,
  StockSearchResult,
  StockStory,
  StocksMarket,
} from "./stocks-data";
