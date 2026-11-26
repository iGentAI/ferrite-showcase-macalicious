import {
  FERRITE_URL,
  type FerriteView,
  ferriteFromServer,
} from "../activity-monitor/activity-monitor-figures";
import { requestDesktopEffects } from "../desktop/desktop-effects";
import { linkAddress, openUrl } from "../desktop/desktop-open-url";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { servedByDesktopApp, sessionFetch, withDeadline } from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { scanWindows } from "../desktop/desktop-window-scan";
import { lookUp, wordOfDictLink } from "../dictionary/dictionary-desktop";
import { openFile, showInFinder } from "../finder/finder-open";
import { runOnServer } from "../script-editor/script-editor-server";
import type { CommandContext, CommandRun } from "./terminal-context";
import { resolvePath } from "./terminal-files";
import { Interrupted } from "./terminal-io";
import { parseOptions } from "./terminal-options";

/**
 * The commands that reach beyond the files: other applications (`open`), the clipboard, speech,
 * Spotlight, the windows on the desktop and the Script Editor module's interpreter. A command that
 * needs a real computer says so, and what it would take.
 */

const NOT_SERVED = "this build has no server, so it cannot run here";
const NO_KEYBOARD =
  "give it text through a pipe or <: this shell has no way to read it from the keyboard";
const pad = (value: number) => String(value).padStart(2, "0");

/** The commands that need a real computer, with what they answer. */
const REFUSALS: Readonly<Record<string, string>> = {
  sudo: "there is no root here: this shell runs in the page, and every file belongs to you",
  ssh: "this page has no sockets, so it cannot reach another computer",
  scp: "this page has no sockets, so it cannot reach another computer",
  telnet: "this page has no sockets, so it cannot reach another computer",
  ftp: "this page has no sockets, so it cannot reach another computer",
  ping: "this page has no sockets, so it cannot reach another computer",
  curl: "this shell does not reach the web; use Safari",
  wget: "this shell does not reach the web; use Safari",
  brew: "nothing can be installed: there is no computer underneath this shell",
  npm: "nothing can be installed: there is no computer underneath this shell",
  pip: "nothing can be installed: there is no computer underneath this shell",
  python: "there is no Python here; node runs JavaScript on the desktop's server",
  python3: "there is no Python here; node runs JavaScript on the desktop's server",
  ruby: "there is no Ruby here; node runs JavaScript on the desktop's server",
  perl: "there is no Perl here; node runs JavaScript on the desktop's server",
  git: "there is no git here: the drive keeps no history and this page has no sockets",
  make: "there are no build tools here: no process can start",
  gcc: "there are no build tools here: no process can start",
  vim: "there is no full-screen editor here; use TextEdit, which opens the same files",
  vi: "there is no full-screen editor here; use TextEdit, which opens the same files",
  emacs: "there is no full-screen editor here; use TextEdit, which opens the same files",
  nano: "there is no full-screen editor here; use TextEdit, which opens the same files",
};

/** Whether `name` is a command that only says why it cannot run here. */
export const onlyRefuses = (name: string) => Object.hasOwn(REFUSALS, name);

const refusals: Record<string, CommandRun> = Object.fromEntries(
  Object.entries(REFUSALS).map(([name, why]) => [
    name,
    async (context: CommandContext) => {
      context.err(`${name}: ${why}\n`);
      return 1;
    },
  ]),
);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const date: CommandRun = async (context) => {
  const format = context.args.find((arg) => arg.startsWith("+"));
  const now = new Date();
  const zone =
    new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value ?? "";
  const fields: Readonly<Record<string, string>> = {
    Y: String(now.getFullYear()),
    m: pad(now.getMonth() + 1),
    d: pad(now.getDate()),
    H: pad(now.getHours()),
    M: pad(now.getMinutes()),
    S: pad(now.getSeconds()),
    a: DAYS[now.getDay()] as string,
    b: MONTHS[now.getMonth()] as string,
    Z: zone,
    s: String(Math.floor(now.getTime() / 1000)),
    F: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    T: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    n: "\n",
    t: "\t",
    "%": "%",
  };
  const text = format
    ? format.slice(1).replace(/%(.)/g, (whole, code: string) => fields[code] ?? whole)
    : `${fields.a} ${fields.b} ${String(now.getDate()).padStart(2)} ${fields.T} ${zone} ${fields.Y}`;
  context.out(`${text}\n`);
  return 0;
};

