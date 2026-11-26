import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { repoRoot } from "../vite.shared.ts";

/**
 * Readers that turn the repository's own files into documentation data. They have no
 * dependency on Vite or the site, so the docs plugin, the Markdown export for coding agents
 * (agent-docs.ts) and the tests all read the source the same way.
 */

export interface PageMeta {
  /** Route, e.g. "/components/push-button". */
  path: string;
  /** Absolute file path of the .mdx or .md module. */
  file: string;
  /** Repository-relative folder of the page, used to find its examples. */
  dir: string;
  title: string;
  description: string;
  group: string;
  order: number;
  /** "page" (default) or "full" for app demos that need the whole width. */
  layout: string;
  /** Markdown files carry their own top-level heading. */
  ownHeading: boolean;
  /** Site-relative path of the page's plain-Markdown twin, e.g. "components/push-button.md". */
  markdown: string;
}

/** Folders inside a component that are documentation or tests, not source (as in the registry). */
const NOT_SOURCE = new Set(["examples", "__tests__"]);

/**
 * The source modules of a folder: its .ts and .tsx files and those of its subfolders, without
 * tests, declaration files, examples and hidden folders. The files of the folder itself come
 * first, each level in name order. The package and the copy-in registry ship a component's
 * subfolders, so the documentation has to read them too.
 */
export function sourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !/\.test\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith(".d.ts"),
    )
    .map((entry) => path.join(dir, entry.name));
  for (const entry of entries) {
    if (entry.isDirectory() && !NOT_SOURCE.has(entry.name) && !entry.name.startsWith(".")) {
      files.push(...sourceFiles(path.join(dir, entry.name)));
    }
  }
  return files;
}

const GROUP_ORDER = ["Overview", "Foundations", "Components", "Demos", "Project"];

/** Project documents at the repository root that are also pages of the site. */
const ROOT_DOCUMENTS = ["CONTRIBUTING.md", "ARCHITECTURE.md", "AGENTS.md"];

export function frontmatter(source: string): Record<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  const data: Record<string, string> = {};
  if (!match?.[1]) return data;
  for (const line of match[1].split(/\r?\n/)) {
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

export const titleCase = (slug: string) =>
  slug.replace(
    /(^|-)([a-z])/g,
    (_, dash: string, letter: string) => (dash ? " " : "") + letter.toUpperCase(),
  );

/** The Markdown twin of a route: "/" is index.md, "/components/x" is components/x.md. */
export const markdownPath = (route: string) =>
  route === "/" ? "index.md" : `${route.slice(1)}.md`;

export function collectPages(): PageMeta[] {
  const pages: PageMeta[] = [];
  const add = (file: string, route: string, defaults: Partial<PageMeta>) => {
    const source = readFileSync(file, "utf8");
    const meta = frontmatter(source);
    const heading = /^#\s+(.+)$/m.exec(source)?.[1];
    const pagePath = meta.path ?? route;
    pages.push({
      path: pagePath,
      file,
      dir: path.relative(repoRoot, path.dirname(file)).split(path.sep).join("/"),
      title: meta.title ?? heading ?? defaults.title ?? route,
      description: meta.description ?? "",
      group: meta.group ?? defaults.group ?? "Overview",
      order: Number(meta.order ?? defaults.order ?? 100),
      layout: meta.layout ?? "page",
      ownHeading: file.endsWith(".md"),
      markdown: markdownPath(pagePath),
    });
  };

  // Guides: docs/content/*.mdx
  const content = path.join(repoRoot, "docs/content");
  for (const name of readdirSync(content)
    .filter((f) => f.endsWith(".mdx"))
    .sort()) {
    const slug = name.slice(0, -4);
    add(path.join(content, name), slug === "index" ? "/" : `/${slug}`, { title: titleCase(slug) });
  }

  // Component and demo pages: <folder>/<folder>.mdx, next to the code they document.
  for (const [base, route, group] of [
    ["src/components", "/components", "Components"],
    ["demos", "/demos", "Demos"],
  ] as const) {
    const root = path.join(repoRoot, base);
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const file = path.join(root, entry.name, `${entry.name}.mdx`);
      if (entry.isDirectory() && existsSync(file)) {
        add(file, `${route}/${entry.name}`, { title: titleCase(entry.name), group });
      }
    }
  }

  // Project documents that live at the repository root.
  ROOT_DOCUMENTS.forEach((name, index) => {
    const file = path.join(repoRoot, name);
    if (existsSync(file)) {
      add(file, `/${name.slice(0, -3).toLowerCase()}`, { group: "Project", order: index + 1 });
    }
  });

  const groupIndex = (group: string) => {
    const index = GROUP_ORDER.indexOf(group);
    return index === -1 ? GROUP_ORDER.length : index;
  };
  return pages.sort(
    (a, b) =>
      groupIndex(a.group) - groupIndex(b.group) ||
      a.order - b.order ||
      a.title.localeCompare(b.title, "en"),
  );
}

