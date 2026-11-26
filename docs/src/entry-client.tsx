import { trackWindowActivation } from "macalicious/lib/window-activation";
import { createRoot, hydrateRoot } from "react-dom/client";
import { App, loadPage, pathFromLocation } from "./app";

const container = document.getElementById("root");
if (!container) throw new Error("#root is missing");

// Controls take their inactive-window look while the browser window is in the background.
trackWindowActivation();

// Load the current page's module before hydrating, so the first client render matches the
// prerendered HTML.
const path = pathFromLocation(location.pathname);
const initial = await loadPage(path);
// Hydrate when the HTML is this page's prerender. Render fresh when the root is empty (dev
// server) or when a host with a single-page fallback answered with another page's HTML.
if (container.dataset.path === path) hydrateRoot(container, <App initial={initial} />);
else {
  container.textContent = "";
  createRoot(container).render(<App initial={initial} />);
}
