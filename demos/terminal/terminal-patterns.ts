import { resolvePath, type TerminalFiles } from "./terminal-files";

/**
 * File patterns: `*`, `?` and `[...]` written outside quotes. `stepsOf` writes them as private-use
 * marks, which the shell refuses in what is typed, so a value or a quoted `*` is never a pattern.
 */

export const ANY = "\uE003";
export const ONE = "\uE004";
export const CLASS = "\uE005";
export const CLASS_END = "\uE006";

export const hasPattern = (word: string) => /[\uE003-\uE006]/.test(word);

/** A word's patterns as they were typed. */
export const patternText = (word: string) =>
  word.replaceAll(ANY, "*").replaceAll(ONE, "?").replaceAll(CLASS, "[").replaceAll(CLASS_END, "]");

/** What matches one name of a path; `null` for a class that is no class, such as `[z-a]`. */
function nameMatcher(part: string): RegExp | null {
  let source = "";
  for (let at = 0; at < part.length; at += 1) {
    const ch = part[at] as string;
    if (ch === ANY) source += ".*";
    else if (ch === ONE) source += ".";
    else if (ch === CLASS) {
      const close = part.indexOf(CLASS_END, at);
      const body = part.slice(at + 1, close);
      const negated = body.startsWith("!") || body.startsWith("^");
      const members = (negated ? body.slice(1) : body).replace(/[\\\][^]/g, "\\$&");
      source += `[${negated ? "^" : ""}${members}]`;
      at = close;
    } else source += ch.replace(/[.*+?^${}()|[\]\\/]/, "\\$&");
  }
  try {
    return new RegExp(`^${source}$`, "su");
  } catch {
    return null;
  }
}

const joined = (start: string, name: string) =>
  start === "" ? name : start.endsWith("/") ? `${start}${name}` : `${start}/${name}`;

/**
 * The paths a word with patterns names, written as it wrote them and sorted; none when nothing
 * matches. A pattern takes a hidden name only when it starts with a dot itself, as `.*` does. Each
 * name but the last must be a folder, so `a.txt/../b` is no path even though it would resolve to one.
 * A class can hold no `/`, so one that has it matches nothing.
 */
export async function matchingPaths(
  word: string,
  cwd: string,
  files: TerminalFiles,
): Promise<string[]> {
  if (/\uE005[^\uE006]*\/[^\uE006]*\uE006/.test(word)) return [];
  let found = [""];
  for (const [at, part] of word.split("/").entries()) {
    if (part === "" && at === 0) {
      found = ["/"];
      continue;
    }
    const matcher = hasPattern(part) ? nameMatcher(part) : null;
    if (hasPattern(part) && !matcher) return [];
    const next: string[] = [];
    for (const start of found) {
      const folder = await files.at(resolvePath(start === "" ? "." : start, cwd));
      if (!folder?.children) continue;
      if (!matcher) {
        next.push(joined(start, part));
        continue;
      }
      for (const { name } of folder.children) {
        if (name.startsWith(".") && !part.startsWith(".")) continue;
        if (matcher.test(name)) next.push(joined(start, name));
      }
    }
    found = next;
  }
  const there: string[] = [];
  for (const path of found) {
    const node = await files.at(resolvePath(path, cwd));
    if (node && (!path.endsWith("/") || node.children)) there.push(path);
  }
  return there.sort((a, b) => a.localeCompare(b, "en"));
}
