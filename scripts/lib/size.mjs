// The size of the JavaScript the built package holds: of each component's own code, of each
// helper that is counted once, and of what a page loads.
//
// The bundler gives every component a chunk and moves what two entries share into chunks of
// its own, so an entry's code is the entry file plus the local files it imports, statically or
// with import(). Whose a piece of built code is, is read from the source maps, source file by
// source file. For the component being measured, a piece of code is one of four things:
//
// - its own: a source under src/components/<name>/. Charged to it.
// - another component's: a source under another component's folder. Not charged: it is
//   measured, and held to the budget, under the component it belongs to. A chunk made only
//   of other components' sources is left out, and what it imports is not followed; code in it
//   that the source map gives no source for is still charged (see "anything else").
// - a shared helper: a file named in scripts/lib/shared-helpers.mjs that the own code of two
//   components or more reaches in this build. Not charged: it is measured once, under its own
//   name, against the same budget.
// - anything else: a helper in src/lib that is not on that list, or is on it and has one
//   user; a source outside src/; code the source map gives no source for. Charged, in full,
//   to every component whose own code reaches it. A doubt makes a figure larger, never
//   smaller. This holds in a file made only of shared helpers too: what the source map gives
//   no source for there is charged to every component that reaches the file, except the
//   lines that only join files together (imports, lists of exports, directives, comments).
//
// A chunk that holds other components' sources and helpers, and none of the measured
// component's own, is entered when one of the names imported from it is not declared in
// another component's source. A name whose origin cannot be told counts as a helper's.
//
// A built file with code and no source map stops the measurement with an error, and so does
// an import of a local file that is not in the build: the figures would be of a package that
// cannot load.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { parseSync } from "oxc-parser";
import { decodeMappings, sourceMapOf, sourcesOf, withoutSources } from "./built-sources.mjs";
import { SHARED_HELPERS } from "./shared-helpers.mjs";

/** Everything a file exports, as opposed to a set of names. */
const ALL = "*";

/** The component whose folder a source file is in, or undefined. */
function componentOf(source, root) {
  const relative = path.relative(path.join(root, "src/components"), source);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return relative.split(path.sep)[0];
}

/**
 * The local files a built file asks for: imports, re-exports and import() of a literal path.
 * A parser reads them, so the text of an import inside a string or a comment is not one.
 * For each file: the `names` taken from it, or ALL; the `locals` those names are bound to in
 * this file; the offsets of the import() calls (`dynamic`); and whether some request names
 * nothing that could be looked for in the code (`opaque`: an import for its effects, or a
 * re-export).
 */
function requestsOf(file, code, module) {
  const wanted = new Map();
  const want = (request, name) => {
    if (!request.startsWith(".")) return undefined;
    const target = path.resolve(path.dirname(file), request);
    let asked = wanted.get(target);
    if (!asked) {
      asked = { names: new Set(), locals: new Set(), dynamic: [], opaque: false };
      wanted.set(target, asked);
    }
    if (name === ALL || asked.names === ALL) asked.names = ALL;
    else asked.names.add(name);
    return asked;
  };
  const nameOf = (imported) =>
    imported.kind === "Name" ? imported.name : imported.kind === "Default" ? "default" : ALL;
  for (const item of module.staticImports) {
    // `import "./file.js"` runs the whole file.
    if (item.entries.length === 0) {
      const asked = want(item.moduleRequest.value, ALL);
      if (asked) asked.opaque = true;
    }
    for (const entry of item.entries) {
      const asked = want(item.moduleRequest.value, nameOf(entry.importName));
      if (!asked) continue;
      if (entry.localName?.value) asked.locals.add(entry.localName.value);
      else asked.opaque = true;
    }
  }
  for (const item of module.staticExports) {
    for (const entry of item.entries) {
      if (!entry.moduleRequest) continue;
      const asked = want(entry.moduleRequest.value, nameOf(entry.importName));
      if (asked) asked.opaque = true;
    }
  }
  for (const item of module.dynamicImports) {
    const request = literalText(code.slice(item.moduleRequest.start, item.moduleRequest.end));
    const asked = request === undefined ? undefined : want(request, ALL);
    if (asked) asked.dynamic.push(item.start);
  }
  return wanted;
}

