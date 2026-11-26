import { pages } from "virtual:docs-pages";
import { renderToString } from "react-dom/server";
import { prerender } from "react-dom/static";
import { App, loadPage } from "./app";

/** Routes to prerender. */
export const routes = pages.map((page) => page.path);

/** Each route's twin in plain Markdown, for the `<link rel="alternate">` of its HTML page. */
export const markdown: Record<string, string> = Object.fromEntries(
  pages.map((page) => [page.path, page.markdown]),
);

/**
 * Render one route to static HTML.
 *
 * Two passes: the first waits for every lazily loaded example and discards its output, which
 * leaves the modules cached; the second then renders synchronously, so the HTML has every
 * example in place and none of the inline scripts that streaming would add.
 */
export async function render(path: string): Promise<{ html: string; title: string }> {
  const initial = await loadPage(path);
  const { prelude } = await prerender(<App initial={initial} />);
  await new Response(prelude).text();
  const html = renderToString(<App initial={initial} />);
  return { html, title: initial.page ? `${initial.page.title} · Macalicious` : "Macalicious" };
}