export interface PropDoc {
  name: string;
  type: string;
  required: boolean;
  /** What the documentation shows: the JSDoc `@default`, else a literal default in the code. */
  defaultValue: string | null;
  /** The `@default` tag of the prop's JSDoc comment. */
  jsdocDefault: string | null;
  /** The default in the component's parameter destructuring (`size = "regular"`). */
  codeDefault: string | null;
  description: string;
}

export interface PropsDoc {
  name: string;
  /** Source text of the `extends` clause: where the inherited props come from. */
  extends: string[];
  props: PropDoc[];
}

export interface ExportDoc {
  /** Name as seen by the importer. */
  name: string;
  /** Name in the module it comes from. */
  local: string;
  isType: boolean;
  /** Module specifier of a re-export (`export { X } from "./x"`), else null. */
  source: string | null;
  /** JSDoc description of a value declared in this file. */
  description: string;
}

export interface ImportDoc {
  local: string;
  imported: string;
  source: string;
}

/**
 * A type alias's definition as the parser read it: its text, cut at every name it uses as a
 * type. Only a name in the position of a type reference is cut out (`Tone` in `Tone[]`, `Box`
 * in `Box<T>`, `React` in `React.ReactNode`); a property or method name, a string and the
 * text of a template literal stay text. Joined in order, the parts are the definition.
 */
export interface AliasDoc {
  parts: (string | { name: string })[];
  /** Declared with type parameters (`Box<T>`). */
  generic: boolean;
  /** Names the definition binds itself: a mapped type's key, `infer K`, `<T>(…) => T`. */
  binds: string[];
  /** Names of the parameters of function types in the definition, which are values there. */
  parameters: string[];
  /** The values the definition queries with `typeof`, by the name the module has for them. */
  queries: string[];
  /** Refers to a module (`import("./x")`), which only means something where it is written. */
  imports: boolean;
}

export interface ModuleDoc {
  /** `*Props` interfaces and type aliases whose declaration is itself exported. */
  props: PropsDoc[];
  /**
   * The module's other top-level `*Props` interfaces and type aliases. One of them is public
   * only when an export list of the module names it (`export type { ItemProps }`), which
   * `resolveExport` decides; none is ever looked up by name alone.
   */
  localProps: PropsDoc[];
  /** Other exported type aliases, name to definition text. */
  types: Record<string, string>;
  /** The names in `types` that are declared with type parameters (`Box<T>`). */
  generic: string[];
  /** Every type alias of the module that is not a `*Props` type, exported or not. */
  aliases: Record<string, AliasDoc>;
  /**
   * Every name the module declares that a type can refer to, exported or not: type aliases,
   * interfaces, classes, enums and namespaces.
   */
  declared: string[];
  /** Every value the module declares at its top level: variables, functions, classes, enums. */
  values: string[];
  exports: ExportDoc[];
  imports: ImportDoc[];
  /** Module specifiers of `export * from "./x"`. */
  exportAll: string[];
  /** `export * as Name from "./x"`: one namespace object, under a name. */
  exportNamespaces: { name: string; source: string }[];
  /**
   * Defaults in the parameter destructuring of the module's functions, by the name the props
   * type has in this module: `({ size = "regular" }: BoxProps)` gives `BoxProps.size`.
   */
  defaults: Record<string, Record<string, string>>;
}

interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

const nameOf = (node: unknown): string => {
  const key = node as { name?: string; value?: unknown } | null;
  return key?.name ?? String(key?.value ?? "");
};

/**
 * Collapse whitespace in a piece of source to single spaces, except inside string literals:
 * a default of `"a  b"` must be documented as written.
 */