const uname: CommandRun = async (context) => {
  const { options } = parseOptions(context.args);
  const all = options.has("a");
  const parts = [
    all || options.has("s") || options.size === 0 ? "Simulated" : "",
    all || options.has("n") ? context.session.hostName : "",
    all || options.has("r") ? "1.0" : "",
    all || options.has("m") || options.has("p") ? "browser" : "",
  ];
  context.out(`${parts.filter((part) => part !== "").join(" ")}\n`);
  return 0;
};

const id: CommandRun = async (context) => {
  const user = context.session.userName;
  context.out(`uid=501(${user}) gid=20(staff) groups=20(staff)\n`);
  return 0;
};

const appIdOf = (name: string) => name.toLowerCase().replace(/\s+/g, "-");

/** The application the name of `open -a` means, from the names in Applications and Utilities. */
async function applicationId(context: CommandContext, name: string): Promise<string | undefined> {
  const wanted = name.replace(/\.app$/i, "").toLowerCase();
  const { files } = context.session;
  const list = [
    ...(await files.list("/Applications").catch(() => [])),
    ...(await files.list("/Applications/Utilities").catch(() => [])),
  ];
  const found = list.find((entry) => entry.node.name.toLowerCase() === wanted);
  return found && appIdOf(found.node.name);
}

const open: CommandRun = async (context) => {
  const { options, operands } = parseOptions(context.args, "a");
  const { files } = context.session;
  const named = options.get("a");
  let app: string | undefined;
  if (typeof named === "string") {
    app = await applicationId(context, named);
    if (!app) {
      context.err(`Unable to find application named '${named}'\n`);
      return 1;
    }
    if (operands.length === 0) {
      requestDesktopEffects([{ open: app }]);
      return 0;
    }
  }
  if (operands.length === 0) {
    context.err("usage: open [-a application] file ...\n");
    return 1;
  }
  let status = 0;
  for (const operand of operands) {
    if (linkAddress(operand)) {
      openUrl(operand, "terminal");
      continue;
    }
    const word = wordOfDictLink(operand);
    if (word) {
      lookUp(word);
      continue;
    }
    const path = resolvePath(operand, context.scope.cwd);
    const node = await files.at(path);
    if (!node) {
      context.err(`The file ${path} does not exist.\n`);
      status = 1;
    } else if (node.kind === "application") {
      requestDesktopEffects([{ open: appIdOf(node.name) }]);
    } else if (node.children) {
      showInFinder({ place: path });
    } else if (!node.id || !openFile({ id: node.id, name: node.name, type: node.type }, app)) {
      context.err(`No application knows how to open ${path}.\n`);
      status = 1;
    }
  }
  return status;
};

const pbcopy: CommandRun = async (context) => {
  if (context.stdin === null) {
    context.err(`pbcopy: ${NO_KEYBOARD}\n`);
    return 1;
  }
  if (!(await copyText(context.stdin))) {
    context.err("pbcopy: the browser did not let this page write the clipboard\n");
    return 1;
  }
  return 0;
};

const pbpaste: CommandRun = async (context) => {
  try {
    context.out(await navigator.clipboard.readText());
    return 0;
  } catch {
    context.err("pbpaste: the browser did not let this page read the clipboard\n");
    return 1;
  }
};

/** The rate a Mac's `say` speaks at. */
const DEFAULT_WORDS_PER_MINUTE = 175;
/** How long a browser may take to list its voices, which it loads after the page. */
const VOICES_DEADLINE_MS = 1000;

