import { commandFor } from "./terminal-commands";
import type { CommandContext, CommandRun, ShellJob } from "./terminal-context";
import { baseName, folderOf, NO_SUCH_FILE, resolvePath } from "./terminal-files";
import { Interrupted } from "./terminal-io";
import { changedMode, modeOf, setMode } from "./terminal-modes";
import { commandPlace } from "./terminal-stream-commands";
import { readTextBounded } from "./terminal-text-commands";

/** The commands that belong to the shell's scripting: names, tests, loops' helpers and jobs. */

const ALIAS_NAME = /^[^\s=/$`'"\\;|&<>()]+$/;

const quotedAlias = (name: string, value: string) =>
  /^[\w@%+=:,./-]+$/.test(value) ? `${name}=${value}` : `${name}='${value.replace(/'/g, "'\\''")}'`;

const alias: CommandRun = async ({ args, scope, out, err }) => {
  if (args.length === 0) {
    for (const [name, value] of [...scope.aliases].sort(([a], [b]) => (a < b ? -1 : 1))) {
      out(`${quotedAlias(name, value)}\n`);
    }
    return 0;
  }
  let status = 0;
  for (const arg of args) {
    const equals = arg.indexOf("=");
    if (equals < 0) {
      const value = scope.aliases.get(arg);
      if (value === undefined) status = 1;
      else out(`${quotedAlias(arg, value)}\n`);
    } else if (ALIAS_NAME.test(arg.slice(0, equals))) {
      scope.aliases.set(arg.slice(0, equals), arg.slice(equals + 1));
    } else {
      err(`zsh: bad assignment: ${arg}\n`);
      status = 1;
    }
  }
  return status;
};

const unalias: CommandRun = async ({ args, scope, err }) => {
  if (args[0] === "-a") {
    scope.aliases.clear();
    return 0;
  }
  if (args.length === 0) {
    err("unalias: not enough arguments\n");
    return 1;
  }
  let status = 0;
  for (const arg of args) {
    if (!scope.aliases.delete(arg)) {
      err(`unalias: no such hash table element: ${arg}\n`);
      status = 1;
    }
  }
  return status;
};

/** The text of the script `operand` names, or null once it has said why not. */
async function scriptText(context: CommandContext, operand: string): Promise<string | null> {
  try {
    return await readTextBounded(context.session.files, resolvePath(operand, context.scope.cwd));
  } catch (error) {
    context.err(`${context.name}: ${(error as Error).message}: ${operand}\n`);
    return null;
  }
}

/** `source` and `.`: in this shell, so what it sets stays. */
const source: CommandRun = async (context) => {
  const [operand, ...args] = context.args;
  if (operand === undefined) {
    context.err(`${context.name}: not enough arguments\n`);
    return 1;
  }
  const text = await scriptText(context, operand);
  if (text === null) return 1;
  return context.session.runScript(text, context, {
    name: operand,
    args: args.length > 0 ? args : undefined,
    subshell: false,
  });
};

/** `sh`, `bash` and `zsh`: a shell of its own, which ends with the script. */
const shell: CommandRun = async (context) => {
  const words = [...context.args];
  if (words[0] === "-c") {
    const [, code, name, ...args] = words;
    if (code === undefined) {
      context.err(`${context.name}: -c: option requires an argument\n`);
      return 2;
    }
    return context.session.runScript(code, context, {
      name: name ?? context.name,
      args,
      subshell: true,
    });
  }
  const [operand, ...args] = words;
  if (operand === undefined) {
    if (context.stdin !== null) {
      return context.session.runScript(context.stdin, context, {
        name: context.name,
        args: [],
        subshell: true,
      });
    }
    context.err(`${context.name}: this shell is already the one you are typing in\n`);
    return 1;
  }
  const text = await scriptText(context, operand);
  if (text === null) return 127;
  return context.session.runScript(text, context, { name: operand, args, subshell: true });
};

/** A file named by its path: runs it as a script, when `chmod` has made it one. */
export const runProgram: CommandRun = async (context) => {
  const { session, scope, name, args } = context;
  const program = /^\/bin\/([^/]+)$/.exec(name)?.[1];
  const command = program && commandPlace(program) ? commandFor(program) : undefined;
  if (program && command) return command({ ...context, name: program });
  const node = await session.files.at(resolvePath(name, scope.cwd));
  if (!node) {
    context.err(`zsh: ${NO_SUCH_FILE.toLowerCase()}: ${name}\n`);
    return 127;
  }
  if (node.children || (modeOf(node) & 0o100) === 0) {
    context.err(`zsh: permission denied: ${name}\n`);
    return 126;
  }
  const text = await scriptText(context, name);
  if (text === null) return 126;
  return session.runScript(text, context, { name, args: [...args], subshell: true });
};