export function collapseWhitespace(source: string): string {
  return source.replace(
    /("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`)|\s+/g,
    (_, literal?: string) => literal ?? " ",
  );
}

/** Read a module's exports, its `*Props` types and the defaults its components destructure. */
export function readModule(file: string): ModuleDoc {
  const code = readFileSync(file, "utf8");
  const { program, comments } = parseSync(file, code);
  const text = (node: Node) => collapseWhitespace(code.slice(node.start, node.end));

  const jsdocBefore = (start: number) => {
    const comment = comments.find(
      (c) =>
        c.type === "Block" &&
        c.value.startsWith("*") &&
        c.end <= start &&
        /^\s*$/.test(code.slice(c.end, start)),
    );
    if (!comment) return { description: "", jsdocDefault: null };
    const lines = comment.value
      .split("\n")
      .map((line) => line.replace(/^\s*\*? ?/, ""))
      .join("\n")
      .trim();
    const jsdocDefault = /@default\s+(.+)/.exec(lines)?.[1]?.trim() ?? null;
    const description = lines
      .split("\n")
      .filter((line) => !line.startsWith("@"))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return { description, jsdocDefault };
  };

  const doc: ModuleDoc = {
    props: [],
    localProps: [],
    types: {},
    generic: [],
    aliases: {},
    declared: [],
    values: [],
    exports: [],
    imports: [],
    exportAll: [],
    exportNamespaces: [],
    defaults: {},
  };
  /** Props type name -> prop name -> default expression in a component's destructuring. */
  const codeDefaults = new Map<string, Map<string, string>>();

  const readFunction = (fn: Node | null | undefined) => {
    if (
      !fn ||
      !["FunctionDeclaration", "ArrowFunctionExpression", "FunctionExpression"].includes(fn.type)
    )
      return;
    const first = (fn.params as Node[] | undefined)?.[0];
    if (first?.type !== "ObjectPattern") return;
    const annotation = (first.typeAnnotation as { typeAnnotation: Node } | null)?.typeAnnotation;
    if (annotation?.type !== "TSTypeReference") return;
    const propsName = nameOf(annotation.typeName);
    const defaults = codeDefaults.get(propsName) ?? new Map<string, string>();
    for (const property of first.properties as Node[]) {
      const value = property.value as Node | undefined;
      if (property.type === "Property" && value?.type === "AssignmentPattern") {
        defaults.set(nameOf(property.key), text(value.right as Node));
      }
    }
    codeDefaults.set(propsName, defaults);
  };

  /** Members written in this file, and the types the rest is inherited from. */
  const shapeOf = (declaration: Node): { members: Node[]; inherits: string[] } => {
    if (declaration.type === "TSInterfaceDeclaration") {
      return {
        members: (declaration.body as { body: Node[] }).body,
        inherits: ((declaration.extends as Node[] | undefined) ?? []).map(text),
      };
    }
    const members: Node[] = [];
    const inherits: string[] = [];
    const annotation = declaration.typeAnnotation as Node;
    const parts =
      annotation.type === "TSIntersectionType" ? (annotation.types as Node[]) : [annotation];
    for (const part of parts) {
      if (part.type === "TSTypeLiteral") members.push(...(part.members as Node[]));
      else inherits.push(text(part));
    }
    return { members, inherits };
  };

  const readProps = (name: string, declaration: Node, into: PropsDoc[]) => {
    const { members, inherits } = shapeOf(declaration);
    const props: PropDoc[] = [];
    for (const member of members) {
      const key = member.key as Node | undefined;
      if (!key) continue;
      let type = "unknown";
      if (member.type === "TSPropertySignature") {
        const annotation = (member.typeAnnotation as { typeAnnotation: Node } | null)
          ?.typeAnnotation;
        if (annotation) type = text(annotation);
      } else if (member.type === "TSMethodSignature") {
        // `onChange(value: string): void` is documented as the function type it declares.
        const signature = code
          .slice(key.end, member.end)
          .replace(/^\?/, "")
          .replace(/[;,]\s*$/, "");
        const split = /^([\s\S]*\))\s*:\s*([\s\S]+)$/.exec(signature.trim());
        type = collapseWhitespace(
          split ? `${split[1]} => ${split[2]}` : `${signature.trim()} => void`,
        );
      } else continue;
      props.push({
        name: nameOf(key),
        type,
        required: !member.optional,
        defaultValue: null,
        codeDefault: null,
        ...jsdocBefore(member.start),
      });
    }
    into.push({ name, extends: inherits, props });
  };

  /** An alias's definition, cut at the type references the parser found in it. */
  const readAlias = (declaration: Node): AliasDoc => {
    const annotation = declaration.typeAnnotation as Node;
    const references: { start: number; end: number; name: string }[] = [];
    const binds = new Set<string>();
    const queries = new Set<string>();
    const parameters = new Set<string>();
    let imports = false;
    const bind = (name: unknown) => binds.add(typeof name === "string" ? name : nameOf(name));
    /** `A.B.C` refers to what the module calls A; B and C are members of it. */
    const headOf = (name: unknown) => {
      let head = name as Node | undefined;
      while (head?.type === "TSQualifiedName") head = head.left as Node | undefined;
      return head && typeof head.name === "string" ? { node: head, name: head.name } : null;
    };
    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
        return;
      }
      if (!value || typeof value !== "object") return;
      const node = value as Node;
      if (node.type === "TSTypeReference") {
        const head = headOf(node.typeName);
        if (head) references.push({ start: head.node.start, end: head.node.end, name: head.name });
      } else if (node.type === "TSTypeQuery") {
        const head = headOf(node.exprName);
        if (head) queries.add(head.name);
      } else if (node.type === "TSImportType") imports = true;
      else if (node.type === "TSTypeParameter") bind(node.name);
      else if (node.type === "TSMappedType" && node.key) bind(node.key);
      if (FUNCTION_TYPES.has(node.type) && Array.isArray(node.params)) {
        for (const name of node.params.flatMap(boundNames)) parameters.add(name);
      }
      for (const child of Object.values(node)) visit(child);
    };
    visit(annotation);
    references.sort((a, b) => a.start - b.start);
    // Collapse the whitespace of the whole definition, so that a template literal a reference
    // sits in is still seen as one literal; a NUL marks where each reference was.
    let marked = "";
    let cursor = annotation.start;
    for (const reference of references) {
      marked += `${code.slice(cursor, reference.start)}\0`;
      cursor = reference.end;
    }
    marked += code.slice(cursor, annotation.end);
    const parts: AliasDoc["parts"] = [];
    const pieces = collapseWhitespace(marked).split("\0");
    pieces.forEach((piece, index) => {
      parts.push(piece);
      const reference = references[index];
      if (reference) parts.push({ name: reference.name });
    });
    return {
      parts,
      generic: Boolean(declaration.typeParameters),
      binds: [...binds],
      parameters: [...parameters],
      queries: [...queries],
      imports,
    };
  };

  /** The names a declaration's target binds: an identifier, or the names in a pattern. */
  const boundNames = (target: unknown): string[] => {
    const node = target as Node | null | undefined;
    if (!node) return [];
    if (node.type === "Identifier") return [nameOf(node)];
    if (node.type === "ObjectPattern") {
      return (node.properties as Node[]).flatMap((property) =>
        boundNames(property.type === "RestElement" ? property.argument : property.value),
      );
    }
    if (node.type === "ArrayPattern") return (node.elements as unknown[]).flatMap(boundNames);
    if (node.type === "AssignmentPattern") return boundNames(node.left);
    if (node.type === "RestElement") return boundNames(node.argument);
    return [];
  };

  /** Note a top-level declaration that a type can refer to by name, or query with typeof. */
  const declares = (declaration: Node | null | undefined) => {
    if (!declaration) return;
    if (declaration.type === "VariableDeclaration") {
      for (const declarator of declaration.declarations as Node[]) {
        doc.values.push(...boundNames(declarator.id));
      }
    } else if (VALUE_DECLARATIONS.has(declaration.type) && declaration.id) {
      doc.values.push(nameOf(declaration.id));
    }
    if (!TYPE_DECLARATIONS.has(declaration.type)) return;
    const name = nameOf(declaration.id);
    if (!name) return;
    doc.declared.push(name);
    if (declaration.type === "TSTypeAliasDeclaration" && !name.endsWith("Props")) {
      doc.aliases[name] = readAlias(declaration);
    }
  };

  for (const statement of program.body as unknown as Node[]) {
    declares(
      statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
        ? (statement.declaration as Node | null)
        : statement,
    );
    if (statement.type === "ImportDeclaration") {
      const source = String((statement.source as { value: unknown }).value);
      for (const specifier of statement.specifiers as Node[]) {
        doc.imports.push({
          local: nameOf(specifier.local),
          imported:
            specifier.type === "ImportSpecifier"
              ? nameOf(specifier.imported)
              : specifier.type === "ImportDefaultSpecifier"
                ? "default"
                : "*",
          source,
        });
      }
      continue;
    }
    if (statement.type === "ExportAllDeclaration") {
      // `export * as ns from` exports one namespace object, not the names of the module.
      const source = String((statement.source as { value: unknown }).value);
      if (statement.exported) {
        doc.exportNamespaces.push({ name: nameOf(statement.exported), source });
      } else doc.exportAll.push(source);
      continue;
    }
    if (statement.type === "FunctionDeclaration") readFunction(statement);
    if (
      statement.type === "TSInterfaceDeclaration" ||
      statement.type === "TSTypeAliasDeclaration"
    ) {
      // Declared without `export`: an export list further down may still make it public.
      const name = nameOf(statement.id);
      if (name.endsWith("Props")) readProps(name, statement, doc.localProps);
    }
    if (statement.type === "VariableDeclaration") {
      for (const declarator of statement.declarations as Node[])
        readFunction(declarator.init as Node);
    }
    if (statement.type !== "ExportNamedDeclaration") continue;

    const source = statement.source ? String((statement.source as { value: unknown }).value) : null;
    for (const specifier of (statement.specifiers as Node[] | undefined) ?? []) {
      doc.exports.push({
        name: nameOf(specifier.exported),
        local: nameOf(specifier.local),
        isType: statement.exportKind === "type" || specifier.exportKind === "type",
        source,
        description: "",
      });
    }

    const declaration = statement.declaration as Node | null;
    if (!declaration) continue;
    const { description } = jsdocBefore(statement.start);
    const exported = (name: string, isType: boolean) =>
      doc.exports.push({ name, local: name, isType, source: null, description });

    if (
      declaration.type === "TSInterfaceDeclaration" ||
      declaration.type === "TSTypeAliasDeclaration"
    ) {
      const name = nameOf(declaration.id);
      exported(name, true);
      if (name.endsWith("Props")) readProps(name, declaration, doc.props);
      else if (declaration.type === "TSTypeAliasDeclaration") {
        doc.types[name] = text(declaration.typeAnnotation as Node);
        if (declaration.typeParameters) doc.generic.push(name);
      }
    } else if (declaration.type === "FunctionDeclaration") {
      exported(nameOf(declaration.id), false);
      readFunction(declaration);
    } else if (declaration.type === "VariableDeclaration") {
      for (const declarator of declaration.declarations as Node[]) {
        exported(nameOf(declarator.id), false);
        readFunction(declarator.init as Node);
      }
    } else if (declaration.type === "ClassDeclaration") {
      exported(nameOf(declaration.id), false);
    }
  }

  for (const [name, defaults] of codeDefaults) doc.defaults[name] = Object.fromEntries(defaults);
  for (const props of [...doc.props, ...doc.localProps]) {
    const defaults = codeDefaults.get(props.name);
    for (const prop of props.props) {
      prop.codeDefault = defaults?.get(prop.name) ?? null;
      // A computed default (`arrows = variant === "pager"`) is not shown as code: the JSDoc
      // must say what it amounts to.
      prop.defaultValue =
        prop.jsdocDefault ??
        (prop.codeDefault !== null && isLiteral(prop.codeDefault) ? prop.codeDefault : null);
    }
  }
  return doc;
}