/** The browser's voices, once it has them; none when it has not said by the deadline. */
async function installedVoices(signal: AbortSignal): Promise<SpeechSynthesisVoice[]> {
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) return voices;
  await new Promise<void>((resolve, reject) => {
    const done = (act: () => void) => {
      clearTimeout(timer);
      speechSynthesis.removeEventListener("voiceschanged", loaded);
      signal.removeEventListener("abort", aborted);
      act();
    };
    const loaded = () => done(resolve);
    const aborted = () => done(() => reject(new Interrupted()));
    const timer = setTimeout(loaded, VOICES_DEADLINE_MS);
    speechSynthesis.addEventListener("voiceschanged", loaded);
    signal.addEventListener("abort", aborted);
    if (signal.aborted) aborted();
  });
  return speechSynthesis.getVoices();
}

const say: CommandRun = async (context) => {
  const { options, operands } = parseOptions(context.args, "vro");
  if (options.has("o")) {
    context.err("say: -o: this browser speaks aloud and cannot write a sound file\n");
    return 1;
  }
  const text = operands.length > 0 ? operands.join(" ") : context.stdin;
  if (text === null) {
    context.err(`say: ${NO_KEYBOARD}\n`);
    return 1;
  }
  if (typeof speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") {
    context.err("say: this browser has no speech\n");
    return 1;
  }
  const voiceName = options.get("v");
  const voice =
    typeof voiceName === "string"
      ? (await installedVoices(context.signal)).find((each) => each.name.startsWith(voiceName))
      : undefined;
  if (typeof voiceName === "string" && !voice) {
    context.err(`say: Voice \`${voiceName}' not found.\n`);
    return 1;
  }
  const rate = options.get("r");
  const wordsPerMinute = typeof rate === "string" ? Number(rate) : DEFAULT_WORDS_PER_MINUTE;
  if (!(wordsPerMinute > 0)) {
    context.err(`say: ${String(rate)}: not a rate in words per minute\n`);
    return 1;
  }
  if (context.signal.aborted) throw new Interrupted();
  const failure = await new Promise<string | null>((resolve, reject) => {
    const aborted = () => {
      speechSynthesis.cancel();
      reject(new Interrupted());
    };
    const finish = (result: string | null) => {
      context.signal.removeEventListener("abort", aborted);
      resolve(result);
    };
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.rate = Math.min(Math.max(wordsPerMinute / DEFAULT_WORDS_PER_MINUTE, 0.1), 10);
    utterance.onend = () => finish(null);
    utterance.onerror = (event) => finish(event.error ?? "unknown error");
    context.signal.addEventListener("abort", aborted, { once: true });
    speechSynthesis.speak(utterance);
  });
  if (failure !== null) {
    context.err(`say: the browser could not speak: ${failure}\n`);
    return 1;
  }
  return 0;
};

/** Runs JavaScript on the Script Editor module's interpreter and writes what it logged. */
async function runScript(
  context: CommandContext,
  code: string,
  printResult: boolean,
): Promise<number> {
  if (!servedByDesktopApp()) {
    context.err(`${context.name}: ${NOT_SERVED}\n`);
    return 1;
  }
  if (context.signal.aborted) throw new Interrupted();
  // Control-C ends the wait. The server's run cannot be called back: it is bounded by its own limits.
  const interrupted = new Promise<never>((_, reject) => {
    context.signal.addEventListener("abort", () => reject(new Interrupted()), { once: true });
  });
  let run: Awaited<ReturnType<typeof runOnServer>>;
  try {
    run = await Promise.race([runOnServer(code), interrupted]);
  } catch (error) {
    if (error instanceof Interrupted) throw error;
    context.err(`${context.name}: ${(error as Error).message}\n`);
    return 1;
  }
  for (const line of run.log) {
    if (!line.startsWith("→ ") && !line.startsWith("— ")) context.out(`${line}\n`);
  }
  if (run.failed) {
    context.err(`${run.result}\n`);
    return 1;
  }
  if (printResult && run.result !== "") context.out(`${run.result}\n`);
  return 0;
}

