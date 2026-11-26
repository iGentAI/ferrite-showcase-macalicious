import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type Extension, fromMarkdown, type Handle } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import type { Plugin } from "vite";
import {
  listComponents,
  listUnfinishedComponentFolders,
  repoRoot,
  usedComponents,
} from "../vite.shared.ts";
import {
  collapseWhitespace,
  collectPages,
  collectTokens,
  type ExportDoc,
  type FolderModules,
  findProps,
  frontmatter,
  type ImportDoc,
  isLiteral,
  markdownPath,
  maskCssComments,
  type PageMeta,
  type PropsDoc,
  readModule,
  resolveExport,
  sourceFiles,
  type TokenDoc,
  titleCase,
  typesInScope,
} from "./extract.ts";

/**
 * The documentation as plain Markdown, for coding agents.
 *
 *   llms.txt                  index: one line per guide, component and demo (llmstxt.org layout)
 *   llms-full.txt             every page in one file
 *   <route>.md                one Markdown file per page of the site ("/" is index.md)
 *   components/<name>.md      per component: purpose, import, minimal example, props with types
 *                             and defaults, options, styling hooks, then the docs page's prose
 *
 * Nothing here is written by hand and there is no list to keep: pages come from the same
 * folders the site reads (collectPages), and a component page is assembled from the component's
 * folder: index.ts (exports), the source files (props, JSDoc, defaults), the stylesheets (data
 * attributes, states), examples/ (code) and <name>.mdx (prose). A component folder that lacks
 * what its page needs is reported as a problem, and an error fails the build.
 *
 * The same files are emitted twice: into the site (docs/dist) and into the package (dist/docs),
 * so an agent in a consumer project can read them from node_modules without network access.
 */

export interface Problem {
  /** An error means a page would be wrong or incomplete; it fails the build. */
  level: "error" | "warning";
  /**
   * The folder is still being written: its docs page or its first example is missing. The
   * docs build fails on it like on any error; the unit tests leave it to that build and to
   * `npm run lint`, which reports the same folder.
   */
  unfinished?: boolean;
  /** Repository-relative file or folder. */
  where: string;
  message: string;
}

export interface ExampleDoc {
  name: string;
  /** Repository-relative path. */
  file: string;
  code: string;
}

export interface StylingHooks {
  classes: string[];
  /** Data attribute to the values the stylesheet or the props name, in first-seen order. */
  attributes: Record<string, string[]>;
  pseudoClasses: string[];
  mediaFeatures: string[];
  variables: string[];
  windowState: boolean;
}

export interface ComponentDoc {
  name: string;
  title: string;
  description: string;
  /** Repository-relative folder. */
  dir: string;
  /** The page in the site, when the folder has its <name>.mdx. */
  page: PageMeta | null;
  /** Public exports, as listed in index.ts. */
  exports: ExportDoc[];
  /** Exported `*Props` types, in export order. */
  props: PropsDoc[];
  /** Every type alias of the folder and of src/lib, with its definition. */
  types: Record<string, string>;
  /**
   * By public props name: the type aliases that props type can name, as the module that
   * declares it sees them. Two modules of a folder may each have a `Tone`.
   */
  typesOf: Record<string, Record<string, string>>;
  imports: ImportDoc[];
  examples: ExampleDoc[];
  hooks: StylingHooks;
  hasStylesheet: boolean;
  /**
   * Other components whose code, and therefore stylesheet, this one uses, each after the ones
   * it uses itself: the order their stylesheets load in.
   */
  uses: string[];
}

export interface AgentDocs {
  /** Output path (relative, forward slashes) to content. */
  files: Map<string, string>;
  problems: Problem[];
  components: ComponentDoc[];
}

export interface AgentDocsOptions {
  /**
   * Public URL of the site including its base path, e.g. "https://example.org/macalicious/".
   * When given, the links in llms.txt are absolute; otherwise they are relative, which works
   * both on a web server and on disk.
   */
  siteUrl?: string;
}

/** Files that exist next to the pages and may be linked from a guide. */
const GENERATED_FILES = ["llms.txt", "llms-full.txt"];

/** Pages built by their own command into docs/dist after the site (`npm run desktop:build`). */
const SEPARATE_BUILDS = ["desktop"];

const posix = (file: string) => file.split(path.sep).join("/");
const relative = (file: string) => posix(path.relative(repoRoot, file));
const isPascalCase = (name: string) => /^[A-Z][A-Za-z0-9]*$/.test(name);
/**
 * Inline code. Text that contains a backtick (a template-literal type or default) needs a
 * delimiter longer than its longest run of backticks, and a space of padding on each side.
 */
