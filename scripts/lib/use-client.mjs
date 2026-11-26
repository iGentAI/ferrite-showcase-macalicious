// The "use client" directive, from source to package.
//
// A component that uses state, effects or context opens with "use client", so that a React
// Server Components framework (the Next.js App Router, for one) renders it as a client
// component when a server component imports it. A bundler drops a module's directives when it
// merges modules into a chunk, so the library build writes the directive back at the top of
// every built file that holds such a module (vite.config.ts), and the package check reads the
// built files' source maps to prove that none was missed (scripts/check-package.mjs).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { sourceMapOf } from "./built-sources.mjs";

export const CLIENT_DIRECTIVE = '"use client";';

/**
 * Whether JavaScript or TypeScript code has "use client" in its directive prologue: the
 * statements a file starts with that are each a string literal and nothing else. Comments may
 * come before, between and after them, a semicolon is optional where the language inserts
 * one, and the same text further down, or as part of a longer expression, is not a directive.
 * A parser decides what a statement is, the one the registry and the docs already use; a
 * pattern cannot (a comment after the string, or a line break followed by a parenthesis,
 * changes the answer). `fileName` tells the parser the language; code that does not parse is
 * an error.
 */
export function hasUseClient(code, fileName = "file.tsx") {
  // Not even the words: no need to parse.
  if (!code.includes("use client")) return false;
  const { program, errors } = parseSync(fileName, code);
  if (errors.length > 0) {
    throw new Error(`${fileName} does not parse: ${errors[0].message}`);
  }
  for (const statement of program.body) {
    // The parser gives a directive its raw text: with an escape in it ("use\x20client") it
    // is a different directive.
    if (statement.type !== "ExpressionStatement" || typeof statement.directive !== "string") {
      return false;
    }
    if (statement.directive === "use client") return true;
  }
  return false;
}

const cache = new Map();

/**
 * Whether the source file behind a module id opens with the directive. The file is read every
 * time and the answer is kept only for the same contents, so a build that watches the sources
 * sees a directive that is added, removed or replaced, whatever the file's time and size say.
 */
export function isClientModule(id) {
  const file = id.split("?")[0];
  if (!path.isAbsolute(file) || !existsSync(file)) return false;
  const code = readFileSync(file, "utf8");
  const known = cache.get(file);
  if (known?.code === code) return known.client;
  const client = hasUseClient(code, file);
  cache.set(file, { code, client });
  return client;
}

/**
 * Whether a name in a source map's "sources" is the bundler's own and not a file: a virtual
 * module (its id holds a NUL character) or a name with a scheme ("rolldown:runtime"). Such a
 * source has no file to read and is not a component's code. A Windows drive letter is one
 * character before the colon, so it is not taken for a scheme.
 */
const isVirtualSource = (name) => name.includes("\0") || /^[a-z][a-z0-9+.-]+:/i.test(name);

/**
 * The built JavaScript files under `dist` that hold a client module and do not open with the
 * directive, each with the source that needs it; how many files do open with it; and the
 * files that cannot be checked: those that hold code and have no source map, and those whose
 * source map names a source file that does not exist (a stale or wrongly placed map says
 * nothing about what the file holds, so it must not pass).
 */
export function clientDirectiveReport(dist) {
  const missing = [];
  const unreadable = [];
  let marked = 0;
  for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const file = path.join(entry.parentPath, entry.name);
    let map;
    try {
      map = sourceMapOf(file);
    } catch (error) {
      unreadable.push({ file, reason: error.message });
      continue;
    }
    const sources = (map?.sources ?? [])
      .filter((name) => !isVirtualSource(name))
      .map((name) => path.resolve(path.dirname(file), map.sourceRoot ?? "", name));
    const absent = sources.filter((candidate) => !existsSync(candidate));
    if (absent.length > 0) {
      unreadable.push({
        file,
        reason: `${file}: its source map names ${absent.length} source file(s) that do not exist (${absent.join(", ")}), so whether it needs "use client" cannot be told; build again, or check where the map is`,
      });
      continue;
    }
    const source = sources.find((candidate) => isClientModule(candidate));
    if (!source) continue;
    if (hasUseClient(readFileSync(file, "utf8"), file)) marked++;
    else missing.push({ file, source });
  }
  return { missing, marked, unreadable };
}