/**
 * The text a piece of code stands for when it is a string literal or a template literal
 * without expressions, with its escapes decoded; undefined for anything else (a path worked
 * out when the code runs cannot be followed).
 */
function literalText(text) {
  const { program, errors } = parseSync("request.js", `(${text});`);
  const expression = errors.length === 0 ? program.body[0]?.expression : undefined;
  const node = expression?.type === "ParenthesizedExpression" ? expression.expression : expression;
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

/**
 * `code` with the lines that only join files together blanked, every other character where it
 * was: imports, re-exports and lists of exports, directives, and comments. None of it is code
 * a helper or a component wrote.
 */
function withoutLinkage(code, program, comments) {
  const spans = [...comments];
  for (const statement of program.body) {
    if (
      statement.type === "ImportDeclaration" ||
      statement.type === "ExportAllDeclaration" ||
      (statement.type === "ExportNamedDeclaration" && !statement.declaration) ||
      (statement.type === "ExpressionStatement" && typeof statement.directive === "string")
    ) {
      spans.push(statement);
    }
  }
  let text = code;
  for (const { start, end } of spans) {
    text = text.slice(0, start) + code.slice(start, end).replace(/[^\n]/g, " ") + text.slice(end);
  }
  return text;
}

/**
 * Where a built file refers to the identifiers `names`, read from the syntax tree, so a string
 * or a comment that holds a name is not a use of it: `uses` is name to the offsets of its
 * references, outside import declarations and re-exports of another file. `bound` holds the
 * names the file also declares somewhere (a parameter, a variable, a function): a reference to
 * such a name may be to that declaration and not to the import.
 */
function referencesTo(program, names) {
  const uses = new Map();
  const bound = new Set();
  const visit = (node, binding) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, binding);
      return;
    }
    if (typeof node.type !== "string") return;
    switch (node.type) {
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "BreakStatement":
      case "ContinueStatement":
      case "MetaProperty":
        return;
      case "ExportNamedDeclaration":
        if (node.source) return;
        visit(node.declaration, false);
        for (const specifier of node.specifiers) visit(specifier.local, false);
        return;
      case "Identifier":
        if (!names.has(node.name)) return;
        if (binding) bound.add(node.name);
        else uses.set(node.name, [...(uses.get(node.name) ?? []), node.start]);
        return;
      case "VariableDeclarator":
        visit(node.id, true);
        visit(node.init, false);
        return;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        visit(node.id, true);
        visit(node.params, true);
        visit(node.body, false);
        return;
      case "ClassDeclaration":
      case "ClassExpression":
        visit(node.id, true);
        visit(node.superClass, false);
        visit(node.body, false);
        return;
      case "CatchClause":
        visit(node.param, true);
        visit(node.body, false);
        return;
      case "AssignmentPattern":
        visit(node.left, binding);
        visit(node.right, false);
        return;
      case "Property":
        if (node.computed) visit(node.key, false);
        visit(node.value, binding);
        return;
      case "MemberExpression":
        visit(node.object, false);
        if (node.computed) visit(node.property, false);
        return;
      case "MethodDefinition":
      case "PropertyDefinition":
      case "AccessorProperty":
        if (node.computed) visit(node.key, false);
        visit(node.value, false);
        return;
      case "LabeledStatement":
        visit(node.body, false);
        return;
      default:
        for (const value of Object.values(node)) visit(value, binding);
    }
  };
  visit(program.body, false);
  return { uses, bound };
}

