// Checks of the built documentation site, read from the files in docs/dist the way a visitor's
// browser or a coding agent gets them.
//
//   readSite(outDir)      every HTML page and Markdown file: its anchors, its links, its examples
//   checkLinks(site)      internal links and anchors that lead nowhere
//   coverage(options)     one row per inventory component and per demo: page, props, examples,
//                         navigation, and (from the browser pass) rendering in both appearances
//   renderCoverage(report) the same as a Markdown document
//
// docs/build.mjs runs them after prerendering: a broken internal link fails the build, and the
// coverage report is written to docs/dist/coverage.md and coverage.json. Nothing here needs a
// browser; what only a browser can tell comes in through `browser` (docs/browser-pass.mjs).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { slug } from "./slug.mjs";

const posix = (file) => file.split(path.sep).join("/");

function walk(dir, root = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, root, out);
    else out.push(posix(path.relative(root, file)));
  }
  return out;
}

const text = (node) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();

/** What the checks need from one prerendered page. */
function readHtml(html) {
  // Parsed as a fragment, not as a window: a window is only given back to memory when the
  // event loop turns, and reading a site of hundreds of pages in one go would hold them all
  // (several megabytes each). The elements of a page are the same either way.
  const document = JSDOM.fragment(html);
  // An example's preview is the example's own content: a link inside a demo browser window or
  // a mail message is not a link of the site.
  const ofSite = (element) => !element.closest(".docs-preview");
  const links = [];
  for (const [selector, attribute] of [
    ["a[href]", "href"],
    ["link[href]", "href"],
    ["script[src]", "src"],
    ["img[src]", "src"],
  ]) {
    for (const element of document.querySelectorAll(selector)) {
      if (ofSite(element)) links.push(element.getAttribute(attribute) ?? "");
    }
  }
  const article = document.querySelector(".docs-article");
  return {
    // What a fragment can name: the id of any element, or the older <a name>. The name of
    // any other element (a form field's, say) is no destination.
    ids: new Set(
      [...document.querySelectorAll("[id], a[name]")].flatMap((element) => {
        const name = element.localName === "a" ? element.getAttribute("name") : null;
        return [element.id, name].filter(Boolean);
      }),
    ),
    links,
    route: document.getElementById("root")?.getAttribute("data-path") ?? null,
    sidebar: [...document.querySelectorAll(".docs-sidebar li a[href]")].map((a) =>
      a.getAttribute("href"),
    ),
    gallery: [...document.querySelectorAll(".docs-gallery a[href]")].map((a) =>
      a.getAttribute("href"),
    ),
    galleryImages: [...document.querySelectorAll(".docs-gallery img[src]")].map((img) =>
      img.getAttribute("src"),
    ),
    headings: [...(article?.querySelectorAll("h2") ?? [])].filter(ofSite).map(text),
    examples: [...document.querySelectorAll("figure.docs-example")].map(
      (figure) => figure.getAttribute("data-example") ?? "",
    ),
    errors: [...document.querySelectorAll(".docs-error")].map(text),
    propsTables: [...document.querySelectorAll("table.docs-table")].filter(
      (table) => ofSite(table) && text(table.querySelector("thead th")) === "Prop",
    ).length,
    lead: text(document.querySelector(".docs-lead")),
  };
}

/**
 * Anchors and links of a Markdown file, read with a Markdown parser (CommonMark and GFM), so
 * that what is quoted in code is not taken for a link and every way of writing one is found:
 * inline links and images, reference definitions (`[label]: target`, however they are used),
 * autolinks, and `<a href>` and `<img src>` written as HTML.
 */
