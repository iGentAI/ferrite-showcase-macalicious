import { type Page, pages } from "virtual:docs-pages";
import {
  ACCENTS,
  type Accent,
  type Appearance,
  setAccent,
  setAppearance,
} from "macalicious/lib/appearance";
import { PushButton } from "macalicious/push-button";
import {
  type ComponentType,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import "macalicious/tokens.css";
import "macalicious/fallback-font.css";
import "./docs.css";
import { mdxComponents, PageContext } from "./mdx";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Site path ("/components/push-button") to URL, honouring the configured base. */
export const href = (path: string) => `${BASE}${path}`;

/** URL pathname to site path. */
export function pathFromLocation(pathname: string): string {
  let path = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  path = path.replace(/\/index\.html$/, "/").replace(/(.)\/$/, "$1");
  return path || "/";
}

interface Loaded {
  path: string;
  page: Page | undefined;
  Content: ComponentType<{ components?: Record<string, unknown> }> | undefined;
}

export async function loadPage(path: string): Promise<Loaded> {
  const page = pages.find((candidate) => candidate.path === path);
  return { path, page, Content: page ? (await page.load()).default : undefined };
}

const STORAGE_KEY = "macalicious-docs";

function Settings() {
  // Read after mount so the prerendered markup and the first client render agree.
  const [appearance, setAppearanceState] = useState<Appearance>("auto");
  const [accent, setAccentState] = useState<Accent>("blue");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (stored.appearance) setAppearanceState(stored.appearance);
      if (stored.accent) setAccentState(stored.accent);
    } catch {
      // Storage is unavailable; keep the defaults.
    }
  }, []);

  const store = (next: { appearance: Appearance; accent: Accent }) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage is unavailable; the choice lasts for this page view.
    }
  };

  return (
    <div className="docs-settings">
      <fieldset>
        <legend>Appearance</legend>
        {(["auto", "light", "dark"] as const).map((value) => (
          <PushButton
            key={value}
            size="small"
            aria-pressed={appearance === value}
            data-force={appearance === value ? "pressed" : undefined}
            onClick={() => {
              setAppearance(value);
              setAppearanceState(value);
              store({ appearance: value, accent });
            }}
          >
            {value[0]?.toUpperCase() + value.slice(1)}
          </PushButton>
        ))}
      </fieldset>
      <fieldset>
        <legend>Accent colour</legend>
        {ACCENTS.map((value) => (
          <button
            key={value}
            type="button"
            className="docs-swatch"
            data-accent={value}
            aria-label={value}
            aria-pressed={accent === value}
            title={value}
            onClick={() => {
              setAccent(value);
              setAccentState(value);
              store({ appearance, accent: value });
            }}
          />
        ))}
      </fieldset>
    </div>
  );
}

function Sidebar({ current }: { current: string }) {
  const groups = useMemo(() => {
    const map = new Map<string, Page[]>();
    for (const page of pages) {
      const list = map.get(page.group);
      if (list) list.push(page);
      else map.set(page.group, [page]);
    }
    return [...map];
  }, []);

  return (
    <nav className="docs-sidebar" aria-label="Documentation">
      <a className="docs-brand" href={href("/")}>
        Macalicious
      </a>
      {groups.map(([group, list]) => (
        <section key={group}>
          <h2>{group}</h2>
          <ul>
            {list.map((page) => (
              <li key={page.path}>
                <a href={href(page.path)} aria-current={page.path === current ? "page" : undefined}>
                  {page.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Settings />
    </nav>
  );
}

export function App({ initial }: { initial: Loaded }) {
  const [loaded, setLoaded] = useState(initial);

  const show = useCallback(async (path: string, hash = "") => {
    setLoaded(await loadPage(path));
    requestAnimationFrame(() => {
      const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
    });
  }, []);

  // Back and forward.
  useEffect(() => {
    const onPopState = () => void show(pathFromLocation(location.pathname), location.hash);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [show]);

  useEffect(() => {
    document.title = loaded.page ? `${loaded.page.title} · Macalicious` : "Macalicious";
  }, [loaded.page]);

  // Tells the site check's browser pass (docs/browser-pass.mjs) that the page is interactive.
  useEffect(() => {
    document.documentElement.setAttribute("data-docs-ready", "");
  }, []);

  // One delegated handler turns every internal link into a client-side navigation.
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(`${BASE}/`)) return;
    const path = pathFromLocation(url.pathname);
    if (path === loaded.path && url.hash) return;
    if (!pages.some((page) => page.path === path)) return;
    event.preventDefault();
    history.pushState(null, "", url);
    void show(path, url.hash);
  };

  const { page, Content } = loaded;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delegated link handling; the links themselves are the interactive elements
    // biome-ignore lint/a11y/useKeyWithClickEvents: links are activated natively by the keyboard, which fires click
    <div className="docs-root" onClick={onClick}>
      <Sidebar current={loaded.path} />
      <main className="docs-main" data-layout={page?.layout ?? "page"}>
        {page && Content ? (
          <PageContext value={page}>
            <article className="docs-article">
              {page.ownHeading ? null : (
                <header>
                  <h1>{page.title}</h1>
                  {page.description ? <p className="docs-lead">{page.description}</p> : null}
                </header>
              )}
              <Content components={mdxComponents} />
              <footer className="docs-page-footer">
                For coding agents: <a href={href(`/${page.markdown}`)}>this page as Markdown</a>
                {" · "}
                <a href={href("/llms.txt")}>llms.txt</a>
              </footer>
            </article>
          </PageContext>
        ) : (
          <article className="docs-article">
            <h1>Page not found</h1>
            <p>
              There is no page at <code>{loaded.path}</code>.{" "}
              <a href={href("/")}>Back to the start.</a>
            </p>
          </article>
        )}
      </main>
    </div>
  );
}