const chmod: CommandRun = async (context) => {
  const operands = context.args.filter((each) => each !== "-R" && each !== "-v" && each !== "-f");
  const [change, ...names] = operands;
  if (change === undefined || names.length === 0) {
    context.err("usage: chmod [-fRv] mode file ...\n");
    return 1;
  }
  if (changedMode(0, change) === null) {
    context.err(`chmod: Invalid file mode: ${change}\n`);
    return 1;
  }
  const { files } = context.session;
  const recursive = context.args.includes("-R");
  const quiet = context.args.includes("-f");
  const verbose = context.args.includes("-v");
  let status = 0;
  const apply = async (path: string, shown: string): Promise<void> => {
    const node = await files.at(path);
    if (!node) {
      if (!quiet) context.err(`chmod: ${shown}: ${NO_SUCH_FILE}\n`);
      status = 1;
      return;
    }
    if (!node.id) {
      if (!quiet)
        context.err(`chmod: Unable to change file mode on ${shown}: Operation not permitted\n`);
      status = 1;
      return;
    }
    setMode(node, changedMode(modeOf(node), change) as number);
    if (verbose) context.out(`${shown}\n`);
    if (recursive && node.children) {
      for (const { path: inner, node: child } of await files.list(path)) {
        await apply(inner, `${shown}/${child.name}`);
      }
    }
  };
  for (const name of names) await apply(resolvePath(name, context.scope.cwd), name);
  return status;
};

/** The value of one `test` expression: `not` turns it round, and a missing operand is false. */
async function tested(context: CommandContext, words: readonly string[]): Promise<boolean | null> {
  const [first, second, third, ...rest] = words;
  if (first === "!") {
    const inner = await tested(context, words.slice(1));
    return inner === null ? null : !inner;
  }
  const joined = words.findIndex((word) => word === "-a" || word === "-o");
  if (joined > 0) {
    const left = await tested(context, words.slice(0, joined));
    const right = await tested(context, words.slice(joined + 1));
    if (left === null || right === null) return null;
    return words[joined] === "-a" ? left && right : left || right;
  }
  if (first === undefined) return false;
  if (second === undefined) return first !== "";
  if (third === undefined) {
    if (first === "-z") return second === "";
    if (first === "-n") return second !== "";
    if (/^-[defrswx]$/.test(first)) {
      const node = await context.session.files.at(resolvePath(second, context.scope.cwd));
      if (!node) return false;
      const mode = modeOf(node);
      switch (first) {
        case "-d":
          return node.children !== undefined;
        case "-f":
          return node.children === undefined;
        case "-s":
          return node.children !== undefined || (node.size ?? 0) > 0;
        case "-r":
          return (mode & 0o400) !== 0;
        case "-w":
          return (mode & 0o200) !== 0;
        case "-x":
          return (mode & 0o100) !== 0;
        default:
          return true;
      }
    }
    return null;
  }
  if (rest.length > 0) return null;
  switch (second) {
    case "=":
    case "==":
      return first === third;
    case "!=":
      return first !== third;
    case "-eq":
      return Number(first) === Number(third);
    case "-ne":
      return Number(first) !== Number(third);
    case "-lt":
      return Number(first) < Number(third);
    case "-le":
      return Number(first) <= Number(third);
    case "-gt":
      return Number(first) > Number(third);
    case "-ge":
      return Number(first) >= Number(third);
    default:
      return null;
  }
}

const test: CommandRun = async (context) => {
  const words = [...context.args];
  const close = context.name === "[" ? "]" : context.name === "[[" ? "]]" : null;
  if (close !== null) {
    if (words.at(-1) !== close) {
      context.err(`${context.name}: '${close}' expected\n`);
      return 2;
    }
    words.pop();
  }
  const answer = await tested(context, words);
  if (answer === null) {
    context.err(`${context.name}: this test is not one this shell reads: ${words.join(" ")}\n`);
    return 2;
  }
  return answer ? 0 : 1;
};

const sleep: CommandRun = async (context) => {
  const seconds = Number(context.args[0]);
  if (context.args.length !== 1 || !Number.isFinite(seconds) || seconds < 0) {
    context.err("usage: sleep seconds\n");
    return 1;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, seconds * 1000);
    context.signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Interrupted());
      },
      { once: true },
    );
  });
  return 0;
};

const read: CommandRun = async (context) => {
  const names = context.args.filter((each) => each !== "-r");
  const line = await context.readLine();
  if (line === null) return 1;
  const targets = names.length > 0 ? names : ["REPLY"];
  const parts = line.trim().split(/\s+/);
  for (const [at, name] of targets.entries()) {
    const value = at === targets.length - 1 ? parts.slice(at).join(" ") : (parts[at] ?? "");
    context.scope.variables.set(name, {
      value,
      exported: context.scope.variables.get(name)?.exported ?? false,
    });
  }
  return 0;
};

/** The format's escapes and `%s`, `%d`, `%%`, repeated while arguments are left, as POSIX has it. */
const printf: CommandRun = async (context) => {
  const [format, ...args] = context.args;
  if (format === undefined) {
    context.err("usage: printf format [arguments ...]\n");
    return 1;
  }
  const escapes: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\" };
  let used = 0;
  let text = "";
  do {
    const before = used;
    text += format
      .replace(/\\(.)/g, (whole, ch: string) => escapes[ch] ?? whole)
      .replace(/%(-?\d*)([sdf%])/g, (_, width: string, kind: string) => {
        if (kind === "%") return "%";
        const given = args[used] ?? (kind === "s" ? "" : "0");
        used += 1;
        const value = kind === "d" ? String(Math.trunc(Number(given))) : given;
        const room = Math.abs(Number(width || 0));
        return width.startsWith("-") ? value.padEnd(room) : value.padStart(room);
      });
    if (used === before) break;
  } while (used < args.length);
  context.out(text);
  return 0;
};