/** A script from a file, or else from what is piped in. */
async function scriptFrom(
  context: CommandContext,
  file: string | undefined,
  printResult: boolean,
): Promise<number> {
  if (file === undefined) {
    if (context.stdin === null) {
      context.err(`${context.name}: there is no prompt here; give it a file, or -e and a script\n`);
      return 1;
    }
    return runScript(context, context.stdin, printResult);
  }
  try {
    const code = await context.session.files.readText(resolvePath(file, context.scope.cwd));
    return await runScript(context, code, printResult);
  } catch (error) {
    if (error instanceof Interrupted) throw error;
    context.err(`${context.name}: ${file}: ${(error as Error).message}\n`);
    return 1;
  }
}

const node: CommandRun = async (context) => {
  const { options, operands } = parseOptions(context.args, "ep");
  const evaluate = options.get("e");
  const print = options.get("p");
  if (typeof evaluate === "string") return runScript(context, evaluate, false);
  if (typeof print === "string") return runScript(context, `return (${print});`, true);
  return scriptFrom(context, operands[0], false);
};

const osascript: CommandRun = async (context) => {
  const { options, operands } = parseOptions(context.args, "le");
  if (options.get("l") !== "JavaScript") {
    context.err("osascript: only JavaScript runs here: use -l JavaScript\n");
    return 1;
  }
  const code = options.get("e");
  if (typeof code === "string") return runScript(context, code, true);
  return scriptFrom(context, operands[0], true);
};

const mdfind: CommandRun = async (context) => {
  const query = context.args.filter((arg) => !arg.startsWith("-")).join(" ");
  if (!query) {
    context.err("usage: mdfind query\n");
    return 1;
  }
  if (!servedByDesktopApp()) {
    context.err(`mdfind: ${NOT_SERVED}\n`);
    return 1;
  }
  if (context.signal.aborted) throw new Interrupted();
  try {
    const reply = await withDeadline(async (signal) => {
      const response = await sessionFetch(`/api/spotlight/search?q=${encodeURIComponent(query)}`, {
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal: AbortSignal.any([signal, context.signal]),
      });
      if (!response.ok) throw new Error(`The server answered ${response.status}.`);
      return (await response.json()) as { results?: { kind?: string; title?: string }[] };
    });
    if (context.signal.aborted) throw new Interrupted();
    for (const result of reply.results ?? []) {
      context.out(`${result.kind ?? "item"}: ${result.title ?? ""}\n`);
    }
    return 0;
  } catch (error) {
    if (context.signal.aborted) throw new Interrupted();
    context.err(`mdfind: ${(error as Error).message}\n`);
    return 1;
  }
};

/**
 * Where a default is kept: `defaults-pairs.<domain>-<key>`. A domain and a key may both hold dots
 * (`com.apple.Terminal`), so a `-` parts them and `_` and four hex digits stand for any character
 * the settings route refuses in a name, which also takes in `-` and `_` themselves.
 */