/** Declarations whose name a type can refer to. */
const TYPE_DECLARATIONS = new Set([
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "ClassDeclaration",
  "TSEnumDeclaration",
  "TSModuleDeclaration",
  "TSImportEqualsDeclaration",
]);

/** Types with a parameter list, whose parameter names are values inside the type. */
const FUNCTION_TYPES = new Set([
  "TSFunctionType",
  "TSConstructorType",
  "TSMethodSignature",
  "TSCallSignatureDeclaration",
  "TSConstructSignatureDeclaration",
]);

/** Declarations, besides variables, whose name is a value that `typeof` can query. */
const VALUE_DECLARATIONS = new Set([
  "FunctionDeclaration",
  "ClassDeclaration",
  "TSEnumDeclaration",
  "TSModuleDeclaration",
  "TSImportEqualsDeclaration",
]);

/** A default that can be compared and shown as it stands: `"regular"`, `0`, `false`. */
export const isLiteral = (expression: string) =>
  /^("[^"]*"|'[^']*'|-?\d[\d.]*|true|false|null|undefined)$/.test(expression);

/** Read exported `*Props` interfaces and type aliases from a component source file. */
export function extractProps(file: string): PropsDoc[] {
  return readModule(file).props;
}

/** The source modules of a folder by absolute path, in the order of `sourceFiles`. */
export type FolderModules = Map<string, ModuleDoc>;

