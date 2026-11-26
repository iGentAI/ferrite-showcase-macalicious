// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { describe, expect, it } from "vitest";
import {
  code,
  collapseBlankLines,
  convertBody,
  enforcedComponents,
  formatProblems,
  generateAgentDocs,
  isEnforced,
  type Problem,
  type RenderContext,
  readComponent,
  renderPropsTable,
  sectionLinks,
} from "../docs/agent-docs.ts";
import {
  collapseWhitespace,
  isLiteral,
  type PageMeta,
  parseTokens,
  propsTables,
  readFolder,
  readModule,
  resolveExport,
  sourceFiles,
  typesInScope,
} from "../docs/extract.ts";
import { packageStylesheets } from "../vite.config.ts";
import {
  listComponents,
  listLibModules,
  repoRoot,
  runtimeImports,
  usedComponents,
} from "../vite.shared.ts";

/**
 * The Markdown export for coding agents (docs/agent-docs.ts) is generated, so nobody reads it
 * before it ships. These tests read it instead, and check it against the source with a second,
 * independent reader: the generator walks a syntax tree, the checks below scan the text of the
 * same files. If the two disagree about a component's props, one of them is wrong.
 *
 * Example code needs no check of its own here: every example block in a generated page is
 * compared with the file it was copied from, and those files are type-checked by `npm run
 * typecheck` and rendered by test/examples.test.tsx.
 *
 * ENFORCE_COMPONENTS=label,text-field limits these checks to the named component folders (and
 * the guides), for a tree that holds other people's unfinished components; see CONTRIBUTING.md.
 */

const { files, problems, components } = generateAgentDocs();
const only = enforcedComponents();
/** Generated files these checks read: all of them, or only the enforced components' pages. */
const checkedFiles = [...files].filter(([file]) => {
  // The bundle repeats every page, so its content is already checked page by page.
  if (file === "llms-full.txt") return false;
  const component = /^components\/(.+)\.md$/.exec(file)?.[1];
  return !only || !component || only.has(component);
});
const read = (file: string) => readFileSync(path.join(repoRoot, file), "utf8");
/**
 * Whitespace runs as one space, except inside string literals. Written apart from the
 * generator's collapseWhitespace (a character walk, not its regular expression) so the two
 * readers stay independent.
 */