const DEFAULTS_PREFIX = "defaults-pairs.";
const DEFAULTS_NAME_BYTES = 128;
const defaultsPart = (text: string) =>
  text.replace(/[^A-Za-z0-9.]/g, (ch) => `_${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
const defaultsText = (part: string) =>
  part.replace(/_([0-9a-f]{4})/g, (_, code: string) =>
    String.fromCharCode(Number.parseInt(code, 16)),
  );
const defaultsName = (domain: string, key: string) =>
  `${DEFAULTS_PREFIX}${defaultsPart(domain)}-${defaultsPart(key)}`;

/** Every default kept, as a domain, a key and a value; a deleted one is kept as `null`. */
function keptDefaults(): { domain: string; key: string; value: unknown }[] {
  return Object.entries(desktopValues()).flatMap(([name, value]) => {
    if (!name.startsWith(DEFAULTS_PREFIX) || value === null) return [];
    const [domain = "", key = ""] = name.slice(DEFAULTS_PREFIX.length).split("-");
    return [{ domain: defaultsText(domain), key: defaultsText(key), value }];
  });
}

const defaults: CommandRun = async (context) => {
  const [verb, domain, key, ...value] = context.args;
  const kept = keptDefaults();
  switch (verb) {
    case "domains": {
      const names = new Set(kept.map((each) => each.domain));
      context.out(`${[...names].sort().join(", ")}\n`);
      return 0;
    }
    case "read": {
      if (domain && key) {
        const found = kept.find((each) => each.domain === domain && each.key === key);
        if (!found) {
          context.err(`The domain/default pair of (${domain}, ${key}) does not exist\n`);
          return 1;
        }
        context.out(`${String(found.value)}\n`);
        return 0;
      }
      const shown = domain ? kept.filter((each) => each.domain === domain) : kept;
      if (domain && shown.length === 0) {
        context.err(`Domain ${domain} does not exist\n`);
        return 1;
      }
      context.out("{\n");
      for (const each of shown.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))) {
        context.out(`    "${each.key}" = "${String(each.value)}";\n`);
      }
      context.out("}\n");
      return 0;
    }
    case "write":
      if (!domain || !key || value.length === 0) {
        context.err("usage: defaults write domain key value\n");
        return 1;
      }
      if (defaultsName(domain, key).length > DEFAULTS_NAME_BYTES) {
        context.err(`defaults: (${domain}, ${key}): the name is too long to keep here\n`);
        return 1;
      }
      changeDesktopValue(defaultsName(domain, key), value.join(" "));
      return 0;
    case "delete":
      if (!domain || !key) {
        context.err("usage: defaults delete domain key\n");
        return 1;
      }
      changeDesktopValue(defaultsName(domain, key), null);
      return 0;
    default:
      context.err("usage: defaults [read | write | delete | domains] [domain [key [value]]]\n");
      return 1;
  }
};

const windowPids = new WeakMap<CommandContext["session"], Map<string, number>>();

/** A process number for a window, the same from one `ps` to the next and no other window's. */
function pidOf(context: CommandContext, id: string): number {
  const pids = windowPids.get(context.session) ?? new Map<string, number>();
  windowPids.set(context.session, pids);
  const pid = pids.get(id) ?? 1001 + pids.size;
  pids.set(id, pid);
  return pid;
}

const SIGNAL_NUMBERS: Readonly<Record<string, string>> = {
  "0": "0",
  "1": "HUP",
  "2": "INT",
  "9": "KILL",
  "15": "TERM",
};
const ENDING_SIGNALS = new Set(["HUP", "INT", "KILL", "TERM"]);

/** `kill`: quits the application a window of `ps` belongs to, as Force Quit does. */
const kill: CommandRun = async (context) => {
  const operands = [...context.args];
  let signal = "TERM";
  const first = operands[0];
  if (first === "-l") {
    context.out("HUP INT KILL TERM\n");
    return 0;
  }
  if (first?.startsWith("-") && first !== "--") {
    const named = first === "-s" ? operands[1] : first.slice(1);
    if (!named) {
      context.err("usage: kill [-signal] pid ...\n");
      return 1;
    }
    const name = named.toUpperCase().replace(/^SIG/, "");
    signal = SIGNAL_NUMBERS[name] ?? name;
    operands.splice(0, first === "-s" ? 2 : 1);
  }
  if (operands[0] === "--") operands.shift();
  if (signal !== "0" && !ENDING_SIGNALS.has(signal)) {
    context.err(
      `kill: ${signal}: no such signal here: 0 checks for a window, and HUP, INT, KILL and TERM quit its application\n`,
    );
    return 1;
  }
  if (operands.length === 0) {
    context.err("usage: kill [-signal] pid ...\n");
    return 1;
  }
  const windows = typeof document === "undefined" ? [] : scanWindows();
  let status = 0;
  for (const operand of operands) {
    const window = windows.find((each) => String(pidOf(context, each.id)) === operand);
    if (!window) {
      context.err(`kill: kill ${operand} failed: no such process\n`);
      status = 1;
    } else if (signal !== "0" && window.app === "terminal") {
      context.err(`kill: ${operand} is Terminal; close it with Shell > Close\n`);
      status = 1;
    } else if (signal !== "0") requestDesktopEffects([{ quit: window.app }]);
  }
  return status;
};

const TOP_EVERY_MS = 5_000;

async function readFigures(): Promise<FerriteView> {
  const view = await withDeadline(async (signal) => {
    const response = await sessionFetch(FERRITE_URL, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error(`The server answered ${response.status}.`);
    return ferriteFromServer(await response.json());
  }, TOP_EVERY_MS);
  if (!view) throw new Error("The server's figures could not be read.");
  return view;
}

function topLines(view: FerriteView, rows: number): string[] {
  const heading = `${"MODULE".padEnd(22)} ${"REQUESTS".padStart(8)} ${"PER SEC".padStart(7)} ${"ERRORS".padStart(6)} ${"STORE".padStart(8)}`;
  return [
    `Requests ${view.total.requests}, ${view.total.perSecond.toFixed(2)}/s, errors ${view.total.errors}, instance ${view.instance ?? "-"}`,
    "",
    heading,
    ...[...view.apps]
      .sort((a, b) => b.perSecond - a.perSecond)
      .slice(0, Math.max(0, rows - 4))
      .map(
        (app) =>
          `${app.title.slice(0, 22).padEnd(22)} ${String(app.requests).padStart(8)} ${app.perSecond.toFixed(2).padStart(7)} ${String(app.errors).padStart(6)} ${String(app.storeOps).padStart(8)}`,
      ),
  ];
}

/** `top`: Activity Monitor's figures for the desktop's modules, read again every few seconds. */
const top: CommandRun = async (context) => {
  if (!servedByDesktopApp()) {
    context.err(`top: ${NOT_SERVED}\n`);
    return 1;
  }
  if (context.args.length > 0) {
    context.err("top: this top takes no options; q quits it\n");
    return 1;
  }
  const { session } = context;
  const { emulator } = session;
  let view: FerriteView;
  try {
    view = await readFigures();
  } catch (error) {
    context.err(`top: ${(error as Error).message}\n`);
    return 1;
  }
  if (context.signal.aborted) throw new Interrupted();
  if (context.outIsPipe) {
    context.out(`${topLines(view, 10_000).join("\n")}\n`);
    return 0;
  }
  const paint = () => {
    const lines = topLines(view, emulator.rows).map((line) => line.slice(0, emulator.cols - 1));
    emulator.write(`\x1b[H\x1b[2J${lines.join("\r\n")}`);
  };
  emulator.write("\x1b[?1049h\x1b[?25l");
  let timer: ReturnType<typeof setInterval> | undefined;
  let showing = true;
  try {
    await new Promise<void>((resolve) => {
      timer = setInterval(() => {
        readFigures().then(
          (next) => {
            view = next;
            // A reply that comes after q finds another program's screen, or the prompt.
            if (showing) paint();
          },
          // A read that failed leaves the last figures up, as the next one may work.
          () => {},
        );
      }, TOP_EVERY_MS);
      session.onResize = paint;
      context.signal.addEventListener("abort", () => resolve(), { once: true });
      paint();
      session.takeKeyboard((key) => {
        if (key === "q" || key === "Q" || key === "\x03") {
          session.takeKeyboard(null);
          resolve();
        }
      });
    });
  } finally {
    showing = false;
    clearInterval(timer);
    session.takeKeyboard(null);
    session.onResize = null;
    emulator.write("\x1b[?25h\x1b[?1049l");
  }
  return 0;
};

const ps: CommandRun = async (context) => {
  const windows = typeof document === "undefined" ? [] : scanWindows();
  context.out("  PID APP                 WINDOW\n");
  for (const window of windows) {
    const state = window.minimized ? " (minimized)" : "";
    context.out(
      `${String(pidOf(context, window.id)).padStart(5)} ${window.app.padEnd(19)} ${window.title}${state}\n`,
    );
  }
  return 0;
};

export const MAC_COMMANDS: Readonly<Record<string, CommandRun>> = {
  ...refusals,
  date,
  defaults,
  hostname: async (context) => {
    context.out(`${context.session.hostName}\n`);
    return 0;
  },
  id,
  kill,
  mdfind,
  node,
  open,
  osascript,
  pbcopy,
  pbpaste,
  ps,
  say,
  top,
  uname,
  whoami: async (context) => {
    context.out(`${context.session.userName}\n`);
    return 0;
  },
};