export function code(text: string): string {
  const runs = text.match(/`+/g);
  if (!runs) return `\`${text}\``;
  const fence = "`".repeat(Math.max(...runs.map((run) => run.length)) + 1);
  return `${fence} ${text} ${fence}`;
}
/** Prose inside a table cell: one line, and GFM needs the pipe escaped. */
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
/**
 * Code inside a table cell (a type, a default, a token value): one line with the pipe escaped
 * even within backticks, and string literals kept exactly as written.
 */
const codeCell = (text: string) => collapseWhitespace(text).replace(/\|/g, "\\|").trim();
const STRING_UNION = /^\|?\s*"[^"]*"(\s*\|\s*"[^"]*")*$/;
const unquote = (value: string) => value.replace(/^(["'`])(.*)\1$/, "$2");

/** Exported type aliases of src/lib, which prop types name (ControlSize). */
function libraryTypes(): Record<string, string> {
  const types: Record<string, string> = {};
  const dir = path.join(repoRoot, "src/lib");
  if (existsSync(dir)) {
    for (const file of sourceFiles(dir)) Object.assign(types, readModule(file).types);
  }
  return types;
}

/** Attributes an ancestor carries to theme a subtree; they are not the component's own. */
const ANCESTOR_ATTRIBUTES = [
  "data-window-state",
  "data-accent",
  "data-highlight",
  "data-appearance",
];

function readStylingHooks(name: string, dir: string, sources: string[]): StylingHooks {
  const attributes = new Map<string, Set<string>>();
  const classes = new Set<string>();
  const pseudoClasses = new Set<string>();
  const mediaFeatures = new Set<string>();
  const variables = new Set<string>();
  let windowState = false;
  const attribute = (attr: string, value?: string) => {
    const values = attributes.get(attr) ?? new Set<string>();
    if (value) values.add(value);
    attributes.set(attr, values);
  };

  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .sort()) {
    const css = maskCssComments(readFileSync(path.join(dir, file), "utf8"));
    for (const match of css.matchAll(
      /\[(data-[a-z][a-z0-9-]*)(?:[~|^$*]?=\s*["']?([^"'\]]+)["']?)?\]/g,
    )) {
      if (match[1] === "data-window-state") windowState = true;
      if (!ANCESTOR_ATTRIBUTES.includes(match[1] as string))
        attribute(match[1] as string, match[2]);
    }
    for (const match of css.matchAll(/(?<![\w-])\.(mac-[a-z0-9-]+)/g)) classes.add(`.${match[1]}`);
    for (const match of css.matchAll(
      /:(hover|active|focus-visible|focus-within|focus|disabled|checked|indeterminate|invalid|read-only|placeholder-shown|empty)\b/g,
    )) {
      pseudoClasses.add(`:${match[1]}`);
    }
    for (const match of css.matchAll(/\((prefers-[a-z-]+|forced-colors)\b/g)) {
      mediaFeatures.add(match[1] as string);
    }
    for (const match of css.matchAll(new RegExp(`--mac-${name}-[a-z0-9-]+`, "g"))) {
      variables.add(match[0]);
    }
  }
  // Attributes the component writes, whether or not the stylesheet selects on them.
  for (const file of sources) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/["'\s{](data-[a-z][a-z0-9-]*)["']?\s*[=:]/g)) {
      if (!ANCESTOR_ATTRIBUTES.includes(match[1] as string)) attribute(match[1] as string);
    }
  }

  return {
    classes: [...classes].sort(),
    attributes: Object.fromEntries(
      [...attributes].sort(([a], [b]) => a.localeCompare(b, "en")).map(([k, v]) => [k, [...v]]),
    ),
    pseudoClasses: [...pseudoClasses].sort(),
    mediaFeatures: [...mediaFeatures].sort(),
    variables: [...variables].sort(),
    windowState,
  };
}

/** `componentsDir` is the folder of component folders; only tests pass another one. */
export function readComponent(
  name: string,
  page: PageMeta | null,
  sharedTypes: Record<string, string>,
  report: (problem: Problem) => void,
  componentsDir = path.join(repoRoot, "src/components"),
): ComponentDoc {
  const dir = path.join(componentsDir, name);
  const where = relative(dir);
  const error = (message: string, file = where) => report({ level: "error", where: file, message });
  const warn = (message: string, file = where) =>
    report({ level: "warning", where: file, message });
  const unfinished = (message: string) =>
    report({ level: "error", where, message, unfinished: true });

  const sources = sourceFiles(dir);
  const indexFile = path.join(dir, "index.ts");
  // Every module of the folder, subfolders included: index.ts may re-export from any of them.
  const folder: FolderModules = new Map(sources.map((file) => [file, readModule(file)]));
  const index = folder.get(indexFile) ?? readModule(indexFile);
  const modules = [...folder].filter(([file]) => file !== indexFile).map(([, module]) => module);
  const nearestLast = [...modules].reverse();
  const types = { ...sharedTypes, ...Object.assign({}, ...nearestLast.map((m) => m.types)) };
  /** The JSDoc of the declaration an export of index.ts leads to, through any re-exports. */
  const describe = (entry: ExportDoc) => {
    const at = resolveExport(folder, indexFile, entry.name);
    // An export that cannot be followed is not described by a declaration that has its name.
    const declared = at && folder.get(at.file)?.exports;
    return declared?.find((e) => e.source === null && e.name === at?.local)?.description ?? "";
  };

  // Public surface: what index.ts exports by name, described by the declaration it re-exports.
  // A wildcard names nothing, so a page built from it would silently lack whatever it exports:
  // `npm run lint` refuses `export *` in index.ts (CONTRIBUTING, Exports), and so does this.
  for (const specifier of index.exportAll) {
    error(
      `index.ts has \`export * from "${specifier}"\`, which hides what the component exports from its page; list the exports by name`,
      relative(indexFile),
    );
  }
  for (const { name: namespace, source } of index.exportNamespaces) {
    error(
      `index.ts has \`export * as ${namespace} from "${source}"\`, a namespace whose members the page cannot document; list the exports by name`,
      relative(indexFile),
    );
  }
  const exports = index.exports.map((entry) => ({
    ...entry,
    description: entry.description || describe(entry),
  }));
  const components = exports.filter((e) => !e.isType && isPascalCase(e.name));
  if (components.length === 0) error("index.ts exports no component");

  const props: PropsDoc[] = [];
  const typesOf: Record<string, Record<string, string>> = {};
  for (const entry of exports) {
    if (!entry.isType || !entry.name.endsWith("Props")) continue;
    // Read from the module the export leads to, not from any module that has the name.
    const found = findProps(folder, indexFile, entry.name);
    if (!found) {
      // Never a guess: a declaration elsewhere in the folder that has the name may be unrelated.
      // The problem is in the file the export was followed to, or in index.ts when it could
      // not be followed.
      const at = resolveExport(folder, indexFile, entry.name);
      error(
        at
          ? `${entry.name} is exported by index.ts, but ${at.local} is not declared as an interface or type alias in this file, so its props cannot be documented`
          : `${entry.name} is exported, but its export does not lead to a declaration in this folder (it comes from outside the folder, or from a module that does not export it), so its props cannot be documented`,
        relative(at ? at.file : indexFile),
      );
      continue;
    }
    const doc = found.doc;
    props.push({ ...doc, name: entry.name });
    typesOf[entry.name] = typesInScope(folder, found.file);
    for (const prop of doc.props) {
      const file = relative(found.file);
      if (!prop.description) warn(`${entry.name}.${prop.name} has no JSDoc description`, file);
      if (
        prop.jsdocDefault !== null &&
        prop.codeDefault !== null &&
        isLiteral(prop.codeDefault) &&
        unquote(prop.jsdocDefault) !== unquote(prop.codeDefault)
      ) {
        error(
          `${entry.name}.${prop.name}: @default ${prop.jsdocDefault} contradicts the default in the code, ${prop.codeDefault}`,
          file,
        );
      }
      if (prop.jsdocDefault === null && prop.codeDefault !== null && !isLiteral(prop.codeDefault)) {
        warn(
          `${entry.name}.${prop.name} has a computed default (${prop.codeDefault}) and no @default to describe it`,
          file,
        );
      }
      if (prop.required && prop.defaultValue !== null) {
        warn(`${entry.name}.${prop.name} is required but documents a default`, file);
      }
    }
  }
  for (const component of components) {
    if (!exports.some((e) => e.isType && e.name === `${component.name}Props`)) {
      warn(
        `${component.name} is exported without a ${component.name}Props type, so it has no props table`,
      );
    }
    if (!component.description) warn(`${component.name} has no JSDoc description`);
  }

  const examplesDir = path.join(dir, "examples");
  const examples = existsSync(examplesDir)
    ? readdirSync(examplesDir)
        .filter((f) => f.endsWith(".tsx"))
        .sort()
        .map((f) => ({
          name: f.slice(0, -4),
          file: relative(path.join(examplesDir, f)),
          code: readFileSync(path.join(examplesDir, f), "utf8").trimEnd(),
        }))
    : [];
  if (!examples.some((e) => !e.name.startsWith("visual-"))) {
    unfinished("has no example to show (examples/basic.tsx)");
  } else if (!examples.some((e) => e.name === "basic")) {
    warn("has no examples/basic.tsx; the first example is used as the minimal example");
  }

  if (!page) unfinished(`has no docs page (${name}.mdx)`);
  else if (!page.description) error("the docs page has no description", relative(page.file));

  return {
    name,
    title: page?.title ?? titleCase(name),
    description: page?.description ?? "",
    dir: where,
    page,
    exports,
    props,
    types,
    typesOf,
    imports: modules.flatMap((m) => m.imports),
    examples,
    hooks: readStylingHooks(name, dir, sources),
    hasStylesheet: readdirSync(dir).some((f) => f.endsWith(".css")),
    uses: usedComponents(name, componentsDir),
  };
}

export interface RenderContext {
  /** Output path of the file being written; links are made relative to it. */
  out: string;
  pages: PageMeta[];
  components: Map<string, ComponentDoc>;
  /** Props documentation and its component, keyed by `<component folder>/<interface name>`. */
  propsByName: Map<string, PropsDoc>;
  propsOwner: Map<string, ComponentDoc>;
  tokens: () => Record<string, TokenDoc[]>;
  report: (problem: Problem) => void;
}

/** Link from the file being written to another generated file. */
function link(context: RenderContext, target: string): string {
  const from = path.posix.dirname(context.out);
  return path.posix.relative(from, target) || path.posix.basename(target);
}

/** The types a prop type names, with their definitions (one level deep). */
function namedTypes(props: PropsDoc, types: Record<string, string>): [string, string][] {
  const found: [string, string][] = [];
  for (const [name, definition] of Object.entries(types)) {
    const word = new RegExp(`(?<![\\w.])${name}(?![\\w])`);
    if (props.props.some((prop) => word.test(prop.type))) found.push([name, definition]);
  }
  return found;
}

/** A prop's literal choices, when its type (or the alias it names) is a union of strings. */
function choices(type: string, types: Record<string, string>): string[] | null {
  const resolved = (types[type] ?? type).trim();
  if (!STRING_UNION.test(resolved)) return null;
  return [...resolved.matchAll(/"([^"]*)"/g)].map((match) => match[1] as string);
}

export function renderPropsTable(doc: PropsDoc, owner: ComponentDoc | undefined): string {
  const lines: string[] = [];
  if (doc.props.length > 0) {
    lines.push(
      "| Prop | Type | Default | Required | Description |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const prop of doc.props) {
      lines.push(
        `| ${code(prop.name)} | ${code(codeCell(prop.type))} | ${
          prop.defaultValue === null ? "–" : code(codeCell(prop.defaultValue))
        } | ${prop.required ? "yes" : "no"} | ${cell(prop.description) || "–"} |`,
      );
    }
  } else {
    lines.push("No props of its own.");
  }
  if (doc.extends.length > 0) {
    lines.push("", `Also accepts every prop of ${doc.extends.map(code).join(", ")}.`);
    // Say where an inherited type comes from when it is imported under another name.
    const origins = new Set<string>();
    for (const entry of owner?.imports ?? []) {
      if (entry.source.startsWith(".")) continue;
      const word = new RegExp(`(?<![\\w.])${entry.local}(?![\\w])`);
      if (!doc.extends.some((text) => word.test(text))) continue;
      origins.add(
        entry.imported === entry.local
          ? `${code(entry.local)} is imported from ${code(entry.source)}`
          : `${code(entry.local)} is ${code(entry.imported)} from ${code(entry.source)}`,
      );
    }
    if (origins.size > 0) lines.push(`${[...origins].join("; ")}.`);
  }
  const types = namedTypes(doc, owner?.typesOf[doc.name] ?? owner?.types ?? {});
  if (types.length > 0) {
    lines.push("", "Types named above:", "");
    for (const [name, definition] of types) {
      lines.push(`- ${code(name)} = ${code(definition.replace(/^\|\s*/, ""))}`);
    }
  }
  return lines.join("\n");
}

function renderExample(example: ExampleDoc): string {
  return `Example ${code(example.name)} (${code(example.file)}):\n\n\`\`\`tsx\n${example.code}\n\`\`\``;
}

function renderTokenTable(list: TokenDoc[]): string {
  const lines = ["| Token | Value | Status |", "| --- | --- | --- |"];
  for (const token of list) {
    lines.push(`| ${code(token.name)} | ${code(codeCell(token.value))} | ${token.status ?? "–"} |`);
  }
  return lines.join("\n");
}

function renderPageList(
  context: RenderContext,
  group: string,
  only: string,
  empty: string,
  except = "",
): string {
  const names = only ? only.split(",").map((name) => name.trim()) : null;
  const excluded = except ? except.split(",").map((name) => name.trim()) : [];
  const list = context.pages.filter((page) => {
    const name = page.path.split("/").pop() ?? "";
    return page.group === group && (!names || names.includes(name)) && !excluded.includes(name);
  });
  if (list.length === 0) return empty ? `*${empty}*` : "";
  return list
    .map(
      (page) =>
        `- [${page.title}](${link(context, page.markdown)})${page.description ? `: ${page.description}` : ""}`,
    )
    .join("\n");
}

const attributesOf = (text: string) => {
  const attributes: Record<string, string> = {};
  for (const match of text.matchAll(/([A-Za-z]+)(?:="([^"]*)")?/g)) {
    attributes[match[1] as string] = match[2] ?? "true";
  }
  return attributes;
};

interface ConvertOptions {
  /** The page being converted. */
  page: PageMeta;
  /** The component whose page this is, if it is one. */
  component?: ComponentDoc;
  /** Example names already printed in this file. */
  printed?: Set<string>;
  /** An example printed above the body that needs no mention where the page shows it again. */
  lead?: string;
}

/**
 * Turn the body of an .mdx page into plain Markdown: the site's components become the content
 * they show, and links between pages become links between the Markdown files.
 */
export function convertBody(
  source: string,
  context: RenderContext,
  options: ConvertOptions,
): string {
  const { page, component, printed = new Set<string>(), lead } = options;
  const where = relative(page.file);
  const warn = (message: string) => context.report({ level: "warning", where, message });
  const error = (message: string) => context.report({ level: "error", where, message });
  const isMdx = page.file.endsWith(".mdx");

  const rewriteLinks = (text: string) =>
    text.replace(/\]\((\/[^)\s]*)\)/g, (whole, target: string) => {
      const [route = "/", hash = ""] = target.split("#");
      const normal = route.length > 1 ? route.replace(/\/$/, "") : route;
      const anchor = hash ? `#${hash}` : "";
      const to = context.pages.find((candidate) => candidate.path === normal);
      if (to) return `](${link(context, to.markdown)}${anchor})`;
      if (GENERATED_FILES.includes(normal.slice(1))) return `](${link(context, normal.slice(1))})`;
      if (SEPARATE_BUILDS.includes(normal.slice(1))) {
        return `](${link(context, normal.slice(1))}/${anchor})`;
      }
      warn(`links to ${target}, which is not a page of the site`);
      return whole;
    });

  const convertProse = (prose: string) => {
    // Inline code may quote a component tag or a path; leave it exactly as written.
    const spans: string[] = [];
    /** Set text aside until every rewrite of the prose is done, then put it back unchanged. */
    const keep = (verbatim: string) => `\uE000${spans.push(verbatim) - 1}\uE000`;
    let text = prose.replace(/`[^`\n]*`/g, keep);

    if (isMdx) {
      text = text
        .replace(/^(?:import|export)\s.*$/gm, "")
        .replace(/^\{\/\*[\s\S]*?\*\/\}$/gm, "")
        .replace(/<Example\s+([^>]*?)\/>/g, (_, raw: string) => {
          const { name = "" } = attributesOf(raw);
          const file = `${page.dir}/examples/${name}.tsx`;
          if (!existsSync(path.join(repoRoot, file))) {
            error(`<Example name="${name}"> has no ${file}`);
            return `*(Missing example: ${file})*`;
          }
          if (printed.has(name)) {
            return name === lead ? "" : `Example ${code(name)}: shown above.`;
          }
          printed.add(name);
          // An example is code, like a fence written in the page: a link or a tag inside it
          // is not the page's own and must not be rewritten.
          return keep(
            renderExample({
              name,
              file,
              code: readFileSync(path.join(repoRoot, file), "utf8").trimEnd(),
            }),
          );
        })
        .replace(/<PropsTable\s+([^>]*?)\/>/g, (_, raw: string) => {
          const { name = "" } = attributesOf(raw);
          // A component page means its own interface; another page may name
          // `<component>/<Name>`, or a bare name that only one component has.
          const key = name.includes("/")
            ? name
            : component && context.propsByName.has(`${component.name}/${name}`)
              ? `${component.name}/${name}`
              : (() => {
                  const matches = [...context.propsByName.keys()].filter((candidate) =>
                    candidate.endsWith(`/${name}`),
                  );
                  if (matches.length > 1) {
                    error(
                      `<PropsTable name="${name}"> is ambiguous: ${matches.join(", ")} all export it; name one as "<component>/${name}"`,
                    );
                  }
                  return matches.length === 1 ? (matches[0] as string) : "";
                })();
          const doc = context.propsByName.get(key);
          if (!doc) {
            error(`<PropsTable name="${name}"> names no exported props type`);
            return `*(Missing props: ${name})*`;
          }
          if (component && key === `${component.name}/${doc.name}`) {
            return `The props of ${code(doc.name)} are listed under [Props](#props) above.`;
          }
          return keep(renderPropsTable(doc, context.propsOwner.get(key)));
        })
        .replace(/<TokenTable\s+([^>]*?)\/>/g, (_, raw: string) => {
          const { file = "" } = attributesOf(raw);
          const list = context.tokens()[file];
          if (!list) {
            error(`<TokenTable file="${file}"> names no file in src/styles/tokens`);
            return `*(Missing token file: ${file}.css)*`;
          }
          return keep(renderTokenTable(list));
        })
        .replace(/<PageList\s+([^>]*?)\/>/g, (_, raw: string) => {
          const { group = "", only = "", empty = "", except = "" } = attributesOf(raw);
          return renderPageList(context, group, only, empty, except);
        })
        .replace(/^<[A-Z][\s\S]*?(?:\/>|<\/[A-Z][A-Za-z.]*>)[ \t]*$/gm, (jsx) => {
          warn(`the Markdown export cannot show ${jsx.split("\n")[0]}`);
          return "*(Interactive content: see the HTML page.)*";
        });
    }
    text = rewriteLinks(text);

    if (component) {
      // Guidelines paraphrase Apple's documents; say so when the section cites nothing.
      text = text.replace(
        /^(##\s+Guidelines[^\n]*\n)([\s\S]*?)(?=^##\s|(?![\s\S]))/m,
        (whole, heading: string, body: string) =>
          /https?:\/\//.test(body)
            ? whole
            : `${heading}\n> Not verified: this section cites no source, so read it as a paraphrase of Apple's Human Interface Guidelines that has not been checked against Apple's text.\n${body}`,
      );
    }
    return text.replace(/\uE000(\d+)\uE000/g, (_, index: string) => spans[Number(index)] ?? "");
  };

  // Fenced code is copied through untouched; everything else is prose.
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const parts = body.split(FENCE);
  let out = "";
  // split() with two capture groups yields: prose, fence, fence marker, prose, …
  for (let index = 0; index < parts.length; index += 3) {
    out += convertProse(parts[index] ?? "");
    out += parts[index + 1] ?? "";
  }
  return collapseBlankLines(out).trim();
}

