import { type FinderNode, HOME, TRASH } from "../finder/finder-data";
import { type CommandContext, type CommandRun, setVariable } from "./terminal-context";
import {
  baseName,
  type FileEntry,
  FileProblem,
  folderOf,
  IS_A_FOLDER,
  NO_SUCH_FILE,
  resolvePath,
} from "./terminal-files";
import { Interrupted, ShellExit } from "./terminal-io";
import { columnize } from "./terminal-line-editor";
import { MAC_COMMANDS } from "./terminal-mac-commands";
import { modeOf, modeText, setMode } from "./terminal-modes";
import { parseOptions, refusedOption } from "./terminal-options";
import { PAGER_COMMANDS } from "./terminal-pager";
import { SCRIPT_COMMANDS } from "./terminal-script-commands";
import { STREAM_COMMANDS } from "./terminal-stream-commands";
import { inputs, TEXT_TOOLS, writeInPieces } from "./terminal-text-commands";

/**
 * The commands of this first version of the simulated shell. A command gets its arguments
 * (`CommandContext`) and answers its exit status. What it says on the error stream is what the Mac
 * command of the name says, where the drive can do the same. `rm` erases for real, as on a Mac.
 */

const lastError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const stopIfAsked = (context: CommandContext) => {
  if (context.signal.aborted) throw new Interrupted();
};