const basename: CommandRun = async ({ args, out, err }) => {
  const [path, suffix] = args;
  if (path === undefined) {
    err("usage: basename string [suffix]\n");
    return 1;
  }
  const name = path === "/" ? "/" : baseName(path.replace(/\/+$/, ""));
  out(
    `${suffix && name.endsWith(suffix) && name !== suffix ? name.slice(0, -suffix.length) : name}\n`,
  );
  return 0;
};

const dirname: CommandRun = async ({ args, out, err }) => {
  const [path] = args;
  if (path === undefined) {
    err("usage: dirname path\n");
    return 1;
  }
  const trimmed = path.replace(/\/+$/, "");
  out(`${trimmed.includes("/") ? folderOf(trimmed) : "."}\n`);
  return 0;
};

const seq: CommandRun = async ({ args, out, err }) => {
  const numbers = args.map(Number);
  if (numbers.length < 1 || numbers.length > 3 || numbers.some(Number.isNaN)) {
    err("usage: seq [first [incr]] last\n");
    return 1;
  }
  const first = numbers.length > 1 ? (numbers[0] as number) : 1;
  const step = numbers.length === 3 ? (numbers[1] as number) : 1;
  const last = numbers.at(-1) as number;
  if (step === 0 || Math.abs((last - first) / step) > 1_000_000) {
    err("seq: too many numbers to keep in the page\n");
    return 1;
  }
  for (let now = first; step > 0 ? now <= last : now >= last; now += step) out(`${now}\n`);
  return 0;
};

const shift: CommandRun = async ({ args, scope, err }) => {
  const count = args[0] === undefined ? 1 : Number(args[0]);
  if (!Number.isInteger(count) || count < 0 || count > scope.positional.length) {
    err("shift: shift count must be <= $#\n");
    return 1;
  }
  scope.positional = scope.positional.slice(count);
  return 0;
};

const type: CommandRun = async ({ args, scope, out, err }) => {
  let status = 0;
  for (const name of args) {
    const value = scope.aliases.get(name);
    const place = commandPlace(name);
    if (value !== undefined) out(`${name} is an alias for ${value}\n`);
    else if (place?.builtIn) out(`${name} is a shell builtin\n`);
    else if (place) out(`${name} is ${place.path}\n`);
    else {
      err(`${name} not found\n`);
      status = 1;
    }
  }
  return status;
};

/** The job `word` names (`%1`, or the latest with none), or undefined. */
function jobNamed(jobs: readonly ShellJob[], word: string | undefined): ShellJob | undefined {
  if (word === undefined) return jobs.at(-1);
  const number = Number(word.replace(/^%/, ""));
  return jobs.find((job) => job.number === number);
}

const jobs: CommandRun = async ({ session, out }) => {
  const list = session.jobs;
  for (const [at, job] of list.entries()) {
    const mark = at === list.length - 1 ? "+" : at === list.length - 2 ? "-" : " ";
    out(`[${job.number}]  ${mark} ${job.running ? "running" : "done"}    ${job.text}\n`);
  }
  return 0;
};

const fg: CommandRun = async (context) => {
  const job = jobNamed(context.session.jobs, context.args[0]);
  if (!job) {
    context.err(
      `fg: ${context.args[0] ? `job not found: ${context.args[0]}` : "no current job"}\n`,
    );
    return 1;
  }
  context.out(`[${job.number}]  - running    ${job.text}\n`);
  const stop = () => job.stop();
  context.signal.addEventListener("abort", stop, { once: true });
  await job.ended;
  context.signal.removeEventListener("abort", stop);
  return job.status;
};

const bg: CommandRun = async (context) => {
  const job = jobNamed(context.session.jobs, context.args[0]);
  if (!job) {
    context.err(
      `bg: ${context.args[0] ? `job not found: ${context.args[0]}` : "no current job"}\n`,
    );
    return 1;
  }
  context.err(`bg: job already in background\n`);
  return 1;
};

const wait: CommandRun = async (context) => {
  const asked = context.args.map((word) => jobNamed(context.session.jobs, word));
  const waiting = context.args.length > 0 ? asked : [...context.session.jobs];
  let status = 0;
  for (const job of waiting) {
    if (!job) continue;
    await job.ended;
    status = job.status;
  }
  return status;
};

export const SCRIPT_COMMANDS: Readonly<Record<string, CommandRun>> = {
  ".": source,
  ":": async () => 0,
  "[": test,
  "[[": test,
  alias,
  basename,
  bash: shell,
  bg,
  chmod,
  dirname,
  false: async () => 1,
  fg,
  jobs,
  printf,
  read,
  seq,
  sh: shell,
  shift,
  sleep,
  source,
  test,
  true: async () => 0,
  type,
  unalias,
  wait,
  zsh: shell,
};
