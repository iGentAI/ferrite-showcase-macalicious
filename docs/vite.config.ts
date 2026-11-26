import path from "node:path";
import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import react from "@vitejs/plugin-react";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { defineConfig } from "vite";
import { alias, cssTarget, fsAllow, repoRoot } from "../vite.shared.ts";
import { agentDocs } from "./agent-docs.ts";
import { docsData, SHIKI_THEMES } from "./plugins.ts";
import { rehypeHeadingIds } from "./slug.mjs";

/**
 * Documentation site. `npm run docs:dev` serves it; `npm run docs:build` (docs/build.mjs)
 * prerenders every page to static HTML in docs/dist.
 *
 * DOCS_BASE sets the public path when the site is hosted under a sub-path, e.g. "/macalicious/".
 * DOCS_SITE_URL, the site's full public URL, makes the links in llms.txt absolute.
 *
 * The build also writes the documentation as plain Markdown for coding agents (llms.txt,
 * llms-full.txt and <route>.md next to every page; see agent-docs.ts), and fails when a
 * component folder lacks what its page needs.
 *
 * The dev and preview servers listen on localhost only and keep Vite's host check. To reach them
 * from another machine or through a tunnel, set DOCS_HOST (the address to bind, e.g. "0.0.0.0")
 * and DOCS_ALLOWED_HOSTS (comma-separated host names that may be used in the URL).
 */
const host = process.env.DOCS_HOST ?? "localhost";
const allowedHosts = (process.env.DOCS_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

export default defineConfig({
  root: path.join(repoRoot, "docs"),
  base: process.env.DOCS_BASE ?? "/",
  resolve: { alias },
  plugins: [
    docsData(),
    agentDocs(),
    {
      enforce: "pre",
      ...mdx({
        remarkPlugins: [remarkFrontmatter, remarkGfm],
        rehypePlugins: [
          rehypeHeadingIds,
          [rehypeShiki, { themes: SHIKI_THEMES, defaultColor: false }],
        ],
      }),
    },
    react(),
  ],
  server: {
    host,
    port: 3000,
    allowedHosts,
    fs: { allow: fsAllow },
  },
  preview: { host, port: 3000, allowedHosts },
  build: {
    outDir: path.join(repoRoot, "docs/dist"),
    emptyOutDir: true,
    target: "es2022",
    cssTarget,
  },
});