const pad = (value: number) => String(value).padStart(2, "0");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A date as `ls -l` writes it: the time this half year, the year otherwise; `-T` both, to the second. */
function listDate(ms: number | undefined, now: number, full = false): string {
  if (ms === undefined) return full ? " ".repeat(20) : "            ";
  const date = new Date(ms);
  const when = `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2)}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (full) return `${when} ${time}:${pad(date.getSeconds())} ${date.getFullYear()}`;
  const recent = Math.abs(now - ms) < 182 * 24 * 3600 * 1000;
  return `${when} ${recent ? time : ` ${date.getFullYear()}`}`;
}

const sizeOf = (node: FinderNode) =>
  node.children ? 32 * (node.children.length + 2) : (node.size ?? 0);

/** A size as `ls -h` writes it. */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  let size = bytes;
  let at = -1;
  while (size >= 1024 && at < 3) {
    size /= 1024;
    at += 1;
  }
  return `${size < 10 ? size.toFixed(1) : Math.round(size)}${"KMGT"[at]}`;
}

function longLine(
  node: FinderNode,
  name: string,
  owner: string,
  now: number,
  human = false,
  columns: {
    owner?: boolean;
    group?: boolean;
    groupName?: string;
    flags?: boolean;
    fullDate?: boolean;
  } = {},
): string {
  const mode = modeText(node);
  const links = (node.children?.length ?? 0) + 1;
  const size = human ? humanSize(sizeOf(node)) : sizeOf(node);
  const who = [
    ...(columns.owner === false ? [] : [owner]),
    ...(columns.group === false ? [] : [columns.groupName ?? "staff"]),
    ...(columns.flags ? [node.locked ? "uchg" : "-"] : []),
  ].join("  ");
  return `${mode}  ${links} ${who}  ${size} ${listDate(node.revision, now, columns.fullDate)} ${name}`;
}

/** `-s`: the 512-byte blocks of what an item holds, or the kilobytes with `-k`. */
const blocksOf = (node: FinderNode, unit: number) => Math.ceil(sizeOf(node) / unit);

const ls: CommandRun = async (context) => {
  // There are no links, whiteouts or access control lists on the drive, so -H -L -P -W -e have
  // nothing to change. The drive keeps no inode, access time, status time or creation time, so
  // -i -u -c -U stay refused, and it has no extended attributes for -@ to list.
  if (refusedOption(context, "1ABCFGHLOPRSTWabdefghklmnopqrstvwx")) return 1;
  const { options, operands } = parseOptions(context.args);
  const { files, userName } = context.session;
  const unsorted = options.has("f");
  const showAll = options.has("a") || unsorted;
  const showHidden = showAll || options.has("A");
  const now = Date.now();
  const asked = operands.length > 0 ? operands : ["."];
  const blockUnit = options.has("k") ? 1024 : 512;
  const blocks = options.has("s");
  /** A name with `-q`'s question marks or `-b`'s octal in place of what cannot be printed. */
  const printed = (name: string) =>
    options.has("b") || options.has("B")
      ? name.replace(
          /\p{Cc}/gu,
          (char) => `\\${(char.codePointAt(0) as number).toString(8).padStart(3, "0")}`,
        )
      : options.has("q")
        ? name.replace(/\p{Cc}/gu, "?")
        : name;
  /** The name as written, with `-F`'s and `-p`'s mark of what the item is. */
  const named = (node: FinderNode, name: string) => {
    const shown = printed(name);
    if (node.children && (options.has("F") || options.has("p"))) return `${shown}/`;
    if (!options.has("F")) return shown;
    return modeOf(node) & 0o100 ? `${shown}*` : shown;
  };
  /** `-G` on a screen: a folder's name in blue, as BSD's ls colours it by default. */
  const coloured = options.has("G") && !context.outIsPipe;
  const paint = (node: FinderNode, text: string) =>
    coloured && node.children ? `\x1b[34m${text}\x1b[0m` : text;
  const numeric = options.has("n");
  const long = options.has("l") || options.has("g") || options.has("o") || numeric;
  const counted = (node: FinderNode) => (blocks ? `${blocksOf(node, blockUnit)} ` : "");
  const line = (node: FinderNode, name: string) =>
    counted(node) +
    (long
      ? longLine(
          node,
          paint(node, named(node, name)),
          numeric ? "501" : userName,
          now,
          options.has("h"),
          {
            owner: !options.has("g"),
            group: !options.has("o"),
            groupName: numeric ? "20" : "staff",
            flags: options.has("O"),
            fullDate: options.has("T"),
          },
        )
      : paint(node, named(node, name)));
  const ordered = (list: readonly FileEntry[]) => {
    if (unsorted) return [...list];
    const sorted = [...list];
    if (options.has("t")) {
      sorted.sort((a, b) => (b.node.revision ?? 0) - (a.node.revision ?? 0));
    } else if (options.has("S")) {
      sorted.sort((a, b) => sizeOf(b.node) - sizeOf(a.node));
    }
    return options.has("r") ? sorted.reverse() : sorted;
  };
  const pending = asked.map((shown) => ({ shown, path: resolvePath(shown, context.scope.cwd) }));
  let status = 0;
  let listedFolders = 0;
  for (let next = pending.shift(); next; next = pending.shift()) {
    stopIfAsked(context);
    const { shown, path } = next;
    const node = await files.at(path);
    if (!node) {
      context.err(`ls: ${shown}: ${NO_SUCH_FILE}\n`);
      status = 1;
      continue;
    }
    if (!node.children || options.has("d")) {
      context.out(`${line(node, shown)}\n`);
      continue;
    }
    if (asked.length > 1 || listedFolders > 0) {
      context.out(`${listedFolders === 0 ? "" : "\n"}${shown}:\n`);
    }
    listedFolders += 1;
    const listed = ordered(
      (await files.list(path)).filter(({ node: each }) => showHidden || !each.name.startsWith(".")),
    );
    const entries: FileEntry[] = showAll
      ? [
          { path, node: { ...node, name: "." } },
          { path: folderOf(path), node: { name: "..", kind: "folder", children: [] } },
          ...listed,
        ]
      : listed;
    const names = entries.map(({ node: each }) => counted(each) + named(each, each.name));
    const folders = new Set(
      entries.flatMap(({ node: each }) =>
        each.children ? [counted(each) + named(each, each.name)] : [],
      ),
    );
    const painted = (name: string) =>
      coloured && folders.has(name) ? `\x1b[34m${name}\x1b[0m` : name;
    const { cols } = context.session.emulator;
    const lines = long
      ? entries.map(({ node: each }) => line(each, each.name))
      : options.has("m")
        ? [names.map(painted).join(", ")]
        : options.has("1")
          ? names.map(painted)
          : options.has("x")
            ? columnize(names, cols, painted, "across")
            : context.outIsPipe && !options.has("C")
              ? names.map(painted)
              : columnize(names, cols, painted);
    if (long || blocks) {
      const unit = blocks ? blockUnit : 512;
      const total = entries.reduce((sum, { node: each }) => sum + blocksOf(each, unit), 0);
      context.out(`total ${total}\n`);
    }
    if (lines.length > 0) context.out(`${lines.join("\n")}\n`);
    if (options.has("R")) {
      const inner = listed
        .filter(({ node: each }) => each.children)
        .map((each) => ({
          shown: `${shown.replace(/\/$/, "")}/${each.node.name}`,
          path: each.path,
        }));
      pending.unshift(...inner);
    }
  }
  return status;
};

const cd: CommandRun = async (context) => {
  const { scope, args } = context;
  if (args.length > 1) {
    context.err("cd: too many arguments\n");
    return 1;
  }
  const [target] = args;
  const wanted = target === undefined ? HOME : target === "-" ? scope.oldCwd : target;
  const path = resolvePath(wanted, scope.cwd);
  const node = await context.session.files.at(path);
  if (!node) {
    context.err(`cd: no such file or directory: ${wanted}\n`);
    return 1;
  }
  if (!node.children) {
    context.err(`cd: not a directory: ${wanted}\n`);
    return 1;
  }
  stopIfAsked(context);
  scope.oldCwd = scope.cwd;
  scope.cwd = path;
  setVariable(scope, "OLDPWD", scope.oldCwd);
  setVariable(scope, "PWD", path);
  if (target === "-") context.out(`${path}\n`);
  return 0;
};

const makeFolder = async (context: CommandContext, path: string) => {
  const { files } = context.session;
  const parent = await files.folderId(path);
  stopIfAsked(context);
  await files.apply([{ op: "mkdir", parent, name: baseName(path), existing: "fail" }]);
};

const mkdir: CommandRun = async (context) => {
  if (refusedOption(context, "p")) return 1;
  const { options, operands } = parseOptions(context.args);
  const { files } = context.session;
  if (operands.length === 0) {
    context.err("usage: mkdir [-p] directory ...\n");
    return 1;
  }
  let status = 0;
  for (const operand of operands) {
    stopIfAsked(context);
    const path = resolvePath(operand, context.scope.cwd);
    try {
      if (options.has("p")) {
        let at = "";
        for (const part of path.split("/").filter((name) => name !== "")) {
          stopIfAsked(context);
          at = `${at}/${part}`;
          const node = await files.at(at);
          if (!node) await makeFolder(context, at);
          else if (!node.children) {
            throw new FileProblem(at === path ? "File exists" : "Not a directory");
          }
        }
      } else {
        if (await files.at(path)) throw new FileProblem("File exists");
        await makeFolder(context, path);
      }
    } catch (error) {
      if (error instanceof Interrupted) throw error;
      context.err(`mkdir: ${operand}: ${lastError(error)}\n`);
      status = 1;
    }
  }
  return status;
};

const rmdir: CommandRun = async (context) => {
  if (refusedOption(context, "")) return 1;
  const { operands } = parseOptions(context.args);
  const { files } = context.session;
  if (operands.length === 0) {
    context.err("usage: rmdir directory ...\n");
    return 1;
  }
  let status = 0;
  for (const operand of operands) {
    stopIfAsked(context);
    const path = resolvePath(operand, context.scope.cwd);
    try {
      const node = await files.at(path);
      if (!node) throw new FileProblem(NO_SUCH_FILE);
      if (!node.children) throw new FileProblem("Not a directory");
      if (node.children.length > 0) throw new FileProblem("Directory not empty");
      const id = await files.idOf(path);
      stopIfAsked(context);
      // The Trash, so a file another window put in the folder after the check above can be recovered.
      await files.apply([{ op: "trash", id }]);
    } catch (error) {
      if (error instanceof Interrupted) throw error;
      context.err(`rmdir: ${operand}: ${lastError(error)}\n`);
      status = 1;
    }
  }
  return status;
};

const touch: CommandRun = async (context) => {
  if (refusedOption(context, "c")) return 1;
  const { options, operands } = parseOptions(context.args);
  const { files } = context.session;
  if (operands.length === 0) {
    context.err("usage: touch [-c] file ...\n");
    return 1;
  }
  let status = 0;
  for (const operand of operands) {
    stopIfAsked(context);
    const path = resolvePath(operand, context.scope.cwd);
    try {
      if (await files.at(path)) {
        stopIfAsked(context);
        await files.touch(path, context.signal);
      } else if (!options.has("c")) {
        stopIfAsked(context);
        await files.makeEmptyFile(path);
      }
    } catch (error) {
      if (error instanceof Interrupted) throw error;
      context.err(`touch: ${operand}: ${lastError(error)}\n`);
      status = 1;
    }
  }
  return status;
};

const rm: CommandRun = async (context) => {
  if (refusedOption(context, "fRirv")) return 1;
  const { options, operands } = parseOptions(context.args);
  const { files } = context.session;
  const force = options.has("f");
  const asks = options.has("i") && lastOf(context.args, "fi") === "i";
  if (operands.length === 0) {
    if (force) return 0;
    context.err("usage: rm [-f | -i] [-Rrv] file ...\n");
    return 1;
  }
  let status = 0;
  for (const operand of operands) {
    stopIfAsked(context);
    const final = operand
      .split("/")
      .filter((part) => part !== "")
      .at(-1);
    if (final === "." || final === "..") {
      context.err(`rm: "." and ".." may not be removed\n`);
      status = 1;
      continue;
    }
    const path = resolvePath(operand, context.scope.cwd);
    try {
      const node = await files.at(path);
      if (!node) {
        if (force) continue;
        throw new FileProblem(NO_SUCH_FILE);
      }
      if (node.children && !options.has("r") && !options.has("R")) {
        throw new FileProblem("is a directory");
      }
      if (!namesAFolder(operand, node)) throw new FileProblem("Not a directory");
      if (asks && !(await answersYes(context, `remove ${operand}? `))) continue;
      const id = await files.idOf(path);
      stopIfAsked(context);
      await files.apply([{ op: "delete", id }]);
      if (options.has("v")) context.out(`${operand}\n`);
    } catch (error) {
      if (error instanceof Interrupted) throw error;
      context.err(`rm: ${operand}: ${lastError(error)}\n`);
      status = 1;
    }
  }
  return status;
};

/** Where `source` goes: `target` itself, or inside `target` when that is a folder. */
async function destination(
  context: CommandContext,
  source: string,
  target: string,
): Promise<string> {
  const node = await context.session.files.at(target);
  return node?.children ? `${target === "/" ? "" : target}/${baseName(source)}` : target;
}

/** Which of `letters` the options give last, as `-f`, `-i` and `-n` overrule each other. */
function lastOf(args: readonly string[], letters: string): string | null {
  let last: string | null = null;
  for (const arg of args) {
    if (arg === "--") break;
    if (arg === "-" || !arg.startsWith("-")) continue;
    for (const letter of arg.slice(1)) {
      if (letters.includes(letter)) last = letter;
    }
  }
  return last;
}

/** Asks on the error stream and reads the line, whose first letter says yes, as `rm -i` does. */
async function answersYes(context: CommandContext, question: string): Promise<boolean> {
  context.err(question);
  const answer = await context.readLine();
  return answer !== null && /^\s*y/i.test(answer);
}

/** Whether to go on over a file that is there: `-n` keeps it, `-i` asks. */
const mayReplace = async (context: CommandContext, to: string): Promise<boolean> => {
  const last = lastOf(context.args, "fin");
  if (last === "n") return false;
  if (last !== "i") return true;
  if (await answersYes(context, `overwrite ${to}? (y/n [n]) `)) return true;
  context.err("not overwritten\n");
  return false;
};

/** A name that ends in `/` names a folder, so a file or nothing there is refused. */
const namesAFolder = (operand: string, node: FinderNode | undefined) =>
  !operand.endsWith("/") || node?.children !== undefined;

const mv: CommandRun = async (context) => {
  if (refusedOption(context, "finv")) return 1;
  const { options, operands } = parseOptions(context.args);
  const { files } = context.session;
  if (operands.length < 2) {
    context.err("usage: mv [-f | -i | -n] [-v] source target\n");
    return 1;
  }
  const targetText = operands.at(-1) as string;
  const target = resolvePath(targetText, context.scope.cwd);
  const sources = operands.slice(0, -1);
  if (sources.length > 1 && !(await files.at(target))?.children) {
    context.err(`mv: ${targetText} is not a directory\n`);
    return 1;
  }
  if (!namesAFolder(targetText, await files.at(target))) {
    context.err(`mv: ${targetText}: Not a directory\n`);
    return 1;
  }
  let status = 0;
  for (const operand of sources) {
    stopIfAsked(context);
    const from = resolvePath(operand, context.scope.cwd);
    try {
      if (!namesAFolder(operand, await files.at(from))) {
        throw new FileProblem("Not a directory");
      }
      const id = await files.idOf(from);
      if (target === TRASH) {
        stopIfAsked(context);
        await files.apply([{ op: "trash", id }]);
        if (options.has("v")) context.out(`${operand} -> ${target}\n`);
        continue;
      }
      const to = await destination(context, from, target);
      if (to === from) throw new FileProblem("are identical");
      if (to.startsWith(`${from}/`)) throw new FileProblem("cannot move a directory into itself");
      const source = await files.at(from);
      const present = await files.at(to);
      if (source?.children && present && !present.children) {
        throw new FileProblem(`cannot overwrite non-directory ${to} with directory`);
      }
      if (present?.children) throw new FileProblem(`${to}: ${IS_A_FOLDER}`);
      if (present && !(await mayReplace(context, to))) continue;
      const replace = present?.id ? [{ op: "delete" as const, id: present.id }] : [];
      const parent = await files.folderId(to);
      stopIfAsked(context);
      await files.apply([
        ...replace,
        folderOf(from) === folderOf(to)
          ? { op: "rename" as const, id, name: baseName(to) }
          : { op: "move" as const, id, parent, name: baseName(to), existing: "fail" as const },
      ]);
      if (options.has("v")) context.out(`${operand} -> ${to}\n`);
    } catch (error) {
      if (error instanceof Interrupted) throw error;
      context.err(`mv: ${operand}: ${lastError(error)}\n`);
      status = 1;
    }
  }
  return status;
};

const cp: CommandRun = async (context) => {
  // There are no links on the drive, so -H -L -P have nothing to change.
  if (refusedOption(context, "RrfinvpaHLP")) return 1;
  const { options, operands } = parseOptions(context.args);
  const { files } = context.session;
  if (operands.length < 2) {
    context.err("usage: cp [-Ra] [-f | -i | -n] [-pv] source_file target_file\n");
    return 1;
  }
  const targetText = operands.at(-1) as string;
  const target = resolvePath(targetText, context.scope.cwd);
  const sources = operands.slice(0, -1);
  if (sources.length > 1 && !(await files.at(target))?.children) {
    context.err(`cp: ${targetText} is not a directory\n`);
    return 1;
  }
  if (!namesAFolder(targetText, await files.at(target))) {
    context.err(`cp: ${targetText}: Not a directory\n`);
    return 1;
  }
  const recursive = options.has("r") || options.has("R") || options.has("a");
  const keeping = options.has("p") || options.has("a");
  /** `-p`: the copy at `to`, and all in it, takes the mode of what it was copied from. */
  const keepModes = async (from: string, to: string): Promise<void> => {
    const source = await files.at(from);
    const copy = await files.at(to);
    if (!source || !copy) return;
    if (modeOf(source) !== modeOf(copy)) setMode(copy, modeOf(source));
    if (!source.children) return;
    for (const entry of await files.list(from)) {
      await keepModes(entry.path, `${to}/${entry.node.name}`);
    }
  };
  /** Copies `from` to `to`; a folder already there keeps all that the copy does not name. */
  const copyOnto = async (from: string, to: string, shown: string): Promise<number> => {
    try {
      stopIfAsked(context);
      const node = await files.at(from);
      if (!node) throw new FileProblem(NO_SUCH_FILE);
      const present = await files.at(to);
      if (to === from) throw new FileProblem("are identical");
      if (node.children && present && !present.children) {
        throw new FileProblem(`cannot overwrite non-directory ${to} with directory`);
      }
      if (!node.children && present?.children) {
        throw new FileProblem(`cannot overwrite directory ${to} with non-directory`);
      }
      if (node.children && present) {
        let status = 0;
        for (const entry of await files.list(from)) {
          const name = entry.node.name;
          status |= await copyOnto(entry.path, `${to}/${name}`, `${shown}/${name}`);
        }
        return status;
      }
      if (present && !(await mayReplace(context, to))) return 0;
      const id = await files.idOf(from);
      const replace = present?.id ? [{ op: "delete" as const, id: present.id }] : [];
      const parent = await files.folderId(to);
      stopIfAsked(context);
      await files.apply([
        ...replace,
        {
          op: "copy",
          id,
          parent,
          name: baseName(to),
          existing: "fail",
          dated_now: !keeping,
        },
      ]);
      if (options.has("v")) context.out(`${shown} -> ${to}\n`);
      if (keeping) await keepModes(from, to);
      return 0;
    } catch (error) {
      if (error instanceof Interrupted) throw error;
      context.err(`cp: ${shown}: ${lastError(error)}\n`);
      return 1;
    }
  };
  let status = 0;
  for (const operand of sources) {
    stopIfAsked(context);
    const from = resolvePath(operand, context.scope.cwd);
    const node = await files.at(from);
    if (!namesAFolder(operand, node)) {
      context.err(`cp: ${operand}: Not a directory\n`);
      status = 1;
      continue;
    }
    if (node?.children && !recursive) {
      context.err(`cp: ${operand} is a directory (not copied).\n`);
      status = 1;
      continue;
    }
    const to = await destination(context, from, target);
    if (node?.children && to.startsWith(`${from}/`)) {
      context.err(`cp: ${operand}: cannot copy a directory into itself\n`);
      status = 1;
      continue;
    }
    status |= await copyOnto(from, to, operand);
  }
  return status;
};

const pwd: CommandRun = async (context) => {
  context.out(`${context.scope.cwd}\n`);
  return 0;
};

const cat: CommandRun = async (context) => {
  if (refusedOption(context, "bnsu")) return 1;
  const { options, operands } = parseOptions(context.args);
  const problems = { failed: false };
  const numbersAll = options.has("n") && !options.has("b");
  const shaping = options.has("b") || options.has("n") || options.has("s");
  let number = 0;
  let blankBefore = false;
  const shaped = (text: string) => {
    let out = "";
    for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
      const blank = line === "\n";
      if (options.has("s") && blank && blankBefore) continue;
      blankBefore = blank;
      const numbered = numbersAll || (options.has("b") && !blank);
      if (numbered) number += 1;
      out += numbered ? `${String(number).padStart(6)}\t${line}` : line;
    }
    return out;
  };
  const write = (text: string) => writeInPieces(context, shaping ? shaped(text) : text);
  for (const operand of operands.length > 0 ? operands : ["-"]) {
    // Typed lines come back as they end, as a person sees `cat` do, not all at the end.
    if (operand === "-" && context.stdin === null && !context.background) {
      for (let line = await context.readLine(); line !== null; line = await context.readLine()) {
        await write(`${line}\n`);
      }
      continue;
    }
    for await (const file of inputs(context, [operand], problems)) await write(file.text);
  }
  return problems.failed ? 1 : 0;
};

/** What `echo` makes of `\n` and its like, as zsh's does; `\c` ends the output there, with no newline. */
function echoEscapes(text: string): { text: string; stop: boolean } {
  const named: Readonly<Record<string, string>> = {
    a: "\x07",
    b: "\b",
    e: "\x1b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
    v: "\v",
    "\\": "\\",
  };
  const stopAt = text.search(/(?<!\\)(?:\\\\)*\\c/);
  const kept = stopAt < 0 ? text : text.slice(0, text.indexOf("\\c", stopAt));
  return {
    text: kept.replace(/\\([abefnrtv\\])/g, (_, name: string) => named[name] as string),
    stop: stopAt >= 0,
  };
}

const echo: CommandRun = async (context) => {
  const { args } = context;
  const noNewline = args[0] === "-n";
  const { text, stop } = echoEscapes((noNewline ? args.slice(1) : args).join(" "));
  context.out(`${text}${noNewline || stop ? "" : "\n"}`);
  return 0;
};

const clear: CommandRun = async (context) => {
  context.out("\x1b[H\x1b[2J\x1b[3J");
  return 0;
};

/** The terminal as it starts: its modes and colours back to their first state, and the screen clear. */
const reset: CommandRun = async (context) => {
  context.out("\x1bc");
  return 0;
};

const history: CommandRun = async (context) => {
  for (const [at, line] of context.session.editor.history.entries()) {
    context.out(`${String(at + 1).padStart(5)}  ${line}\n`);
  }
  return 0;
};

const exit: CommandRun = async (context) => {
  const [status] = context.args;
  const code = status === undefined ? context.scope.status : Number(status);
  throw new ShellExit(Number.isInteger(code) ? code & 255 : 1);
};

const help: CommandRun = async (context) => {
  context.out(
    [
      "pwd                 the folder you are in",
      "cd [folder]         go to a folder; cd - goes back",
      "ls [-1AFGRSadghlmoprt]  list a folder",
      "cat [-bnsu] [file ...]   show files, what a pipe gives, or what you type",
      "mkdir [-p] folder   make a folder",
      "rmdir folder        put an empty folder in the Trash",
      "touch file          make an empty file",
      "cp [-R] from to     copy",
      "mv from to          move or rename; to ~/.Trash puts it in the Trash",
      "rm [-f] [-R] file   erase for real: not to the Trash",
      "echo [-n] text      write text; \\n, \\t and their like are read",
      "clear               clear the window",
      "reset               put the terminal back as it started",
      "history             the lines you typed",
      "grep [-cilnvw] pattern [file ...]   the lines that match",
      "head, tail [-n N] [file ...]        the first or last lines",
      "wc [-lwc] [file ...]                count lines, words and bytes",
      "sort [-nru] [-k M] [file ...]       sort the lines",
      "uniq [-cd] [file]                   drop repeated lines",
      "less, more [file ...]               a page at a time; q quits",
      "man name                            what a command does here",
      "exit [status]       end this shell",
      "sh, source file     run a script; if, for, while, until, $(...), $((...)), <<",
      "chmod mode file     keep a file's mode; ./file runs it when it may run",
      "alias name=value    a short name for a command; unalias forgets it",
      "command &           run behind the prompt; jobs, fg and wait follow it",
      "",
      "The other commands of a Mac are not here yet.",
      "Run several on a line with ; && and ||, feed one to the next with |, and send",
      "what it writes to a file with > >> and 2>, or read a file with <.",
      "",
    ].join("\n"),
  );
  return 0;
};

/** Refuses an empty name before `run` sees it: `resolvePath` would read it as the current folder. */
const refusingEmptyNames =
  (run: CommandRun): CommandRun =>
  async (context) => {
    if (!parseOptions(context.args).operands.includes("")) return run(context);
    context.err(`${context.name}: : ${NO_SUCH_FILE}\n`);
    return 1;
  };

const COMMANDS: Readonly<Record<string, CommandRun>> = {
  ...TEXT_TOOLS,
  ...STREAM_COMMANDS,
  ...MAC_COMMANDS,
  ...PAGER_COMMANDS,
  ...SCRIPT_COMMANDS,
  cat,
  cd,
  clear,
  cp: refusingEmptyNames(cp),
  echo,
  exit,
  help,
  history,
  ls,
  mkdir: refusingEmptyNames(mkdir),
  mv: refusingEmptyNames(mv),
  pwd,
  reset,
  rm: refusingEmptyNames(rm),
  rmdir: refusingEmptyNames(rmdir),
  touch: refusingEmptyNames(touch),
};

export const commandFor = (name: string): CommandRun | undefined =>
  Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;

export const commandNames = (): string[] => Object.keys(COMMANDS);