/** Where in a built file each name it exports is declared: name to offset, where known. */
function exportOrigins(program) {
  const declared = new Map();
  const origins = new Map();
  const declare = (node, exported) => {
    if (!node) return;
    if (node.type === "VariableDeclaration") {
      for (const declarator of node.declarations) {
        if (declarator.id.type !== "Identifier") continue;
        declared.set(declarator.id.name, declarator.start);
        if (exported) origins.set(declarator.id.name, declarator.start);
      }
    } else if (
      (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") &&
      node.id
    ) {
      declared.set(node.id.name, node.start);
      if (exported) origins.set(node.id.name, node.start);
    }
  };
  for (const statement of program.body) {
    if (statement.type === "ExportNamedDeclaration") declare(statement.declaration, true);
    else declare(statement, false);
  }
  for (const statement of program.body) {
    if (statement.type === "ExportNamedDeclaration" && !statement.source) {
      for (const specifier of statement.specifiers) {
        const origin = declared.get(specifier.local.name);
        const name = specifier.exported.name ?? specifier.exported.value;
        if (origin !== undefined) origins.set(name, origin);
      }
    } else if (statement.type === "ExportDefaultDeclaration") {
      const { declaration } = statement;
      const origin =
        declaration.type === "Identifier" ? declared.get(declaration.name) : declaration.start;
      if (origin !== undefined) origins.set("default", origin);
    }
  }
  return origins;
}

/** The index of the source the code at `offset` comes from, or -1 when the map does not say. */
function sourceAt(code, mappings, offset) {
  const before = code.slice(0, offset).split("\n");
  const column = before[before.length - 1].length;
  const segments = mappings[before.length - 1] ?? [];
  let found = -1;
  for (const segment of segments) {
    if (segment.column > column) break;
    found = segment.source;
  }
  return found;
}

/** Reads each built file once: its code, source map, sources and what it asks for. */
function builtFiles() {
  const known = new Map();
  return (file) => {
    let built = known.get(file);
    if (!built) {
      const code = readFileSync(file, "utf8");
      const map = sourceMapOf(file);
      const result = parseSync(file, code);
      if (result.errors.length > 0) {
        throw new Error(`${file} does not parse: ${result.errors[0].message}`);
      }
      built = {
        file,
        code,
        map,
        sources: sourcesOf(file, map),
        program: result.program,
        comments: result.comments,
        requests: requestsOf(file, code, result.module),
        gzip: gzipSync(code).length,
      };
      known.set(file, built);
    }
    return built;
  };
}

/**
 * Component `name`'s own code, starting from its entry: the parts charged to it, the
 * components whose code it uses, and the listed helpers its own code reaches. `shared` holds
 * the listed helpers that are counted once in this build; `listed` all of them.
 *
 * A chunk that also holds another component's code asks for files on that component's behalf
 * too. What such a chunk asks for is followed when the measured component's side of it uses
 * what is imported (a reference to a name bound by the import is in the code that is not the
 * other component's, or the import() call is in that code), and not when only the other
 * component's side does. Where that cannot be told (an import for its effects, a re-export,
 * a name the chunk also declares itself, a use in code the source map gives no source for),
 * the file is followed, and charged, unless `strict`:
 * counting the users of a listed helper takes proof, so there a doubt does not make a user.
 */
function walk(name, root, read, listed, shared, strict = false) {
  const parts = [];
  const uses = new Set();
  const reached = new Set();
  const counted = new Set();
  const strays = new Set();
  // Code the source map gives no source for, in a file that is otherwise left out: not known
  // to be anybody's, so it is charged here. The lines that join files together are not code.
  const chargeStray = (built, left) => {
    if (strays.has(built.file) || !built.map) return;
    strays.add(built.file);
    const stray = withoutSources(
      withoutLinkage(built.code, built.program, built.comments),
      built.map,
      left,
    )
      .split("\n")
      .map((text) => text.trim())
      .filter(Boolean)
      .join("\n");
    if (stray) parts.push({ file: built.file, code: stray, shared: true, stray: true });
  };
  const visit = (file, imported, from) => {
    if (counted.has(file)) return;
    if (!existsSync(file)) throw missingFile(file, from, root);
    const built = read(file);
    const { code, map, sources, program, requests } = built;
    const owners = sources.map((source) => componentOf(source, root));
    const isForeign = (index) => owners[index] !== undefined && owners[index] !== name;
    const foreign = owners.filter((_, index) => isForeign(index));
    for (const owner of foreign) uses.add(owner);
    if (foreign.length > 0 && !owners.includes(name)) {
      // Another component's chunk: its code is not counted, and what it imports is not
      // followed, because that is the other component's to account for.
      if (foreign.length === owners.length) {
        chargeStray(built, () => true);
        return;
      }
      // It holds helpers as well. They count when one of the names taken from the chunk is
      // not the other component's. A later import of the same chunk may ask for more, so a
      // chunk left out here is looked at again.
      const origins = exportOrigins(program);
      const mappings = decodeMappings(map.mappings);
      const takesHelper =
        imported === ALL ||
        [...imported].some((item) => {
          const origin = origins.get(item);
          if (origin === undefined) return true;
          const source = sourceAt(code, mappings, origin);
          return source === -1 || !isForeign(source);
        });
      if (!takesHelper) {
        chargeStray(built, () => true);
        return;
      }
    }
    counted.add(file);
    // Counted from here on with everything that has no source, so not as a stray as well.
    if (strays.has(file)) {
      const kept = parts.filter((part) => !(part.stray && part.file === file));
      parts.length = 0;
      parts.push(...kept);
    }
    strays.add(file);
    const mixed = foreign.length > 0;
    // In a chunk shared with another component nothing says who uses a helper bundled into
    // it, so it makes nobody a user (measureSizes does not count such a helper once at all).
    if (!mixed) for (const source of sources) if (listed.has(source)) reached.add(source);
    const isShared = (index) => shared.has(sources[index]);
    const left = (index) => isForeign(index) || isShared(index);
    const leftOut = sources.some((_, index) => left(index));
    const allShared = sources.length > 0 && sources.every((_, index) => isShared(index));
    if (allShared) {
      // A file made of nothing but shared helpers: their code is theirs. Code the source map
      // gives no source for is not known to be theirs, so it is charged here, as anywhere
      // else; only the lines that join files together are left out.
      strays.delete(file);
      chargeStray(built, left);
    } else {
      parts.push({
        file,
        code: leftOut ? withoutSources(code, map, left) : code,
        shared: leftOut,
      });
    }
    let mappings;
    // Whose side of the chunk the code at `offset` is on: the measured component's for
    // certain ("own"), the other component's ("foreign"), or not said by the source map
    // ("unmapped").
    const sideOf = (offset) => {
      mappings ??= decodeMappings(map.mappings);
      const source = sourceAt(code, mappings, offset);
      return source === -1 ? "unmapped" : isForeign(source) ? "foreign" : "own";
    };
    const askedBy = (asked) => {
      if (asked.opaque) return "unknown";
      const { uses, bound } = referencesTo(program, asked.locals);
      let doubt = false;
      for (const [local, offsets] of uses) {
        const sides = offsets.map(sideOf);
        // A use in this component's own code, of a name nothing else in the chunk declares.
        if (sides.includes("own") && !bound.has(local)) return "own";
        // A use in its own code that may be of another declaration, or a use in code without
        // a source: this side may be the one that asks, and nothing proves it.
        if (sides.some((side) => side !== "foreign")) doubt = true;
      }
      const dynamic = asked.dynamic.map(sideOf);
      if (dynamic.includes("own")) return "own";
      if (doubt || dynamic.includes("unmapped")) return "unknown";
      return asked.locals.size > 0 || asked.dynamic.length > 0 ? "foreign" : "unknown";
    };
    for (const [target, asked] of requests) {
      if (mixed) {
        const by = askedBy(asked);
        if (by === "foreign" || (by === "unknown" && strict)) continue;
      }
      visit(target, asked.names, file);
    }
  };
  visit(path.join(root, "dist/components", `${name}.js`), ALL, undefined);
  return { parts, uses: [...uses].sort(), reached };
}

/** The error for a local file a built file imports and the build does not hold. */
function missingFile(file, from, root) {
  const relative = (target) => path.relative(root, target).split(path.sep).join("/");
  return new Error(
    from
      ? `${relative(from)} imports ${relative(file)}, which is not in the build, so what it loads cannot be measured; run the library build again`
      : `${relative(file)} is not in the build`,
  );
}

/** Every built file an entry loads, itself included: nothing is left out, whoever's it is. */
function loadedBy(entries, read, root) {
  const files = new Set();
  const visit = (file, from) => {
    if (files.has(file)) return;
    if (!existsSync(file)) throw missingFile(file, from, root);
    files.add(file);
    for (const target of read(file).requests.keys()) visit(target, file);
  };
  for (const entry of entries) visit(entry, undefined);
  return files;
}

/** Gzipped bytes of each part on its own, added up: what the code costs when served. */
export const gzipSize = (parts) =>
  parts.reduce((total, part) => total + gzipSync(part.code).length, 0);

const builtJavaScript = (root) =>
  ["dist/components", "dist/lib", "dist/chunks"].flatMap((dir) => {
    const folder = path.join(root, dir);
    if (!existsSync(folder)) return [];
    return readdirSync(folder)
      .filter((file) => file.endsWith(".js"))
      .sort()
      .map((file) => path.join(folder, file));
  });

/**
 * Everything the size report prints, for the built package under `root` (the folder that
 * holds dist/ and src/):
 *
 * - components: for each, `js` (gzipped bytes of its own code) and the `parts` behind it,
 *   `uses` (components whose code it imports), `shared` (helpers counted once that its own
 *   code reaches), `sharedSize` (their sizes added up) and `loaded` (gzipped bytes of every
 *   built file its entry loads, each once: own code, helpers, and the components it uses
 *   with all of theirs).
 * - helpers: for each listed helper, whether it is `built` (some of its code is in this
 *   build), its
 *   `size`, the `users` (components whose own code reaches it), whether it is `bundled`
 *   (some built file holds it together with a component's code, so its users cannot be
 *   told) and whether it is `shared` here: counted once, which takes two users and no
 *   bundling.
 * - loadedTogether(names): gzipped bytes of what those components load, each file once.
 *
 * `helpers` replaces the list in shared-helpers.mjs.
 */
export function measureSizes(root, { helpers = SHARED_HELPERS } = {}) {
  const read = builtFiles();
  const entry = (name) => path.join(root, "dist/components", `${name}.js`);
  const folder = path.join(root, "dist/components");
  const names = existsSync(folder)
    ? readdirSync(folder)
        .filter((file) => file.endsWith(".js"))
        .map((file) => file.slice(0, -3))
        .sort()
    : [];
  if (names.length === 0) {
    throw new Error(
      `no built component in ${folder}: run the library build first, or check the folder given`,
    );
  }
  const sourceOf = (helper) => path.join(root, helper.file);
  const listed = new Set(helpers.map(sourceOf));

  // First without the exception and with proof only, to learn who uses which listed helper.
  const users = new Map([...listed].map((source) => [source, []]));
  for (const name of names) {
    for (const source of walk(name, root, read, listed, new Set(), true).reached) {
      users.get(source).push(name);
    }
  }
  const built = builtJavaScript(root);
  // A listed helper the bundler put into a file with a component's code cannot be told apart
  // from that component by who imports the file, so it is not counted once.
  const bundled = new Set();
  for (const file of built) {
    const { sources } = read(file);
    if (!sources.some((source) => componentOf(source, root) !== undefined)) continue;
    for (const source of sources) if (listed.has(source)) bundled.add(source);
  }
  const shared = new Set(
    [...listed].filter((source) => users.get(source).length >= 2 && !bundled.has(source)),
  );

  const helperSize = (source) => {
    let size = 0;
    for (const file of built) {
      const { code, map, sources } = read(file);
      if (!sources.includes(source)) continue;
      // The helper's code and the code without a source in the same file.
      const others = (index) => sources[index] !== source;
      size += gzipSync(
        sources.some((_, i) => others(i)) ? withoutSources(code, map, others) : code,
      ).length;
    }
    return size;
  };
  const sizes = new Map([...listed].map((source) => [source, helperSize(source)]));
  const relative = (source) => path.relative(root, source).split(path.sep).join("/");
  const gzipOf = (files) => [...files].reduce((total, file) => total + read(file).gzip, 0);

  const components = names.map((name) => {
    const { parts, uses, reached } = walk(name, root, read, listed, shared);
    const counted = [...reached].filter((source) => shared.has(source)).sort();
    return {
      name,
      js: gzipSize(parts),
      parts,
      files: parts.map((part) => part.file),
      uses,
      shared: counted.map(relative),
      sharedSize: counted.reduce((total, source) => total + sizes.get(source), 0),
      loaded: gzipOf(loadedBy([entry(name)], read, root)),
    };
  });

  return {
    components,
    helpers: helpers.map((helper) => {
      const source = sourceOf(helper);
      return {
        file: helper.file,
        why: helper.why,
        built: sizes.get(source) > 0,
        size: sizes.get(source),
        users: users.get(source),
        bundled: bundled.has(source),
        shared: shared.has(source),
      };
    }),
    loadedTogether: (together) => gzipOf(loadedBy(together.map(entry), read, root)),
  };
}

/** One component's figures (measureSizes). A component that is not in the build is an error. */
export function ownJavaScript(name, root, options) {
  const found = measureSizes(root, options).components.find((component) => component.name === name);
  if (!found) throw new Error(`${name} is not a component in the build under ${root}`);
  return found;
}
