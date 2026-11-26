import "macalicious/tokens.css";
import "macalicious/fallback-font.css";
import { trackWindowActivation } from "macalicious/lib/window-activation";
import { createRoot } from "react-dom/client";
import { CatalinaDesktop } from "../../demos/desktop/desktop";
import { AccountsDesktop } from "../../demos/desktop/desktop-accounts";
import { servedByDesktopApp } from "../../demos/desktop/desktop-server";

/**
 * The desktop demo on its own page, filling the browser window: the page to present the
 * library with. The documentation's desktop page shows the same desktop inside its layout.
 */
const container = document.getElementById("root");
if (!container) throw new Error("#root is missing");

// Controls take their inactive-window look while the browser window is in the background.
trackWindowActivation();

// Served by the desktop's Ferrite application, the page signs people in first, and each gets a
// desktop of their own; everywhere else it opens straight onto the desktop.
const Page = servedByDesktopApp() ? AccountsDesktop : CatalinaDesktop;
createRoot(container).render(<Page style={{ height: "100%" }} />);