export function readFolder(dir: string): FolderModules {
  return new Map(sourceFiles(dir).map((file) => [file, readModule(file)]));
}

/**
 * The module of the folder a relative specifier names, as TypeScript resolves it: the file as
 * written, then `.ts` and `.tsx` in place of a `.js` extension or of none, then the index of a
 * folder. Null for a package, and for a file outside the folder.
 */
export function resolveModule(
  from: string,
  specifier: string,
  modules: FolderModules,
): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(path.dirname(from), specifier);
  const stem = base.replace(/\.[cm]?jsx?$/, "");
  const candidates = [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates.find((candidate) => modules.has(candidate)) ?? null;
}

/**
 * Where the name a module exports is declared: the module, and the name it has there. A
 * re-export (`export { A as B } from "./x"`, `export * from "./x"`, or an import exported
 * again) is followed from module to module, so two modules of a folder may each declare an
 * `ItemProps` and the folder's index.ts may export both under different names. Null when the
 * chain leaves the folder, names something the module does not export, or names something two
 * wildcards export from different declarations (which is ambiguous, so neither exports it).
 */
export function resolveExport(
  modules: FolderModules,
  file: string,
  name: string,
  chain = new Set<string>(),
): { file: string; local: string } | null {
  const module = modules.get(file);
  const visit = `${file}\0${name}`;
  // Only a name that is being resolved further up this very chain is a cycle. A branch that
  // failed elsewhere (an ambiguous wildcard) must not stop another branch from reaching it.
  if (!module || chain.has(visit)) return null;
  const inside = new Set([...chain, visit]);
  const follow = (specifier: string, exported: string) => {
    const target = resolveModule(file, specifier, modules);
    return target ? resolveExport(modules, target, exported, inside) : null;
  };
  for (const entry of module.exports) {
    if (entry.name !== name) continue;
    if (entry.source !== null) return follow(entry.source, entry.local);
    const imported = module.imports.find((item) => item.local === entry.local);
    if (!imported) return { file, local: entry.local };
    return imported.imported === "*" ? null : follow(imported.source, imported.imported);
  }
  if (name === "default") return null;
  // A name two wildcards lead to is exported only when both mean the same declaration.
  let found: { file: string; local: string } | null = null;
  for (const specifier of module.exportAll) {
    const next = follow(specifier, name);
    if (!next) continue;
    if (found && (found.file !== next.file || found.local !== next.local)) return null;
    found = next;
  }
  return found;
}

/**
 * The `*Props` declaration behind a name a module exports, and the module that declares it:
 * an exported declaration, or one the module exports through a list of its own
 * (`interface ItemProps {…}` and, separately, `export type { ItemProps }`). Null when the
 * export cannot be followed to a `*Props` interface or type alias of the folder.
 * Nothing is looked up by name instead: a declaration that merely has the name may be another
 * type, and the page would document it as if the export had been resolved.
 */
export function findProps(
  modules: FolderModules,
  file: string,
  name: string,
): { doc: PropsDoc; file: string } | null {
  const at = resolveExport(modules, file, name);
  const module = at && modules.get(at.file);
  // resolveExport stops at a name the module declares and exports, so a declaration found
  // here under that name is the exported one, with or without `export` of its own.
  const doc =
    at && module && [...module.props, ...module.localProps].find((p) => p.name === at.local);
  return at && doc ? { doc: withFolderDefaults(modules, doc, at.file), file: at.file } : null;
}