function squash(text: string): string {
  let out = "";
  let quote = "";
  for (let index = 0; index < text.length; index++) {
    const char = text[index] as string;
    if (quote) {
      out += char;
      if (char === "\\") out += text[++index] ?? "";
      else if (char === quote) quote = "";
    } else if (/\s/.test(char)) {
      if (!out.endsWith(" ")) out += " ";
    } else {
      if (char === '"' || char === "'" || char === "`") quote = char;
      out += char;
    }
  }
  return out.trim();
}
const unquote = (text: string) => text.replace(/^(["'`])(.*)\1$/, "$2");
/**
 * A table cell as the generator writes it: inline code with pipes escaped. Written apart from
 * the generator's: the delimiter is the shortest run of backticks the text does not contain.
 */
const cell = (text: string) => {
  const inner = squash(text).replace(/\|/g, "\\|");
  if (!inner.includes("`")) return `\`${inner}\``;
  let fence = "``";
  while (inner.includes(fence)) fence += "`";
  return `${fence} ${inner} ${fence}`;
};

/**
 * The source files of a component folder, subfolders included, relative to it. Written apart
 * from the generator's reader of the same folders.
 */
function modulesOf(dir: string, inside = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(path.join(dir, inside), { withFileTypes: true })) {
    const file = inside ? `${inside}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!["examples", "__tests__"].includes(entry.name) && !entry.name.startsWith(".")) {
        found.push(...modulesOf(dir, file));
      }
    } else if (/\.tsx?$/.test(file) && !/\.test\./.test(file) && !file.endsWith(".d.ts")) {
      found.push(file);
    }
  }
  return found;
}

/** Blank out comments and string contents, keeping offsets, so braces can be counted. */
function skeleton(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (match) => " ".repeat(match.length))
    .replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, (match) => `"${"_".repeat(match.length - 2)}"`);
}

/** The text between the brace at `open` and its partner. */
function braced(source: string, shape: string, open: number): { start: number; end: number } {
  let depth = 0;
  for (let index = open; index < shape.length; index++) {
    if (shape[index] === "{") depth++;
    if (shape[index] === "}" && --depth === 0) return { start: open + 1, end: index };
  }
  throw new Error(`unbalanced braces after: ${source.slice(open, open + 40)}`);
}

/** Split at a separator that is outside every bracket. */
function splitTopLevel(source: string, shape: string, separators: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let index = 0; index < shape.length; index++) {
    const char = shape[index] as string;
    if ("{([".includes(char)) depth++;
    else if ("})]".includes(char)) depth--;
    else if (depth === 0 && separators.includes(char)) {
      parts.push(source.slice(from, index));
      from = index + 1;
    }
  }
  parts.push(source.slice(from));
  return parts.map((part) => part.trim()).filter(Boolean);
}

interface SourceProp {
  name: string;
  type: string;
  required: boolean;
  jsdocDefault: string | null;
  codeDefault: string | null;
}

/** A component's own props, read from the text of its folder. Null: not written as members. */
function propsFromText(component: string, propsName: string): SourceProp[] | null {
  const dir = path.join(repoRoot, "src/components", component);
  for (const file of modulesOf(dir)) {
    if (file === "index.ts") continue;
    const source = readFileSync(path.join(dir, file), "utf8");
    const shape = skeleton(source);
    const declaration = new RegExp(`export (?:interface|type) ${propsName}\\b`).exec(shape);
    if (!declaration) continue;
    // The body is the first brace outside the type parameters (`Props<Value = string>`).
    let open = -1;
    for (let index = declaration.index, angle = 0; index < shape.length; index++) {
      if (shape[index] === "<") angle++;
      else if (shape[index] === ">") angle--;
      else if (shape[index] === ";" && angle === 0) break;
      else if (shape[index] === "{" && angle === 0) {
        open = index;
        break;
      }
    }
    if (open === -1) continue;
    const body = braced(source, shape, open);

    // Defaults, from the parameter destructuring of the function typed with these props.
    const defaults = new Map<string, string>();
    const pattern = new RegExp(
      `\\(\\s*\\{([\\s\\S]*?)\\}\\s*:\\s*${propsName}\\s*(?:<[^>]*>)?\\s*\\)`,
    ).exec(shape);
    if (pattern) {
      const start = pattern.index + pattern[0].indexOf("{") + 1;
      const end = start + (pattern[1] as string).length;
      for (const entry of splitTopLevel(source.slice(start, end), shape.slice(start, end), ",")) {
        const assignment = /^([\w$]+)\s*=\s*([\s\S]+)$/.exec(entry);
        if (assignment) defaults.set(assignment[1] as string, squash(assignment[2] as string));
      }
    }

    const props: SourceProp[] = [];
    const text = source.slice(body.start, body.end);
    const textShape = shape.slice(body.start, body.end);
    let offset = 0;
    for (const member of splitTopLevel(text, textShape, ";")) {
      const at = text.indexOf(member, offset);
      offset = at + member.length;
      // The member's own text starts after its leading comments.
      const memberShape = textShape.slice(at, at + member.length);
      const first = memberShape.search(/\S/);
      const own = member.slice(first);
      const property = /^(?:readonly\s+)?(["']?)([\w$-]+)\1(\?)?\s*:\s*([\s\S]+)$/.exec(own);
      // `onChange(value: string): void` declares the function type `(value: string) => void`.
      const method = /^(["']?)([\w$-]+)\1(\?)?\s*(\([\s\S]*\))\s*:\s*([\s\S]+)$/.exec(own);
      const signature = property ?? method;
      if (!signature) continue;
      const comment = member.slice(0, first);
      props.push({
        name: signature[2] as string,
        required: signature[3] !== "?",
        type: squash(property ? (property[4] as string) : `${method?.[4]} => ${method?.[5]}`),
        jsdocDefault:
          /@default\s+(.+)/
            .exec(comment)?.[1]
            ?.replace(/\s*\*\/\s*$/, "")
            .trim() ?? null,
        codeDefault: defaults.get(signature[2] as string) ?? null,
      });
    }
    return props;
  }
  return null;
}

/** Names a module exports, read from its text. */
function exportedNames(file: string): Set<string> {
  const source = skeleton(read(file));
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const entry of (match[1] as string).split(",")) {
      const name = entry
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)
        .pop();
      if (name) names.add(name);
    }
  }
  for (const match of source.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|class|interface|type)\s+([\w$]+)/g,
  )) {
    names.add(match[1] as string);
  }
  return names;
}

const fences = (markdown: string) =>
  [...markdown.matchAll(/^```(\w*)\n([\s\S]*?)^```$/gm)].map((match) => ({
    lang: match[1] as string,
    code: match[2] as string,
  }));

describe("parseTokens", () => {
  const css = `
/*
 * A comment that quotes a declaration is not one:
 *   --mac-quoted: 1px;
 */
:root {
  /* [measured] the window */
  --mac-first: light-dark(#ececec, #323232);
  --mac-second: 2px; /* [provisional] no screenshot */
  --mac-third: 3px;
  /* --mac-disabled: 4px; */
  --mac-fourth: calc(1px /* inner: 5px; */ + 1px);
}
.rule { /* [catalog] */ --mac-fifth: 5px; }
`;
  const tokens = parseTokens(css);
  const byName = Object.fromEntries(tokens.map((token) => [token.name, token]));

  it("does not read declarations quoted in comments", () => {
    expect(tokens.map((token) => token.name)).toEqual([
      "--mac-first",
      "--mac-second",
      "--mac-third",
      "--mac-fourth",
      "--mac-fifth",
    ]);
    expect(byName["--mac-fourth"]?.value).toBe("calc(1px + 1px)");
  });

  it("reads the tag on the line, above it, or carried from the last tag in the block", () => {
    expect(byName["--mac-first"]).toMatchObject({
      status: "measured",
      note: "[measured] the window",
    });
    expect(byName["--mac-second"]).toMatchObject({ status: "provisional" });
    // The comment trailing --mac-second is not a note on --mac-third, but its tag carries on.
    expect(byName["--mac-third"]).toMatchObject({ status: "provisional", note: "" });
    expect(byName["--mac-fifth"]).toMatchObject({ status: "catalog" });
  });
});

describe("text the generator must not change", () => {
  it("keeps the whitespace inside a string literal of a default or a type", () => {
    const source = 'label  =\n    "two  spaces",\n  mode = `a\tb`';
    expect(collapseWhitespace(source)).toBe('label = "two  spaces", mode = `a\tb`');
    expect(squash(source)).toBe(collapseWhitespace(source));
  });

  it("keeps consecutive blank lines inside fenced code and reduces them in prose", () => {
    const page = "Prose.\n\n\n\nMore.\n\n```tsx\nconst a = 1;\n\n\nconst b = 2;\n```\n\n\nEnd.\n";
    expect(collapseBlankLines(page)).toBe(
      "Prose.\n\nMore.\n\n```tsx\nconst a = 1;\n\n\nconst b = 2;\n```\n\nEnd.\n",
    );
  });

  // The two tests below write a small source file and run the real readers and renderers on
  // it, because no component in the tree has a literal with two spaces or an example that
  // quotes Markdown.
  const scratch = () => mkdtempSync(path.join(tmpdir(), "macalicious-agent-docs-"));

  it("writes a literal's whitespace into the props table, for a prop, a method and a default", () => {
    const dir = scratch();
    try {
      const file = path.join(dir, "fixture.tsx");
      writeFileSync(
        file,
        [
          "export interface FixtureProps {",
          '  /** A mode. @default "two  spaces" */',
          '  mode?: "two  spaces"   |   "one";',
          '  onPick(value: "a  b",   index: number): void;',
          "}",
          'export function Fixture({ mode = "two  spaces" }: FixtureProps) {',
          "  return mode;",
          "}",
          "",
        ].join("\n"),
      );
      const [doc] = readModule(file).props;
      if (!doc) throw new Error("FixtureProps was not read");
      const table = renderPropsTable(doc, undefined);
      expect(table).toContain('| `mode` | `"two  spaces" \\| "one"` | `"two  spaces"` | no |');
      expect(table).toContain('| `onPick` | `(value: "a  b", index: number) => void` |');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes a template-literal type or default as inline code that still renders", () => {
    // One backtick cannot delimit text that contains one: the span would end inside the type.
    expect(code("plain")).toBe("`plain`");
    // The text of a template-literal type, built so that no string here looks like a template.
    const px = ["`$", "{number}px`"].join("");
    const percent = ["`$", "{number}%`"].join("");
    expect(code(px)).toBe(`\`\` ${px} \`\``);
    expect(code("a `` b ` c")).toBe("``` a `` b ` c ```");
    const dir = scratch();
    try {
      const file = path.join(dir, "fixture.tsx");
      writeFileSync(
        file,
        [
          "export interface FixtureProps {",
          "  /** A length. @default `4px` */",
          `  inset?: ${px} | ${percent};`,
          "}",
          "export function Fixture({ inset = `4px` }: FixtureProps) {",
          "  return inset;",
          "}",
          "",
        ].join("\n"),
      );
      const [doc] = readModule(file).props;
      if (!doc) throw new Error("FixtureProps was not read");
      const row = renderPropsTable(doc, undefined)
        .split("\n")
        .find((line) => line.includes("inset"));
      // As CommonMark reads the row: a code span opens at a run of backticks and closes at the
      // next run of the same length; one space of padding on each side is dropped.
      const spans = [...(row ?? "").matchAll(/(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)/g)].map(
        (match) => (match[2] as string).replace(/^ (.*) $/, "$1"),
      );
      // Name, type and default; a description may add spans of its own after them.
      expect(spans.slice(0, 3)).toEqual(["inset", `${px} \\| ${percent}`, "`4px`"]);
      expect(row).toContain(`| \`inset\` | ${cell(`${px} | ${percent}`)} | ${cell("`4px`")} |`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reads a component's modules in its subfolders, and not its examples or tests", () => {
    const root = scratch();
    try {
      const dir = path.join(root, "nested-fixture");
      const write = (file: string, lines: string[]) => {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), `${lines.join("\n")}\n`);
      };
      write("index.ts", [
        'export { NestedFixture } from "./nested-fixture";',
        'export type { NestedFixtureProps } from "./parts/props";',
      ]);
      write("nested-fixture.tsx", [
        'import type { NestedFixtureProps } from "./parts/props";',
        "/** A fixture. */",
        'export function NestedFixture({ tone = "quiet", size = "m" }: NestedFixtureProps) {',
        "  return <span data-tone={tone} data-size={size} />;",
        "}",
      ]);
      write("parts/props.ts", [
        'export type Tone = "quiet" | "loud";',
        "export interface NestedFixtureProps {",
        '  /** How loud. @default "quiet" */',
        "  tone?: Tone;",
        "  /** How large: its default is written only where the component destructures it. */",
        '  size?: "s" | "m";',
        "}",
      ]);
      // Another type of the same name with a default: not NestedFixtureProps, so not its default.
      write("parts/other.tsx", [
        "interface NestedFixtureProps {",
        "  size?: string;",
        "}",
        'export function Other({ size = "wrong" }: NestedFixtureProps) {',
        "  return size;",
        "}",
      ]);
      write("parts/props.test.ts", ["export interface NestedFixtureProps { wrong: true }"]);
      write("parts/types.d.ts", ["export interface NestedFixtureProps { wrong: true }"]);
      write("examples/basic.tsx", ["export default function Basic() {", "  return null;", "}"]);
      write("__tests__/helper.ts", ["export interface NestedFixtureProps { wrong: true }"]);
      write(".view/scratch.ts", ["export interface NestedFixtureProps { wrong: true }"]);

      expect(
        sourceFiles(dir).map((file) => path.relative(dir, file).split(path.sep).join("/")),
      ).toEqual(["index.ts", "nested-fixture.tsx", "parts/other.tsx", "parts/props.ts"]);
      const reported: Problem[] = [];
      const page = { title: "Nested fixture", description: "A fixture.", file: dir } as PageMeta;
      const doc = readComponent("nested-fixture", page, {}, (p) => reported.push(p), root);
      expect(reported.filter((problem) => problem.level === "error")).toEqual([]);
      expect(doc.props.map((props) => props.name)).toEqual(["NestedFixtureProps"]);
      expect(doc.props[0]?.props.map((prop) => [prop.name, prop.type, prop.defaultValue])).toEqual([
        ["tone", "Tone", '"quiet"'],
        // Read from nested-fixture.tsx, which imports the props type and destructures it.
        ["size", '"s" | "m"', '"m"'],
      ]);
      expect(
        propsTables(dir)
          .get("NestedFixtureProps")
          ?.props.map((p) => p.defaultValue),
      ).toEqual(['"quiet"', '"m"']);
      expect(doc.types.Tone).toContain('"quiet" | "loud"');
      expect(doc.hooks.attributes["data-tone"]).toBeDefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reads each exported props type from the module its export leads to", () => {
    const root = scratch();
    try {
      const dir = path.join(root, "twin");
      const write = (file: string, lines: string[]) => {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), `${lines.join("\n")}\n`);
      };
      // Two modules each declare ItemProps and Tone; index.ts exports both props types under
      // other names, one of them through a chain of re-exports.
      write("index.ts", [
        'export { Twin } from "./twin.js";',
        'export type { ItemProps as TwinRowProps } from "./rows/item";',
        'export type { TwinCellProps, TwinProps } from "./parts";',
      ]);
      write("twin.tsx", [
        'import type { TwinProps } from "./parts/props";',
        "/** A fixture. */",
        "export function Twin({ label }: TwinProps) {",
        "  return <span>{label}</span>;",
        "}",
      ]);
      write("parts/index.ts", [
        'import type { ItemProps } from "../cells/item.js";',
        'export * from "./props.js";',
        "export type { ItemProps as TwinCellProps };",
      ]);
      write("parts/props.ts", [
        'import type { Tone as CellTone } from "../cells/item";',
        "export interface TwinProps {",
        "  /** The text. */",
        "  label?: string;",
        "  /** The tone of every cell. */",
        "  cellTone?: CellTone;",
        "}",
      ]);
      write("cells/item.ts", [
        'export type Tone = "warm" | "cool";',
        "export interface ItemProps {",
        "  /** The tone of a cell. */",
        "  tone?: Tone;",
        "  /** The column. */",
        "  column: number;",
        "}",
      ]);
      write("rows/item.ts", [
        'export type Tone = "quiet" | "loud";',
        "export interface ItemProps {",
        "  /** The tone of a row. */",
        "  tone?: Tone;",
        "  /** The row. */",
        "  row: number;",
        "}",
      ]);
      write("examples/basic.tsx", ["export default function Basic() {", "  return null;", "}"]);

      const folder = readFolder(dir);
      const at = (name: string) => {
        const found = resolveExport(folder, path.join(dir, "index.ts"), name);
        return found && [path.relative(dir, found.file).split(path.sep).join("/"), found.local];
      };
      expect(at("TwinRowProps")).toEqual(["rows/item.ts", "ItemProps"]);
      expect(at("TwinCellProps")).toEqual(["cells/item.ts", "ItemProps"]);
      expect(at("TwinProps")).toEqual(["parts/props.ts", "TwinProps"]);
      expect(at("Twin")).toEqual(["twin.tsx", "Twin"]);
      expect(at("ItemProps")).toBeNull();

      const reported: Problem[] = [];
      const page = { title: "Twin", description: "A fixture.", file: dir } as PageMeta;
      const doc = readComponent("twin", page, {}, (p) => reported.push(p), root);
      expect(reported.filter((problem) => problem.level === "error")).toEqual([]);
      expect(doc.exports.find((entry) => entry.name === "Twin")?.description).toBe("A fixture.");
      const members = Object.fromEntries(
        doc.props.map((props) => [props.name, props.props.map((prop) => prop.name)]),
      );
      expect(members).toEqual({
        TwinRowProps: ["tone", "row"],
        TwinCellProps: ["tone", "column"],
        TwinProps: ["label", "cellTone"],
      });
      // Each table explains Tone as its own module defines it, also under an import's alias.
      const table = (name: string) => {
        const props = doc.props.find((entry) => entry.name === name);
        if (!props) throw new Error(`${name} was not read`);
        return renderPropsTable(props, doc);
      };
      expect(table("TwinRowProps")).toContain('- `Tone` = `"quiet" | "loud"`');
      expect(table("TwinRowProps")).not.toContain("warm");
      expect(table("TwinCellProps")).toContain('- `Tone` = `"warm" | "cool"`');
      expect(table("TwinCellProps")).not.toContain("quiet");
      expect(table("TwinProps")).toContain('- `CellTone` = `"warm" | "cool"`');

      // The site's props tables: the public names as above, and a declaration's own name.
      const tables = propsTables(dir);
      expect([...tables.keys()].sort()).toEqual([
        "ItemProps",
        "TwinCellProps",
        "TwinProps",
        "TwinRowProps",
      ]);
      expect(tables.get("TwinRowProps")?.props.map((prop) => prop.name)).toEqual(["tone", "row"]);
      expect(tables.get("TwinCellProps")?.props.map((prop) => prop.name)).toEqual([
        "tone",
        "column",
      ]);
      expect(tables.get("TwinCellProps")?.name).toBe("TwinCellProps");

      // An export that leaves the folder is reported. It is never documented from a
      // declaration that happens to have its name: not one of two (ItemProps), and not the
      // only one either (TwinProps), which may be an unrelated type.
      write("index.ts", [
        'export { Twin } from "./twin.js";',
        'export type { ItemProps } from "#elsewhere";',
        'export type { TwinProps } from "#elsewhere";',
      ]);
      const unfollowed: Problem[] = [];
      const guess = readComponent("twin", page, {}, (p) => unfollowed.push(p), root);
      expect(guess.props).toEqual([]);
      // Each is reported in index.ts, the file whose export cannot be followed.
      expect(unfollowed.filter((problem) => problem.level === "error")).toEqual([
        expect.objectContaining({
          where: expect.stringMatching(/twin\/index\.ts$/),
          message: expect.stringMatching(/^ItemProps is exported, but its export does not lead/),
        }),
        expect.objectContaining({
          where: expect.stringMatching(/twin\/index\.ts$/),
          message: expect.stringMatching(/^TwinProps is exported, but its export does not lead/),
        }),
      ]);
      // Nor does the site show such a name with the table of a declaration that has it.
      expect([...propsTables(dir).keys()]).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reads a props type a module declares and exports in a separate list", () => {
    const root = scratch();
    try {
      const dir = path.join(root, "listed");
      const write = (file: string, lines: string[]) => {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), `${lines.join("\n")}\n`);
      };
      write("index.ts", [
        'export { Listed } from "./listed";',
        'export type { ListedItemProps, ListedProps } from "./listed";',
      ]);
      // Nothing here carries `export` itself: the lists at the end make three names public.
      write("listed.tsx", [
        "interface ListedProps {",
        '  /** The text. @default "none" */',
        "  label?: string;",
        "  /** How many. */",
        "  count?: number;",
        "}",
        "type ItemProps = {",
        "  /** Which row. */",
        "  row: number;",
        "};",
        "interface HiddenProps {",
        "  secret: true;",
        "}",
        "interface PartProps {",
        "  /** Which part. */",
        "  part: string;",
        "}",
        "/** A fixture. */",
        'function Listed({ label = "none", count = 2 }: ListedProps) {',
        "  return <span data-count={count}>{label}</span>;",
        "}",
        "export { Listed };",
        "export type { ListedProps, ItemProps as ListedItemProps, PartProps };",
      ]);
      write("examples/basic.tsx", ["export default function Basic() {", "  return null;", "}"]);

      const reported: Problem[] = [];
      const page = { title: "Listed", description: "A fixture.", file: dir } as PageMeta;
      const doc = readComponent("listed", page, {}, (p) => reported.push(p), root);
      expect(reported.filter((problem) => problem.level === "error")).toEqual([]);
      expect(
        Object.fromEntries(
          doc.props.map((props) => [props.name, props.props.map((prop) => prop.name)]),
        ),
      ).toEqual({ ListedItemProps: ["row"], ListedProps: ["label", "count"] });
      // Defaults reach a list-exported type like any other: the JSDoc's, then the code's.
      expect(
        doc.props.find((props) => props.name === "ListedProps")?.props.map((p) => p.defaultValue),
      ).toEqual(['"none"', "2"]);
      // The site's tables: what index.ts exports, and PartProps, which only the module
      // exports. HiddenProps is exported by nothing, so it has no table.
      const tables = propsTables(dir);
      expect([...tables.keys()].sort()).toEqual(["ListedItemProps", "ListedProps", "PartProps"]);
      expect(tables.get("ListedItemProps")?.name).toBe("ListedItemProps");

      // A declaration that is public only through a list is still never found by its name:
      // a module that does not list it does not export it.
      write("index.ts", [
        'export { Listed } from "./listed";',
        'export type { HiddenProps, ShapeProps } from "./listed";',
      ]);
      write("listed.tsx", [
        "interface HiddenProps {",
        "  secret: true;",
        "}",
        "/** Not an interface or a type alias, so there are no props to read. */",
        "export class ShapeProps {}",
        "/** A fixture. */",
        "export function Listed(props: Partial<HiddenProps>) {",
        "  return <span>{String(props.secret)}</span>;",
        "}",
      ]);
      const refused: Problem[] = [];
      const none = readComponent("listed", page, {}, (p) => refused.push(p), root);
      expect(none.props).toEqual([]);
      // The unfollowed export is reported in index.ts; the one that leads to a declaration
      // without props, in the file that declares it.
      expect(refused.filter((problem) => problem.level === "error")).toEqual([
        expect.objectContaining({
          where: expect.stringMatching(/listed\/index\.ts$/),
          message: expect.stringMatching(/^HiddenProps is exported, but its export does not lead/),
        }),
        expect.objectContaining({
          where: expect.stringMatching(/listed\/listed\.tsx$/),
          message: expect.stringMatching(
            /^ShapeProps is exported by index\.ts, but ShapeProps is not declared as an interface/,
          ),
        }),
      ]);
      expect([...propsTables(dir).keys()]).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports a wildcard export of index.ts, and writes out the aliases an imported type names", () => {
    const root = scratch();
    try {
      const dir = path.join(root, "wild");
      const write = (file: string, lines: string[]) => {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), `${lines.join("\n")}\n`);
      };
      write("index.ts", [
        'export { Wild } from "./wild";',
        'export * from "./props";',
        'export * as Tones from "./tones";',
      ]);
      write("wild.tsx", [
        'import type { WildProps } from "./props";',
        "/** A fixture. */",
        "export function Wild({ tone }: WildProps) {",
        "  return <span data-tone={tone} />;",
        "}",
      ]);
      // The real src/lib file, and a file elsewhere that exports a type of the same name.
      const library = path
        .relative(dir, path.join(repoRoot, "src/lib/control-size"))
        .split(path.sep)
        .join("/");
      write("../elsewhere/control-size.ts", ['export type ControlSize = "huge";']);
      write("../elsewhere/other.ts", ['export type Other = "far";']);
      write("props.ts", [
        'import type { Borrowed, Boxed, Edge, Escaped, Keyed, Made } from "./tones";',
        'import type { Mapped, Sized, Tone } from "./tones";',
        'import type { API, Box, Chosen, Framed, Leak, Listed, Mixed, Veiled } from "./tones";',
        `import type { ControlSize } from "${library}";`,
        'import type { ControlSize as OtherSize } from "../elsewhere/control-size";',
        "/** Not the BaseTone that Tone is made of. */",
        'export type BaseTone = "unrelated";',
        // Not exported, and not what tones.ts means by these names.
        'type Hidden = "mine";',
        "interface Other {",
        "  near: true;",
        "}",
        "interface Frame {",
        "  mine: true;",
        "}",
        "export type Uses = Hidden | Other | Frame | Box<API | Chosen | Framed | Listed>;",
        "export type More = Mixed | Veiled;",
        "export interface WildProps {",
        "  /** The tone. */",
        "  tone?: Tone;",
        "  /** The edge. */",
        "  edge?: Edge;",
        "  /** A size. */",
        "  size?: Sized;",
        "  /** A box. */",
        "  box?: Boxed;",
        "  /** The shared size. */",
        "  scale?: ControlSize;",
        "  /** Not the shared size, although it has its name where it is declared. */",
        "  other?: OtherSize;",
        "  /** Another type of this module, under a name the imported ones use too. */",
        "  base?: BaseTone;",
        "}",
      ]);
      // The text of a template-literal type, built so that no string here looks like a template.
      const sized = (inner: string) => ["`$", "{", inner, "}-size`"].join("");
      write("tones.ts", [
        'export type BaseTone = "quiet" | "loud";',
        "export type Tone = BaseTone;",
        'export type Edge = BaseTone | "none" | { BaseTone: "BaseTone" };',
        `export type Sized = ${sized("BaseTone")};`,
        "export type Box<T> = { value: T };",
        'export type Boxed = Box<"quiet"> | BaseTone;',
        "export type Loop = Loop[] | BaseTone;",
        // BaseTone is the mapped type's own key here, not the alias.
        'export type Mapped = { [BaseTone in "x"]: BaseTone };',
        // An escaped interpolation is text; braces inside one are more than this reader takes apart.
        `export type Escaped = ${["`\\$", "{BaseTone}`"].join("")};`,
        `export type Keyed = ${sized("keyof { value: BaseTone }")};`,
        // A value and an alias of one name: typeof means the value.
        'export const Shade = "dark";',
        'export type Shade = "quiet";',
        "export type Borrowed = typeof Shade;",
        // BaseTone is the function type's own parameter here, behind a nested type argument.
        "export type Made = <BaseTone extends Array<string>>() => BaseTone;",
        // An alias that is not exported is still what tones.ts means by the name.
        'type Hidden = "hush";',
        "export type Veiled = Hidden | BaseTone;",
        // A name that leads out of the folder, and one that comes from a package.
        'import type { Other } from "../elsewhere/other";',
        'import type { Frame } from "a-package";',
        'export type Mixed = Other | "x";',
        "export type Framed = Frame | BaseTone;",
        // A method and a property that have the names of types, and a global applied to one.
        "export type API = { Tone(): Tone; BaseTone?: BaseTone };",
        "export type Listed = ReadonlyArray<BaseTone>;",
        // The branch of a conditional type is a type, although a colon follows it.
        'export type Chosen = string extends string ? Tone : "fallback";',
        // A name that is a parameter in one place and may be a global in another.
        "export type Leak = { make: <Uses>() => Uses; other: Uses };",
        // The Fixed that Helper means would become the parameter Fixed once it is written out.
        "interface Fixed {",
        "  fixed: true;",
        "}",
        "type Helper = Fixed;",
        "export type Captured = <Fixed>() => Helper;",
        // The value Solid that Query means would become the parameter Solid.
        "export const Solid = { fixed: true } as const;",
        "type Query = typeof Solid;",
        "export type Seized = (Solid: string) => Query;",
      ]);
      // A module that has no Other, Frame or Box of its own.
      write("plain.ts", [
        'import type { Box, Boxed, Captured, Framed, Leak, Mixed, Seized } from "./tones";',
        "export type Plain = Box<Boxed | Captured | Framed | Leak | Mixed | Seized>;",
      ]);
      // The same Frame as tones.ts, and another type of the package under the same name.
      write("same.ts", [
        'import type { Frame } from "a-package";',
        'import type { Framed } from "./tones";',
        "export type Same = Frame | Framed;",
      ]);
      // A module with a value Shade of its own, and one that imports the Shade of tones.ts.
      write("shade.ts", [
        'import type { Borrowed } from "./tones";',
        'export const [Shade] = ["mine"];',
        "export type Shaded = Borrowed;",
      ]);
      write("shared-shade.ts", [
        'import { type Borrowed, Shade } from "./tones";',
        "export const shade = Shade;",
        "export type Shaded = Borrowed;",
      ]);
      write("renamed.ts", [
        'import type { Border as Frame } from "a-package";',
        'import type { Framed } from "./tones";',
        "export type Renamed = Frame | Framed;",
      ]);
      // Two wildcards that lead to different declarations of one name export neither.
      write("both.ts", ['export * from "./props";', 'export * from "./tones";']);
      // A wildcard that is ambiguous about a name does not hide it from the next wildcard,
      // which reaches one of those same declarations by name.
      write("named.ts", ['export type { BaseTone, Loop } from "./tones";']);
      write("after.ts", ['export * from "./both";', 'export * from "./named";']);
      write("loops.ts", ['import type { Loop } from "./tones";', "export type Mine = Loop;"]);
      write("examples/basic.tsx", ["export default function Basic() {", "  return null;", "}"]);

      const folder = readFolder(dir);
      const both = path.join(dir, "both.ts");
      const after = path.join(dir, "after.ts");
      const tones = path.join(dir, "tones.ts");
      expect(resolveExport(folder, both, "BaseTone")).toBeNull();
      expect(resolveExport(folder, both, "Tone")).toEqual({ file: tones, local: "Tone" });
      expect(resolveExport(folder, both, "default")).toBeNull();
      expect(resolveExport(folder, after, "BaseTone")).toEqual({ file: tones, local: "BaseTone" });
      expect(resolveExport(folder, after, "Loop")).toEqual({ file: tones, local: "Loop" });

      // Every alias is written out as tones.ts means it, although props.ts has a BaseTone and
      // a Hidden of its own: Tone, Edge, Veiled (whose Hidden is not exported), the template
      // literals of Sized and Keyed, and Chosen, whose Tone is the branch of a conditional
      // type. Only type references are rewritten: the method and the property of API keep
      // their names, and so does the text of Escaped, whose interpolation is escaped. A name
      // that is no alias stays (Box in Boxed, the global in Listed).
      // Left out rather than shown wrongly: Box itself, whose body names its own parameter;
      // Mapped and Made, which bind the name; and Mixed and Framed, whose Other and Frame
      // are not the Other and Frame of props.ts. Borrowed queries the value Shade, not the
      // alias of that name, so it keeps the name; props.ts has no Shade of its own. Leak is
      // left out because props.ts has a type Uses, which Leak binds but may also name.
      // ControlSize is read from the file of src/lib that the import names; the type of that
      // name from a file elsewhere (OtherSize) is not explained as if it were the shared one.
      const loud = '("quiet" | "loud")';
      expect(typesInScope(folder, path.join(dir, "props.ts"))).toEqual({
        Tone: '"quiet" | "loud"',
        Edge: `${loud} | "none" | { BaseTone: "BaseTone" }`,
        Sized: sized(loud),
        Keyed: sized(`keyof { value: ${loud} }`),
        Escaped: ["`\\$", "{BaseTone}`"].join(""),
        Boxed: `Box<"quiet"> | ${loud}`,
        Veiled: `"hush" | ${loud}`,
        API: `{ Tone(): ${loud}; BaseTone?: ${loud} }`,
        Listed: `ReadonlyArray<${loud}>`,
        Borrowed: "typeof Shade",
        Chosen: `string extends string ? ${loud} : "fallback"`,
        ControlSize: '"regular" | "small" | "mini"',
        BaseTone: '"unrelated"',
        Uses: "Hidden | Other | Frame | Box<API | Chosen | Framed | Listed>",
        More: "Mixed | Veiled",
      });
      // Where the names mean nothing else, the aliases that keep them are shown; a generic
      // alias never is, and neither are Captured and Seized, in which a type parameter or a
      // function parameter would capture a name.
      expect(typesInScope(folder, path.join(dir, "plain.ts"))).toEqual({
        Boxed: `Box<"quiet"> | ${loud}`,
        Framed: `Frame | ${loud}`,
        Leak: "{ make: <Uses>() => Uses; other: Uses }",
        Mixed: 'Other | "x"',
        Plain: "Box<Boxed | Captured | Framed | Leak | Mixed | Seized>",
      });
      // The same import of the same package is the same Frame; another import is not.
      expect(typesInScope(folder, path.join(dir, "same.ts"))).toEqual({
        Framed: `Frame | ${loud}`,
        Same: "Frame | Framed",
      });
      expect(typesInScope(folder, path.join(dir, "renamed.ts"))).toEqual({
        Renamed: "Frame | Framed",
      });
      // A value queried with typeof is held to the same rule: not shown beside another value
      // of that name, shown beside the same one (whose import brings the alias Shade too).
      expect(typesInScope(folder, path.join(dir, "shade.ts"))).toEqual({ Shaded: "Borrowed" });
      expect(typesInScope(folder, path.join(dir, "shared-shade.ts"))).toEqual({
        Borrowed: "typeof Shade",
        Shade: '"quiet"',
        Shaded: "Borrowed",
      });
      // The parser's references, not a scan of the text: a member name is never one.
      const api = readModule(tones).aliases.API;
      expect(api?.parts.filter((part) => typeof part !== "string")).toEqual([
        { name: "Tone" },
        { name: "BaseTone" },
      ]);
      // An imported alias that names itself has no written-out form either, so it is left out.
      expect(typesInScope(folder, path.join(dir, "loops.ts"))).toEqual({ Mine: "Loop" });

      const reported: Problem[] = [];
      const page = { title: "Wild", description: "A fixture.", file: dir } as PageMeta;
      const doc = readComponent("wild", page, {}, (p) => reported.push(p), root);
      // A wildcard is an error that names the file: what it exports is not on the page.
      expect(reported.filter((problem) => problem.level === "error")).toEqual([
        expect.objectContaining({
          where: expect.stringMatching(/wild\/index\.ts$/),
          message: expect.stringContaining('`export * from "./props"`'),
        }),
        expect.objectContaining({
          where: expect.stringMatching(/wild\/index\.ts$/),
          message: expect.stringContaining('`export * as Tones from "./tones"`'),
        }),
      ]);
      expect(doc.props).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("copies an example a page shows without rewriting the links or tags inside it", () => {
    const dir = scratch();
    try {
      const example = [
        "const text = `",
        "See [Home](/) and [Theming](/theming).",
        '<Box title="not a tag of the page" />',
        "`;",
        "export default function Quoted() {",
        "  return text;",
        "}",
      ].join("\n");
      mkdirSync(path.join(dir, "examples"));
      writeFileSync(path.join(dir, "examples/quoted.tsx"), `${example}\n`);
      const page = {
        path: "/fixture",
        file: path.join(dir, "fixture.mdx"),
        dir: path.relative(repoRoot, dir),
        markdown: "fixture.md",
      } as PageMeta;
      const theming = { path: "/theming", markdown: "theming.md" } as PageMeta;
      const reported: string[] = [];
      const context: RenderContext = {
        out: "fixture.md",
        pages: [page, theming],
        components: new Map(),
        propsByName: new Map(),
        propsOwner: new Map(),
        tokens: () => ({}),
        report: (problem) => reported.push(problem.message),
      };
      const body = convertBody(
        'Read [Theming](/theming).\n\n<Example name="quoted" />\n',
        context,
        {
          page,
        },
      );
      // The page's own link is rewritten; the example is the file, character for character.
      expect(body).toContain("Read [Theming](theming.md).");
      expect(fences(body).map((fence) => fence.code)).toEqual([`${example}\n`]);
      expect(reported).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("runtimeImports", () => {
  it("finds every runtime import and re-export, wherever it is written, and no type or comment", () => {
    const source = [
      'import { A } from "../a"; import { B } from "../b";',
      'import type { C } from "../c";',
      'import { type D } from "../d";',
      'import { type E, F } from "../e";',
      '// import { G } from "../g";',
      '/* import { H } from "../h"; */',
      "const text = 'import { I } from \"../i\";';",
      'export { J } from "../j"; export * from "../k";',
      'export type { L } from "../l";',
      'import "../m";',
      "export const value = [A, B, F, text];",
    ].join("\n");
    expect(runtimeImports("fixture.ts", source)).toEqual([
      "../a",
      "../b",
      "../e",
      "../j",
      "../k",
      "../m",
    ]);
  });
});

const emittedStyles = packageStylesheets().get("styles.css") ?? "";
/** Where a component's own rules begin in the emitted styles.css; -1 when it has none. */
const firstRule = (name: string) => emittedStyles.search(new RegExp(`\\.mac-${name}(?![a-z0-9-])`));

describe("Markdown export for coding agents", () => {
  it("reports every folder of src/components that has no index.ts, instead of skipping it", () => {
    const dir = path.join(repoRoot, "src/components");
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (existsSync(path.join(dir, entry.name, "index.ts"))) continue;
      const reported = problems.filter(
        (problem) =>
          problem.level === "error" &&
          problem.where === `src/components/${entry.name}` &&
          problem.message.includes("index.ts"),
      );
      expect(reported.length, `${entry.name} is reported`).toBe(1);
    }
  });

  // A folder that is still being written (no docs page or no example yet) is reported by
  // `npm run lint` and fails `npm run docs:build`; everything else must hold at all times.
  it("has no errors in any finished component folder", () => {
    const errors = problems.filter(
      (problem) => problem.level === "error" && !problem.unfinished && isEnforced(problem, only),
    );
    expect(formatProblems(errors)).toBe("");
  });

  it("indexes every component folder and every file it links", () => {
    const index = files.get("llms.txt") ?? "";
    for (const name of listComponents()) {
      expect(index, `llms.txt lists ${name}`).toContain(`(components/${name}.md)`);
      expect(files.has(`components/${name}.md`), `components/${name}.md is generated`).toBe(true);
    }
    const bundle = files.get("llms-full.txt") ?? "";
    for (const file of files.keys()) {
      if (file.endsWith(".md")) {
        expect(index, `llms.txt lists ${file}`).toContain(`(${file})`);
        expect(bundle, `llms-full.txt includes ${file}`).toContain(`<!-- ${file} -->`);
      }
    }
  });

  it("names a page's own file where the bundle links to a heading of that page", () => {
    // In its own file a page links to its headings by anchor alone; in the bundle, where
    // every page has a "Props" heading, that would lead to the first page's.
    const out = "components/box.md";
    expect(
      sectionLinks(
        "See [Props](#props) and `[code](#props)`.\n\n```md\n[fenced](#props)\n```\n",
        out,
      ),
    ).toBe(
      "See [Props](components/box.md#props) and `[code](#props)`.\n\n```md\n[fenced](#props)\n```\n",
    );
    const prose = (files.get("llms-full.txt") ?? "")
      .replace(/^```[\s\S]*?^```$/gm, "")
      .replace(/`[^`\n]*`/g, "");
    expect(prose).not.toMatch(/\]\(#/);
  });

  it("rewrites every anchor-only link destination, whatever syntax wrote it", () => {
    const out = "components/box.md";
    const cases: [string, string][] = [
      ["[Props](#props)", "[Props](components/box.md#props)"],
      ['[Props](#props "Properties")', '[Props](components/box.md#props "Properties")'],
      ["[Props](#props 'Properties')", "[Props](components/box.md#props 'Properties')"],
      ["[Props](<#props>)", "[Props](<components/box.md#props>)"],
      ["[Props]( #props )", "[Props]( components/box.md#props )"],
      ["[Props](\n#props)", "[Props](\ncomponents/box.md#props)"],
      ["[`size` prop](#props)", "[`size` prop](components/box.md#props)"],
      // A code span with backticks inside the link text: still a link, so it is rewritten.
      ["[example `x`](#props)", "[example `x`](components/box.md#props)"],
      ["[example `` a`b ``](#props)", "[example `` a`b ``](components/box.md#props)"],
      // Here the code span takes in the destination, so there is no link to rewrite.
      ["[example `x](#props)`", "[example `x](#props)`"],
      ["[*Props* ](#props)", "[*Props* ](components/box.md#props)"],
      ["[](#props)", "[](components/box.md#props)"],
      ["![Diagram](#figure)", "![Diagram](#figure)"],
      ["[Props][props]\n\n[props]: #props", "[Props][props]\n\n[props]: components/box.md#props"],
      ['[props]: <#props> "Properties"', '[props]: <components/box.md#props> "Properties"'],
      ["[a\\]b]:\n  #props", "[a\\]b]:\n  components/box.md#props"],
      [
        "| Prop | See |\n| --- | --- |\n| size | [Sizes](#sizes) |",
        "| Prop | See |\n| --- | --- |\n| size | [Sizes](components/box.md#sizes) |",
      ],
      ["> Read [Props](#props).", "> Read [Props](components/box.md#props)."],
      // A destination continued on the next line of a block quote or a list item.
      ["> [Props](\n> #props)", "> [Props](\n> components/box.md#props)"],
      ["> [props]:\n> #props", "> [props]:\n> components/box.md#props"],
      ["> > [Props](\n> > <#props>)", "> > [Props](\n> > <components/box.md#props>)"],
      ["- [Props](\n  #props)", "- [Props](\n  components/box.md#props)"],
      [
        "- [Props](#props)\n- [Other page](other.md#props)",
        "- [Props](components/box.md#props)\n- [Other page](other.md#props)",
      ],
      ["[Site](https://example.com/#props)", "[Site](https://example.com/#props)"],
    ];
    for (const [source, expected] of cases) {
      expect(sectionLinks(source, out), source).toBe(expected);
    }
  });

  it("leaves links inside code of every kind as written", () => {
    const out = "components/box.md";
    const unchanged = [
      // An indented code block.
      "Text.\n\n    [indented](#props)\n",
      // A fence inside a block quote, and one inside a list item.
      "> ```md\n> [quoted fence](#props)\n> ```\n",
      "- item\n\n  ~~~\n  [listed fence](#props)\n  ~~~\n",
      // A fence longer than three backticks that holds a shorter one.
      "````md\n```\n[nested](#props)\n```\n````\n",
      // A code span across several lines.
      "Write `[across\nlines](#props)` here.",
      // A code span that holds a shorter run of backticks.
      "Write `` [a`b](#props) `` here.",
      "Write ```[a``b](#props)``` here.",
      "Write `` x ` [a](#props) `` here.",
    ];
    for (const source of unchanged) expect(sectionLinks(source, out), source).toBe(source);
    expect(sectionLinks("`` a`b `` then [Props](#props)", out)).toBe(
      "`` a`b `` then [Props](components/box.md#props)",
    );
  });

  it("leaves escaped text that is not a link as written", () => {
    const out = "components/box.md";
    for (const source of [
      "\\[Props](#props)",
      "[Props\\](#props)",
      "\\[props]: #props",
      "[Props]\\(#props)",
    ]) {
      expect(sectionLinks(source, out), source).toBe(source);
    }
    expect(sectionLinks("\\[not a link] and [Props](#props)", out)).toBe(
      "\\[not a link] and [Props](components/box.md#props)",
    );
  });

  it("leaves no anchor-only link or definition in llms-full.txt", { timeout: 60_000 }, () => {
    const tree = fromMarkdown(files.get("llms-full.txt") ?? "", {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()],
    });
    const anchors: string[] = [];
    const visit = (node: { type: string; url?: string; children?: unknown[] }) => {
      if ((node.type === "link" || node.type === "definition") && node.url?.startsWith("#")) {
        anchors.push(node.url);
      }
      for (const child of node.children ?? []) visit(child as typeof node);
    };
    visit(tree);
    expect(anchors).toEqual([]);
  });

  it("only links to files that are generated", () => {
    for (const [file, content] of checkedFiles) {
      const prose = content.replace(/^```[\s\S]*?^```$/gm, "").replace(/`[^`\n]*`/g, "");
      for (const match of prose.matchAll(/\]\(([^)\s#]+\.(?:md|txt))(?:#[^)]*)?\)/g)) {
        const target = match[1] as string;
        if (/^[a-z]+:/i.test(target)) continue;
        const resolved = path.posix.join(path.posix.dirname(file), target);
        expect(files.has(resolved), `${file} links to ${target}`).toBe(true);
      }
    }
  });

  it("imports only what the package exports, in every code block", () => {
    const componentNames = new Set(listComponents());
    const libModules = new Set(listLibModules());
    const stylesheets = new Set(["styles.css", "tokens.css", "fallback-font.css"]);
    for (const [file, content] of checkedFiles) {
      for (const { lang, code } of fences(content)) {
        if (!["tsx", "ts", "jsx", "js"].includes(lang)) continue;
        for (const match of code.matchAll(
          /import\s+(?:type\s+)?(?:\{([^}]*)\}\s*from\s*)?["'](macalicious[^"']*)["']/g,
        )) {
          const specifier = match[2] as string;
          const names = (match[1] ?? "")
            .split(",")
            .map(
              (entry) =>
                entry
                  .trim()
                  .replace(/^type\s+/, "")
                  .split(/\s+as\s+/)[0] as string,
            )
            .filter(Boolean);
          const where = `${file}: import from "${specifier}"`;
          const sub = specifier.slice("macalicious/".length);
          let module: string | null = null;
          if (specifier === "macalicious") {
            for (const name of names) {
              const found = [...componentNames].some((component) =>
                exportedNames(`src/components/${component}/index.ts`).has(name),
              );
              expect(found, `${where}: ${name} is exported by a component`).toBe(true);
            }
            continue;
          }
          if (sub.endsWith(".css")) {
            const known = stylesheets.has(sub) || componentNames.has(sub.slice(0, -4));
            expect(known, `${where} is a shipped stylesheet`).toBe(true);
            continue;
          }
          if (sub.startsWith("lib/")) {
            expect(libModules.has(sub.slice(4)), `${where} is a helper module`).toBe(true);
            module = `src/${sub}.ts`;
          } else {
            expect(componentNames.has(sub), `${where} is a component`).toBe(true);
            module = `src/components/${sub}/index.ts`;
          }
          if (!existsSync(path.join(repoRoot, module))) continue;
          const exported = exportedNames(module);
          for (const name of names) {
            expect(exported.has(name), `${where}: ${name} is exported`).toBe(true);
          }
        }
      }
    }
  });
});

describe.each(
  components
    .filter((component) => !only || only.has(component.name))
    .map((component) => [component.name, component] as const),
)("components/%s.md", (name, component) => {
  const page = files.get(`components/${name}.md`) ?? "";
  const index = exportedNames(`src/components/${name}/index.ts`);

  it("names every export of index.ts in its import lines", () => {
    const imports = fences(page)[0]?.code ?? "";
    for (const exported of index) expect(imports, `${exported} is imported`).toContain(exported);
    expect(imports).toContain(`from "macalicious/${name}"`);
  });

  // A component restyles the parts it borrows with selectors of the same specificity, so its
  // stylesheet has to load after theirs: in the page's instructions and in dist/styles.css.
  it("puts the stylesheets of the components it imports before its own", () => {
    const imported = new Set<string>();
    for (const file of modulesOf(path.join(repoRoot, component.dir))) {
      for (const match of read(`${component.dir}/${file}`).matchAll(
        /^import\b(?!\s+type\b)[^;]*?from\s+"(?:\.\.\/)+([a-z0-9-]+)(?:\/[^"]*)?";/gm,
      )) {
        if (
          match[1] !== name &&
          existsSync(path.join(repoRoot, "src/components", match[1] as string))
        )
          imported.add(match[1] as string);
      }
    }
    const used = usedComponents(name);
    const listed = [...page.matchAll(/`"macalicious\/([a-z0-9-]+)\.css"`/g)].map(
      (match) => match[1] as string,
    );
    for (const other of imported) {
      expect(used, `${name} uses ${other}`).toContain(other);
      // In the stylesheet as emitted and minified, not only in the order asked for.
      if (firstRule(other) !== -1 && firstRule(name) !== -1) {
        expect(firstRule(other), `${other}'s rules precede ${name}'s in styles.css`).toBeLessThan(
          firstRule(name),
        );
      }
      if (!existsSync(path.join(repoRoot, `src/components/${other}/${other}.css`))) continue;
      expect(listed, `${other}.css is listed`).toContain(other);
      expect(listed.indexOf(other), `${other}.css is listed before ${name}.css`).toBeLessThan(
        listed.lastIndexOf(name),
      );
    }
  });

  it("documents every prop in the source with its type and default", () => {
    for (const propsName of [...index].filter((exported) => exported.endsWith("Props"))) {
      const source = propsFromText(name, propsName);
      expect(source, `${propsName} is declared in src/components/${name}`).not.toBeNull();
      const section = page.split(`### ${propsName}\n`)[1]?.split(/\n#{2,3} /)[0] ?? "";
      const rows = section.split("\n").filter((line) => line.startsWith("| `"));
      expect(rows.length, `${propsName}: one row per prop`).toBe(source?.length);
      for (const prop of source ?? []) {
        const row = rows.find((line) => line.startsWith(`| \`${prop.name}\` |`)) ?? "";
        const label = `${propsName}.${prop.name}`;
        expect(row, `${label} has a row`).not.toBe("");
        expect(row, `${label}: type`).toContain(`| \`${prop.name}\` | ${cell(prop.type)} |`);
        expect(row, `${label}: required`).toContain(`| ${prop.required ? "yes" : "no"} |`);
        // A literal default in the code is the truth; a computed one is described in prose.
        const literal =
          prop.codeDefault !== null && isLiteral(prop.codeDefault) ? prop.codeDefault : null;
        if (prop.jsdocDefault !== null && literal !== null) {
          expect(unquote(prop.jsdocDefault), `${label}: @default matches the code`).toBe(
            unquote(literal),
          );
        }
        const expected = prop.jsdocDefault ?? literal;
        expect(row, `${label}: default`).toContain(
          `| ${cell(prop.type)} | ${expected === null ? "–" : cell(expected)} |`,
        );
      }
    }
  });

  it("shows example files exactly as they are on disk, and all of them", () => {
    const shown = [
      ...page.matchAll(/^Example `([\w-]+)` \(`([^`]+)`\):\n\n```tsx\n([\s\S]*?)\n```$/gm),
    ];
    for (const [, example, file, code] of shown) {
      expect(file).toBe(`${component.dir}/examples/${example}.tsx`);
      expect(code, `${file} is copied verbatim`).toBe(read(file as string).trimEnd());
    }
    const names = new Set(shown.map((match) => match[1]));
    for (const example of component.examples) {
      if (example.name.startsWith("visual-")) {
        expect(page, `${example.file} is listed`).toContain(`\`${example.file}\``);
      } else {
        expect(names.has(example.name), `${example.file} is shown`).toBe(true);
      }
    }
  });
});
