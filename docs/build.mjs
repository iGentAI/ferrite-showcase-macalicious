#!/usr/bin/env node
// Build the documentation site to static HTML in docs/dist.
//
//   1. client bundle (JS, CSS, assets)
//   2. server bundle of the same app, in a temporary folder
//   3. prerender every page to <route>/index.html, so the site works on any static host
//      and each page is readable before (or without) JavaScript
//
// The client build also writes the documentation as plain Markdown for coding agents: llms.txt,
// llms-full.txt and <route>.md beside every page (docs/agent-docs.ts). It fails when a component
// folder lacks what its page needs.
//
//   4. browser pass (docs/browser-pass.mjs), when Playwright has a Chromium installed: every
//      component and demo page is opened in Aqua and in Dark Aqua, examples that do not render
//      are reported, and the light and dark screenshots the index pages show are taken
//   5. site check (docs/site-check.mjs): every internal link and anchor of the built site, in
//      the HTML and in the Markdown export, must lead somewhere, or the build fails; and the
//      coverage report (inventory components and demos against their pages) is written to
//      coverage.md and coverage.json
//
// DOCS_BASE=/sub/path/ npm run docs:build   when the site is not served from the domain root.
// DOCS_SITE_URL=https://host/sub/path/      makes the links in llms.txt absolute.
// DOCS_BROWSER=0                            skips the browser pass (no screenshots).
// REQUIRE_BROWSER_TESTS=1                   fails when the browser pass cannot run.
// ENFORCE_COMPONENTS=a,b                    examples that do not render fail the build only in
//                                           these component folders (and in every demo).
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import { browserPass, launchBrowser } from "./browser-pass.mjs";
import { checkLinks, coverage, readMarkdown, readSite, renderCoverage } from "./site-check.mjs";

const docsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(docsDir, "..");
const configFile = path.join(docsDir, "vite.config.ts");
const outDir = path.join(docsDir, "dist");
// Per process: checkouts that share one node_modules build at the same time.
const serverDir = path.join(repoRoot, "node_modules", `.docs-server-${process.pid}`);

try {
  await build({ configFile, logLevel: "warn" });
} catch (error) {
  // A failed build is the author's to fix: print what is wrong, not the bundler's stack.
  const message = String(error.message)
    .split("\n")
    .filter((line) => !/^\s+at /.test(line))
    .join("\n");
  console.error(`\ndocs: build failed\n${message}`);
  process.exit(1);
}
await build({
  configFile,
  logLevel: "warn",
  build: {
    ssr: path.join(docsDir, "src/entry-server.tsx"),
    outDir: serverDir,
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "entry-server.mjs" } },
  },
});

const { render, routes, markdown } = await import(
  pathToFileURL(path.join(serverDir, "entry-server.mjs")).href
);
const template = await readFile(path.join(outDir, "index.html"), "utf8");
const ROOT = '<div id="root"><!--app--></div>';
if (!template.includes(ROOT)) throw new Error("docs/index.html lost its #root marker");
const base = (process.env.DOCS_BASE ?? "/").replace(/\/?$/, "/");

const escapeHtml = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// data-path tells the client which page this HTML is, so it only hydrates a matching URL.
// The alternate link points a crawler or an agent at the same page as plain Markdown. The list
// of routes that have screenshots is in every page, because any page can navigate to an index
// page without loading it from the server.
const page = (route, { html, title }, screenshots) =>
  template
    .replace(
      ROOT,
      () =>
        `<div id="root" data-path="${escapeHtml(route)}">${html}</div>\n    <script id="docs-screenshots" type="application/json">${JSON.stringify(screenshots).replace(/</g, "\\u003c")}</script>`,
    )
    .replace(/<title>.*?<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace("</head>", () =>
      markdown[route]
        ? `  <link rel="alternate" type="text/markdown" href="${escapeHtml(base + markdown[route])}" />\n  </head>`
        : "</head>",
    );

const missing = ["llms.txt", "llms-full.txt", ...Object.values(markdown)].filter(
  (file) => !existsSync(path.join(outDir, file)),
);
if (missing.length > 0) {
  throw new Error(`docs: the Markdown export is incomplete, missing ${missing.join(", ")}`);
}

const rendered = new Map();
for (const route of routes) rendered.set(route, await render(route));
const notFound = await render("/404");

const writePages = async (screenshots) => {
  for (const route of routes) {
    const file = path.join(outDir, route === "/" ? "" : route.slice(1), "index.html");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, page(route, rendered.get(route), screenshots));
  }
  // Static hosts serve 404.html for unknown paths; the client then renders whatever page the
  // URL names, or the app's "not found" page.
  await writeFile(path.join(outDir, "404.html"), page("", notFound, screenshots));
};
await writePages([]);