/**
 * A props declaration with the defaults of the functions that destructure it in the other
 * modules of the folder: a component often imports its props type from a module of its own
 * (`parts/props.ts`), and its parameter list is then the only place a default is written.
 * readModule has already applied the defaults of the declaring module itself; those win, then
 * the first module in folder order that gives the prop a default.
 */
export function withFolderDefaults(modules: FolderModules, doc: PropsDoc, file: string): PropsDoc {
  const found = new Map<string, string>();
  for (const [other, module] of modules) {
    if (other === file) continue;
    for (const [typeName, defaults] of Object.entries(module.defaults)) {
      // The name must be this declaration, imported; not another type that shares the name.
      const imported = module.imports.find((entry) => entry.local === typeName);
      if (!imported || imported.imported === "*") continue;
      const target = resolveModule(other, imported.source, modules);
      const origin = target ? resolveExport(modules, target, imported.imported) : null;
      if (origin?.file !== file || origin.local !== doc.name) continue;
      for (const [prop, value] of Object.entries(defaults)) {
        if (!found.has(prop)) found.set(prop, value);
      }
    }
  }
  if (found.size === 0) return doc;
  return {
    ...doc,
    props: doc.props.map((prop) => {
      const codeDefault = prop.codeDefault ?? found.get(prop.name) ?? null;
      return {
        ...prop,
        codeDefault,
        defaultValue:
          prop.jsdocDefault ??
          (codeDefault !== null && isLiteral(codeDefault) ? codeDefault : null),
      };
    }),
  };
}

/** Where the shared helpers live; a component imports their type aliases (ControlSize). */
const LIBRARY = path.join(repoRoot, "src/lib");

/** Whether a file is one of src/lib. */
function inLibrary(file: string): boolean {
  const within = path.relative(LIBRARY, file);
  return within !== "" && !within.startsWith("..") && !path.isAbsolute(within);
}

/**
 * The file of src/lib a relative specifier names. Null for any other file outside the folder:
 * another component or a file elsewhere may export a type of the same name as a shared alias,
 * and it is not that alias.
 */
function libraryFile(from: string, specifier: string): string | null {
  const base = path.resolve(path.dirname(from), specifier);
  const stem = base.replace(/\.[cm]?jsx?$/, "");
  return (
    [base, `${stem}.ts`, `${stem}.tsx`].find(
      (candidate) =>
        /\.tsx?$/.test(candidate) &&
        !candidate.endsWith(".d.ts") &&
        inLibrary(candidate) &&
        existsSync(candidate),
    ) ?? null
  );
}

/** The modules one reading can reach: those of the folder, and the files of src/lib it opens. */
interface Reach {
  modules: FolderModules;
  library: Map<string, ModuleDoc>;
}

function moduleAt(reach: Reach, file: string): ModuleDoc | null {
  const known = reach.modules.get(file) ?? reach.library.get(file);
  if (known || !inLibrary(file) || !existsSync(file)) return known ?? null;
  const read = readModule(file);
  reach.library.set(file, read);
  return read;
}

/**
 * The declaration an import of a module leads to. In the folder the export is followed from
 * module to module; a file of src/lib is read for what it declares and exports itself. Null
 * when the import cannot be followed to a declaration that was read.
 */
function importedFrom(
  reach: Reach,
  file: string,
  entry: ImportDoc,
): { file: string; local: string } | null {
  if (!entry.source.startsWith(".") || entry.imported === "*") return null;
  if (reach.modules.has(file)) {
    const target = resolveModule(file, entry.source, reach.modules);
    if (target) return resolveExport(reach.modules, target, entry.imported);
  }
  const target = libraryFile(file, entry.source);
  const library = target && moduleAt(reach, target);
  if (!target || !library) return null;
  const exported = library.exports.find(
    (item) =>
      item.name === entry.imported &&
      item.source === null &&
      (library.declared.includes(item.local) || library.values.includes(item.local)),
  );
  return exported ? { file: target, local: exported.local } : null;
}

const GLOBAL = "global";
const UNKNOWN = "unknown";

/**
 * What a module means by a name, as a text that is equal for two modules exactly when both
 * are known to mean the same thing: a declaration that was read (by its file and its name
 * there), an import from a package (by the package and the imported name), or a name the
 * module neither declares nor imports, which is a global (`Array`, `HTMLElement`, `window`).
 * A name that leads anywhere else starts with UNKNOWN and is equal to nothing another module
 * means. A type and a value may share a name, so `kind` says which of the two is asked for:
 * a name used as a type, or a value queried with `typeof`.
 */
function meaningOf(
  reach: Reach,
  file: string,
  name: string,
  kind: "type" | "value" = "type",
): { id: string; at: { file: string; local: string } | null } {
  const module = moduleAt(reach, file);
  const nowhere = { id: `${UNKNOWN}\0${file}\0${name}`, at: null };
  if (!module) return nowhere;
  let at: { file: string; local: string } | null = null;
  if ((kind === "type" ? module.declared : module.values).includes(name)) {
    at = { file, local: name };
  } else {
    const entry = module.imports.find((item) => item.local === name);
    if (!entry) return { id: GLOBAL, at: null };
    if (!entry.source.startsWith(".")) {
      return { id: `package\0${entry.source}\0${entry.imported}`, at: null };
    }
    at = importedFrom(reach, file, entry);
  }
  return at ? { id: `${kind}\0${at.file}\0${at.local}`, at } : nowhere;
}