export function readMarkdown(markdown) {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  const seen = new Map();
  const anchors = new Set();
  const links = [];
  // An id written by hand is taken before any is generated, as on the site
  // (rehypeHeadingIds): a heading whose own id it would be gets the next one.
  const reserve = (node) => {
    if (node.type === "html") {
      for (const element of JSDOM.fragment(node.value).querySelectorAll("[id]")) {
        const id = element.getAttribute("id");
        if (id && !seen.has(id)) seen.set(id, 0);
      }
    }
    for (const child of node.children ?? []) reserve(child);
  };
  reserve(tree);
  // The text of a heading as rendered: code and emphasis without their marks, no link targets,
  // and a picture by its alternative text, also one written as HTML (`<img alt="Status">`),
  // as on the site (slug.mjs, `textOf`).
  const rendered = (node) => {
    if (node.type === "html") {
      return [...JSDOM.fragment(node.value).querySelectorAll("img[alt]")]
        .map((image) => image.getAttribute("alt"))
        .join("");
    }
    return "value" in node
      ? node.value
      : (node.alt ?? (node.children ?? []).map(rendered).join(""));
  };
  const visit = (node) => {
    if (node.type === "heading") anchors.add(slug(rendered(node), seen));
    if (node.type === "link" || node.type === "image" || node.type === "definition") {
      links.push(node.url);
    }
    if (node.type === "html") {
      const fragment = JSDOM.fragment(node.value);
      for (const element of fragment.querySelectorAll("a[href]")) {
        links.push(element.getAttribute("href"));
      }
      for (const element of fragment.querySelectorAll("img[src]")) {
        links.push(element.getAttribute("src"));
      }
      // An anchor written by hand: <a id="details"></a>, or the older <a name>. Only an <a>
      // is a destination by its name.
      for (const element of fragment.querySelectorAll("[id], a[name]")) {
        const name = element.localName === "a" ? element.getAttribute("name") : null;
        for (const anchor of [element.getAttribute("id"), name]) {
          if (anchor) anchors.add(anchor);
        }
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return { anchors, links };
}

/**
 * Read a built site.
 * @param {string} outDir docs/dist
 */
export function readSite(outDir) {
  const files = walk(outDir);
  const html = new Map();
  const markdown = new Map();
  for (const file of files) {
    if (file.endsWith(".html"))
      html.set(file, readHtml(readFileSync(path.join(outDir, file), "utf8")));
    else if (file.endsWith(".md") || /^llms(-full)?\.txt$/.test(file)) {
      markdown.set(file, readMarkdown(readFileSync(path.join(outDir, file), "utf8")));
    }
  }
  return { outDir, files: new Set(files), html, markdown };
}

const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * What their own command writes into docs/dist after the site is built, so a link to it cannot
 * be resolved here: the full-window desktop page, `npm run desktop:build` (its page and its
 * `assets` folder; Vite's outDir is docs/dist/desktop). Any other path under desktop/ is checked.
 */
const SEPARATE_BUILDS = [/^desktop(\/(index\.html)?)?$/, /^desktop\/assets\/./];

/** The file a site path names: itself, or the page prerendered in the folder of that name. */
function resolveFile(site, target) {
  const clean = target.replace(/^\/+|\/+$/g, "");
  for (const candidate of clean === "" ? ["index.html"] : [clean, `${clean}/index.html`]) {
    if (site.files.has(candidate)) return candidate;
  }
  return null;
}

const decode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * Internal links that lead nowhere: a page or file that was not built, or an anchor the target
 * does not have. Links to other sites are not followed; an absolute link to this site, which
 * the Markdown export has when it is built with DOCS_SITE_URL, is checked like any other.
 * @param {ReturnType<typeof readSite>} site
 * @param {{ base?: string, siteUrl?: string }} [options] base: the public path the site was
 *   built for; siteUrl: its full public URL, base included
 * @returns {{ file: string, link: string, reason: string }[]}
 */
export function checkLinks(site, { base = "/", siteUrl } = {}) {
  const root = base.replace(/\/?$/, "/");
  const home = siteUrl ? new URL(siteUrl.replace(/\/?$/, "/")) : null;
  const problems = [];

  /**
   * An absolute link into this site, as the path from the site's root; else null. A link
   * that names only the host ("//docs.example/guide") is absolute too.
   */
  const withinSite = (link) => {
    if (!home || !/^([a-z][a-z0-9+.-]*:)?\/\//i.test(link) || !URL.canParse(link, home)) {
      return null;
    }
    const url = new URL(link, home);
    if (url.origin !== home.origin || !`${url.pathname}/`.startsWith(home.pathname)) return null;
    return `${root}${url.pathname.slice(home.pathname.length)}${url.hash}`;
  };

  const check = (file, written, kind) => {
    const link = withinSite(written) ?? written;
    if (link === "" || EXTERNAL.test(link)) return;
    const hashAt = link.indexOf("#");
    const raw = (hashAt === -1 ? link : link.slice(0, hashAt)).replace(/\?.*$/, "");
    // As a browser reads it: "/guide/../sibling" is "/sibling".
    const target = raw.startsWith("/") ? new URL(raw, "http://site.invalid").pathname : raw;
    const anchor = hashAt === -1 ? "" : decode(link.slice(hashAt + 1));
    let found = file;
    if (target !== "") {
      let sitePath;
      if (target.startsWith("/")) {
        if (!`${target}/`.startsWith(root)) {
          problems.push({ file, link: written, reason: `is outside the site's base path ${root}` });
          return;
        }
        sitePath = target.slice(root.length);
      } else if (kind === "html") {
        // A page is served at its route with and without a trailing slash ("/guide" and
        // "/guide/"), and a relative link means a different page at each.
        problems.push({
          file,
          link: written,
          reason:
            "is relative, which resolves differently at /route and /route/: write it from the site root",
        });
        return;
      } else {
        // A Markdown file has one URL, so a relative link in it is relative to the file.
        const from = path.posix.dirname(file);
        sitePath = path.posix.normalize(path.posix.join(from, decode(target)));
        if (sitePath.startsWith("..")) {
          problems.push({ file, link: written, reason: "leads outside the site" });
          return;
        }
        if (sitePath === ".") sitePath = "";
      }
      const decoded = decode(sitePath);
      if (SEPARATE_BUILDS.some((built) => built.test(decoded))) return;
      found = resolveFile(site, decoded);
      if (!found) {
        problems.push({ file, link: written, reason: "no such page or file in the built site" });
        return;
      }
    }
    if (anchor === "" || anchor === "top") return;
    const page = site.html.get(found);
    if (page) {
      if (!page.ids.has(anchor)) {
        problems.push({
          file,
          link: written,
          reason: `${found} has no element with id "${anchor}"`,
        });
      }
      return;
    }
    // llms-full.txt holds every page, so the same heading occurs in it many times: its
    // anchors are the ones a reader of that one long document gets, with a counter on each
    // repeat (`readMarkdown`). A page's link to a heading of its own names the page's file
    // there (agent-docs.ts, `sectionLinks`), so it is not one of these.
    const document = site.markdown.get(found);
    if (document && !document.anchors.has(anchor)) {
      problems.push({
        file,
        link: written,
        reason: `${found} has no heading with anchor "${anchor}"`,
      });
    }
  };

  for (const [file, page] of site.html) {
    for (const link of page.links) check(file, link, "html");
  }
  for (const [file, document] of site.markdown) {
    for (const link of document.links) check(file, link, "markdown");
  }
  return problems;
}

function frontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  const data = {};
  for (const line of match?.[1]?.split(/\r?\n/) ?? []) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      data[line.slice(0, colon).trim()] = line
        .slice(colon + 1)
        .trim()
        .replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  return data;
}

const folders = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name)
        .sort()
    : [];

/**
 * The foundations of the inventory that are not components (the accent colour, materials, the
 * focus ring) are documented by a guide. A guide says which with `inventory: id, id` in its
 * frontmatter; this reads that as inventory id to route.
 */
function guidesByInventoryId(root) {
  const dir = path.join(root, "docs/content");
  const map = new Map();
  for (const name of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".mdx")) : []) {
    const meta = frontmatter(readFileSync(path.join(dir, name), "utf8"));
    const route = meta.path ?? (name === "index.mdx" ? "/" : `/${name.slice(0, -4)}`);
    for (const id of (meta.inventory ?? "").split(",").map((value) => value.trim())) {
      if (id) map.set(id, route);
    }
  }
  return map;
}