// Browser pass: what only a browser can tell, and the screenshots.
let seen = null;
let screenshots = null;
let browser = null;
if (process.env.DOCS_BROWSER !== "0") {
  try {
    browser = await launchBrowser();
  } catch (error) {
    // Installed, and it does not start: say so, rather than building as if there were none.
    await rm(serverDir, { recursive: true, force: true });
    console.error(
      `\ndocs: Chromium is installed but did not start, so the examples cannot be checked in a browser\n  ${String(error.message ?? error).split("\n")[0]}\n  Repair the browser (npx playwright install-deps chromium), or build with DOCS_BROWSER=0 to skip the browser pass.`,
    );
    process.exit(1);
  }
}
if (browser) {
  try {
    const result = await browserPass({
      browser,
      outDir,
      base,
      routes: routes.filter((route) => /^\/(components|demos)\/./.test(route)),
    });
    seen = result.results;
    screenshots = result.screenshots;
  } finally {
    await browser.close();
  }
  // The index pages show the screenshots: render those again now that the pictures exist.
  const list = [...screenshots].sort();
  globalThis.__DOCS_SCREENSHOTS__ = list;
  for (const route of routes) {
    if (rendered.get(route).html.includes('class="docs-gallery"')) {
      rendered.set(route, await render(route));
    }
  }
  await writePages(list);
} else if (process.env.REQUIRE_BROWSER_TESTS === "1" && process.env.DOCS_BROWSER !== "0") {
  await rm(serverDir, { recursive: true, force: true });
  console.error(
    "\ndocs: REQUIRE_BROWSER_TESTS=1, but Chromium is not installed (npm run visual:install)",
  );
  process.exit(1);
}
await rm(serverDir, { recursive: true, force: true });

console.log(`docs: prerendered ${routes.length} pages to ${path.relative(process.cwd(), outDir)}/`);
for (const route of routes) console.log(`  ${route}`);
console.log(
  `docs: Markdown for coding agents in ${path.relative(process.cwd(), outDir)}/: llms.txt, llms-full.txt and ${Object.keys(markdown).length} pages (<route>.md)`,
);
console.log(
  screenshots
    ? `docs: browser pass over ${seen.size} component and demo pages in Aqua and Dark Aqua; ${screenshots.size} have light and dark screenshots in ${path.relative(process.cwd(), outDir)}/screenshots/`
    : `docs: browser pass skipped (${process.env.DOCS_BROWSER === "0" ? "DOCS_BROWSER=0" : "Chromium is not installed: npm run visual:install"}); examples were not checked in a browser and the index pages have no screenshots`,
);

// Site check: coverage, then links. The coverage report is a file of the site like any other,
// so it is written first and its links are checked with the rest.
const site = readSite(outDir);
const report = coverage({ root: repoRoot, site, base, browser: seen, screenshots });
const coverageText = renderCoverage(report, { base });
await writeFile(path.join(outDir, "coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(outDir, "coverage.md"), coverageText);
site.files.add("coverage.json").add("coverage.md");
site.markdown.set("coverage.md", readMarkdown(coverageText));
const broken = checkLinks(site, { base, siteUrl: process.env.DOCS_SITE_URL });

const { summary } = report;
console.log(
  `docs: coverage in ${path.relative(process.cwd(), outDir)}/coverage.md: ${summary.inventoryDocumented} of ${summary.inventory} inventory components documented, ${summary.demos} demos, ${summary.withIssues} row(s) with issues`,
);
const only = (process.env.ENFORCE_COMPONENTS ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const enforced = (entry) =>
  only.length === 0 || !entry.route?.startsWith("/components/") || only.includes(entry.id);
const rows = [...report.components, ...report.extras, ...report.demos].filter(
  (entry) => entry.issues.length > 0,
);
const list = (entries) =>
  entries.map((entry) => `  ${entry.route ?? entry.id}: ${entry.issues.join("; ")}`).join("\n");
if (rows.some(enforced)) console.warn(`docs: coverage issues\n${list(rows.filter(enforced))}`);
if (rows.some((entry) => !enforced(entry))) {
  console.warn(
    `docs: coverage issues, not enforced, because ENFORCE_COMPONENTS=${only.join(",")} leaves these folders out\n${list(rows.filter((entry) => !enforced(entry)))}`,
  );
}

// What fails the build: a link that leads nowhere, and a page that does not render in a
// browser (an example that paints nothing, or an error the page raises). The other coverage
// issues (a missing props table, an inventory row nobody has built)
// are reported and left to the owner of the folder.
const notRendering = rows.filter(
  (entry) => enforced(entry) && (entry.light === "fails" || entry.dark === "fails"),
);
if (broken.length > 0) {
  console.error(
    `\ndocs: ${broken.length} broken internal link(s)\n${broken
      .map((problem) => `  ${problem.file}: ${problem.link} ${problem.reason}`)
      .join("\n")}`,
  );
}
if (notRendering.length > 0) {
  console.error(
    `\ndocs: ${notRendering.length} page(s) that do not render in a browser\n${list(notRendering)}`,
  );
}
if (broken.length > 0 || notRendering.length > 0) process.exit(1);