/** A definition written out for another module, and what the names left in it mean. */
interface Portable {
  text: string;
  /** Each name the text still uses as a type, with its meaning (see meaningOf). */
  carried: Map<string, string>;
  /** Each value the text queries with `typeof`, with its meaning. */
  queried: Map<string, string>;
}

/**
 * An alias definition as it can be shown in another module. Every type reference in it is
 * looked up in the module that declares the alias, by the references the parser found (so a
 * method or property that shares a name with a type is never taken for one):
 *
 * - a reference to a type alias without type parameters, declared in that module (exported or
 *   not) or imported by it from the folder or from src/lib, is replaced by that alias's own
 *   definition, written out the same way from its own module;
 * - any other reference keeps its name, and the name's meaning is recorded, so that the caller
 *   can refuse the definition for a module where the name means something else;
 * - a value queried with `typeof` keeps its name and is recorded the same way, as a value.
 *
 * Null when it cannot be shown truthfully: a generic alias (its body names its own type
 * parameters), an alias that leads back to itself, a definition that refers to a module
 * (`import("./x")`), one that binds a name its module also gives a type (which is which
 * depends on where in the definition the name stands, also when the name only arrives with
 * an alias that is written out inside it), and one in which a name would stand
 * for two different things once the parts are put together.
 */
function portable(reach: Reach, file: string, local: string, open: Set<string>): Portable | null {
  const aliases = moduleAt(reach, file)?.aliases;
  const alias = aliases && Object.hasOwn(aliases, local) ? aliases[local] : undefined;
  const key = `${file}\0${local}`;
  if (!alias || alias.generic || alias.imports || open.has(key)) return null;
  const inside = new Set([...open, key]);
  const carried = new Map<string, string>();
  const queried = new Map<string, string>();
  const keep = (names: Map<string, string>, name: string, id: string) => {
    if (names.has(name) && names.get(name) !== id) return false;
    names.set(name, id);
    return true;
  };
  const carry = (name: string, id: string) => keep(carried, name, id);
  for (const name of alias.queries) keep(queried, name, meaningOf(reach, file, name, "value").id);
  // An alias of an alias is the other's definition; inside a larger type it is one operand.
  const alone = alias.parts.length === 3 && alias.parts[0] === "" && alias.parts[2] === "";
  let text = "";
  for (const part of alias.parts) {
    if (typeof part === "string") {
      text += part;
      continue;
    }
    const meaning = meaningOf(reach, file, part.name);
    if (alias.binds.includes(part.name)) {
      // The definition's own parameter, unless the module has a type of that name as well.
      // Where the parameter's scope ends is not read, so the name may also stand outside
      // it, for a global: it is carried as one, and no module with a type of that name
      // is shown the definition.
      if (meaning.id !== GLOBAL || !carry(part.name, GLOBAL)) return null;
      text += part.name;
      continue;
    }
    const target = meaning.at && moduleAt(reach, meaning.at.file)?.aliases;
    const named =
      meaning.at && target && Object.hasOwn(target, meaning.at.local)
        ? target[meaning.at.local]
        : undefined;
    if (meaning.at && named && !named.generic) {
      const inner = portable(reach, meaning.at.file, meaning.at.local, inside);
      if (!inner) return null;
      // A name the written-out alias brings along would be captured by a binding here.
      if ([...inner.carried.keys()].some((name) => alias.binds.includes(name))) return null;
      // And a value it queries would become a parameter of a function type here.
      if ([...inner.queried.keys()].some((name) => alias.parameters.includes(name))) return null;
      for (const [name, id] of inner.carried) if (!carry(name, id)) return null;
      for (const [name, id] of inner.queried) if (!keep(queried, name, id)) return null;
      text += alone || /^[\w$.]+$|^"[^"]*"$/.test(inner.text) ? inner.text : `(${inner.text})`;
      continue;
    }
    if (!carry(part.name, meaning.id)) return null;
    text += part.name;
  }
  return { text: text.trim().replace(/^\|\s*/, ""), carried, queried };
}

/**
 * The type aliases a module can name, with their definitions: the ones it exports itself, as
 * written, and the ones it imports from another module of the folder or from a file of
 * src/lib (read from that file, never matched by name), under the name it imports them as.
 *
 * An imported alias is defined in another scope, so it is written out as that scope means it
 * (see portable): `Tone = Base` becomes Base's definition there, because this module may not
 * have a `Base`, or may have another type under that name. A name that is left in the
 * definition, as a type or as a value queried with `typeof`, must mean here what it means
 * there, or mean nothing here: when this module
 * declares or imports something else under it, the alias is left out, and so is an alias that
 * cannot be written out at all. A props table then says nothing about the alias rather than
 * something that is not true.
 */