const FENCE = /(^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\2[ \t]*$)/m;

/** Reduce runs of blank lines to one in prose; fenced code keeps every line it has. */
export function collapseBlankLines(markdown: string): string {
  // split() with two capture groups yields: prose, fence, fence marker, prose, …
  const parts = markdown.split(FENCE);
  let out = "";
  for (let index = 0; index < parts.length; index += 3) {
    out += (parts[index] ?? "").replace(/\n{3,}/g, "\n\n");
    out += parts[index + 1] ?? "";
  }
  return out;
}

function renderComponentPage(component: ComponentDoc, context: RenderContext): string {
  const { name, hooks } = component;
  const values = component.exports.filter((e) => !e.isType);
  const typeNames = component.exports.filter((e) => e.isType).map((e) => e.name);
  const printed = new Set<string>();
  const out: string[] = [`# ${component.title}`, ""];
  if (component.description) out.push(`> ${component.description}`, "");

  for (const entry of values) {
    if (entry.description) out.push(`${code(entry.name)}: ${entry.description}`, "");
  }
  out.push(
    `- Source folder: ${code(`${component.dir}/`)}`,
    ...(component.page ? [`- Page in the documentation site: ${code(component.page.path)}`] : []),
    "",
  );

  // Import
  const names = values.map((e) => e.name).join(", ");
  out.push(
    "## Import",
    "",
    "From the package:",
    "",
    "```tsx",
    `import { ${names} } from "macalicious/${name}";`,
  );
  if (typeNames.length > 0) {
    out.push(`import type { ${typeNames.join(", ")} } from "macalicious/${name}";`);
  }
  out.push("```", "");
  const sheets = [...component.uses, name].filter((other) =>
    other === name ? component.hasStylesheet : context.components.get(other)?.hasStylesheet,
  );
  out.push(
    `Styles: import ${code('"macalicious/styles.css"')} once for the tokens and every component.` +
      (sheets.length > 0
        ? ` To ship less CSS, import ${code('"macalicious/tokens.css"')} once and then ${sheets
            .map((sheet) => code(`"macalicious/${sheet}.css"`))
            .join(", ")}${
            sheets.length > 1
              ? ", in this order: a component's stylesheet must load after those of the components it uses"
              : ""
          }.`
        : ""),
    "",
    `Or copy the source into the project: ${code(`npx macalicious add ${name}`)}, then import from the copied folder (${code(`<dir>/components/${name}`)}; the copied component imports its own stylesheet, and ${code("<dir>/styles/index.css")} is imported once for the tokens).`,
    "",
  );
  if (component.uses.length > 0) {
    out.push(
      `Uses these components, which the copy command brings along: ${component.uses
        .map((other) =>
          context.components.has(other)
            ? `[${other}](${link(context, `components/${other}.md`)})`
            : code(other),
        )
        .join(", ")}.`,
      "",
    );
  }

  // Minimal example
  const minimal =
    component.examples.find((e) => e.name === "basic") ??
    component.examples.find((e) => !e.name.startsWith("visual-"));
  if (minimal) {
    printed.add(minimal.name);
    out.push(
      "## Minimal example",
      "",
      "A complete file. It is type-checked, rendered in the browser environment and on the server, and checked for accessibility violations by the test suite.",
      "",
      renderExample(minimal),
      "",
    );
  }

  // Props
  out.push("## Props", "");
  if (component.props.length === 0) out.push("No props type is exported.", "");
  for (const doc of component.props) {
    out.push(`### ${doc.name}`, "", renderPropsTable(doc, component), "");
  }

  // Options: props whose type is a closed set of strings
  const options: string[] = [];
  const reflected = new Map<string, string[]>();
  for (const doc of component.props) {
    for (const prop of doc.props) {
      const values = choices(prop.type, component.typesOf[doc.name] ?? component.types);
      if (!values) continue;
      const fallback = prop.defaultValue === null ? null : unquote(prop.defaultValue);
      options.push(
        `- ${code(prop.name)}${component.props.length > 1 ? ` (${doc.name})` : ""}: ${values
          .map((value) => `${code(`"${value}"`)}${value === fallback ? " (default)" : ""}`)
          .join(", ")}`,
      );
      reflected.set(`data-${prop.name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, values);
    }
  }
  if (options.length > 0) {
    out.push(
      "## Options",
      "",
      "Props that take one of a fixed set of values (variants, sizes and the like):",
      "",
      ...options,
      "",
    );
  }

  // Styling hooks
  const attributes = Object.entries(hooks.attributes);
  if (hooks.classes.length + attributes.length + hooks.pseudoClasses.length > 0) {
    out.push(
      "## Styling hooks",
      "",
      "Read from the component's stylesheet and source, so the list is complete. What each state looks like is described further down.",
      "",
    );
    if (hooks.classes.length > 0) out.push(`- Classes: ${hooks.classes.map(code).join(", ")}`);
    for (const [attribute, styled] of attributes) {
      const fromProp = reflected.get(attribute);
      const values = fromProp ?? styled;
      const note =
        attribute === "data-force"
          ? " (documentation and visual tests only: pins a transient state)"
          : fromProp
            ? ` (reflects the ${code(attribute.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()))} prop)`
            : "";
      out.push(
        `- Attribute ${code(attribute)}: ${values.length > 0 ? values.map(code).join(", ") : "present or absent"}${note}`,
      );
    }
    if (hooks.pseudoClasses.length > 0) {
      out.push(`- Pseudo-classes with their own look: ${hooks.pseudoClasses.map(code).join(", ")}`);
    }
    out.push(
      hooks.windowState
        ? `- Window state: looks different when an ancestor has ${code('data-window-state="main"')} or ${code('"inactive"')}.`
        : "- Window state: the stylesheet does not react to `data-window-state`.",
    );
    if (hooks.mediaFeatures.length > 0) {
      out.push(`- Media features handled: ${hooks.mediaFeatures.map(code).join(", ")}`);
    }
    if (hooks.variables.length > 0) {
      out.push(`- Component custom properties: ${hooks.variables.map(code).join(", ")}`);
    }
    out.push("");
  }

  // The docs page's own prose: usage, guidelines, states, sizes, accessibility, comparison.
  if (component.page) {
    const body = convertBody(readFileSync(component.page.file, "utf8"), context, {
      page: component.page,
      component,
      printed,
      lead: minimal?.name,
    });
    if (!/^##\s+Accessibility\b/m.test(body)) {
      context.report({
        level: "warning",
        where: relative(component.page.file),
        message: 'has no "## Accessibility" section',
      });
    }
    out.push(body, "");
  }

  const rest = component.examples.filter((e) => !printed.has(e.name));
  const more = rest.filter((e) => !e.name.startsWith("visual-"));
  const visual = rest.filter((e) => e.name.startsWith("visual-"));
  if (more.length > 0) {
    out.push("## More examples", "");
    for (const example of more) out.push(renderExample(example), "");
  }
  if (visual.length > 0) {
    out.push(
      "## Visual comparison fixtures",
      "",
      "Examples sized to match a crop of a reference screenshot; read them for exact Catalina layouts.",
      "",
      ...visual.map((example) => `- ${code(example.file)}`),
      "",
    );
  }
  return `${collapseBlankLines(out.join("\n")).trim()}\n`;
}

function renderPage(page: PageMeta, context: RenderContext): string {
  const source = readFileSync(page.file, "utf8");
  const body = convertBody(source, context, { page });
  if (page.ownHeading) return `${body}\n`;
  const meta = frontmatter(source);
  return `# ${page.title}\n\n${meta.description ? `> ${meta.description}\n\n` : ""}${body}\n`;
}

/**
 * A page as it stands in the bundle (llms-full.txt), where it is one section among all the
 * pages: a link to a heading of the page itself (`[Props](#props)`) names the page's own file
 * there. In the bundle the same heading occurs once per page, so the bare anchor would lead to
 * the first page that has one.
 *
 * The page is parsed as Markdown (GFM), so every link whose destination is an anchor alone is
 * rewritten whatever syntax wrote it: `[a](#b)`, `[a](#b "title")`, `[a](<#b>)` and the
 * reference definition `[b]: #b`. Code of any kind (fenced, indented, in a block quote, inline)
 * and escaped text (`\[a](#b)`) contain no link, so they are left as written. Only the
 * destination changes: the page file is inserted where the parser found the destination start,
 * so a destination continued on the next line of a block quote or a list item is found too.
 */
export function sectionLinks(markdown: string, out: string): string {
  // The source offset of each link's and definition's destination, from the parser's own token.
  const destinations = new Map<object, number>();
  const tree: MarkdownNode = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown(), recordDestinations(destinations)],
  });
  const offsets: number[] = [];
  const visit = (node: MarkdownNode) => {
    if ((node.type === "link" || node.type === "definition") && node.url?.startsWith("#")) {
      const at = destinations.get(node);
      if (at !== undefined) offsets.push(at);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  let result = markdown;
  for (const at of offsets.sort((a, b) => b - a)) {
    result = `${result.slice(0, at)}${out}${result.slice(at)}`;
  }
  return result;
}

/** What `sectionLinks` reads of a node of the Markdown syntax tree (mdast). */
interface MarkdownNode {
  type: string;
  url?: string;
  children?: MarkdownNode[];
}

/**
 * A syntax-tree extension that notes where the destination of each link, image and definition
 * starts in the source (after an opening `<`), keyed by its node. It replaces the default
 * handler for the destination tokens, `buffer`, and then does what that handler does.
 */
function recordDestinations(destinations: Map<object, number>): Extension {
  const enter: Handle = function (token) {
    const node = this.stack.at(-1);
    if (node) destinations.set(node, token.start.offset);
    this.buffer();
  };
  return {
    enter: { resourceDestinationString: enter, definitionDestinationString: enter },
  };
}

export function generateAgentDocs(options: AgentDocsOptions = {}): AgentDocs {
  const problems = new Map<string, Problem>();
  const report = (problem: Problem) =>
    problems.set(`${problem.level}\n${problem.where}\n${problem.message}`, problem);

  const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    name: string;
    version: string;
    description: string;
  };
  const pages = collectPages();
  const sharedTypes = libraryTypes();
  const components = new Map<string, ComponentDoc>();
  for (const name of listComponents()) {
    const page = pages.find((p) => p.path === `/components/${name}`) ?? null;
    components.set(name, readComponent(name, page, sharedTypes, report));
  }
  // A folder without index.ts exports nothing, so there is nothing to write a page from. Say
  // so: otherwise the build would pass with a component missing from the documentation.
  for (const name of listUnfinishedComponentFolders()) {
    report({
      level: "error",
      unfinished: true,
      where: `src/components/${name}`,
      message: "has no index.ts, so it is not a component yet and gets no page",
    });
  }

  const propsByName = new Map<string, PropsDoc>();
  const propsOwner = new Map<string, ComponentDoc>();
  for (const component of components.values()) {
    for (const doc of component.props) {
      propsByName.set(`${component.name}/${doc.name}`, doc);
      propsOwner.set(`${component.name}/${doc.name}`, component);
    }
  }
  let tokens: Record<string, TokenDoc[]> | undefined;
  const context = (out: string): RenderContext => ({
    out,
    pages,
    components,
    propsByName,
    propsOwner,
    tokens: () => {
      tokens ??= collectTokens();
      return tokens;
    },
    report,
  });

  /** One entry per generated Markdown page, in site order; components without a page last. */
  const entries: {
    out: string;
    title: string;
    description: string;
    group: string;
    render: (out: string) => string;
  }[] = [];
  for (const page of pages) {
    const name = /^\/components\/([^/]+)$/.exec(page.path)?.[1];
    const component = name ? components.get(name) : undefined;
    entries.push({
      out: page.markdown,
      title: page.title,
      description: page.description,
      group: page.group,
      render: (out) =>
        component ? renderComponentPage(component, context(out)) : renderPage(page, context(out)),
    });
  }
  for (const component of components.values()) {
    if (component.page) continue;
    entries.push({
      out: markdownPath(`/components/${component.name}`),
      title: component.title,
      description: component.description,
      group: "Components",
      render: (out) => renderComponentPage(component, context(out)),
    });
  }

  const files = new Map<string, string>();
  for (const entry of entries) files.set(entry.out, entry.render(entry.out));

  // llms.txt: the index.
  const base = options.siteUrl ? options.siteUrl.replace(/\/?$/, "/") : "";
  const item = (entry: { out: string; title: string; description: string }) =>
    `- [${entry.title}](${base}${entry.out})${entry.description ? `: ${entry.description}` : ""}`;
  const section = (title: string, groups: string[]) => {
    const list = entries.filter((entry) => groups.includes(entry.group));
    return list.length > 0 ? [`## ${title}`, "", ...list.map(item), ""] : [];
  };
  const agents = entries.find((entry) => entry.out === "agents.md");
  const index = [
    `# ${titleCase(pkg.name)}`,
    "",
    `> ${pkg.description}`,
    "",
    `Version ${pkg.version}. Every file listed here is plain Markdown generated from the source tree when the documentation is built, so it matches the code of this version. Each component page is self-contained: import, a minimal example, props with types and defaults, options, styling hooks, states, accessibility.`,
    "",
    ...(agents ? [`- [${agents.title}](${base}agents.md): start here`] : []),
    `- [All of the documentation in one file](${base}llms-full.txt)`,
    "",
    ...section("Guides", ["Overview", "Foundations"]),
    ...section("Components", ["Components"]),
    ...section("Demos", ["Demos"]),
    ...section(
      "Optional",
      [...new Set(entries.map((entry) => entry.group))].filter(
        (group) => !["Overview", "Foundations", "Components", "Demos"].includes(group),
      ),
    ).filter((line) => !line.includes("](agents.md)") && !line.includes(`](${base}agents.md)`)),
  ];
  files.set("llms.txt", `${index.join("\n").trim()}\n`);

  // llms-full.txt: every page, with links resolved from the root where the bundle lives.
  const bundle = entries.map(
    (entry) =>
      `<!-- ${entry.out} -->\n\n${sectionLinks(entry.render("llms-full.txt").trim(), entry.out)}`,
  );
  files.set(
    "llms-full.txt",
    `${[`# ${titleCase(pkg.name)} ${pkg.version}: complete documentation\n\n> ${pkg.description}\n\nGenerated from the source tree. Each section below is also a file of its own, named in the comment above it; llms.txt is the index.`, ...bundle].join("\n\n---\n\n")}\n`,
  );

  return { files, problems: [...problems.values()], components: [...components.values()] };
}