/**
 * Coverage of the site: one row per component of the measured inventory, per component folder
 * the inventory does not list, and per demo.
 *
 * @param {object} options
 * @param {string} options.root repository root
 * @param {ReturnType<typeof readSite>} options.site
 * @param {string} [options.base] public base path of the build
 * @param {Map<string, object> | null} [options.browser] results of the browser pass by route,
 *   or null when no browser ran
 * @param {Set<string> | null} [options.screenshots] routes with a light and a dark screenshot
 */
export function coverage({ root, site, base = "/", browser = null, screenshots = null }) {
  const prefix = base.replace(/\/$/, "");
  const inventoryFile = path.join(root, "reference/spec/inventory.json");
  /**
   * @type {{ id: string, name: string, category: string, status: string, batch: string,
   *   implementation?: string[] }[]}
   */
  const inventory = existsSync(inventoryFile)
    ? JSON.parse(readFileSync(inventoryFile, "utf8")).components
    : [];
  const guides = guidesByInventoryId(root);
  const componentFolders = folders(path.join(root, "src/components"));
  const demoFolders = folders(path.join(root, "demos"));
  const home = site.html.get("index.html");
  const sidebar = new Set(home?.sidebar ?? []);
  const indexLinks = (route) =>
    new Set(site.html.get(`${route.slice(1)}/index.html`)?.gallery ?? []);
  const componentIndex = indexLinks("/components");
  const demoIndex = indexLinks("/demos");

  const row = (route, index, { needsProps }) => {
    const file = route === "/" ? "index.html" : `${route.slice(1)}/index.html`;
    const page = site.html.get(file);
    const seen = browser?.get(route);
    // A page that throws, or logs an error, does not count as rendering, whatever is on it.
    const rendering = (failures) =>
      !seen ? "not checked" : failures.length === 0 && seen.errors.length === 0 ? "ok" : "fails";
    const issues = [];
    const result = {
      route,
      page: Boolean(page),
      description: Boolean(page?.lead),
      props: page ? page.propsTables : 0,
      examples: page ? page.examples.length : 0,
      usage: Boolean(page?.headings.some((heading) => /^usage\b/i.test(heading))),
      accessibility: Boolean(page?.headings.some((heading) => /^accessibility\b/i.test(heading))),
      sidebar: sidebar.has(`${prefix}${route}`),
      index: index ? index.has(`${prefix}${route}`) : null,
      light: rendering(seen?.light),
      dark: rendering(seen?.dark),
      screenshots: screenshots ? screenshots.has(route) : null,
      issues,
    };
    if (!page) {
      issues.push("no page in the built site");
      return result;
    }
    if (!result.description) issues.push("no description");
    if (needsProps && result.props === 0) issues.push("no props table");
    if (result.examples === 0) issues.push("no live example");
    for (const error of page.errors) issues.push(`page shows an error: ${error}`);
    if (!result.sidebar) issues.push("not linked from the sidebar");
    if (index && !result.index) issues.push("not linked from the index page");
    if (seen) {
      for (const appearance of ["light", "dark"]) {
        for (const failure of seen[appearance]) issues.push(`${appearance}: ${failure}`);
      }
      for (const error of seen.errors) issues.push(`browser error: ${error}`);
    }
    if (screenshots && !result.screenshots) issues.push("no light and dark screenshot");
    return result;
  };

  const components = inventory.map((entry) => {
    const common = {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      status: entry.status,
      batch: entry.batch,
    };
    if (componentFolders.includes(entry.id)) {
      return {
        ...common,
        kind: "component",
        ...row(`/components/${entry.id}`, componentIndex, { needsProps: true }),
      };
    }
    // The guide that claims the row, or the guide the inventory itself names as implementing
    // it ("docs/content/theming.mdx").
    const named = (entry.implementation ?? [])
      .map((file) => /^docs\/content\/(.+)\.mdx$/.exec(file)?.[1])
      .find(Boolean);
    const guide = guides.get(entry.id) ?? (named ? (named === "index" ? "/" : `/${named}`) : null);
    if (guide) {
      // A foundation is a set of tokens and attributes: its guide has no props and is linked
      // from the sidebar as a guide, not from the component index.
      const file = guide === "/" ? "index.html" : `${guide.slice(1)}/index.html`;
      const page = site.html.get(file);
      const issues = [];
      if (!page) issues.push(`its guide ${guide} is not in the built site`);
      else if (!sidebar.has(`${prefix}${guide}`)) issues.push("guide not linked from the sidebar");
      return {
        ...common,
        kind: "foundation",
        route: guide,
        page: Boolean(page),
        description: Boolean(page?.lead),
        props: null,
        examples: page ? page.examples.length : 0,
        usage: null,
        accessibility: null,
        sidebar: sidebar.has(`${prefix}${guide}`),
        index: null,
        light: "n/a",
        dark: "n/a",
        screenshots: null,
        issues,
      };
    }
    return {
      ...common,
      kind: "missing",
      route: null,
      page: false,
      description: false,
      props: 0,
      examples: 0,
      usage: false,
      accessibility: false,
      sidebar: false,
      index: false,
      light: "n/a",
      dark: "n/a",
      screenshots: null,
      issues: ["no component folder and no guide documents it"],
    };
  });

  const listed = new Set(inventory.map((entry) => entry.id));
  const extras = componentFolders
    .filter((name) => !listed.has(name))
    .map((name) => ({
      id: name,
      kind: "component",
      ...row(`/components/${name}`, componentIndex, { needsProps: true }),
    }));

  const demos = demoFolders.map((name) => ({
    id: name,
    ...row(`/demos/${name}`, demoIndex, { needsProps: false }),
  }));

  const all = [...components, ...extras, ...demos];
  return {
    browser: Boolean(browser),
    summary: {
      inventory: components.length,
      inventoryDocumented: components.filter((entry) => entry.page).length,
      inventoryComplete: components.filter((entry) => entry.issues.length === 0).length,
      otherComponents: extras.length,
      demos: demos.length,
      demosComplete: demos.filter((entry) => entry.issues.length === 0).length,
      desktopDemo: demos.some((entry) => entry.id === "desktop" && entry.page),
      withIssues: all.filter((entry) => entry.issues.length > 0).length,
    },
    components,
    extras,
    demos,
  };
}

