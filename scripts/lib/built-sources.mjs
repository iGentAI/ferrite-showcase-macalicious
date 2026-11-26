// What a built file was made from, read from the source map the library build writes next to
// it. The package check and the size report both ask this of dist/, instead of guessing from a
// chunk's file name, which the bundler chooses.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Whether code is nothing but imports and exports of other files: an entry point that passes
 * its chunk on. The bundler writes no source map for such a file, because none of it comes
 * from a module's body.
 */
export function isReexportOnly(code) {
  const statements = code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  return statements.every(
    (statement) =>
      // A directive the build wrote at the top is not code either.
      /^(?:"[^"\n]*"|'[^'\n]*')$/.test(statement) ||
      /^(?:import|export)\s[^"']*\sfrom\s*["'][^"']+["']$/.test(statement) ||
      /^import\s*["'][^"']+["']$/.test(statement) ||
      /^export\s*\{[^}]*\}$/.test(statement),
  );
}

/**
 * The source map of a built file, or undefined for a file that needs none (it only passes
 * other files on). A file with code of its own and no source map is an error: without the map
 * nothing can say what the file holds, and a check that then looked no further would pass a
 * file it never examined.
 */
export function sourceMapOf(builtFile) {
  const mapFile = `${builtFile}.map`;
  if (existsSync(mapFile)) {
    const map = JSON.parse(readFileSync(mapFile, "utf8"));
    if (!Array.isArray(map.sources) || typeof map.mappings !== "string") {
      throw new Error(`${mapFile} is not a source map: it has no "sources" or no "mappings"`);
    }
    return map;
  }
  if (isReexportOnly(readFileSync(builtFile, "utf8"))) return undefined;
  throw new Error(
    `${builtFile} holds code and has no source map (${path.basename(mapFile)}), so what it was built from cannot be told; the library build writes one for every chunk (build.sourcemap in vite.config.ts)`,
  );
}

/** The source files behind a built file, as absolute paths, in the order of its source map. */
export function sourcesOf(builtFile, map = sourceMapOf(builtFile)) {
  if (!map) return [];
  return map.sources.map((source) =>
    path.resolve(path.dirname(builtFile), map.sourceRoot ?? "", source),
  );
}

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * The "mappings" of a source map, decoded: for each line of the built file, its segments as
 * { column, source }, where `source` is an index into "sources" or -1 for code that comes from
 * no source. A segment runs to the next one, or to the end of the line.
 */
export function decodeMappings(mappings) {
  let source = 0;
  return mappings.split(";").map((line) => {
    let column = 0;
    const segments = [];
    for (const text of line.split(",")) {
      if (text === "") continue;
      const fields = [];
      let value = 0;
      let shift = 0;
      for (const character of text) {
        const digit = BASE64.indexOf(character);
        if (digit === -1) throw new Error(`"${text}" is not a source map segment`);
        value += (digit & 31) << shift;
        if (digit & 32) shift += 5;
        else {
          fields.push(value & 1 ? -(value >> 1) : value >> 1);
          value = 0;
          shift = 0;
        }
      }
      column += fields[0];
      if (fields.length > 1) source += fields[1];
      segments.push({ column, source: fields.length > 1 ? source : -1 });
    }
    return segments;
  });
}

/**
 * The code of a built file without the parts that come from the sources `isForeign` names
 * (by index into the map's "sources"). Code the map gives no source for is kept.
 */
export function withoutSources(code, map, isForeign) {
  const lines = code.split("\n");
  const decoded = decodeMappings(map.mappings);
  return lines
    .map((line, index) => {
      const segments = decoded[index] ?? [];
      if (segments.length === 0) return line;
      let kept = line.slice(0, segments[0].column);
      segments.forEach((segment, i) => {
        const end = i + 1 < segments.length ? segments[i + 1].column : line.length;
        if (segment.source === -1 || !isForeign(segment.source)) {
          kept += line.slice(segment.column, end);
        }
      });
      return kept;
    })
    .join("\n");
}