/** The problems as the text a build prints. */
export function formatProblems(problems: Problem[]): string {
  const line = (problem: Problem) => `  ${problem.level}  ${problem.where}: ${problem.message}`;
  const errors = problems.filter((p) => p.level === "error");
  const warnings = problems.filter((p) => p.level === "warning");
  return [...errors, ...warnings].map(line).join("\n");
}

/**
 * ENFORCE_COMPONENTS=label,text-field limits the checks to the named component folders.
 *
 * While many people build components at once, the tree holds folders that are not finished.
 * With the variable set, problems in the named folders (and in the guides and demos) fail as
 * usual and problems in every other component folder are listed but do not fail, so a thread
 * gets a verdict on its own work. Unset, every folder is enforced: that is what an integration
 * build and a release must use. Returns null when everything is enforced.
 */
export function enforcedComponents(): Set<string> | null {
  const names = (process.env.ENFORCE_COMPONENTS ?? "")
    .split(/[\s,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 0 ? new Set(names) : null;
}

/** Whether a problem counts under ENFORCE_COMPONENTS: it does unless it is in another folder. */
export function isEnforced(problem: Problem, only = enforcedComponents()): boolean {
  const component = /^src\/components\/([^/]+)/.exec(problem.where)?.[1];
  return !only || !component || only.has(component);
}

export interface AgentDocsPluginOptions {
  /** Folder inside the build output: "" for the site root, "docs" for the package. */
  dir?: string;
  /**
   * Fail the build on an error (default). The package build passes false: there the export
   * is a by-product, and the docs build is the gate.
   */
  fail?: boolean;
}

/**
 * Emit the Markdown export with a build, and serve it from the dev server.
 *
 * The docs build fails when a page would be wrong or incomplete (the errors of
 * generateAgentDocs) and prints the warnings. AGENT_DOCS_STRICT=1 makes warnings fail the
 * build too. ENFORCE_COMPONENTS=a,b limits what can fail to those component folders (see
 * enforcedComponents). DOCS_SITE_URL makes the links in llms.txt absolute.
 */
export function agentDocs({ dir = "", fail = true }: AgentDocsPluginOptions = {}): Plugin {
  const prefix = dir ? `${dir.replace(/\/$/, "")}/` : "";
  const options: AgentDocsOptions = { siteUrl: process.env.DOCS_SITE_URL || undefined };
  let ssr = false;
  let base = "/";

  return {
    name: "macalicious:agent-docs",

    configResolved(config) {
      ssr = Boolean(config.build.ssr);
      base = config.base;
    },

    generateBundle() {
      if (ssr) return;
      const { files, problems } = generateAgentDocs(options);
      const errors = problems.filter((p) => p.level === "error");
      if (!fail) {
        // The package build still ships a page for every component, built from its source.
        if (problems.length > 0) {
          this.warn(
            `agent docs: ${errors.length} error(s) and ${problems.length - errors.length} warning(s) in the Markdown export; "npm run docs:build" lists them and fails on the errors.`,
          );
        }
      } else {
        const strict = process.env.AGENT_DOCS_STRICT === "1";
        const only = enforcedComponents();
        const enforced = problems.filter((p) => isEnforced(p, only));
        const others = problems.filter((p) => !isEnforced(p, only));
        const failing = enforced.filter((p) => strict || p.level === "error");
        if (enforced.length > 0) {
          this.warn(`agent docs: ${enforced.length} problem(s)\n${formatProblems(enforced)}`);
        }
        if (others.length > 0) {
          this.warn(
            `agent docs: not enforced, because ENFORCE_COMPONENTS=${[...(only ?? [])].join(",")} leaves these folders out: ${others.length} problem(s) that fail a build without it\n${formatProblems(others)}`,
          );
        }
        if (failing.length > 0) {
          this.error(
            `agent docs: ${failing.length} problem(s) would leave the Markdown export wrong or incomplete:\n${formatProblems(failing)}\nSee "Examples, docs, tests, visual comparison" in CONTRIBUTING.md for what a component folder must contain.`,
          );
        }
      }
      for (const [file, source] of files) {
        this.emitFile({ type: "asset", fileName: `${prefix}${file}`, source });
      }
    },

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = (request.url ?? "").split("?")[0] ?? "";
        if (!/\.(md|txt)$/.test(url) || !url.startsWith(base)) return next();
        const { files } = generateAgentDocs(options);
        const content = files.get(decodeURIComponent(url.slice(base.length)).replace(prefix, ""));
        if (content === undefined) return next();
        response.setHeader(
          "Content-Type",
          url.endsWith(".md") ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
        );
        response.end(content);
      });
    },
  };
}