const mark = (value) => (value === null ? "n/a" : value ? "yes" : "**no**");
const state = (value) => (value === "fails" ? "**fails**" : value);

/** The coverage report as a Markdown document. */
export function renderCoverage(
  report,
  { title = "Documentation coverage", notes = [], base = "/" } = {},
) {
  const prefix = base.replace(/\/$/, "");
  const { summary } = report;
  const lines = [
    `# ${title}`,
    "",
    "Generated by `npm run docs:build` (docs/site-check.mjs) from the built site in `docs/dist`,",
    "the component and demo folders, and `reference/spec/inventory.json`. Do not edit by hand.",
    "",
    ...notes.flatMap((note) => [note, ""]),
    `- Inventory components: ${summary.inventory}; documented by a page: ${summary.inventoryDocumented}; without any issue below: ${summary.inventoryComplete}.`,
    `- Component folders the inventory does not list: ${summary.otherComponents}.`,
    `- Demos: ${summary.demos}; without any issue: ${summary.demosComplete}. Desktop demo page: ${summary.desktopDemo ? "present" : "missing"}.`,
    `- Rows with at least one issue: ${summary.withIssues}.`,
    report.browser
      ? "- Rendering was checked in a real browser (Chromium): every example of every page, in Aqua and in Dark Aqua."
      : "- Rendering in a browser was **not checked** in this build (no browser installed, or DOCS_BROWSER=0): the Light and Dark columns say so.",
    "",
    "Columns: Page, the page exists in the built site. Props, the number of props tables on it.",
    "Examples, the number of live examples. Light and Dark, every example on the page painted",
    "something in that appearance and the page raised no error. Nav, linked from the sidebar.",
    "Index, linked from the component or demo index page. Shots, a light and a dark screenshot",
    "were generated.",
    "",
  ];
  const table = (rows, first) => {
    lines.push(
      `| ${first} | Page | Props | Examples | Light | Dark | Nav | Index | Shots | Issues |`,
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const entry of rows) {
      // A link only to a page that was built: the report is link-checked with the site, and
      // a folder without a page is a gap to report, not a broken link.
      const label = entry.route && entry.page ? `[${entry.id}](${prefix}${entry.route})` : entry.id;
      lines.push(
        `| ${label}${entry.kind === "foundation" ? " (guide)" : ""} | ${mark(entry.page)} | ${
          entry.props === null ? "n/a" : entry.props
        } | ${entry.examples} | ${state(entry.light)} | ${state(entry.dark)} | ${mark(
          entry.sidebar,
        )} | ${mark(entry.index)} | ${mark(entry.screenshots)} | ${
          entry.issues.join("; ").replace(/\|/g, "\\|") || "none"
        } |`,
      );
    }
    lines.push("");
  };
  const categories = [...new Set(report.components.map((entry) => entry.category))];
  lines.push("## Inventory components", "");
  for (const category of categories) {
    lines.push(`### ${category}`, "");
    table(
      report.components.filter((entry) => entry.category === category),
      "Component",
    );
  }
  if (report.extras.length > 0) {
    lines.push("## Components the inventory does not list", "");
    table(report.extras, "Component");
  }
  lines.push("## Demos", "");
  table(report.demos, "Demo");
  return `${lines.join("\n").trimEnd()}\n`;
}