export function typesInScope(modules: FolderModules, file: string): Record<string, string> {
  const types: Record<string, string> = {};
  const module = modules.get(file);
  if (!module) return types;
  const reach: Reach = { modules, library: new Map() };
  for (const entry of module.imports) {
    const at = importedFrom(reach, file, entry);
    const written = at && portable(reach, at.file, at.local, new Set());
    if (!written) continue;
    const same = (kind: "type" | "value") => (pair: [string, string]) => {
      const mine = meaningOf(reach, file, pair[0], kind).id;
      return mine === GLOBAL || (mine === pair[1] && !mine.startsWith(UNKNOWN));
    };
    const fits =
      [...written.carried].every(same("type")) && [...written.queried].every(same("value"));
    if (fits) types[entry.local] = written.text;
  }
  // The module's own aliases, as written: the names they use are the module's own.
  for (const [name, definition] of Object.entries(module.types)) types[name] = definition;
  return types;
}

/**
 * The props tables a component folder offers, by name: every `*Props` type its index.ts
 * exports, under the exported name and read from the module that declares it, and the other
 * `*Props` declarations a module of the folder exports under their own name (nearest the top
 * of the folder first). A name index.ts exports always means that export: when the export cannot be
 * followed there is no table under the name, never the table of another declaration that has
 * it. index.ts lists its exports by name (`npm run lint` refuses `export *` there, and the
 * Markdown export reports it), so no wildcard is expanded.
 */
export function propsTables(dir: string, modules = readFolder(dir)): Map<string, PropsDoc> {
  const tables = new Map<string, PropsDoc>();
  const index = path.join(dir, "index.ts");
  const exported = new Set<string>();
  for (const entry of modules.get(index)?.exports ?? []) {
    exported.add(entry.name);
    if (!entry.isType || !entry.name.endsWith("Props")) continue;
    const found = findProps(modules, index, entry.name);
    if (found) tables.set(entry.name, { ...found.doc, name: entry.name });
  }
  for (const [file, module] of modules) {
    // Exported where it is declared, or by a list of the module under its own name.
    const listed = module.localProps.filter((doc) =>
      module.exports.some(
        (entry) => entry.source === null && entry.name === doc.name && entry.local === doc.name,
      ),
    );
    for (const doc of [...module.props, ...listed]) {
      if (!exported.has(doc.name) && !tables.has(doc.name)) {
        tables.set(doc.name, withFolderDefaults(modules, doc, file));
      }
    }
  }
  return tables;
}

export interface TokenDoc {
  name: string;
  value: string;
  status: "measured" | "catalog" | "provisional" | null;
  note: string;
}

/** Blank out comments, keeping every offset and line break, so code can be matched alone. */
export const maskCssComments = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));

/**
 * Read custom property declarations and their status tags from the text of a token stylesheet.
 *
 * Declarations are matched in the stylesheet with its comments blanked out, so a comment that
 * quotes a declaration (`--mac-x: 1px;`) is never mistaken for one. The comments themselves are
 * read from the original text, for the tags and notes.
 */
export function parseTokens(css: string): TokenDoc[] {
  const code = maskCssComments(css);
  const tokens = new Map<string, TokenDoc>();
  const tagOf = (text: string) =>
    /\[(measured|catalog|provisional)/.exec(text)?.[1] as TokenDoc["status"];
  const clean = (text: string) =>
    text
      .replace(/^\s*\*\s?/gm, "")
      .replace(/\s+/g, " ")
      .trim();

  for (const match of code.matchAll(/(--mac-[a-z0-9-]+)\s*:\s*([^;{}]+);/g)) {
    const [whole, name = "", rawValue = ""] = match;
    if (tokens.has(name)) continue;
    const end = match.index + whole.length;
    const lineEnd = css.indexOf("\n", end);
    const inline =
      /^\s*\/\*(.*?)\*\//.exec(css.slice(end, lineEnd === -1 ? undefined : lineEnd))?.[1] ?? "";
    // A comment on its own lines directly above the declaration. A comment that trails the
    // previous declaration on its line belongs to that declaration, not to this one.
    const before = css.slice(0, match.index);
    const above = /(?:^|\n)[ \t]*\/\*((?:(?!\*\/)[\s\S])*)\*\/\s*$/.exec(before)?.[1] ?? "";
    // Otherwise the tag of the closest earlier comment in the same block.
    const block = before.slice(code.lastIndexOf("{", match.index) + 1);
    const earlier = [...block.matchAll(/\[(measured|catalog|provisional)/g)].at(-1)?.[1];
    tokens.set(name, {
      name,
      value: rawValue.replace(/\s+/g, " ").trim(),
      status: tagOf(inline) ?? tagOf(above) ?? ((earlier as TokenDoc["status"]) || null),
      note: clean(inline || above),
    });
  }
  return [...tokens.values()];
}

/** Read the tokens of one stylesheet in src/styles/tokens. */
export function extractTokens(file: string): TokenDoc[] {
  return parseTokens(readFileSync(file, "utf8"));
}

/** Token files by name ("color", "accent", …), in file order. */
export function collectTokens(): Record<string, TokenDoc[]> {
  const dir = path.join(repoRoot, "src/styles/tokens");
  const all: Record<string, TokenDoc[]> = {};
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".css"))
    .sort()) {
    all[file.slice(0, -4)] = extractTokens(path.join(dir, file));
  }
  return all;
}
